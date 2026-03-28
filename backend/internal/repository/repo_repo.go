package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gitforge/backend/internal/models"
)

// RepoRepository provides data access for repositories and their permissions.
type RepoRepository struct {
	pool *pgxpool.Pool
}

func NewRepoRepository(pool *pgxpool.Pool) *RepoRepository {
	return &RepoRepository{pool: pool}
}

const repoColumns = `id, workspace_id, slug, name, description, is_private,
	default_branch, language, forked_from_id, has_issues, has_wiki,
	has_pipelines, size, created_at, updated_at`

func (r *RepoRepository) Create(ctx context.Context, repo *models.Repository) error {
	repo.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO repositories (id, workspace_id, slug, name, description, is_private,
		 default_branch, language, forked_from_id, has_issues, has_wiki, has_pipelines, size)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING `+repoColumns,
		repo.ID, repo.WorkspaceID, repo.Slug, repo.Name, repo.Description,
		repo.IsPrivate, repo.DefaultBranch, repo.Language, repo.ForkedFromID,
		repo.HasIssues, repo.HasWiki, repo.HasPipelines, repo.Size,
	).Scan(repo.ScanFields()...)
}

func (r *RepoRepository) GetBySlugPair(ctx context.Context, workspaceSlug, repoSlug string) (*models.Repository, error) {
	repo := &models.Repository{}
	err := r.pool.QueryRow(ctx,
		`SELECT r.`+repoColumns+`
		 FROM repositories r
		 JOIN workspaces w ON w.id = r.workspace_id
		 WHERE w.slug = $1 AND r.slug = $2`,
		workspaceSlug, repoSlug,
	).Scan(repo.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("repository not found: %w", err)
	}
	if err == nil {
		repo.WorkspaceSlug = workspaceSlug
	}
	return repo, err
}

func (r *RepoRepository) Update(ctx context.Context, repo *models.Repository) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE repositories SET slug=$2, name=$3, description=$4, is_private=$5,
		 default_branch=$6, language=$7, has_issues=$8, has_wiki=$9,
		 has_pipelines=$10, size=$11, updated_at=NOW()
		 WHERE id=$1`,
		repo.ID, repo.Slug, repo.Name, repo.Description, repo.IsPrivate,
		repo.DefaultBranch, repo.Language, repo.HasIssues, repo.HasWiki,
		repo.HasPipelines, repo.Size,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository not found")
	}
	return nil
}

func (r *RepoRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM repositories WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository not found")
	}
	return nil
}

func (r *RepoRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.Repository], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM repositories WHERE workspace_id = $1`, workspaceID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+repoColumns+` FROM repositories
		 WHERE workspace_id = $1
		 ORDER BY name ASC
		 LIMIT $2 OFFSET $3`,
		workspaceID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Repository
	for rows.Next() {
		var repo models.Repository
		if err := rows.Scan(repo.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, repo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Repository]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// Fork creates a new repository record that references the source via ForkedFromID.
func (r *RepoRepository) Fork(ctx context.Context, sourceID uuid.UUID, fork *models.Repository) error {
	fork.ForkedFromID = &sourceID
	return r.Create(ctx, fork)
}

func (r *RepoRepository) ListForks(ctx context.Context, repoID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.Repository], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM repositories WHERE forked_from_id = $1`, repoID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+repoColumns+` FROM repositories
		 WHERE forked_from_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		repoID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Repository
	for rows.Next() {
		var repo models.Repository
		if err := rows.Scan(repo.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, repo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Repository]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Permissions ----------

const permColumns = `id, repo_id, user_id, permission, created_at, updated_at`

func (r *RepoRepository) SetPermission(ctx context.Context, p *models.RepositoryPermission) error {
	p.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO repository_permissions (id, repo_id, user_id, permission)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (repo_id, user_id) DO UPDATE SET permission = EXCLUDED.permission, updated_at = NOW()
		 RETURNING `+permColumns,
		p.ID, p.RepoID, p.UserID, p.Permission,
	).Scan(p.ScanFields()...)
}

func (r *RepoRepository) GetPermissions(ctx context.Context, repoID uuid.UUID) ([]models.RepositoryPermission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+permColumns+` FROM repository_permissions WHERE repo_id = $1 ORDER BY created_at ASC`,
		repoID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []models.RepositoryPermission
	for rows.Next() {
		var p models.RepositoryPermission
		if err := rows.Scan(p.ScanFields()...); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, rows.Err()
}

func (r *RepoRepository) GetUserPermission(ctx context.Context, repoID, userID uuid.UUID) (*models.RepositoryPermission, error) {
	p := &models.RepositoryPermission{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+permColumns+` FROM repository_permissions WHERE repo_id = $1 AND user_id = $2`,
		repoID, userID,
	).Scan(p.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("permission not found: %w", err)
	}
	return p, err
}
