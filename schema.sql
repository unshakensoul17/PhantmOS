-- ─────────────────────────────────────────────────────────
--  GHOST PROTOCOL — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────
--  TABLE: user_profiles
--  Stores the master professional identity of the job seeker.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     TEXT        NOT NULL,
    email         TEXT,
    phone         TEXT,
    github_url    TEXT        DEFAULT 'https://github.com/unshakensoul17',
    linkedin_url  TEXT,
    portfolio_url TEXT,
    resume_data   JSONB,                   -- Raw master resume (JSON structure)
    tech_stack    JSONB,                  -- e.g. {"skills": ["Python", "FastAPI"], "years_exp": 3}
    location      TEXT        DEFAULT 'Indore, Madhya Pradesh, India',
    timezone      TEXT        DEFAULT 'Asia/Kolkata',
    embedding     VECTOR(384),            -- 384-dimensional vector from all-MiniLM-L6-v2
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profiles_updated ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────
--  TABLE: job_leads
--  Tracks every discovered job through the pipeline lifecycle.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_leads (
    job_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT        NOT NULL,
    company         TEXT        NOT NULL,
    match_score     FLOAT       CHECK (match_score >= 0.0 AND match_score <= 1.0),
    status          TEXT        NOT NULL DEFAULT 'Found'
                                CHECK (status IN ('Found', 'Tailored', 'Approved', 'Applied')),
    job_url         TEXT        UNIQUE NOT NULL,
    genuity_flag    BOOLEAN     DEFAULT TRUE,   -- FALSE = suspected ghost/spam posting
    source_platform TEXT,                       -- 'linkedin', 'naukri', 'indeed', etc.
    raw_description TEXT,                       -- Full JD text for embedding
    notes           TEXT,
    embedding       VECTOR(384),                -- 384-dimensional vector from all-MiniLM-L6-v2
    applied_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_job_leads_updated ON job_leads;
CREATE TRIGGER trg_job_leads_updated
    BEFORE UPDATE ON job_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for fast status-based filtering
CREATE INDEX IF NOT EXISTS idx_job_leads_status ON job_leads(status);
CREATE INDEX IF NOT EXISTS idx_job_leads_match_score ON job_leads(match_score DESC);

-- ─────────────────────────────────────────────────────────
--  VECTOR SEARCH RPC: query_similar_jobs
--  Searches for job leads similar to a given query embedding
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION query_similar_jobs(
    query_embedding VECTOR(384),
    match_count INT DEFAULT 5
) RETURNS TABLE (
    id UUID,
    job_id UUID,
    title TEXT,
    company TEXT,
    raw_description TEXT,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id, -- internal row UUID
        j.job_id, -- external/logical job UUID
        j.title, 
        j.company, 
        j.raw_description,
        1 - (j.embedding <=> query_embedding) AS similarity
    FROM job_leads j
    WHERE j.embedding IS NOT NULL
    ORDER BY j.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;


-- ─────────────────────────────────────────────────────────
--  SEED: Insert Akash's baseline profile
--  (Update resume_text and linkedin_url before running)
-- ─────────────────────────────────────────────────────────
INSERT INTO user_profiles (
    full_name,
    email,
    github_url,
    linkedin_url,
    resume_data,
    tech_stack,
    location,
    timezone
) VALUES (
    'Akash Yaduwanshi',
    'aakashyaduwanshi0470@gmail.com',
    'https://github.com/unshakensoul17',
    'https://www.linkedin.com/in/akash-yaduwanshi-902a3b352',
    '{
      "cv": {
        "name": "Akash Yaduwanshi",
        "location": "Indore, India",
        "email": "aakashyaduwanshi0470@gmail.com",
        "phone": "+91-7772074181",
        "social_networks": [
          {
            "network": "LinkedIn",
            "username": "akash-yaduwanshi",
            "url": "https://www.linkedin.com/in/akash-yaduwanshi-902a3b352"
          },
          {
            "network": "GitHub",
            "username": "unshakensoul17",
            "url": "https://github.com/unshakensoul17"
          }
        ],
        "sections": {
          "summary": [
            "Aspiring AI Engineer & Machine Learning Researcher with hands-on experience in building end-to-end intelligent systems, including NLP pipelines, transformer-based models, and real-time AI services. Specialized in representation learning, LLM integration, and scalable system design, with proven results in improving model performance and deploying production-ready AI solutions."
          ],
          "education": [
            {
              "institution": "Holkar Science College, Indore",
              "area": "Bachelor of Computer Applications (BCA)",
              "end_date": "2027",
              "highlights": [
                "CGPA: 8.60 / 10.0"
              ]
            }
          ],
          "experience": [
            {
              "company": "Sentinel Flow — AI Code Intelligence System",
              "position": "Project",
              "highlights": [
                "Engineered a VS Code extension that parses and indexes codebases into interactive knowledge graphs, scaling to 50,000+ symbols with sub-second SQLite query performance.",
                "Designed a dual-path AI routing system (Groq, Gemini, Bedrock) delivering <300ms responses for quick insights and deep architectural analysis within the editor.",
                "Built graph-based visualizations using React and ELK.js to detect technical debt and map change impact (blast radius).",
                "Optimized AST parsing using worker-thread isolation, reducing update latency to <500ms while maintaining UI responsiveness."
              ]
            },
            {
              "company": "Inducing Compositional Reasoning via Architectural Bottlenecks",
              "position": "Project",
              "highlights": [
                "Implemented slot-based reasoning bottlenecks in small Transformers to induce compositional generalization, improving mean accuracy from ~0.55 to ~0.71 on the SCAN benchmark while keeping model size constant.",
                "Investigated the emergence of reasoning as a capacity-dependent phase transition, identifying instability across random initializations.",
                "Evaluated hybrid quantum-classical bottlenecks, demonstrating the performance impact of lack of structured inductive bias in naive quantum feature maps."
              ]
            },
            {
              "company": "AI Resume Analyzer — NLP-Based Scoring System",
              "position": "Project",
              "highlights": [
                "Developed an end-to-end ML system combining semantic embeddings with engineered features (ATS metrics, skills, experience) to produce category-wise relevance scores.",
                "Designed a multi-head attention scoring model with multi-task outputs and deployed the service via FastAPI for real-time evaluation.",
                "Implemented robust document parsing for PDF/DOCX/TXT to extract structured data for downstream analysis."
              ]
            },
            {
              "company": "SmartCart Customer Segmentation — Unsupervised ML Pipeline",
              "position": "Project",
              "highlights": [
                "Engineered a robust unsupervised pipeline identifying 4 actionable customer segments for targeted marketing insights.",
                "Applied PCA for dimensionality reduction and validated cluster quality using silhouette scores and business-focused profiling."
              ]
            }
          ],
          "skills": [
            {
              "label": "Programming",
              "details": "Python (Expert), SQL, C/C++, TypeScript"
            },
            {
              "label": "AI / Machine Learning",
              "details": "PyTorch, TensorFlow, Hugging Face Transformers, NLP, LLMs, Scikit-learn, SentenceTransformers"
            },
            {
              "label": "Systems & Deployment",
              "details": "FastAPI, Docker, Redis, PostgreSQL, SQLite, Meilisearch, Github"
            },
            {
              "label": "Data Tools",
              "details": "Pandas, NumPy, Matplotlib, Seaborn, PCA, Clustering"
            },
            {
              "label": "Other",
              "details": "Git, Linux (Mint), Github, VS Code Extension Development"
            }
          ],
          "certifications": [
            {
              "name": "Python Programming Certification — Programmers Point, Indore"
            },
            {
              "name": "Built and published multiple AI projects on GitHub; comfortable with end-to-end ML pipeline and deployment."
            }
          ]
        }
      }
    }'::jsonb,
    '{"skills": ["Python", "PyTorch", "Transformers", "FastAPI", "TypeScript", "React"], "years_exp": 2, "preferred_roles": ["AI Engineer", "Machine Learning Researcher", "Backend Engineer"]}',
    'Indore, Madhya Pradesh, India',
    'Asia/Kolkata'
) ON CONFLICT DO NOTHING;
