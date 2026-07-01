"""
synthesis/template_router.py — Ghost Protocol v2.0

Selects the correct resume HTML template based on company research context.
Detects company type from keywords in the company name and research context.
"""
from core.logger import get_logger

logger = get_logger(__name__)

# Keywords that suggest each company type
STARTUP_SIGNALS    = ["startup", "seed", "series a", "series b", "founded", "stealth",
                      "y combinator", "ycombinator", "techstars", "early stage",
                      "pre-ipo", "venture"]

ENTERPRISE_SIGNALS = ["consulting", "accenture", "deloitte", "pwc", "ibm", "oracle",
                      "sap", "bank", "financial", "insurance", "government", "federal",
                      "enterprise", "corporation", "corp", "llc", "inc", "ltd",
                      "holdings", "global", "international", "group"]

TECH_SIGNALS       = ["deepmind", "openai", "anthropic", "google", "meta", "microsoft",
                      "amazon", "apple", "nvidia", "hugging face", "mistral", "cohere",
                      "ai", "ml", "labs", "research", "tech", "software", "cloud",
                      "platform", "data", "intelligence"]


def select_template(company_name: str, company_context: str = "") -> str:
    """
    Returns one of: 'tech_company', 'startup', 'enterprise'.
    Defaults to 'tech_company' when ambiguous.
    """
    combined = (company_name + " " + company_context).lower()

    # Startup check first (more specific)
    if any(sig in combined for sig in STARTUP_SIGNALS):
        logger.info(f"Template: startup selected for '{company_name}'")
        return "startup"

    # Enterprise check
    if any(sig in combined for sig in ENTERPRISE_SIGNALS):
        logger.info(f"Template: enterprise selected for '{company_name}'")
        return "enterprise"

    # Default: tech company
    logger.info(f"Template: tech_company selected for '{company_name}'")
    return "tech_company"
