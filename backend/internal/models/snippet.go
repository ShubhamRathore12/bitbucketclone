package models

import (
	"time"

	"github.com/google/uuid"
)

// Snippet is a short code fragment, similar to a GitHub Gist.
type Snippet struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID *uuid.UUID `json:"workspace_id,omitempty"`
	OwnerID     uuid.UUID  `json:"owner_id"`
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	IsPrivate   bool       `json:"is_private"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// SnippetFile is one file inside a snippet (a snippet can have many files).
type SnippetFile struct {
	ID        uuid.UUID `json:"id"`
	SnippetID uuid.UUID `json:"snippet_id"`
	Filename  string    `json:"filename"`
	Content   string    `json:"content"`
	Language  string    `json:"language,omitempty"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (s *Snippet) ScanFields() []any {
	return []any{
		&s.ID, &s.WorkspaceID, &s.OwnerID, &s.Title,
		&s.Description, &s.IsPrivate, &s.CreatedAt, &s.UpdatedAt,
	}
}

func (f *SnippetFile) ScanFields() []any {
	return []any{
		&f.ID, &f.SnippetID, &f.Filename, &f.Content,
		&f.Language, &f.SortOrder, &f.CreatedAt, &f.UpdatedAt,
	}
}
