package middleware

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Role constants mirror the values stored in the database.
const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleWrite  = "write"
	RoleRead   = "read"
)

// roleHierarchy maps each role to a numeric level so that higher-privilege
// roles satisfy lower-privilege checks (owner > admin > write > read).
var roleHierarchy = map[string]int{
	RoleRead:  1,
	RoleWrite: 2,
	RoleAdmin: 3,
	RoleOwner: 4,
}

// RequireWorkspaceRole returns middleware that ensures the authenticated user
// holds at least the specified role within the workspace identified by the
// :workspace URL parameter.
func RequireWorkspaceRole(db *pgxpool.Pool, minRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := GetUserID(c)
		if userID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		workspaceSlug := c.Params("workspace")
		if workspaceSlug == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "workspace parameter is required",
			})
		}

		role, err := fetchWorkspaceRole(c.Context(), db, userID, workspaceSlug)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to check workspace permissions",
			})
		}

		if !hasSufficientRole(role, minRole) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": fmt.Sprintf("requires at least %q role in workspace %q", minRole, workspaceSlug),
			})
		}

		c.Locals("workspace_slug", workspaceSlug)
		c.Locals("workspace_role", role)
		return c.Next()
	}
}

// RequireRepoRole returns middleware that ensures the authenticated user holds
// at least the specified role for the repository identified by :workspace and
// :repo URL parameters. It checks both direct repo-level permissions and
// inherited workspace-level permissions, using the higher of the two.
func RequireRepoRole(db *pgxpool.Pool, minRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := GetUserID(c)
		if userID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		workspaceSlug := c.Params("workspace")
		repoSlug := c.Params("repo")
		if workspaceSlug == "" || repoSlug == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "workspace and repo parameters are required",
			})
		}

		// Check workspace-level role first (it may already be sufficient).
		wsRole, _ := fetchWorkspaceRole(c.Context(), db, userID, workspaceSlug)

		// Check repo-specific role.
		repoRole, _ := fetchRepoRole(c.Context(), db, userID, workspaceSlug, repoSlug)

		// Use the higher of the two roles.
		effectiveRole := higherRole(wsRole, repoRole)

		// For public repos, grant implicit read access.
		if effectiveRole == "" {
			isPublic, err := isRepoPublic(c.Context(), db, workspaceSlug, repoSlug)
			if err == nil && isPublic {
				effectiveRole = RoleRead
			}
		}

		if !hasSufficientRole(effectiveRole, minRole) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": fmt.Sprintf("requires at least %q role on %s/%s", minRole, workspaceSlug, repoSlug),
			})
		}

		c.Locals("workspace_slug", workspaceSlug)
		c.Locals("repo_slug", repoSlug)
		c.Locals("repo_role", effectiveRole)
		return c.Next()
	}
}

// fetchWorkspaceRole queries the user's role in a workspace.
func fetchWorkspaceRole(ctx context.Context, db *pgxpool.Pool, userID, workspaceSlug string) (string, error) {
	query := `
		SELECT wm.role
		FROM workspace_members wm
		JOIN workspaces w ON w.id = wm.workspace_id
		WHERE wm.user_id = $1 AND w.slug = $2
		LIMIT 1`

	var role string
	err := db.QueryRow(ctx, query, userID, workspaceSlug).Scan(&role)
	return role, err
}

// fetchRepoRole queries the user's role for a specific repository.
func fetchRepoRole(ctx context.Context, db *pgxpool.Pool, userID, workspaceSlug, repoSlug string) (string, error) {
	query := `
		SELECT rm.role
		FROM repo_members rm
		JOIN repositories r ON r.id = rm.repo_id
		JOIN workspaces w ON w.id = r.workspace_id
		WHERE rm.user_id = $1 AND w.slug = $2 AND r.slug = $3
		LIMIT 1`

	var role string
	err := db.QueryRow(ctx, query, userID, workspaceSlug, repoSlug).Scan(&role)
	return role, err
}

// isRepoPublic checks whether a repository is publicly visible.
func isRepoPublic(ctx context.Context, db *pgxpool.Pool, workspaceSlug, repoSlug string) (bool, error) {
	query := `
		SELECT r.is_public
		FROM repositories r
		JOIN workspaces w ON w.id = r.workspace_id
		WHERE w.slug = $1 AND r.slug = $2
		LIMIT 1`

	var pub bool
	err := db.QueryRow(ctx, query, workspaceSlug, repoSlug).Scan(&pub)
	return pub, err
}

// hasSufficientRole returns true when the user's actual role meets or exceeds
// the minimum required role.
func hasSufficientRole(actual, required string) bool {
	a, aOK := roleHierarchy[actual]
	r, rOK := roleHierarchy[required]
	if !aOK || !rOK {
		return false
	}
	return a >= r
}

// higherRole returns whichever of the two roles has more privilege.
func higherRole(a, b string) string {
	aLevel := roleHierarchy[a]
	bLevel := roleHierarchy[b]
	if aLevel >= bLevel {
		return a
	}
	return b
}
