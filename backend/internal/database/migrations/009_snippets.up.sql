-- 009_snippets.up.sql
-- Snippets and snippet files

-- ============================================================
-- SNIPPETS
-- ============================================================
CREATE TABLE snippets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(512) NOT NULL,
    description  TEXT,
    is_private   BOOLEAN      NOT NULL DEFAULT FALSE,
    author_id    UUID         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    workspace_id UUID         REFERENCES workspaces (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snippets_author_id    ON snippets (author_id);
CREATE INDEX idx_snippets_workspace_id ON snippets (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_snippets_is_private   ON snippets (is_private);
CREATE INDEX idx_snippets_created_at   ON snippets (created_at);
CREATE INDEX idx_snippets_title_trgm   ON snippets USING gin (title gin_trgm_ops);

-- ============================================================
-- SNIPPET FILES
-- ============================================================
CREATE TABLE snippet_files (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snippet_id UUID         NOT NULL REFERENCES snippets (id) ON DELETE CASCADE,
    filename   VARCHAR(512) NOT NULL,
    language   VARCHAR(64),
    content    TEXT         NOT NULL DEFAULT '',
    sort_order INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_snippet_files_snippet_filename UNIQUE (snippet_id, filename),
    CONSTRAINT chk_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX idx_snippet_files_snippet_id ON snippet_files (snippet_id);
