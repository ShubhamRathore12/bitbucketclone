package models

import (
	"time"

	"github.com/google/uuid"
)

// WorkspaceRole enumerates the roles a member can hold in a workspace.
type WorkspaceRole string

const (
	WorkspaceRoleOwner  WorkspaceRole = "owner"
	WorkspaceRoleAdmin  WorkspaceRole = "admin"
	WorkspaceRoleMember WorkspaceRole = "member"
)

// Workspace is a top-level organizational container (like a Bitbucket team).
type Workspace struct {
	ID          uuid.UUID `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	IsPrivate   bool      `json:"is_private"`
	OwnerID     uuid.UUID `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WorkspaceMember links a user to a workspace with a specific role.
type WorkspaceMember struct {
	ID          uuid.UUID     `json:"id"`
	WorkspaceID uuid.UUID     `json:"workspace_id"`
	UserID      uuid.UUID     `json:"user_id"`
	Role        WorkspaceRole `json:"role"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`

	// Joined fields (populated by queries that JOIN users).
	Username    string `json:"username,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
}

// Group represents a named collection of users inside a workspace.
type Group struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GroupMember links a user to a group.
type GroupMember struct {
	ID        uuid.UUID `json:"id"`
	GroupID   uuid.UUID `json:"group_id"`
	UserID    uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (w *Workspace) ScanFields() []any {
	return []any{
		&w.ID, &w.Slug, &w.Name, &w.Description, &w.AvatarURL,
		&w.IsPrivate, &w.OwnerID, &w.CreatedAt, &w.UpdatedAt,
	}
}

func (m *WorkspaceMember) ScanFields() []any {
	return []any{
		&m.ID, &m.WorkspaceID, &m.UserID, &m.Role,
		&m.CreatedAt, &m.UpdatedAt,
	}
}

func (g *Group) ScanFields() []any {
	return []any{
		&g.ID, &g.WorkspaceID, &g.Slug, &g.Name,
		&g.Description, &g.CreatedAt, &g.UpdatedAt,
	}
}

func (gm *GroupMember) ScanFields() []any {
	return []any{&gm.ID, &gm.GroupID, &gm.UserID, &gm.CreatedAt}
}
