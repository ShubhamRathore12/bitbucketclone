package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RepoService defines the interface the repo handler depends on.
type RepoService interface {
	List(workspaceSlug string, page, limit int) (interface{}, error)
	Create(userID uuid.UUID, workspaceSlug string, req CreateRepoRequest) (interface{}, error)
	Get(workspaceSlug, repoSlug string) (interface{}, error)
	Update(workspaceSlug, repoSlug string, userID uuid.UUID, req UpdateRepoRequest) (interface{}, error)
	Delete(workspaceSlug, repoSlug string, userID uuid.UUID) error

	Fork(userID uuid.UUID, workspaceSlug, repoSlug string, req ForkRepoRequest) (interface{}, error)
	ListForks(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)

	BrowseSource(workspaceSlug, repoSlug, ref, path string) (interface{}, error)
	GetRawFile(workspaceSlug, repoSlug, ref, path string) ([]byte, string, error)

	ListCommits(workspaceSlug, repoSlug, ref string, page, limit int) (interface{}, error)
	GetCommit(workspaceSlug, repoSlug, sha string) (interface{}, error)
	GetCommitDiff(workspaceSlug, repoSlug, sha string) (string, error)

	ListBranches(workspaceSlug, repoSlug string) (interface{}, error)
	CreateBranch(workspaceSlug, repoSlug string, userID uuid.UUID, req CreateBranchRequest) (interface{}, error)
	DeleteBranch(workspaceSlug, repoSlug, branch string, userID uuid.UUID) error

	ListTags(workspaceSlug, repoSlug string) (interface{}, error)

	GetPermissions(workspaceSlug, repoSlug string) (interface{}, error)
	SetPermission(workspaceSlug, repoSlug string, userID uuid.UUID, req SetPermissionRequest) (interface{}, error)
	DeletePermission(workspaceSlug, repoSlug string, permID uuid.UUID, userID uuid.UUID) error

	ListBranchRestrictions(workspaceSlug, repoSlug string) (interface{}, error)
	CreateBranchRestriction(workspaceSlug, repoSlug string, userID uuid.UUID, req CreateBranchRestrictionRequest) (interface{}, error)
	UpdateBranchRestriction(workspaceSlug, repoSlug string, restrictionID uuid.UUID, userID uuid.UUID, req UpdateBranchRestrictionRequest) (interface{}, error)
	DeleteBranchRestriction(workspaceSlug, repoSlug string, restrictionID uuid.UUID, userID uuid.UUID) error

	GetActivity(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)
}

// ---------- request DTOs ----------

type CreateRepoRequest struct {
	Name        string `json:"name" validate:"required"`
	Slug        string `json:"slug" validate:"required"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	Language    string `json:"language"`
}

type UpdateRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   *bool  `json:"is_private,omitempty"`
	Language    string `json:"language"`
}

type ForkRepoRequest struct {
	Workspace string `json:"workspace" validate:"required"`
	Name      string `json:"name"`
}

type CreateBranchRequest struct {
	Name   string `json:"name" validate:"required"`
	Target string `json:"target" validate:"required"`
}

type SetPermissionRequest struct {
	UserID     string `json:"user_id" validate:"required"`
	Permission string `json:"permission" validate:"required,oneof=read write admin"`
}

type CreateBranchRestrictionRequest struct {
	Pattern    string   `json:"pattern" validate:"required"`
	Kind       string   `json:"kind" validate:"required"`
	Users      []string `json:"users"`
	Groups     []string `json:"groups"`
}

type UpdateBranchRestrictionRequest struct {
	Pattern string   `json:"pattern"`
	Kind    string   `json:"kind"`
	Users   []string `json:"users"`
	Groups  []string `json:"groups"`
}

// ---------- handler ----------

type RepoHandler struct {
	service RepoService
}

func NewRepoHandler(s RepoService) *RepoHandler {
	return &RepoHandler{service: s}
}

// List GET /api/workspaces/:slug/repos
func (h *RepoHandler) List(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	repos, err := h.service.List(wsSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(repos)
}

// Create POST /api/workspaces/:slug/repos
func (h *RepoHandler) Create(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")

	var req CreateRepoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	repo, err := h.service.Create(userID, wsSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(repo)
}

// Get GET /api/workspaces/:slug/repos/:repoSlug
func (h *RepoHandler) Get(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	repo, err := h.service.Get(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(repo)
}

// Update PUT /api/workspaces/:slug/repos/:repoSlug
func (h *RepoHandler) Update(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req UpdateRepoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	repo, err := h.service.Update(wsSlug, repoSlug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(repo)
}

// Delete DELETE /api/workspaces/:slug/repos/:repoSlug
func (h *RepoHandler) Delete(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	if err := h.service.Delete(wsSlug, repoSlug, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// Fork POST /api/workspaces/:slug/repos/:repoSlug/forks
func (h *RepoHandler) Fork(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req ForkRepoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	fork, err := h.service.Fork(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fork)
}

// ListForks GET /api/workspaces/:slug/repos/:repoSlug/forks
func (h *RepoHandler) ListForks(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	forks, err := h.service.ListForks(wsSlug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(forks)
}

// BrowseSource GET /api/workspaces/:slug/repos/:repoSlug/src/:ref/*
func (h *RepoHandler) BrowseSource(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	ref := c.Params("ref")
	path := c.Params("*")

	result, err := h.service.BrowseSource(wsSlug, repoSlug, ref, path)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(result)
}

// GetRawFile GET /api/workspaces/:slug/repos/:repoSlug/raw/:ref/*
func (h *RepoHandler) GetRawFile(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	ref := c.Params("ref")
	path := c.Params("*")

	data, contentType, err := h.service.GetRawFile(wsSlug, repoSlug, ref, path)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", contentType)
	return c.Status(fiber.StatusOK).Send(data)
}

// ListCommits GET /api/workspaces/:slug/repos/:repoSlug/commits
func (h *RepoHandler) ListCommits(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	ref := c.Query("ref", "main")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 30)

	commits, err := h.service.ListCommits(wsSlug, repoSlug, ref, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(commits)
}

// GetCommit GET /api/workspaces/:slug/repos/:repoSlug/commits/:sha
func (h *RepoHandler) GetCommit(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	sha := c.Params("sha")

	commit, err := h.service.GetCommit(wsSlug, repoSlug, sha)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(commit)
}

// GetCommitDiff GET /api/workspaces/:slug/repos/:repoSlug/commits/:sha/diff
func (h *RepoHandler) GetCommitDiff(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	sha := c.Params("sha")

	diff, err := h.service.GetCommitDiff(wsSlug, repoSlug, sha)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "text/plain")
	return c.Status(fiber.StatusOK).SendString(diff)
}

// ListBranches GET /api/workspaces/:slug/repos/:repoSlug/branches
func (h *RepoHandler) ListBranches(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	branches, err := h.service.ListBranches(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": branches})
}

// CreateBranch POST /api/workspaces/:slug/repos/:repoSlug/branches
func (h *RepoHandler) CreateBranch(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateBranchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	branch, err := h.service.CreateBranch(wsSlug, repoSlug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(branch)
}

// DeleteBranch DELETE /api/workspaces/:slug/repos/:repoSlug/branches/:branch
func (h *RepoHandler) DeleteBranch(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	branch := c.Params("branch")

	if err := h.service.DeleteBranch(wsSlug, repoSlug, branch, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListTags GET /api/workspaces/:slug/repos/:repoSlug/tags
func (h *RepoHandler) ListTags(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	tags, err := h.service.ListTags(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": tags})
}

// GetPermissions GET /api/workspaces/:slug/repos/:repoSlug/permissions
func (h *RepoHandler) GetPermissions(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	perms, err := h.service.GetPermissions(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": perms})
}

// SetPermission POST /api/workspaces/:slug/repos/:repoSlug/permissions
func (h *RepoHandler) SetPermission(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req SetPermissionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	perm, err := h.service.SetPermission(wsSlug, repoSlug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(perm)
}

// DeletePermission DELETE /api/workspaces/:slug/repos/:repoSlug/permissions/:permID
func (h *RepoHandler) DeletePermission(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	permID, err := uuid.Parse(c.Params("permID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid permission id"})
	}

	if err := h.service.DeletePermission(wsSlug, repoSlug, permID, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// ListBranchRestrictions GET /api/workspaces/:slug/repos/:repoSlug/branch-restrictions
func (h *RepoHandler) ListBranchRestrictions(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	restrictions, err := h.service.ListBranchRestrictions(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": restrictions})
}

// CreateBranchRestriction POST /api/workspaces/:slug/repos/:repoSlug/branch-restrictions
func (h *RepoHandler) CreateBranchRestriction(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req CreateBranchRestrictionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	restriction, err := h.service.CreateBranchRestriction(wsSlug, repoSlug, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(restriction)
}

// UpdateBranchRestriction PUT /api/workspaces/:slug/repos/:repoSlug/branch-restrictions/:restrictionID
func (h *RepoHandler) UpdateBranchRestriction(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	restrictionID, err := uuid.Parse(c.Params("restrictionID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid restriction id"})
	}

	var req UpdateBranchRestrictionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	restriction, err := h.service.UpdateBranchRestriction(wsSlug, repoSlug, restrictionID, userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(restriction)
}

// DeleteBranchRestriction DELETE /api/workspaces/:slug/repos/:repoSlug/branch-restrictions/:restrictionID
func (h *RepoHandler) DeleteBranchRestriction(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	restrictionID, err := uuid.Parse(c.Params("restrictionID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid restriction id"})
	}

	if err := h.service.DeleteBranchRestriction(wsSlug, repoSlug, restrictionID, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// GetActivity GET /api/workspaces/:slug/repos/:repoSlug/activity
func (h *RepoHandler) GetActivity(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	activity, err := h.service.GetActivity(wsSlug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(activity)
}
