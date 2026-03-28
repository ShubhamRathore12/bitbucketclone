-- 010_notifications.up.sql
-- Notifications and activity events

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type          VARCHAR(64)  NOT NULL,   -- e.g. 'pr_review', 'issue_assigned', 'mention'
    title         VARCHAR(512) NOT NULL,
    body          TEXT,
    link          TEXT,
    is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
    actor_id      UUID         REFERENCES users (id) ON DELETE SET NULL,
    resource_type VARCHAR(64),             -- e.g. 'pull_request', 'issue', 'repository'
    resource_id   UUID,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id        ON notifications (user_id);
CREATE INDEX idx_notifications_user_unread    ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_actor_id       ON notifications (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_notifications_resource       ON notifications (resource_type, resource_id) WHERE resource_type IS NOT NULL;
CREATE INDEX idx_notifications_created_at     ON notifications (created_at);
CREATE INDEX idx_notifications_type           ON notifications (user_id, type);

-- ============================================================
-- ACTIVITY EVENTS
-- ============================================================
CREATE TABLE activity_events (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id  UUID         REFERENCES workspaces (id) ON DELETE CASCADE,
    repository_id UUID         REFERENCES repositories (id) ON DELETE CASCADE,
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_type    VARCHAR(64)  NOT NULL,   -- e.g. 'repo:push', 'pr:created', 'issue:commented'
    summary       VARCHAR(512) NOT NULL,
    details       JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_events_workspace_id  ON activity_events (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_activity_events_repository_id ON activity_events (repository_id) WHERE repository_id IS NOT NULL;
CREATE INDEX idx_activity_events_user_id       ON activity_events (user_id);
CREATE INDEX idx_activity_events_event_type    ON activity_events (event_type);
CREATE INDEX idx_activity_events_created_at    ON activity_events (created_at);
CREATE INDEX idx_activity_events_details       ON activity_events USING gin (details jsonb_path_ops);
