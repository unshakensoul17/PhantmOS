import os
import requests
import re
from dotenv import load_dotenv

load_dotenv()

APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")

def _search_apollo(company_name: str) -> str:
    if not APOLLO_API_KEY: return None
    search_url = "https://api.apollo.io/api/v1/mixed_people/api_search"
    headers = {"X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache"}
    
    domain = _get_domain(company_name)
    if not domain: return None
    
    # Step 1: Search for a person at the company
    search_payload = {
        "q_organization_domains": domain, 
        "person_titles": ["hr", "recruiter", "talent acquisition", "human resources"],
        "contact_email_status": ["verified"],
        "page": 1,
        "per_page": 2
    }
    
    try:
        response = requests.post(search_url, json=search_payload, headers=headers)
        if response.status_code == 200:
            people = response.json().get("people", [])
            # Find the first person that actually has an email in the DB
            valid_person = next((p for p in people if p.get("has_email")), None)
            
            if valid_person:
                person_id = valid_person.get("id")
                
                # Step 2: Enrich the person to unlock their email
                enrich_url = "https://api.apollo.io/api/v1/people/bulk_match"
                enrich_payload = {
                    "person_ids": [person_id]
                }
                
                enrich_res = requests.post(enrich_url, json=enrich_payload, headers=headers)
                if enrich_res.status_code == 200:
                    matches = enrich_res.json().get("matches", enrich_res.json().get("people", []))
                    if matches and matches[0].get("email"):
                        return matches[0].get("email")
    except Exception as e:
        print(f"[Email Hunter] Apollo Error: {e}")
    return None

def _search_osint(company_name: str) -> str:
    """Fallback: Scrape Google & DuckDuckGo for public emails associated with the company"""
    import re
    query = f'"{company_name}" "hr@" OR "careers@" OR "recruitment@" OR "jobs@"'
    combined_text = ""
    
    # 1. Try Google Search (via googlesearch-python)
    try:
        from googlesearch import search
        import requests
        from bs4 import BeautifulSoup
        
        # We search Google, get the top 3 URLs, fetch their text
        urls = list(search(query, num_results=3, lang="en"))
        for url in urls:
            try:
                res = requests.get(url, timeout=4, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    combined_text += " " + soup.get_text()
            except Exception: pass
            
        # Also include the snippets from DuckDuckGo
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
                combined_text += " " + " ".join([res.get('body', '') for res in results])
        except Exception: pass

    except Exception: pass
    
    # Regex to extract email addresses
    emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', combined_text)
    
    # Filter out dummy/example emails and strict filter for target domains
    valid_emails = [e.lower() for e in emails if not any(x in e.lower() for x in ['example.com', 'domain.com', 'yourcompany.com', 'sentry.io', 'w3.org'])]
    
    # Prioritize hr@, careers@, recruitment@ etc.
    priority = [e for e in valid_emails if any(prefix in e for prefix in ['hr@', 'career', 'job', 'talent', 'recruit'])]
    if priority:
        return priority[0]
        
    if valid_emails:
        return valid_emails[0]
        
    return None

def _get_domain(company_name: str) -> str:
    """Helper to extract domain via Clearbit free API"""
    try:
        # Better sanitization for company names
        clean_name = re.sub(r'(?i)\b(inc|llc|ltd|pvt|corp|corporation)\b\.?', '', company_name).strip()
        res = requests.get(f"https://autocomplete.clearbit.com/v1/companies/suggest?query={clean_name}", timeout=5)
        if res.status_code == 200 and res.json():
            return res.json()[0].get('domain')
    except Exception: pass
    
    # Fallback if clearbit fails
    clean_name = re.sub(r'(?i)[^a-z0-9]', '', company_name)
    return clean_name + ".com"

def _search_smtp_alias(company_name: str) -> str:
    """
    Zero-Cost SMTP Handshake Fallback Engine.
    Guesses aliases and verifies them silently via MX records.
    """
    domain = _get_domain(company_name)
    aliases = [f"hr@{domain}", f"careers@{domain}", f"talent@{domain}", f"hiring@{domain}", f"jobs@{domain}"]
    
    try:
        import subprocess
        import smtplib
        import socket
        
        # 1. Get MX Record
        mx_out = subprocess.check_output(['dig', '+short', 'MX', domain]).decode('utf-8')
        if not mx_out: return None
        
        mx_lines = [line.split() for line in mx_out.strip().split('\n') if line]
        mx_lines.sort(key=lambda x: int(x[0]))
        mx_record = mx_lines[0][1].strip('.')
        
        # 2. SMTP Handshake
        import socket
        socket.setdefaulttimeout(2)
        server = smtplib.SMTP(timeout=2)
        server.set_debuglevel(0)
        try:
            server.connect(mx_record)
            server.helo(socket.getfqdn())
            server.mail('admin@phantmos.ai') # Fake sender
            
            # Catch-All Verification Step
            catch_code, _ = server.rcpt(f"catchall_test_1234567890@{domain}")
            if catch_code == 250:
                # Mail server accepts EVERYTHING (Catch-All). SMTP verification is useless here.
                server.quit()
                return None
            
            for alias in aliases:
                code, message = server.rcpt(alias)
                # 250 means OK (Mailbox exists)
                if code == 250:
                    server.quit()
                    return alias
                    
            server.quit()
        except Exception:
            try: server.quit()
            except: pass
            
    except Exception as e:
        print(f"[Email Hunter] SMTP Fallback Error: {e}")
    return None

def _search_snov(company_name: str) -> str:
    """
    Snov.io API requires OAuth2 and a domain.
    We use Clearbit's free autocomplete API to reliably look up the domain first.
    """
    SNOV_CLIENT_ID = os.getenv("SNOV_CLIENT_ID")
    SNOV_CLIENT_SECRET = os.getenv("SNOV_CLIENT_SECRET")
    
    if not SNOV_CLIENT_ID or not SNOV_CLIENT_SECRET:
        return None
        
    try:
        domain = _get_domain(company_name)
        
        # 1. Authenticate
        token_url = "https://api.snov.io/v1/oauth/access_token"
        token_res = requests.post(token_url, data={
            'grant_type': 'client_credentials',
            'client_id': SNOV_CLIENT_ID,
            'client_secret': SNOV_CLIENT_SECRET
        })
        if token_res.status_code != 200: return None
        token = token_res.json().get('access_token')
        
        # 3. Search
        search_url = "https://api.snov.io/v1/get-domain-emails-with-info"
        params = {
            'domain': domain,
            'type': 'personal',
            'limit': 10
        }
        headers = {'Authorization': f'Bearer {token}'}
        
        res = requests.get(search_url, params=params, headers=headers)
        if res.status_code == 200:
            emails = res.json().get('emails', [])
            # Filter for HR/Recruiter titles
            for e in emails:
                position = str(e.get('position', '')).lower()
                if 'hr' in position or 'recruiter' in position or 'talent' in position:
                    return e.get('email')
                    
            # Fallback to any valid email if HR not found
            if emails:
                return emails[0].get('email')
                
    except Exception as e:
        print(f"[Email Hunter] Snov Error: {e}")
    return None

def find_company_email(company_name: str) -> str:
    """
    WATERFALL APPROACH:
    1. Try Apollo.io (High quality, 600/mo)
    2. Try Snov.io (Backup, 50/mo)
    3. Try SMTP Alias Verification (Zero-cost fallback)
    4. Try OSINT / Web Scraping (Unlimited, Free)
    """
    print(f"[Email Hunter] Commencing Waterfall Search for {company_name}...")
    
    email = _search_apollo(company_name)
    if email:
        print(f"[Email Hunter] SUCCESS via Apollo.io: {email}")
        return email
        
    print(f"[Email Hunter] Apollo failed/exhausted. Trying Snov.io...")
    email = _search_snov(company_name)
    if email:
        print(f"[Email Hunter] SUCCESS via Snov.io: {email}")
        return email
        
    print(f"[Email Hunter] Snov.io failed/exhausted. Trying Zero-Cost SMTP Alias Verification...")
    email = _search_smtp_alias(company_name)
    if email:
        print(f"[Email Hunter] SUCCESS via SMTP Handshake: {email}")
        return email
        
    print(f"[Email Hunter] SMTP Handshake failed. Falling back to OSINT DuckDuckGo Scrape...")
    email = _search_osint(company_name)
    if email:
        print(f"[Email Hunter] SUCCESS via OSINT: {email}")
        return email
        
    print(f"[Email Hunter] Waterfall complete. No targets acquired.")
    return None
