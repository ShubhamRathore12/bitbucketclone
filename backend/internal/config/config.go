package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Git      GitConfig
	AI       AIConfig
	OAuth    OAuthConfig
}

type ServerConfig struct {
	Port string
	Env  string // "development", "staging", "production"
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	PoolSize int
	SSLMode  string
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s&pool_max_conns=%d",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode, d.PoolSize,
	)
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type GitConfig struct {
	BasePath string
}

type AIConfig struct {
	ClaudeAPIKey string
	Model        string
}

type OAuthConfig struct {
	Google OAuthProviderConfig
	GitHub OAuthProviderConfig
}

type OAuthProviderConfig struct {
	ClientID     string
	ClientSecret string
}

// Load reads configuration from environment variables and returns a populated
// Config struct. It applies sensible defaults where values are absent.
func Load() (*Config, error) {
	dbPort, err := strconv.Atoi(envOrDefault("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}

	dbPool, err := strconv.Atoi(envOrDefault("DB_POOL_SIZE", "20"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_POOL_SIZE: %w", err)
	}

	redisDB, err := strconv.Atoi(envOrDefault("REDIS_DB", "0"))
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_DB: %w", err)
	}

	accessTTL, err := time.ParseDuration(envOrDefault("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_TTL: %w", err)
	}

	refreshTTL, err := time.ParseDuration(envOrDefault("JWT_REFRESH_TTL", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_TTL: %w", err)
	}

	jwtSecret := envOrDefault("JWT_SECRET", "")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	cfg := &Config{
		Server: ServerConfig{
			Port: envOrDefault("SERVER_PORT", "3000"),
			Env:  envOrDefault("SERVER_ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:     envOrDefault("DB_HOST", "localhost"),
			Port:     dbPort,
			User:     envOrDefault("DB_USER", "gitforge"),
			Password: envOrDefault("DB_PASSWORD", ""),
			Name:     envOrDefault("DB_NAME", "gitforge"),
			PoolSize: dbPool,
			SSLMode:  envOrDefault("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Addr:     envOrDefault("REDIS_ADDR", "localhost:6379"),
			Password: envOrDefault("REDIS_PASSWORD", ""),
			DB:       redisDB,
		},
		JWT: JWTConfig{
			Secret:        jwtSecret,
			AccessExpiry:  accessTTL,
			RefreshExpiry: refreshTTL,
		},
		Git: GitConfig{
			BasePath: envOrDefault("GIT_BASE_PATH", "/data/repos"),
		},
		AI: AIConfig{
			ClaudeAPIKey: envOrDefault("CLAUDE_API_KEY", ""),
			Model:        envOrDefault("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
		},
		OAuth: OAuthConfig{
			Google: OAuthProviderConfig{
				ClientID:     envOrDefault("GOOGLE_CLIENT_ID", ""),
				ClientSecret: envOrDefault("GOOGLE_CLIENT_SECRET", ""),
			},
			GitHub: OAuthProviderConfig{
				ClientID:     envOrDefault("GITHUB_CLIENT_ID", ""),
				ClientSecret: envOrDefault("GITHUB_CLIENT_SECRET", ""),
			},
		},
	}

	return cfg, nil
}

// IsDevelopment returns true when running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Server.Env == "development"
}

// IsProduction returns true when running in production mode.
func (c *Config) IsProduction() bool {
	return c.Server.Env == "production"
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
