package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/gitforge/backend/internal/config"
	"github.com/gitforge/backend/internal/database"
	"github.com/gitforge/backend/internal/middleware"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// -------------------------------------------------------------------------
	// Configuration
	// -------------------------------------------------------------------------
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	log.Printf("[boot] environment=%s port=%s", cfg.Server.Env, cfg.Server.Port)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// -------------------------------------------------------------------------
	// PostgreSQL
	// -------------------------------------------------------------------------
	db, err := database.NewPostgresPool(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer db.Close()

	// -------------------------------------------------------------------------
	// Redis
	// -------------------------------------------------------------------------
	rdb, err := database.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer func() { _ = rdb.Close() }()

	// -------------------------------------------------------------------------
	// Fiber application
	// -------------------------------------------------------------------------
	app := newFiberApp(cfg)
	registerGlobalMiddleware(app, cfg, rdb)
	registerRoutes(app, cfg, db, rdb)

	// -------------------------------------------------------------------------
	// Graceful shutdown
	// -------------------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		addr := fmt.Sprintf(":%s", cfg.Server.Port)
		log.Printf("[boot] listening on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-quit
	log.Println("[shutdown] signal received, draining connections...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		log.Printf("[shutdown] server forced to shutdown: %v", err)
	}

	log.Println("[shutdown] complete")
}

// newFiberApp creates a Fiber instance with production-ready defaults.
func newFiberApp(cfg *config.Config) *fiber.App {
	return fiber.New(fiber.Config{
		AppName:               "GitForge API",
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          15 * time.Second,
		IdleTimeout:           60 * time.Second,
		BodyLimit:             50 * 1024 * 1024, // 50 MB for git pushes
		DisableStartupMessage: cfg.IsProduction(),
		ErrorHandler:          globalErrorHandler,
	})
}

// globalErrorHandler is the centralized error handler for all Fiber routes.
func globalErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "internal server error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}

	return c.Status(code).JSON(fiber.Map{
		"error": msg,
	})
}

// registerGlobalMiddleware attaches cross-cutting middleware to the app.
func registerGlobalMiddleware(app *fiber.App, cfg *config.Config, rdb *redis.Client) {
	// Panic recovery.
	app.Use(recover.New(recover.Config{
		EnableStackTrace: cfg.IsDevelopment(),
	}))

	// Request logging.
	app.Use(middleware.RequestLogger())

	// CORS.
	allowOrigins := "*"
	if cfg.IsProduction() {
		allowOrigins = "https://gitforge.dev,https://www.gitforge.dev"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
		AllowCredentials: true,
		MaxAge:           86400,
	}))

	// Global rate limiter: 100 requests/minute per IP.
	app.Use(middleware.NewRateLimiter(rdb, middleware.DefaultRateLimitConfig()))
}

// registerRoutes wires every route group to the Fiber app.
func registerRoutes(app *fiber.App, cfg *config.Config, db *pgxpool.Pool, rdb *redis.Client) {
	// Health check (no auth).
	app.Get("/health", healthHandler(db, rdb))

	api := app.Group("/api/v1")

	auth := middleware.AuthMiddleware(cfg.JWT.Secret)
	optAuth := middleware.OptionalAuth(cfg.JWT.Secret)
	_ = optAuth // used in public-readable routes

	// ----- Auth -----
	authGroup := api.Group("/auth")
	authGroup.Post("/register", placeholderHandler("register"))
	authGroup.Post("/login", placeholderHandler("login"))
	authGroup.Post("/refresh", placeholderHandler("refresh"))
	authGroup.Post("/logout", auth, placeholderHandler("logout"))
	authGroup.Post("/forgot-password", placeholderHandler("forgot-password"))
	authGroup.Post("/reset-password", placeholderHandler("reset-password"))
	authGroup.Get("/oauth/google", placeholderHandler("oauth-google-redirect"))
	authGroup.Get("/oauth/google/callback", placeholderHandler("oauth-google-callback"))
	authGroup.Get("/oauth/github", placeholderHandler("oauth-github-redirect"))
	authGroup.Get("/oauth/github/callback", placeholderHandler("oauth-github-callback"))

	// ----- Users -----
	userGroup := api.Group("/users")
	userGroup.Get("/me", auth, placeholderHandler("get-current-user"))
	userGroup.Put("/me", auth, placeholderHandler("update-current-user"))
	userGroup.Get("/me/notifications", auth, placeholderHandler("get-my-notifications"))
	userGroup.Get("/:username", optAuth, placeholderHandler("get-user-profile"))

	// ----- Workspaces -----
	wsGroup := api.Group("/workspaces", auth)
	wsGroup.Post("/", placeholderHandler("create-workspace"))
	wsGroup.Get("/", placeholderHandler("list-workspaces"))
	wsGroup.Get("/:workspace", placeholderHandler("get-workspace"))
	wsGroup.Put("/:workspace", middleware.RequireWorkspaceRole(db, middleware.RoleAdmin), placeholderHandler("update-workspace"))
	wsGroup.Delete("/:workspace", middleware.RequireWorkspaceRole(db, middleware.RoleOwner), placeholderHandler("delete-workspace"))
	wsGroup.Get("/:workspace/members", middleware.RequireWorkspaceRole(db, middleware.RoleRead), placeholderHandler("list-workspace-members"))
	wsGroup.Post("/:workspace/members", middleware.RequireWorkspaceRole(db, middleware.RoleAdmin), placeholderHandler("add-workspace-member"))
	wsGroup.Delete("/:workspace/members/:user_id", middleware.RequireWorkspaceRole(db, middleware.RoleAdmin), placeholderHandler("remove-workspace-member"))

	// ----- Repositories -----
	repoGroup := api.Group("/workspaces/:workspace/repos")
	repoGroup.Post("/", auth, middleware.RequireWorkspaceRole(db, middleware.RoleWrite), placeholderHandler("create-repo"))
	repoGroup.Get("/", optAuth, placeholderHandler("list-repos"))
	repoGroup.Get("/:repo", optAuth, placeholderHandler("get-repo"))
	repoGroup.Put("/:repo", auth, middleware.RequireRepoRole(db, middleware.RoleAdmin), placeholderHandler("update-repo"))
	repoGroup.Delete("/:repo", auth, middleware.RequireRepoRole(db, middleware.RoleAdmin), placeholderHandler("delete-repo"))
	repoGroup.Post("/:repo/fork", auth, placeholderHandler("fork-repo"))
	repoGroup.Get("/:repo/branches", optAuth, placeholderHandler("list-branches"))
	repoGroup.Get("/:repo/tags", optAuth, placeholderHandler("list-tags"))
	repoGroup.Get("/:repo/commits", optAuth, placeholderHandler("list-commits"))
	repoGroup.Get("/:repo/tree/*", optAuth, placeholderHandler("browse-tree"))
	repoGroup.Get("/:repo/blob/*", optAuth, placeholderHandler("get-blob"))
	repoGroup.Get("/:repo/raw/*", optAuth, placeholderHandler("get-raw"))

	// ----- Pull Requests -----
	prGroup := api.Group("/workspaces/:workspace/repos/:repo/pull-requests")
	prGroup.Post("/", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("create-pr"))
	prGroup.Get("/", optAuth, placeholderHandler("list-prs"))
	prGroup.Get("/:pr_id", optAuth, placeholderHandler("get-pr"))
	prGroup.Put("/:pr_id", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("update-pr"))
	prGroup.Post("/:pr_id/merge", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("merge-pr"))
	prGroup.Post("/:pr_id/decline", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("decline-pr"))
	prGroup.Post("/:pr_id/approve", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("approve-pr"))
	prGroup.Get("/:pr_id/diff", optAuth, placeholderHandler("get-pr-diff"))
	prGroup.Get("/:pr_id/comments", optAuth, placeholderHandler("list-pr-comments"))
	prGroup.Post("/:pr_id/comments", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("create-pr-comment"))

	// ----- Issues -----
	issueGroup := api.Group("/workspaces/:workspace/repos/:repo/issues")
	issueGroup.Post("/", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("create-issue"))
	issueGroup.Get("/", optAuth, placeholderHandler("list-issues"))
	issueGroup.Get("/:issue_id", optAuth, placeholderHandler("get-issue"))
	issueGroup.Put("/:issue_id", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("update-issue"))
	issueGroup.Get("/:issue_id/comments", optAuth, placeholderHandler("list-issue-comments"))
	issueGroup.Post("/:issue_id/comments", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("create-issue-comment"))

	// ----- Pipelines (CI/CD) -----
	pipelineGroup := api.Group("/workspaces/:workspace/repos/:repo/pipelines")
	pipelineGroup.Get("/", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("list-pipelines"))
	pipelineGroup.Post("/", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("trigger-pipeline"))
	pipelineGroup.Get("/:pipeline_id", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("get-pipeline"))
	pipelineGroup.Get("/:pipeline_id/steps", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("list-pipeline-steps"))
	pipelineGroup.Get("/:pipeline_id/steps/:step_id/log", auth, middleware.RequireRepoRole(db, middleware.RoleRead), placeholderHandler("get-step-log"))
	pipelineGroup.Post("/:pipeline_id/stop", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("stop-pipeline"))

	// ----- Wiki -----
	wikiGroup := api.Group("/workspaces/:workspace/repos/:repo/wiki")
	wikiGroup.Get("/", optAuth, placeholderHandler("list-wiki-pages"))
	wikiGroup.Post("/", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("create-wiki-page"))
	wikiGroup.Get("/:slug", optAuth, placeholderHandler("get-wiki-page"))
	wikiGroup.Put("/:slug", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("update-wiki-page"))
	wikiGroup.Delete("/:slug", auth, middleware.RequireRepoRole(db, middleware.RoleWrite), placeholderHandler("delete-wiki-page"))

	// ----- Snippets -----
	snippetGroup := api.Group("/snippets")
	snippetGroup.Post("/", auth, placeholderHandler("create-snippet"))
	snippetGroup.Get("/", optAuth, placeholderHandler("list-snippets"))
	snippetGroup.Get("/:snippet_id", optAuth, placeholderHandler("get-snippet"))
	snippetGroup.Put("/:snippet_id", auth, placeholderHandler("update-snippet"))
	snippetGroup.Delete("/:snippet_id", auth, placeholderHandler("delete-snippet"))

	// ----- Search -----
	searchGroup := api.Group("/search")
	searchGroup.Get("/code", optAuth, placeholderHandler("search-code"))
	searchGroup.Get("/repos", optAuth, placeholderHandler("search-repos"))
	searchGroup.Get("/users", optAuth, placeholderHandler("search-users"))
	searchGroup.Get("/issues", optAuth, placeholderHandler("search-issues"))

	// ----- Notifications -----
	notifGroup := api.Group("/notifications", auth)
	notifGroup.Get("/", placeholderHandler("list-notifications"))
	notifGroup.Put("/:notification_id/read", placeholderHandler("mark-notification-read"))
	notifGroup.Put("/read-all", placeholderHandler("mark-all-notifications-read"))

	// ----- Webhooks -----
	webhookGroup := api.Group("/workspaces/:workspace/repos/:repo/webhooks", auth, middleware.RequireRepoRole(db, middleware.RoleAdmin))
	webhookGroup.Post("/", placeholderHandler("create-webhook"))
	webhookGroup.Get("/", placeholderHandler("list-webhooks"))
	webhookGroup.Get("/:webhook_id", placeholderHandler("get-webhook"))
	webhookGroup.Put("/:webhook_id", placeholderHandler("update-webhook"))
	webhookGroup.Delete("/:webhook_id", placeholderHandler("delete-webhook"))

	// ----- Git Smart HTTP -----
	gitHTTP := app.Group("/:workspace/:repo.git")
	gitHTTP.Get("/info/refs", optAuth, placeholderHandler("git-info-refs"))
	gitHTTP.Post("/git-upload-pack", optAuth, placeholderHandler("git-upload-pack"))
	gitHTTP.Post("/git-receive-pack", auth, placeholderHandler("git-receive-pack"))

	// ----- WebSocket -----
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/notifications", websocket.New(wsNotificationHandler()))
	app.Get("/ws/pipelines/:pipeline_id", websocket.New(wsPipelineHandler()))
}

// healthHandler checks database and Redis connectivity.
func healthHandler(db *pgxpool.Pool, rdb *redis.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()

		dbOK := true
		if err := db.Ping(ctx); err != nil {
			dbOK = false
		}

		redisOK := true
		if err := rdb.Ping(ctx).Err(); err != nil {
			redisOK = false
		}

		status := "healthy"
		httpCode := fiber.StatusOK
		if !dbOK || !redisOK {
			status = "degraded"
			httpCode = fiber.StatusServiceUnavailable
		}

		return c.Status(httpCode).JSON(fiber.Map{
			"status":   status,
			"database": dbOK,
			"redis":    redisOK,
		})
	}
}

// placeholderHandler returns a handler that responds with 501 Not Implemented.
// Each route is wired so the application compiles and starts; the actual handler
// logic will be added as individual features are implemented.
func placeholderHandler(name string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
			"error":    "not implemented",
			"endpoint": name,
		})
	}
}

// wsNotificationHandler handles WebSocket connections for real-time notifications.
func wsNotificationHandler() func(*websocket.Conn) {
	return func(c *websocket.Conn) {
		defer func() { _ = c.Close() }()

		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				break
			}
			// Echo back as a placeholder; real implementation will subscribe
			// to a Redis pub/sub channel for the authenticated user.
			if err := c.WriteMessage(mt, msg); err != nil {
				break
			}
		}
	}
}

// wsPipelineHandler handles WebSocket connections for live pipeline log streaming.
func wsPipelineHandler() func(*websocket.Conn) {
	return func(c *websocket.Conn) {
		defer func() { _ = c.Close() }()

		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				break
			}
			if err := c.WriteMessage(mt, msg); err != nil {
				break
			}
		}
	}
}
