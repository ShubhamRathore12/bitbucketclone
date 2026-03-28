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

// Snippet represents a code snippet (like a gist).
type Snippet struct {
	ID          uuid.UUID     `json:"id"`
	WorkspaceID *uuid.UUID    `json:"workspace_id,omitempty"`
	AuthorID    uuid.UUID     `json:"author_id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	IsPrivate   bool          `json:"is_private"`
	Files       []SnippetFile `json:"files"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// SnippetFile is a single file within a snippet.
type SnippetFile struct {
	ID        uuid.UUID `json:"id"`
	SnippetID uuid.UUID `json:"snippet_id"`
	Filename  string    `json:"filename"`
	Language  string    `json:"language,omitempty"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// SnippetRepository abstracts persistence for snippets.
type SnippetRepository interface {
	Create(ctx context.Context, snippet *Snippet) error
	GetByID(ctx context.Context, id uuid.UUID) (*Snippet, error)
	Update(ctx context.Context, snippet *Snippet) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]*Snippet, int, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, page, limit int) ([]*Snippet, int, error)

	CreateFile(ctx context.Context, file *SnippetFile) error
	UpdateFile(ctx context.Context, file *SnippetFile) error
	DeleteFilesBySnippet(ctx context.Context, snippetID uuid.UUID) error
	ListFiles(ctx context.Context, snippetID uuid.UUID) ([]SnippetFile, error)
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// SnippetCreateInput carries parameters for creating a snippet.
type SnippetCreateInput struct {
	WorkspaceID *uuid.UUID
	AuthorID    uuid.UUID
	Title       string
	Description string
	IsPrivate   bool
	Files       []SnippetFileInput
}

// SnippetFileInput carries parameters for a single snippet file.
type SnippetFileInput struct {
	Filename string
	Language string
	Content  string
}

// SnippetUpdateInput carries mutable snippet fields.
type SnippetUpdateInput struct {
	Title       *string
	Description *string
	IsPrivate   *bool
	Files       []SnippetFileInput // replaces all files if non-nil
}

// SnippetListResult wraps a page of snippets.
type SnippetListResult struct {
	Snippets []*Snippet `json:"snippets"`
	Total    int        `json:"total"`
	Page     int        `json:"page"`
	Limit    int        `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// SnippetService implements snippet business logic.
type SnippetService struct {
	snippets SnippetRepository
	logger   *slog.Logger
}

// NewSnippetService constructs a SnippetService.
func NewSnippetService(
	snippets SnippetRepository,
	logger *slog.Logger,
) *SnippetService {
	return &SnippetService{
		snippets: snippets,
		logger:   logger.With("service", "snippet"),
	}
}

// Create creates a new snippet with its files.
func (s *SnippetService) Create(ctx context.Context, in SnippetCreateInput) (*Snippet, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("snippet: %w: title is required", ErrValidation)
	}
	if len(in.Files) == 0 {
		return nil, fmt.Errorf("snippet: %w: at least one file is required", ErrValidation)
	}

	for _, f := range in.Files {
		if f.Filename == "" {
			return nil, fmt.Errorf("snippet: %w: all files must have a filename", ErrValidation)
		}
		if f.Content == "" {
			return nil, fmt.Errorf("snippet: %w: file %q must have content", ErrValidation, f.Filename)
		}
	}

	now := time.Now().UTC()
	snippet := &Snippet{
		ID:          uuid.New(),
		WorkspaceID: in.WorkspaceID,
		AuthorID:    in.AuthorID,
		Title:       in.Title,
		Description: in.Description,
		IsPrivate:   in.IsPrivate,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.snippets.Create(ctx, snippet); err != nil {
		return nil, fmt.Errorf("snippet: create: %w", err)
	}

	for _, f := range in.Files {
		file := &SnippetFile{
			ID:        uuid.New(),
			SnippetID: snippet.ID,
			Filename:  f.Filename,
			Language:  f.Language,
			Content:   f.Content,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.snippets.CreateFile(ctx, file); err != nil {
			s.logger.Warn("failed to create snippet file", "filename", f.Filename, "error", err)
			continue
		}
		snippet.Files = append(snippet.Files, *file)
	}

	s.logger.Info("snippet created", "id", snippet.ID, "files", len(snippet.Files))
	return snippet, nil
}

// Get retrieves a snippet by ID with its files.
func (s *SnippetService) Get(ctx context.Context, id uuid.UUID) (*Snippet, error) {
	snippet, err := s.snippets.GetByID(ctx, id)
	if err != nil || snippet == nil {
		return nil, fmt.Errorf("snippet: %w: snippet", ErrNotFound)
	}

	files, err := s.snippets.ListFiles(ctx, snippet.ID)
	if err != nil {
		s.logger.Warn("failed to load snippet files", "error", err)
	} else {
		snippet.Files = files
	}

	return snippet, nil
}

// Update applies changes to a snippet.
func (s *SnippetService) Update(ctx context.Context, id uuid.UUID, in SnippetUpdateInput) (*Snippet, error) {
	snippet, err := s.snippets.GetByID(ctx, id)
	if err != nil || snippet == nil {
		return nil, fmt.Errorf("snippet: %w: snippet", ErrNotFound)
	}

	if in.Title != nil {
		snippet.Title = *in.Title
	}
	if in.Description != nil {
		snippet.Description = *in.Description
	}
	if in.IsPrivate != nil {
		snippet.IsPrivate = *in.IsPrivate
	}
	snippet.UpdatedAt = time.Now().UTC()

	if err := s.snippets.Update(ctx, snippet); err != nil {
		return nil, fmt.Errorf("snippet: update: %w", err)
	}

	// Replace files if provided.
	if in.Files != nil {
		if err := s.snippets.DeleteFilesBySnippet(ctx, snippet.ID); err != nil {
			return nil, fmt.Errorf("snippet: delete old files: %w", err)
		}

		snippet.Files = nil
		now := time.Now().UTC()
		for _, f := range in.Files {
			file := &SnippetFile{
				ID:        uuid.New(),
				SnippetID: snippet.ID,
				Filename:  f.Filename,
				Language:  f.Language,
				Content:   f.Content,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := s.snippets.CreateFile(ctx, file); err != nil {
				s.logger.Warn("failed to create snippet file", "filename", f.Filename, "error", err)
				continue
			}
			snippet.Files = append(snippet.Files, *file)
		}
	}

	s.logger.Info("snippet updated", "id", id)
	return snippet, nil
}

// Delete removes a snippet and its files.
func (s *SnippetService) Delete(ctx context.Context, id uuid.UUID) error {
	snippet, err := s.snippets.GetByID(ctx, id)
	if err != nil || snippet == nil {
		return fmt.Errorf("snippet: %w: snippet", ErrNotFound)
	}

	if err := s.snippets.DeleteFilesBySnippet(ctx, id); err != nil {
		s.logger.Warn("failed to delete snippet files", "error", err)
	}

	if err := s.snippets.Delete(ctx, id); err != nil {
		return fmt.Errorf("snippet: delete: %w", err)
	}

	s.logger.Info("snippet deleted", "id", id)
	return nil
}

// ListByUser returns snippets created by a user.
func (s *SnippetService) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int) (*SnippetListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	snippets, total, err := s.snippets.ListByUser(ctx, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("snippet: list by user: %w", err)
	}

	// Load files for each snippet.
	for _, sn := range snippets {
		files, err := s.snippets.ListFiles(ctx, sn.ID)
		if err == nil {
			sn.Files = files
		}
	}

	return &SnippetListResult{
		Snippets: snippets,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}

// ListByWorkspace returns snippets in a workspace.
func (s *SnippetService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, page, limit int) (*SnippetListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	snippets, total, err := s.snippets.ListByWorkspace(ctx, workspaceID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("snippet: list by workspace: %w", err)
	}

	for _, sn := range snippets {
		files, err := s.snippets.ListFiles(ctx, sn.ID)
		if err == nil {
			sn.Files = files
		}
	}

	return &SnippetListResult{
		Snippets: snippets,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}
