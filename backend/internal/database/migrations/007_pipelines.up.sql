-- 007_pipelines.up.sql
-- Pipeline configs, runs, and steps

-- ============================================================
-- PIPELINE CONFIGS
-- ============================================================
CREATE TABLE pipeline_configs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id UUID        NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    yaml_content  TEXT        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_configs_repo_id ON pipeline_configs (repository_id);

-- ============================================================
-- PIPELINE ENUMS
-- ============================================================
CREATE TYPE pipeline_trigger_type AS ENUM ('push', 'pull_request', 'manual', 'scheduled', 'tag', 'api');
CREATE TYPE pipeline_status       AS ENUM ('pending', 'running', 'successful', 'failed', 'stopped', 'skipped');

-- ============================================================
-- PIPELINE RUNS
-- ============================================================
CREATE TABLE pipeline_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id   UUID                  NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    config_id       UUID                  NOT NULL REFERENCES pipeline_configs (id) ON DELETE RESTRICT,
    number          INT                   NOT NULL,
    trigger_type    pipeline_trigger_type NOT NULL DEFAULT 'push',
    branch          VARCHAR(255),
    commit_hash     VARCHAR(64)           NOT NULL,
    status          pipeline_status       NOT NULL DEFAULT 'pending',
    triggered_by_id UUID                  REFERENCES users (id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INT,
    created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pipeline_runs_repo_number UNIQUE (repository_id, number),
    CONSTRAINT chk_duration_ms CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX idx_pipeline_runs_repo_id       ON pipeline_runs (repository_id);
CREATE INDEX idx_pipeline_runs_config_id     ON pipeline_runs (config_id);
CREATE INDEX idx_pipeline_runs_status        ON pipeline_runs (status);
CREATE INDEX idx_pipeline_runs_branch        ON pipeline_runs (repository_id, branch);
CREATE INDEX idx_pipeline_runs_triggered_by  ON pipeline_runs (triggered_by_id) WHERE triggered_by_id IS NOT NULL;
CREATE INDEX idx_pipeline_runs_created_at    ON pipeline_runs (created_at);

-- ============================================================
-- PIPELINE STEP STATUS ENUM
-- ============================================================
CREATE TYPE pipeline_step_status AS ENUM ('pending', 'running', 'successful', 'failed', 'stopped', 'skipped');

-- ============================================================
-- PIPELINE STEPS
-- ============================================================
CREATE TABLE pipeline_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id UUID                 NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
    name            VARCHAR(255)         NOT NULL,
    step_order      INT                  NOT NULL,
    image           VARCHAR(512),
    status          pipeline_step_status NOT NULL DEFAULT 'pending',
    log_output      TEXT,
    exit_code       INT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_pipeline_steps_run_order UNIQUE (pipeline_run_id, step_order),
    CONSTRAINT chk_step_order CHECK (step_order >= 0)
);

CREATE INDEX idx_pipeline_steps_run_id ON pipeline_steps (pipeline_run_id);
CREATE INDEX idx_pipeline_steps_status ON pipeline_steps (status);
