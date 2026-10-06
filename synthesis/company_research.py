"""
synthesis/company_research.py — PhantmOS v3.0

Module for generating AI-driven company intelligence including:
1. Autonomous Tech-Stack Extraction
2. Stability & Layoff Risk Scoring
3. Automated Interview Playbooks
"""
import json
from core.logger import get_logger
from synthesis.llm_groq import call_groq
import warnings

logger = get_logger(__name__)

def _get_realtime_news(company_name: str) -> str:
    """Fetch real-time news headlines to inject into the LLM prompt to overcome its 2-year knowledge lag."""
    try:
        from duckduckgo_search import DDGS
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with DDGS() as ddgs:
                results = list(ddgs.news(company_name, max_results=4))
                if results:
                    news_lines = []
                    for r in results:
                        date = r.get("date", "")[:10]  # Just YYYY-MM-DD
                        title = r.get("title", "")
                        news_lines.append(f"- [{date}] {title}")
                    return "Here is the REAL-TIME news for this company (Use this to fill 'news_timeline' and assess 'stability'):\n" + "\n".join(news_lines)
    except Exception as e:
        logger.warning(f"OSINT news scrape failed for {company_name}: {e}")
    return "Real-time news unavailable. Rely on your pre-trained knowledge."

async def generate_company_intelligence(company_name: str) -> dict:
    """
    Generate the base intelligence (Tech Stack & Stability) for a company.
    Uses Groq with a strict JSON format to return the stack, news, and risk score.
    """
    system_prompt = """You are an elite OSINT and AI tech recruiter intelligence agent.
Given a company name, you must return a strict JSON object detailing their engineering stack, recent news/stability, and a layoff risk assessment based on your training knowledge.

The output MUST be a JSON object with this exact schema:
{
  "name": "Company Name",
  "industry": "Primary Industry/Domain",
  "stack": ["Top 5-8 tech stack keywords, e.g. Rust, K8s, Go"],
  "news_timeline": ["3 recent or notable news/funding/hiring events"],
  "insight": "A 2-sentence highly analytical recruiter insight.",
  "stability": {
    "trend": "up" | "down" | "flat",
    "risk_score": 0-100 (100 being extremely safe, 0 being bankrupt),
    "risk_label": "High Runway" | "Moderate Risk" | "High Layoff Risk"
  }
}
"""
    import asyncio
    realtime_context = await asyncio.to_thread(_get_realtime_news, company_name)
    user_prompt = f"Analyze the tech company: {company_name}\n\n{realtime_context}"

    try:
        data = await call_groq(system_prompt, user_prompt)
        if isinstance(data, str):
            data = data.strip()
            if data.startswith("```"):
                data = data.strip("`")
                if data.startswith("json"):
                    data = data[4:]
            data = json.loads(data.strip())
        return data
    except Exception as e:
        logger.error(f"Error generating company intelligence for {company_name}: {e}")
        # Return fallback dummy data so UI doesn't crash
        return {
            "name": company_name,
            "industry": "Technology",
            "stack": ["React", "Python", "Docker", "AWS"],
            "news_timeline": ["Actively hiring engineering roles."],
            "insight": f"Data not available for {company_name}. Assuming baseline startup risk.",
            "stability": {
                "trend": "flat",
                "risk_score": 50,
                "risk_label": "Unknown Risk"
            }
        }


async def generate_interview_playbook(company_name: str, role: str = "Software Engineer") -> dict:
    """
    Generate an actionable interview playbook containing cultural values, 
    historical technical questions, and recent product launches.
    """
    system_prompt = """You are a FAANG-level career coach and technical interviewer.
Given a company and a role, generate an exclusive 'Interview Cheat Sheet / Playbook'.
Scour your knowledge (simulating Glassdoor, Blind, Reddit) to provide:
1. Cultural values to mention.
2. The exact technical/system design questions they historically ask.
3. Recent product launches to casually mention.

Output MUST be a strict JSON object with this schema:
{
  "company": "Company Name",
  "role": "Role Name",
  "cultural_values": ["value 1 with explanation", "value 2 with explanation"],
  "technical_questions": [
    {"stage": "Phone Screen", "question": "..." },
    {"stage": "System Design", "question": "..." },
    {"stage": "Behavioral", "question": "..." }
  ],
  "product_launches": ["launch 1", "launch 2"]
}
"""
    user_prompt = f"Generate playbook for {company_name} - {role}"

    try:
        data = await call_groq(system_prompt, user_prompt)
        if isinstance(data, str):
            data = data.strip()
            if data.startswith("```"):
                data = data.strip("`")
                if data.startswith("json"):
                    data = data[4:]
            data = json.loads(data.strip())
        return data
    except Exception as e:
        logger.error(f"Error generating playbook for {company_name}: {e}")
        return {
            "company": company_name,
            "role": role,
            "cultural_values": ["Focus on impact and ownership."],
            "technical_questions": [{"stage": "Technical", "question": "Standard algorithmic questions."}],
            "product_launches": ["Core product updates."]
        }
