package models

import (
	"time"

	"github.com/google/uuid"
)

// Webhook subscribes to repository events and delivers HTTP POSTs.
type Webhook struct {
	ID          uuid.UUID `json:"id"`
	RepoID      uuid.UUID `json:"repo_id"`
	URL         string    `json:"url"`
	Secret      string    `json:"-"` // HMAC secret, never serialised
	Events      []string  `json:"events"` // e.g. ["push","pr:created"]
	IsActive    bool      `json:"is_active"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WebhookDelivery records a single delivery attempt.
type WebhookDelivery struct {
	ID             uuid.UUID `json:"id"`
	WebhookID      uuid.UUID `json:"webhook_id"`
	Event          string    `json:"event"`
	RequestBody    string    `json:"request_body,omitempty"`
	ResponseStatus int       `json:"response_status"`
	ResponseBody   string    `json:"response_body,omitempty"`
	DurationMs     int       `json:"duration_ms"`
	Success        bool      `json:"success"`
	CreatedAt      time.Time `json:"created_at"`
}

func (w *Webhook) ScanFields() []any {
	return []any{
		&w.ID, &w.RepoID, &w.URL, &w.Secret, &w.Events,
		&w.IsActive, &w.Description, &w.CreatedAt, &w.UpdatedAt,
	}
}

func (d *WebhookDelivery) ScanFields() []any {
	return []any{
		&d.ID, &d.WebhookID, &d.Event, &d.RequestBody,
		&d.ResponseStatus, &d.ResponseBody, &d.DurationMs,
		&d.Success, &d.CreatedAt,
	}
}
