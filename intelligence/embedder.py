"""
intelligence/embedder.py
────────────────────────
Local embedding engine for Ghost Protocol.

Model : all-MiniLM-L6-v2  (~80 MB, CPU-compatible)
Source: sentence-transformers (HuggingFace)
Cost  : $0.00 — runs entirely offline after first download

The cosine similarity formula used:

    Similarity(A, B) = (A · B) / (‖A‖ · ‖B‖)
"""

from __future__ import annotations

import numpy as np
from sentence_transformers import SentenceTransformer

# ── Constants ─────────────────────────────────────────────────────────────────
MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384  # Fixed output dimension for this model

# ── Singleton model loader ────────────────────────────────────────────────────
_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    """Lazy-load the embedding model (downloads once, cached locally)."""
    global _model
    if _model is None:
        print(f"[embedder] Loading model: {MODEL_NAME}  (first run ~80MB download)")
        _model = SentenceTransformer(MODEL_NAME)
        print(f"[embedder] Model loaded. Output dim: {EMBEDDING_DIM}")
    return _model


# ── Public API ────────────────────────────────────────────────────────────────

def embed_text(text: str) -> list[float]:
    """
    Generate a normalized L2 embedding vector for the given text.

    Normalization ensures cosine similarity equals the dot product,
    which is what ChromaDB's 'cosine' space expects.

    Args:
        text: Input string (resume chunk, job description, query, etc.)

    Returns:
        List of 384 floats representing the semantic embedding.
    """
    model = get_model()
    embedding = model.encode(text, normalize_embeddings=True, show_progress_bar=False)
    return embedding.tolist()


def embed_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """
    Generate embeddings for a list of texts efficiently in batches.

    Args:
        texts:      List of strings to embed.
        batch_size: Number of texts per encoding batch.

    Returns:
        List of embedding vectors (same order as input).
    """
    model = get_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=len(texts) > 10,
    )
    return [e.tolist() for e in embeddings]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Compute cosine similarity between two embedding vectors.

        Similarity(A, B) = (A · B) / (‖A‖ × ‖B‖)

    Since embed_text() returns L2-normalized vectors, this equals
    the simple dot product. The full formula is implemented here
    for correctness when used with non-normalized vectors.

    Args:
        a: First embedding vector.
        b: Second embedding vector.

    Returns:
        Float in range [-1.0, 1.0]. Values >0.85 indicate strong semantic match.
    """
    vec_a = np.array(a, dtype=np.float32)
    vec_b = np.array(b, dtype=np.float32)

    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def match_score_percent(a: list[float], b: list[float]) -> float:
    """
    Returns cosine similarity as a percentage (0–100).
    Ghost Protocol targets >85% for applications.
    """
    return round(cosine_similarity(a, b) * 100, 2)
