-- 006_issues.up.sql
-- Issues, issue comments, labels, and label assignments

-- ============================================================
-- ISSUE ENUMS
-- ============================================================
CREATE TYPE issue_state    AS ENUM ('new', 'open', 'resolved', 'on_hold', 'invalid', 'duplicate', 'wontfix', 'closed');
CREATE TYPE issue_priority AS ENUM ('trivial', 'minor', 'major', 'critical', 'blocker');
CREATE TYPE issue_kind     AS ENUM ('bug', 'enhancement', 'proposal', 'task');

-- ============================================================
-- ISSUES
-- ============================================================
CREATE TABLE issues (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID           NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    number        INT            NOT NULL,
    title         VARCHAR(512)   NOT NULL,
    content       TEXT,
    state         issue_state    NOT NULL DEFAULT 'new',
    priority      issue_priority NOT NULL DEFAULT 'major',
    kind          issue_kind     NOT NULL DEFAULT 'bug',
    author_id     UUID           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    assignee_id   UUID           REFERENCES users (id) ON DELETE SET NULL,
    milestone     VARCHAR(255),
    vote_count    INT            NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_issues_repo_number UNIQUE (repository_id, number),
    CONSTRAINT chk_vote_count CHECK (vote_count >= 0)
);

CREATE INDEX idx_issues_repository_id ON issues (repository_id);
CREATE INDEX idx_issues_author_id     ON issues (author_id);
CREATE INDEX idx_issues_assignee_id   ON issues (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_issues_state         ON issues (repository_id, state);
CREATE INDEX idx_issues_priority      ON issues (repository_id, priority);
CREATE INDEX idx_issues_kind          ON issues (repository_id, kind);
CREATE INDEX idx_issues_milestone     ON issues (repository_id, milestone) WHERE milestone IS NOT NULL;
CREATE INDEX idx_issues_created_at    ON issues (created_at);
CREATE INDEX idx_issues_title_trgm    ON issues USING gin (title gin_trgm_ops);

-- ============================================================
-- ISSUE COMMENTS
-- ============================================================
CREATE TABLE issue_comments (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id  UUID        NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    author_id UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    content   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issue_comments_issue_id  ON issue_comments (issue_id);
CREATE INDEX idx_issue_comments_author_id ON issue_comments (author_id);

-- ============================================================
-- ISSUE LABELS
-- ============================================================
CREATE TABLE issue_labels (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    name          VARCHAR(128) NOT NULL,
    color         CHAR(7)      NOT NULL DEFAULT '#0052CC',  -- hex color
    description   TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_issue_labels_repo_name UNIQUE (repository_id, name)
);

CREATE INDEX idx_issue_labels_repo_id ON issue_labels (repository_id);

-- ============================================================
-- ISSUE LABEL ASSIGNMENTS
-- ============================================================
CREATE TABLE issue_label_assignments (
    id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES issue_labels (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_issue_label_assignments UNIQUE (issue_id, label_id)
);

CREATE INDEX idx_issue_label_assign_issue ON issue_label_assignments (issue_id);
CREATE INDEX idx_issue_label_assign_label ON issue_label_assignments (label_id);
