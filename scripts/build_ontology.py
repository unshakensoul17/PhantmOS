"""
scripts/build_ontology.py

Connects to the Gemini API using your existing key to generate a massive 
1000+ job taxonomy across 30+ different industries. 
Outputs the result into `taxonomy.json` in the project root.
"""
import asyncio
import json
import os
import sys
import httpx
from dotenv import load_dotenv

# Ensure we can import from core
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from core.config import GEMINI_API_KEY
from core.logger import get_logger

logger = get_logger(__name__)

if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY is missing from your .env file!")
    sys.exit(1)

INDUSTRIES = [
    "Software Engineering & Web Development",
    "Data Science, Machine Learning & AI",
    "Cloud Computing, DevOps & Infrastructure",
    "Cybersecurity & Information Security",
    "Mobile App Development & Gaming",
    "IT Support, Networking & Systems Administration",
    "Healthcare, Nursing & Medical Professionals",
    "Pharmaceuticals & Clinical Research",
    "Finance, Accounting & Auditing",
    "Investment Banking, Quant & Wealth Management",
    "Sales, Account Management & Business Development",
    "Marketing, SEO & Digital Advertising",
    "Human Resources, Recruiting & Talent Acquisition",
    "Supply Chain, Logistics & Procurement",
    "Manufacturing, Operations & Production",
    "Civil Engineering & Construction",
    "Architecture & Urban Planning",
    "Mechanical Engineering & Robotics",
    "Electrical Engineering & Hardware",
    "Education, Teaching & EdTech",
    "Legal, Compliance & Paralegal",
    "Media, Journalism & Broadcasting",
    "Design (UI/UX, Graphic, Industrial)",
    "Hospitality, Tourism & Event Management",
    "Retail, E-commerce & Merchandising",
    "Customer Success & Technical Support",
    "Real Estate & Property Management",
    "Telecommunications & 5G",
    "Agriculture, Farming & AgTech",
    "Automotive, EV & Transportation",
    "Aerospace, Defense & Space Technologies"
]

API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"

async def fetch_taxonomy(client: httpx.AsyncClient, industry: str) -> dict:
    prompt = f"""
    You are an expert Technical Recruiter and Data Ontologist. 
    Generate a highly comprehensive JSON taxonomy that maps generalized job search terms to their specific, core domain keywords.
    
    Rules:
    1. Keys: Generalized job families or search terms in lowercase (e.g., "frontend", "registered nurse", "accountant").
    2. Values: Array of lowercase strings representing the absolute core technologies, tools, or domain-specific words.
    3. DO NOT include generic words like "engineer", "manager", "developer", "senior", "remote".
    4. Generate between 15 to 30 distinct job families for this industry.
    5. Output ONLY valid JSON.
    
    Target Industry: {industry}
    """
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    for attempt in range(3):
        try:
            response = await client.post(API_URL, json=payload, timeout=45.0)
            if response.status_code == 429:
                logger.warning(f"Rate limited for {industry}. Waiting 10s...")
                await asyncio.sleep(10)
                continue
            
            response.raise_for_status()
            
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # Clean up potential markdown blocks
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
                
            parsed = json.loads(raw_text.strip())
            return parsed
        except Exception as e:
            logger.error(f"Attempt {attempt+1} failed for {industry}: {e}")
            await asyncio.sleep(5)
            
    return {}


async def main():
    logger.info(f"Starting Taxonomy Generation for {len(INDUSTRIES)} industries...")
    master_taxonomy = {}
    
    async with httpx.AsyncClient() as client:
        # Process sequentially to strictly avoid free-tier 15 RPM limits
        for i, ind in enumerate(INDUSTRIES):
            logger.info(f"Processing ({i+1}/{len(INDUSTRIES)}): {ind}")
            
            res = await fetch_taxonomy(client, ind)
            
            if res and isinstance(res, dict):
                for k, v in res.items():
                    if k in master_taxonomy:
                        master_taxonomy[k] = list(set(master_taxonomy[k] + v))
                    else:
                        master_taxonomy[k] = v
                        
            # Sleep 4.5 seconds (13 requests per minute = safe)
            await asyncio.sleep(4.5)
            
    # Save the output
    output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "taxonomy.json"))
    with open(output_path, "w") as f:
        json.dump(master_taxonomy, f, indent=4)
        
    logger.info(f"Success! Generated taxonomy for {len(master_taxonomy)} unique job families.")
    logger.info(f"Saved to: {output_path}")

if __name__ == "__main__":
    asyncio.run(main())
