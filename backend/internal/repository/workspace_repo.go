package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gitforge/backend/internal/models"
)

// WorkspaceRepository provides data access for workspaces and their members.
type WorkspaceRepository struct {
	pool *pgxpool.Pool
}

func NewWorkspaceRepository(pool *pgxpool.Pool) *WorkspaceRepository {
	return &WorkspaceRepository{pool: pool}
}

const workspaceColumns = `id, slug, name, description, avatar_url, is_private, owner_id, created_at, updated_at`

func (r *WorkspaceRepository) Create(ctx context.Context, w *models.Workspace) error {
	w.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO workspaces (id, slug, name, description, avatar_url, is_private, owner_id)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+workspaceColumns,
		w.ID, w.Slug, w.Name, w.Description, w.AvatarURL, w.IsPrivate, w.OwnerID,
	).Scan(w.ScanFields()...)
}

func (r *WorkspaceRepository) GetBySlug(ctx context.Context, slug string) (*models.Workspace, error) {
	w := &models.Workspace{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+workspaceColumns+` FROM workspaces WHERE slug = $1`, slug,
	).Scan(w.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("workspace not found: %w", err)
	}
	return w, err
}

func (r *WorkspaceRepository) Update(ctx context.Context, w *models.Workspace) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE workspaces SET slug=$2, name=$3, description=$4, avatar_url=$5,
		 is_private=$6, updated_at=NOW()
		 WHERE id=$1`,
		w.ID, w.Slug, w.Name, w.Description, w.AvatarURL, w.IsPrivate,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workspace not found")
	}
	return nil
}

func (r *WorkspaceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM workspaces WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workspace not found")
	}
	return nil
}

func (r *WorkspaceRepository) ListByUser(ctx context.Context, userID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.Workspace], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM workspace_members WHERE user_id = $1`, userID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT w.`+workspaceColumns+`
		 FROM workspaces w
		 JOIN workspace_members wm ON wm.workspace_id = w.id
		 WHERE wm.user_id = $1
		 ORDER BY w.name ASC
		 LIMIT $2 OFFSET $3`,
		userID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Workspace
	for rows.Next() {
		var w models.Workspace
		if err := rows.Scan(w.ScanFields()...); err != nil {
			return nil, err
		}
		items = append(items, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.Workspace]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Members ----------

const memberColumns = `id, workspace_id, user_id, role, created_at, updated_at`

func (r *WorkspaceRepository) AddMember(ctx context.Context, m *models.WorkspaceMember) error {
	m.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO workspace_members (id, workspace_id, user_id, role)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+memberColumns,
		m.ID, m.WorkspaceID, m.UserID, m.Role,
	).Scan(m.ScanFields()...)
}

func (r *WorkspaceRepository) UpdateMember(ctx context.Context, workspaceID, userID uuid.UUID, role models.WorkspaceRole) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE workspace_members SET role=$3, updated_at=NOW()
		 WHERE workspace_id=$1 AND user_id=$2`,
		workspaceID, userID, role,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workspace member not found")
	}
	return nil
}

func (r *WorkspaceRepository) RemoveMember(ctx context.Context, workspaceID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2`,
		workspaceID, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workspace member not found")
	}
	return nil
}

func (r *WorkspaceRepository) ListMembers(ctx context.Context, workspaceID uuid.UUID, pg models.Pagination) (*models.PaginatedResult[models.WorkspaceMember], error) {
	var total int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1`, workspaceID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT wm.`+memberColumns+`, u.username, u.display_name
		 FROM workspace_members wm
		 JOIN users u ON u.id = wm.user_id
		 WHERE wm.workspace_id = $1
		 ORDER BY wm.created_at ASC
		 LIMIT $2 OFFSET $3`,
		workspaceID, pg.Limit(), pg.Offset(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.WorkspaceMember
	for rows.Next() {
		var m models.WorkspaceMember
		if err := rows.Scan(
			&m.ID, &m.WorkspaceID, &m.UserID, &m.Role,
			&m.CreatedAt, &m.UpdatedAt, &m.Username, &m.DisplayName,
		); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &models.PaginatedResult[models.WorkspaceMember]{
		Items: items, Total: total, Page: pg.Page, PerPage: pg.Limit(),
	}, nil
}

// ---------- Groups ----------

const groupColumns = `id, workspace_id, slug, name, description, created_at, updated_at`

func (r *WorkspaceRepository) CreateGroup(ctx context.Context, g *models.Group) error {
	g.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO groups (id, workspace_id, slug, name, description)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+groupColumns,
		g.ID, g.WorkspaceID, g.Slug, g.Name, g.Description,
	).Scan(g.ScanFields()...)
}

func (r *WorkspaceRepository) ListGroups(ctx context.Context, workspaceID uuid.UUID) ([]models.Group, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+groupColumns+` FROM groups WHERE workspace_id = $1 ORDER BY name ASC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.Group
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(g.ScanFields()...); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, rows.Err()
}

func (r *WorkspaceRepository) AddGroupMember(ctx context.Context, gm *models.GroupMember) error {
	gm.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO group_members (id, group_id, user_id)
		 VALUES ($1,$2,$3)
		 RETURNING id, group_id, user_id, created_at`,
		gm.ID, gm.GroupID, gm.UserID,
	).Scan(gm.ScanFields()...)
}
