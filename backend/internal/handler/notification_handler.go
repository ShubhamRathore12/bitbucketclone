package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// NotificationService defines the interface the notification handler depends on.
type NotificationService interface {
	List(userID uuid.UUID, page, limit int) (interface{}, error)
	MarkRead(userID uuid.UUID, notificationID uuid.UUID) error
	MarkAllRead(userID uuid.UUID) error
}

// ---------- handler ----------

type NotificationHandler struct {
	service NotificationService
}

func NewNotificationHandler(s NotificationService) *NotificationHandler {
	return &NotificationHandler{service: s}
}

// List GET /api/notifications
func (h *NotificationHandler) List(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	notifications, err := h.service.List(userID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(notifications)
}

// MarkRead PUT /api/notifications/:id/read
func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	notifID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid notification id"})
	}

	if err := h.service.MarkRead(userID, notifID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "notification marked as read"})
}

// MarkAllRead POST /api/notifications/read-all
func (h *NotificationHandler) MarkAllRead(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	if err := h.service.MarkAllRead(userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "all notifications marked as read"})
}
