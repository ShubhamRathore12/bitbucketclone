package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents a registered user account.
type User struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	DisplayName string     `json:"display_name"`
	Password    string     `json:"-"` // never serialise
	AvatarURL   string     `json:"avatar_url,omitempty"`
	IsActive    bool       `json:"is_active"`
	IsAdmin     bool       `json:"is_admin"`
	LastLogin   *time.Time `json:"last_login,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// OAuthAccount links an external OAuth provider to a user.
type OAuthAccount struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Provider     string    `json:"provider"`      // "google", "github", etc.
	ProviderUID  string    `json:"provider_uid"`
	AccessToken  string    `json:"-"`
	RefreshToken string    `json:"-"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// RefreshToken stores a JWT refresh token for session management.
type RefreshToken struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Token     string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// SSHKey holds a public key uploaded by a user.
type SSHKey struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Label       string    `json:"label"`
	Fingerprint string    `json:"fingerprint"`
	PublicKey   string    `json:"public_key"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// ScanUser populates a User from a pgx row.  The caller must supply the
// destination slice in column order:
//
//	row.Scan(&u.ID, &u.Username, &u.Email, &u.DisplayName, &u.Password,
//	          &u.AvatarURL, &u.IsActive, &u.IsAdmin, &u.LastLogin,
//	          &u.CreatedAt, &u.UpdatedAt)
func (u *User) ScanFields() []any {
	return []any{
		&u.ID, &u.Username, &u.Email, &u.DisplayName, &u.Password,
		&u.AvatarURL, &u.IsActive, &u.IsAdmin, &u.LastLogin,
		&u.CreatedAt, &u.UpdatedAt,
	}
}

func (o *OAuthAccount) ScanFields() []any {
	return []any{
		&o.ID, &o.UserID, &o.Provider, &o.ProviderUID,
		&o.AccessToken, &o.RefreshToken, &o.ExpiresAt,
		&o.CreatedAt, &o.UpdatedAt,
	}
}

func (r *RefreshToken) ScanFields() []any {
	return []any{&r.ID, &r.UserID, &r.Token, &r.ExpiresAt, &r.CreatedAt}
}

func (k *SSHKey) ScanFields() []any {
	return []any{
		&k.ID, &k.UserID, &k.Label, &k.Fingerprint,
		&k.PublicKey, &k.LastUsedAt, &k.CreatedAt,
	}
}
