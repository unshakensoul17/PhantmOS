"""
intelligence/ingest_identity.py
────────────────────────────────
Ingests Akash's master professional identity from Supabase into
ChromaDB's 'professional_identity' collection.

Run this after:
  1. Populating user_profiles in Supabase (schema.sql seed)
  2. Installing all requirements

Usage:
    python -m intelligence.ingest_identity

The collection is safe to re-ingest (upsert is idempotent).
"""

from __future__ import annotations

import sys
import json

from core.database_manager import get_profile
from intelligence.vector_store import (
    get_or_create_collection,
    add_document,
    collection_info,
)

COLLECTION_NAME = "professional_identity"


def build_identity_text(profile: dict) -> str:
    """
    Construct a rich, structured text representation of the professional
    identity for high-quality semantic embedding.

    The structure is deliberately verbose — more context = better matches.
    """
    tech = profile.get("tech_stack") or {}
    if isinstance(tech, str):
        try:
            tech = json.loads(tech)
        except json.JSONDecodeError:
            tech = {}

    skills_str = ", ".join(tech.get("skills", []))
    preferred_roles = ", ".join(tech.get("preferred_roles", []))
    years_exp = tech.get("years_exp", "N/A")

    identity = f"""
PROFESSIONAL IDENTITY PROFILE
==============================
Name        : {profile.get('full_name', '')}
Location    : {profile.get('location', '')}
GitHub      : {profile.get('github_url', '')}
LinkedIn    : {profile.get('linkedin_url', '')}
Portfolio   : {profile.get('portfolio_url', '')}

SKILLS & EXPERTISE
-------------------
Core Skills     : {skills_str}
Years of Exp    : {years_exp}
Preferred Roles : {preferred_roles}

MASTER RESUME
--------------
{profile.get('resume_text', '').strip()}
""".strip()

    return identity


def ingest_profile(verbose: bool = True) -> None:
    """
    Main ingestion pipeline:
      1. Fetch profile from Supabase
      2. Build rich identity text
      3. Embed and store in ChromaDB
    """
    if verbose:
        print("\n🔮 Ghost Protocol — Identity Ingestion")
        print("=" * 50)
        print("[*] Fetching master profile from Supabase...")

    profile = get_profile()

    if not profile:
        print(
            "\n[✗] No profile found in Supabase.\n"
            "    Run the seed INSERT in schema.sql first:\n"
            "    → Supabase Dashboard → SQL Editor → paste schema.sql"
        )
        sys.exit(1)

    name = profile.get("full_name", "Unknown")
    if verbose:
        print(f"[✓] Profile loaded: {name}")

    resume_text = profile.get("resume_text", "").strip()
    if not resume_text:
        print(
            "\n[⚠] resume_text is empty in user_profiles.\n"
            "    Update it via Supabase Table Editor before ingesting.\n"
            "    Using placeholder text for now."
        )
        profile["resume_text"] = (
            f"{name} is a software developer based in Indore, India. "
            "Experienced in Python, backend development, and automation."
        )

    # Build full identity text
    identity_text = build_identity_text(profile)
    char_count = len(identity_text)

    if verbose:
        print(f"[*] Identity text built: {char_count} characters")
        print(f"[*] Generating embedding via all-MiniLM-L6-v2 ...")

    # Store in ChromaDB
    collection = get_or_create_collection(COLLECTION_NAME)

    doc_id = str(profile.get("id", "akash_yaduwanshi_default"))

    add_document(
        collection=collection,
        doc_id=doc_id,
        text=identity_text,
        metadata={
            "full_name": profile.get("full_name", ""),
            "github_url": profile.get("github_url", ""),
            "linkedin_url": profile.get("linkedin_url", ""),
            "location": profile.get("location", ""),
            "char_count": char_count,
        },
    )

    info = collection_info(collection)

    if verbose:
        print(f"\n[✓] Identity ingested into ChromaDB collection: '{COLLECTION_NAME}'")
        print(f"[✓] Total documents in collection: {info['count']}")
        print(f"[✓] Distance metric: {info['metadata'].get('hnsw:space', 'cosine')}")
        print("\n✅ Ingestion complete. Ghost Protocol identity is LOCKED IN.\n")


if __name__ == "__main__":
    ingest_profile()
