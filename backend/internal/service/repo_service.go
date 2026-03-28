package service

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/gitforge/backend/internal/models"
)

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// RepoRepository abstracts persistence for git repositories.
type RepoRepository interface {
	Create(ctx context.Context, repo *models.Repository) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Repository, error)
	GetBySlug(ctx context.Context, workspaceID uuid.UUID, slug string) (*models.Repository, error)
	Update(ctx context.Context, repo *models.Repository) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, workspaceID uuid.UUID, page, limit int) ([]*models.Repository, int, error)
	ListAccessible(ctx context.Context, workspaceID, userID uuid.UUID, page, limit int) ([]*models.Repository, int, error)
}

// WorkspaceRepository abstracts persistence for workspaces.
type WorkspaceRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*models.Workspace, error)
	GetBySlug(ctx context.Context, slug string) (*models.Workspace, error)
	IsMember(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error)
}

// RepoPermissionRepository abstracts permission persistence.
type RepoPermissionRepository interface {
	Create(ctx context.Context, perm *models.RepositoryPermission) error
	GetPermission(ctx context.Context, repoID, userID uuid.UUID) (*models.RepositoryPermission, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// RepoCreateInput carries parameters for repository creation.
type RepoCreateInput struct {
	WorkspaceSlug string
	Name          string
	Description   string
	IsPrivate     bool
	OwnerID       uuid.UUID
}

// RepoUpdateInput carries mutable fields.
type RepoUpdateInput struct {
	Name          *string
	Description   *string
	IsPrivate     *bool
	DefaultBranch *string
	Language      *string
	HasIssues     *bool
	HasWiki       *bool
	HasPipelines  *bool
}

// RepoListResult wraps a page of repositories.
type RepoListResult struct {
	Repos []*models.Repository `json:"repos"`
	Total int                  `json:"total"`
	Page  int                  `json:"page"`
	Limit int                  `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

var slugRe = regexp.MustCompile(`[^a-z0-9\-]`)

// RepoService implements repository business logic.
type RepoService struct {
	repos      RepoRepository
	workspaces WorkspaceRepository
	perms      RepoPermissionRepository
	gitSvc     *GitService
	basePath   string
	logger     *slog.Logger
}

// NewRepoService constructs a RepoService.
func NewRepoService(
	repos RepoRepository,
	workspaces WorkspaceRepository,
	perms RepoPermissionRepository,
	gitSvc *GitService,
	basePath string,
	logger *slog.Logger,
) *RepoService {
	return &RepoService{
		repos:      repos,
		workspaces: workspaces,
		perms:      perms,
		gitSvc:     gitSvc,
		basePath:   basePath,
		logger:     logger.With("service", "repo"),
	}
}

// Create creates a new repository: validates input, persists a DB record,
// initialises a bare git repo on disk, and grants admin permission to the owner.
func (s *RepoService) Create(ctx context.Context, in RepoCreateInput) (*models.Repository, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("repo: %w: name is required", ErrValidation)
	}

	ws, err := s.workspaces.GetBySlug(ctx, in.WorkspaceSlug)
	if err != nil || ws == nil {
		return nil, fmt.Errorf("repo: %w: workspace %q", ErrNotFound, in.WorkspaceSlug)
	}

	// Check the caller is a workspace member.
	isMember, err := s.workspaces.IsMember(ctx, ws.ID, in.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("repo: check membership: %w", err)
	}
	if !isMember {
		return nil, fmt.Errorf("repo: %w: not a workspace member", ErrForbidden)
	}

	slug := toSlug(in.Name)
	if existing, _ := s.repos.GetBySlug(ctx, ws.ID, slug); existing != nil {
		return nil, fmt.Errorf("repo: %w: repository %q already exists in workspace", ErrConflict, slug)
	}

	now := time.Now().UTC()
	repo := &models.Repository{
		ID:            uuid.New(),
		WorkspaceID:   ws.ID,
		Slug:          slug,
		Name:          in.Name,
		Description:   in.Description,
		IsPrivate:     in.IsPrivate,
		DefaultBranch: "main",
		HasIssues:     true,
		HasWiki:       true,
		HasPipelines:  true,
		CreatedAt:     now,
		UpdatedAt:     now,
		WorkspaceSlug: ws.Slug,
	}

	if err := s.repos.Create(ctx, repo); err != nil {
		return nil, fmt.Errorf("repo: persist: %w", err)
	}

	diskPath := s.diskPath(ws.Slug, slug)
	if err := s.gitSvc.InitRepository(ctx, diskPath); err != nil {
		// Best-effort rollback of DB record.
		_ = s.repos.Delete(ctx, repo.ID)
		return nil, fmt.Errorf("repo: init git repo: %w", err)
	}

	// Grant admin permission to the creator.
	perm := &models.RepositoryPermission{
		ID:         uuid.New(),
		RepoID:     repo.ID,
		UserID:     in.OwnerID,
		Permission: models.RepoPermAdmin,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.perms.Create(ctx, perm); err != nil {
		s.logger.Warn("failed to create owner permission", "repo_id", repo.ID, "error", err)
	}

	s.logger.Info("repository created", "repo_id", repo.ID, "slug", slug)
	return repo, nil
}

// Get retrieves a repository by workspace slug and repo slug.
func (s *RepoService) Get(ctx context.Context, workspaceSlug, repoSlug string) (*models.Repository, error) {
	ws, err := s.workspaces.GetBySlug(ctx, workspaceSlug)
	if err != nil || ws == nil {
		return nil, fmt.Errorf("repo: %w: workspace %q", ErrNotFound, workspaceSlug)
	}

	repo, err := s.repos.GetBySlug(ctx, ws.ID, repoSlug)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("repo: %w: repository %q", ErrNotFound, repoSlug)
	}
	repo.WorkspaceSlug = ws.Slug

	return repo, nil
}

// Update applies partial updates to a repository.
func (s *RepoService) Update(ctx context.Context, repoID uuid.UUID, in RepoUpdateInput) (*models.Repository, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("repo: %w: repository", ErrNotFound)
	}

	if in.Name != nil {
		repo.Name = *in.Name
		repo.Slug = toSlug(*in.Name)
	}
	if in.Description != nil {
		repo.Description = *in.Description
	}
	if in.IsPrivate != nil {
		repo.IsPrivate = *in.IsPrivate
	}
	if in.DefaultBranch != nil {
		repo.DefaultBranch = *in.DefaultBranch
	}
	if in.Language != nil {
		repo.Language = *in.Language
	}
	if in.HasIssues != nil {
		repo.HasIssues = *in.HasIssues
	}
	if in.HasWiki != nil {
		repo.HasWiki = *in.HasWiki
	}
	if in.HasPipelines != nil {
		repo.HasPipelines = *in.HasPipelines
	}
	repo.UpdatedAt = time.Now().UTC()

	if err := s.repos.Update(ctx, repo); err != nil {
		return nil, fmt.Errorf("repo: update: %w", err)
	}

	s.logger.Info("repository updated", "repo_id", repoID)
	return repo, nil
}

// Delete removes a repository from the database and disk.
func (s *RepoService) Delete(ctx context.Context, repoID uuid.UUID) error {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return fmt.Errorf("repo: %w: repository", ErrNotFound)
	}

	ws, err := s.workspaces.GetByID(ctx, repo.WorkspaceID)
	if err != nil || ws == nil {
		return fmt.Errorf("repo: %w: workspace for repo", ErrNotFound)
	}

	if err := s.repos.Delete(ctx, repoID); err != nil {
		return fmt.Errorf("repo: delete from db: %w", err)
	}

	diskPath := s.diskPath(ws.Slug, repo.Slug)
	if err := s.gitSvc.DeleteRepository(ctx, diskPath); err != nil {
		s.logger.Warn("failed to remove repo from disk", "path", diskPath, "error", err)
	}

	s.logger.Info("repository deleted", "repo_id", repoID)
	return nil
}

// List returns a paginated list of repositories the user can access.
func (s *RepoService) List(ctx context.Context, workspaceSlug string, userID uuid.UUID, page, limit int) (*RepoListResult, error) {
	ws, err := s.workspaces.GetBySlug(ctx, workspaceSlug)
	if err != nil || ws == nil {
		return nil, fmt.Errorf("repo: %w: workspace %q", ErrNotFound, workspaceSlug)
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	repos, total, err := s.repos.ListAccessible(ctx, ws.ID, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("repo: list: %w", err)
	}

	for i := range repos {
		repos[i].WorkspaceSlug = ws.Slug
	}

	return &RepoListResult{
		Repos: repos,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// Fork creates a fork of an existing repository into a target workspace.
func (s *RepoService) Fork(ctx context.Context, repoID, targetWorkspaceID, userID uuid.UUID) (*models.Repository, error) {
	srcRepo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || srcRepo == nil {
		return nil, fmt.Errorf("repo: %w: source repository", ErrNotFound)
	}

	srcWS, err := s.workspaces.GetByID(ctx, srcRepo.WorkspaceID)
	if err != nil || srcWS == nil {
		return nil, fmt.Errorf("repo: %w: source workspace", ErrNotFound)
	}

	targetWS, err := s.workspaces.GetByID(ctx, targetWorkspaceID)
	if err != nil || targetWS == nil {
		return nil, fmt.Errorf("repo: %w: target workspace", ErrNotFound)
	}

	isMember, err := s.workspaces.IsMember(ctx, targetWorkspaceID, userID)
	if err != nil {
		return nil, fmt.Errorf("repo: check target membership: %w", err)
	}
	if !isMember {
		return nil, fmt.Errorf("repo: %w: not a member of target workspace", ErrForbidden)
	}

	// Check if already forked in target workspace.
	if existing, _ := s.repos.GetBySlug(ctx, targetWorkspaceID, srcRepo.Slug); existing != nil {
		return nil, fmt.Errorf("repo: %w: repository %q already exists in target workspace", ErrConflict, srcRepo.Slug)
	}

	now := time.Now().UTC()
	forked := &models.Repository{
		ID:            uuid.New(),
		WorkspaceID:   targetWorkspaceID,
		Slug:          srcRepo.Slug,
		Name:          srcRepo.Name,
		Description:   fmt.Sprintf("Fork of %s/%s", srcWS.Slug, srcRepo.Slug),
		IsPrivate:     srcRepo.IsPrivate,
		DefaultBranch: srcRepo.DefaultBranch,
		Language:      srcRepo.Language,
		ForkedFromID:  &srcRepo.ID,
		HasIssues:     true,
		HasWiki:       false,
		HasPipelines:  false,
		CreatedAt:     now,
		UpdatedAt:     now,
		WorkspaceSlug: targetWS.Slug,
	}

	if err := s.repos.Create(ctx, forked); err != nil {
		return nil, fmt.Errorf("repo: persist fork: %w", err)
	}

	srcPath := s.diskPath(srcWS.Slug, srcRepo.Slug)
	destPath := s.diskPath(targetWS.Slug, forked.Slug)
	if err := s.gitSvc.ForkRepository(ctx, srcPath, destPath); err != nil {
		_ = s.repos.Delete(ctx, forked.ID)
		return nil, fmt.Errorf("repo: fork on disk: %w", err)
	}

	// Grant admin to the forking user.
	perm := &models.RepositoryPermission{
		ID:         uuid.New(),
		RepoID:     forked.ID,
		UserID:     userID,
		Permission: models.RepoPermAdmin,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.perms.Create(ctx, perm); err != nil {
		s.logger.Warn("failed to create fork owner permission", "repo_id", forked.ID, "error", err)
	}

	s.logger.Info("repository forked", "src", repoID, "dest", forked.ID)
	return forked, nil
}

// BrowseSource returns the tree or file content at the given ref and path.
func (s *RepoService) BrowseSource(ctx context.Context, repoID uuid.UUID, ref, path string) (any, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("repo: %w: repository", ErrNotFound)
	}

	ws, err := s.workspaces.GetByID(ctx, repo.WorkspaceID)
	if err != nil || ws == nil {
		return nil, fmt.Errorf("repo: %w: workspace", ErrNotFound)
	}

	if ref == "" {
		ref = repo.DefaultBranch
	}

	diskPath := s.diskPath(ws.Slug, repo.Slug)

	// Try as directory first.
	entries, err := s.gitSvc.GetTree(ctx, diskPath, ref, path)
	if err == nil {
		return entries, nil
	}

	// Fall back to file.
	content, err := s.gitSvc.GetFileContent(ctx, diskPath, ref, path)
	if err != nil {
		return nil, fmt.Errorf("repo: browse source: %w", err)
	}
	return content, nil
}

// GetCommitHistory returns paginated commits for a branch.
func (s *RepoService) GetCommitHistory(ctx context.Context, repoID uuid.UUID, branch string, page, limit int) ([]CommitInfo, int, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, 0, fmt.Errorf("repo: %w: repository", ErrNotFound)
	}

	ws, err := s.workspaces.GetByID(ctx, repo.WorkspaceID)
	if err != nil || ws == nil {
		return nil, 0, fmt.Errorf("repo: %w: workspace", ErrNotFound)
	}

	if branch == "" {
		branch = repo.DefaultBranch
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 30
	}

	diskPath := s.diskPath(ws.Slug, repo.Slug)
	return s.gitSvc.ListCommits(ctx, diskPath, branch, page, limit)
}

// diskPath computes the on-disk path for a repository.
func (s *RepoService) diskPath(workspaceSlug, repoSlug string) string {
	return filepath.Join(s.basePath, workspaceSlug, repoSlug+".git")
}

// toSlug converts a name to a URL-safe slug.
func toSlug(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = strings.ReplaceAll(s, " ", "-")
	s = slugRe.ReplaceAllString(s, "")
	return s
}
