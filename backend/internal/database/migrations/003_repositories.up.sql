-- 003_repositories.up.sql
-- Repositories and repository permissions

-- ============================================================
-- REPOSITORIES
-- ============================================================
CREATE TABLE repositories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID         NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    slug            VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    is_private      BOOLEAN      NOT NULL DEFAULT TRUE,
    forked_from_id  UUID         REFERENCES repositories (id) ON DELETE SET NULL,
    default_branch  VARCHAR(255) NOT NULL DEFAULT 'main',
    language        VARCHAR(64),
    size_bytes      BIGINT       NOT NULL DEFAULT 0,
    disk_path       TEXT         NOT NULL,
    has_issues      BOOLEAN      NOT NULL DEFAULT TRUE,
    has_wiki        BOOLEAN      NOT NULL DEFAULT TRUE,
    has_pipelines   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_repositories_workspace_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX idx_repositories_workspace_id  ON repositories (workspace_id);
CREATE INDEX idx_repositories_forked_from   ON repositories (forked_from_id) WHERE forked_from_id IS NOT NULL;
CREATE INDEX idx_repositories_language      ON repositories (language) WHERE language IS NOT NULL;
CREATE INDEX idx_repositories_is_private    ON repositories (is_private);
CREATE INDEX idx_repositories_created_at    ON repositories (created_at);
CREATE INDEX idx_repositories_name_trgm     ON repositories USING gin (name gin_trgm_ops);
CREATE INDEX idx_repositories_slug_trgm     ON repositories USING gin (slug gin_trgm_ops);

-- ============================================================
-- REPO PERMISSION ENUM
-- ============================================================
CREATE TYPE repo_permission AS ENUM ('admin', 'write', 'read');

-- ============================================================
-- REPOSITORY PERMISSIONS
-- ============================================================
CREATE TABLE repository_permissions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID            NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    user_id       UUID            REFERENCES users (id) ON DELETE CASCADE,
    group_id      UUID            REFERENCES groups (id) ON DELETE CASCADE,
    permission    repo_permission NOT NULL DEFAULT 'read',
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Either user_id or group_id must be set, but not both
    CONSTRAINT chk_repo_perm_target CHECK (
        (user_id IS NOT NULL AND group_id IS NULL) OR
        (user_id IS NULL AND group_id IS NOT NULL)
    ),
    CONSTRAINT uq_repo_perm_user  UNIQUE (repository_id, user_id),
    CONSTRAINT uq_repo_perm_group UNIQUE (repository_id, group_id)
);

CREATE INDEX idx_repo_permissions_repo_id  ON repository_permissions (repository_id);
CREATE INDEX idx_repo_permissions_user_id  ON repository_permissions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_repo_permissions_group_id ON repository_permissions (group_id) WHERE group_id IS NOT NULL;
