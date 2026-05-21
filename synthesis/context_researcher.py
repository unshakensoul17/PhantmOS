import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    from duckduckgo_search import DDGS

def get_company_context(company_name: str) -> str:
    """Query public web data via DuckDuckGo to pull 1-2 recent milestones or technologies."""
    if not company_name:
        return ""
        
    query = f'"{company_name}" tech stack OR engineering milestones OR product launch'
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=3))
                hooks = [res.get('body', '') for res in results]
                return " | ".join(hooks)
    except Exception as e:
        print(f"[Context Researcher] Could not fetch research for {company_name}: {e}")
        return ""
