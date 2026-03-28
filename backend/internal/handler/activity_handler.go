package handler

import (
	"github.com/gofiber/fiber/v2"
)

// ActivityService defines the interface the activity handler depends on.
type ActivityService interface {
	GetWorkspaceActivity(workspaceSlug string, page, limit int) (interface{}, error)
	GetRepoActivity(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)
}

// ---------- handler ----------

type ActivityHandler struct {
	service ActivityService
}

func NewActivityHandler(s ActivityService) *ActivityHandler {
	return &ActivityHandler{service: s}
}

// GetWorkspaceActivity GET /api/workspaces/:slug/activity
func (h *ActivityHandler) GetWorkspaceActivity(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace slug is required"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	activity, err := h.service.GetWorkspaceActivity(slug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(activity)
}

// GetRepoActivity GET /api/workspaces/:slug/repos/:repoSlug/activity
func (h *ActivityHandler) GetRepoActivity(c *fiber.Ctx) error {
	slug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	if slug == "" || repoSlug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace slug and repo slug are required"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	activity, err := h.service.GetRepoActivity(slug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(activity)
}
