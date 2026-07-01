"""
intelligence/embedding_engine.py — Ghost Protocol v2.0

Embedding layer with primary Jina AI API + local fallback.

Priority:
  1. Jina AI API  (1M tokens/month free — zero RAM cost)
  2. paraphrase-MiniLM-L3-v2 via sentence-transformers  (~50MB, CPU-only)

Master resume embedding is cached in Supabase so it is computed ONCE
and reused across all future scoring runs.
"""
import asyncio
import numpy as np
import httpx
from functools import lru_cache
from typing import Optional

from core.config import (
    JINA_API_KEY,
    JINA_EMBED_URL,
    JINA_MODEL,
    LOCAL_EMBED_MODEL,
)
from core.database_manager import get_cached_embedding, store_embedding
from core.logger import get_logger

logger = get_logger(__name__)

# ── Local model (lazy-loaded only if Jina fails) ──────────────────────────────
import threading

_local_model = None
_local_model_lock = threading.Lock()


def _get_local_model():
    """Load the lightweight local model exactly once (lazy singleton)."""
    global _local_model
    if _local_model is None:
        with _local_model_lock:
            if _local_model is None:
                logger.info(
                    f"Loading local fallback embedding model: {LOCAL_EMBED_MODEL}"
                )
                try:
                    from sentence_transformers import SentenceTransformer
                    _local_model = SentenceTransformer(LOCAL_EMBED_MODEL)
                    logger.info("Local embedding model loaded.")
                except Exception as e:
                    logger.error(f"Failed to load local embedding model: {e}")
                    raise
    return _local_model


# ── Jina AI (primary) ─────────────────────────────────────────────────────────

_jina_semaphore = asyncio.Semaphore(5)

async def _embed_jina(text: str) -> list[float]:
    """Call Jina AI embeddings API. Raises on failure."""
    if not JINA_API_KEY:
        raise EnvironmentError("JINA_API_KEY not set — falling back to local model.")

    async with _jina_semaphore:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "input": [text[:8000]],   # Jina v2/v3 supports up to 8192 tokens
                "model": JINA_MODEL,
                "dimensions": 384,
            }
            resp = await client.post(
                JINA_EMBED_URL,
                headers={
                    "Authorization": f"Bearer {JINA_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )
            # Retry on 429 Rate Limit
            if resp.status_code == 429:
                await asyncio.sleep(2.0)
                resp = await client.post(
                    JINA_EMBED_URL,
                    headers={
                        "Authorization": f"Bearer {JINA_API_KEY}",
                        "Content-Type":  "application/json",
                    },
                    json=payload,
                )
            resp.raise_for_status()
            return resp.json()["data"][0]["embedding"]


# ── Local fallback (sync → run in executor) ───────────────────────────────────

def _embed_local_sync(text: str) -> list[float]:
    """Synchronous local model embedding."""
    model = _get_local_model()
    vec = model.encode([text[:4096]], normalize_embeddings=True)[0]
    return vec.tolist()


async def _embed_local(text: str) -> list[float]:
    """Run the synchronous local embed in a thread so we don't block the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_local_sync, text)


# ── Public embed interface ────────────────────────────────────────────────────

async def embed_text_async(text: str) -> list[float]:
    """
    Embed text using Jina AI (primary) with automatic fallback to local model.
    Always returns a list[float] or raises.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text.")

    # Try Jina first
    try:
        vec = await _embed_jina(text)
        return vec
    except Exception as e:
        logger.warning(f"Jina AI embedding failed ({e}). Falling back to local model.")

    # Fallback: local model
    try:
        vec = await _embed_local(text)
        return vec
    except Exception as e:
        logger.error(f"Local embedding model also failed: {e}")
        raise


def embed_text(text: str) -> list[float]:
    """
    Synchronous convenience wrapper (used by legacy callers).
    Runs the async embed in a new event loop if none is running.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an async context — use thread executor
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, embed_text_async(text))
                return future.result()
        else:
            return loop.run_until_complete(embed_text_async(text))
    except Exception:
        # Absolute last resort: pure local sync
        return _embed_local_sync(text)


# ── Cosine similarity ─────────────────────────────────────────────────────────

def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    v1 = np.array(vec1, dtype=np.float32)
    v2 = np.array(vec2, dtype=np.float32)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


# ── Master resume embedding (cached in Supabase) ──────────────────────────────

MASTER_RESUME_CACHE_KEY = "master_resume_v2"

async def get_master_embedding(resume_text: str) -> list[float]:
    """
    Return the master resume embedding.
    - First call: embed → store in Supabase → return
    - Subsequent calls: load from Supabase (no API call)
    """
    cached = get_cached_embedding(MASTER_RESUME_CACHE_KEY)
    if cached:
        logger.info("Master resume embedding loaded from cache.")
        return cached

    logger.info("Computing master resume embedding (first time)…")
    embedding = await embed_text_async(resume_text)
    store_embedding(MASTER_RESUME_CACHE_KEY, embedding)
    logger.info("Master resume embedding stored in cache.")
    return embedding


def invalidate_master_cache() -> None:
    """
    Call this when the master resume JSON is updated so the
    embedding is recomputed on the next pipeline run.
    """
    from core.database_manager import get_client
    try:
        get_client().table("embedding_cache").delete().eq(
            "key", MASTER_RESUME_CACHE_KEY
        ).execute()
        logger.info("Master resume embedding cache invalidated.")
    except Exception as e:
        logger.error(f"Failed to invalidate embedding cache: {e}")
