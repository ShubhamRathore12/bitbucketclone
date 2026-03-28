package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// WebhookService defines the interface the webhook handler depends on.
type WebhookService interface {
	List(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, workspaceSlug, repoSlug string, req CreateWebhookRequest) (interface{}, error)
	Update(userID uuid.UUID, workspaceSlug, repoSlug string, webhookID uuid.UUID, req UpdateWebhookRequest) (interface{}, error)
	Delete(userID uuid.UUID, workspaceSlug, repoSlug string, webhookID uuid.UUID) error
	ListDeliveries(workspaceSlug, repoSlug string, webhookID uuid.UUID, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreateWebhookRequest struct {
	URL         string   `json:"url" validate:"required,url"`
	Description string   `json:"description"`
	Events      []string `json:"events" validate:"required,min=1"`
	Active      bool     `json:"active"`
	Secret      string   `json:"secret,omitempty"`
}

type UpdateWebhookRequest struct {
	URL         string   `json:"url"`
	Description string   `json:"description"`
	Events      []string `json:"events"`
	Active      *bool    `json:"active,omitempty"`
	Secret      string   `json:"secret,omitempty"`
}

// ---------- handler ----------

type WebhookHandler struct {
	service WebhookService
}

func NewWebhookHandler(s WebhookService) *WebhookHandler {
	return &WebhookHandler{service: s}
}

// List GET /api/workspaces/:slug/repos/:repoSlug/webhooks
func (h *WebhookHandler) List(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	webhooks, err := h.service.List(wsSlug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(webhooks)
}

// Create POST /api/workspaces/:slug/repos/:repoSlug/webhooks
func (h *WebhookHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	webhook, err := h.service.Create(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(webhook)
}

// Update PUT /api/workspaces/:slug/repos/:repoSlug/webhooks/:webhookID
func (h *WebhookHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	webhookID, err := uuid.Parse(c.Params("webhookID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid webhook id"})
	}

	var req UpdateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	webhook, err := h.service.Update(userID, wsSlug, repoSlug, webhookID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(webhook)
}

// Delete DELETE /api/workspaces/:slug/repos/:repoSlug/webhooks/:webhookID
func (h *WebhookHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	webhookID, err := uuid.Parse(c.Params("webhookID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid webhook id"})
	}

	if err := h.service.Delete(userID, wsSlug, repoSlug, webhookID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListDeliveries GET /api/workspaces/:slug/repos/:repoSlug/webhooks/:webhookID/deliveries
func (h *WebhookHandler) ListDeliveries(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	webhookID, err := uuid.Parse(c.Params("webhookID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid webhook id"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	deliveries, err := h.service.ListDeliveries(wsSlug, repoSlug, webhookID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(deliveries)
}
