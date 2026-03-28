package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// IssueService defines the interface the issue handler depends on.
type IssueService interface {
	List(workspaceSlug, repoSlug, status, priority, assignee string, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, workspaceSlug, repoSlug string, req CreateIssueRequest) (interface{}, error)
	Get(workspaceSlug, repoSlug string, issueID int) (interface{}, error)
	Update(userID uuid.UUID, workspaceSlug, repoSlug string, issueID int, req UpdateIssueRequest) (interface{}, error)
	Delete(userID uuid.UUID, workspaceSlug, repoSlug string, issueID int) error

	ListComments(workspaceSlug, repoSlug string, issueID int, page, limit int) (interface{}, error)
	CreateComment(userID uuid.UUID, workspaceSlug, repoSlug string, issueID int, req CreateIssueCommentRequest) (interface{}, error)
	UpdateComment(userID uuid.UUID, workspaceSlug, repoSlug string, issueID int, commentID uuid.UUID, req UpdateIssueCommentRequest) (interface{}, error)
	DeleteComment(userID uuid.UUID, workspaceSlug, repoSlug string, issueID int, commentID uuid.UUID) error

	ListLabels(workspaceSlug, repoSlug string) (interface{}, error)
	CreateLabel(userID uuid.UUID, workspaceSlug, repoSlug string, req CreateLabelRequest) (interface{}, error)
	UpdateLabel(userID uuid.UUID, workspaceSlug, repoSlug string, labelID uuid.UUID, req UpdateLabelRequest) (interface{}, error)
	DeleteLabel(userID uuid.UUID, workspaceSlug, repoSlug string, labelID uuid.UUID) error
}

// ---------- request DTOs ----------

type CreateIssueRequest struct {
	Title    string   `json:"title" validate:"required"`
	Content  string   `json:"content"`
	Priority string   `json:"priority" validate:"required,oneof=trivial minor major critical blocker"`
	Kind     string   `json:"kind" validate:"required,oneof=bug enhancement proposal task"`
	Assignee string   `json:"assignee,omitempty"`
	Labels   []string `json:"labels,omitempty"`
}

type UpdateIssueRequest struct {
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Status   string   `json:"status"`
	Priority string   `json:"priority"`
	Kind     string   `json:"kind"`
	Assignee string   `json:"assignee"`
	Labels   []string `json:"labels"`
}

type CreateIssueCommentRequest struct {
	Content string `json:"content" validate:"required"`
}

type UpdateIssueCommentRequest struct {
	Content string `json:"content" validate:"required"`
}

type CreateLabelRequest struct {
	Name  string `json:"name" validate:"required"`
	Color string `json:"color" validate:"required"`
}

type UpdateLabelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// ---------- handler ----------

type IssueHandler struct {
	service IssueService
}

func NewIssueHandler(s IssueService) *IssueHandler {
	return &IssueHandler{service: s}
}

func parseIssueID(c *fiber.Ctx) (int, error) {
	raw := c.Params("issueID")
	if raw == "" {
		return 0, fiber.NewError(fiber.StatusBadRequest, "issue id is required")
	}
	id := 0
	for _, ch := range raw {
		if ch < '0' || ch > '9' {
			return 0, fiber.NewError(fiber.StatusBadRequest, "invalid issue id")
		}
		id = id*10 + int(ch-'0')
	}
	return id, nil
}

// List GET /api/workspaces/:slug/repos/:repoSlug/issues
func (h *IssueHandler) List(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	status := c.Query("status", "")
	priority := c.Query("priority", "")
	assignee := c.Query("assignee", "")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	issues, err := h.service.List(wsSlug, repoSlug, status, priority, assignee, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(issues)
}

// Create POST /api/workspaces/:slug/repos/:repoSlug/issues
func (h *IssueHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	issue, err := h.service.Create(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(issue)
}

// Get GET /api/workspaces/:slug/repos/:repoSlug/issues/:issueID
func (h *IssueHandler) Get(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	issue, err := h.service.Get(wsSlug, repoSlug, issueID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(issue)
}

// Update PUT /api/workspaces/:slug/repos/:repoSlug/issues/:issueID
func (h *IssueHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var req UpdateIssueRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	issue, err := h.service.Update(userID, wsSlug, repoSlug, issueID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(issue)
}

// Delete DELETE /api/workspaces/:slug/repos/:repoSlug/issues/:issueID
func (h *IssueHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if err := h.service.Delete(userID, wsSlug, repoSlug, issueID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListComments GET /api/workspaces/:slug/repos/:repoSlug/issues/:issueID/comments
func (h *IssueHandler) ListComments(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 50)

	comments, err := h.service.ListComments(wsSlug, repoSlug, issueID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(comments)
}

// CreateComment POST /api/workspaces/:slug/repos/:repoSlug/issues/:issueID/comments
func (h *IssueHandler) CreateComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var req CreateIssueCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	comment, err := h.service.CreateComment(userID, wsSlug, repoSlug, issueID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(comment)
}

// UpdateComment PUT /api/workspaces/:slug/repos/:repoSlug/issues/:issueID/comments/:commentID
func (h *IssueHandler) UpdateComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	commentID, err := uuid.Parse(c.Params("commentID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid comment id"})
	}

	var req UpdateIssueCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	comment, err := h.service.UpdateComment(userID, wsSlug, repoSlug, issueID, commentID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(comment)
}

// DeleteComment DELETE /api/workspaces/:slug/repos/:repoSlug/issues/:issueID/comments/:commentID
func (h *IssueHandler) DeleteComment(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	issueID, err := parseIssueID(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	commentID, err := uuid.Parse(c.Params("commentID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid comment id"})
	}

	if err := h.service.DeleteComment(userID, wsSlug, repoSlug, issueID, commentID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListLabels GET /api/workspaces/:slug/repos/:repoSlug/labels
func (h *IssueHandler) ListLabels(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	labels, err := h.service.ListLabels(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": labels})
}

// CreateLabel POST /api/workspaces/:slug/repos/:repoSlug/labels
func (h *IssueHandler) CreateLabel(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateLabelRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	label, err := h.service.CreateLabel(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(label)
}

// UpdateLabel PUT /api/workspaces/:slug/repos/:repoSlug/labels/:labelID
func (h *IssueHandler) UpdateLabel(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	labelID, err := uuid.Parse(c.Params("labelID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid label id"})
	}

	var req UpdateLabelRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	label, err := h.service.UpdateLabel(userID, wsSlug, repoSlug, labelID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(label)
}

// DeleteLabel DELETE /api/workspaces/:slug/repos/:repoSlug/labels/:labelID
func (h *IssueHandler) DeleteLabel(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	labelID, err := uuid.Parse(c.Params("labelID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid label id"})
	}

	if err := h.service.DeleteLabel(userID, wsSlug, repoSlug, labelID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}
