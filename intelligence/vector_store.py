"""
intelligence/vector_store.py
────────────────────────────
Supabase pgvector interface for Ghost Protocol.
Replaces the old ChromaDB local implementation.
"""

from __future__ import annotations
import os
from typing import Optional

from core.database_manager import get_client
from intelligence.embedding_engine import embed_text

def get_or_create_collection(name: str) -> str:
    """
    Returns the mapped Supabase table name.
    'professional_identity' -> 'user_profiles'
    'job_descriptions'      -> 'job_leads'
    """
    if name == "professional_identity":
        return "user_profiles"
    if name == "job_descriptions" or name == "job_leads":
        return "job_leads"
    return name

def add_document(
    collection: str,
    doc_id: str,
    text: str,
    metadata: Optional[dict] = None,
) -> None:
    """
    Generates embedding for text and updates the corresponding Supabase table row.
    """
    embedding = embed_text(text)
    client = get_client()
    
    try:
        # In Supabase, we update the existing row with the new embedding
        if collection == "user_profiles":
            client.table(collection).update({"embedding": embedding}).eq("id", doc_id).execute()
        elif collection == "job_leads":
            # Update by primary key 'id' or logical 'job_id'
            client.table(collection).update({"embedding": embedding}).eq("job_id", doc_id).execute()
            
        print(f"[vector_store] Updated embedding for document '{doc_id}' in table '{collection}'")
    except Exception as e:
        print(f"[vector_store] Failed to update embedding for '{doc_id}': {e}")

def add_documents_batch(
    collection: str,
    documents: list[dict],
) -> None:
    """Batch embed and update."""
    for doc in documents:
        add_document(collection, doc["id"], doc["text"], doc.get("metadata"))
    print(f"[vector_store] Batch updated {len(documents)} documents in '{collection}'")

def query_similar(
    collection: str,
    query_text: str,
    n_results: int = 5,
) -> list[dict]:
    """
    Semantic nearest-neighbor search using Supabase pgvector RPC.
    """
    query_embedding = embed_text(query_text)
    client = get_client()
    
    # We call the RPC function created in schema.sql for job leads
    if collection == "job_leads":
        resp = client.rpc("query_similar_jobs", {
            "query_embedding": query_embedding,
            "match_count": n_results
        }).execute()
        
        output = []
        if resp.data:
            for row in resp.data:
                output.append({
                    "id": str(row.get("job_id")),
                    "document": row.get("raw_description"),
                    "similarity": row.get("similarity", 0.0),
                    "metadata": {
                        "title": row.get("title"),
                        "company": row.get("company")
                    }
                })
        return output
    else:
        print(f"[vector_store] query_similar not implemented yet for {collection}")
        return []

def delete_document(collection: str, doc_id: str) -> None:
    """Clear embedding for a document."""
    client = get_client()
    client.table(collection).update({"embedding": None}).eq("id", doc_id).execute()
    print(f"[vector_store] Cleared embedding for '{doc_id}' in '{collection}'")

def collection_info(collection: str) -> dict:
    """Return summary info compatible with ingest_identity.py."""
    return {
        "name": collection,
        "count": "Supabase Managed",
        "metadata": {"hnsw:space": "cosine (pgvector)"}
    }
