package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// WikiService defines the interface the wiki handler depends on.
type WikiService interface {
	List(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, workspaceSlug, repoSlug string, req CreateWikiPageRequest) (interface{}, error)
	Get(workspaceSlug, repoSlug, pageSlug string) (interface{}, error)
	Update(userID uuid.UUID, workspaceSlug, repoSlug, pageSlug string, req UpdateWikiPageRequest) (interface{}, error)
	Delete(userID uuid.UUID, workspaceSlug, repoSlug, pageSlug string) error
	ListRevisions(workspaceSlug, repoSlug, pageSlug string, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreateWikiPageRequest struct {
	Title   string `json:"title" validate:"required"`
	Slug    string `json:"slug" validate:"required"`
	Content string `json:"content" validate:"required"`
}

type UpdateWikiPageRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// ---------- handler ----------

type WikiHandler struct {
	service WikiService
}

func NewWikiHandler(s WikiService) *WikiHandler {
	return &WikiHandler{service: s}
}

// List GET /api/workspaces/:slug/repos/:repoSlug/wiki
func (h *WikiHandler) List(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	pages, err := h.service.List(wsSlug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(pages)
}

// Create POST /api/workspaces/:slug/repos/:repoSlug/wiki
func (h *WikiHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateWikiPageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	wikiPage, err := h.service.Create(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(wikiPage)
}

// Get GET /api/workspaces/:slug/repos/:repoSlug/wiki/:pageSlug
func (h *WikiHandler) Get(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	pageSlug := c.Params("pageSlug")

	wikiPage, err := h.service.Get(wsSlug, repoSlug, pageSlug)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(wikiPage)
}

// Update PUT /api/workspaces/:slug/repos/:repoSlug/wiki/:pageSlug
func (h *WikiHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	pageSlug := c.Params("pageSlug")

	var req UpdateWikiPageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	wikiPage, err := h.service.Update(userID, wsSlug, repoSlug, pageSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(wikiPage)
}

// Delete DELETE /api/workspaces/:slug/repos/:repoSlug/wiki/:pageSlug
func (h *WikiHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	pageSlug := c.Params("pageSlug")

	if err := h.service.Delete(userID, wsSlug, repoSlug, pageSlug); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListRevisions GET /api/workspaces/:slug/repos/:repoSlug/wiki/:pageSlug/revisions
func (h *WikiHandler) ListRevisions(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	pageSlug := c.Params("pageSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	revisions, err := h.service.ListRevisions(wsSlug, repoSlug, pageSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(revisions)
}
