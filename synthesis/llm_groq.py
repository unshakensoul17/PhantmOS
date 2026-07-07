"""
synthesis/llm_groq.py — PhantmOS v2.0

Groq API adapter (Try 1 in the LLM waterfall).
Model: llama-3.1-8b-instant — fastest free option.
"""
import json
import httpx

from core.config import GROQ_API_KEY, GROQ_MODEL
from core.logger import get_logger

logger = get_logger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def call_groq(system_prompt: str, user_prompt: str, api_key: str = None, model: str = None) -> dict:
    """
    Call Groq API and return parsed JSON dict.
    Raises on failure so the waterfall can try the next provider.
    """
    key = api_key or GROQ_API_KEY
    if not key:
        raise EnvironmentError("GROQ_API_KEY not configured.")

    payload = {
        "model": model or GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
        )

        if resp.status_code == 429:
            raise RuntimeError("Groq rate limit hit.")
        resp.raise_for_status()

        content = resp.json()["choices"][0]["message"]["content"]
        logger.info("Groq: response received.")
        return json.loads(content)
