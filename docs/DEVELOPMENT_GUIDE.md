# 💻 Development Guide

This guide is intended for engineers working directly on the PhantmOS v3.0 core architecture. It covers paradigms, workflows, and common pitfalls.

## 1. Core Paradigms

### Stateless Agents
All classes in the `agents/` directory MUST remain stateless.
- Do not store user-specific lists or counters on `self`.
- All state must be pushed to and pulled from the Supabase database.
- *Why?* The pipeline executes concurrently inside a `ProcessPoolExecutor`. Stateful agents will cause memory leaks or data collisions between users.

### The "No Business Logic in Dashboard" Rule
`dashboard.py` and `main_orchestrator.py` are strictly for routing and orchestration.
- If you need to filter a list of jobs, do it in an Agent.
- If you need to parse a resume, do it in a Synthesizer.
- The Dashboard should only call DB functions and return JSON responses.

### Error Swallowing
The orchestration pipeline must **never** crash entirely due to one failed job or one missing API key.
- Wrap all external API calls in `try/except` blocks.
- Log the failure using `logger.error()`.
- Return a fallback value (e.g., `{"error": str(e)}` or `[]`) so the orchestrator can proceed to the next stage or user.

## 2. Adding a New Job Harvester

If you want to add a new job board (e.g., LinkedIn, Indeed):
1. Create `source_newboard.py` in the `/harvesting` folder.
2. Implement an `async def fetch_jobs(query: str) -> list[dict]` function.
3. Your function must normalize the API's JSON output into the standard PhantmOS lead format:
   ```python
   {
       "job_id": "unique_id_from_source",
       "company": "Company Name",
       "title": "Job Title",
       "description": "Full HTML or Text description",
       "url": "https://apply.url",
       "source": "NewBoard"
   }
   ```
4. Import and append your fetcher to the `run_harvest()` tasks in `harvesting/harvest_orchestrator.py`.

## 3. Database Modifications

If you need to change the database structure:
1. Do not modify the Supabase schema directly via the UI in production.
2. Create a new SQL file in `/migrations` (e.g., `schema_v6_new_feature.sql`).
3. Ensure the SQL script is idempotent (use `IF NOT EXISTS` or `CREATE OR REPLACE`).
4. Apply it locally or to a staging Supabase instance first.

## 4. Modifying the Frontend

The frontend uses **Tanstack Router** for file-based routing.
- To add a new page, create a `.tsx` file inside `frontend/src/routes`.
- Run `npm run dev` to let Tanstack automatically generate the route tree in `routeTree.gen.ts`.
- Use Radix UI primitives (`src/components/ui/`) combined with Tailwind utility classes for styling. Avoid writing raw CSS.

## 5. Testing & Debugging

- **Simulating the Pipeline:** You can manually trigger the pipeline for a single user via the frontend dashboard ("Run Pipeline" button) or via the admin API `POST /api/admin/users/{user_id}/harvest`.
- **Database Triggers:** If user profiles are not being created upon signup, check the `auth_debug_logs` table in Supabase. The `schema_v5` trigger logs exceptions there.
- **LLM Token Limits:** Groq has strict payload size limits. The `dashboard.py` upload route aggressively truncates parsed resumes to `< 10,000` characters. Keep this in mind when passing context to `call_groq()`.
