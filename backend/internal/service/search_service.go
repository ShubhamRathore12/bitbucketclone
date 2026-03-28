package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────

// CodeSearchResult represents a single code search hit.
type CodeSearchResult struct {
	RepoID        uuid.UUID `json:"repo_id"`
	RepoSlug      string    `json:"repo_slug"`
	WorkspaceSlug string    `json:"workspace_slug"`
	FilePath      string    `json:"file_path"`
	MatchLine     int       `json:"match_line"`
	LineContent   string    `json:"line_content"`
	Language      string    `json:"language,omitempty"`
}

// RepoSearchResult represents a repository search hit.
type RepoSearchResult struct {
	ID            uuid.UUID `json:"id"`
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	WorkspaceSlug string    `json:"workspace_slug"`
	Language      string    `json:"language,omitempty"`
	IsPrivate     bool      `json:"is_private"`
}

// UserSearchResult represents a user search hit.
type UserSearchResult struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// SearchRepository abstracts persistence for search operations.
// Implementations are expected to use PostgreSQL pg_trgm for fuzzy text matching.
type SearchRepository interface {
	// SearchCode searches indexed code content using pg_trgm similarity.
	SearchCode(ctx context.Context, query string, filters CodeSearchFilters, page, limit int) ([]CodeSearchResult, int, error)

	// SearchRepos searches repository names and descriptions.
	SearchRepos(ctx context.Context, query string, userID *uuid.UUID, page, limit int) ([]RepoSearchResult, int, error)

	// SearchUsers searches user display names and usernames.
	SearchUsers(ctx context.Context, query string, page, limit int) ([]UserSearchResult, int, error)
}

// CodeSearchFilters carries optional filters for code search.
type CodeSearchFilters struct {
	WorkspaceSlug *string
	RepoSlug      *string
	Language      *string
	UserID        *uuid.UUID // for permission checks
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// CodeSearchListResult wraps a page of code search results.
type CodeSearchListResult struct {
	Results []CodeSearchResult `json:"results"`
	Total   int                `json:"total"`
	Page    int                `json:"page"`
	Limit   int                `json:"limit"`
}

// RepoSearchListResult wraps a page of repo search results.
type RepoSearchListResult struct {
	Results []RepoSearchResult `json:"results"`
	Total   int                `json:"total"`
	Page    int                `json:"page"`
	Limit   int                `json:"limit"`
}

// UserSearchListResult wraps a page of user search results.
type UserSearchListResult struct {
	Results []UserSearchResult `json:"results"`
	Total   int                `json:"total"`
	Page    int                `json:"page"`
	Limit   int                `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// SearchService implements search business logic using pg_trgm.
type SearchService struct {
	search SearchRepository
	logger *slog.Logger
}

// NewSearchService constructs a SearchService.
func NewSearchService(
	search SearchRepository,
	logger *slog.Logger,
) *SearchService {
	return &SearchService{
		search: search,
		logger: logger.With("service", "search"),
	}
}

// SearchCode searches indexed code across repositories.
func (s *SearchService) SearchCode(
	ctx context.Context,
	query string,
	workspaceSlug, repoSlug, language *string,
	userID *uuid.UUID,
	page, limit int,
) (*CodeSearchListResult, error) {
	if query == "" {
		return nil, fmt.Errorf("search: %w: query is required", ErrValidation)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	filters := CodeSearchFilters{
		WorkspaceSlug: workspaceSlug,
		RepoSlug:      repoSlug,
		Language:      language,
		UserID:        userID,
	}

	results, total, err := s.search.SearchCode(ctx, query, filters, page, limit)
	if err != nil {
		return nil, fmt.Errorf("search: code: %w", err)
	}

	s.logger.Info("code search executed", "query", query, "results", total)

	return &CodeSearchListResult{
		Results: results,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}, nil
}

// SearchRepos searches repositories by name and description.
func (s *SearchService) SearchRepos(
	ctx context.Context,
	query string,
	userID *uuid.UUID,
	page, limit int,
) (*RepoSearchListResult, error) {
	if query == "" {
		return nil, fmt.Errorf("search: %w: query is required", ErrValidation)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	results, total, err := s.search.SearchRepos(ctx, query, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("search: repos: %w", err)
	}

	s.logger.Info("repo search executed", "query", query, "results", total)

	return &RepoSearchListResult{
		Results: results,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}, nil
}

// SearchUsers searches users by username and display name.
func (s *SearchService) SearchUsers(
	ctx context.Context,
	query string,
	page, limit int,
) (*UserSearchListResult, error) {
	if query == "" {
		return nil, fmt.Errorf("search: %w: query is required", ErrValidation)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	results, total, err := s.search.SearchUsers(ctx, query, page, limit)
	if err != nil {
		return nil, fmt.Errorf("search: users: %w", err)
	}

	s.logger.Info("user search executed", "query", query, "results", total)

	return &UserSearchListResult{
		Results: results,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}, nil
}

