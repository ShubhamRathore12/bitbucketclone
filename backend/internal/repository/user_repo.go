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

// UserRepository provides data access for user-related entities.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository constructs a UserRepository backed by the given pool.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// ---------- User CRUD ----------

const userColumns = `id, username, email, display_name, password,
	avatar_url, is_active, is_admin, last_login, created_at, updated_at`

func (r *UserRepository) Create(ctx context.Context, u *models.User) error {
	u.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO users (id, username, email, display_name, password, avatar_url, is_active, is_admin)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING `+userColumns,
		u.ID, u.Username, u.Email, u.DisplayName, u.Password, u.AvatarURL, u.IsActive, u.IsAdmin,
	).Scan(u.ScanFields()...)
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	u := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id,
	).Scan(u.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return u, err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	u := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email,
	).Scan(u.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return u, err
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	u := &models.User{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE username = $1`, username,
	).Scan(u.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return u, err
}

func (r *UserRepository) Update(ctx context.Context, u *models.User) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE users SET username=$2, email=$3, display_name=$4, password=$5,
		 avatar_url=$6, is_active=$7, is_admin=$8, last_login=$9, updated_at=NOW()
		 WHERE id=$1`,
		u.ID, u.Username, u.Email, u.DisplayName, u.Password,
		u.AvatarURL, u.IsActive, u.IsAdmin, u.LastLogin,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ---------- OAuth ----------

const oauthColumns = `id, user_id, provider, provider_uid, access_token,
	refresh_token, expires_at, created_at, updated_at`

func (r *UserRepository) CreateOAuth(ctx context.Context, o *models.OAuthAccount) error {
	o.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO oauth_accounts (id, user_id, provider, provider_uid, access_token, refresh_token, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+oauthColumns,
		o.ID, o.UserID, o.Provider, o.ProviderUID, o.AccessToken, o.RefreshToken, o.ExpiresAt,
	).Scan(o.ScanFields()...)
}

func (r *UserRepository) GetOAuthByProvider(ctx context.Context, userID uuid.UUID, provider string) (*models.OAuthAccount, error) {
	o := &models.OAuthAccount{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+oauthColumns+` FROM oauth_accounts WHERE user_id = $1 AND provider = $2`,
		userID, provider,
	).Scan(o.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("oauth account not found: %w", err)
	}
	return o, err
}

// ---------- Refresh Tokens ----------

const refreshTokenColumns = `id, user_id, token, expires_at, created_at`

func (r *UserRepository) CreateRefreshToken(ctx context.Context, t *models.RefreshToken) error {
	t.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO refresh_tokens (id, user_id, token, expires_at)
		 VALUES ($1,$2,$3,$4)
		 RETURNING `+refreshTokenColumns,
		t.ID, t.UserID, t.Token, t.ExpiresAt,
	).Scan(t.ScanFields()...)
}

func (r *UserRepository) GetRefreshToken(ctx context.Context, token string) (*models.RefreshToken, error) {
	t := &models.RefreshToken{}
	err := r.pool.QueryRow(ctx,
		`SELECT `+refreshTokenColumns+` FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
		token,
	).Scan(t.ScanFields()...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("refresh token not found or expired: %w", err)
	}
	return t, err
}

func (r *UserRepository) DeleteRefreshToken(ctx context.Context, token string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM refresh_tokens WHERE token = $1`, token,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("refresh token not found")
	}
	return nil
}

// ---------- SSH Keys ----------

const sshKeyColumns = `id, user_id, label, fingerprint, public_key, last_used_at, created_at`

func (r *UserRepository) CreateSSHKey(ctx context.Context, k *models.SSHKey) error {
	k.ID = uuid.New()
	return r.pool.QueryRow(ctx,
		`INSERT INTO ssh_keys (id, user_id, label, fingerprint, public_key)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+sshKeyColumns,
		k.ID, k.UserID, k.Label, k.Fingerprint, k.PublicKey,
	).Scan(k.ScanFields()...)
}

func (r *UserRepository) ListSSHKeys(ctx context.Context, userID uuid.UUID) ([]models.SSHKey, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+sshKeyColumns+` FROM ssh_keys WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []models.SSHKey
	for rows.Next() {
		var k models.SSHKey
		if err := rows.Scan(k.ScanFields()...); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *UserRepository) DeleteSSHKey(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM ssh_keys WHERE id = $1 AND user_id = $2`, id, userID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ssh key not found")
	}
	return nil
}
