package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// WorkspaceService defines the interface the workspace handler depends on.
type WorkspaceService interface {
	List(userID uuid.UUID, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, req CreateWorkspaceRequest) (interface{}, error)
	GetBySlug(slug string) (interface{}, error)
	Update(slug string, userID uuid.UUID, req UpdateWorkspaceRequest) (interface{}, error)
	Delete(slug string, userID uuid.UUID) error

	ListMembers(slug string, page, limit int) (interface{}, error)
	AddMember(slug string, userID uuid.UUID, req AddWorkspaceMemberRequest) (interface{}, error)
	UpdateMember(slug string, memberID uuid.UUID, userID uuid.UUID, req UpdateWorkspaceMemberRequest) (interface{}, error)
	RemoveMember(slug string, memberID uuid.UUID, userID uuid.UUID) error

	ListGroups(slug string, page, limit int) (interface{}, error)
	CreateGroup(slug string, userID uuid.UUID, req CreateGroupRequest) (interface{}, error)

	GetActivity(slug string, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreateWorkspaceRequest struct {
	Name        string `json:"name" validate:"required"`
	Slug        string `json:"slug" validate:"required"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
}

type UpdateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   *bool  `json:"is_private,omitempty"`
}

type AddWorkspaceMemberRequest struct {
	Username string `json:"username" validate:"required"`
	Role     string `json:"role" validate:"required,oneof=admin member"`
}

type UpdateWorkspaceMemberRequest struct {
	Role string `json:"role" validate:"required,oneof=admin member"`
}

type CreateGroupRequest struct {
	Name        string `json:"name" validate:"required"`
	Slug        string `json:"slug" validate:"required"`
	Description string `json:"description"`
}

// ---------- handler ----------

type WorkspaceHandler struct {
	service WorkspaceService
}

func NewWorkspaceHandler(s WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{service: s}
}

// List GET /api/workspaces
func (h *WorkspaceHandler) List(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	result, err := h.service.List(userID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

// Create POST /api/workspaces
func (h *WorkspaceHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req CreateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	ws, err := h.service.Create(userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(ws)
}

// Get GET /api/workspaces/:slug
func (h *WorkspaceHandler) Get(c *fiber.Ctx) error {
	slug := c.Params("slug")
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace slug is required"})
	}

	ws, err := h.service.GetBySlug(slug)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(ws)
}

// Update PUT /api/workspaces/:slug
func (h *WorkspaceHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace slug is required"})
	}

	var req UpdateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	ws, err := h.service.Update(slug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(ws)
}

// Delete DELETE /api/workspaces/:slug
func (h *WorkspaceHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")
	if slug == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "workspace slug is required"})
	}

	if err := h.service.Delete(slug, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListMembers GET /api/workspaces/:slug/members
func (h *WorkspaceHandler) ListMembers(c *fiber.Ctx) error {
	slug := c.Params("slug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	members, err := h.service.ListMembers(slug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(members)
}

// AddMember POST /api/workspaces/:slug/members
func (h *WorkspaceHandler) AddMember(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")

	var req AddWorkspaceMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	member, err := h.service.AddMember(slug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(member)
}

// UpdateMember PUT /api/workspaces/:slug/members/:memberID
func (h *WorkspaceHandler) UpdateMember(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")

	memberID, err := uuid.Parse(c.Params("memberID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid member id"})
	}

	var req UpdateWorkspaceMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	member, err := h.service.UpdateMember(slug, memberID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(member)
}

// RemoveMember DELETE /api/workspaces/:slug/members/:memberID
func (h *WorkspaceHandler) RemoveMember(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")

	memberID, err := uuid.Parse(c.Params("memberID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid member id"})
	}

	if err := h.service.RemoveMember(slug, memberID, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListGroups GET /api/workspaces/:slug/groups
func (h *WorkspaceHandler) ListGroups(c *fiber.Ctx) error {
	slug := c.Params("slug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	groups, err := h.service.ListGroups(slug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(groups)
}

// CreateGroup POST /api/workspaces/:slug/groups
func (h *WorkspaceHandler) CreateGroup(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	slug := c.Params("slug")

	var req CreateGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	group, err := h.service.CreateGroup(slug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(group)
}

// GetActivity GET /api/workspaces/:slug/activity
func (h *WorkspaceHandler) GetActivity(c *fiber.Ctx) error {
	slug := c.Params("slug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	activity, err := h.service.GetActivity(slug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(activity)
}
