-- Ghost Protocol v3.0 Migration
-- Phase 3: Deep Optimizations (Resume Partitioning, Boolean Flags, Array UNNEST)
-- Run this in your Supabase SQL Editor

-- =========================================================================
-- 1. OPTIMIZATION #2: RESUME JSON PARTITIONING
-- =========================================================================
CREATE TABLE IF NOT EXISTS user_resumes (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    resume_data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Migrate existing resumes
INSERT INTO user_resumes (user_id, resume_data)
SELECT id, COALESCE(resume_data, '{}'::jsonb)
FROM user_profiles
WHERE resume_data IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET resume_data = EXCLUDED.resume_data;

-- (We will leave the resume_data column on user_profiles for a few days as a fallback, 
-- but the backend will stop fetching it to eliminate the I/O bloat)

-- =========================================================================
-- 2. OPTIMIZATION #3: CRYPTOGRAPHIC CPU LEAK (BOOLEAN FLAGS)
-- =========================================================================
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS has_gemini_key BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_groq_key BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_hf_key BOOLEAN DEFAULT FALSE;

-- =========================================================================
-- 3. OPTIMIZATION #4: IN-CLAUSE SEQUENCE SCAN REPLACEMENT
-- =========================================================================
-- Uses Postgres ANY() array operator which is index-aware for large sets
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
