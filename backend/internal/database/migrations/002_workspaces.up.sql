-- 002_workspaces.up.sql
-- Workspaces, workspace members, groups, and group members

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(128) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url  TEXT,
    is_private  BOOLEAN      NOT NULL DEFAULT FALSE,
    owner_id    UUID         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_workspaces_slug UNIQUE (slug)
);

CREATE INDEX idx_workspaces_owner_id   ON workspaces (owner_id);
CREATE INDEX idx_workspaces_slug_trgm  ON workspaces USING gin (slug gin_trgm_ops);
CREATE INDEX idx_workspaces_created_at ON workspaces (created_at);

-- ============================================================
-- WORKSPACE ROLE ENUM
-- ============================================================
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'collaborator', 'member');

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE workspace_members (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID           NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role         workspace_role NOT NULL DEFAULT 'member',
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_workspace_members UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user_id      ON workspace_members (user_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members (workspace_id);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID         NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    slug         VARCHAR(128) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    auto_add     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_groups_workspace_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX idx_groups_workspace_id ON groups (workspace_id);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE group_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id   UUID        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_group_members UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user_id  ON group_members (user_id);
CREATE INDEX idx_group_members_group_id ON group_members (group_id);
