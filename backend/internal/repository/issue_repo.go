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

// IssueRepository provides data access for issues and related entities.
type IssueRepository struct {
	pool *pgxpool.Pool
}

func NewIssueRepository(pool *pgxpool.Pool) *IssueRepository {
	return &IssueRepository{pool: pool}
}

const issueColumns = `id, repo_id, number, title, content, state, priority, kind,
	author_id, assignee_id, vote_count, created_at, updated_at`

// NextNumber returns the next issue number for the given repo.
func (r *IssueRepository) NextNumber(ctx context.Context, repoID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0) + 1 FROM issues WHERE repo_id = $1`, repoID,
	).Scan(&n)
	return n, err
}

func (r *IssueRepository) Create(ctx context.Context, i *models.Issue) error {
	i.ID = uuid.New()
	num, err := r.NextNumber(ctx, i.RepoID)
	if err != nil {
		return err
	}
	i.Number = num
	return r.pool.QueryRow(ctx,
		`INSERT INTO issues (id, repo_id, number, title, content, state, priority, kind, author_id, assignee_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING `+issueColumns,
		i.ID, i.RepoID, i.Number, i.Title, i.Content,
		i.State, i.Priority, i.Kind, i.AuthorID, i.AssigneeID,
	).Scan(i.ScanFields()...)
}

func (r *IssueRepository) GetByNumber(ctx context.Context, repoID uuid.UUID, number int) (*models.Issue, error) {
	i := &models.Issue{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+issueColumns+` FROM issues WHERE repo_id = $1 AND number = $2`,
		repoID, number,
	).Scan(i.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("issue not found: %w", err)
	}
	return i, err
}

func (r *IssueRepository) Update(ctx context.Context, i *models.Issue) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE issues SET title=$2, content=$3, state=$4, priority=$5, kind=$6,
		 assignee_id=$7, vote_count=$8, updated_at=NOW()
		 WHERE id=$1`,
		i.ID, i.Title, i.Content, i.State, i.Priority, i.Kind,
		i.AssigneeID, i.VoteCount,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("issue not found")
	}
	return nil
}

func (r *IssueRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM issues WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("issue not found")
	}
	return nil
}

// IssueListFilter holds optional filters for listing issues.
type IssueListFilter struct {
	State      *models.IssueState
	Priority   *models.IssuePriority
	Kind       *models.IssueKind
	AssigneeID *uuid.UUID
}

func (r *IssueRepository) ListByRepo(ctx context.Context, repoID uuid.UUID, filter IssueListFilter, pg models.Pagination) (*models.PaginatedResult[models.Issue], error) {
	baseWhere := `WHERE repo_id = $1`
	args := []any{repoID}
	argIdx := 2

	if filter.State != nil {
		baseWhere += fmt.Sprintf(` AND state = $%d`, argIdx)
		args = append(args, *filter.State)
		argIdx++
	}
	if filter.Priority != nil {
		baseWhere += fmt.Sprintf(` AND priority = $%d`, argIdx)
		args = append(args, *filter.Priority)
		argIdx++
	}
	if filter.Kind != nil {
		baseWhere += fmt.Sprintf(` AND kind = $%d`, argIdx)
		args = append(args, *filter.Kind)
		argIdx++
	}
	if filter.AssigneeID != nil {
		baseWhere += fmt.Sprintf(` AND assignee_id = $%d`, argIdx)
		args = append(args, *filter.AssigneeID)
		argIdx++
	}

	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM issues `+baseWhere, args...,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(
		`SELECT `+issueColumns+` FROM issues %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		baseWhere, argIdx, argIdx+1,
	)
	args = append(args, pg.Limit(), pg.Offset())

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Issue
	for rows.Next() {
		var i models.Issue
		if err := rows.Scan(i.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Issue]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Comments ----------

const issueCommentColumns = `id, issue_id, author_id, content, created_at, updated_at`

func (r *IssueRepository) CreateComment(ctx context.Context, c *models.IssueComment) error {
	c.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO issue_comments (id, issue_id, author_id, content)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+issueCommentColumns,
		c.ID, c.IssueID, c.AuthorID, c.Content,
	).Scan(c.ScanFields()...)
}

func (r *IssueRepository) ListComments(ctx context.Context, issueID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.IssueComment], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM issue_comments WHERE issue_id = $1`, issueID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT c.`+issueCommentColumns+`, u.username
		 FROM issue_comments c JOIN users u ON u.id = c.author_id
		 WHERE c.issue_id = $1
		 ORDER BY c.created_at ASC
		 LIMIT $2 OFFSET $3`,
		issueID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.IssueComment
	for rows.Next() {
		var c models.IssueComment
		if err := rows.Scan(
			&c.ID, &c.IssueID, &c.AuthorID, &c.Content,
			&c.CreatedAt, &c.UpdatedAt, &c.AuthorUsername,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.IssueComment]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Labels ----------

const labelColumns = `id, repo_id, name, color, created_at`

func (r *IssueRepository) CreateLabel(ctx context.Context, l *models.IssueLabel) error {
	l.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO issue_labels (id, repo_id, name, color)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+labelColumns,
		l.ID, l.RepoID, l.Name, l.Color,
	).Scan(l.ScanFields()...)
}

func (r *IssueRepository) ListLabels(ctx context.Context, repoID uuid.UUID) ([]models.IssueLabel, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+labelColumns+` FROM issue_labels WHERE repo_id = $1 ORDER BY name ASC`,
		repoID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.IssueLabel
	for rows.Next() {
		var l models.IssueLabel
		if err := rows.Scan(l.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, l)
	}
	return items, rows.Err()
}

func (r *IssueRepository) AssignLabel(ctx context.Context, a *models.IssueLabelAssignment) error {
	a.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO issue_label_assignments (id, issue_id, label_id)
		 VALUES ($1,$2,$3)
		 ON CONFLICT (issue_id, label_id) DO NOTHING
		 RETURNING id, issue_id, label_id, created_at`,
		a.ID, a.IssueID, a.LabelID,
	).Scan(a.ScanFields()...)
}

func (r *IssueRepository) RemoveLabel(ctx context.Context, issueID, labelID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM issue_label_assignments WHERE issue_id = $1 AND label_id = $2`,
		issueID, labelID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("label assignment not found")
	}
	return nil
}
