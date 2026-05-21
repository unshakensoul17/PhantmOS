import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

async def tailor_resume(master_resume_json: dict, jd_text: str, research_hooks: str) -> dict:
    """
    Instruct Llama 3 to specifically surgically modify `work[0].highlights` inside 
    the provided JSON Resume to mirror the JD's exact technical goals.
    """
    if not GROQ_API_KEY:
        print("[Tailor] GROQ_API_KEY not configured.")
        return {}

    prompt = (
        f"Master Resume JSON: {json.dumps(master_resume_json)}\n"
        f"Job Description: {jd_text}\n"
        f"Company Research Hooks: {research_hooks}\n\n"
        "Task:\n"
        "1. Identify the most recent role under `cv.sections.experience` in the JSON.\n"
        "2. You MUST rewrite and rephrase 2-3 key bullet points (highlights) within that role to aggressively mirror the exact technical keywords and goals of the Job Description. DO NOT just copy-paste the old bullet points! Inject relevant JD keywords naturally while remaining truthful to the original achievements.\n"
        "3. CRITICAL FOR SINGLE PAGE FIT: You MUST reduce clutter. For the most recent role, keep EXACTLY 3 bullet points. For all older roles, keep EXACTLY 1 or 2 short bullet points (the most impressive ones). Delete all extra bullet points from the JSON to ensure the resume fits on a single page.\n"
        "4. Generate a highly personalized, 3-sentence cold introductory email addressed to the hiring manager. \n"
        "   - DO NOT use generic openings like 'I am excited to apply for' or 'I am writing to express my interest'.\n"
        "   - DO NOT use placeholders like [Job Board] or [Company Name]. Use the actual company name from the JD.\n"
        "   - Sentence 1: A powerful hook mentioning something specific from the 'Company Research Hooks' (e.g., complimenting their tech stack or recent milestone).\n"
        "   - Sentence 2: A hard-hitting pitch matching their highest priority requirement with your best specific metric from the JSON.\n"
        "   - Sentence 3: A confident, low-friction call to action.\n"
        "5. Provide a 2-line textual rationalization of why this is a strong match.\n\n"
        "You MUST return strict JSON with the following structure:\n"
        "{\n"
        "  \"updated_resume_json\": { ... },\n"
        "  \"cold_email\": \"...\",\n"
        "  \"rationale\": \"...\"\n"
        "}\n"
    )
    
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are a surgical JSON manipulator and career AI. Never fabricate details. Output ONLY valid JSON matching the exact schema."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.6,
        "response_format": {"type": "json_object"}
    }
    
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json=payload
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            
            # Defensively protect strict schema fields that LLMs sometimes hallucinate/flatten
            if "updated_resume_json" in parsed and "cv" in parsed["updated_resume_json"]:
                if "social_networks" in master_resume_json.get("cv", {}):
                    # In rendercv, 'url' is not allowed inside social_networks objects, only network and username.
                    safe_networks = []
                    for net in master_resume_json["cv"]["social_networks"]:
                        safe_networks.append({
                            "network": net.get("network"),
                            "username": net.get("username")
                        })
                    parsed["updated_resume_json"]["cv"]["social_networks"] = safe_networks
                
                # The LLM sometimes hallucinates top-level config blocks like 'design' INSIDE the 'cv' object.
                # We need to strip it out of 'cv' so RenderCV doesn't crash, and put it at the root of updated_resume_json.
                if "cv" in parsed["updated_resume_json"]:
                    if "design" in parsed["updated_resume_json"]["cv"]:
                        del parsed["updated_resume_json"]["cv"]["design"]
                        
                # Defensively copy any top-level config blocks like 'design' that belong at the root
                for key in master_resume_json:
                    if key != "cv" and key not in parsed["updated_resume_json"]:
                        parsed["updated_resume_json"][key] = master_resume_json[key]
                    
            return parsed
    except Exception as e:
        print(f"[Tailor] Error querying Groq: {e}")
        return {}
