package handler

import (
	"github.com/gofiber/fiber/v2"
)

// SearchService defines the interface the search handler depends on.
type SearchService interface {
	SearchCode(query, workspace, repo, lang string, page, limit int) (interface{}, error)
	SearchRepos(query string, page, limit int) (interface{}, error)
	SearchUsers(query string, page, limit int) (interface{}, error)
}

// ---------- handler ----------

type SearchHandler struct {
	service SearchService
}

func NewSearchHandler(s SearchService) *SearchHandler {
	return &SearchHandler{service: s}
}

// SearchCode GET /api/search/code
func (h *SearchHandler) SearchCode(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "query parameter 'q' is required"})
	}

	workspace := c.Query("workspace", "")
	repo := c.Query("repo", "")
	lang := c.Query("lang", "")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	results, err := h.service.SearchCode(q, workspace, repo, lang, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(results)
}

// SearchRepos GET /api/search/repos
func (h *SearchHandler) SearchRepos(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "query parameter 'q' is required"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	results, err := h.service.SearchRepos(q, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(results)
}

// SearchUsers GET /api/search/users
func (h *SearchHandler) SearchUsers(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "query parameter 'q' is required"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	results, err := h.service.SearchUsers(q, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(results)
}
