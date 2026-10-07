"""
interface/telegram_delivery.py — PhantmOS v2.0

Rich job card delivery with HOT/WARM bands.
3-button inline keyboard: ✅ Auto-Apply | 👀 Review | ❌ Skip
"""

import asyncio
import json
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes

from core.config import TELEGRAM_API_BASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from core.database_manager import get_lead_by_id, update_job_lead
from core.logger import get_logger
from delivery.card_formatter import format_job_card, format_review_card
from delivery.feedback_processor import (
    get_skip_reasons,
    handle_apply,
    handle_review,
    handle_skip,
)

load_dotenv()
logger = get_logger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
# Serialises all outbound sends. Prevents hammering the proxy AND respects
# Telegram's 1 msg/s per-chat rate limit.
_SEND_LOCK = None
_LAST_SEND_TIME: float = 0.0
_MIN_SEND_INTERVAL: float = 1.5  # seconds

# ── Endpoint resolution ────────────────────────────────────────────────────────
# Try api.telegram.org directly first (fastest, no proxy hop).
# Fall back to the Cloudflare Worker proxy if HF Space blocks direct access.
# If both share the same value, only one attempt is made.
_TELEGRAM_ENDPOINTS: list[str] = list(
    dict.fromkeys(["https://api.telegram.org", TELEGRAM_API_BASE_URL])
)


# FastAPI app (webhook endpoint)
app = FastAPI(title="PhantmOS Webhook")

# Telegram bot + application
if TELEGRAM_BOT_TOKEN:
    base_url = f"{TELEGRAM_API_BASE_URL}/bot"
    bot = Bot(token=TELEGRAM_BOT_TOKEN, base_url=base_url)
    application = Application.builder().bot(bot).build()
else:
    bot = None
    application = None


# ── Button callback handler ────────────────────────────────────────────────────


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data or ""
    chat_id = query.message.chat_id

    # Handle Triage Deck interactions
    if data == "triage_noop":
        await query.answer()
        return
    elif data.startswith("triage_nav_"):
        await query.answer()
        idx_str = data.replace("triage_nav_", "")
        await _on_triage_nav(context, chat_id, idx_str, query)
        return
    elif data.startswith("triage_tailor_"):
        payload = data.replace("triage_tailor_", "")
        await _on_triage_tailor(context, chat_id, payload, query)
        return
    elif data.startswith("triage_pdf_"):
        job_id = data.replace("triage_pdf_", "")
        await _on_triage_pdf(context, chat_id, job_id, query)
        return
    elif data.startswith("triage_skip_"):
        payload = data.replace("triage_skip_", "")
        await _on_triage_skip(context, chat_id, payload, query)
        return
    elif data.startswith("triage_email_"):
        payload = data.replace("triage_email_", "")
        await _on_triage_email(context, chat_id, payload, query)
        return

    await query.answer()
    if "_" not in data:
        return

    parts, action = data.split("_", 1), data.split("_", 1)[0]
    payload = parts[1] if len(parts) > 1 else ""

    if action == "review":
        await _on_review(context, chat_id, payload)
        await query.edit_message_reply_markup(reply_markup=None)
    elif action == "createresume":
        await _on_create_resume(context, chat_id, payload, query)
    elif action == "sendemail":
        await _on_send_cold_email(context, chat_id, payload)
        await query.edit_message_reply_markup(reply_markup=None)
    elif action == "skipask":
        await _show_skip_reasons(context, chat_id, payload, query)
    elif action == "skip":
        job_id, _, reason = payload.partition("|")
        await _on_skip(context, chat_id, job_id, reason)
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_reply_markup(reply_markup=None)
    elif action == "resume":
        lead = get_lead_by_id(payload)
        if lead:
            resume_url = lead.get("resume_url")
            if resume_url:
                if resume_url.startswith(("http://", "https://")):
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=f"📎 [Download Your Tailored Resume]({resume_url})",
                        parse_mode="Markdown",
                    )
                elif os.path.exists(resume_url):
                    with open(resume_url, "rb") as f:
                        await context.bot.send_document(
                            chat_id=chat_id,
                            document=f,
                            filename=os.path.basename(resume_url),
                        )
                else:
                    await context.bot.send_message(
                        chat_id=chat_id, text=f"Resume file not found: {resume_url}"
                    )
            else:
                await context.bot.send_message(
                    chat_id=chat_id, text="Resume PDF not yet generated."
                )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    args = context.args
    if args:
        user_id = args[0]
        from core.database_manager import update_profile

        try:
            update_profile({"telegram_chat_id": str(chat_id)}, user_id=user_id)
            await update.message.reply_text(
                "✅ PhantmOS connected successfully to your account!\n\nType /radar or /deck to review your opportunities."
            )
        except Exception as e:
            logger.error(f"Error mapping telegram chat_id: {e}")
            await update.message.reply_text("❌ Failed to connect Telegram to your account.")
    else:
        await update.message.reply_text(
            "Welcome to PhantmOS Bot! Please connect via the Dashboard or type /radar to review your active deck."
        )


async def radar_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /radar or /deck command to deliver the user's interactive Triage Deck."""
    chat_id = update.effective_chat.id
    from core.database_manager import get_profile_by_chat_id

    profile = get_profile_by_chat_id(chat_id)
    if not profile:
        await update.message.reply_text(
            "❌ Telegram account is not linked yet. Please click Connect Telegram in your PhantmOS Dashboard."
        )
        return
    await send_triage_deck(profile=profile, chat_id=chat_id)


if application:
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("radar", radar_command))
    application.add_handler(CommandHandler("deck", radar_command))
    application.add_handler(CallbackQueryHandler(button_callback))


# ── Webhook endpoint ───────────────────────────────────────────────────────────


@app.post("/webhook")
async def telegram_webhook(request: Request):
    if application:
        payload = await request.json()
        update = Update.de_json(payload, application.bot)
        await application.process_update(update)
    else:
        logger.error("❌ Telegram application is NOT initialized in telegram_webhook!")
    return {"status": "ok"}


# ── Core HTTP helper ───────────────────────────────────────────────────────────


async def _post_to_telegram(path: str, payload: dict):
    """
    POST to Telegram API, trying endpoints in order:
      1. https://api.telegram.org  (direct — fastest, no proxy hop)
      2. TELEGRAM_API_BASE_URL     (Cloudflare Worker fallback)

    Returns the first successful Response, or None if all endpoints fail.
    Uses requests wrapped in asyncio.to_thread.
    """
    import requests

    for base in _TELEGRAM_ENDPOINTS:
        url = f"{base}/bot{TELEGRAM_BOT_TOKEN}/{path}"
        try:

            def _send(target_url=url):
                return requests.post(
                    target_url, json=payload, timeout=30.0, proxies={"http": None, "https": None}
                )

            resp = await asyncio.to_thread(_send)
            logger.debug(f"Telegram [{base}] → HTTP {resp.status_code}")
            return resp  # success or Telegram-level error
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            logger.warning(f"Telegram: {base} unreachable — trying next endpoint.")
        except Exception as e:
            logger.warning(f"Telegram: unexpected error on {base}: {e!r} — trying next endpoint.")

    logger.error("Telegram: all endpoints failed.")
    return None


# ── Main card sender ───────────────────────────────────────────────────────────


async def send_job_card(lead: dict) -> bool:
    """
    Send a rich job card to Telegram.
    Serialised by _SEND_LOCK + rate-limited to 1 msg / 1.5 s.
    Returns True on success, False on failure.
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram: bot token not configured.")
        return False

    user_id = lead.get("user_id")
    chat_id = None
    if user_id:
        from core.database_manager import get_profile

        profile = get_profile(user_id)
        if profile:
            chat_id = profile.get("telegram_chat_id")

    chat_id = chat_id or TELEGRAM_CHAT_ID
    if not chat_id:
        logger.warning("Telegram: chat_id missing.")
        return False

    job_id = lead.get("job_id", "")
    band = lead.get("score_band", "WARM")

    logger.info(
        f"Telegram: attempting delivery job={job_id} band={band} "
        f"chat={chat_id} token_ok={bool(TELEGRAM_BOT_TOKEN)}"
    )

    global _SEND_LOCK, _LAST_SEND_TIME
    if _SEND_LOCK is None:
        _SEND_LOCK = asyncio.Lock()

    async with _SEND_LOCK:
        elapsed = asyncio.get_event_loop().time() - _LAST_SEND_TIME
        wait_secs = _MIN_SEND_INTERVAL - elapsed
        if wait_secs > 0:
            await asyncio.sleep(wait_secs)

        try:
            card_text = format_job_card(lead)
            main_keyboard = _build_main_keyboard(job_id, lead.get("status", ""))

            payload = {
                "chat_id": chat_id,
                "text": card_text,
                "parse_mode": "Markdown",
                "reply_markup": main_keyboard.to_dict(),
                "disable_web_page_preview": True,
            }

            resp = await _post_to_telegram("sendMessage", payload)
            _LAST_SEND_TIME = asyncio.get_event_loop().time()

            if resp is None:
                return False

            if resp.status_code == 200:
                update_job_lead(job_id, {"status": "Approved"}, user_id=user_id)
                logger.info(f"Telegram: ✅ sent job card for {job_id} [{band}] to chat {chat_id}.")
                return True
            else:
                logger.error(
                    f"Telegram API error for job {job_id}: HTTP {resp.status_code} | {resp.text}"
                )
                return False

        except Exception as e:
            _LAST_SEND_TIME = asyncio.get_event_loop().time()
            logger.error(
                f"Telegram: error sending card for {job_id} to chat {chat_id}: "
                f"[{type(e).__name__}] {repr(e)}"
            )
            return False


async def send_triage_deck(profile: dict, chat_id: int | str) -> bool:
    """
    Send the lightweight PhantmOS Radar summary message with Mini App launcher button.
    Serves as the clean, decision-first entry point into the Compact Mini App.
    """
    if not TELEGRAM_BOT_TOKEN:
        return False

    user_id = profile.get("id")
    if not user_id:
        return False

    from core.database_manager import get_triage_leads_for_user
    from delivery.card_formatter import format_radar_summary

    leads = get_triage_leads_for_user(user_id=user_id, limit=25, min_score=0.4)
    text = format_radar_summary(leads)

    web_app_url = os.getenv("DASHBOARD_URL", "https://unshakensoul17-phantmos.hf.space") + "/radar"
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("🚀 Open Radar", web_app=WebAppInfo(url=web_app_url))]]
    )

    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "reply_markup": keyboard.to_dict(),
        "disable_web_page_preview": True,
    }

    try:
        resp = await _post_to_telegram("sendMessage", payload)
        return resp is not None and resp.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send triage deck summary: {e}")
        return False


async def send_webapp_digest(chat_id: int, count: int, email: str = None) -> bool:
    """Fallback digest sender."""
    return await send_triage_deck(profile={"telegram_chat_id": chat_id}, chat_id=chat_id)


# ── Action handlers ────────────────────────────────────────────────────────────


async def _on_create_resume(context, chat_id: int, job_id: str, query):
    from core.database_manager import get_client, get_lead_by_id, get_profile, update_job_lead
    from synthesis.pdf_factory import generate_and_upload_pdf
    from synthesis.resume_tailor_impl import _tailor_hot, _tailor_warm

    lead = get_lead_by_id(job_id)
    if not lead:
        return

    btn_loading = InlineKeyboardButton("⏳ Generating...", callback_data="ignore")
    btn_skip = InlineKeyboardButton("🗑️ Skip", callback_data=f"skipask_{job_id}")
    await query.edit_message_text(
        text=format_job_card(lead),
        parse_mode="Markdown",
        disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup([[btn_loading, btn_skip]]),
    )

    user_id = lead.get("user_id")
    profile = get_profile(user_id)
    if not profile:
        return
    band = lead.get("score_band", "WARM")
    master_resume = profile.get("resume_data") or {}
    preferences = profile.get("preferences") or {}

    if not master_resume:
        await context.bot.send_message(
            chat_id=chat_id,
            text="❌ You haven't uploaded a master resume yet! Please go to your Dashboard to upload one.",
        )
        return
    try:
        success = await (_tailor_hot if band == "HOT" else _tailor_warm)(
            lead, master_resume, user_id=user_id, preferences=preferences
        )
        if success:
            lead = get_lead_by_id(job_id)
            notes = {}
            try:
                notes = json.loads(lead.get("notes") or "{}")
            except Exception:
                pass
            resume_data = notes.get("updated_resume_json") or master_resume
            url = await generate_and_upload_pdf(
                job_id=job_id, resume_data=resume_data, user_id=user_id
            )
            if url:
                update_job_lead(job_id, {"resume_url": url}, user_id=user_id)
                lead["resume_url"] = url
                lead["status"] = "Tailored"
                get_client().table("delivery_queue").delete().eq("job_id", job_id).execute()
            else:
                logger.error(f"PDF generation failed for {job_id}.")
                await context.bot.send_message(
                    chat_id=chat_id, text="⚠️ PDF generation failed. Please try again."
                )
                return
            await query.edit_message_text(
                text=format_job_card(lead),
                parse_mode="Markdown",
                reply_markup=_build_main_keyboard(job_id, "Tailored"),
                disable_web_page_preview=True,
            )
            if url.startswith(("http://", "https://")):
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=f"📎 [Download Your Tailored Resume]({url})",
                    parse_mode="Markdown",
                )
        else:
            await context.bot.send_message(chat_id=chat_id, text="❌ Failed to tailor resume.")
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"❌ Error generating resume: {e}")


async def _on_send_cold_email(context, chat_id: int, job_id: str):
    from core.database_manager import get_profile, update_job_lead
    from intelligence.email_hunter import find_company_email
    from interface.email_dispatcher import send_cold_email

    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=chat_id, text="Lead not found.")
        return
    notes = {}
    try:
        notes = json.loads(lead.get("notes") or "{}")
    except Exception:
        pass
    cold_email = notes.get("cold_email", "")
    resume_url = lead.get("resume_url") or notes.get("resume_path", "")
    company = lead.get("company", "")
    title = lead.get("title", "")
    if not cold_email:
        await context.bot.send_message(
            chat_id=chat_id, text="⚠️ No cold email generated for this lead."
        )
        return
    user_id = lead.get("user_id")
    profile = get_profile(user_id)
    if not profile:
        await context.bot.send_message(chat_id=chat_id, text="❌ Could not load your profile.")
        return
    prefs = profile.get("preferences") or {}
    llm_prefs = prefs.get("llm") or {}
    gmail_user = llm_prefs.get("gmail_user", "")
    gmail_pass = llm_prefs.get("gmail_app_password", "")
    target_email = find_company_email(company)
    if not target_email:
        target_email = os.getenv("GMAIL_USER", gmail_user)
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⚠️ No recruiter email found. Sending to default ({target_email}).",
        )
    else:
        await context.bot.send_message(
            chat_id=chat_id, text=f"🎯 Recruiter: {target_email}. Dispatching…"
        )
    lines = cold_email.strip().split("\n")
    subject = (
        lines[0].replace("Subject: ", "")
        if lines[0].startswith("Subject:")
        else f"Application: {title} at {company}"
    )
    body = "\n".join(lines[1:]).strip() if lines[0].startswith("Subject:") else cold_email
    success = await send_cold_email(
        target_email=target_email,
        subject=subject,
        body_text=body,
        attachment_path=resume_url,
        gmail_user=gmail_user,
        gmail_password=gmail_pass,
    )
    if success:
        await handle_apply(job_id)
        update_job_lead(job_id, {"status": "Applied"}, user_id=user_id)
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"✅ Applied to *{company}*! Email sent to {target_email}.",
            parse_mode="Markdown",
        )
    else:
        await context.bot.send_message(
            chat_id=chat_id, text="❌ Failed to send email. Check SMTP credentials."
        )


async def _on_review(context, chat_id: int, job_id: str):
    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=chat_id, text="Lead not found.")
        return
    await handle_review(job_id)
    await context.bot.send_message(
        chat_id=chat_id, text=format_review_card(lead), parse_mode="Markdown"
    )


async def _show_skip_reasons(context, chat_id: int, job_id: str, query):
    reasons = get_skip_reasons()
    keyboard = [
        [InlineKeyboardButton(r["label"], callback_data=f"skip_{job_id}|{r['value']}")]
        for r in reasons
    ]
    await query.edit_message_text(
        text="❌ Why are you skipping this lead?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _on_skip(context, chat_id: int, job_id: str, reason: str):
    await handle_skip(job_id, reason)
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"❌ Lead dismissed (reason: {reason.replace('_', ' ')}). Preferences updated.",
    )


# ── Triage Deck In-Memory Cache (Sub-millisecond navigation) ──────────────────
_TRIAGE_CACHE: dict[
    str, dict
] = {}  # chat_id -> {"timestamp": float, "user_id": str, "leads": list}
_CACHE_TTL = 300.0  # 5 minutes cache TTL


def _get_cached_triage_leads(
    chat_id: int | str, force_refresh: bool = False
) -> tuple[str | None, list]:
    now = time.time()
    chat_key = str(chat_id)
    cached = _TRIAGE_CACHE.get(chat_key)
    if (
        not force_refresh
        and cached
        and (now - cached["timestamp"] < _CACHE_TTL)
        and cached.get("leads")
    ):
        return cached["user_id"], cached["leads"]

    from core.database_manager import get_profile_by_chat_id, get_triage_leads_for_user

    profile = get_profile_by_chat_id(chat_id)
    if not profile:
        return None, []
    user_id = profile["id"]
    leads = get_triage_leads_for_user(user_id=user_id, limit=25, min_score=0.4)
    _TRIAGE_CACHE[chat_key] = {
        "timestamp": now,
        "user_id": user_id,
        "leads": leads,
    }
    return user_id, leads


def _update_lead_in_cache(chat_id: int | str, job_id: str, updated_fields: dict):
    chat_key = str(chat_id)
    cached = _TRIAGE_CACHE.get(chat_key)
    if cached and "leads" in cached:
        for lead in cached["leads"]:
            if (lead.get("job_id") or lead.get("id")) == job_id:
                lead.update(updated_fields)
                break


def _build_triage_keyboard(lead: dict, idx: int, total: int) -> InlineKeyboardMarkup:
    job_id = lead.get("job_id", "")
    status = lead.get("status", "")
    resume_url = lead.get("resume_url", "")
    job_url = lead.get("url") or lead.get("job_url")
    web_app_url = os.getenv("DASHBOARD_URL", "https://unshakensoul17-phantmos.hf.space") + "/radar"

    keyboard = []

    # Row 1: Fast Navigation (Prev | Next)
    row1 = []
    if idx > 0:
        row1.append(
            InlineKeyboardButton(f"◀️ Prev ({idx}/{total})", callback_data=f"triage_nav_{idx - 1}")
        )
    else:
        row1.append(InlineKeyboardButton("◀️ Start", callback_data="triage_noop"))

    if idx < total - 1:
        row1.append(
            InlineKeyboardButton(
                f"Next ▶️ ({idx + 2}/{total})", callback_data=f"triage_nav_{idx + 1}"
            )
        )
    else:
        row1.append(InlineKeyboardButton("End ⏹️", callback_data="triage_noop"))
    keyboard.append(row1)

    # Row 2: Core Value Actions: Tailor Resume / Download PDF + Cold Email
    row2 = []
    if status == "Tailored" or (resume_url and str(resume_url).startswith("http")):
        row2.append(InlineKeyboardButton("📥 Download PDF", callback_data=f"triage_pdf_{job_id}"))
    else:
        row2.append(
            InlineKeyboardButton("⚡ Tailor Resume", callback_data=f"triage_tailor_{job_id}_{idx}")
        )
    row2.append(InlineKeyboardButton("✉️ Cold Email", callback_data=f"triage_email_{job_id}_{idx}"))
    keyboard.append(row2)

    # Row 3: Direct Link to Job & Mini App Deck
    row3 = []
    if job_url and str(job_url).startswith("http"):
        row3.append(InlineKeyboardButton("🔗 View Job", url=job_url))
    row3.append(InlineKeyboardButton("🌐 Open Radar App", web_app=WebAppInfo(url=web_app_url)))
    keyboard.append(row3)

    return InlineKeyboardMarkup(keyboard)


async def _on_triage_nav(context, chat_id: int, idx_str: str, query):
    from delivery.card_formatter import format_triage_card

    user_id, leads = _get_cached_triage_leads(chat_id)
    if not user_id or not leads:
        user_id, leads = _get_cached_triage_leads(chat_id, force_refresh=True)

    if not leads:
        await query.edit_message_text(
            text="🎉 *All Caught Up!*\n\nNo pending leads in your Radar.",
            parse_mode="Markdown",
            reply_markup=None,
        )
        return

    try:
        idx = int(idx_str)
    except Exception:
        idx = 0

    idx = max(0, min(idx, len(leads) - 1))
    lead = leads[idx]

    card_text = format_triage_card(lead, idx, len(leads))
    keyboard = _build_triage_keyboard(lead, idx, len(leads))

    try:
        await query.edit_message_text(
            text=card_text,
            parse_mode="Markdown",
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
    except Exception as e:
        logger.debug(f"Triage nav edit exception: {e}")


async def _on_triage_tailor(context, chat_id: int, payload: str, query):
    from core.database_manager import (
        get_client,
        get_lead_by_id,
        get_profile_by_chat_id,
        update_job_lead,
    )
    from delivery.card_formatter import format_triage_card
    from synthesis.pdf_factory import generate_and_upload_pdf
    from synthesis.resume_tailor_impl import _tailor_hot, _tailor_warm

    job_id, _, idx_str = payload.partition("_")
    idx = int(idx_str) if idx_str.isdigit() else 0

    lead = get_lead_by_id(job_id)
    if not lead:
        await query.answer("Lead not found.", show_alert=True)
        return

    profile = get_profile_by_chat_id(chat_id)
    if not profile:
        await query.answer("Profile not found.", show_alert=True)
        return

    user_id = profile["id"]
    master_resume = profile.get("resume_data") or {}
    preferences = profile.get("preferences") or {}

    if not master_resume:
        await query.answer(
            "❌ Master resume missing in Dashboard. Please upload one first.", show_alert=True
        )
        return

    company_name = lead.get("company", "Company")
    title_name = lead.get("title", "Role")

    # Acknowledge immediately so UI doesn't hang
    await query.answer(f"⚡ Tailoring resume for {company_name}...", show_alert=False)

    # Send dedicated progress message below the deck
    progress_msg = await context.bot.send_message(
        chat_id=chat_id,
        text=(
            f"⏳ *Tailoring Resume for {company_name}*\n"
            f"💼 *{title_name}*\n\n"
            f"⚙️ _Analyzing JD, optimizing bullet points & compiling ATS PDF..._"
        ),
        parse_mode="Markdown",
    )

    async def _async_tailor_task():
        try:
            band = lead.get("score_band", "WARM")
            success = await (_tailor_hot if band == "HOT" else _tailor_warm)(
                lead, master_resume, user_id=user_id, preferences=preferences
            )
            if success:
                updated_lead = get_lead_by_id(job_id) or lead
                notes = {}
                try:
                    notes = json.loads(updated_lead.get("notes") or "{}")
                except Exception:
                    pass
                resume_data = notes.get("updated_resume_json") or master_resume
                url = await generate_and_upload_pdf(
                    job_id=job_id, resume_data=resume_data, user_id=user_id
                )
                if url:
                    update_job_lead(job_id, {"resume_url": url, "status": "Tailored"}, user_id=user_id)
                    updated_lead["resume_url"] = url
                    updated_lead["status"] = "Tailored"
                    _update_lead_in_cache(chat_id, job_id, {"resume_url": url, "status": "Tailored"})
                    try:
                        get_client().table("delivery_queue").delete().eq("job_id", job_id).execute()
                    except Exception:
                        pass

                    # Edit progress message to completed state with download button
                    ready_kb = InlineKeyboardMarkup([
                        [
                            InlineKeyboardButton("📥 Download PDF", callback_data=f"triage_pdf_{job_id}"),
                            InlineKeyboardButton("✉️ Cold Email", callback_data=f"triage_email_{job_id}_{idx}"),
                        ]
                    ])
                    await progress_msg.edit_text(
                        text=(
                            f"✅ *Tailored Resume Ready!*\n"
                            f"🏢 *{company_name}* · {title_name}\n\n"
                            f"📄 PDF compiled with RenderCV & ATS optimized."
                        ),
                        parse_mode="Markdown",
                        reply_markup=ready_kb,
                    )

                    # Send PDF document directly to Telegram chat
                    try:
                        await context.bot.send_document(
                            chat_id=chat_id,
                            document=url,
                            filename=f"Resume_{company_name}.pdf",
                            caption=f"📄 *Tailored Resume PDF*\n🏢 *{company_name}* · {title_name}\n\n[Direct Link]({url})",
                            parse_mode="Markdown",
                        )
                    except Exception as doc_err:
                        logger.warning(f"Could not send PDF as document: {doc_err}")
                else:
                    await progress_msg.edit_text(
                        f"⚠️ PDF compile failed for *{company_name}*. Please try again.",
                        parse_mode="Markdown",
                    )
            else:
                await progress_msg.edit_text(
                    f"❌ LLM tailoring failed for *{company_name}*. Please try again.",
                    parse_mode="Markdown",
                )
        except Exception as e:
            logger.error(f"Error in async tailoring task: {e}")
            try:
                await progress_msg.edit_text(f"❌ Error generating resume for {company_name}: {e}")
            except Exception:
                pass

    # Launch tailoring in background task so user can continue navigating immediately
    asyncio.create_task(_async_tailor_task())


async def _on_triage_pdf(context, chat_id: int, job_id: str, query):
    from core.database_manager import get_lead_by_id

    lead = get_lead_by_id(job_id)
    if not lead:
        await query.answer("Lead not found.", show_alert=True)
        return
    url = lead.get("resume_url")
    comp_name = lead.get("company", "Company")
    title_name = lead.get("title", "Role")

    if url and str(url).startswith(("http://", "https://")):
        await query.answer("Sending PDF document...")
        try:
            await context.bot.send_document(
                chat_id=chat_id,
                document=url,
                filename=f"Resume_{comp_name}.pdf",
                caption=f"📄 *Tailored Resume PDF*\n🏢 *{comp_name}* · {title_name}\n\n[Download Direct Link]({url})",
                parse_mode="Markdown",
            )
        except Exception:
            await context.bot.send_message(
                chat_id=chat_id,
                text=f"📎 *Tailored Resume PDF* for *{comp_name}*:\n[Download PDF]({url})",
                parse_mode="Markdown",
            )
    elif url and os.path.exists(url):
        await query.answer("Sending PDF document...")
        with open(url, "rb") as f:
            await context.bot.send_document(
                chat_id=chat_id,
                document=f,
                filename=os.path.basename(url),
                caption=f"📄 Tailored Resume for {comp_name} - {title_name}",
            )
    else:
        await query.answer("PDF not ready yet. Tap '⚡ Tailor Resume'.", show_alert=True)


async def _on_triage_skip(context, chat_id: int, payload: str, query):
    from core.database_manager import get_profile_by_chat_id, update_job_lead
    from delivery.card_formatter import format_triage_card

    job_id, _, idx_str = payload.partition("_")
    idx = int(idx_str) if idx_str.isdigit() else 0

    profile = get_profile_by_chat_id(chat_id)
    if not profile:
        await query.answer("Profile not found.")
        return

    user_id = profile["id"]
    update_job_lead(job_id, {"status": "Dismissed"}, user_id=user_id)
    await query.answer("Lead dismissed.")

    _, leads = _get_cached_triage_leads(chat_id, force_refresh=True)
    if not leads:
        await query.edit_message_text(
            text="🎉 *All Caught Up!*\n\nYou have triaged all current leads in your Radar.\nNew opportunities will arrive on the next harvest run.",
            parse_mode="Markdown",
            reply_markup=None,
        )
    else:
        next_idx = max(0, min(idx, len(leads) - 1))
        lead = leads[next_idx]
        card_text = format_triage_card(lead, next_idx, len(leads))
        keyboard = _build_triage_keyboard(lead, next_idx, len(leads))
        await query.edit_message_text(
            text=card_text,
            parse_mode="Markdown",
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )


async def _on_triage_email(context, chat_id: int, payload: str, query):
    from core.database_manager import get_lead_by_id, get_profile_by_chat_id, update_job_lead
    from intelligence.email_hunter import find_company_email

    job_id, _, idx_str = payload.partition("_")
    int(idx_str) if idx_str.isdigit() else 0

    lead = get_lead_by_id(job_id)
    if not lead:
        await query.answer("Lead not found.")
        return

    company = lead.get("company", "Company")
    title = lead.get("title", "Role")
    notes = {}
    try:
        notes = json.loads(lead.get("notes") or "{}")
    except Exception:
        pass

    cold_email = notes.get("cold_email", "")
    recruiter_email = (
        find_company_email(company) or f"careers@{company.lower().replace(' ', '')}.com"
    )

    if not cold_email:
        profile = get_profile_by_chat_id(chat_id)
        user_name = "Applicant"
        if profile:
            user_name = (profile.get("resume_data") or {}).get("cv", {}).get("name", "Applicant")

        subject = f"Application: {title} — {user_name}"
        body = (
            f"Hi {company} Hiring Team,\n\n"
            f"I recently noticed the {title} opening at {company} and wanted to reach out directly. "
            f"Given my hands-on background aligning closely with your tech stack, I believe I can make an immediate impact on your engineering initiatives.\n\n"
            f"I have prepared a tailored resume highlighting relevant achievements for this role. I would welcome the opportunity to discuss how I can contribute to {company}'s roadmap.\n\n"
            f"Best regards,\n{user_name}"
        )
        cold_email = f"Subject: {subject}\n\n{body}"
        notes["cold_email"] = cold_email
        if profile:
            update_job_lead(job_id, {"notes": json.dumps(notes)}, user_id=profile.get("id"))
            _update_lead_in_cache(chat_id, job_id, {"notes": json.dumps(notes)})

    await query.answer("✉️ Cold email template ready!")
    await context.bot.send_message(
        chat_id=chat_id,
        text=(
            f"✉️ *Cold Outreach Template for {company}*\n"
            f"🎯 *Target Recruiter:* `{recruiter_email}`\n\n"
            f"```text\n{cold_email}\n```\n\n"
            f"💡 _Tip: Tap the box above to copy to clipboard instantly._"
        ),
        parse_mode="Markdown",
    )


# ── Keyboard builders ──────────────────────────────────────────────────────────


def _build_main_keyboard(job_id: str, status: str) -> InlineKeyboardMarkup:
    if status == "Tailored":
        btn1 = InlineKeyboardButton("📄 Download Resume", callback_data=f"resume_{job_id}")
    else:
        btn1 = InlineKeyboardButton("📄 Download Resume", callback_data=f"createresume_{job_id}")
    btn2 = InlineKeyboardButton("🗑️ Skip", callback_data=f"skipask_{job_id}")
    return InlineKeyboardMarkup([[btn1, btn2]])


if __name__ == "__main__":
    if not TELEGRAM_BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN is missing in .env")
    else:
        print("Starting Telegram Bot in Polling Mode (Local Development)...")
        application.run_polling(drop_pending_updates=True)
