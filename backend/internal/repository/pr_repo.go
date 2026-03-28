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

// PRRepository provides data access for pull requests and related entities.
type PRRepository struct {
	pool *pgxpool.Pool
}

func NewPRRepository(pool *pgxpool.Pool) *PRRepository {
	return &PRRepository{pool: pool}
}

const prColumns = `id, repo_id, number, title, description, state,
	source_branch, destination_branch, author_id, merged_by,
	merge_commit_sha, close_source_branch, created_at, updated_at, closed_at`

// NextNumber returns the next PR number for the given repo (max + 1).
func (r *PRRepository) NextNumber(ctx context.Context, repoID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0) + 1 FROM pull_requests WHERE repo_id = $1`, repoID,
	).Scan(&n)
	return n, err
}

func (r *PRRepository) Create(ctx context.Context, pr *models.PullRequest) error {
	pr.ID = uuid.New()
	num, err := r.NextNumber(ctx, pr.RepoID)
	if err != nil {
		return err
	}
	pr.Number = num
	return r.pool.QueryRow(ctx,
		`INSERT INTO pull_requests (id, repo_id, number, title, description, state,
		 source_branch, destination_branch, author_id, close_source_branch)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING `+prColumns,
		pr.ID, pr.RepoID, pr.Number, pr.Title, pr.Description, pr.State,
		pr.SourceBranch, pr.DestinationBranch, pr.AuthorID, pr.CloseSourceBranch,
	).Scan(pr.ScanFields()...)
}

func (r *PRRepository) GetByNumber(ctx context.Context, repoID uuid.UUID, number int) (*models.PullRequest, error) {
	pr := &models.PullRequest{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+prColumns+` FROM pull_requests WHERE repo_id = $1 AND number = $2`,
		repoID, number,
	).Scan(pr.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("pull request not found: %w", err)
	}
	return pr, err
}

func (r *PRRepository) Update(ctx context.Context, pr *models.PullRequest) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pull_requests SET title=$2, description=$3, state=$4,
		 merged_by=$5, merge_commit_sha=$6, close_source_branch=$7,
		 closed_at=$8, updated_at=NOW()
		 WHERE id=$1`,
		pr.ID, pr.Title, pr.Description, pr.State,
		pr.MergedBy, pr.MergeCommitSHA, pr.CloseSourceBranch, pr.ClosedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pull request not found")
	}
	return nil
}

// PRListFilter holds optional filters for listing pull requests.
type PRListFilter struct {
	State    *models.PRState
	AuthorID *uuid.UUID
}

func (r *PRRepository) ListByRepo(ctx context.Context, repoID uuid.UUID, filter PRListFilter, pg models.Pagination) (*models.PaginatedResult[models.PullRequest], error) {
	baseWhere := `WHERE repo_id = $1`
	args := []any{repoID}
	argIdx := 2

	if filter.State != nil {
		baseWhere += fmt.Sprintf(` AND state = $%d`, argIdx)
		args = append(args, *filter.State)
		argIdx++
	}
	if filter.AuthorID != nil {
		baseWhere += fmt.Sprintf(` AND author_id = $%d`, argIdx)
		args = append(args, *filter.AuthorID)
		argIdx++
	}

	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM pull_requests `+baseWhere, args...,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(
		`SELECT `+prColumns+` FROM pull_requests %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		baseWhere, argIdx, argIdx+1,
	)
	args = append(args, pg.Limit(), pg.Offset())

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PullRequest
	for rows.Next() {
		var pr models.PullRequest
		if err := rows.Scan(pr.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, pr)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.PullRequest]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Reviewers ----------

const reviewerColumns = `id, pr_id, user_id, status, created_at, updated_at`

func (r *PRRepository) AddReviewer(ctx context.Context, rv *models.PRReviewer) error {
	rv.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO pr_reviewers (id, pr_id, user_id, status)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+reviewerColumns,
		rv.ID, rv.PRID, rv.UserID, rv.Status,
	).Scan(rv.ScanFields()...)
}

func (r *PRRepository) UpdateReviewerStatus(ctx context.Context, prID, userID uuid.UUID, status models.PRReviewStatus) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pr_reviewers SET status=$3, updated_at=NOW() WHERE pr_id=$1 AND user_id=$2`,
		prID, userID, status,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("reviewer not found")
	}
	return nil
}

func (r *PRRepository) ListReviewers(ctx context.Context, prID uuid.UUID) ([]models.PRReviewer, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT rv.`+reviewerColumns+`, u.username
		 FROM pr_reviewers rv JOIN users u ON u.id = rv.user_id
		 WHERE rv.pr_id = $1 ORDER BY rv.created_at ASC`,
		prID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PRReviewer
	for rows.Next() {
		var rv models.PRReviewer
		if err := rows.Scan(
			&rv.ID, &rv.PRID, &rv.UserID, &rv.Status,
			&rv.CreatedAt, &rv.UpdatedAt, &rv.Username,
		); err != nil {
			return nil, err
		}
		items = append(items, rv)
	}
	return items, rows.Err()
}

// ---------- Comments ----------

const prCommentColumns = `id, pr_id, author_id, parent_id, content, is_ai,
	file_path, line_from, line_to, is_resolved, created_at, updated_at, deleted_at`

func (r *PRRepository) CreateComment(ctx context.Context, c *models.PRComment) error {
	c.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO pr_comments (id, pr_id, author_id, parent_id, content, is_ai,
		 file_path, line_from, line_to)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING `+prCommentColumns,
		c.ID, c.PRID, c.AuthorID, c.ParentID, c.Content, c.IsAI,
		c.FilePath, c.LineFrom, c.LineTo,
	).Scan(c.ScanFields()...)
}

func (r *PRRepository) ListComments(ctx context.Context, prID uuid.UUID) ([]models.PRComment, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT c.`+prCommentColumns+`, u.username
		 FROM pr_comments c JOIN users u ON u.id = c.author_id
		 WHERE c.pr_id = $1 AND c.deleted_at IS NULL
		 ORDER BY c.created_at ASC`,
		prID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PRComment
	for rows.Next() {
		var c models.PRComment
		if err := rows.Scan(
			&c.ID, &c.PRID, &c.AuthorID, &c.ParentID, &c.Content,
			&c.IsAI, &c.FilePath, &c.LineFrom, &c.LineTo, &c.IsResolved,
			&c.CreatedAt, &c.UpdatedAt, &c.DeletedAt, &c.AuthorUsername,
		); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (r *PRRepository) UpdateComment(ctx context.Context, id uuid.UUID, content string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pr_comments SET content=$2, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`,
		id, content,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

func (r *PRRepository) DeleteComment(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pr_comments SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

func (r *PRRepository) ResolveComment(ctx context.Context, id uuid.UUID, resolved bool) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pr_comments SET is_resolved=$2, updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`,
		id, resolved,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

// ---------- Activity ----------

const prActivityColumns = `id, pr_id, user_id, kind, content, created_at`

func (r *PRRepository) CreateActivity(ctx context.Context, a *models.PRActivity) error {
	a.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO pr_activities (id, pr_id, user_id, kind, content)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+prActivityColumns,
		a.ID, a.PRID, a.UserID, a.Kind, a.Content,
	).Scan(a.ScanFields()...)
}

func (r *PRRepository) ListActivity(ctx context.Context, prID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.PRActivity], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM pr_activities WHERE pr_id = $1`, prID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT a.`+prActivityColumns+`, u.username
		 FROM pr_activities a JOIN users u ON u.id = a.user_id
		 WHERE a.pr_id = $1
		 ORDER BY a.created_at ASC
		 LIMIT $2 OFFSET $3`,
		prID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PRActivity
	for rows.Next() {
		var a models.PRActivity
		if err := rows.Scan(
			&a.ID, &a.PRID, &a.UserID, &a.Kind,
			&a.Content, &a.CreatedAt, &a.Username,
		); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.PRActivity]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}
