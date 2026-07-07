# 🚀 Deployment Guide

PhantmOS is designed to be deployed as a unified Docker container, making it compatible with Hugging Face Spaces, Render, Railway, or standard VPS environments.

## 1. Production Build Strategy

The repository utilizes a "Unified Container" approach:
- The React frontend is compiled into static assets (`dist/`).
- The FastAPI backend serves both the `/api` routes and the static frontend assets.

### Frontend Compilation
Before building the Docker image, ensure the frontend is compiled:
```bash
cd frontend
npm install
npm run build
```
This generates `frontend/dist/client/index.html`.

## 2. Docker Configuration

The `Dockerfile` provided is based on `python:3.12-slim`.

**Key Considerations in the Dockerfile:**
- **System Dependencies:** WeasyPrint (the PDF generator) requires native C libraries (`pango`, `cairo`, `gdk-pixbuf`). These are installed via `apt-get` during the Docker build.
- **Port Mapping:** The container exposes port `7860` natively (common for Hugging Face Spaces), but Uvicorn runs on `8080`.
- **Entrypoint:** `entrypoint.sh` executes `uvicorn dashboard:app --host 0.0.0.0 --port 8080`.

To build the image:
```bash
docker build -t phantmos .
```

## 3. Database Deployment (Supabase)

The application relies entirely on Supabase for state management. You cannot run PhantmOS without an active PostgreSQL/Supabase instance.

1. Create a new Supabase Project.
2. In the SQL Editor, execute the migration files found in the root directory in sequence:
   - `schema_v3_multiuser.sql`
   - `schema_v4_global_jobs.sql`
   - `schema_v5_auth_trigger.sql`
3. Configure your API keys in the Supabase Dashboard under `Settings -> API`.

## 4. Environment Configuration

Regardless of your hosting provider, you must inject the core environment variables into the container environment.
- `SUPABASE_URL`
- `SUPABASE_KEY`
- *(See [ENVIRONMENT.md](ENVIRONMENT.md) for the full list).*

## 5. Deployment Platforms

### Hugging Face Spaces (Recommended for ease of use)
1. Create a new "Docker" Space.
2. Push the repository to the space.
3. Configure the Space Secrets with your environment variables.
4. The Space will automatically build the Dockerfile and route traffic to port `7860`.

### Render / Railway
1. Connect your GitHub repository.
2. Select "Docker" as the deployment environment.
3. Add the required Environment Variables in the platform dashboard.
4. Override the Start Command if necessary, or let the `Dockerfile` `ENTRYPOINT` handle it.

## 6. Background Workers & Scaling

Currently, the `main_orchestrator.py` schedule is triggered via the FastAPI backend (`process_pool`).
For higher scale production environments:
1. Disable the internal trigger in `dashboard.py`.
2. Deploy a second isolated Docker container running `python main_orchestrator.py` as a detached worker process.
3. Deploy a third container/cron job running `python global_harvester.py` every X hours to populate the global pool.

## 7. Secrets Management

- **User BYOK Keys:** Users' personal LLM API keys are encrypted at rest in Supabase using the AES logic in `core/encryption.py`.
- **System Keys:** Rely entirely on the Hosting Provider's secret manager (e.g., Render Environment Variables, GitHub Actions Secrets). Never bake `.env` into the Docker image.
