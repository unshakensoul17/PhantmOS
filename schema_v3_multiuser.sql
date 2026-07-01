-- ─────────────────────────────────────────────────────────
--  GHOST PROTOCOL v3.0 — Multi-User RLS Migration
--  Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────

-- 1. Alter user_profiles for multi-user credentials
-- Clean up any legacy dummy profiles that do not exist in auth.users to prevent FK constraints failure
DELETE FROM user_profiles WHERE id NOT IN (SELECT id FROM auth.users);

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_auth_users;
ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 20,
    ADD COLUMN IF NOT EXISTS encrypted_keys JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. Alter job_leads for multi-user ownership
ALTER TABLE job_leads
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_job_leads_user_id ON job_leads(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_logs ENABLE ROW LEVEL SECURITY;

-- 4. Re-create RLS Policies safely
DROP POLICY IF EXISTS user_profiles_policy ON user_profiles;
CREATE POLICY user_profiles_policy ON user_profiles
    FOR ALL USING (auth.uid() IS NULL OR auth.uid() = id);

DROP POLICY IF EXISTS job_leads_policy ON job_leads;
CREATE POLICY job_leads_policy ON job_leads
    FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS delivery_queue_policy ON delivery_queue;
CREATE POLICY delivery_queue_policy ON delivery_queue
    FOR ALL USING (
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM job_leads
            WHERE job_leads.job_id = delivery_queue.job_id
              AND job_leads.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS user_feedback_policy ON user_feedback;
CREATE POLICY user_feedback_policy ON user_feedback
    FOR ALL USING (
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM job_leads
            WHERE job_leads.job_id = user_feedback.job_id
              AND job_leads.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS stage_logs_policy ON stage_logs;
CREATE POLICY stage_logs_policy ON stage_logs
    FOR ALL USING (
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM job_leads
            WHERE job_leads.job_id = stage_logs.job_id
              AND job_leads.user_id = auth.uid()
        )
    );
