"""
Unit tests for synthesis.output_validator (schema validation and hallucination checks).
"""

from synthesis.output_validator import (
    _check_bullet_counts,
    _extract_all_skills,
    _find_injected_skills,
    validate_output,
)


def test_extract_all_skills():
    master_resume = {
        "cv": {
            "sections": {
                "skills": [
                    {"label": "Languages", "details": "Python, TypeScript, SQL"},
                    {"label": "Tools", "details": "Docker / Git"},
                ]
            }
        }
    }
    skills = _extract_all_skills(master_resume)
    assert "python" in skills
    assert "typescript" in skills
    assert "docker" in skills


def test_find_injected_skills():
    master_skills = {"python", "sql", "git"}
    updated = {
        "cv": {
            "sections": {
                "experience": [
                    {"highlights": ["Built production pipelines with Python and PyTorch."]}
                ]
            }
        }
    }
    injected = _find_injected_skills(updated, master_skills)
    assert "PyTorch" in injected


def test_bullet_truncation():
    updated = {
        "cv": {"sections": {"experience": [{"highlights": [f"Highlight {i}" for i in range(10)]}]}}
    }
    _check_bullet_counts(updated)
    assert len(updated["cv"]["sections"]["experience"][0]["highlights"]) == 6


def test_validate_output_valid():
    master_resume = {
        "cv": {"sections": {"skills": [{"label": "Languages", "details": "Python, Go"}]}}
    }
    llm_output = {
        "updated_resume_json": {
            "cv": {
                "sections": {
                    "experience": [{"highlights": ["Developed microservices using Python."]}]
                }
            }
        },
        "cold_email": "I came across this role. My Python background is an ideal fit. Let us discuss.",
        "changes_made": ["Enhanced bullet points"],
        "rationale": "Strong fit for backend opening",
    }
    validated = validate_output(llm_output, master_resume)
    assert validated is not None
    assert "updated_resume_json" in validated
