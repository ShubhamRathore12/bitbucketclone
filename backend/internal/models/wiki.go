package models

import (
	"time"

	"github.com/google/uuid"
)

// WikiPage represents a single wiki page in a repository.
type WikiPage struct {
	ID        uuid.UUID `json:"id"`
	RepoID    uuid.UUID `json:"repo_id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	AuthorID  uuid.UUID `json:"author_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// WikiPageRevision captures a historical snapshot of a wiki page.
type WikiPageRevision struct {
	ID        uuid.UUID `json:"id"`
	PageID    uuid.UUID `json:"page_id"`
	Content   string    `json:"content"`
	Message   string    `json:"message,omitempty"` // edit summary
	AuthorID  uuid.UUID `json:"author_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (w *WikiPage) ScanFields() []any {
	return []any{
		&w.ID, &w.RepoID, &w.Slug, &w.Title,
		&w.Content, &w.AuthorID, &w.CreatedAt, &w.UpdatedAt,
	}
}

func (r *WikiPageRevision) ScanFields() []any {
	return []any{
		&r.ID, &r.PageID, &r.Content, &r.Message,
		&r.AuthorID, &r.CreatedAt,
	}
}
