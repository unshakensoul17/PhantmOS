-- Master Resume & Profile Data
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_identifier TEXT UNIQUE NOT NULL,
    resume_data JSONB NOT NULL,
    baseline_logs JSONB DEFAULT '{}'::jsonb
);

-- Job Leads Pipeline
CREATE TABLE job_leads (
    job_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    company_url TEXT,
    apply_link TEXT,
    match_score NUMERIC DEFAULT 0.0,
    genuity_status TEXT,
    status TEXT DEFAULT 'Discovered' CHECK (status IN ('Discovered', 'Tailored', 'Sent', 'Dismissed')),
    raw_description TEXT,
    rationale TEXT,
    cold_email TEXT,
    resume_path TEXT,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
