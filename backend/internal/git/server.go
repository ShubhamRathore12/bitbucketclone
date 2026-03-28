package git

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"github.com/gitforge/backend/internal/middleware"
)

// GitServer handles the Git Smart HTTP protocol for clone, fetch, and push
// operations over HTTP. It shells out to the canonical git binaries so that
// protocol behaviour is always correct.
type GitServer struct {
	// BasePath is the root directory under which bare repositories are stored.
	// The layout is: <BasePath>/<workspace>/<repo>.git
	BasePath string

	// JWTSecret is used for authenticating push operations via Basic-Auth
	// where the password is a JWT access token.
	JWTSecret string
}

// NewGitServer creates a new GitServer instance.
func NewGitServer(basePath, jwtSecret string) *GitServer {
	return &GitServer{
		BasePath:  basePath,
		JWTSecret: jwtSecret,
	}
}

// repoPath resolves and validates the on-disk path for a repository.
func (gs *GitServer) repoPath(workspace, repo string) (string, error) {
	// Sanitise inputs to prevent directory traversal.
	workspace = filepath.Base(workspace)
	repo = filepath.Base(repo)

	if workspace == "" || repo == "" || workspace == "." || repo == "." {
		return "", fmt.Errorf("invalid workspace or repo name")
	}

	p := filepath.Join(gs.BasePath, workspace, repo+".git")

	info, err := os.Stat(p)
	if err != nil {
		return "", fmt.Errorf("repository not found: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("repository path is not a directory")
	}
	return p, nil
}

// extractRepoParams pulls workspace and repo slug from the Fiber route params.
// The repo param may or may not have a .git suffix.
func extractRepoParams(c *fiber.Ctx) (workspace, repo string) {
	workspace = c.Params("workspace")
	repo = c.Params("repo")
	repo = strings.TrimSuffix(repo, ".git")
	return
}

// ---------------------------------------------------------------------------
// GET /:workspace/:repo.git/info/refs?service=git-upload-pack|git-receive-pack
// ---------------------------------------------------------------------------

// HandleInfoRefs advertises references for either git-upload-pack (fetch/clone)
// or git-receive-pack (push). This is the initial discovery step in the Git
// Smart HTTP protocol.
func (gs *GitServer) HandleInfoRefs(c *fiber.Ctx) error {
	service := c.Query("service")
	if service != "git-upload-pack" && service != "git-receive-pack" {
		return c.Status(fiber.StatusBadRequest).SendString("invalid service parameter")
	}

	workspace, repo := extractRepoParams(c)

	// Require authentication for push advertisement.
	if service == "git-receive-pack" {
		if err := gs.authenticateBasicAuth(c); err != nil {
			return err
		}
	}

	rp, err := gs.repoPath(workspace, repo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString(err.Error())
	}

	cmd := exec.Command("git", service, "--stateless-rpc", "--advertise-refs", rp)
	cmd.Env = append(os.Environ(), "GIT_PROTOCOL=version=2")

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(
			fmt.Sprintf("git error: %s: %s", err.Error(), stderr.String()),
		)
	}

	c.Set("Content-Type", fmt.Sprintf("application/x-%s-advertisement", service))
	c.Set("Cache-Control", "no-cache")

	// The smart HTTP protocol requires a preamble packet.
	preamble := pktLine(fmt.Sprintf("# service=%s\n", service))
	flushPkt := "0000"

	var buf bytes.Buffer
	buf.WriteString(preamble)
	buf.WriteString(flushPkt)
	buf.Write(stdout.Bytes())

	return c.Send(buf.Bytes())
}

// ---------------------------------------------------------------------------
// POST /:workspace/:repo.git/git-upload-pack  (clone / fetch)
// ---------------------------------------------------------------------------

// HandleUploadPack handles the upload-pack phase where the server sends pack
// data to the client (clone / fetch).
func (gs *GitServer) HandleUploadPack(c *fiber.Ctx) error {
	workspace, repo := extractRepoParams(c)

	rp, err := gs.repoPath(workspace, repo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString(err.Error())
	}

	return gs.runServiceRPC(c, "git-upload-pack", rp)
}

// ---------------------------------------------------------------------------
// POST /:workspace/:repo.git/git-receive-pack  (push)
// ---------------------------------------------------------------------------

// HandleReceivePack handles the receive-pack phase where the client pushes
// pack data to the server.
func (gs *GitServer) HandleReceivePack(c *fiber.Ctx) error {
	if err := gs.authenticateBasicAuth(c); err != nil {
		return err
	}

	workspace, repo := extractRepoParams(c)

	rp, err := gs.repoPath(workspace, repo)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString(err.Error())
	}

	return gs.runServiceRPC(c, "git-receive-pack", rp)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// runServiceRPC executes a git service (upload-pack or receive-pack) as a
// stateless RPC call, piping the request body as stdin and the git output
// as the response body.
func (gs *GitServer) runServiceRPC(c *fiber.Ctx, service, repoPath string) error {
	c.Set("Content-Type", fmt.Sprintf("application/x-%s-result", service))
	c.Set("Cache-Control", "no-cache")

	cmd := exec.Command("git", service, "--stateless-rpc", repoPath)
	cmd.Env = append(os.Environ(), "GIT_PROTOCOL=version=2")

	cmd.Stdin = bytes.NewReader(c.Body())

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg != "" {
			return c.Status(fiber.StatusInternalServerError).SendString(
				fmt.Sprintf("git %s error: %s", service, errMsg),
			)
		}
	}

	return c.Send(stdout.Bytes())
}

// authenticateBasicAuth validates HTTP Basic authentication where the password
// is a JWT access token. The username can be anything (commonly "x-token-auth").
func (gs *GitServer) authenticateBasicAuth(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if auth == "" {
		c.Set("WWW-Authenticate", `Basic realm="GitForge"`)
		return c.Status(fiber.StatusUnauthorized).SendString("authentication required")
	}

	// Support both Basic auth (git client) and Bearer token (API clients).
	if strings.HasPrefix(auth, "Basic ") {
		username, password, ok := parseBasicAuth(auth)
		if !ok || password == "" {
			c.Set("WWW-Authenticate", `Basic realm="GitForge"`)
			return c.Status(fiber.StatusUnauthorized).SendString("invalid credentials")
		}
		_ = username

		if err := gs.validateJWT(password); err != nil {
			c.Set("WWW-Authenticate", `Basic realm="GitForge"`)
			return c.Status(fiber.StatusUnauthorized).SendString("invalid token: " + err.Error())
		}
		return nil
	}

	if strings.HasPrefix(auth, "Bearer ") {
		token := strings.TrimPrefix(auth, "Bearer ")
		if err := gs.validateJWT(token); err != nil {
			return c.Status(fiber.StatusUnauthorized).SendString("invalid token: " + err.Error())
		}
		return nil
	}

	c.Set("WWW-Authenticate", `Basic realm="GitForge"`)
	return c.Status(fiber.StatusUnauthorized).SendString("unsupported authorization scheme")
}

// validateJWT parses and validates a JWT token string using the server secret.
func (gs *GitServer) validateJWT(tokenStr string) error {
	claims := &middleware.UserClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(gs.JWTSecret), nil
	})
	if err != nil {
		return err
	}
	if !token.Valid {
		return fmt.Errorf("token is not valid")
	}
	return nil
}

// parseBasicAuth decodes an HTTP Basic Authorization header value.
func parseBasicAuth(auth string) (username, password string, ok bool) {
	encoded := strings.TrimPrefix(auth, "Basic ")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", "", false
	}
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// pktLine formats a string as a Git pkt-line.
func pktLine(s string) string {
	n := len(s) + 4
	return fmt.Sprintf("%04x%s", n, s)
}
