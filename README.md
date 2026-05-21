# 🔮 Ghost Protocol

> **An agentic job-search ecosystem for the 2026 algorithmic recruitment landscape.**
> Automates discovery, evaluates semantic match (>85%), and applies with human emulation.

**Developer:** Akash Yaduwanshi · Indore, India · [github.com/unshakensoul17](https://github.com/unshakensoul17)

---

## Architecture Overview

```
ghost-protocol/
├── core/
│   ├── db.py               # Supabase client — profiles & job leads
│   └── browser_manager.py  # Playwright stealth browser engine
├── intelligence/
│   ├── embedder.py         # Local all-MiniLM-L6-v2 embeddings
│   ├── vector_store.py     # ChromaDB interface
│   └── ingest_identity.py  # Seeds Supabase identity → ChromaDB
├── data/                   # Local ChromaDB + temp files (git-ignored)
├── schema.sql              # Supabase table definitions + seed
├── test_phase_1.py         # Phase 1 end-to-end verification
├── requirements.txt
├── .env                    # Secrets (never commit)
└── .env.example            # Safe template
```

---

## Phase 1 Setup — Step by Step

### 1. Prerequisites

```bash
python --version    # Must be 3.12+
google-chrome --version   # Must be installed
```

### 2. Create Virtual Environment

```bash
cd /home/unshakensoul/Documents/siro
python -m venv .venv
source .venv/bin/activate
```

### 3. Install PyTorch (CPU-only, saves ~2GB)

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### 4. Install All Dependencies

```bash
pip install -r requirements.txt
```

### 5. Install Playwright + Chrome Driver

```bash
playwright install chromium
playwright install-deps chromium
```

### 6. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values:
nano .env
```

Required values in `.env`:

| Variable | Where to find |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase Dashboard → Project Settings → API → anon/public key |
| `CHROME_PROFILE_PATH` | Usually `/home/unshakensoul/.config/google-chrome` |
| `TELEGRAM_BOT_TOKEN` | Phase 3 — leave as placeholder |

### 7. Initialize Supabase Database

1. Open **Supabase Dashboard** → Your Project → **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `schema.sql`
4. Click **Run**
5. Update the seed row: fill in your real email, LinkedIn URL, and resume text

### 8. Ingest Identity into ChromaDB

```bash
# From the project root (with venv activated)
python -m intelligence.ingest_identity
```

First run downloads the `all-MiniLM-L6-v2` model (~80MB). Subsequent runs are instant.

### 9. Run Phase 1 Verification

```bash
python test_phase_1.py
```

A Chrome window will open to verify your LinkedIn/Naukri sessions. You should see your feed.

---

## Troubleshooting

### `FileNotFoundError: Chrome profile not found`
→ Check that `CHROME_PROFILE_PATH` in `.env` points to your real Chrome user data directory.
→ Run: `ls ~/.config/google-chrome` to verify it exists.

### LinkedIn redirects to `/login`
→ Open Chrome manually, log in to LinkedIn, then re-run the test.
→ The bot inherits cookies from the profile — no automation login needed.

### `playwright._impl._errors.Error: Executable doesn't exist`
→ Run: `playwright install chromium && playwright install-deps chromium`

### `EnvironmentError: SUPABASE_URL and SUPABASE_KEY must be set`
→ Ensure `.env` exists and has real values (not the placeholder template).

### Embedding model download fails
→ Ensure internet access during first run. Model caches to `~/.cache/huggingface/`.

---

## Phase Roadmap

| Phase | Name | Status |
|---|---|---|
| **1** | Identity Anchor & Data Layer | ✅ **Current** |
| 2 | Job Discovery Agents (LinkedIn, Naukri scrapers) | 🔜 |
| 3 | Resume Tailoring + Telegram Approval | 🔜 |
| 4 | Stealthy Application Execution | 🔜 |
| 5 | Analytics Dashboard | 🔜 |

---

## Key Design Decisions

- **Local embeddings**: `all-MiniLM-L6-v2` via `sentence-transformers` — 100% free, no API key
- **Stealth browser**: Playwright + `playwright-stealth` patches `navigator.webdriver` + 20 other vectors
- **Persistent context**: Inherits real Chrome cookies → no automated login = lower detection risk
- **Upsert strategy**: All DB/ChromaDB writes are idempotent — safe to re-run any script
