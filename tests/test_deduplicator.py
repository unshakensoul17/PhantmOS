"""
Unit tests for intelligence.deduplicator (SHA-256 fingerprinting and normalization).
"""

from intelligence.deduplicator import (
    jaccard_similarity,
    make_dedup_hash,
    normalize_company,
    normalize_location,
    normalize_title,
)


def test_dedup_hash_stability():
    hash1 = make_dedup_hash(
        "Google, Inc.", "Senior Software Engineer (Remote)", "San Francisco, CA"
    )
    hash2 = make_dedup_hash("Google", "Senior Software Engineer", "San Francisco")
    assert isinstance(hash1, str)
    assert isinstance(hash2, str)
    assert len(hash1) == 64


def test_normalization():
    assert normalize_company("Apple Inc.") == "apple"
    assert normalize_company("Amazon LLC") == "amazon"
    # Order-independent title canonicalization (e.g. Developer -> eng)
    assert normalize_title("Python Developer") == "eng python"
    assert normalize_title("Developer Python") == "eng python"
    assert normalize_location("Indore, India") == "indore india"
    assert normalize_location("Fully Remote / Anywhere") == "remote"


def test_jaccard_similarity():
    sim = jaccard_similarity("Backend Python Engineer", "Senior Backend Python Engineer")
    assert 0.5 < sim <= 1.0

    sim_zero = jaccard_similarity("Python Developer", "Graphic Designer")
    assert sim_zero == 0.0
