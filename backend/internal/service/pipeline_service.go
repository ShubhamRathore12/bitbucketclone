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

// PipelineRunStatus enumerates possible pipeline run states.
type PipelineRunStatus string

const (
	PipelineStatusPending    PipelineRunStatus = "pending"
	PipelineStatusRunning    PipelineRunStatus = "running"
	PipelineStatusSuccessful PipelineRunStatus = "successful"
	PipelineStatusFailed     PipelineRunStatus = "failed"
	PipelineStatusStopped    PipelineRunStatus = "stopped"
)

// PipelineTriggerType identifies what triggered a pipeline run.
type PipelineTriggerType string

const (
	TriggerPush        PipelineTriggerType = "push"
	TriggerPR          PipelineTriggerType = "pull_request"
	TriggerManual      PipelineTriggerType = "manual"
	TriggerScheduled   PipelineTriggerType = "scheduled"
)

// PipelineStepStatus enumerates step states.
type PipelineStepStatus string

const (
	StepPending    PipelineStepStatus = "pending"
	StepRunning    PipelineStepStatus = "running"
	StepSuccessful PipelineStepStatus = "successful"
	StepFailed     PipelineStepStatus = "failed"
	StepSkipped    PipelineStepStatus = "skipped"
)

// PipelineConfig stores the pipeline configuration for a repository.
type PipelineConfig struct {
	ID        uuid.UUID `json:"id"`
	RepoID    uuid.UUID `json:"repo_id"`
	Enabled   bool      `json:"enabled"`
	YAMLContent string  `json:"yaml_content"` // the bitbucket-pipelines.yml content
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PipelineRun represents a single pipeline execution.
type PipelineRun struct {
	ID            uuid.UUID           `json:"id"`
	RepoID        uuid.UUID           `json:"repo_id"`
	Number        int                 `json:"number"`
	Status        PipelineRunStatus   `json:"status"`
	TriggerType   PipelineTriggerType `json:"trigger_type"`
	Branch        string              `json:"branch"`
	CommitHash    string              `json:"commit_hash"`
	CommitMessage string              `json:"commit_message,omitempty"`
	TriggeredBy   uuid.UUID           `json:"triggered_by"`
	DurationSecs  int                 `json:"duration_secs,omitempty"`
	Steps         []PipelineStep      `json:"steps,omitempty"`
	CreatedAt     time.Time           `json:"created_at"`
	StartedAt     *time.Time          `json:"started_at,omitempty"`
	CompletedAt   *time.Time          `json:"completed_at,omitempty"`
}

// PipelineStep is a single step within a pipeline run.
type PipelineStep struct {
	ID           uuid.UUID          `json:"id"`
	RunID        uuid.UUID          `json:"run_id"`
	Name         string             `json:"name"`
	Image        string             `json:"image,omitempty"`
	Status       PipelineStepStatus `json:"status"`
	ExitCode     *int               `json:"exit_code,omitempty"`
	DurationSecs int                `json:"duration_secs,omitempty"`
	LogURL       string             `json:"log_url,omitempty"`
	StartedAt    *time.Time         `json:"started_at,omitempty"`
	CompletedAt  *time.Time         `json:"completed_at,omitempty"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// PipelineRepository abstracts persistence for pipeline configurations and runs.
type PipelineRepository interface {
	GetConfig(ctx context.Context, repoID uuid.UUID) (*PipelineConfig, error)
	UpsertConfig(ctx context.Context, cfg *PipelineConfig) error

	CreateRun(ctx context.Context, run *PipelineRun) error
	GetRun(ctx context.Context, id uuid.UUID) (*PipelineRun, error)
	GetRunByNumber(ctx context.Context, repoID uuid.UUID, number int) (*PipelineRun, error)
	UpdateRun(ctx context.Context, run *PipelineRun) error
	ListRuns(ctx context.Context, repoID uuid.UUID, page, limit int) ([]*PipelineRun, int, error)
	NextRunNumber(ctx context.Context, repoID uuid.UUID) (int, error)

	CreateStep(ctx context.Context, step *PipelineStep) error
	UpdateStep(ctx context.Context, step *PipelineStep) error
	ListSteps(ctx context.Context, runID uuid.UUID) ([]PipelineStep, error)
	GetStepLog(ctx context.Context, stepID uuid.UUID) (string, error)
	SaveStepLog(ctx context.Context, stepID uuid.UUID, log string) error
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// PipelineRunListResult wraps a page of pipeline runs.
type PipelineRunListResult struct {
	Runs  []*PipelineRun `json:"runs"`
	Total int            `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// PipelineService implements CI/CD pipeline business logic.
type PipelineService struct {
	pipelines PipelineRepository
	repos     RepoRepository
	logger    *slog.Logger
}

// NewPipelineService constructs a PipelineService.
func NewPipelineService(
	pipelines PipelineRepository,
	repos RepoRepository,
	logger *slog.Logger,
) *PipelineService {
	return &PipelineService{
		pipelines: pipelines,
		repos:     repos,
		logger:    logger.With("service", "pipeline"),
	}
}

// GetConfig returns the pipeline configuration for a repository.
func (s *PipelineService) GetConfig(ctx context.Context, repoID uuid.UUID) (*PipelineConfig, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pipeline: %w: repository", ErrNotFound)
	}
	if !repo.HasPipelines {
		return nil, fmt.Errorf("pipeline: %w: pipelines are disabled for this repository", ErrForbidden)
	}

	cfg, err := s.pipelines.GetConfig(ctx, repoID)
	if err != nil {
		return nil, fmt.Errorf("pipeline: get config: %w", err)
	}
	if cfg == nil {
		// Return a default empty config.
		return &PipelineConfig{
			RepoID:  repoID,
			Enabled: false,
		}, nil
	}

	return cfg, nil
}

// UpdateConfig creates or updates the pipeline configuration.
func (s *PipelineService) UpdateConfig(ctx context.Context, repoID uuid.UUID, enabled bool, yamlContent string) (*PipelineConfig, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pipeline: %w: repository", ErrNotFound)
	}

	now := time.Now().UTC()
	cfg := &PipelineConfig{
		ID:          uuid.New(),
		RepoID:      repoID,
		Enabled:     enabled,
		YAMLContent: yamlContent,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.pipelines.UpsertConfig(ctx, cfg); err != nil {
		return nil, fmt.Errorf("pipeline: update config: %w", err)
	}

	s.logger.Info("pipeline config updated", "repo_id", repoID, "enabled", enabled)
	return cfg, nil
}

// TriggerRun creates and starts a new pipeline run.
func (s *PipelineService) TriggerRun(
	ctx context.Context,
	repoID uuid.UUID,
	triggerType PipelineTriggerType,
	branch, commitHash string,
	userID uuid.UUID,
) (*PipelineRun, error) {
	repo, err := s.repos.GetByID(ctx, repoID)
	if err != nil || repo == nil {
		return nil, fmt.Errorf("pipeline: %w: repository", ErrNotFound)
	}
	if !repo.HasPipelines {
		return nil, fmt.Errorf("pipeline: %w: pipelines are disabled", ErrForbidden)
	}

	cfg, err := s.pipelines.GetConfig(ctx, repoID)
	if err != nil || cfg == nil || !cfg.Enabled {
		return nil, fmt.Errorf("pipeline: %w: pipeline is not configured or not enabled", ErrValidation)
	}

	if branch == "" {
		return nil, fmt.Errorf("pipeline: %w: branch is required", ErrValidation)
	}
	if commitHash == "" {
		return nil, fmt.Errorf("pipeline: %w: commit hash is required", ErrValidation)
	}

	number, err := s.pipelines.NextRunNumber(ctx, repoID)
	if err != nil {
		return nil, fmt.Errorf("pipeline: next run number: %w", err)
	}

	now := time.Now().UTC()
	run := &PipelineRun{
		ID:          uuid.New(),
		RepoID:      repoID,
		Number:      number,
		Status:      PipelineStatusPending,
		TriggerType: triggerType,
		Branch:      branch,
		CommitHash:  commitHash,
		TriggeredBy: userID,
		CreatedAt:   now,
	}

	if err := s.pipelines.CreateRun(ctx, run); err != nil {
		return nil, fmt.Errorf("pipeline: create run: %w", err)
	}

	// Create default steps from YAML config (simplified: one build step).
	buildStep := &PipelineStep{
		ID:     uuid.New(),
		RunID:  run.ID,
		Name:   "build",
		Status: StepPending,
	}
	if err := s.pipelines.CreateStep(ctx, buildStep); err != nil {
		s.logger.Warn("failed to create build step", "error", err)
	} else {
		run.Steps = append(run.Steps, *buildStep)
	}

	s.logger.Info("pipeline run triggered",
		"repo_id", repoID, "run_number", number,
		"trigger", triggerType, "branch", branch,
	)
	return run, nil
}

// GetRun returns a single pipeline run with its steps.
func (s *PipelineService) GetRun(ctx context.Context, repoID uuid.UUID, runNumber int) (*PipelineRun, error) {
	run, err := s.pipelines.GetRunByNumber(ctx, repoID, runNumber)
	if err != nil || run == nil {
		return nil, fmt.Errorf("pipeline: %w: run #%d", ErrNotFound, runNumber)
	}

	steps, err := s.pipelines.ListSteps(ctx, run.ID)
	if err != nil {
		s.logger.Warn("failed to load pipeline steps", "run_id", run.ID, "error", err)
	} else {
		run.Steps = steps
	}

	return run, nil
}

// ListRuns returns a paginated list of pipeline runs.
func (s *PipelineService) ListRuns(ctx context.Context, repoID uuid.UUID, page, limit int) (*PipelineRunListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	runs, total, err := s.pipelines.ListRuns(ctx, repoID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("pipeline: list runs: %w", err)
	}

	return &PipelineRunListResult{
		Runs:  runs,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// StopRun stops a running pipeline.
func (s *PipelineService) StopRun(ctx context.Context, repoID uuid.UUID, runNumber int) (*PipelineRun, error) {
	run, err := s.pipelines.GetRunByNumber(ctx, repoID, runNumber)
	if err != nil || run == nil {
		return nil, fmt.Errorf("pipeline: %w: run #%d", ErrNotFound, runNumber)
	}

	if run.Status != PipelineStatusPending && run.Status != PipelineStatusRunning {
		return nil, fmt.Errorf("pipeline: %w: run is not active", ErrValidation)
	}

	now := time.Now().UTC()
	run.Status = PipelineStatusStopped
	run.CompletedAt = &now
	if run.StartedAt != nil {
		run.DurationSecs = int(now.Sub(*run.StartedAt).Seconds())
	}

	if err := s.pipelines.UpdateRun(ctx, run); err != nil {
		return nil, fmt.Errorf("pipeline: stop run: %w", err)
	}

	// Stop any running steps.
	steps, err := s.pipelines.ListSteps(ctx, run.ID)
	if err == nil {
		for i := range steps {
			if steps[i].Status == StepRunning || steps[i].Status == StepPending {
				steps[i].Status = StepSkipped
				steps[i].CompletedAt = &now
				if err := s.pipelines.UpdateStep(ctx, &steps[i]); err != nil {
					s.logger.Warn("failed to stop step", "step_id", steps[i].ID, "error", err)
				}
			}
		}
		run.Steps = steps
	}

	s.logger.Info("pipeline run stopped", "repo_id", repoID, "run_number", runNumber)
	return run, nil
}

// UpdateStepStatus updates the status of a pipeline step.
func (s *PipelineService) UpdateStepStatus(
	ctx context.Context,
	stepID uuid.UUID,
	status PipelineStepStatus,
	exitCode *int,
) (*PipelineStep, error) {
	// We need to fetch the step via its run. For simplicity, we look up the run
	// by iterating through the step's run. The repository handles the lookup.
	run, err := s.findRunByStepID(ctx, stepID)
	if err != nil {
		return nil, err
	}

	var step *PipelineStep
	for i := range run.Steps {
		if run.Steps[i].ID == stepID {
			step = &run.Steps[i]
			break
		}
	}
	if step == nil {
		return nil, fmt.Errorf("pipeline: %w: step", ErrNotFound)
	}

	now := time.Now().UTC()
	step.Status = status
	step.ExitCode = exitCode

	switch status {
	case StepRunning:
		step.StartedAt = &now
	case StepSuccessful, StepFailed, StepSkipped:
		step.CompletedAt = &now
		if step.StartedAt != nil {
			step.DurationSecs = int(now.Sub(*step.StartedAt).Seconds())
		}
	}

	if err := s.pipelines.UpdateStep(ctx, step); err != nil {
		return nil, fmt.Errorf("pipeline: update step: %w", err)
	}

	// Check if all steps are complete; if so, update the run status.
	s.maybeCompleteRun(ctx, run)

	s.logger.Info("step status updated", "step_id", stepID, "status", status)
	return step, nil
}

// GetStepLog returns the log output for a pipeline step.
func (s *PipelineService) GetStepLog(ctx context.Context, stepID uuid.UUID) (string, error) {
	log, err := s.pipelines.GetStepLog(ctx, stepID)
	if err != nil {
		return "", fmt.Errorf("pipeline: get step log: %w", err)
	}
	return log, nil
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

func (s *PipelineService) findRunByStepID(ctx context.Context, stepID uuid.UUID) (*PipelineRun, error) {
	// The repository layer should ideally have a GetRunByStepID. For now we
	// rely on the step storing its run_id and the repository layer being
	// able to fetch by run ID.
	// This is a simplification; a real implementation would have a direct lookup.
	_ = ctx
	_ = stepID
	return nil, fmt.Errorf("pipeline: %w: step lookup not implemented - requires GetRunByStepID in repository", ErrInternal)
}

func (s *PipelineService) maybeCompleteRun(ctx context.Context, run *PipelineRun) {
	steps, err := s.pipelines.ListSteps(ctx, run.ID)
	if err != nil {
		return
	}

	allDone := true
	hasFailed := false
	for _, step := range steps {
		switch step.Status {
		case StepPending, StepRunning:
			allDone = false
		case StepFailed:
			hasFailed = true
		}
	}

	if !allDone {
		return
	}

	now := time.Now().UTC()
	if hasFailed {
		run.Status = PipelineStatusFailed
	} else {
		run.Status = PipelineStatusSuccessful
	}
	run.CompletedAt = &now
	if run.StartedAt != nil {
		run.DurationSecs = int(now.Sub(*run.StartedAt).Seconds())
	}

	if err := s.pipelines.UpdateRun(ctx, run); err != nil {
		s.logger.Warn("failed to complete run", "run_id", run.ID, "error", err)
	}
}
