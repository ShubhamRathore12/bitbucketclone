package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────

// WebhookEvent enumerates events that can trigger a webhook.
type WebhookEvent string

const (
	WebhookEventPush          WebhookEvent = "repo:push"
	WebhookEventPRCreated     WebhookEvent = "pullrequest:created"
	WebhookEventPRUpdated     WebhookEvent = "pullrequest:updated"
	WebhookEventPRApproved    WebhookEvent = "pullrequest:approved"
	WebhookEventPRMerged      WebhookEvent = "pullrequest:fulfilled"
	WebhookEventPRDeclined    WebhookEvent = "pullrequest:rejected"
	WebhookEventPRComment     WebhookEvent = "pullrequest:comment_created"
	WebhookEventIssueCreated  WebhookEvent = "issue:created"
	WebhookEventIssueUpdated  WebhookEvent = "issue:updated"
	WebhookEventIssueComment  WebhookEvent = "issue:comment_created"
	WebhookEventPipelineResult WebhookEvent = "pipeline:completed"
)

// Webhook represents a configured webhook endpoint.
type Webhook struct {
	ID          uuid.UUID      `json:"id"`
	RepoID      uuid.UUID      `json:"repo_id"`
	URL         string         `json:"url"`
	Secret      string         `json:"-"` // HMAC secret for signing payloads
	Events      []WebhookEvent `json:"events"`
	IsActive    bool           `json:"is_active"`
	Description string         `json:"description,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// WebhookDelivery records a single webhook delivery attempt.
type WebhookDelivery struct {
	ID             uuid.UUID    `json:"id"`
	WebhookID      uuid.UUID    `json:"webhook_id"`
	Event          WebhookEvent `json:"event"`
	RequestBody    string       `json:"request_body,omitempty"`
	ResponseStatus int          `json:"response_status"`
	ResponseBody   string       `json:"response_body,omitempty"`
	DurationMs     int          `json:"duration_ms"`
	Success        bool         `json:"success"`
	ErrorMessage   string       `json:"error_message,omitempty"`
	DeliveredAt    time.Time    `json:"delivered_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// WebhookRepository abstracts persistence for webhooks.
type WebhookRepository interface {
	Create(ctx context.Context, webhook *Webhook) error
	GetByID(ctx context.Context, id uuid.UUID) (*Webhook, error)
	Update(ctx context.Context, webhook *Webhook) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, repoID uuid.UUID) ([]*Webhook, error)
	ListByRepoAndEvent(ctx context.Context, repoID uuid.UUID, event WebhookEvent) ([]*Webhook, error)

	CreateDelivery(ctx context.Context, delivery *WebhookDelivery) error
	ListDeliveries(ctx context.Context, webhookID uuid.UUID, page, limit int) ([]*WebhookDelivery, int, error)
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// WebhookCreateInput carries parameters for creating a webhook.
type WebhookCreateInput struct {
	RepoID      uuid.UUID
	URL         string
	Secret      string
	Events      []WebhookEvent
	Description string
}

// WebhookUpdateInput carries mutable webhook fields.
type WebhookUpdateInput struct {
	URL         *string
	Secret      *string
	Events      []WebhookEvent
	IsActive    *bool
	Description *string
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// WebhookService implements webhook business logic.
type WebhookService struct {
	webhooks   WebhookRepository
	httpClient *http.Client
	logger     *slog.Logger
}

// NewWebhookService constructs a WebhookService.
func NewWebhookService(
	webhooks WebhookRepository,
	logger *slog.Logger,
) *WebhookService {
	return &WebhookService{
		webhooks: webhooks,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger.With("service", "webhook"),
	}
}

// Create creates a new webhook.
func (s *WebhookService) Create(ctx context.Context, in WebhookCreateInput) (*Webhook, error) {
	if in.URL == "" {
		return nil, fmt.Errorf("webhook: %w: URL is required", ErrValidation)
	}
	if len(in.Events) == 0 {
		return nil, fmt.Errorf("webhook: %w: at least one event is required", ErrValidation)
	}

	now := time.Now().UTC()
	webhook := &Webhook{
		ID:          uuid.New(),
		RepoID:      in.RepoID,
		URL:         in.URL,
		Secret:      in.Secret,
		Events:      in.Events,
		IsActive:    true,
		Description: in.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.webhooks.Create(ctx, webhook); err != nil {
		return nil, fmt.Errorf("webhook: create: %w", err)
	}

	s.logger.Info("webhook created", "id", webhook.ID, "url", webhook.URL, "events", len(webhook.Events))
	return webhook, nil
}

// Get retrieves a webhook by ID.
func (s *WebhookService) Get(ctx context.Context, id uuid.UUID) (*Webhook, error) {
	webhook, err := s.webhooks.GetByID(ctx, id)
	if err != nil || webhook == nil {
		return nil, fmt.Errorf("webhook: %w", ErrNotFound)
	}
	return webhook, nil
}

// Update applies changes to a webhook.
func (s *WebhookService) Update(ctx context.Context, id uuid.UUID, in WebhookUpdateInput) (*Webhook, error) {
	webhook, err := s.webhooks.GetByID(ctx, id)
	if err != nil || webhook == nil {
		return nil, fmt.Errorf("webhook: %w", ErrNotFound)
	}

	if in.URL != nil {
		webhook.URL = *in.URL
	}
	if in.Secret != nil {
		webhook.Secret = *in.Secret
	}
	if in.Events != nil {
		webhook.Events = in.Events
	}
	if in.IsActive != nil {
		webhook.IsActive = *in.IsActive
	}
	if in.Description != nil {
		webhook.Description = *in.Description
	}
	webhook.UpdatedAt = time.Now().UTC()

	if err := s.webhooks.Update(ctx, webhook); err != nil {
		return nil, fmt.Errorf("webhook: update: %w", err)
	}

	s.logger.Info("webhook updated", "id", id)
	return webhook, nil
}

// Delete removes a webhook.
func (s *WebhookService) Delete(ctx context.Context, id uuid.UUID) error {
	webhook, err := s.webhooks.GetByID(ctx, id)
	if err != nil || webhook == nil {
		return fmt.Errorf("webhook: %w", ErrNotFound)
	}

	if err := s.webhooks.Delete(ctx, id); err != nil {
		return fmt.Errorf("webhook: delete: %w", err)
	}

	s.logger.Info("webhook deleted", "id", id)
	return nil
}

// List returns all webhooks for a repository.
func (s *WebhookService) List(ctx context.Context, repoID uuid.UUID) ([]*Webhook, error) {
	webhooks, err := s.webhooks.List(ctx, repoID)
	if err != nil {
		return nil, fmt.Errorf("webhook: list: %w", err)
	}
	return webhooks, nil
}

// Deliver finds all matching webhooks for the event and POSTs the payload.
// Delivery is done synchronously for simplicity; a production system would use
// a background job queue.
func (s *WebhookService) Deliver(ctx context.Context, repoID uuid.UUID, event WebhookEvent, payload any) {
	webhooks, err := s.webhooks.ListByRepoAndEvent(ctx, repoID, event)
	if err != nil {
		s.logger.Warn("failed to load webhooks for delivery", "repo_id", repoID, "event", event, "error", err)
		return
	}

	if len(webhooks) == 0 {
		return
	}

	body, err := json.Marshal(payload)
	if err != nil {
		s.logger.Warn("failed to marshal webhook payload", "error", err)
		return
	}

	for _, wh := range webhooks {
		if !wh.IsActive {
			continue
		}
		go s.deliverSingle(ctx, wh, event, body)
	}
}

// deliverSingle sends a single webhook delivery and records the result.
func (s *WebhookService) deliverSingle(ctx context.Context, wh *Webhook, event WebhookEvent, body []byte) {
	delivery := &WebhookDelivery{
		ID:          uuid.New(),
		WebhookID:   wh.ID,
		Event:       event,
		RequestBody: string(body),
		DeliveredAt: time.Now().UTC(),
	}

	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wh.URL, bytes.NewReader(body))
	if err != nil {
		delivery.Success = false
		delivery.ErrorMessage = fmt.Sprintf("create request: %v", err)
		delivery.DurationMs = int(time.Since(start).Milliseconds())
		s.recordDelivery(ctx, delivery)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Event-Key", string(event))
	req.Header.Set("X-Hook-UUID", wh.ID.String())

	// Sign the payload with HMAC-SHA256 if a secret is configured.
	if wh.Secret != "" {
		sig := computeHMAC(body, []byte(wh.Secret))
		req.Header.Set("X-Hub-Signature", "sha256="+sig)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		delivery.Success = false
		delivery.ErrorMessage = fmt.Sprintf("HTTP request failed: %v", err)
		delivery.DurationMs = int(time.Since(start).Milliseconds())
		s.recordDelivery(ctx, delivery)
		return
	}
	defer resp.Body.Close()

	delivery.DurationMs = int(time.Since(start).Milliseconds())
	delivery.ResponseStatus = resp.StatusCode

	// Read up to 10KB of the response body for logging.
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 10*1024))
	delivery.ResponseBody = string(respBody)
	delivery.Success = resp.StatusCode >= 200 && resp.StatusCode < 300

	if !delivery.Success {
		delivery.ErrorMessage = fmt.Sprintf("unexpected status: %d", resp.StatusCode)
	}

	s.recordDelivery(ctx, delivery)

	s.logger.Info("webhook delivered",
		"webhook_id", wh.ID, "url", wh.URL,
		"event", event, "status", resp.StatusCode,
		"duration_ms", delivery.DurationMs,
		"success", delivery.Success,
	)
}

// recordDelivery persists a delivery attempt.
func (s *WebhookService) recordDelivery(ctx context.Context, delivery *WebhookDelivery) {
	if err := s.webhooks.CreateDelivery(ctx, delivery); err != nil {
		s.logger.Warn("failed to record webhook delivery", "error", err)
	}
}

// computeHMAC signs a payload with HMAC-SHA256.
func computeHMAC(message, key []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(message)
	return hex.EncodeToString(mac.Sum(nil))
}
