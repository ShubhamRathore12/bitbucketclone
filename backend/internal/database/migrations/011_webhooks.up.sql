-- 011_webhooks.up.sql
-- Webhooks and webhook delivery log

-- ============================================================
-- WEBHOOKS
-- ============================================================
CREATE TABLE webhooks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID         NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    url           TEXT         NOT NULL,
    secret        TEXT,
    events        TEXT[]       NOT NULL DEFAULT '{}',   -- e.g. {'repo:push','pr:created','issue:updated'}
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_repo_id   ON webhooks (repository_id);
CREATE INDEX idx_webhooks_is_active ON webhooks (repository_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_webhooks_events    ON webhooks USING gin (events);

-- ============================================================
-- WEBHOOK DELIVERIES
-- ============================================================
CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id      UUID        NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
    event           VARCHAR(128) NOT NULL,
    payload         JSONB       NOT NULL,
    response_status INT,
    response_body   TEXT,
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms     INT,

    CONSTRAINT chk_delivery_duration CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX idx_webhook_deliveries_webhook_id    ON webhook_deliveries (webhook_id);
CREATE INDEX idx_webhook_deliveries_event         ON webhook_deliveries (event);
CREATE INDEX idx_webhook_deliveries_delivered_at  ON webhook_deliveries (delivered_at);
CREATE INDEX idx_webhook_deliveries_status        ON webhook_deliveries (response_status);
CREATE INDEX idx_webhook_deliveries_payload       ON webhook_deliveries USING gin (payload jsonb_path_ops);
