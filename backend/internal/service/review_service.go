package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────

// ReviewStatus enumerates possible AI review states.
type ReviewStatus string

const (
	ReviewPending    ReviewStatus = "pending"
	ReviewInProgress ReviewStatus = "in_progress"
	ReviewComplete   ReviewStatus = "complete"
	ReviewFailed     ReviewStatus = "failed"
)

// AIReview represents a stored AI code review.
type AIReview struct {
	ID          uuid.UUID    `json:"id"`
	RepoID      uuid.UUID    `json:"repo_id"`
	PRNumber    int          `json:"pr_number"`
	Status      ReviewStatus `json:"status"`
	RequestedBy uuid.UUID    `json:"requested_by"`
	Comments    []AIComment  `json:"comments,omitempty"`
	Summary     string       `json:"summary,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	CompletedAt *time.Time   `json:"completed_at,omitempty"`
}

// AIComment is a single review comment produced by the AI.
type AIComment struct {
	ID         uuid.UUID `json:"id"`
	ReviewID   uuid.UUID `json:"review_id"`
	FilePath   string    `json:"file_path"`
	LineNumber int       `json:"line_number,omitempty"`
	Severity   string    `json:"severity"` // "info", "warning", "critical"
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
}

// ──────────────────────────────────────────────
// Contracts
// ──────────────────────────────────────────────

// AIReviewRepository abstracts persistence for AI reviews.
type AIReviewRepository interface {
	Create(ctx context.Context, review *AIReview) error
	GetByPR(ctx context.Context, repoID uuid.UUID, prNumber int) (*AIReview, error)
	Update(ctx context.Context, review *AIReview) error
	CreateComment(ctx context.Context, comment *AIComment) error
	ListComments(ctx context.Context, reviewID uuid.UUID) ([]AIComment, error)
}

// ClaudeClient abstracts the AI/Claude API for code reviews.
type ClaudeClient interface {
	ReviewCode(ctx context.Context, diff string, instructions string) ([]ClaudeReviewComment, string, error)
}

// ClaudeReviewComment is a single comment returned from the Claude API client.
type ClaudeReviewComment struct {
	FilePath   string `json:"file_path"`
	LineNumber int    `json:"line_number,omitempty"`
	Severity   string `json:"severity"`
	Body       string `json:"body"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// ReviewService orchestrates AI-powered code reviews.
type ReviewService struct {
	reviews AIReviewRepository
	prSvc   *PRService
	claude  ClaudeClient
	logger  *slog.Logger
}

// NewReviewService constructs a ReviewService.
func NewReviewService(
	reviews AIReviewRepository,
	prSvc *PRService,
	claude ClaudeClient,
	logger *slog.Logger,
) *ReviewService {
	return &ReviewService{
		reviews: reviews,
		prSvc:   prSvc,
		claude:  claude,
		logger:  logger.With("service", "review"),
	}
}

// RequestReview triggers an AI code review for the given pull request.
// It fetches the PR diff, sends it to Claude, and stores the resulting comments.
func (s *ReviewService) RequestReview(ctx context.Context, repoID uuid.UUID, prNumber int, userID uuid.UUID) (*AIReview, error) {
	// Check for an existing pending/in-progress review.
	existing, _ := s.reviews.GetByPR(ctx, repoID, prNumber)
	if existing != nil && (existing.Status == ReviewPending || existing.Status == ReviewInProgress) {
		return existing, nil
	}

	// Get the PR diff.
	diff, err := s.prSvc.GetDiff(ctx, repoID, prNumber)
	if err != nil {
		return nil, fmt.Errorf("review: get PR diff: %w", err)
	}

	now := time.Now().UTC()
	review := &AIReview{
		ID:          uuid.New(),
		RepoID:      repoID,
		PRNumber:    prNumber,
		Status:      ReviewInProgress,
		RequestedBy: userID,
		CreatedAt:   now,
	}

	if err := s.reviews.Create(ctx, review); err != nil {
		return nil, fmt.Errorf("review: create record: %w", err)
	}

	s.logger.Info("AI review started", "repo_id", repoID, "pr", prNumber, "review_id", review.ID)

	// Chunk the diff by file and send to Claude.
	chunks := chunkDiffByFile(diff.Diff)
	instructions := buildReviewInstructions()

	var allComments []AIComment
	var summaryParts []string

	for _, chunk := range chunks {
		claudeComments, chunkSummary, err := s.claude.ReviewCode(ctx, chunk, instructions)
		if err != nil {
			s.logger.Warn("Claude API error for chunk", "error", err)
			continue
		}

		for _, cc := range claudeComments {
			comment := AIComment{
				ID:         uuid.New(),
				ReviewID:   review.ID,
				FilePath:   cc.FilePath,
				LineNumber: cc.LineNumber,
				Severity:   cc.Severity,
				Body:       cc.Body,
				CreatedAt:  now,
			}
			if err := s.reviews.CreateComment(ctx, &comment); err != nil {
				s.logger.Warn("failed to store AI comment", "error", err)
				continue
			}
			allComments = append(allComments, comment)
		}
		if chunkSummary != "" {
			summaryParts = append(summaryParts, chunkSummary)
		}
	}

	// Mark review complete.
	completedAt := time.Now().UTC()
	review.Status = ReviewComplete
	review.CompletedAt = &completedAt
	review.Comments = allComments
	review.Summary = strings.Join(summaryParts, "\n\n")

	if err := s.reviews.Update(ctx, review); err != nil {
		s.logger.Warn("failed to update review status", "error", err)
	}

	// Optionally post AI comments as PR comments.
	for _, ac := range allComments {
		lineNum := ac.LineNumber
		prComment := &PRComment{
			AuthorID:   userID,
			Content:    fmt.Sprintf("**[AI %s]** %s", ac.Severity, ac.Body),
			FilePath:   ac.FilePath,
			LineNumber: &lineNum,
		}
		if _, err := s.prSvc.AddComment(ctx, repoID, prNumber, prComment); err != nil {
			s.logger.Warn("failed to post AI comment to PR", "error", err)
		}
	}

	s.logger.Info("AI review completed", "review_id", review.ID, "comments", len(allComments))
	return review, nil
}

// GetReviewStatus returns the latest review status for a pull request.
func (s *ReviewService) GetReviewStatus(ctx context.Context, repoID uuid.UUID, prNumber int) (*AIReview, error) {
	review, err := s.reviews.GetByPR(ctx, repoID, prNumber)
	if err != nil || review == nil {
		return nil, fmt.Errorf("review: %w: no review for PR #%d", ErrNotFound, prNumber)
	}

	comments, err := s.reviews.ListComments(ctx, review.ID)
	if err != nil {
		s.logger.Warn("failed to load review comments", "error", err)
	} else {
		review.Comments = comments
	}

	return review, nil
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// chunkDiffByFile splits a unified diff into per-file chunks.
func chunkDiffByFile(diff string) []string {
	var chunks []string
	var current strings.Builder

	for _, line := range strings.Split(diff, "\n") {
		if strings.HasPrefix(line, "diff --git") {
			if current.Len() > 0 {
				chunks = append(chunks, current.String())
				current.Reset()
			}
		}
		current.WriteString(line)
		current.WriteString("\n")
	}
	if current.Len() > 0 {
		chunks = append(chunks, current.String())
	}

	// Merge small chunks to reduce API calls (max ~4000 chars per chunk).
	const maxChunkSize = 4000
	var merged []string
	var buf strings.Builder

	for _, chunk := range chunks {
		if buf.Len()+len(chunk) > maxChunkSize && buf.Len() > 0 {
			merged = append(merged, buf.String())
			buf.Reset()
		}
		buf.WriteString(chunk)
	}
	if buf.Len() > 0 {
		merged = append(merged, buf.String())
	}

	return merged
}

// buildReviewInstructions returns the system prompt for the AI reviewer.
func buildReviewInstructions() string {
	return `You are a senior code reviewer. Analyze the following diff and provide feedback.
For each issue found, respond with:
- file_path: the file path
- line_number: the approximate line number (0 if not applicable)
- severity: one of "info", "warning", "critical"
- body: a concise description of the issue and suggested fix

Focus on:
1. Bugs and potential runtime errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practices
5. Missing error handling

Be concise and actionable. Do not comment on trivially correct code.`
}
