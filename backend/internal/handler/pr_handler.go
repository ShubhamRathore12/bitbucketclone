package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// PRService defines the interface the pull request handler depends on.
type PRService interface {
	List(workspaceSlug, repoSlug, state string, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, workspaceSlug, repoSlug string, req CreatePRRequest) (interface{}, error)
	Get(workspaceSlug, repoSlug string, prID int) (interface{}, error)
	Update(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, req UpdatePRRequest) (interface{}, error)

	Merge(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, req MergePRRequest) (interface{}, error)
	Decline(userID uuid.UUID, workspaceSlug, repoSlug string, prID int) error
	Approve(userID uuid.UUID, workspaceSlug, repoSlug string, prID int) error
	Unapprove(userID uuid.UUID, workspaceSlug, repoSlug string, prID int) error

	GetDiff(workspaceSlug, repoSlug string, prID int) (string, error)

	ListComments(workspaceSlug, repoSlug string, prID int, page, limit int) (interface{}, error)
	CreateComment(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, req CreatePRCommentRequest) (interface{}, error)
	UpdateComment(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, commentID uuid.UUID, req UpdatePRCommentRequest) (interface{}, error)
	DeleteComment(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, commentID uuid.UUID) error
	ResolveComment(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, commentID uuid.UUID) (interface{}, error)

	GetActivity(workspaceSlug, repoSlug string, prID int, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreatePRRequest struct {
	Title       string   `json:"title" validate:"required"`
	Description string   `json:"description"`
	Source      string   `json:"source_branch" validate:"required"`
	Destination string   `json:"destination_branch" validate:"required"`
	Reviewers   []string `json:"reviewers"`
	CloseSource bool     `json:"close_source_branch"`
}

type UpdatePRRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Reviewers   []string `json:"reviewers"`
	CloseSource *bool    `json:"close_source_branch,omitempty"`
}

type MergePRRequest struct {
	Strategy       string `json:"merge_strategy"` // merge, squash, fast-forward
	Message        string `json:"message"`
	CloseSource    *bool  `json:"close_source_branch,omitempty"`
}

type CreatePRCommentRequest struct {
	Content  string  `json:"content" validate:"required"`
	ParentID *string `json:"parent_id,omitempty"`
	// Inline comment fields
	Path    string `json:"path,omitempty"`
	Line    int    `json:"line,omitempty"`
	Side    string `json:"side,omitempty"` // "old" or "new"
}

type UpdatePRCommentRequest struct {
	Content string `json:"content" validate:"required"`
}

// ---------- handler ----------

type PRHandler struct {
	service PRService
}

func NewPRHandler(s PRService) *PRHandler {
	return &PRHandler{service: s}
}

func (h *PRHandler) prID(c *fiber.Ctx) (int, error) {
	id := c.QueryInt("prID", 0)
	if id == 0 {
		id = queryInt(c, "prID", 0)
	}
	// Try path param
	raw := c.Params("prID")
	if raw != "" {
		var parsed int
		for _, ch := range raw {
			if ch < '0' || ch > '9' {
				return 0, fiber.NewError(fiber.StatusBadRequest, "invalid pull request id")
			}
			parsed = parsed*10 + int(ch-'0')
		}
		return parsed, nil
	}
	if id == 0 {
		return 0, fiber.NewError(fiber.StatusBadRequest, "pull request id is required")
	}
	return id, nil
}

// List GET /api/workspaces/:slug/repos/:repoSlug/pull-requests
func (h *PRHandler) List(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	state := c.Query("state", "open")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	prs, err := h.service.List(wsSlug, repoSlug, state, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(prs)
}

// Create POST /api/workspaces/:slug/repos/:repoSlug/pull-requests
func (h *PRHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreatePRRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	pr, err := h.service.Create(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(pr)
}

// Get GET /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID
func (h *PRHandler) Get(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	pr, err := h.service.Get(wsSlug, repoSlug, prID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(pr)
}

// Update PUT /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID
func (h *PRHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var req UpdatePRRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	pr, err := h.service.Update(userID, wsSlug, repoSlug, prID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(pr)
}

// Merge POST /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/merge
func (h *PRHandler) Merge(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var req MergePRRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	result, err := h.service.Merge(userID, wsSlug, repoSlug, prID, req)
	if err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

// Decline POST /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/decline
func (h *PRHandler) Decline(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.service.Decline(userID, wsSlug, repoSlug, prID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "pull request declined"})
}

// Approve POST /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/approve
func (h *PRHandler) Approve(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.service.Approve(userID, wsSlug, repoSlug, prID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "pull request approved"})
}

// Unapprove DELETE /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/approve
func (h *PRHandler) Unapprove(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.service.Unapprove(userID, wsSlug, repoSlug, prID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "approval removed"})
}

// GetDiff GET /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/diff
func (h *PRHandler) GetDiff(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	diff, err := h.service.GetDiff(wsSlug, repoSlug, prID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "text/plain")
	return c.Status(fiber.StatusOK).SendString(diff)
}

// ListComments GET /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/comments
func (h *PRHandler) ListComments(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 50)

	comments, err := h.service.ListComments(wsSlug, repoSlug, prID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(comments)
}

// CreateComment POST /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/comments
func (h *PRHandler) CreateComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var req CreatePRCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	comment, err := h.service.CreateComment(userID, wsSlug, repoSlug, prID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(comment)
}

// UpdateComment PUT /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/comments/:commentID
func (h *PRHandler) UpdateComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	commentID, err := uuid.Parse(c.Params("commentID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid comment id"})
	}

	var req UpdatePRCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	comment, err := h.service.UpdateComment(userID, wsSlug, repoSlug, prID, commentID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(comment)
}

// DeleteComment DELETE /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/comments/:commentID
func (h *PRHandler) DeleteComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	commentID, err := uuid.Parse(c.Params("commentID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid comment id"})
	}

	if err := h.service.DeleteComment(userID, wsSlug, repoSlug, prID, commentID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ResolveComment PUT /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/comments/:commentID/resolve
func (h *PRHandler) ResolveComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	commentID, err := uuid.Parse(c.Params("commentID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid comment id"})
	}

	comment, err := h.service.ResolveComment(userID, wsSlug, repoSlug, prID, commentID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(comment)
}

// GetActivity GET /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/activity
func (h *PRHandler) GetActivity(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	prID, err := h.prID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	activity, err := h.service.GetActivity(wsSlug, repoSlug, prID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(activity)
}
