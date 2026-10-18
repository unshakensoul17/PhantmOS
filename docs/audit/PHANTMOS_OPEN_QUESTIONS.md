# PhantmOS Open Technical Questions and Unverified Claims

**Audit Date:** October 18, 2026  
**Auditor:** Senior Software Architect  
**Purpose:** Technical inquiries and architectural discrepancies identified during code audit that require developer clarification before final submission to Government Holkar Science College.

---

## 1. Questions Regarding Code Discrepancies and Incomplete Migrations

### Question 1: Discrepancy in Multi-Signal Scoring Weights
- **Code Reference:**
  - `core/config.py` (lines 67–71):
    ```python
    SCORE_WEIGHTS = {"semantic": 0.50, "keyword": 0.30, "title": 0.20}
    ```
  - `intelligence/scorer.py` (lines 86–87):
    ```python
    raw = (semantic * 0.45) + (keyword * 0.35) + (title * 0.20)
    ```
- **Inquiry:** Why does `_compute_final_score()` hardcode weights of 45% semantic, 35% keyword, and 20% title instead of referencing `core.config.SCORE_WEIGHTS`? Is the 45/35/20 split the intentional tuned ratio, or should `SCORE_WEIGHTS` from `config.py` govern all calculations?

---

### Question 2: PDF Generation Engine Roadmap (RenderCV vs. WeasyPrint)
- **Code Reference:**
  - `CHANGELOG.md` (line 18): "Upgraded PDF generation engine to WeasyPrint (dropping rendercv overhead)."
  - `synthesis/pdf_factory.py`: Uses RenderCV 2.8 with Typst backend (`rendercv render`).
  - `Dockerfile` (lines 12–23): Installs system libraries for WeasyPrint (`libpango-1.0-0`, `libcairo2`, `libgdk-pixbuf-xlib-2.0-0`).
- **Inquiry:** Was WeasyPrint tested in an experimental branch and reverted due to typographical fidelity, or is the migration from RenderCV to WeasyPrint incomplete? If RenderCV + Typst is the intended production engine, the CHANGELOG and Dockerfile system dependencies should be cleaned up.

---

### Question 3: Missing Automated Test Suite (`tests/`)
- **Code Reference:**
  - `pyproject.toml` (lines 53–57):
    ```toml
    [tool.pytest.ini_options]
    minversion = "7.0"
    testpaths = ["tests"]
    python_files = ["test_*.py"]
    ```
  - Repository file tree: Directory `tests/` is completely absent.
- **Inquiry:** Was the test suite maintained in a separate repository/branch, or was it deleted during a refactoring sprint? For academic submission, a clean test suite under `tests/` validating scoring, RRF, encryption, and validation is essential.

---

### Question 4: Status of `guestLogin` in Frontend Authentication
- **Code Reference:**
  - `frontend/src/routes/auth.tsx` (line 31):
    ```tsx
    const { user, guestLogin } = useAuth();
    ```
  - `frontend/src/hooks/useAuth.tsx`: Does not export `guestLogin`.
- **Inquiry:** Was a one-click "Demo Mode" or "Guest Access" feature planned for the landing page that was omitted from `useAuth.tsx`? How should unauthenticated visitors evaluate the application interface?

---

### Question 5: Production Deployment Verification on Hugging Face Spaces
- **Evidence Reference:**
  - `hf_deployment_plan.md`: Details deployment architecture on port 7860.
  - `dashboard.py` (lines 1084–1102): Serves built SPA files from `frontend/.output/public`.
- **Inquiry:** What is the active deployment URL on Hugging Face Spaces? Is the production instance currently live, and how are environment variables (`SUPABASE_URL`, `SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`) injected into the Hugging Face Docker container?

---

### Question 6: Deprecation of Legacy Single-User Disk State
- **Code Reference:**
  - `dashboard.py` (lines 1066–1070): Syncs incoming user settings to `settings.json` on disk.
  - `intelligence/scorer.py` (lines 211–215): Falls back to reading `settings.json` if user preferences in Supabase are empty.
- **Inquiry:** Can `settings.json` and `core/schema.sql` be completely purged from the repository to prevent multi-tenant configuration crosstalk?
