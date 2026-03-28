-- 004_branches.up.sql
-- Branch restrictions and per-user overrides

-- ============================================================
-- BRANCH RESTRICTIONS
-- ============================================================
CREATE TABLE branch_restrictions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id           UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    branch_pattern          VARCHAR(512) NOT NULL,  -- glob pattern, e.g. 'main', 'release/*'
    require_pr              BOOLEAN      NOT NULL DEFAULT FALSE,
    require_approvals       INT          NOT NULL DEFAULT 0,
    require_passing_builds  INT          NOT NULL DEFAULT 0,
    restrict_pushes         BOOLEAN      NOT NULL DEFAULT FALSE,
    restrict_merges         BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_force_push        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_branch_restrictions_repo_pattern UNIQUE (repository_id, branch_pattern),
    CONSTRAINT chk_require_approvals CHECK (require_approvals >= 0),
    CONSTRAINT chk_require_passing_builds CHECK (require_passing_builds >= 0)
);

CREATE INDEX idx_branch_restrictions_repo_id ON branch_restrictions (repository_id);

-- ============================================================
-- BRANCH RESTRICTION USERS (allowed exceptions)
-- ============================================================
CREATE TABLE branch_restriction_users (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_restriction_id UUID NOT NULL REFERENCES branch_restrictions (id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_branch_restriction_users UNIQUE (branch_restriction_id, user_id)
);

CREATE INDEX idx_branch_restriction_users_restriction ON branch_restriction_users (branch_restriction_id);
CREATE INDEX idx_branch_restriction_users_user        ON branch_restriction_users (user_id);
