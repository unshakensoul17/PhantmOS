"""
synthesis/llm_gemini.py — Ghost Protocol v2.0

Google Gemini Flash adapter (Try 2 in the LLM waterfall).
Model: gemini-1.5-flash — generous free tier (1,500 req/day).
Uses the Gemini REST API directly via httpx (no SDK dependency).
"""
import json
import httpx

from core.config import GEMINI_API_KEY, GEMINI_MODEL
from core.logger import get_logger

logger = get_logger(__name__)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/{model}:generateContent?key={key}"
)


async def call_gemini(system_prompt: str, user_prompt: str, api_key: str = None) -> dict:
    """
    Call Gemini Flash API and return parsed JSON dict.
    Raises on failure so the waterfall can try the next provider.
    """
    key = api_key or GEMINI_API_KEY
    if not key:
        raise EnvironmentError("GEMINI_API_KEY not configured.")

    url = GEMINI_URL.format(model=GEMINI_MODEL, key=key)

    # Gemini uses a single 'contents' array — prepend system as first turn
    combined_prompt = f"{system_prompt}\n\n{user_prompt}"

    payload = {
        "contents": [
            {
                "parts": [{"text": combined_prompt}],
                "role": "user",
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload)

        if resp.status_code == 429:
            raise RuntimeError("Gemini rate limit hit.")
        resp.raise_for_status()

        data     = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        logger.info("Gemini: response received.")
        return json.loads(raw_text)
