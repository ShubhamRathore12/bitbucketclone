package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// PipelineService defines the interface the pipeline handler depends on.
type PipelineService interface {
	ListRuns(workspaceSlug, repoSlug string, page, limit int) (interface{}, error)
	TriggerRun(userID uuid.UUID, workspaceSlug, repoSlug string, req TriggerPipelineRequest) (interface{}, error)
	GetRun(workspaceSlug, repoSlug string, runID uuid.UUID) (interface{}, error)
	StopRun(userID uuid.UUID, workspaceSlug, repoSlug string, runID uuid.UUID) error

	ListSteps(workspaceSlug, repoSlug string, runID uuid.UUID) (interface{}, error)
	GetStepLog(workspaceSlug, repoSlug string, runID uuid.UUID, stepID uuid.UUID) (string, error)

	GetConfig(workspaceSlug, repoSlug string) (interface{}, error)
	UpdateConfig(userID uuid.UUID, workspaceSlug, repoSlug string, req UpdatePipelineConfigRequest) (interface{}, error)
}

// ---------- request DTOs ----------

type TriggerPipelineRequest struct {
	Branch    string            `json:"branch" validate:"required"`
	Variables map[string]string `json:"variables,omitempty"`
}

type UpdatePipelineConfigRequest struct {
	Enabled bool   `json:"enabled"`
	YAML    string `json:"yaml" validate:"required"`
}

// ---------- handler ----------

type PipelineHandler struct {
	service PipelineService
}

func NewPipelineHandler(s PipelineService) *PipelineHandler {
	return &PipelineHandler{service: s}
}

// ListRuns GET /api/workspaces/:slug/repos/:repoSlug/pipelines
func (h *PipelineHandler) ListRuns(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")
	page := queryInt(c, "page", 1)
	limit := queryInt(c, "limit", 25)

	runs, err := h.service.ListRuns(wsSlug, repoSlug, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(runs)
}

// TriggerRun POST /api/workspaces/:slug/repos/:repoSlug/pipelines
func (h *PipelineHandler) TriggerRun(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req TriggerPipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	run, err := h.service.TriggerRun(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(run)
}

// GetRun GET /api/workspaces/:slug/repos/:repoSlug/pipelines/:runID
func (h *PipelineHandler) GetRun(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	runID, err := uuid.Parse(c.Params("runID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid run id"})
	}

	run, err := h.service.GetRun(wsSlug, repoSlug, runID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(run)
}

// StopRun POST /api/workspaces/:slug/repos/:repoSlug/pipelines/:runID/stop
func (h *PipelineHandler) StopRun(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	runID, err := uuid.Parse(c.Params("runID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid run id"})
	}

	if err := h.service.StopRun(userID, wsSlug, repoSlug, runID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "pipeline run stopped"})
}

// ListSteps GET /api/workspaces/:slug/repos/:repoSlug/pipelines/:runID/steps
func (h *PipelineHandler) ListSteps(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	runID, err := uuid.Parse(c.Params("runID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid run id"})
	}

	steps, err := h.service.ListSteps(wsSlug, repoSlug, runID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"values": steps})
}

// GetStepLog GET /api/workspaces/:slug/repos/:repoSlug/pipelines/:runID/steps/:stepID/log
func (h *PipelineHandler) GetStepLog(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	runID, err := uuid.Parse(c.Params("runID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid run id"})
	}

	stepID, err := uuid.Parse(c.Params("stepID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid step id"})
	}

	log, err := h.service.GetStepLog(wsSlug, repoSlug, runID, stepID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	c.Set("Content-Type", "text/plain")
	return c.Status(fiber.StatusOK).SendString(log)
}

// GetConfig GET /api/workspaces/:slug/repos/:repoSlug/pipelines/config
func (h *PipelineHandler) GetConfig(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	cfg, err := h.service.GetConfig(wsSlug, repoSlug)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(cfg)
}

// UpdateConfig PUT /api/workspaces/:slug/repos/:repoSlug/pipelines/config
func (h *PipelineHandler) UpdateConfig(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	var req UpdatePipelineConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	cfg, err := h.service.UpdateConfig(userID, wsSlug, repoSlug, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(cfg)
}
