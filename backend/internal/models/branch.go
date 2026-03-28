package models

import (
	"time"

	"github.com/google/uuid"
)

// BranchRestrictionKind enumerates possible restriction types.
type BranchRestrictionKind string

const (
	BranchRestrictionNoPush     BranchRestrictionKind = "no_push"
	BranchRestrictionNoDelete   BranchRestrictionKind = "no_delete"
	BranchRestrictionRequirePR  BranchRestrictionKind = "require_pull_request"
	BranchRestrictionRequireCI  BranchRestrictionKind = "require_passing_builds"
	BranchRestrictionRequireApprovals BranchRestrictionKind = "require_approvals"
)

// BranchRestriction defines a protection rule on a branch pattern.
type BranchRestriction struct {
	ID            uuid.UUID             `json:"id"`
	RepoID        uuid.UUID             `json:"repo_id"`
	Kind          BranchRestrictionKind `json:"kind"`
	Pattern       string                `json:"pattern"` // glob, e.g. "main", "release/*"
	Value         int                   `json:"value,omitempty"` // e.g. min approvals count
	CreatedAt     time.Time             `json:"created_at"`
	UpdatedAt     time.Time             `json:"updated_at"`
}

// BranchInfo is a read-only view returned by the Git layer; it is not
// persisted directly but may be cached.
type BranchInfo struct {
	Name      string    `json:"name"`
	CommitSHA string    `json:"commit_sha"`
	IsDefault bool      `json:"is_default"`
	Behind    int       `json:"behind"`
	Ahead     int       `json:"ahead"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (b *BranchRestriction) ScanFields() []any {
	return []any{
		&b.ID, &b.RepoID, &b.Kind, &b.Pattern,
		&b.Value, &b.CreatedAt, &b.UpdatedAt,
	}
}
