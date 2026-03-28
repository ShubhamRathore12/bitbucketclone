package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ReviewService defines the interface the review handler depends on.
type ReviewService interface {
	RequestAIReview(userID uuid.UUID, workspaceSlug, repoSlug string, prID int, req AIReviewRequest) (interface{}, error)
	GetAIReviewStatus(workspaceSlug, repoSlug string, prID int, reviewID uuid.UUID) (interface{}, error)
}

// ---------- request DTOs ----------

type AIReviewRequest struct {
	Focus       string   `json:"focus,omitempty"`   // e.g. "security", "performance", "general"
	IgnorePaths []string `json:"ignore_paths,omitempty"`
}

// ---------- handler ----------

type ReviewHandler struct {
	service ReviewService
}

func NewReviewHandler(s ReviewService) *ReviewHandler {
	return &ReviewHandler{service: s}
}

// RequestAIReview POST /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/ai-review
func (h *ReviewHandler) RequestAIReview(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	raw := c.Params("prID")
	prID := 0
	for _, ch := range raw {
		if ch < '0' || ch > '9' {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid pull request id"})
		}
		prID = prID*10 + int(ch-'0')
	}

	var req AIReviewRequest
	if err := c.BodyParser(&req); err != nil {
		// Body is optional for AI review; use defaults
		req = AIReviewRequest{}
	}

	review, err := h.service.RequestAIReview(userID, wsSlug, repoSlug, prID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusAccepted).JSON(review)
}

// GetAIReviewStatus GET /api/workspaces/:slug/repos/:repoSlug/pull-requests/:prID/ai-review/:reviewID
func (h *ReviewHandler) GetAIReviewStatus(c *fiber.Ctx) error {
	wsSlug := c.Params("slug")
	repoSlug := c.Params("repoSlug")

	raw := c.Params("prID")
	prID := 0
	for _, ch := range raw {
		if ch < '0' || ch > '9' {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid pull request id"})
		}
		prID = prID*10 + int(ch-'0')
	}

	reviewID, err := uuid.Parse(c.Params("reviewID"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid review id"})
	}

	status, err := h.service.GetAIReviewStatus(wsSlug, repoSlug, prID, reviewID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(status)
}
