package service

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/google/uuid"

	"github.com/gitforge/backend/internal/models"
)

// ──────────────────────────────────────────────
// Models (PR-specific, not yet in models/)
// ──────────────────────────────────────────────

// PullRequestState enumerates pull request states.
type PullRequestState string

const (
	PRStateOpen     PullRequestState = "open"
	PRStateMerged   PullRequestState = "merged"
	PRStateDeclined PullRequestState = "declined"
)

// MergeStrategy enumerates allowed merge strategies.
type MergeStrategy string

const (
	MergeCommit  MergeStrategy = "merge-commit"
	Squash       MergeStrategy = "squash"
	FastForward  MergeStrategy = "fast-forward"
)

// PullRequest represents a pull request.
type PullRequest struct {
	ID           uuid.UUID        `json:"id"`
	RepoID       uuid.UUID        `json:"repo_id"`
	Number       int              `json:"number"`
	Title        string           `json:"title"`
	Description  string           `json:"description,omitempty"`
	State        PullRequestState `json:"state"`
	SourceBranch string           `json:"source_branch"`
	DestBranch   string           `json:"dest_branch"`
	AuthorID     uuid.UUID        `json:"author_id"`
	MergedBy     *uuid.UUID       `json:"merged_by,omitempty"`
	MergeCommit  *string          `json:"merge_commit,omitempty"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
	ClosedAt     *time.Time       `json:"closed_at,omitempty"`
}

// PRApproval tracks a user's approval on a pull request.
type PRApproval struct {
	ID        uuid.UUID `json:"id"`
	PRID      uuid.UUID `json:"pr_id"`
	UserID    uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// PRComment is a comment on a pull request.
type PRComment struct {
	ID         uuid.UUID  `json:"id"`
	PRID       uuid.UUID  `json:"pr_id"`
	AuthorID   uuid.UUID  `json:"author_id"`
	Content    string     `json:"content"`
	FilePath   string     `json:"file_path,omitempty"`
	LineNumber *int       `json:"line_number,omitempty"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	IsResolved bool       `json:"is_resolved"`
	ResolvedBy *uuid.UUID `json:"resolved_by,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// PRRepository abstracts persistence for pull requests.
type PRRepository interface {
	Create(ctx context.Context, pr *PullRequest) error
	GetByNumber(ctx context.Context, repoID uuid.UUID, number int) (*PullRequest, error)
	Update(ctx context.Context, pr *PullRequest) error
	List(ctx context.Context, repoID uuid.UUID, state *PullRequestState, authorID *uuid.UUID, page, limit int) ([]*PullRequest, int, error)
	NextNumber(ctx context.Context, repoID uuid.UUID) (int, error)

	CreateApproval(ctx context.Context, approval *PRApproval) error
	DeleteApproval(ctx context.Context, prID, userID uuid.UUID) error
	ListApprovals(ctx context.Context, prID uuid.UUID) ([]*PRApproval, error)
	CountApprovals(ctx context.Context, prID uuid.UUID) (int, error)

	CreateComment(ctx context.Context, comment *PRComment) error
	GetComment(ctx context.Context, id uuid.UUID) (*PRComment, error)
	UpdateComment(ctx context.Context, comment *PRComment) error
	ListComments(ctx context.Context, prID uuid.UUID) ([]*PRComment, error)
}

// BranchRestrictionRepository abstracts persistence for branch restrictions.
type BranchRestrictionRepository interface {
	ListByRepo(ctx context.Context, repoID uuid.UUID) ([]*models.BranchRestriction, error)
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// PRCreateInput carries parameters for creating a pull request.
type PRCreateInput struct {
	RepoID       uuid.UUID
	Title        string
	Description  string
	SourceBranch string
	DestBranch   string
	AuthorID     uuid.UUID
}

// PRUpdateInput carries mutable fields.
type PRUpdateInput struct {
	Title       *string
	Description *string
	DestBranch  *string
}

// PRListResult wraps a page of pull requests.
type PRListResult struct {
	PullRequests []*PullRequest `json:"pull_requests"`
	Total        int            `json:"total"`
	Page         int            `json:"page"`
	Limit        int            `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// PRService implements pull request business logic.
type PRService struct {
	prs          PRRepository
	repos        RepoRepository
	workspaces   WorkspaceRepository
	restrictions BranchRestrictionRepository
	gitSvc       *GitService
	basePath     string
	logger       *slog.Logger
}

// NewPRService constructs a PRService.
func NewPRService(
	prs PRRepository,
	repos RepoRepository,
	workspaces WorkspaceRepository,
	restrictions BranchRestrictionRepository,
	gitSvc *GitService,
	basePath string,
	logger *slog.Logger,
) *PRService {
	return &PRService{
		prs:          prs,
		repos:        repos,
		workspaces:   workspaces,
		restrictions: restrictions,
		gitSvc:       gitSvc,
		basePath:     basePath,
		logger:       logger.With("service", "pr"),
	}
}

// Create opens a new pull request.
func (s *PRService) Create(ctx context.Context, in PRCreateInput) (*PullRequest, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("pr: %w: title is required", ErrValidation)
	}
	if in.SourceBranch == "" || in.DestBranch == "" {
		return nil, fmt.Errorf("pr: %w: source and destination branches are required", ErrValidation)
	}
	if in.SourceBranch == in.DestBranch {
		return nil, fmt.Errorf("pr: %w: source and destination branches must differ", ErrValidation)
	}

	repo, err := s.repos.GetByID(ctx, in.RepoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pr: %w: repository", ErrNotFound)
	}

	// Verify branches exist.
	diskPath := s.repoDiskPath(ctx, repo)
	if _, err := s.gitSvc.GetBranch(ctx, diskPath, in.SourceBranch); err != nil {
		return nil, fmt.Errorf("pr: %w: source branch %q", ErrNotFound, in.SourceBranch)
	}
	if _, err := s.gitSvc.GetBranch(ctx, diskPath, in.DestBranch); err != nil {
		return nil, fmt.Errorf("pr: %w: destination branch %q", ErrNotFound, in.DestBranch)
	}

	number, err := s.prs.NextNumber(ctx, in.RepoID)
	if err != nil {
		return nil, fmt.Errorf("pr: next number: %w", err)
	}

	now := time.Now().UTC()
	pr := &PullRequest{
		ID:           uuid.New(),
		RepoID:       in.RepoID,
		Number:       number,
		Title:        in.Title,
		Description:  in.Description,
		State:        PRStateOpen,
		SourceBranch: in.SourceBranch,
		DestBranch:   in.DestBranch,
		AuthorID:     in.AuthorID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.prs.Create(ctx, pr); err != nil {
		return nil, fmt.Errorf("pr: create: %w", err)
	}

	s.logger.Info("pull request created", "repo_id", in.RepoID, "number", number)
	return pr, nil
}

// Get retrieves a pull request by repo and number.
func (s *PRService) Get(ctx context.Context, repoID uuid.UUID, number int) (*PullRequest, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}
	return pr, nil
}

// Update applies partial updates to a pull request.
func (s *PRService) Update(ctx context.Context, repoID uuid.UUID, number int, in PRUpdateInput) (*PullRequest, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}
	if pr.State != PRStateOpen {
		return nil, fmt.Errorf("pr: %w: cannot update a %s pull request", ErrValidation, pr.State)
	}

	if in.Title != nil {
		pr.Title = *in.Title
	}
	if in.Description != nil {
		pr.Description = *in.Description
	}
	if in.DestBranch != nil {
		pr.DestBranch = *in.DestBranch
	}
	pr.UpdatedAt = time.Now().UTC()

	if err := s.prs.Update(ctx, pr); err != nil {
		return nil, fmt.Errorf("pr: update: %w", err)
	}

	s.logger.Info("pull request updated", "repo_id", repoID, "number", number)
	return pr, nil
}

// List returns a paginated list of pull requests.
func (s *PRService) List(ctx context.Context, repoID uuid.UUID, state *PullRequestState, authorID *uuid.UUID, page, limit int) (*PRListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	prs, total, err := s.prs.List(ctx, repoID, state, authorID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("pr: list: %w", err)
	}

	return &PRListResult{
		PullRequests: prs,
		Total:        total,
		Page:         page,
		Limit:        limit,
	}, nil
}

// Merge merges a pull request using the specified strategy.
func (s *PRService) Merge(ctx context.Context, repoID uuid.UUID, number int, mergerID uuid.UUID, strategy MergeStrategy) (*PullRequest, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}
	if pr.State != PRStateOpen {
		return nil, fmt.Errorf("pr: %w: pull request is not open", ErrValidation)
	}

	// Validate strategy.
	switch strategy {
	case MergeCommit, Squash, FastForward:
		// ok
	default:
		return nil, fmt.Errorf("pr: %w: invalid merge strategy %q", ErrValidation, strategy)
	}

	// Check branch restrictions.
	restrictions, err := s.restrictions.ListByRepo(ctx, repoID)
	if err != nil {
		s.logger.Warn("failed to load branch restrictions", "error", err)
	}

	for _, r := range restrictions {
		if !branchMatchesPattern(pr.DestBranch, r.Pattern) {
			continue
		}

		switch r.Kind {
		case models.BranchRestrictionRequireApprovals:
			count, err := s.prs.CountApprovals(ctx, pr.ID)
			if err != nil {
				return nil, fmt.Errorf("pr: count approvals: %w", err)
			}
			if count < r.Value {
				return nil, fmt.Errorf("pr: %w: requires at least %d approvals (has %d)", ErrForbidden, r.Value, count)
			}

		case models.BranchRestrictionRequirePR:
			// Already in a PR, so this is satisfied.

		case models.BranchRestrictionNoPush:
			return nil, fmt.Errorf("pr: %w: direct push to %q is restricted", ErrForbidden, pr.DestBranch)
		}
	}

	// Perform the merge on disk.
	// For now we record the merge in DB. Actual git merge would use
	// git CLI commands or a more advanced go-git workflow. We mark the
	// source branch head as the merge commit reference.
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pr: %w: repository", ErrNotFound)
	}

	diskPath := s.repoDiskPath(ctx, repo)
	srcBranch, err := s.gitSvc.GetBranch(ctx, diskPath, pr.SourceBranch)
	if err != nil {
		return nil, fmt.Errorf("pr: %w: source branch no longer exists", ErrValidation)
	}

	now := time.Now().UTC()
	mergeCommitSHA := srcBranch.CommitSHA
	pr.State = PRStateMerged
	pr.MergedBy = &mergerID
	pr.MergeCommit = &mergeCommitSHA
	pr.ClosedAt = &now
	pr.UpdatedAt = now

	if err := s.prs.Update(ctx, pr); err != nil {
		return nil, fmt.Errorf("pr: update after merge: %w", err)
	}

	s.logger.Info("pull request merged",
		"repo_id", repoID, "number", number,
		"strategy", strategy, "merger", mergerID,
	)
	return pr, nil
}

// Decline closes a pull request without merging.
func (s *PRService) Decline(ctx context.Context, repoID uuid.UUID, number int, userID uuid.UUID) (*PullRequest, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}
	if pr.State != PRStateOpen {
		return nil, fmt.Errorf("pr: %w: pull request is not open", ErrValidation)
	}

	now := time.Now().UTC()
	pr.State = PRStateDeclined
	pr.ClosedAt = &now
	pr.UpdatedAt = now

	if err := s.prs.Update(ctx, pr); err != nil {
		return nil, fmt.Errorf("pr: decline: %w", err)
	}

	s.logger.Info("pull request declined", "repo_id", repoID, "number", number, "by", userID)
	return pr, nil
}

// Approve records an approval on a pull request.
func (s *PRService) Approve(ctx context.Context, repoID uuid.UUID, number int, userID uuid.UUID) error {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}
	if pr.State != PRStateOpen {
		return fmt.Errorf("pr: %w: can only approve open pull requests", ErrValidation)
	}
	if pr.AuthorID == userID {
		return fmt.Errorf("pr: %w: cannot approve your own pull request", ErrValidation)
	}

	approval := &PRApproval{
		ID:        uuid.New(),
		PRID:      pr.ID,
		UserID:    userID,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.prs.CreateApproval(ctx, approval); err != nil {
		return fmt.Errorf("pr: create approval: %w", err)
	}

	s.logger.Info("pull request approved", "repo_id", repoID, "number", number, "by", userID)
	return nil
}

// Unapprove removes a user's approval from a pull request.
func (s *PRService) Unapprove(ctx context.Context, repoID uuid.UUID, number int, userID uuid.UUID) error {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}

	if err := s.prs.DeleteApproval(ctx, pr.ID, userID); err != nil {
		return fmt.Errorf("pr: remove approval: %w", err)
	}

	s.logger.Info("pull request unapproved", "repo_id", repoID, "number", number, "by", userID)
	return nil
}

// GetDiff computes the diff between the source and destination branches.
func (s *PRService) GetDiff(ctx context.Context, repoID uuid.UUID, number int) (*DiffResult, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}

	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pr: %w: repository", ErrNotFound)
	}

	diskPath := s.repoDiskPath(ctx, repo)
	return s.gitSvc.GetDiff(ctx, diskPath, pr.DestBranch, pr.SourceBranch)
}

// AddComment adds a comment to a pull request.
func (s *PRService) AddComment(ctx context.Context, repoID uuid.UUID, number int, comment *PRComment) (*PRComment, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}

	if comment.Content == "" {
		return nil, fmt.Errorf("pr: %w: comment content is required", ErrValidation)
	}

	now := time.Now().UTC()
	comment.ID = uuid.New()
	comment.PRID = pr.ID
	comment.CreatedAt = now
	comment.UpdatedAt = now

	if err := s.prs.CreateComment(ctx, comment); err != nil {
		return nil, fmt.Errorf("pr: add comment: %w", err)
	}

	s.logger.Info("comment added to PR", "repo_id", repoID, "number", number)
	return comment, nil
}

// ListComments returns all comments on a pull request.
func (s *PRService) ListComments(ctx context.Context, repoID uuid.UUID, number int) ([]*PRComment, error) {
	pr, err := s.prs.GetByNumber(ctx, repoID, number)
	if err != nil || pr == nil {
		return nil, fmt.Errorf("pr: %w: pull request #%d", ErrNotFound, number)
	}

	comments, err := s.prs.ListComments(ctx, pr.ID)
	if err != nil {
		return nil, fmt.Errorf("pr: list comments: %w", err)
	}
	return comments, nil
}

// ResolveComment marks a comment as resolved.
func (s *PRService) ResolveComment(ctx context.Context, commentID, userID uuid.UUID) error {
	comment, err := s.prs.GetComment(ctx, commentID)
	if err != nil || comment == nil {
		return fmt.Errorf("pr: %w: comment", ErrNotFound)
	}

	comment.IsResolved = true
	comment.ResolvedBy = &userID
	comment.UpdatedAt = time.Now().UTC()

	if err := s.prs.UpdateComment(ctx, comment); err != nil {
		return fmt.Errorf("pr: resolve comment: %w", err)
	}

	s.logger.Info("comment resolved", "comment_id", commentID, "by", userID)
	return nil
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

func (s *PRService) repoDiskPath(ctx context.Context, repo *models.Repository) string {
	ws, _ := s.workspaces.GetByID(ctx, repo.WorkspaceID)
	wsSlug := ""
	if ws != nil {
		wsSlug = ws.Slug
	}
	return filepath.Join(s.basePath, wsSlug, repo.Slug+".git")
}

// branchMatchesPattern checks if a branch name matches a glob-like pattern.
func branchMatchesPattern(branch, pattern string) bool {
	matched, err := filepath.Match(pattern, branch)
	if err != nil {
		return false
	}
	return matched
}
