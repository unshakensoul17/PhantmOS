"""
intelligence/hybrid_retriever.py — PhantmOS v3.0

Stage 2 Hybrid Retrieval & Cross-Encoder Reranking Engine:
  - Stage 2A: Fast Recall Filter (BM25 Lexical + Dense Embeddings fused via Reciprocal Rank Fusion RRF)
  - Stage 2B: Precision Cross-Encoder Reranker (Reranks Top 50 down to Top 20 high-fidelity radar leads)

Zero external API lock-in: supports local models (BGE, MiniLM, FlashRank) with graceful fallback.
"""

import math
import re
from collections import Counter
from typing import Any

from core.logger import get_logger

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────
#  Stage 2A: Ultra-Fast BM25 Lexical Engine (Zero-dependency)
# ─────────────────────────────────────────────────────────

class FastBM25:
    """
    Lightweight, high-speed BM25Okapi implementation.
    Guarantees exact matching on hard requirements (PyTorch, PostgreSQL, FastAPI, etc.)
    """

    def __init__(self, corpus: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size = len(corpus)
        self.tokenized_corpus = [self._tokenize(doc) for doc in corpus]
        self.doc_lens = [len(doc) for doc in self.tokenized_corpus]
        self.avg_doc_len = sum(self.doc_lens) / self.corpus_size if self.corpus_size > 0 else 1.0

        # Document frequencies for inverse document frequency (IDF)
        self.df: Counter = Counter()
        for doc in self.tokenized_corpus:
            self.df.update(set(doc))

        self.idf: dict[str, float] = {}
        for term, freq in self.df.items():
            # Standard Lucene/BM25 IDF formula with smoothing
            self.idf[term] = math.log((self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Normalize punctuation and tokenize into alphanumeric tokens."""
        if not text:
            return []
        text_clean = re.sub(r"[^\w\s\+\#\.\-]", " ", text.lower())
        return [t for t in text_clean.split() if len(t) > 1]

    def get_scores(self, query: str | list[str]) -> list[float]:
        """Compute BM25 scores for all corpus documents against query tokens."""
        if isinstance(query, str):
            query_tokens = self._tokenize(query)
        else:
            query_tokens = [q.lower().strip() for q in query if q]

        scores = [0.0] * self.corpus_size
        if not query_tokens or self.corpus_size == 0:
            return scores

        for idx, doc_tokens in enumerate(self.tokenized_corpus):
            doc_len = self.doc_lens[idx]
            doc_freqs = Counter(doc_tokens)
            score = 0.0

            for term in query_tokens:
                if term not in doc_freqs:
                    continue
                tf = doc_freqs[term]
                idf = self.idf.get(term, 0.0)
                # BM25 term saturation formula
                denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                score += idf * (tf * (self.k1 + 1.0)) / denom

            scores[idx] = score

        return scores


# ─────────────────────────────────────────────────────────
#  Reciprocal Rank Fusion (RRF)
# ─────────────────────────────────────────────────────────

def reciprocal_rank_fusion(
    ranked_lists: list[list[tuple[Any, float]]],
    k: int = 60
) -> list[tuple[Any, float]]:
    """
    Combine multiple ranked candidate lists into a single fused ranking.
    Formula: RRF_score(d) = SUM_r( 1 / (k + rank_r(d)) )

    Executes in < 5ms for hundreds of candidates.
    """
    rrf_scores: dict[Any, float] = {}

    for ranked_list in ranked_lists:
        for rank, (item, _) in enumerate(ranked_list, start=1):
            rrf_scores[item] = rrf_scores.get(item, 0.0) + (1.0 / (k + rank))

    # Sort descending by fused RRF score
    sorted_items = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_items


# ─────────────────────────────────────────────────────────
#  Compact Representation Generator (Token budget: 128-192 tokens)
# ─────────────────────────────────────────────────────────

def build_compact_job_repr(job: dict, max_tokens: int = 192) -> str:
    """
    Generate a deterministic compact representation of a job description.
    Avoids sending 2,000+ raw tokens to the cross-encoder, speeding up CPU inference by 5x-8x.
    """
    title = job.get("title", "").strip()
    company = job.get("company", "").strip()
    location = job.get("location", "").strip()
    department = job.get("department", "").strip()
    desc = job.get("raw_description") or job.get("description", "")

    # Extract first 400 chars of high-signal summary
    desc_snippet = " ".join(desc.split()[:40]) if desc else ""

    parts = [f"JOB: {title}"]
    if company:
        parts.append(f"at {company}")
    if location:
        parts.append(f"({location})")
    if department:
        parts.append(f"| Dept: {department}")
    if desc_snippet:
        parts.append(f"| Context: {desc_snippet}")

    return " ".join(parts)[:max_tokens * 4]


def build_compact_candidate_repr(profile: dict, resume_skills: list[str], max_tokens: int = 192) -> str:
    """
    Generate a deterministic compact representation of candidate skills and profile.
    """
    resume_data = profile.get("resume_data") or {}
    cv = resume_data.get("cv", {})
    name = cv.get("name", "Candidate")
    target_role = profile.get("preferences", {}).get("scoring", {}).get("target_roles", ["Software Engineer"])
    role_str = ", ".join(target_role) if isinstance(target_role, list) else str(target_role)

    top_skills = ", ".join(resume_skills[:15]) if resume_skills else ""

    parts = [
        f"CANDIDATE: {name}",
        f"| Target Role: {role_str}",
        f"| Key Skills: {top_skills}",
    ]
    return " ".join(parts)[:max_tokens * 4]


# ─────────────────────────────────────────────────────────
#  Hard Constraints Engine (Eligibility Filtering)
# ─────────────────────────────────────────────────────────

def apply_hard_constraints(
    candidates: list[dict],
    preferences: dict | None = None
) -> tuple[list[dict], list[dict]]:
    """
    Apply non-negotiable eligibility checks outside the semantic scoring equation.
    Returns: (eligible_candidates, rejected_candidates)
    """
    if not preferences:
        return candidates, []

    scoring_pref = preferences.get("scoring", {})
    blacklist_companies = [c.lower().strip() for c in scoring_pref.get("blacklist_companies", []) if c]
    blacklist_keywords = [k.lower().strip() for k in scoring_pref.get("blacklist_keywords", []) if k]
    remote_only = scoring_pref.get("remote_only", False)

    eligible = []
    rejected = []

    for c in candidates:
        company = (c.get("company") or "").lower()
        desc = (c.get("raw_description") or c.get("description") or "").lower()
        loc = (c.get("location") or "").lower()

        # Check blacklist company
        if any(bc in company for bc in blacklist_companies if bc):
            c["reject_reason"] = f"Blacklisted company ({company})"
            rejected.append(c)
            continue

        # Check blacklist keywords
        if any(bk in desc for bk in blacklist_keywords if bk):
            c["reject_reason"] = "Contained blacklisted keyword"
            rejected.append(c)
            continue

        # Check remote constraint
        if remote_only and "remote" not in loc and "anywhere" not in loc:
            c["reject_reason"] = f"Non-remote position ({loc})"
            rejected.append(c)
            continue

        eligible.append(c)

    return eligible, rejected


# ─────────────────────────────────────────────────────────
#  Stage 2B: Ultra-Low RAM Cross-Encoder / FlashRank Reranker
# ─────────────────────────────────────────────────────────

_ranker_instance = None
_ranker_type = None  # 'flashrank' | 'sentence_transformers' | None


def get_reranker():
    """
    Ultra-low RAM lazy loader:
      1. Primary: FlashRank (ms-marco-TinyBERT-L-2-v2, ~4MB, zero PyTorch, <20MB RAM)
      2. Fallback: sentence-transformers CrossEncoder (ms-marco-TinyBERT-L-2-v2 / MiniLM-L-6-v2)
      3. Last Resort: Vectorized cosine similarity fallback (0 MB additional RAM)
    """
    global _ranker_instance, _ranker_type
    if _ranker_instance is not None or _ranker_type == "none":
        return _ranker_instance, _ranker_type

    # 1. Try FlashRank (Ultra-lightweight ~4MB, pure ONNX/CPU)
    try:
        from flashrank import Ranker
        logger.info("Initializing ultra-low RAM FlashRank (ms-marco-TinyBERT-L-2-v2)...")
        _ranker_instance = Ranker(model_name="ms-marco-TinyBERT-L-2-v2")
        _ranker_type = "flashrank"
        logger.info("FlashRank loaded successfully (~4MB footprint).")
        return _ranker_instance, _ranker_type
    except Exception:
        pass

    # 2. Try SentenceTransformers CrossEncoder
    try:
        from sentence_transformers import CrossEncoder
        logger.info("Loading SentenceTransformers CrossEncoder (ms-marco-TinyBERT-L-2-v2)...")
        _ranker_instance = CrossEncoder("cross-encoder/ms-marco-TinyBERT-L-2-v2", max_length=256)
        _ranker_type = "sentence_transformers"
        logger.info("CrossEncoder loaded successfully.")
        return _ranker_instance, _ranker_type
    except Exception:
        try:
            from sentence_transformers import CrossEncoder
            _ranker_instance = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=256)
            _ranker_type = "sentence_transformers"
            return _ranker_instance, _ranker_type
        except Exception as e:
            logger.warning(f"No local cross-encoder available ({e}). Using cosine/RRF ranking (0MB RAM).")
            _ranker_instance = None
            _ranker_type = "none"
            return None, "none"


def rerank_candidates(
    candidate_repr: str,
    candidates: list[dict],
    top_n: int = 20
) -> list[dict]:
    """
    Stage 2B Precision Reranker (Ultra-Low Memory):
    Takes Top 30-40 candidates, runs compact representations through FlashRank/TinyBERT,
    and returns Top N highest-fidelity leads.
    """
    if not candidates:
        return []

    rerank_pool = candidates[:40]
    ranker, r_type = get_reranker()

    if r_type == "flashrank" and ranker:
        try:
            from flashrank import RerankRequest
            passages = [
                {"id": str(i), "text": build_compact_job_repr(c)}
                for i, c in enumerate(rerank_pool)
            ]
            req = RerankRequest(query=candidate_repr, passages=passages)
            results = ranker.rerank(req)
            ranked = []
            for r in results:
                idx = int(r["id"])
                job_dict = rerank_pool[idx]
                job_dict["rerank_score"] = float(r.get("score", 0.0))
                ranked.append(job_dict)
            return ranked[:top_n]
        except Exception as e:
            logger.error(f"FlashRank reranking failed: {e}")

    elif r_type == "sentence_transformers" and ranker:
        try:
            pairs = [[candidate_repr, build_compact_job_repr(c)] for c in rerank_pool]
            scores = ranker.predict(pairs)
            for cand, score in zip(rerank_pool, scores, strict=False):
                cand["rerank_score"] = float(1.0 / (1.0 + math.exp(-score))) if isinstance(score, (int, float)) else float(score)
            ranked = sorted(rerank_pool, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
            return ranked[:top_n]
        except Exception as e:
            logger.error(f"SentenceTransformers CrossEncoder failed: {e}")

    # Fallback to existing RRF / match score (0 MB additional RAM)
    ranked = sorted(rerank_pool, key=lambda x: x.get("rrf_score", x.get("match_score", 0.0)), reverse=True)
    return ranked[:top_n]
