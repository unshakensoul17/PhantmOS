"""
Integration and import tests for harvesting modules.
"""

import harvesting.harvest_orchestrator
import harvesting.source_arbeitnow
import harvesting.source_ats
import harvesting.source_himalayas
import harvesting.source_hn
import harvesting.source_remoteok
import harvesting.source_remotive
import harvesting.source_secret


def test_harvesting_modules_loaded():
    assert hasattr(harvesting.source_ats, "fetch_greenhouse_board")
    assert hasattr(harvesting.source_ats, "fetch_lever_board")
    assert hasattr(harvesting.source_ats, "fetch_ashby_board")
    assert hasattr(harvesting.source_ats, "fetch_all_ats_jobs")
    assert len(harvesting.source_ats.FEATURED_GREENHOUSE_COMPANIES) > 10
    assert len(harvesting.source_ats.FEATURED_LEVER_COMPANIES) >= 5
    assert len(harvesting.source_ats.FEATURED_ASHBY_COMPANIES) >= 10


def test_build_lead_structure():
    raw_sample = {
        "title": "Machine Learning Engineer",
        "company": "Anthropic",
        "url": "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs/123",
        "description": "Looking for research engineer with PyTorch expertise.",
        "source": "Greenhouse",
    }
    lead = harvesting.harvest_orchestrator.build_lead(raw_sample)
    assert lead["title"] == "Machine Learning Engineer"
    assert lead["company"] == "Anthropic"
    assert lead["status"] == "Found"
    assert lead["source"] == "Greenhouse"
    assert "job_id" in lead
    assert "dedup_hash" in lead
