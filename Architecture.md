# Architecture

## Overview
Ghost Protocol operates using a multi-agent system combining Python backend (agents, core logic) with a React/TypeScript frontend (dashboard, landing page). 

## Components
1. **Frontend**: React, Vite, Tailwind CSS, Tanstack Router, Framer Motion. Provides the command center dashboard and ultra-premium landing pages.
2. **Backend**: Python-based orchestration.
3. **Database**: PostgreSQL / SQLite (managed via Python scripts like `schema_v4_global_jobs.sql`).
4. **Agents**: Specialized AI entities (Scout, Analyst, Tailor, Writer, Pilot, Oracle) for different stages of the job application pipeline.
