package models

import (
	"time"

	"github.com/google/uuid"
)

// Notification is a user-facing alert (inbox item).
type Notification struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	Type       string     `json:"type"` // e.g. "pr_review", "issue_comment", "pipeline_failed"
	Title      string     `json:"title"`
	Body       string     `json:"body,omitempty"`
	ResourceID *uuid.UUID `json:"resource_id,omitempty"`
	Link       string     `json:"link,omitempty"`
	IsRead     bool       `json:"is_read"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ActivityEvent is a public feed item (like a Bitbucket activity stream).
type ActivityEvent struct {
	ID          uuid.UUID  `json:"id"`
	ActorID     uuid.UUID  `json:"actor_id"`
	Action      string     `json:"action"`    // "pushed", "created_pr", "merged_pr", etc.
	TargetType  string     `json:"target_type"` // "repository", "pull_request", "issue"
	TargetID    *uuid.UUID `json:"target_id,omitempty"`
	WorkspaceID *uuid.UUID `json:"workspace_id,omitempty"`
	RepoID      *uuid.UUID `json:"repo_id,omitempty"`
	Metadata    string     `json:"metadata,omitempty"` // JSON blob for extra context
	CreatedAt   time.Time  `json:"created_at"`
}

func (n *Notification) ScanFields() []any {
	return []any{
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body,
		&n.ResourceID, &n.Link, &n.IsRead, &n.CreatedAt,
	}
}

func (a *ActivityEvent) ScanFields() []any {
	return []any{
		&a.ID, &a.ActorID, &a.Action, &a.TargetType,
		&a.TargetID, &a.WorkspaceID, &a.RepoID,
		&a.Metadata, &a.CreatedAt,
	}
}
