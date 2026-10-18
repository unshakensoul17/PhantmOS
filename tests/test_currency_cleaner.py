"""
Unit tests for harvesting.currency_cleaner (salary normalization and parsing).
"""

from harvesting.currency_cleaner import (
    format_amount,
    normalize_salary,
    parse_single_number,
)


def test_parse_single_number():
    assert parse_single_number("150,000") == 150000.0
    assert parse_single_number("150k") == 150000.0
    assert parse_single_number("85") == 85000.0  # shorthand notation
    assert parse_single_number("25") == 25.0
    assert parse_single_number(None) is None


def test_format_amount():
    assert format_amount(150000, "$", "USD") == "$150k"
    assert format_amount(2500000, "₹", "INR", is_inr=True) == "₹25L"
    assert format_amount(85, "$", "USD") == "$85"


def test_normalize_salary_usd():
    res = normalize_salary("$120,000 - $160,000 / year")
    assert "$120k" in res
    assert "$160k" in res
    assert "USD" in res


def test_normalize_salary_lpa():
    res = normalize_salary("20 - 35 LPA")
    assert "₹20L - ₹35L INR / yr" in res


def test_normalize_salary_dict():
    comp_dict = {
        "min": 100000,
        "max": 140000,
        "currency": "EUR",
        "interval": "year",
    }
    res = normalize_salary(comp_dict)
    assert "€100k - €140k EUR / yr" in res
