"""
Unit tests for intelligence.hybrid_retriever (FastBM25, RRF, compact representations).
"""

from intelligence.hybrid_retriever import (
    FastBM25,
    apply_hard_constraints,
    build_compact_candidate_repr,
    build_compact_job_repr,
    reciprocal_rank_fusion,
)


def test_fast_bm25_scoring():
    corpus = [
        "Senior Backend Python Engineer proficient in FastAPI, PostgreSQL, and Redis caching.",
        "Frontend React Developer with TypeScript, Tailwind CSS, and Next.js experience.",
        "Machine Learning Researcher training PyTorch transformers, LLMs, and LoRA adapters.",
    ]
    engine = FastBM25(corpus)

    # Query matching doc 0
    scores_py = engine.get_scores(["python", "fastapi"])
    assert scores_py[0] > scores_py[1]
    assert scores_py[0] > scores_py[2]

    # Query matching doc 2
    scores_ml = engine.get_scores(["pytorch", "transformers"])
    assert scores_ml[2] > scores_ml[0]
    assert scores_ml[2] > scores_ml[1]


def test_reciprocal_rank_fusion():
    list_a = [("lead_1", 0.95), ("lead_2", 0.85), ("lead_3", 0.70)]
    list_b = [("lead_2", 0.98), ("lead_1", 0.80), ("lead_3", 0.65)]

    fused = reciprocal_rank_fusion([list_a, list_b], k=60)
    assert len(fused) == 3
    # Both list_a and list_b rank lead_1 and lead_2 at the top
    top_two = [item[0] for item in fused[:2]]
    assert "lead_1" in top_two and "lead_2" in top_two


def test_compact_representations():
    job = {
        "title": "AI Engineer",
        "company": "DeepTech",
        "location": "Remote",
        "department": "R&D",
        "raw_description": "Building next-generation autonomous AI agents with Python and ONNX.",
    }
    repr_str = build_compact_job_repr(job)
    assert "JOB: AI Engineer" in repr_str
    assert "at DeepTech" in repr_str
    assert "(Remote)" in repr_str

    profile = {
        "resume_data": {"cv": {"name": "Alice Smith"}},
        "preferences": {"scoring": {"target_roles": ["AI Engineer"]}},
    }
    cand_repr = build_compact_candidate_repr(profile, ["Python", "PyTorch", "FastAPI"])
    assert "CANDIDATE: Alice Smith" in cand_repr
    assert "AI Engineer" in cand_repr
    assert "Python, PyTorch, FastAPI" in cand_repr


def test_hard_constraints():
    candidates = [
        {"company": "BadCorp", "raw_description": "Python dev", "location": "Remote"},
        {"company": "GoodCorp", "raw_description": "PHP and legacy Java", "location": "Remote"},
        {"company": "AIStudio", "raw_description": "FastAPI dev", "location": "Onsite (NY)"},
        {"company": "RemoteTech", "raw_description": "FastAPI and PyTorch", "location": "Remote"},
    ]
    prefs = {
        "scoring": {
            "blacklist_companies": ["badcorp"],
            "blacklist_keywords": ["legacy"],
            "remote_only": True,
        }
    }
    eligible, rejected = apply_hard_constraints(candidates, prefs)
    assert len(eligible) == 1
    assert eligible[0]["company"] == "RemoteTech"
    assert len(rejected) == 3
