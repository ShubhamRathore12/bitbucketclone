-- 005_pull_requests.up.sql
-- Pull requests, reviewers, comments (threaded + inline), activity log

-- ============================================================
-- PR STATE ENUM
-- ============================================================
CREATE TYPE pr_state AS ENUM ('open', 'merged', 'declined', 'superseded');

-- ============================================================
-- PULL REQUESTS
-- ============================================================
CREATE TABLE pull_requests (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id        UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    number               INT          NOT NULL,
    title                VARCHAR(512) NOT NULL,
    description          TEXT,
    state                pr_state     NOT NULL DEFAULT 'open',
    author_id            UUID         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    source_branch        VARCHAR(255) NOT NULL,
    destination_branch   VARCHAR(255) NOT NULL,
    source_commit_hash   VARCHAR(64),
    dest_commit_hash     VARCHAR(64),
    merge_commit_hash    VARCHAR(64),
    close_source_branch  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    merged_at            TIMESTAMPTZ,
    closed_at            TIMESTAMPTZ,

    CONSTRAINT uq_pull_requests_repo_number UNIQUE (repository_id, number)
);

CREATE INDEX idx_pr_repository_id ON pull_requests (repository_id);
CREATE INDEX idx_pr_author_id     ON pull_requests (author_id);
CREATE INDEX idx_pr_state         ON pull_requests (state);
CREATE INDEX idx_pr_created_at    ON pull_requests (created_at);
CREATE INDEX idx_pr_source_branch ON pull_requests (repository_id, source_branch);
CREATE INDEX idx_pr_dest_branch   ON pull_requests (repository_id, destination_branch);

-- ============================================================
-- PR REVIEWER STATUS ENUM
-- ============================================================
CREATE TYPE pr_reviewer_status AS ENUM ('pending', 'approved', 'changes_requested', 'declined');

-- ============================================================
-- PR REVIEWERS
-- ============================================================
CREATE TABLE pr_reviewers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID               NOT NULL REFERENCES pull_requests (id) ON DELETE CASCADE,
    user_id         UUID               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status          pr_reviewer_status NOT NULL DEFAULT 'pending',
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pr_reviewers UNIQUE (pull_request_id, user_id)
);

CREATE INDEX idx_pr_reviewers_pr_id   ON pr_reviewers (pull_request_id);
CREATE INDEX idx_pr_reviewers_user_id ON pr_reviewers (user_id);

-- ============================================================
-- PR COMMENTS (threaded, inline code review)
-- ============================================================
CREATE TABLE pr_comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID        NOT NULL REFERENCES pull_requests (id) ON DELETE CASCADE,
    author_id       UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    parent_id       UUID        REFERENCES pr_comments (id) ON DELETE CASCADE,
    content         TEXT        NOT NULL,

    -- Inline / code-review fields (NULL when it is a general comment)
    file_path       TEXT,
    line_number     INT,
    commit_hash     VARCHAR(64),

    is_ai_generated BOOLEAN     NOT NULL DEFAULT FALSE,
    is_resolved     BOOLEAN     NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_inline_fields CHECK (
        (file_path IS NULL AND line_number IS NULL AND commit_hash IS NULL) OR
        (file_path IS NOT NULL AND line_number IS NOT NULL)
    )
);

CREATE INDEX idx_pr_comments_pr_id     ON pr_comments (pull_request_id);
CREATE INDEX idx_pr_comments_author_id ON pr_comments (author_id);
CREATE INDEX idx_pr_comments_parent_id ON pr_comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_pr_comments_file_path ON pr_comments (pull_request_id, file_path) WHERE file_path IS NOT NULL;

-- ============================================================
-- PR ACTIVITY LOG
-- ============================================================
CREATE TYPE pr_activity_type AS ENUM (
    'created', 'updated', 'approved', 'changes_requested',
    'declined', 'merged', 'comment', 'status_change',
    'reviewer_added', 'reviewer_removed', 'commit_pushed'
);

CREATE TABLE pr_activity (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pull_request_id UUID             NOT NULL REFERENCES pull_requests (id) ON DELETE CASCADE,
    user_id         UUID             REFERENCES users (id) ON DELETE SET NULL,
    activity_type   pr_activity_type NOT NULL,
    summary         TEXT,
    details         JSONB,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pr_activity_pr_id      ON pr_activity (pull_request_id);
CREATE INDEX idx_pr_activity_user_id    ON pr_activity (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_pr_activity_created_at ON pr_activity (created_at);
