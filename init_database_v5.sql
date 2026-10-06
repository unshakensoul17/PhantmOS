-- PhantmOS v5.0 — Master Database Initialization Script
-- Run this in your Supabase SQL Editor to instantly recreate the entire architecture.

-- =========================================================================
-- 1. CLEANUP (WARNING: Drops existing tables if they exist)
-- =========================================================================
DROP VIEW IF EXISTS user_job_analytics;
DROP TABLE IF EXISTS stage_logs CASCADE;
DROP TABLE IF EXISTS user_feedback CASCADE;
DROP TABLE IF EXISTS delivery_queue CASCADE;
DROP TABLE IF EXISTS user_job_pipelines CASCADE;
DROP TABLE IF EXISTS global_jobs CASCADE;
DROP TABLE IF EXISTS user_resumes CASCADE;
DROP TABLE IF EXISTS auth_debug_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- =========================================================================
-- 2. CREATE TABLES
-- =========================================================================

-- 2.1 user_profiles (Extended via auth.users trigger)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    credits INTEGER DEFAULT 10,
    encrypted_keys JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    telegram_chat_id TEXT,
    has_gemini_key BOOLEAN DEFAULT FALSE,
    has_groq_key BOOLEAN DEFAULT FALSE,
    has_hf_key BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 user_resumes (Partitioned for performance)
CREATE TABLE user_resumes (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    resume_data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 global_jobs (Centralized Job Pool)
CREATE TABLE global_jobs (
    job_id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    url TEXT,
    source TEXT,
    dedup_hash TEXT UNIQUE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 user_job_pipelines (Multi-tenant link)
CREATE TABLE user_job_pipelines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT REFERENCES global_jobs(job_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Found',
    match_score NUMERIC DEFAULT 0,
    score_band TEXT,
    notes TEXT,
    resume_url TEXT,
    resume_tailored JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- 2.5 Supporting Tables
CREATE TABLE delivery_queue (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id, job_id) REFERENCES user_job_pipelines(user_id, job_id) ON DELETE CASCADE
);

CREATE TABLE user_feedback (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id, job_id) REFERENCES user_job_pipelines(user_id, job_id) ON DELETE CASCADE
);

CREATE TABLE stage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT,
    stage TEXT,
    status TEXT,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id, job_id) REFERENCES user_job_pipelines(user_id, job_id) ON DELETE CASCADE
);

CREATE TABLE auth_debug_logs (
    id SERIAL PRIMARY KEY,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_job_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_debug_logs ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- user_resumes
CREATE POLICY "Users can read own resumes" ON user_resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own resumes" ON user_resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resumes" ON user_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- global_jobs
CREATE POLICY "Read global jobs" ON global_jobs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert global jobs" ON global_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- user_job_pipelines
CREATE POLICY "User job pipeline access" ON user_job_pipelines FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id);

-- Sub-tables (Queue, Feedback, Logs)
CREATE POLICY "Delivery Queue access" ON delivery_queue FOR ALL USING (
    auth.uid() IS NULL OR EXISTS (SELECT 1 FROM user_job_pipelines WHERE user_job_pipelines.job_id = delivery_queue.job_id AND user_job_pipelines.user_id = auth.uid())
);

CREATE POLICY "Feedback access" ON user_feedback FOR ALL USING (
    auth.uid() IS NULL OR EXISTS (SELECT 1 FROM user_job_pipelines WHERE user_job_pipelines.job_id = user_feedback.job_id AND user_job_pipelines.user_id = auth.uid())
);

CREATE POLICY "Stage Logs access" ON stage_logs FOR ALL USING (
    auth.uid() IS NULL OR EXISTS (SELECT 1 FROM user_job_pipelines WHERE user_job_pipelines.job_id = stage_logs.job_id AND user_job_pipelines.user_id = auth.uid())
);

-- =========================================================================
-- 4. TRIGGERS & RPC FUNCTIONS
-- =========================================================================

-- Trigger: Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, credits, created_at, preferences)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Agent ' || substr(new.id::text, 1, 8)),
    10,
    now(),
    '{"llm": {"primary_engine": "groq|llama-3.1-8b-instant", "secondary_engine": "groq|llama-3.1-8b-instant"}, "scoring": {"target_roles": [], "telegram_threshold": 75, "blacklist_companies": [], "blacklist_keywords": []}, "notifications": {"instant_telegram_alerts": true, "daily_digest": true}}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.auth_debug_logs (error_message) VALUES (SQLERRM);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC: decrement_user_credits
CREATE OR REPLACE FUNCTION decrement_user_credits(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_credits INT;
BEGIN
    SELECT credits INTO current_credits FROM user_profiles WHERE id = user_id_param FOR UPDATE;
    IF current_credits IS NULL OR current_credits <= 0 THEN
        RETURN FALSE;
    END IF;
    UPDATE user_profiles SET credits = credits - 1 WHERE id = user_id_param;
    RETURN TRUE;
END;
$$;

-- RPC: get_dashboard_stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(user_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'found', COALESCE(SUM(CASE WHEN LOWER(status) = 'found' THEN 1 ELSE 0 END), 0),
        'tailored', COALESCE(SUM(CASE WHEN LOWER(status) = 'tailored' THEN 1 ELSE 0 END), 0),
        'approved', COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END), 0),
        'applied', COALESCE(SUM(CASE WHEN LOWER(status) = 'applied' THEN 1 ELSE 0 END), 0),
        'dismissed', COALESCE(SUM(CASE WHEN LOWER(status) = 'dismissed' THEN 1 ELSE 0 END), 0),
        'hot', COALESCE(SUM(CASE WHEN LOWER(score_band) IN ('hot', 'a') THEN 1 ELSE 0 END), 0),
        'warm', COALESCE(SUM(CASE WHEN LOWER(score_band) IN ('warm', 'b') THEN 1 ELSE 0 END), 0),
        'cold', COALESCE(SUM(CASE WHEN LOWER(score_band) IN ('cold', 'c') THEN 1 ELSE 0 END), 0)
    ) INTO stats
    FROM user_job_pipelines
    WHERE user_id = user_id_param;
    RETURN stats;
END;
$$;

-- RPC: check_existing_hashes
CREATE OR REPLACE FUNCTION check_existing_hashes(user_id_param UUID, hashes TEXT[])
RETURNS TABLE(dedup_hash TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT j.dedup_hash
    FROM global_jobs j
    JOIN user_job_pipelines p ON j.job_id = p.job_id
    WHERE p.user_id = user_id_param
      AND j.dedup_hash = ANY(hashes);
END;
$$;

-- RPC: search_global_jobs_for_user
CREATE OR REPLACE FUNCTION search_global_jobs_for_user(p_user_id UUID, p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS SETOF global_jobs AS $$
BEGIN
    RETURN QUERY
    SELECT gj.*
    FROM global_jobs gj
    WHERE (gj.title ILIKE '%' || p_query || '%' OR gj.description ILIKE '%' || p_query || '%')
      AND NOT EXISTS (
          SELECT 1 FROM user_job_pipelines ujp
          WHERE ujp.job_id = gj.job_id AND ujp.user_id = p_user_id
      )
    ORDER BY gj.scraped_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: user_job_analytics
CREATE OR REPLACE VIEW user_job_analytics AS
SELECT 
    p.user_id,
    p.match_score AS score,
    g.source
FROM user_job_pipelines p
JOIN global_jobs g ON p.job_id = g.job_id;
