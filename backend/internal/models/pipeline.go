package models

import (
	"time"

	"github.com/google/uuid"
)

// PipelineRunStatus enumerates the states of a pipeline run.
type PipelineRunStatus string

const (
	PipelineStatusPending    PipelineRunStatus = "pending"
	PipelineStatusRunning    PipelineRunStatus = "running"
	PipelineStatusSuccessful PipelineRunStatus = "successful"
	PipelineStatusFailed     PipelineRunStatus = "failed"
	PipelineStatusStopped    PipelineRunStatus = "stopped"
)

// PipelineStepStatus enumerates individual step statuses.
type PipelineStepStatus string

const (
	StepStatusPending    PipelineStepStatus = "pending"
	StepStatusRunning    PipelineStepStatus = "running"
	StepStatusSuccessful PipelineStepStatus = "successful"
	StepStatusFailed     PipelineStepStatus = "failed"
	StepStatusSkipped    PipelineStepStatus = "skipped"
)

// PipelineConfig stores a repository's pipeline configuration reference.
type PipelineConfig struct {
	ID         uuid.UUID `json:"id"`
	RepoID     uuid.UUID `json:"repo_id"`
	IsEnabled  bool      `json:"is_enabled"`
	YAMLPath   string    `json:"yaml_path"` // e.g. "bitbucket-pipelines.yml"
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// PipelineRun is a single execution of the pipeline.
type PipelineRun struct {
	ID            uuid.UUID         `json:"id"`
	RepoID        uuid.UUID         `json:"repo_id"`
	Number        int               `json:"number"`
	CommitSHA     string            `json:"commit_sha"`
	Branch        string            `json:"branch"`
	Status        PipelineRunStatus `json:"status"`
	TriggerType   string            `json:"trigger_type"` // "push", "pr", "manual", "scheduled"
	TriggeredByID *uuid.UUID        `json:"triggered_by_id,omitempty"`
	DurationSecs  *int              `json:"duration_secs,omitempty"`
	StartedAt     *time.Time        `json:"started_at,omitempty"`
	CompletedAt   *time.Time        `json:"completed_at,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
}

// PipelineStep is one step inside a pipeline run.
type PipelineStep struct {
	ID           uuid.UUID          `json:"id"`
	RunID        uuid.UUID          `json:"run_id"`
	Name         string             `json:"name"`
	Image        string             `json:"image,omitempty"`
	Status       PipelineStepStatus `json:"status"`
	ExitCode     *int               `json:"exit_code,omitempty"`
	LogURL       string             `json:"log_url,omitempty"`
	DurationSecs *int               `json:"duration_secs,omitempty"`
	SortOrder    int                `json:"sort_order"`
	StartedAt    *time.Time         `json:"started_at,omitempty"`
	CompletedAt  *time.Time         `json:"completed_at,omitempty"`
	CreatedAt    time.Time          `json:"created_at"`
}

func (c *PipelineConfig) ScanFields() []any {
	return []any{
		&c.ID, &c.RepoID, &c.IsEnabled, &c.YAMLPath,
		&c.CreatedAt, &c.UpdatedAt,
	}
}

func (r *PipelineRun) ScanFields() []any {
	return []any{
		&r.ID, &r.RepoID, &r.Number, &r.CommitSHA, &r.Branch,
		&r.Status, &r.TriggerType, &r.TriggeredByID,
		&r.DurationSecs, &r.StartedAt, &r.CompletedAt, &r.CreatedAt,
	}
}

func (s *PipelineStep) ScanFields() []any {
	return []any{
		&s.ID, &s.RunID, &s.Name, &s.Image, &s.Status,
		&s.ExitCode, &s.LogURL, &s.DurationSecs, &s.SortOrder,
		&s.StartedAt, &s.CompletedAt, &s.CreatedAt,
	}
}
