package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────

// NotificationType enumerates notification categories.
type NotificationType string

const (
	NotifTypePRCreated      NotificationType = "pr_created"
	NotifTypePRApproved     NotificationType = "pr_approved"
	NotifTypePRMerged       NotificationType = "pr_merged"
	NotifTypePRDeclined     NotificationType = "pr_declined"
	NotifTypePRCommented    NotificationType = "pr_commented"
	NotifTypeIssueCreated   NotificationType = "issue_created"
	NotifTypeIssueUpdated   NotificationType = "issue_updated"
	NotifTypeIssueCommented NotificationType = "issue_commented"
	NotifTypePipelineResult NotificationType = "pipeline_result"
	NotifTypeMentioned      NotificationType = "mentioned"
)

// ResourceType identifies the type of resource a notification relates to.
type ResourceType string

const (
	ResourcePR       ResourceType = "pull_request"
	ResourceIssue    ResourceType = "issue"
	ResourcePipeline ResourceType = "pipeline"
	ResourceRepo     ResourceType = "repository"
)

// Notification represents a user notification.
type Notification struct {
	ID           uuid.UUID        `json:"id"`
	UserID       uuid.UUID        `json:"user_id"`
	Type         NotificationType `json:"type"`
	Title        string           `json:"title"`
	Body         string           `json:"body"`
	Link         string           `json:"link,omitempty"`
	ActorID      *uuid.UUID       `json:"actor_id,omitempty"`
	ResourceType ResourceType     `json:"resource_type,omitempty"`
	ResourceID   *uuid.UUID       `json:"resource_id,omitempty"`
	IsRead       bool             `json:"is_read"`
	ReadAt       *time.Time       `json:"read_at,omitempty"`
	CreatedAt    time.Time        `json:"created_at"`
}

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// NotificationRepository abstracts persistence for notifications.
type NotificationRepository interface {
	Create(ctx context.Context, notif *Notification) error
	GetByID(ctx context.Context, id uuid.UUID) (*Notification, error)
	List(ctx context.Context, userID uuid.UUID, page, limit int) ([]*Notification, int, error)
	MarkRead(ctx context.Context, id uuid.UUID) error
	MarkAllRead(ctx context.Context, userID uuid.UUID) error
	CountUnread(ctx context.Context, userID uuid.UUID) (int, error)
}

// WebSocketHub abstracts real-time WebSocket delivery.
type WebSocketHub interface {
	// SendToUser sends a JSON payload to all active connections for the user.
	SendToUser(userID uuid.UUID, payload []byte) error
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// NotificationListResult wraps a page of notifications.
type NotificationListResult struct {
	Notifications []*Notification `json:"notifications"`
	Total         int             `json:"total"`
	Unread        int             `json:"unread"`
	Page          int             `json:"page"`
	Limit         int             `json:"limit"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// NotificationService implements notification business logic.
type NotificationService struct {
	notifs NotificationRepository
	wsHub  WebSocketHub
	logger *slog.Logger
}

// NewNotificationService constructs a NotificationService.
func NewNotificationService(
	notifs NotificationRepository,
	wsHub WebSocketHub,
	logger *slog.Logger,
) *NotificationService {
	return &NotificationService{
		notifs: notifs,
		wsHub:  wsHub,
		logger: logger.With("service", "notification"),
	}
}

// Create creates a notification and delivers it via WebSocket.
func (s *NotificationService) Create(
	ctx context.Context,
	userID uuid.UUID,
	notifType NotificationType,
	title, body, link string,
	actorID *uuid.UUID,
	resourceType ResourceType,
	resourceID *uuid.UUID,
) (*Notification, error) {
	now := time.Now().UTC()
	notif := &Notification{
		ID:           uuid.New(),
		UserID:       userID,
		Type:         notifType,
		Title:        title,
		Body:         body,
		Link:         link,
		ActorID:      actorID,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IsRead:       false,
		CreatedAt:    now,
	}

	if err := s.notifs.Create(ctx, notif); err != nil {
		return nil, fmt.Errorf("notification: create: %w", err)
	}

	// Deliver via WebSocket (best-effort).
	s.deliverRealTime(notif)

	s.logger.Info("notification created",
		"user_id", userID, "type", notifType, "notif_id", notif.ID,
	)
	return notif, nil
}

// List returns a paginated list of notifications for a user.
func (s *NotificationService) List(ctx context.Context, userID uuid.UUID, page, limit int) (*NotificationListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}

	notifs, total, err := s.notifs.List(ctx, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("notification: list: %w", err)
	}

	unread, err := s.notifs.CountUnread(ctx, userID)
	if err != nil {
		s.logger.Warn("failed to count unread notifications", "error", err)
	}

	return &NotificationListResult{
		Notifications: notifs,
		Total:         total,
		Unread:        unread,
		Page:          page,
		Limit:         limit,
	}, nil
}

// MarkRead marks a single notification as read.
func (s *NotificationService) MarkRead(ctx context.Context, notifID, userID uuid.UUID) error {
	notif, err := s.notifs.GetByID(ctx, notifID)
	if err != nil || notif == nil {
		return fmt.Errorf("notification: %w", ErrNotFound)
	}
	if notif.UserID != userID {
		return fmt.Errorf("notification: %w: not your notification", ErrForbidden)
	}

	if err := s.notifs.MarkRead(ctx, notifID); err != nil {
		return fmt.Errorf("notification: mark read: %w", err)
	}
	return nil
}

// MarkAllRead marks all notifications as read for a user.
func (s *NotificationService) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	if err := s.notifs.MarkAllRead(ctx, userID); err != nil {
		return fmt.Errorf("notification: mark all read: %w", err)
	}

	s.logger.Info("all notifications marked read", "user_id", userID)
	return nil
}

// ──────────────────────────────────────────────
// Convenience event notifiers
// ──────────────────────────────────────────────

// NotifyPREvent sends a notification for a pull request event.
func (s *NotificationService) NotifyPREvent(
	ctx context.Context,
	recipientID uuid.UUID,
	actorID uuid.UUID,
	notifType NotificationType,
	pr *PullRequest,
	workspaceSlug, repoSlug string,
) {
	title := prNotificationTitle(notifType, pr.Number)
	body := fmt.Sprintf("%s (PR #%d in %s/%s)", pr.Title, pr.Number, workspaceSlug, repoSlug)
	link := fmt.Sprintf("/%s/%s/pull-requests/%d", workspaceSlug, repoSlug, pr.Number)
	prID := pr.ID

	_, err := s.Create(ctx, recipientID, notifType, title, body, link, &actorID, ResourcePR, &prID)
	if err != nil {
		s.logger.Warn("failed to create PR notification", "error", err)
	}
}

// NotifyIssueEvent sends a notification for an issue event.
func (s *NotificationService) NotifyIssueEvent(
	ctx context.Context,
	recipientID uuid.UUID,
	actorID uuid.UUID,
	notifType NotificationType,
	issue *Issue,
	workspaceSlug, repoSlug string,
) {
	title := issueNotificationTitle(notifType, issue.Number)
	body := fmt.Sprintf("%s (Issue #%d in %s/%s)", issue.Title, issue.Number, workspaceSlug, repoSlug)
	link := fmt.Sprintf("/%s/%s/issues/%d", workspaceSlug, repoSlug, issue.Number)
	issueID := issue.ID

	_, err := s.Create(ctx, recipientID, notifType, title, body, link, &actorID, ResourceIssue, &issueID)
	if err != nil {
		s.logger.Warn("failed to create issue notification", "error", err)
	}
}

// NotifyPipelineEvent sends a notification for a pipeline event.
func (s *NotificationService) NotifyPipelineEvent(
	ctx context.Context,
	recipientID uuid.UUID,
	run *PipelineRun,
	workspaceSlug, repoSlug string,
) {
	title := fmt.Sprintf("Pipeline #%d %s", run.Number, run.Status)
	body := fmt.Sprintf("Pipeline run #%d on branch %s is %s (%s/%s)",
		run.Number, run.Branch, run.Status, workspaceSlug, repoSlug)
	link := fmt.Sprintf("/%s/%s/pipelines/%d", workspaceSlug, repoSlug, run.Number)
	runID := run.ID

	_, err := s.Create(ctx, recipientID, NotifTypePipelineResult, title, body, link, nil, ResourcePipeline, &runID)
	if err != nil {
		s.logger.Warn("failed to create pipeline notification", "error", err)
	}
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// deliverRealTime marshals the notification and pushes it over WebSocket.
func (s *NotificationService) deliverRealTime(notif *Notification) {
	if s.wsHub == nil {
		return
	}

	payload, err := json.Marshal(map[string]any{
		"type":         "notification",
		"notification": notif,
	})
	if err != nil {
		s.logger.Warn("failed to marshal notification for WS", "error", err)
		return
	}

	if err := s.wsHub.SendToUser(notif.UserID, payload); err != nil {
		s.logger.Warn("failed to deliver notification via WS",
			"user_id", notif.UserID, "error", err,
		)
	}
}

func prNotificationTitle(t NotificationType, number int) string {
	switch t {
	case NotifTypePRCreated:
		return fmt.Sprintf("New pull request #%d", number)
	case NotifTypePRApproved:
		return fmt.Sprintf("Pull request #%d approved", number)
	case NotifTypePRMerged:
		return fmt.Sprintf("Pull request #%d merged", number)
	case NotifTypePRDeclined:
		return fmt.Sprintf("Pull request #%d declined", number)
	case NotifTypePRCommented:
		return fmt.Sprintf("New comment on PR #%d", number)
	default:
		return fmt.Sprintf("Pull request #%d update", number)
	}
}

func issueNotificationTitle(t NotificationType, number int) string {
	switch t {
	case NotifTypeIssueCreated:
		return fmt.Sprintf("New issue #%d", number)
	case NotifTypeIssueUpdated:
		return fmt.Sprintf("Issue #%d updated", number)
	case NotifTypeIssueCommented:
		return fmt.Sprintf("New comment on issue #%d", number)
	default:
		return fmt.Sprintf("Issue #%d update", number)
	}
}
