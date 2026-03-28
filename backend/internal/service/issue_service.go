package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────

// IssueState enumerates issue states.
type IssueState string

const (
	IssueStateOpen    IssueState = "open"
	IssueStateClosed  IssueState = "closed"
	IssueStateOnHold  IssueState = "on hold"
	IssueStateInvalid IssueState = "invalid"
)

// IssuePriority enumerates issue priority levels.
type IssuePriority string

const (
	PriorityTrivial  IssuePriority = "trivial"
	PriorityMinor    IssuePriority = "minor"
	PriorityMajor    IssuePriority = "major"
	PriorityCritical IssuePriority = "critical"
	PriorityBlocker  IssuePriority = "blocker"
)

// IssueKind enumerates issue types.
type IssueKind string

const (
	IssueKindBug         IssueKind = "bug"
	IssueKindEnhancement IssueKind = "enhancement"
	IssueKindProposal    IssueKind = "proposal"
	IssueKindTask        IssueKind = "task"
)

// Issue represents a project issue.
type Issue struct {
	ID          uuid.UUID     `json:"id"`
	RepoID      uuid.UUID     `json:"repo_id"`
	Number      int           `json:"number"`
	Title       string        `json:"title"`
	Content     string        `json:"content,omitempty"`
	State       IssueState    `json:"state"`
	Priority    IssuePriority `json:"priority"`
	Kind        IssueKind     `json:"kind"`
	AuthorID    uuid.UUID     `json:"author_id"`
	AssigneeID  *uuid.UUID    `json:"assignee_id,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	ClosedAt    *time.Time    `json:"closed_at,omitempty"`

	// Joined fields.
	Labels []Label `json:"labels,omitempty"`
}

// IssueComment is a comment on an issue.
type IssueComment struct {
	ID        uuid.UUID `json:"id"`
	IssueID   uuid.UUID `json:"issue_id"`
	AuthorID  uuid.UUID `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Label is a coloured tag that can be attached to issues.
type Label struct {
	ID        uuid.UUID `json:"id"`
	RepoID    uuid.UUID `json:"repo_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"` // hex, e.g. "#ff0000"
	CreatedAt time.Time `json:"created_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// IssueRepository abstracts persistence for issues.
type IssueRepository interface {
	Create(ctx context.Context, issue *Issue) error
	GetByNumber(ctx context.Context, repoID uuid.UUID, number int) (*Issue, error)
	Update(ctx context.Context, issue *Issue) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, repoID uuid.UUID, filters IssueListFilters, page, limit int) ([]*Issue, int, error)
	NextNumber(ctx context.Context, repoID uuid.UUID) (int, error)

	CreateComment(ctx context.Context, comment *IssueComment) error
	ListComments(ctx context.Context, issueID uuid.UUID) ([]*IssueComment, error)

	CreateLabel(ctx context.Context, label *Label) error
	GetLabel(ctx context.Context, id uuid.UUID) (*Label, error)
	ListLabels(ctx context.Context, repoID uuid.UUID) ([]*Label, error)
	AssignLabel(ctx context.Context, issueID, labelID uuid.UUID) error
	RemoveLabel(ctx context.Context, issueID, labelID uuid.UUID) error
}

// IssueListFilters carries optional filter parameters for listing issues.
type IssueListFilters struct {
	State      *IssueState
	Priority   *IssuePriority
	Kind       *IssueKind
	AssigneeID *uuid.UUID
	LabelID    *uuid.UUID
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// IssueCreateInput carries parameters for creating an issue.
type IssueCreateInput struct {
	RepoID     uuid.UUID
	Title      string
	Content    string
	Priority   IssuePriority
	Kind       IssueKind
	AuthorID   uuid.UUID
	AssigneeID *uuid.UUID
	LabelIDs   []uuid.UUID
}

// IssueUpdateInput carries mutable fields.
type IssueUpdateInput struct {
	Title      *string
	Content    *string
	State      *IssueState
	Priority   *IssuePriority
	Kind       *IssueKind
	AssigneeID *uuid.UUID
}

// IssueListResult wraps a page of issues.
type IssueListResult struct {
	Issues []*Issue `json:"issues"`
	Total  int      `json:"total"`
	Page   int      `json:"page"`
	Limit  int      `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// IssueService implements issue tracking business logic.
type IssueService struct {
	issues IssueRepository
	repos  RepoRepository
	logger *slog.Logger
}

// NewIssueService constructs an IssueService.
func NewIssueService(
	issues IssueRepository,
	repos RepoRepository,
	logger *slog.Logger,
) *IssueService {
	return &IssueService{
		issues: issues,
		repos:  repos,
		logger: logger.With("service", "issue"),
	}
}

// Create creates a new issue.
func (s *IssueService) Create(ctx context.Context, in IssueCreateInput) (*Issue, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("issue: %w: title is required", ErrValidation)
	}

	repo, err := s.repos.GetByID(ctx, in.RepoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("issue: %w: repository", ErrNotFound)
	}
	if !repo.HasIssues {
		return nil, fmt.Errorf("issue: %w: issues are disabled for this repository", ErrForbidden)
	}

	number, err := s.issues.NextNumber(ctx, in.RepoID)
	if err != nil {
		return nil, fmt.Errorf("issue: next number: %w", err)
	}

	priority := in.Priority
	if priority == "" {
		priority = PriorityMajor
	}
	kind := in.Kind
	if kind == "" {
		kind = IssueKindBug
	}

	now := time.Now().UTC()
	issue := &Issue{
		ID:         uuid.New(),
		RepoID:     in.RepoID,
		Number:     number,
		Title:      in.Title,
		Content:    in.Content,
		State:      IssueStateOpen,
		Priority:   priority,
		Kind:       kind,
		AuthorID:   in.AuthorID,
		AssigneeID: in.AssigneeID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.issues.Create(ctx, issue); err != nil {
		return nil, fmt.Errorf("issue: create: %w", err)
	}

	// Assign labels if provided.
	for _, labelID := range in.LabelIDs {
		if err := s.issues.AssignLabel(ctx, issue.ID, labelID); err != nil {
			s.logger.Warn("failed to assign label", "issue_id", issue.ID, "label_id", labelID, "error", err)
		}
	}

	s.logger.Info("issue created", "repo_id", in.RepoID, "number", number)
	return issue, nil
}

// Get retrieves an issue by repo and number.
func (s *IssueService) Get(ctx context.Context, repoID uuid.UUID, number int) (*Issue, error) {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return nil, fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}
	return issue, nil
}

// Update applies partial updates to an issue.
func (s *IssueService) Update(ctx context.Context, repoID uuid.UUID, number int, in IssueUpdateInput) (*Issue, error) {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return nil, fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	if in.Title != nil {
		issue.Title = *in.Title
	}
	if in.Content != nil {
		issue.Content = *in.Content
	}
	if in.State != nil {
		issue.State = *in.State
		if *in.State == IssueStateClosed {
			now := time.Now().UTC()
			issue.ClosedAt = &now
		} else {
			issue.ClosedAt = nil
		}
	}
	if in.Priority != nil {
		issue.Priority = *in.Priority
	}
	if in.Kind != nil {
		issue.Kind = *in.Kind
	}
	if in.AssigneeID != nil {
		issue.AssigneeID = in.AssigneeID
	}
	issue.UpdatedAt = time.Now().UTC()

	if err := s.issues.Update(ctx, issue); err != nil {
		return nil, fmt.Errorf("issue: update: %w", err)
	}

	s.logger.Info("issue updated", "repo_id", repoID, "number", number)
	return issue, nil
}

// Delete removes an issue.
func (s *IssueService) Delete(ctx context.Context, repoID uuid.UUID, number int) error {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	if err := s.issues.Delete(ctx, issue.ID); err != nil {
		return fmt.Errorf("issue: delete: %w", err)
	}

	s.logger.Info("issue deleted", "repo_id", repoID, "number", number)
	return nil
}

// List returns a paginated list of issues with optional filters.
func (s *IssueService) List(ctx context.Context, repoID uuid.UUID, filters IssueListFilters, page, limit int) (*IssueListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	issues, total, err := s.issues.List(ctx, repoID, filters, page, limit)
	if err != nil {
		return nil, fmt.Errorf("issue: list: %w", err)
	}

	return &IssueListResult{
		Issues: issues,
		Total:  total,
		Page:   page,
		Limit:  limit,
	}, nil
}

// AddComment adds a comment to an issue.
func (s *IssueService) AddComment(ctx context.Context, repoID uuid.UUID, number int, authorID uuid.UUID, content string) (*IssueComment, error) {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return nil, fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	if content == "" {
		return nil, fmt.Errorf("issue: %w: comment content is required", ErrValidation)
	}

	now := time.Now().UTC()
	comment := &IssueComment{
		ID:        uuid.New(),
		IssueID:   issue.ID,
		AuthorID:  authorID,
		Content:   content,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.issues.CreateComment(ctx, comment); err != nil {
		return nil, fmt.Errorf("issue: add comment: %w", err)
	}

	s.logger.Info("comment added to issue", "repo_id", repoID, "number", number)
	return comment, nil
}

// ListComments returns all comments on an issue.
func (s *IssueService) ListComments(ctx context.Context, repoID uuid.UUID, number int) ([]*IssueComment, error) {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return nil, fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	comments, err := s.issues.ListComments(ctx, issue.ID)
	if err != nil {
		return nil, fmt.Errorf("issue: list comments: %w", err)
	}
	return comments, nil
}

// ──────────────────────────────────────────────
// Label management
// ──────────────────────────────────────────────

// CreateLabel creates a new label for a repository.
func (s *IssueService) CreateLabel(ctx context.Context, repoID uuid.UUID, name, color string) (*Label, error) {
	if name == "" {
		return nil, fmt.Errorf("issue: %w: label name is required", ErrValidation)
	}
	if color == "" {
		color = "#0052cc"
	}

	label := &Label{
		ID:        uuid.New(),
		RepoID:    repoID,
		Name:      name,
		Color:     color,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.issues.CreateLabel(ctx, label); err != nil {
		return nil, fmt.Errorf("issue: create label: %w", err)
	}

	s.logger.Info("label created", "repo_id", repoID, "name", name)
	return label, nil
}

// ListLabels returns all labels for a repository.
func (s *IssueService) ListLabels(ctx context.Context, repoID uuid.UUID) ([]*Label, error) {
	labels, err := s.issues.ListLabels(ctx, repoID)
	if err != nil {
		return nil, fmt.Errorf("issue: list labels: %w", err)
	}
	return labels, nil
}

// AssignLabel assigns a label to an issue.
func (s *IssueService) AssignLabel(ctx context.Context, repoID uuid.UUID, number int, labelID uuid.UUID) error {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	label, err := s.issues.GetLabel(ctx, labelID)
	if err != nil || label == nil {
		return fmt.Errorf("issue: %w: label", ErrNotFound)
	}
	if label.RepoID != repoID {
		return fmt.Errorf("issue: %w: label does not belong to this repository", ErrValidation)
	}

	if err := s.issues.AssignLabel(ctx, issue.ID, labelID); err != nil {
		return fmt.Errorf("issue: assign label: %w", err)
	}

	s.logger.Info("label assigned", "issue_number", number, "label_id", labelID)
	return nil
}

// RemoveLabel removes a label from an issue.
func (s *IssueService) RemoveLabel(ctx context.Context, repoID uuid.UUID, number int, labelID uuid.UUID) error {
	issue, err := s.issues.GetByNumber(ctx, repoID, number)
	if err != nil || issue == nil {
		return fmt.Errorf("issue: %w: issue #%d", ErrNotFound, number)
	}

	if err := s.issues.RemoveLabel(ctx, issue.ID, labelID); err != nil {
		return fmt.Errorf("issue: remove label: %w", err)
	}

	s.logger.Info("label removed", "issue_number", number, "label_id", labelID)
	return nil
}
