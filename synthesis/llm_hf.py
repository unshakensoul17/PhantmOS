"""
synthesis/llm_hf.py — PhantmOS v2.0

HuggingFace Inference API adapter (Try 3 in the LLM waterfall).
Model: mistralai/Mistral-7B-Instruct-v0.3 (free tier).

Used as the final LLM fallback before sending the original resume.
Compatible with HF Spaces runtime (no Ollama needed).
"""
import json
import re
import httpx

from core.config import HF_API_KEY, HF_MODEL
from core.logger import get_logger

logger = get_logger(__name__)

HF_URL = f"https://api-inference.huggingface.co/models/{HF_MODEL}"


async def call_hf(system_prompt: str, user_prompt: str, api_key: str = None) -> dict:
    """
    Call HuggingFace Inference API and return parsed JSON dict.
    Raises on failure.
    """
    key = api_key or HF_API_KEY
    if not key:
        raise EnvironmentError("HF_API_KEY not configured.")

    # Mistral uses [INST] formatting
    prompt = (
        f"<s>[INST] {system_prompt}\n\n{user_prompt} [/INST]"
    )

    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 3000,
            "temperature": 0.4,
            "return_full_text": False,
        },
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            HF_URL,
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
        )

        if resp.status_code == 503:
            raise RuntimeError("HuggingFace model is loading — retry later.")
        if resp.status_code == 429:
            raise RuntimeError("HuggingFace rate limit hit.")
        resp.raise_for_status()

        raw = resp.json()
        # HF returns a list of generated text dicts
        if isinstance(raw, list) and raw:
            text = raw[0].get("generated_text", "")
        else:
            text = str(raw)

        logger.info("HuggingFace: response received.")
        return _extract_json(text)


def _extract_json(text: str) -> dict:
    """
    Extract the first valid JSON object from the model's output.
    HF models sometimes wrap JSON in prose — we strip that out.
    """
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Find first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from HF response: {text[:200]}")
