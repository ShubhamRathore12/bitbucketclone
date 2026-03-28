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

// WikiPage represents a single wiki page.
type WikiPage struct {
	ID        uuid.UUID `json:"id"`
	RepoID    uuid.UUID `json:"repo_id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	AuthorID  uuid.UUID `json:"author_id"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// WikiRevision records a historical version of a wiki page.
type WikiRevision struct {
	ID        uuid.UUID `json:"id"`
	PageID    uuid.UUID `json:"page_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	AuthorID  uuid.UUID `json:"author_id"`
	Version   int       `json:"version"`
	Message   string    `json:"message,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// WikiRepository abstracts persistence for wiki pages.
type WikiRepository interface {
	Create(ctx context.Context, page *WikiPage) error
	GetBySlug(ctx context.Context, repoID uuid.UUID, slug string) (*WikiPage, error)
	GetByID(ctx context.Context, id uuid.UUID) (*WikiPage, error)
	Update(ctx context.Context, page *WikiPage) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, repoID uuid.UUID, page, limit int) ([]*WikiPage, int, error)

	CreateRevision(ctx context.Context, rev *WikiRevision) error
	ListRevisions(ctx context.Context, pageID uuid.UUID, page, limit int) ([]*WikiRevision, int, error)
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// WikiCreateInput carries parameters for creating a wiki page.
type WikiCreateInput struct {
	RepoID   uuid.UUID
	Title    string
	Content  string
	AuthorID uuid.UUID
}

// WikiUpdateInput carries mutable fields for a wiki page.
type WikiUpdateInput struct {
	Title    *string
	Content  *string
	AuthorID uuid.UUID
	Message  string // revision message
}

// WikiListResult wraps a page of wiki pages.
type WikiListResult struct {
	Pages []*WikiPage `json:"pages"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

// WikiRevisionListResult wraps a page of wiki revisions.
type WikiRevisionListResult struct {
	Revisions []*WikiRevision `json:"revisions"`
	Total     int             `json:"total"`
	Page      int             `json:"page"`
	Limit     int             `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// WikiService implements wiki page business logic.
type WikiService struct {
	wiki   WikiRepository
	repos  RepoRepository
	logger *slog.Logger
}

// NewWikiService constructs a WikiService.
func NewWikiService(
	wiki WikiRepository,
	repos RepoRepository,
	logger *slog.Logger,
) *WikiService {
	return &WikiService{
		wiki:   wiki,
		repos:  repos,
		logger: logger.With("service", "wiki"),
	}
}

// Create creates a new wiki page.
func (s *WikiService) Create(ctx context.Context, in WikiCreateInput) (*WikiPage, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("wiki: %w: title is required", ErrValidation)
	}

	repo, err := s.repos.GetByID(ctx, in.RepoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("wiki: %w: repository", ErrNotFound)
	}
	if !repo.HasWiki {
		return nil, fmt.Errorf("wiki: %w: wiki is disabled for this repository", ErrForbidden)
	}

	slug := toSlug(in.Title)
	if existing, _ := s.wiki.GetBySlug(ctx, in.RepoID, slug); existing != nil {
		return nil, fmt.Errorf("wiki: %w: page %q already exists", ErrConflict, slug)
	}

	now := time.Now().UTC()
	page := &WikiPage{
		ID:        uuid.New(),
		RepoID:    in.RepoID,
		Slug:      slug,
		Title:     in.Title,
		Content:   in.Content,
		AuthorID:  in.AuthorID,
		Version:   1,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.wiki.Create(ctx, page); err != nil {
		return nil, fmt.Errorf("wiki: create: %w", err)
	}

	// Store the initial revision.
	rev := &WikiRevision{
		ID:        uuid.New(),
		PageID:    page.ID,
		Title:     page.Title,
		Content:   page.Content,
		AuthorID:  in.AuthorID,
		Version:   1,
		Message:   "Initial version",
		CreatedAt: now,
	}
	if err := s.wiki.CreateRevision(ctx, rev); err != nil {
		s.logger.Warn("failed to create initial revision", "page_id", page.ID, "error", err)
	}

	s.logger.Info("wiki page created", "repo_id", in.RepoID, "slug", slug)
	return page, nil
}

// Get retrieves a wiki page by slug.
func (s *WikiService) Get(ctx context.Context, repoID uuid.UUID, slug string) (*WikiPage, error) {
	page, err := s.wiki.GetBySlug(ctx, repoID, slug)
	if err != nil || page == nil {
		return nil, fmt.Errorf("wiki: %w: page %q", ErrNotFound, slug)
	}
	return page, nil
}

// Update applies changes to a wiki page and creates a revision.
func (s *WikiService) Update(ctx context.Context, repoID uuid.UUID, slug string, in WikiUpdateInput) (*WikiPage, error) {
	page, err := s.wiki.GetBySlug(ctx, repoID, slug)
	if err != nil || page == nil {
		return nil, fmt.Errorf("wiki: %w: page %q", ErrNotFound, slug)
	}

	if in.Title != nil {
		page.Title = *in.Title
		page.Slug = toSlug(*in.Title)
	}
	if in.Content != nil {
		page.Content = *in.Content
	}
	page.Version++
	page.UpdatedAt = time.Now().UTC()

	if err := s.wiki.Update(ctx, page); err != nil {
		return nil, fmt.Errorf("wiki: update: %w", err)
	}

	// Store revision.
	message := in.Message
	if message == "" {
		message = fmt.Sprintf("Updated to version %d", page.Version)
	}
	rev := &WikiRevision{
		ID:        uuid.New(),
		PageID:    page.ID,
		Title:     page.Title,
		Content:   page.Content,
		AuthorID:  in.AuthorID,
		Version:   page.Version,
		Message:   message,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.wiki.CreateRevision(ctx, rev); err != nil {
		s.logger.Warn("failed to create revision", "page_id", page.ID, "error", err)
	}

	s.logger.Info("wiki page updated", "repo_id", repoID, "slug", slug, "version", page.Version)
	return page, nil
}

// Delete removes a wiki page.
func (s *WikiService) Delete(ctx context.Context, repoID uuid.UUID, slug string) error {
	page, err := s.wiki.GetBySlug(ctx, repoID, slug)
	if err != nil || page == nil {
		return fmt.Errorf("wiki: %w: page %q", ErrNotFound, slug)
	}

	if err := s.wiki.Delete(ctx, page.ID); err != nil {
		return fmt.Errorf("wiki: delete: %w", err)
	}

	s.logger.Info("wiki page deleted", "repo_id", repoID, "slug", slug)
	return nil
}

// List returns a paginated list of wiki pages.
func (s *WikiService) List(ctx context.Context, repoID uuid.UUID, page, limit int) (*WikiListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	pages, total, err := s.wiki.List(ctx, repoID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("wiki: list: %w", err)
	}

	return &WikiListResult{
		Pages: pages,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// ListRevisions returns a paginated list of revisions for a wiki page.
func (s *WikiService) ListRevisions(ctx context.Context, repoID uuid.UUID, slug string, page, limit int) (*WikiRevisionListResult, error) {
	wikiPage, err := s.wiki.GetBySlug(ctx, repoID, slug)
	if err != nil || wikiPage == nil {
		return nil, fmt.Errorf("wiki: %w: page %q", ErrNotFound, slug)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	revisions, total, err := s.wiki.ListRevisions(ctx, wikiPage.ID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("wiki: list revisions: %w", err)
	}

	return &WikiRevisionListResult{
		Revisions: revisions,
		Total:     total,
		Page:      page,
		Limit:     limit,
	}, nil
}
