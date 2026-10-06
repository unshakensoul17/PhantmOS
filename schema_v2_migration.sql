-- ─────────────────────────────────────────────────────────
--  GHOST PROTOCOL v2.0 — Additive Migration
--  Run this ONCE in: Supabase Dashboard → SQL Editor
--
--  Safe to run on an existing v1 database.
--  Does NOT drop or truncate any existing tables.
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
--  PART 1: Extend job_leads with v2 columns
-- ─────────────────────────────────────────────────────────

-- Score band: HOT / WARM / COLD / REJECT
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS score_band TEXT
        CHECK (score_band IN ('HOT', 'WARM', 'COLD', 'REJECT'));

-- Breakdown of the three scoring signals
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
    -- Example: {"semantic": 0.82, "keyword": 0.71, "title": 1.0, "final": 87.3}

-- Supabase Storage public URL for the tailored PDF
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Which API the job came from
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS source TEXT;
    -- 'remotive' | 'remoteok' | 'arbeitnow' | 'themuse' | 'hn'

-- Deduplication hash (MD5 of lower(company_name) + lower(title))
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS dedup_hash TEXT UNIQUE;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_job_leads_dedup_hash ON job_leads(dedup_hash);

-- Extend status check to include Dismissed (v1 used it in code but not in constraint)
-- We drop and recreate the constraint to add Dismissed safely.
ALTER TABLE job_leads DROP CONSTRAINT IF EXISTS job_leads_status_check;
ALTER TABLE job_leads
    ADD CONSTRAINT job_leads_status_check
        CHECK (status IN ('Found', 'Tailored', 'Approved', 'Applied', 'Dismissed'));

-- ─────────────────────────────────────────────────────────
--  PART 2: company_context — cached DuckDuckGo scrapes
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_context (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT        UNIQUE NOT NULL,
    context      TEXT,
    scraped_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Computed column: how many days old is the cached entry
-- (Supabase/Postgres 12+ supports GENERATED ALWAYS)
-- Note: if your Postgres version doesn't support it, replace with a view or app-level check.
DO $$
BEGIN
    -- Add age_days as a regular column if GENERATED ALWAYS is not supported
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'company_context' AND column_name = 'age_days'
    ) THEN
        ALTER TABLE company_context
            ADD COLUMN age_days INTEGER
            GENERATED ALWAYS AS
                (EXTRACT(DAY FROM NOW() - scraped_at)::INTEGER)
            STORED;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: add as plain column, app will compute age
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'company_context' AND column_name = 'age_days'
    ) THEN
        ALTER TABLE company_context ADD COLUMN age_days INTEGER DEFAULT 0;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────
--  PART 3: delivery_queue — reliable message delivery
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_queue (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       UUID        REFERENCES job_leads(job_id) ON DELETE CASCADE,
    status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'sent', 'failed')),
    attempts     INTEGER     DEFAULT 0,
    last_attempt TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_queue_status ON delivery_queue(status);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_job_id ON delivery_queue(job_id);

-- ─────────────────────────────────────────────────────────
--  PART 4: user_feedback — learning loop
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_feedback (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID        REFERENCES job_leads(job_id) ON DELETE CASCADE,
    action      TEXT        NOT NULL
                            CHECK (action IN ('apply', 'skip', 'review')),
    skip_reason TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
--  PART 5: embedding_cache — master resume embedding stored once
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS embedding_cache (
    key        TEXT        PRIMARY KEY,
    embedding  VECTOR(384),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
--  PART 6: stage_logs — per-job pipeline audit trail
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stage_logs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id     UUID,       -- nullable: some logs are pipeline-level, not per-job
    stage      TEXT        NOT NULL,
    status     TEXT        NOT NULL
                           CHECK (status IN ('success', 'failure')),
    message    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_logs_job_id ON stage_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_stage_logs_stage  ON stage_logs(stage);

-- ─────────────────────────────────────────────────────────
--  Done.
-- ─────────────────────────────────────────────────────────
