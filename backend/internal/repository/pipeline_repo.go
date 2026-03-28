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

// PipelineRepository provides data access for pipeline configurations, runs, and steps.
type PipelineRepository struct {
	pool *pgxpool.Pool
}

func NewPipelineRepository(pool *pgxpool.Pool) *PipelineRepository {
	return &PipelineRepository{pool: pool}
}

// ---------- Config ----------

const pipelineConfigColumns = `id, repo_id, is_enabled, yaml_path, created_at, updated_at`

func (r *PipelineRepository) CreateConfig(ctx context.Context, c *models.PipelineConfig) error {
	c.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO pipeline_configs (id, repo_id, is_enabled, yaml_path)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+pipelineConfigColumns,
		c.ID, c.RepoID, c.IsEnabled, c.YAMLPath,
	).Scan(c.ScanFields()...)
}

func (r *PipelineRepository) GetConfig(ctx context.Context, repoID uuid.UUID) (*models.PipelineConfig, error) {
	c := &models.PipelineConfig{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+pipelineConfigColumns+` FROM pipeline_configs WHERE repo_id = $1`, repoID,
	).Scan(c.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("pipeline config not found: %w", err)
	}
	return c, err
}

func (r *PipelineRepository) UpdateConfig(ctx context.Context, c *models.PipelineConfig) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pipeline_configs SET is_enabled=$2, yaml_path=$3, updated_at=NOW()
		 WHERE id=$1`,
		c.ID, c.IsEnabled, c.YAMLPath,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pipeline config not found")
	}
	return nil
}

// ---------- Runs ----------

const pipelineRunColumns = `id, repo_id, number, commit_sha, branch, status,
	trigger_type, triggered_by_id, duration_secs, started_at, completed_at, created_at`

func (r *PipelineRepository) NextRunNumber(ctx context.Context, repoID uuid.UUID) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0) + 1 FROM pipeline_runs WHERE repo_id = $1`, repoID,
	).Scan(&n)
	return n, err
}

func (r *PipelineRepository) CreateRun(ctx context.Context, run *models.PipelineRun) error {
	run.ID = uuid.New()
	num, err := r.NextRunNumber(ctx, run.RepoID)
	if err != nil {
		return err
	}
	run.Number = num
	return r.pool.QueryRow(ctx,
		`INSERT INTO pipeline_runs (id, repo_id, number, commit_sha, branch, status,
		 trigger_type, triggered_by_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING `+pipelineRunColumns,
		run.ID, run.RepoID, run.Number, run.CommitSHA, run.Branch,
		run.Status, run.TriggerType, run.TriggeredByID,
	).Scan(run.ScanFields()...)
}

func (r *PipelineRepository) GetRun(ctx context.Context, id uuid.UUID) (*models.PipelineRun, error) {
	run := &models.PipelineRun{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+pipelineRunColumns+` FROM pipeline_runs WHERE id = $1`, id,
	).Scan(run.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("pipeline run not found: %w", err)
	}
	return run, err
}

func (r *PipelineRepository) UpdateRun(ctx context.Context, run *models.PipelineRun) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pipeline_runs SET status=$2, duration_secs=$3, started_at=$4, completed_at=$5
		 WHERE id=$1`,
		run.ID, run.Status, run.DurationSecs, run.StartedAt, run.CompletedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pipeline run not found")
	}
	return nil
}

func (r *PipelineRepository) ListRuns(ctx context.Context, repoID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.PipelineRun], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM pipeline_runs WHERE repo_id = $1`, repoID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+pipelineRunColumns+` FROM pipeline_runs
		 WHERE repo_id = $1
		 ORDER BY number DESC
		 LIMIT $2 OFFSET $3`,
		repoID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PipelineRun
	for rows.Next() {
		var run models.PipelineRun
		if err := rows.Scan(run.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, run)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.PipelineRun]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Steps ----------

const pipelineStepColumns = `id, run_id, name, image, status, exit_code,
	log_url, duration_secs, sort_order, started_at, completed_at, created_at`

func (r *PipelineRepository) CreateStep(ctx context.Context, s *models.PipelineStep) error {
	s.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO pipeline_steps (id, run_id, name, image, status, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING `+pipelineStepColumns,
		s.ID, s.RunID, s.Name, s.Image, s.Status, s.SortOrder,
	).Scan(s.ScanFields()...)
}

func (r *PipelineRepository) UpdateStep(ctx context.Context, s *models.PipelineStep) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE pipeline_steps SET status=$2, exit_code=$3, log_url=$4,
		 duration_secs=$5, started_at=$6, completed_at=$7
		 WHERE id=$1`,
		s.ID, s.Status, s.ExitCode, s.LogURL,
		s.DurationSecs, s.StartedAt, s.CompletedAt,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("pipeline step not found")
	}
	return nil
}

func (r *PipelineRepository) ListSteps(ctx context.Context, runID uuid.UUID) ([]models.PipelineStep, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+pipelineStepColumns+` FROM pipeline_steps
		 WHERE run_id = $1 ORDER BY sort_order ASC`,
		runID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.PipelineStep
	for rows.Next() {
		var s models.PipelineStep
		if err := rows.Scan(s.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, rows.Err()
}
