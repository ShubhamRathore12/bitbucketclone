-- 008_wiki.up.sql
-- Wiki pages and page revisions

-- ============================================================
-- WIKI PAGES
-- ============================================================
CREATE TABLE wiki_pages (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    slug          VARCHAR(512) NOT NULL,
    title         VARCHAR(512) NOT NULL,
    content       TEXT         NOT NULL DEFAULT '',
    author_id     UUID         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    parent_id     UUID         REFERENCES wiki_pages (id) ON DELETE SET NULL,
    sort_order    INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wiki_pages_repo_slug UNIQUE (repository_id, slug)
);

CREATE INDEX idx_wiki_pages_repo_id   ON wiki_pages (repository_id);
CREATE INDEX idx_wiki_pages_author_id ON wiki_pages (author_id);
CREATE INDEX idx_wiki_pages_parent_id ON wiki_pages (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_wiki_pages_title_trgm ON wiki_pages USING gin (title gin_trgm_ops);

-- ============================================================
-- WIKI PAGE REVISIONS
-- ============================================================
CREATE TABLE wiki_page_revisions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wiki_page_id UUID        NOT NULL REFERENCES wiki_pages (id) ON DELETE CASCADE,
    revision     INT         NOT NULL,
    title        VARCHAR(512) NOT NULL,
    content      TEXT        NOT NULL,
    author_id    UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    message      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wiki_revisions_page_rev UNIQUE (wiki_page_id, revision)
);

CREATE INDEX idx_wiki_revisions_page_id   ON wiki_page_revisions (wiki_page_id);
CREATE INDEX idx_wiki_revisions_author_id ON wiki_page_revisions (author_id);
