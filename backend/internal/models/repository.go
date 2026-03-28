package models

import (
	"time"

	"github.com/google/uuid"
)

// RepoPermissionLevel enumerates the access levels for repository permissions.
type RepoPermissionLevel string

const (
	RepoPermRead  RepoPermissionLevel = "read"
	RepoPermWrite RepoPermissionLevel = "write"
	RepoPermAdmin RepoPermissionLevel = "admin"
)

// Repository represents a Git repository inside a workspace.
type Repository struct {
	ID              uuid.UUID  `json:"id"`
	WorkspaceID     uuid.UUID  `json:"workspace_id"`
	Slug            string     `json:"slug"`
	Name            string     `json:"name"`
	Description     string     `json:"description,omitempty"`
	IsPrivate       bool       `json:"is_private"`
	DefaultBranch   string     `json:"default_branch"`
	Language        string     `json:"language,omitempty"`
	ForkedFromID    *uuid.UUID `json:"forked_from_id,omitempty"`
	HasIssues       bool       `json:"has_issues"`
	HasWiki         bool       `json:"has_wiki"`
	HasPipelines    bool       `json:"has_pipelines"`
	Size            int64      `json:"size"` // bytes on disk
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Joined / computed fields.
	WorkspaceSlug string `json:"workspace_slug,omitempty"`
}

// RepositoryPermission grants a specific user a permission level on a repo.
type RepositoryPermission struct {
	ID         uuid.UUID           `json:"id"`
	RepoID     uuid.UUID           `json:"repo_id"`
	UserID     uuid.UUID           `json:"user_id"`
	Permission RepoPermissionLevel `json:"permission"`
	CreatedAt  time.Time           `json:"created_at"`
	UpdatedAt  time.Time           `json:"updated_at"`
}

func (r *Repository) ScanFields() []any {
	return []any{
		&r.ID, &r.WorkspaceID, &r.Slug, &r.Name, &r.Description,
		&r.IsPrivate, &r.DefaultBranch, &r.Language, &r.ForkedFromID,
		&r.HasIssues, &r.HasWiki, &r.HasPipelines, &r.Size,
		&r.CreatedAt, &r.UpdatedAt,
	}
}

func (p *RepositoryPermission) ScanFields() []any {
	return []any{
		&p.ID, &p.RepoID, &p.UserID, &p.Permission,
		&p.CreatedAt, &p.UpdatedAt,
	}
}
