import requests

import warnings
try:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        from duckduckgo_search import DDGS
except ImportError:
    DDGS = None

def check_genuity(company: str, description: str) -> str:
    """
    Scan metadata and use free APIs (Clearbit & DuckDuckGo) to verify 
    if a company is legitimate and not a ghost/staffing aggregator.
    """
    if not company or company.strip() == "":
        return "Suspicious: Missing Company Name"
        
    # ---------------------------------------------------------
    # STEP 1: Clearbit Autocomplete API (Free, No Auth)
    # ---------------------------------------------------------
    try:
        url = "https://autocomplete.clearbit.com/v1/companies/suggest"
        resp = requests.get(url, params={"query": company}, timeout=5)
        if resp.status_code == 200:
            results = resp.json()
            if results and len(results) > 0:
                # Clearbit found a matching verified corporate domain!
                return "Verified"
    except Exception as e:
        print(f"[Genuity] Clearbit API failed for {company}: {e}")
        # Soft fail: continue to step 3
        pass 
        
    # ---------------------------------------------------------
    # STEP 2: DuckDuckGo Web Search API (Free Scraper)
    # ---------------------------------------------------------
    # If Clearbit doesn't have it (common for very small startups), 
    # we do a quick DuckDuckGo search to see if they exist on LinkedIn.
    if DDGS:
        try:
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # We search specifically for their LinkedIn company page
                results = list(DDGS().text(f"{company} linkedin company", max_results=3))
            
            for res in results:
                link = res.get("href", "").lower()
                
                # If they have a valid linkedin company page or their name is in the domain
                if "linkedin.com/company" in link:
                    return "Verified"
        except Exception as e:
            print(f"[Genuity] DuckDuckGo API failed for {company}: {e}")
            pass
            
    # If it passed the keyword check but has absolutely ZERO web presence
    # in Clearbit and DuckDuckGo, it is highly likely to be a scam/ghost.
    return "Suspicious: No Web Presence"
