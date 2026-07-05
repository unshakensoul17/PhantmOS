-- Ghost Protocol v3.0 Migration
-- Phase 2: High-Performance Read & API Scaling
-- Run this in your Supabase SQL Editor

-- =========================================================================
-- 1. FOREIGN KEY CASCADE DELETE
-- =========================================================================
-- Ensures that if a job is removed globally, it instantly clears from user pipelines.
-- Note: Replace 'user_job_pipelines_job_id_fkey' with your actual constraint name if different.
-- First, safely remove existing loose constraint
ALTER TABLE user_job_pipelines 
DROP CONSTRAINT IF EXISTS user_job_pipelines_job_id_fkey;

-- Then add strict cascading constraint
ALTER TABLE user_job_pipelines 
ADD CONSTRAINT user_job_pipelines_job_id_fkey 
FOREIGN KEY (job_id) 
REFERENCES global_jobs (job_id) 
ON DELETE CASCADE;

-- =========================================================================
-- 2. DASHBOARD STATS AGGREGATION RPC
-- =========================================================================
-- This replaces the O(N) Python loop that was pulling all rows into memory.
-- It returns a JSON object containing precisely what the dashboard needs.

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

    -- Note: To fully aggregate source counts and histograms entirely in SQL, 
    -- we would add subqueries here. However, to keep it simple and perfectly 
    -- compatible with the existing API structure, we return the core stats 
    -- here and let the backend query the sources/scores via a lightweight view.

    RETURN stats;
END;
$$;

-- =========================================================================
-- 3. SCORE & SOURCE DISTRIBUTION VIEW
-- =========================================================================
-- A lightweight view to quickly grab just the sources and scores 
-- without pulling full descriptions and metadata into Python.

CREATE OR REPLACE VIEW user_job_analytics AS
SELECT 
    p.user_id,
    p.match_score AS score,
    g.source
FROM user_job_pipelines p
JOIN global_jobs g ON p.job_id = g.job_id;
