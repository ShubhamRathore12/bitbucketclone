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

// WikiRepository provides data access for wiki pages and their revisions.
type WikiRepository struct {
	pool *pgxpool.Pool
}

func NewWikiRepository(pool *pgxpool.Pool) *WikiRepository {
	return &WikiRepository{pool: pool}
}

const wikiPageColumns = `id, repo_id, slug, title, content, author_id, created_at, updated_at`

func (r *WikiRepository) Create(ctx context.Context, p *models.WikiPage) error {
	p.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO wiki_pages (id, repo_id, slug, title, content, author_id)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING `+wikiPageColumns,
		p.ID, p.RepoID, p.Slug, p.Title, p.Content, p.AuthorID,
	).Scan(p.ScanFields()...)
}

func (r *WikiRepository) GetBySlug(ctx context.Context, repoID uuid.UUID, slug string) (*models.WikiPage, error) {
	p := &models.WikiPage{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+wikiPageColumns+` FROM wiki_pages WHERE repo_id = $1 AND slug = $2`,
		repoID, slug,
	).Scan(p.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("wiki page not found: %w", err)
	}
	return p, err
}

func (r *WikiRepository) Update(ctx context.Context, p *models.WikiPage) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE wiki_pages SET slug=$2, title=$3, content=$4, updated_at=NOW()
		 WHERE id=$1`,
		p.ID, p.Slug, p.Title, p.Content,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("wiki page not found")
	}
	return nil
}

func (r *WikiRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM wiki_pages WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("wiki page not found")
	}
	return nil
}

func (r *WikiRepository) ListByRepo(ctx context.Context, repoID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.WikiPage], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM wiki_pages WHERE repo_id = $1`, repoID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+wikiPageColumns+` FROM wiki_pages
		 WHERE repo_id = $1
		 ORDER BY title ASC
		 LIMIT $2 OFFSET $3`,
		repoID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.WikiPage
	for rows.Next() {
		var p models.WikiPage
		if err := rows.Scan(p.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.WikiPage]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Revisions ----------

const wikiRevisionColumns = `id, page_id, content, message, author_id, created_at`

func (r *WikiRepository) CreateRevision(ctx context.Context, rev *models.WikiPageRevision) error {
	rev.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO wiki_page_revisions (id, page_id, content, message, author_id)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+wikiRevisionColumns,
		rev.ID, rev.PageID, rev.Content, rev.Message, rev.AuthorID,
	).Scan(rev.ScanFields()...)
}

func (r *WikiRepository) ListRevisions(ctx context.Context, pageID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.WikiPageRevision], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM wiki_page_revisions WHERE page_id = $1`, pageID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+wikiRevisionColumns+` FROM wiki_page_revisions
		 WHERE page_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		pageID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.WikiPageRevision
	for rows.Next() {
		var rev models.WikiPageRevision
		if err := rows.Scan(rev.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, rev)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.WikiPageRevision]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}
