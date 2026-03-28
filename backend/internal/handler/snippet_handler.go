package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// SnippetService defines the interface the snippet handler depends on.
type SnippetService interface {
	List(userID uuid.UUID, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, req CreateSnippetRequest) (interface{}, error)
	Get(snippetID uuid.UUID) (interface{}, error)
	Update(userID uuid.UUID, snippetID uuid.UUID, req UpdateSnippetRequest) (interface{}, error)
	Delete(userID uuid.UUID, snippetID uuid.UUID) error
	ListWorkspaceSnippets(workspaceSlug string, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreateSnippetRequest struct {
	Title     string          `json:"title" validate:"required"`
	IsPrivate bool            `json:"is_private"`
	Workspace string          `json:"workspace,omitempty"`
	Files     []SnippetFileRequest `json:"files" validate:"required,min=1"`
}

type UpdateSnippetRequest struct {
	Title     string          `json:"title"`
	IsPrivate *bool           `json:"is_private,omitempty"`
	Files     []SnippetFileRequest `json:"files,omitempty"`
}

type SnippetFileRequest struct {
	Filename string `json:"filename" validate:"required"`
	Content  string `json:"content" validate:"required"`
}

// ---------- handler ----------

type SnippetHandler struct {
	service SnippetService
}

func NewSnippetHandler(s SnippetService) *SnippetHandler {
	return &SnippetHandler{service: s}
}

// List GET /api/snippets
func (h *SnippetHandler) List(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	snippets, err := h.service.List(userID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(snippets)
}

// Create POST /api/snippets
func (h *SnippetHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req CreateSnippetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	snippet, err := h.service.Create(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(snippet)
}

// Get GET /api/snippets/:snippetID
func (h *SnippetHandler) Get(c *fiber.Ctx) error {
	snippetID, err := uuid.Parse(c.Params("snippetID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid snippet id"})
	}

	snippet, err := h.service.Get(snippetID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(snippet)
}

// Update PUT /api/snippets/:snippetID
func (h *SnippetHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	snippetID, err := uuid.Parse(c.Params("snippetID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid snippet id"})
	}

	var req UpdateSnippetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	snippet, err := h.service.Update(userID, snippetID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(snippet)
}

// Delete DELETE /api/snippets/:snippetID
func (h *SnippetHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	snippetID, err := uuid.Parse(c.Params("snippetID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid snippet id"})
	}

	if err := h.service.Delete(userID, snippetID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListWorkspaceSnippets GET /api/workspaces/:slug/snippets
func (h *SnippetHandler) ListWorkspaceSnippets(c *fiber.Ctx) error {
	slug := c.Params("slug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	snippets, err := h.service.ListWorkspaceSnippets(slug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(snippets)
}
