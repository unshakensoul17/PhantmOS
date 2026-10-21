"""
Unit tests for intelligence.scorer (multi-signal scoring and band assignment).
"""

from intelligence.scorer import (
    _assign_band,
    _compute_final_score,
    _extract_skills,
    _keyword_score,
    _title_score,
)


def test_compute_final_score():
    # Full match (calibrated 1.0)
    assert _compute_final_score(1.0, 1.0, 1.0) == 100.0
    assert _compute_final_score(0.0, 0.0, 0.0) == 0.0

    # Raw cosine 0.66 calibrates to 0.50: (0.50 * 0.50) + (0.50 * 0.30) + (0.50 * 0.20) = 50.0%
    assert _compute_final_score(0.66, 0.5, 0.5) == 50.0

    # Raw cosine <= 0.50 cutoff calibrates to 0.0: (0.0 * 0.50) + (0.50 * 0.30) + (0.50 * 0.20) = 25.0%
    assert _compute_final_score(0.50, 0.5, 0.5) == 25.0


def test_title_score():
    assert _title_score("Senior Python Software Engineer", ["python", "machine learning"]) == 1.0
    assert _title_score("Full Stack React Developer", ["python", "machine learning"]) == 0.3
    assert _title_score("Any Role", []) == 0.3


def test_assign_band_logic():
    # telegram_threshold = 60.0
    # hot_threshold = 60 + (40/2) = 80.0
    assert _assign_band(85.0, 60.0) == "HOT"
    assert _assign_band(80.0, 60.0) == "HOT"
    assert _assign_band(79.9, 60.0) == "WARM"
    assert _assign_band(60.0, 60.0) == "WARM"
    assert _assign_band(59.9, 60.0) == "COLD"
    assert _assign_band(40.0, 60.0) == "COLD"
    assert _assign_band(39.9, 60.0) == "REJECT"


def test_keyword_score():
    desc = "Looking for a developer experienced with Python, FastAPI, and Docker."
    skills = ["python", "fastapi", "docker", "kubernetes"]
    score = _keyword_score(desc, skills)
    assert score > 0.0
    assert _keyword_score("", skills) == 0.0
    assert _keyword_score(desc, []) == 0.0


def test_extract_skills():
    resume_data = {
        "cv": {
            "sections": {
                "skills": [
                    {"label": "Languages", "details": "Python, TypeScript / Go"},
                    {"label": "Databases", "details": "PostgreSQL, Redis"},
                ]
            }
        },
        "tech_stack": {"skills": ["Docker", "Kubernetes"]},
    }
    extracted = _extract_skills(resume_data)
    for expected in ["python", "typescript", "go", "postgresql", "redis", "docker", "kubernetes"]:
        assert expected in extracted
