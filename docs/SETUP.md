# ⚙️ Developer Setup Guide

This guide will walk you through setting up PhantmOS v3.0 for local development.

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- **Python**: v3.12 or higher
- **Node.js**: v20 or higher
- **Git**
- **Docker** & **Docker Compose** (optional but recommended)
- System dependencies for WeasyPrint (PDF generation):
  - **macOS**: `brew install pango cairo gdk-pixbuf glib`
  - **Linux (Ubuntu/Debian)**: `sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev libglib2.0-0`

## 🛠 1. Clone the Repository

```bash
git clone https://github.com/yourusername/siro.git
cd siro
```

## 🐍 2. Backend Setup (Python)

1. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. Configure Environment Variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in the required keys. See [ENVIRONMENT.md](ENVIRONMENT.md) for a detailed breakdown.

## ⚛️ 3. Frontend Setup (React/Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the frontend for the FastAPI SPA fallback (required if testing the unified server):
   ```bash
   npm run build
   cd ..
   ```

## 🗄 4. Database Setup (Supabase)

You must create a Supabase project and execute the SQL migrations in order.

1. Go to your Supabase Dashboard -> SQL Editor.
2. Run the following schemas in exact order:
   - `schema_v3_multiuser.sql`
   - `schema_v4_global_jobs.sql`
   - `schema_v5_auth_trigger.sql`

This creates the tables, RLS policies, and the essential auth trigger that syncs new sign-ups to the `user_profiles` table.

## 🚀 5. Running Locally

You can run the application in two ways:

### Option A: Unified Server (Production-like)
This runs the FastAPI backend serving the pre-built React frontend.

```bash
# Ensure you are in the root directory and frontend is built
python dashboard.py
```
Visit `http://localhost:8080`.

### Option B: Split Development Mode (Recommended)
This gives you Hot Module Replacement (HMR) for frontend development.

**Terminal 1 (Backend):**
```bash
python dashboard.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
Visit the localhost port provided by Vite (usually `http://localhost:5173`).

## 🧪 6. Running Tests & Linters

There are basic test scripts in the root directory to verify core logic:

```bash
# Verify the embedding engine and scoring logic
python test_bm25.py
python test_scorer.py
python test_new_flow.py
```

For frontend linting:
```bash
cd frontend
npm run lint
npm run format
```

## 🐛 Troubleshooting

- **WeasyPrint PDF Generation Fails**: This is almost always due to missing Pango/Cairo system libraries. Refer to the [WeasyPrint Docs](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) for your OS.
- **Login fails/No profile created**: Check the `auth_debug_logs` table in Supabase. The v5 trigger catches errors and logs them there if the profile creation fails.
- **Missing API Keys**: The backend will gracefully skip LLM steps if Groq/Gemini keys are absent, but you will see errors in the console. Ensure `.env` is populated or BYOK is set in the dashboard settings.
