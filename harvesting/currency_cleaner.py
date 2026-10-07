"""
harvesting/currency_cleaner.py — PhantmOS v3.0

High-End Multi-Currency & Compensation Parser:
  - Supports: USD ($), EUR (€), GBP (£), INR (₹/LPA), CAD (C$), AUD (A$), SGD (S$)
  - Normalizes hourly, monthly, annual rates and shorthand 'k' / 'Lakhs' notation
  - Regex extraction of compensation ranges from raw JD text when metadata is omitted.
"""

import re


def parse_single_number(token: str) -> float | None:
    """Parse a string like '175,000', '175k', '$150', '25.5' into a numeric value."""
    if not token:
        return None
    token_clean = re.sub(r"[^\d\.kK]", "", str(token)).strip().lower()
    is_k = "k" in token_clean
    num_str = token_clean.replace("k", "").strip()
    try:
        val = float(num_str)
        if is_k and val < 1000:
            val *= 1000
        elif val >= 30 and val < 1000 and not is_k:
            # Shorthand representation e.g. 150 -> 150,000
            val *= 1000
        return val
    except Exception:
        return None


def format_amount(num: float, currency_sym: str = "$", currency_code: str = "USD", is_inr: bool = False) -> str:
    """Format numeric salary cleanly into $150k or ₹25L."""
    if is_inr:
        lakhs = num / 100000.0 if num >= 100000 else num
        if lakhs.is_integer():
            return f"₹{int(lakhs)}L"
        return f"₹{lakhs:.1f}L"

    if num >= 1000:
        k_val = num / 1000.0
        if k_val.is_integer():
            return f"{currency_sym}{int(k_val)}k"
        elif round(k_val, 1) == k_val:
            return f"{currency_sym}{k_val:.1f}k"
        return f"{currency_sym}{int(k_val)}k"
    return f"{currency_sym}{int(num)}"


def normalize_salary(salary_input: str | dict | None, fallback_desc: str = "") -> str:
    """
    Produce a clean, unified salary representation:
      Examples:
        - '$150k - $200k USD / yr'
        - '€80k - €120k EUR / yr'
        - '₹25L - ₹40L INR / yr'
        - '$75 - $110 USD / hr'
    """
    if isinstance(salary_input, dict):
        min_val = salary_input.get("min") or salary_input.get("from")
        max_val = salary_input.get("max") or salary_input.get("to")
        currency = str(salary_input.get("currency", "USD")).upper()
        interval = str(salary_input.get("interval", "year")).lower()

        if min_val and max_val:
            n1 = parse_single_number(str(min_val))
            n2 = parse_single_number(str(max_val))
            if n1 and n2:
                sym = "$" if currency == "USD" else ("€" if currency == "EUR" else ("£" if currency == "GBP" else "₹"))
                suffix = "/ hr" if "hour" in interval else "/ yr"
                return f"{format_amount(n1, sym, currency)} - {format_amount(n2, sym, currency)} {currency} {suffix}"
        elif min_val:
            n1 = parse_single_number(str(min_val))
            if n1:
                return f"{format_amount(n1)} {currency} / yr"

    raw = str(salary_input or "").strip()

    if not raw or raw.lower() in ["none", "null", "competitive", "doe", "n/a", "undefined"]:
        if fallback_desc:
            return extract_salary_from_text(fallback_desc)
        return ""

    # Check for LPA / Indian Lakhs format (e.g. 25 - 40 LPA or ₹25L - ₹40L)
    lpa_match = re.search(r"(?i)(?:₹|INR|Rs\.?|\b)\s*(\d{1,3}(?:\.\d+)?)\s*(?:-|–|to)\s*(\d{1,3}(?:\.\d+)?)\s*(?:LPA|Lakhs|L\b)", raw)
    if lpa_match:
        return f"₹{lpa_match.group(1)}L - ₹{lpa_match.group(2)}L INR / yr"

    # Check hourly (e.g. $80 - $120 / hr)
    if "hr" in raw.lower() or "hour" in raw.lower():
        hourly_matches = re.findall(r"\b\d{2,3}(?:\.\d+)?\b", raw)
        if len(hourly_matches) >= 2:
            return f"${hourly_matches[0]} - ${hourly_matches[1]} USD / hr"
        elif len(hourly_matches) == 1:
            return f"${hourly_matches[0]} USD / hr"

    # Detect currency symbol & code
    curr_sym = "$"
    curr_code = "USD"
    is_inr = False
    if "€" in raw or "eur" in raw.lower():
        curr_sym = "€"
        curr_code = "EUR"
    elif "£" in raw or "gbp" in raw.lower():
        curr_sym = "£"
        curr_code = "GBP"
    elif "₹" in raw or "inr" in raw.lower():
        curr_sym = "₹"
        curr_code = "INR"
        is_inr = True
    elif "c$" in raw.lower() or "cad" in raw.lower():
        curr_sym = "C$"
        curr_code = "CAD"
    elif "a$" in raw.lower() or "aud" in raw.lower():
        curr_sym = "A$"
        curr_code = "AUD"

    # Extract all numbers from the string
    nums = re.findall(r"[\$€£₹]?\s*([0-9,]+(?:\.\d+)?\s*[kK]?)", raw)
    parsed = []
    for n in nums:
        v = parse_single_number(n)
        if v and v >= 10:
            parsed.append(v)

    if len(parsed) >= 2:
        min_n, max_n = min(parsed[0], parsed[1]), max(parsed[0], parsed[1])
        return f"{format_amount(min_n, curr_sym, curr_code, is_inr)} - {format_amount(max_n, curr_sym, curr_code, is_inr)} {curr_code} / yr"
    elif len(parsed) == 1:
        return f"{format_amount(parsed[0], curr_sym, curr_code, is_inr)} {curr_code} / yr"

    return raw


def extract_salary_from_text(text: str) -> str:
    """Scan raw job description text to extract compensation ranges."""
    if not text:
        return ""

    patterns = [
        r"(?i)(?:salary|compensation|base\s+pay|pay\s+range)[^\.\n]{0,80}?([\$€£₹]|USD|EUR|GBP|INR)?\s*([0-9,]+(?:\.\d+)?\s*[kK]?)\s*(?:-|–|to)\s*([\$€£₹]|USD|EUR|GBP|INR)?\s*([0-9,]+(?:\.\d+)?\s*[kK]?)",
        r"(?i)([\$€£₹])\s*([0-9,]+(?:\.\d+)?\s*[kK]?)\s*(?:-|–|to)\s*([\$€£₹])?\s*([0-9,]+(?:\.\d+)?\s*[kK]?)\s*(?:usd|eur|gbp|inr)?\s*(?:per\s+year|/yr|annually|a\s+year)",
    ]

    for pat in patterns:
        m = re.search(pat, text)
        if m:
            extracted_snippet = m.group(0)
            return normalize_salary(extracted_snippet)

    return ""
