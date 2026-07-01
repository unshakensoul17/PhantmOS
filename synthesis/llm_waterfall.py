"""
synthesis/llm_waterfall.py — Ghost Protocol v2.0

LLM fallback chain: Groq → Gemini → HuggingFace → original resume.

Each provider is tried up to 3 times with exponential backoff.
A failure in one provider cleanly falls through to the next.
One job failing NEVER stops the rest of the pipeline.
"""
import asyncio
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
) -> dict | None:
    """
    Try each LLM provider in order.
    Returns a validated dict on success, or None if all providers fail.
    """
    keys = api_keys or {}
    
    # Compile the provider priority queue dynamically
    providers = []
    
    # If the user has custom keys, try those first
    if keys.get("GROQ_API_KEY"):
        providers.append(("Groq (BYOK)", call_groq, keys["GROQ_API_KEY"]))
    if keys.get("GEMINI_API_KEY"):
        providers.append(("Gemini Flash (BYOK)", call_gemini, keys["GEMINI_API_KEY"]))
        
    # Default system fallbacks
    # Under free system keys, Gemini Flash is prioritized over Groq due to 100x higher rate limits
    if ("Gemini Flash (BYOK)" not in [p[0] for p in providers]) and GEMINI_API_KEY:
        providers.append(("Gemini Flash (System)", call_gemini, GEMINI_API_KEY))
    if ("Groq (BYOK)" not in [p[0] for p in providers]) and GROQ_API_KEY:
        providers.append(("Groq (System)", call_groq, GROQ_API_KEY))
        
    # HuggingFace is the final fallback
    hf_key = keys.get("HF_API_KEY") or HF_API_KEY
    if hf_key:
        providers.append(("HuggingFace", call_hf, hf_key))

    for provider_name, provider_fn, key in providers:
        for attempt in range(1, 4):
            try:
                logger.info(
                    f"Waterfall: trying {provider_name} "
                    f"(attempt {attempt}/3)…"
                )
                raw = await provider_fn(system_prompt, user_prompt, api_key=key)
                validated = validate_output(raw, master_resume)

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
