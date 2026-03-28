package models

import (
	"time"

	"github.com/google/uuid"
)

// PRState enumerates pull-request lifecycle states.
type PRState string

const (
	PRStateOpen      PRState = "open"
	PRStateMerged    PRState = "merged"
	PRStateDeclined  PRState = "declined"
	PRStateSuperseded PRState = "superseded"
)

// PRReviewStatus represents a reviewer's current verdict.
type PRReviewStatus string

const (
	PRReviewPending  PRReviewStatus = "pending"
	PRReviewApproved PRReviewStatus = "approved"
	PRReviewChanges  PRReviewStatus = "changes_requested"
)

// PRActivityKind categorises timeline entries.
type PRActivityKind string

const (
	PRActivityComment  PRActivityKind = "comment"
	PRActivityApproval PRActivityKind = "approval"
	PRActivityUpdate   PRActivityKind = "update"
	PRActivityMerge    PRActivityKind = "merge"
	PRActivityDecline  PRActivityKind = "decline"
)

// PullRequest represents a request to merge one branch into another.
type PullRequest struct {
	ID               uuid.UUID  `json:"id"`
	RepoID           uuid.UUID  `json:"repo_id"`
	Number           int        `json:"number"`
	Title            string     `json:"title"`
	Description      string     `json:"description,omitempty"`
	State            PRState    `json:"state"`
	SourceBranch     string     `json:"source_branch"`
	DestinationBranch string   `json:"destination_branch"`
	AuthorID         uuid.UUID  `json:"author_id"`
	MergedBy         *uuid.UUID `json:"merged_by,omitempty"`
	MergeCommitSHA   string     `json:"merge_commit_sha,omitempty"`
	CloseSourceBranch bool      `json:"close_source_branch"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	ClosedAt         *time.Time `json:"closed_at,omitempty"`

	// Joined fields.
	AuthorUsername string `json:"author_username,omitempty"`
}

// PRReviewer links a user as a reviewer on a pull request.
type PRReviewer struct {
	ID        uuid.UUID      `json:"id"`
	PRID      uuid.UUID      `json:"pr_id"`
	UserID    uuid.UUID      `json:"user_id"`
	Status    PRReviewStatus `json:"status"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`

	Username string `json:"username,omitempty"`
}

// PRComment is a comment on a pull request. It may be an inline (diff)
// comment when FilePath is non-empty.
type PRComment struct {
	ID        uuid.UUID  `json:"id"`
	PRID      uuid.UUID  `json:"pr_id"`
	AuthorID  uuid.UUID  `json:"author_id"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"` // threaded replies
	Content   string     `json:"content"`
	IsAI      bool       `json:"is_ai"`               // AI-generated suggestion
	// Inline / diff context (all nullable for general comments).
	FilePath  *string `json:"file_path,omitempty"`
	LineFrom  *int    `json:"line_from,omitempty"`
	LineTo    *int    `json:"line_to,omitempty"`
	IsResolved bool   `json:"is_resolved"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`

	AuthorUsername string `json:"author_username,omitempty"`
}

// PRActivity is a timeline entry for a pull request.
type PRActivity struct {
	ID        uuid.UUID      `json:"id"`
	PRID      uuid.UUID      `json:"pr_id"`
	UserID    uuid.UUID      `json:"user_id"`
	Kind      PRActivityKind `json:"kind"`
	Content   string         `json:"content,omitempty"`
	CreatedAt time.Time      `json:"created_at"`

	Username string `json:"username,omitempty"`
}

func (pr *PullRequest) ScanFields() []any {
	return []any{
		&pr.ID, &pr.RepoID, &pr.Number, &pr.Title, &pr.Description,
		&pr.State, &pr.SourceBranch, &pr.DestinationBranch,
		&pr.AuthorID, &pr.MergedBy, &pr.MergeCommitSHA,
		&pr.CloseSourceBranch, &pr.CreatedAt, &pr.UpdatedAt, &pr.ClosedAt,
	}
}

func (r *PRReviewer) ScanFields() []any {
	return []any{
		&r.ID, &r.PRID, &r.UserID, &r.Status,
		&r.CreatedAt, &r.UpdatedAt,
	}
}

func (c *PRComment) ScanFields() []any {
	return []any{
		&c.ID, &c.PRID, &c.AuthorID, &c.ParentID, &c.Content,
		&c.IsAI, &c.FilePath, &c.LineFrom, &c.LineTo, &c.IsResolved,
		&c.CreatedAt, &c.UpdatedAt, &c.DeletedAt,
	}
}

func (a *PRActivity) ScanFields() []any {
	return []any{
		&a.ID, &a.PRID, &a.UserID, &a.Kind,
		&a.Content, &a.CreatedAt,
	}
}
