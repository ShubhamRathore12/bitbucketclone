package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gitforge/backend/internal/models"
)

// NotificationRepository provides data access for notifications and activity events.
type NotificationRepository struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

// ---------- Notifications ----------

const notificationColumns = `id, user_id, type, title, body, resource_id, link, is_read, created_at`

func (r *NotificationRepository) Create(ctx context.Context, n *models.Notification) error {
	n.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO notifications (id, user_id, type, title, body, resource_id, link)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+notificationColumns,
		n.ID, n.UserID, n.Type, n.Title, n.Body, n.ResourceID, n.Link,
	).Scan(n.ScanFields()...)
}

func (r *NotificationRepository) ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, pg models.Pagination) (*models.PaginatedResult[models.Notification], error) {
	whereClause := `WHERE user_id = $1`
	args := []any{userID}
	argIdx := 2

	if unreadOnly {
		whereClause += ` AND is_read = false`
	}

	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications `+whereClause, args...,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(
		`SELECT `+notificationColumns+` FROM notifications %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1,
	)
	args = append(args, pg.Limit(), pg.Offset())

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Notification
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(n.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Notification]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

func (r *NotificationRepository) MarkRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}

func (r *NotificationRepository) MarkAllRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
		userID,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ---------- Activity Events ----------

const activityColumns = `id, actor_id, action, target_type, target_id, workspace_id, repo_id, metadata, created_at`

func (r *NotificationRepository) CreateActivity(ctx context.Context, a *models.ActivityEvent) error {
	a.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO activity_events (id, actor_id, action, target_type, target_id, workspace_id, repo_id, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING `+activityColumns,
		a.ID, a.ActorID, a.Action, a.TargetType, a.TargetID,
		a.WorkspaceID, a.RepoID, a.Metadata,
	).Scan(a.ScanFields()...)
}

func (r *NotificationRepository) ListActivities(ctx context.Context, workspaceID *uuid.UUID, repoID *uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.ActivityEvent], error) {
	whereClause := `WHERE 1=1`
	args := []any{}
	argIdx := 1

	if workspaceID != nil {
		whereClause += fmt.Sprintf(` AND workspace_id = $%d`, argIdx)
		args = append(args, *workspaceID)
		argIdx++
	}
	if repoID != nil {
		whereClause += fmt.Sprintf(` AND repo_id = $%d`, argIdx)
		args = append(args, *repoID)
		argIdx++
	}

	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_events `+whereClause, args...,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(
		`SELECT `+activityColumns+` FROM activity_events %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1,
	)
	args = append(args, pg.Limit(), pg.Offset())

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ActivityEvent
	for rows.Next() {
		var a models.ActivityEvent
		if err := rows.Scan(a.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.ActivityEvent]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}
