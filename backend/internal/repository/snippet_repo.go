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

// SnippetRepository provides data access for snippets and snippet files.
type SnippetRepository struct {
	pool *pgxpool.Pool
}

func NewSnippetRepository(pool *pgxpool.Pool) *SnippetRepository {
	return &SnippetRepository{pool: pool}
}

const snippetColumns = `id, workspace_id, owner_id, title, description, is_private, created_at, updated_at`

func (r *SnippetRepository) Create(ctx context.Context, s *models.Snippet) error {
	s.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO snippets (id, workspace_id, owner_id, title, description, is_private)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING `+snippetColumns,
		s.ID, s.WorkspaceID, s.OwnerID, s.Title, s.Description, s.IsPrivate,
	).Scan(s.ScanFields()...)
}

func (r *SnippetRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Snippet, error) {
	s := &models.Snippet{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+snippetColumns+` FROM snippets WHERE id = $1`, id,
	).Scan(s.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("snippet not found: %w", err)
	}
	return s, err
}

func (r *SnippetRepository) Update(ctx context.Context, s *models.Snippet) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE snippets SET title=$2, description=$3, is_private=$4, updated_at=NOW()
		 WHERE id=$1`,
		s.ID, s.Title, s.Description, s.IsPrivate,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("snippet not found")
	}
	return nil
}

func (r *SnippetRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM snippets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("snippet not found")
	}
	return nil
}

func (r *SnippetRepository) ListByUser(ctx context.Context, ownerID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.Snippet], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM snippets WHERE owner_id = $1`, ownerID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+snippetColumns+` FROM snippets
		 WHERE owner_id = $1
		 ORDER BY updated_at DESC
		 LIMIT $2 OFFSET $3`,
		ownerID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Snippet
	for rows.Next() {
		var s models.Snippet
		if err := rows.Scan(s.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Snippet]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

func (r *SnippetRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.Snippet], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM snippets WHERE workspace_id = $1`, workspaceID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+snippetColumns+` FROM snippets
		 WHERE workspace_id = $1
		 ORDER BY updated_at DESC
		 LIMIT $2 OFFSET $3`,
		workspaceID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Snippet
	for rows.Next() {
		var s models.Snippet
		if err := rows.Scan(s.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Snippet]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Snippet Files ----------

const snippetFileColumns = `id, snippet_id, filename, content, language, sort_order, created_at, updated_at`

func (r *SnippetRepository) CreateFile(ctx context.Context, f *models.SnippetFile) error {
	f.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO snippet_files (id, snippet_id, filename, content, language, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING `+snippetFileColumns,
		f.ID, f.SnippetID, f.Filename, f.Content, f.Language, f.SortOrder,
	).Scan(f.ScanFields()...)
}

func (r *SnippetRepository) ListFiles(ctx context.Context, snippetID uuid.UUID) ([]models.SnippetFile, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+snippetFileColumns+` FROM snippet_files
		 WHERE snippet_id = $1 ORDER BY sort_order ASC`,
		snippetID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.SnippetFile
	for rows.Next() {
		var f models.SnippetFile
		if err := rows.Scan(f.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, f)
	}
	return items, rows.Err()
}
