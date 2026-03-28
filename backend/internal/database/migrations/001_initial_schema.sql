-- 001_initial_schema.sql
-- Base tables for the GitForge platform.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(64)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(128) NOT NULL DEFAULT '',
    password_hash TEXT         NOT NULL DEFAULT '',
    avatar_url    TEXT         NOT NULL DEFAULT '',
    bio           TEXT         NOT NULL DEFAULT '',
    location      VARCHAR(128) NOT NULL DEFAULT '',
    website       VARCHAR(512) NOT NULL DEFAULT '',
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- ============================================================================
-- Workspaces
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(128) NOT NULL UNIQUE,
    name        VARCHAR(256) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    avatar_url  TEXT         NOT NULL DEFAULT '',
    is_personal BOOLEAN      NOT NULL DEFAULT false,
    owner_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug     ON workspaces (slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces (owner_id);

-- ============================================================================
-- Workspace members
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         VARCHAR(32) NOT NULL DEFAULT 'read',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_members_workspace ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_members_user      ON workspace_members (user_id);

-- ============================================================================
-- Repositories
-- ============================================================================
CREATE TABLE IF NOT EXISTS repositories (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id   UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    slug           VARCHAR(128) NOT NULL,
    name           VARCHAR(256) NOT NULL,
    description    TEXT         NOT NULL DEFAULT '',
    is_public      BOOLEAN      NOT NULL DEFAULT false,
    default_branch VARCHAR(256) NOT NULL DEFAULT 'main',
    language       VARCHAR(64)  NOT NULL DEFAULT '',
    forked_from_id UUID         REFERENCES repositories(id) ON DELETE SET NULL,
    size_bytes     BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_repos_workspace ON repositories (workspace_id);
CREATE INDEX IF NOT EXISTS idx_repos_slug      ON repositories (slug);

-- ============================================================================
-- Repository members (direct per-repo permissions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS repo_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id    UUID        NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(32) NOT NULL DEFAULT 'read',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (repo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_repo_members_repo ON repo_members (repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_members_user ON repo_members (user_id);

-- ============================================================================
-- Pull Requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS pull_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id         UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number          INTEGER      NOT NULL,
    title           VARCHAR(512) NOT NULL,
    description     TEXT         NOT NULL DEFAULT '',
    state           VARCHAR(32)  NOT NULL DEFAULT 'open',
    source_branch   VARCHAR(256) NOT NULL,
    target_branch   VARCHAR(256) NOT NULL DEFAULT 'main',
    author_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merge_commit    VARCHAR(64),
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (repo_id, number)
);

CREATE INDEX IF NOT EXISTS idx_prs_repo   ON pull_requests (repo_id);
CREATE INDEX IF NOT EXISTS idx_prs_author ON pull_requests (author_id);
CREATE INDEX IF NOT EXISTS idx_prs_state  ON pull_requests (state);

-- ============================================================================
-- Issues
-- ============================================================================
CREATE TABLE IF NOT EXISTS issues (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id     UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number      INTEGER      NOT NULL,
    title       VARCHAR(512) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    state       VARCHAR(32)  NOT NULL DEFAULT 'open',
    priority    VARCHAR(32)  NOT NULL DEFAULT 'major',
    kind        VARCHAR(32)  NOT NULL DEFAULT 'bug',
    assignee_id UUID         REFERENCES users(id) ON DELETE SET NULL,
    author_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    closed_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (repo_id, number)
);

CREATE INDEX IF NOT EXISTS idx_issues_repo   ON issues (repo_id);
CREATE INDEX IF NOT EXISTS idx_issues_author ON issues (author_id);
CREATE INDEX IF NOT EXISTS idx_issues_state  ON issues (state);

-- ============================================================================
-- Comments (shared by PRs and issues)
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT        NOT NULL,
    pull_request_id UUID        REFERENCES pull_requests(id) ON DELETE CASCADE,
    issue_id        UUID        REFERENCES issues(id) ON DELETE CASCADE,
    parent_id       UUID        REFERENCES comments(id) ON DELETE CASCADE,
    file_path       TEXT,
    line_number     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (pull_request_id IS NOT NULL OR issue_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_comments_pr    ON comments (pull_request_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments (issue_id);

-- ============================================================================
-- Pipelines
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipelines (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id      UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    commit_hash  VARCHAR(64)  NOT NULL,
    branch       VARCHAR(256) NOT NULL,
    state        VARCHAR(32)  NOT NULL DEFAULT 'pending',
    trigger_type VARCHAR(32)  NOT NULL DEFAULT 'push',
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    duration_ms  INTEGER,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipelines_repo ON pipelines (repo_id);

CREATE TABLE IF NOT EXISTS pipeline_steps (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID         NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name        VARCHAR(256) NOT NULL,
    image       VARCHAR(512) NOT NULL DEFAULT '',
    state       VARCHAR(32)  NOT NULL DEFAULT 'pending',
    exit_code   INTEGER,
    log_url     TEXT         NOT NULL DEFAULT '',
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_steps_pipeline ON pipeline_steps (pipeline_id);

-- ============================================================================
-- Webhooks
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id     UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    url         TEXT         NOT NULL,
    secret      TEXT         NOT NULL DEFAULT '',
    events      TEXT[]       NOT NULL DEFAULT '{}',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_repo ON webhooks (repo_id);

-- ============================================================================
-- Snippets
-- ============================================================================
CREATE TABLE IF NOT EXISTS snippets (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(256) NOT NULL,
    filename   VARCHAR(256) NOT NULL DEFAULT '',
    content    TEXT         NOT NULL DEFAULT '',
    language   VARCHAR(64)  NOT NULL DEFAULT '',
    is_public  BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snippets_author ON snippets (author_id);

-- ============================================================================
-- Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(64) NOT NULL,
    title      VARCHAR(512) NOT NULL,
    body       TEXT        NOT NULL DEFAULT '',
    link       TEXT        NOT NULL DEFAULT '',
    is_read    BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read) WHERE NOT is_read;

-- ============================================================================
-- Wiki pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS wiki_pages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id    UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    slug       VARCHAR(256) NOT NULL,
    title      VARCHAR(512) NOT NULL,
    content    TEXT         NOT NULL DEFAULT '',
    author_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (repo_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_wiki_repo ON wiki_pages (repo_id);

-- ============================================================================
-- Refresh tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ============================================================================
-- OAuth accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    VARCHAR(32)  NOT NULL,
    provider_id VARCHAR(256) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts (user_id);
