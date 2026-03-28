package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/gitforge/backend/internal/config"
	"github.com/gitforge/backend/internal/models"
)

// ──────────────────────────────────────────────
// Repository contracts
// ──────────────────────────────────────────────

// UserRepository abstracts persistence for users.
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByUsername(ctx context.Context, username string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
}

// RefreshTokenRepository abstracts persistence for refresh tokens.
type RefreshTokenRepository interface {
	Create(ctx context.Context, token *models.RefreshToken) error
	GetByToken(ctx context.Context, token string) (*models.RefreshToken, error)
	DeleteByToken(ctx context.Context, token string) error
	DeleteAllForUser(ctx context.Context, userID uuid.UUID) error
}

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// TokenPair holds an access token and a refresh token.
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// JWTClaims are the custom claims embedded in every access token.
type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	IsAdmin  bool      `json:"is_admin"`
	jwt.RegisteredClaims
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// AuthService handles authentication and authorization.
type AuthService struct {
	users    UserRepository
	tokens   RefreshTokenRepository
	jwtCfg   config.JWTConfig
	logger   *slog.Logger
}

// NewAuthService constructs an AuthService with its dependencies.
func NewAuthService(
	users UserRepository,
	tokens RefreshTokenRepository,
	jwtCfg config.JWTConfig,
	logger *slog.Logger,
) *AuthService {
	return &AuthService{
		users:  users,
		tokens: tokens,
		jwtCfg: jwtCfg,
		logger: logger.With("service", "auth"),
	}
}

// Register creates a new user account, hashes the password, persists the user,
// and returns a token pair.
func (s *AuthService) Register(ctx context.Context, username, email, password, displayName string) (*TokenPair, *models.User, error) {
	// ---- validation ----
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(strings.ToLower(email))
	if username == "" {
		return nil, nil, fmt.Errorf("auth: %w: username is required", ErrValidation)
	}
	if email == "" {
		return nil, nil, fmt.Errorf("auth: %w: email is required", ErrValidation)
	}
	if len(password) < 8 {
		return nil, nil, fmt.Errorf("auth: %w: password must be at least 8 characters", ErrValidation)
	}

	// ---- uniqueness checks ----
	if existing, _ := s.users.GetByEmail(ctx, email); existing != nil {
		return nil, nil, fmt.Errorf("auth: %w: email already in use", ErrConflict)
	}
	if existing, _ := s.users.GetByUsername(ctx, username); existing != nil {
		return nil, nil, fmt.Errorf("auth: %w: username already taken", ErrConflict)
	}

	// ---- hash password ----
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: hash password: %w", err)
	}

	now := time.Now().UTC()
	user := &models.User{
		ID:          uuid.New(),
		Username:    username,
		Email:       email,
		DisplayName: displayName,
		Password:    string(hashed),
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, nil, fmt.Errorf("auth: create user: %w", err)
	}

	tokens, err := s.GenerateTokens(ctx, user)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: generate tokens: %w", err)
	}

	s.logger.Info("user registered", "user_id", user.ID, "username", username)
	user.Password = "" // scrub before returning
	return tokens, user, nil
}

// Login verifies credentials and returns a token pair on success.
func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenPair, *models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: %w", ErrUnauthorized)
	}
	if user == nil {
		return nil, nil, fmt.Errorf("auth: %w: invalid credentials", ErrUnauthorized)
	}

	if !user.IsActive {
		return nil, nil, fmt.Errorf("auth: %w: account is deactivated", ErrForbidden)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, nil, fmt.Errorf("auth: %w: invalid credentials", ErrUnauthorized)
	}

	tokens, err := s.GenerateTokens(ctx, user)
	if err != nil {
		return nil, nil, fmt.Errorf("auth: generate tokens: %w", err)
	}

	// fire-and-forget last-login update
	if err := s.users.UpdateLastLogin(ctx, user.ID); err != nil {
		s.logger.Warn("failed to update last_login", "user_id", user.ID, "error", err)
	}

	s.logger.Info("user logged in", "user_id", user.ID)
	user.Password = ""
	return tokens, user, nil
}

// RefreshToken validates the supplied refresh token and issues a new pair.
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	stored, err := s.tokens.GetByToken(ctx, refreshToken)
	if err != nil || stored == nil {
		return nil, fmt.Errorf("auth: %w: invalid refresh token", ErrUnauthorized)
	}

	if time.Now().UTC().After(stored.ExpiresAt) {
		_ = s.tokens.DeleteByToken(ctx, refreshToken)
		return nil, fmt.Errorf("auth: %w: refresh token expired", ErrUnauthorized)
	}

	user, err := s.users.GetByID(ctx, stored.UserID)
	if err != nil || user == nil {
		return nil, fmt.Errorf("auth: %w: user not found", ErrUnauthorized)
	}

	// Rotate: delete old, issue new.
	if err := s.tokens.DeleteByToken(ctx, refreshToken); err != nil {
		s.logger.Warn("failed to delete old refresh token", "error", err)
	}

	pair, err := s.GenerateTokens(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("auth: generate tokens: %w", err)
	}

	s.logger.Info("token refreshed", "user_id", user.ID)
	return pair, nil
}

// Logout invalidates a refresh token.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if err := s.tokens.DeleteByToken(ctx, refreshToken); err != nil {
		return fmt.Errorf("auth: logout: %w", err)
	}
	s.logger.Info("user logged out")
	return nil
}

// GenerateTokens creates a JWT access token (short-lived) and a persisted
// refresh token (long-lived), returning both.
func (s *AuthService) GenerateTokens(ctx context.Context, user *models.User) (*TokenPair, error) {
	now := time.Now().UTC()
	accessExpiry := now.Add(s.jwtCfg.AccessExpiry)

	claims := JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		IsAdmin:  user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			Issuer:    "gitforge",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	// Generate a cryptographically random refresh token.
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("generate refresh token bytes: %w", err)
	}
	refreshStr := hex.EncodeToString(raw)

	rt := &models.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		Token:     refreshStr,
		ExpiresAt: now.Add(s.jwtCfg.RefreshExpiry),
		CreatedAt: now,
	}
	if err := s.tokens.Create(ctx, rt); err != nil {
		return nil, fmt.Errorf("persist refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshStr,
		ExpiresAt:    accessExpiry,
	}, nil
}

// ValidateToken parses a JWT access token and returns its claims.
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.jwtCfg.Secret), nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, fmt.Errorf("auth: %w: token expired", ErrUnauthorized)
		}
		return nil, fmt.Errorf("auth: %w: %v", ErrUnauthorized, err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("auth: %w: invalid token claims", ErrUnauthorized)
	}

	return claims, nil
}
