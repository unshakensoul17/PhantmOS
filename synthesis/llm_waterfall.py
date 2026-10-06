"""
synthesis/llm_waterfall.py — PhantmOS v2.0

LLM fallback chain: Groq → Gemini → HuggingFace → original resume.

Each provider is tried up to 3 times with exponential backoff.
A failure in one provider cleanly falls through to the next.
One job failing NEVER stops the rest of the pipeline.
"""
import asyncio
import json
import os
from typing import Callable, Awaitable

from core.config import RETRY_WAITS, GEMINI_API_KEY, GROQ_API_KEY, HF_API_KEY
from core.logger import get_logger
from synthesis.llm_groq   import call_groq
from synthesis.llm_gemini import call_gemini
from synthesis.llm_hf     import call_hf
from synthesis.output_validator import validate_output

logger = get_logger(__name__)


async def run_waterfall(
    system_prompt: str,
    user_prompt: str,
    master_resume: dict,
    api_keys: dict = None,
    preferences: dict = None,
    validator_fn=validate_output,
) -> dict | None:
    """
    Try each LLM provider in order.
    Returns a validated dict on success, or None if all providers fail.
    """
    keys = api_keys or {}
    settings = preferences or {}
        
    llm_settings = settings.get("llm", {})
    primary_engine = llm_settings.get("primary_engine", "groq|llama-3.1-8b-instant")
    secondary_engine = llm_settings.get("secondary_engine", "gemini|gemini-flash-latest")
    
    # Override keys with vault keys if present
    groq_key = llm_settings.get("groq_api_key") or keys.get("GROQ_API_KEY") or GROQ_API_KEY
    gemini_key = llm_settings.get("gemini_api_key") or keys.get("GEMINI_API_KEY") or GEMINI_API_KEY
    hf_key = keys.get("HF_API_KEY") or HF_API_KEY

    def parse_engine(engine_str):
        parts = engine_str.split("|")
        if len(parts) == 2:
            provider, model = parts[0], parts[1]
            if provider == "gemini" and model == "gemini-1.5-flash":
                model = "gemini-flash-latest"
            return provider, model
        if "groq" in engine_str.lower(): return "groq", "llama-3.1-8b-instant"
        return "gemini", "gemini-flash-latest"

    p_provider, p_model = parse_engine(primary_engine)
    s_provider, s_model = parse_engine(secondary_engine)

    # Compile the provider priority queue dynamically based on primary_engine
    providers = []
    
    # Add Primary
    if p_provider == "groq" and groq_key:
        providers.append((f"Groq ({p_model})", call_groq, groq_key, p_model))
    elif p_provider == "gemini" and gemini_key:
        providers.append((f"Gemini ({p_model})", call_gemini, gemini_key, p_model))
        
    # Add Secondary (if it's different and available)
    if s_provider == "gemini" and p_provider != "gemini" and gemini_key:
        providers.append((f"Gemini ({s_model}) [Fallback]", call_gemini, gemini_key, s_model))
    elif s_provider == "groq" and p_provider != "groq" and groq_key:
        providers.append((f"Groq ({s_model}) [Fallback]", call_groq, groq_key, s_model))
            
    # Add default fallbacks just in case
    if "gemini" not in p_provider and "gemini" not in s_provider and gemini_key:
        providers.append(("Gemini Flash (Default)", call_gemini, gemini_key, "gemini-flash-latest"))
    if "groq" not in p_provider and "groq" not in s_provider and groq_key:
        providers.append(("Groq (Default)", call_groq, groq_key, "llama-3.1-8b-instant"))
            
    if hf_key:
        providers.append(("HuggingFace", call_hf, hf_key, None))

    for provider_name, provider_fn, key, model in providers:
        for attempt in range(1, 4):
            try:
                logger.info(
                    f"Waterfall: trying {provider_name} "
                    f"(attempt {attempt}/3)…"
                )
                if model:
                    raw = await provider_fn(system_prompt, user_prompt, api_key=key, model=model)
                else:
                    raw = await provider_fn(system_prompt, user_prompt, api_key=key)
                if validator_fn:
                    validated = validator_fn(raw, master_resume)
                else:
                    validated = raw

                if validated:
                    logger.info(
                        f"Waterfall: success via {provider_name} "
                        f"on attempt {attempt}."
                    )
                    validated["_provider"] = provider_name
                    return validated
                else:
                    logger.warning(
                        f"Waterfall: {provider_name} output failed validation "
                        f"(attempt {attempt}). Retrying…"
                    )

            except RuntimeError as e:
                # Rate limit or known transient error
                wait = RETRY_WAITS[min(attempt - 1, len(RETRY_WAITS) - 1)]
                logger.warning(
                    f"Waterfall: {provider_name} rate-limited ({e}). "
                    f"Waiting {wait}s…"
                )
                await asyncio.sleep(wait)

            except EnvironmentError as e:
                # API key not configured — skip this provider entirely
                logger.warning(f"Waterfall: {provider_name} skipped — {e}")
                break

            except Exception as e:
                logger.warning(
                    f"Waterfall: {provider_name} attempt {attempt} error: {e}"
                )
                if attempt < 3:
                    await asyncio.sleep(RETRY_WAITS[attempt - 1])
                else:
                    logger.error(
                        f"Waterfall: {provider_name} exhausted all retries."
                    )
                    break  # Move to next provider

    logger.error("Waterfall: ALL providers failed.")
    return None
