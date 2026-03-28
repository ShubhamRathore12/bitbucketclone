package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// UserService defines the interface the user handler depends on.
type UserService interface {
	GetByID(id uuid.UUID) (interface{}, error)
	UpdateProfile(id uuid.UUID, req UpdateProfileRequest) (interface{}, error)
	GetPublicProfile(username string) (interface{}, error)
	ListSSHKeys(userID uuid.UUID) ([]interface{}, error)
	CreateSSHKey(userID uuid.UUID, req CreateSSHKeyRequest) (interface{}, error)
	DeleteSSHKey(userID uuid.UUID, keyID uuid.UUID) error
}

// ---------- request DTOs ----------

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type CreateSSHKeyRequest struct {
	Label     string `json:"label" validate:"required"`
	PublicKey string `json:"public_key" validate:"required"`
}

// ---------- handler ----------

type UserHandler struct {
	service UserService
}

func NewUserHandler(s UserService) *UserHandler {
	return &UserHandler{service: s}
}

// GetCurrentUser GET /api/user
func (h *UserHandler) GetCurrentUser(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	user, err := h.service.GetByID(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(user)
}

// UpdateProfile PUT /api/user
func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	user, err := h.service.UpdateProfile(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(user)
}

// GetPublicProfile GET /api/users/:username
func (h *UserHandler) GetPublicProfile(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "username is required"})
	}

	profile, err := h.service.GetPublicProfile(username)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(profile)
}

// ListSSHKeys GET /api/user/ssh-keys
func (h *UserHandler) ListSSHKeys(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	keys, err := h.service.ListSSHKeys(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": keys})
}

// CreateSSHKey POST /api/user/ssh-keys
func (h *UserHandler) CreateSSHKey(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req CreateSSHKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	key, err := h.service.CreateSSHKey(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(key)
}

// DeleteSSHKey DELETE /api/user/ssh-keys/:keyID
func (h *UserHandler) DeleteSSHKey(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	keyID, err := uuid.Parse(c.Params("keyID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid key id"})
	}

	if err := h.service.DeleteSSHKey(userID, keyID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}
