"""
intelligence/embedding_engine.py — PhantmOS v3.0

100% Local, $0 Cost Embedding Layer via FastEmbed & ONNX:
  - Model: BAAI/bge-small-en-v1.5 (33M params, 384d, INT8 ONNX, #1 MTEB lightweight CPU tier)
  - Zero PyTorch / Zero CUDA / Zero External API (No Jina API keys, No network rate limits)
  - Thread-safe lazy singleton bound to 2 CPU execution threads
  - In-memory fast cache + Supabase persistent embedding cache
"""

import asyncio
import hashlib
import threading

import numpy as np

from core.config import LOCAL_EMBED_MODEL
from core.database_manager import (
    get_cached_embedding,
    get_cached_embeddings_bulk,
    store_embedding,
    store_embeddings_bulk,
)
from core.logger import get_logger

logger = get_logger(__name__)

# ── Local FastEmbed Model Singleton ─────────────────────────────────────────
_local_model = None
_local_model_lock = threading.Lock()


def _get_local_model():
    """Load the lightweight FastEmbed ONNX model exactly once (lazy singleton)."""
    global _local_model
    if _local_model is None:
        with _local_model_lock:
            if _local_model is None:
                logger.info(f"Loading local FastEmbed ONNX model: {LOCAL_EMBED_MODEL}...")
                try:
                    from fastembed import TextEmbedding

                    # Bound threads to 2 to prevent container CPU oversubscription
                    _local_model = TextEmbedding(model_name=LOCAL_EMBED_MODEL, threads=2)
                    logger.info(f"Local FastEmbed model ({LOCAL_EMBED_MODEL}) ready on ONNX.")
                except Exception as e:
                    logger.error(f"Failed to load FastEmbed model: {e}")
                    raise
    return _local_model


# ── In-Memory Fast Cache (Top 1,000 recent embeddings) ──────────────────────
_mem_cache: dict[str, list[float]] = {}
_mem_cache_lock = threading.Lock()


def _get_from_mem_cache(key: str) -> list[float] | None:
    with _mem_cache_lock:
        return _mem_cache.get(key)


def _put_in_mem_cache(key: str, vec: list[float]) -> None:
    with _mem_cache_lock:
        if len(_mem_cache) > 1000:
            keys_to_remove = list(_mem_cache.keys())[:200]
            for k in keys_to_remove:
                _mem_cache.pop(k, None)
        _mem_cache[key] = vec


# ── Local synchronous embedding ─────────────────────────────────────────────


def _embed_local_sync(text: str) -> list[float]:
    """Synchronous FastEmbed model encoding."""
    model = _get_local_model()
    # Truncate text to ~2000 chars for high-speed CPU encoding
    generator = model.embed([text[:2048]])
    vec = list(generator)[0]
    return vec.tolist() if hasattr(vec, "tolist") else list(vec)


def _embed_local_batch_sync(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Synchronous FastEmbed batch encoding (vectorized over CPU SIMD)."""
    if not texts:
        return []
    model = _get_local_model()
    truncated = [t[:2048] if t else " " for t in texts]
    generator = model.embed(truncated, batch_size=batch_size)
    results = []
    for vec in generator:
        results.append(vec.tolist() if hasattr(vec, "tolist") else list(vec))
    return results


async def embed_texts_batch_async(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Encode multiple texts in parallel batches off the main thread."""
    if not texts:
        return []
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_local_batch_sync, texts, batch_size)


async def embed_text_async(text: str) -> list[float]:
    """
    Embed text asynchronously using local FastEmbed ONNX model.
    Runs encoding in a background thread to keep FastAPI / event loops non-blocking.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text.")

    text_clean = text.strip()
    cache_key = hashlib.md5(text_clean.encode("utf-8")).hexdigest()

    # 1. Check in-memory fast cache
    mem_cached = _get_from_mem_cache(cache_key)
    if mem_cached is not None:
        return mem_cached

    # 2. Compute embedding via local model in thread executor
    loop = asyncio.get_event_loop()
    vec = await loop.run_in_executor(None, _embed_local_sync, text_clean)

    # 3. Store in in-memory cache
    _put_in_mem_cache(cache_key, vec)
    return vec


def embed_text(text: str) -> list[float]:
    """
    Synchronous convenience wrapper.
    """
    if not text or not text.strip():
        raise ValueError("Cannot embed empty text.")

    text_clean = text.strip()
    cache_key = hashlib.md5(text_clean.encode("utf-8")).hexdigest()

    mem_cached = _get_from_mem_cache(cache_key)
    if mem_cached is not None:
        return mem_cached

    vec = _embed_local_sync(text_clean)
    _put_in_mem_cache(cache_key, vec)
    return vec


# ── Cosine similarity ───────────────────────────────────────────────────────


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Compute cosine similarity between two normalized embedding vectors."""
    v1 = np.array(vec1, dtype=np.float32)
    v2 = np.array(vec2, dtype=np.float32)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


def batch_cosine_similarity(user_vec: list[float], job_vecs: list[list[float]]) -> np.ndarray:
    """
    Compute cosine similarities between 1 user vector and N job vectors
    in a single BLAS matrix-vector dot product (takes ~1-5ms for 1,000 jobs).
    """
    if not job_vecs or not user_vec:
        return np.zeros(len(job_vecs), dtype=np.float32)

    u = np.array(user_vec, dtype=np.float32)
    u_norm = np.linalg.norm(u)
    if u_norm == 0.0:
        return np.zeros(len(job_vecs), dtype=np.float32)
    u = u / u_norm

    j = np.array(job_vecs, dtype=np.float32)
    j_norms = np.linalg.norm(j, axis=1, keepdims=True)
    j_norms[j_norms == 0.0] = 1.0
    j_normalized = j / j_norms

    # Matrix @ Vector product: (N, 384) @ (384,) -> (N,)
    scores = np.dot(j_normalized, u)
    return np.clip(scores, -1.0, 1.0)


# ── Master resume embedding (cached in Supabase) ────────────────────────────


async def get_master_embedding(resume_text: str, user_id: str) -> list[float]:
    """
    Return the master resume embedding for a specific user.
    - First call: embed locally → store in Supabase → return
    - Subsequent calls: load from Supabase / memory cache
    """
    cache_key = f"master_resume_{user_id}"
    cached = get_cached_embedding(cache_key)
    if cached:
        logger.info(f"Master resume embedding loaded from cache for user {user_id}.")
        return cached

    logger.info(f"Computing local master resume embedding (first time) for user {user_id}…")
    embedding = await embed_text_async(resume_text)
    store_embedding(cache_key, embedding)
    logger.info(f"Master resume embedding stored in cache for user {user_id}.")
    return embedding


def invalidate_master_cache(user_id: str) -> None:
    """
    Invalidate master resume embedding when user updates profile.
    """
    from core.database_manager import get_client

    cache_key = f"master_resume_{user_id}"
    try:
        get_client().table("embedding_cache").delete().eq("key", cache_key).execute()
        with _mem_cache_lock:
            _mem_cache.clear()
        logger.info(f"Master resume embedding cache invalidated for user {user_id}.")
    except Exception as e:
        logger.error(f"Failed to invalidate embedding cache: {e}")


async def get_job_embedding(desc: str) -> list[float]:
    """
    Return the job description embedding with global persistent caching.
    """
    desc_hash = hashlib.md5(desc.encode("utf-8")).hexdigest()
    cache_key = f"job_desc_{desc_hash}"

    # In-memory check first
    mem = _get_from_mem_cache(cache_key)
    if mem:
        return mem

    # Persistent DB cache check
    cached = get_cached_embedding(cache_key)
    if cached:
        _put_in_mem_cache(cache_key, cached)
        return cached

    embedding = await embed_text_async(desc)
    store_embedding(cache_key, embedding)
    _put_in_mem_cache(cache_key, embedding)
    return embedding


async def get_job_embeddings_bulk(descs: list[str]) -> list[list[float]]:
    """
    Fetch/compute job description embeddings for hundreds/thousands of jobs in bulk.
    Pipeline:
      1. In-memory fast cache check
      2. Single bulk DB lookup via get_cached_embeddings_bulk
      3. Vectorized batch FastEmbed encoding for cache misses (batch_size=64)
      4. Single bulk DB upsert via store_embeddings_bulk
    Guarantees strict 1-to-1 index alignment with input descs.
    """
    if not descs:
        return []

    n = len(descs)
    fallback_dim = 384
    results: list[list[float] | None] = [None] * n
    keys: list[str] = []
    key_to_indices: dict[str, list[int]] = {}

    for idx, desc in enumerate(descs):
        clean = (desc or "").strip()
        h = hashlib.md5(clean.encode("utf-8")).hexdigest()
        cache_key = f"job_desc_{h}"
        keys.append(cache_key)
        key_to_indices.setdefault(cache_key, []).append(idx)

    # 1. Check in-memory fast cache
    miss_keys = []
    for k, indices in key_to_indices.items():
        mem = _get_from_mem_cache(k)
        if mem is not None:
            for idx in indices:
                results[idx] = mem
        else:
            miss_keys.append(k)

    # 2. Check DB persistent cache in single bulk query
    if miss_keys:
        db_cached = get_cached_embeddings_bulk(miss_keys)
        still_missing = []
        for k in miss_keys:
            if k in db_cached:
                vec = db_cached[k]
                _put_in_mem_cache(k, vec)
                for idx in key_to_indices[k]:
                    results[idx] = vec
            else:
                still_missing.append(k)
        miss_keys = still_missing

    # 3. Batch embed genuinely missing texts with FastEmbed ONNX
    if miss_keys:
        missing_texts = []
        for k in miss_keys:
            rep_idx = key_to_indices[k][0]
            missing_texts.append(descs[rep_idx])

        new_embeddings = await embed_texts_batch_async(missing_texts, batch_size=64)

        db_upserts = []
        for k, vec in zip(miss_keys, new_embeddings, strict=False):
            _put_in_mem_cache(k, vec)
            db_upserts.append({"key": k, "embedding": vec})
            for idx in key_to_indices[k]:
                results[idx] = vec

        # 4. Bulk store into DB in background
        if db_upserts:
            store_embeddings_bulk(db_upserts)

    return [r if r is not None else [0.0] * fallback_dim for r in results]
