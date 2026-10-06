"""
scripts/truncate_db.py — PhantmOS Database Reset Utility

Truncates all application tables in the correct dependency order
(child → parent) while preserving auth.users and user_profiles
so existing accounts remain valid.

Usage:
    python scripts/truncate_db.py              # dry-run preview
    python scripts/truncate_db.py --confirm    # actually truncates
"""

import sys
import os

# Load .env from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

from core.database_manager import get_client

# Tables to truncate in dependency order (children first, parents last).
# auth.users and user_profiles are deliberately excluded — accounts are preserved.
TABLES = [
    # Leaf / most dependent first
    "stage_logs",
    "user_feedback",
    "delivery_queue",
    "auth_debug_logs",
    # Pipeline data
    "user_job_pipelines",
    # Shared job pool
    "global_jobs",
    # User content (resume data only, not the profile itself)
    "user_resumes",
]

PROTECTED = {"auth.users", "user_profiles"}

DRY_RUN_NOTE = """
┌─────────────────────────────────────────────────────────────────┐
│  DRY RUN — no changes made.                                     │
│  Run with --confirm to actually truncate the tables above.      │
└─────────────────────────────────────────────────────────────────┘
"""

def main():
    confirm = "--confirm" in sys.argv

    print("\n📋  Tables to be TRUNCATED:")
    for t in TABLES:
        print(f"   ✗  {t}")

    print("\n🔒  Tables PRESERVED (never touched):")
    for t in sorted(PROTECTED):
        print(f"   ✓  {t}")

    if not confirm:
        print(DRY_RUN_NOTE)
        return

    print("\n⚠️  Confirmed — truncating tables...\n")

    client = get_client()
    errors = []

    # Per-table config: (pk_column, sentinel_value_to_exclude)
    # Supabase delete requires a filter — we use neq on the PK with an impossible value.
    TABLE_CONFIG = {
        "stage_logs":         ("id",           -1),
        "user_feedback":      ("id",           -1),
        "delivery_queue":     ("id",           -1),
        "auth_debug_logs":    ("id",           -1),           # integer PK
        "user_job_pipelines": ("id",           "00000000-0000-0000-0000-000000000000"),
        "global_jobs":        ("job_id",       "____never____"),
        "user_resumes":       ("user_id",      "00000000-0000-0000-0000-000000000000"),
    }

    for table in TABLES:
        pk_col, sentinel = TABLE_CONFIG.get(table, ("id", "00000000-0000-0000-0000-000000000000"))
        try:
            result = client.table(table).delete().neq(pk_col, sentinel).execute()
            deleted = len(result.data) if result.data else "?"
            print(f"   \u2705  {table:<30} (deleted: {deleted} rows)")
        except Exception as e:
            errors.append((table, str(e)))
            print(f"   \u274c  {table:<30} ERROR: {e}")

    print()
    if errors:
        print(f"⚠️  {len(errors)} table(s) failed:")
        for t, e in errors:
            print(f"   - {t}: {e}")
        print("\n💡  Tip: Run this SQL in Supabase Dashboard → SQL Editor as a fallback:\n")
        for t, _ in errors:
            print(f"      TRUNCATE TABLE {t} CASCADE;")
    else:
        print("🎉  All tables truncated successfully.")
        print("    auth.users and user_profiles were untouched.\n")


if __name__ == "__main__":
    main()
