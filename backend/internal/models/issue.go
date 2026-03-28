package models

import (
	"time"

	"github.com/google/uuid"
)

// IssueState enumerates issue lifecycle states.
type IssueState string

const (
	IssueStateNew     IssueState = "new"
	IssueStateOpen    IssueState = "open"
	IssueStateResolved IssueState = "resolved"
	IssueStateOnHold  IssueState = "on_hold"
	IssueStateClosed  IssueState = "closed"
	IssueStateInvalid IssueState = "invalid"
	IssueStateDuplicate IssueState = "duplicate"
	IssueStateWontfix IssueState = "wontfix"
)

// IssuePriority enumerates the urgency levels.
type IssuePriority string

const (
	IssuePriorityTrivial  IssuePriority = "trivial"
	IssuePriorityMinor    IssuePriority = "minor"
	IssuePriorityMajor    IssuePriority = "major"
	IssuePriorityCritical IssuePriority = "critical"
	IssuePriorityBlocker  IssuePriority = "blocker"
)

// IssueKind categorises the issue type.
type IssueKind string

const (
	IssueKindBug         IssueKind = "bug"
	IssueKindEnhancement IssueKind = "enhancement"
	IssueKindProposal    IssueKind = "proposal"
	IssueKindTask        IssueKind = "task"
)

// Issue represents a tracked work item in a repository.
type Issue struct {
	ID          uuid.UUID     `json:"id"`
	RepoID      uuid.UUID     `json:"repo_id"`
	Number      int           `json:"number"`
	Title       string        `json:"title"`
	Content     string        `json:"content,omitempty"`
	State       IssueState    `json:"state"`
	Priority    IssuePriority `json:"priority"`
	Kind        IssueKind     `json:"kind"`
	AuthorID    uuid.UUID     `json:"author_id"`
	AssigneeID  *uuid.UUID    `json:"assignee_id,omitempty"`
	VoteCount   int           `json:"vote_count"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`

	AuthorUsername string `json:"author_username,omitempty"`
}

// IssueComment is a comment posted on an issue.
type IssueComment struct {
	ID        uuid.UUID `json:"id"`
	IssueID   uuid.UUID `json:"issue_id"`
	AuthorID  uuid.UUID `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	AuthorUsername string `json:"author_username,omitempty"`
}

// IssueLabel is a named tag that can be assigned to issues.
type IssueLabel struct {
	ID        uuid.UUID `json:"id"`
	RepoID    uuid.UUID `json:"repo_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"` // hex, e.g. "#e11d48"
	CreatedAt time.Time `json:"created_at"`
}

// IssueLabelAssignment is the join between issues and labels.
type IssueLabelAssignment struct {
	ID        uuid.UUID `json:"id"`
	IssueID   uuid.UUID `json:"issue_id"`
	LabelID   uuid.UUID `json:"label_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (i *Issue) ScanFields() []any {
	return []any{
		&i.ID, &i.RepoID, &i.Number, &i.Title, &i.Content,
		&i.State, &i.Priority, &i.Kind,
		&i.AuthorID, &i.AssigneeID, &i.VoteCount,
		&i.CreatedAt, &i.UpdatedAt,
	}
}

func (c *IssueComment) ScanFields() []any {
	return []any{
		&c.ID, &c.IssueID, &c.AuthorID, &c.Content,
		&c.CreatedAt, &c.UpdatedAt,
	}
}

func (l *IssueLabel) ScanFields() []any {
	return []any{&l.ID, &l.RepoID, &l.Name, &l.Color, &l.CreatedAt}
}

func (a *IssueLabelAssignment) ScanFields() []any {
	return []any{&a.ID, &a.IssueID, &a.LabelID, &a.CreatedAt}
}
