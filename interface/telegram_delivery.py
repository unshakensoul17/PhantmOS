"""
interface/telegram_delivery.py — PhantmOS v2.0

Rich job card delivery with HOT/WARM bands.
3-button inline keyboard: ✅ Auto-Apply | 👀 Review | ❌ Skip

Button actions:
  Auto-Apply → send cold email via Gmail + update DB to Applied
  Review     → show JD excerpt + tailoring changes side-by-side
  Skip       → ask for skip reason → store feedback → adjust weights

PDF is delivered as a link (Supabase URL) — no local file dependency.
"""
import os
import json
import asyncio
import requests
from fastapi import FastAPI, Request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes
from dotenv import load_dotenv

from core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_API_BASE_URL
from core.database_manager import update_job_lead, get_lead_by_id
from core.logger import get_logger
from delivery.card_formatter import (
    format_job_card,
    format_review_card,
)
from delivery.feedback_processor import (
    handle_apply,
    handle_review,
    handle_skip,
    get_skip_reasons,
)

load_dotenv()
logger = get_logger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
# The queue manager fires ALL pending jobs as near-concurrent coroutines.
# Without this lock, 30+ simultaneous SSL connections hit the Cloudflare Worker
# proxy and it kills them mid-handshake → SSLEOFError.
# This lock serialises all outbound Telegram sends and enforces a minimum
# 1.5-second gap (Telegram also rate-limits bots to 1 msg/s per chat).
_SEND_LOCK: asyncio.Lock = asyncio.Lock()
_LAST_SEND_TIME: float = 0.0
_MIN_SEND_INTERVAL: float = 1.5   # seconds between messages to the same chat


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
    """Dispatch all inline button clicks."""
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    chat_id = query.message.chat_id

    if "_" not in data:
        return

    parts   = data.split("_", 1)
    action  = parts[0]
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
        await _show_skip_reasons(context, chat_id, payload)

    elif action == "skip":
        job_id, _, reason = payload.partition("|")
        await _on_skip(context, chat_id, job_id, reason)
        await query.edit_message_reply_markup(reply_markup=None)

    elif action == "resume":
        lead = get_lead_by_id(payload)
        if lead:
            resume_url = lead.get("resume_url")
            if resume_url:
                if resume_url.startswith("http://") or resume_url.startswith("https://"):
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=f"📎 [Download Your Tailored Resume]({resume_url})",
                        parse_mode="Markdown",
                    )
                else:
                    if os.path.exists(resume_url):
                        with open(resume_url, "rb") as f:
                            await context.bot.send_document(
                                chat_id=chat_id,
                                document=f,
                                filename=os.path.basename(resume_url),
                            )
                    else:
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"Resume file path not found: {resume_url}",
                        )
            else:
                await context.bot.send_message(
                    chat_id=chat_id, text="Resume PDF not yet generated."
                )


from telegram.ext import CommandHandler


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /start deep link to map telegram chat_id to user_id."""
    chat_id = update.effective_chat.id
    args = context.args
    if args:
        user_id = args[0]
        from core.database_manager import update_profile
        try:
            update_profile({"telegram_chat_id": str(chat_id)}, user_id=user_id)
            await update.message.reply_text("✅ PhantmOS connected successfully to your account!")
        except Exception as e:
            logger.error(f"Error mapping telegram chat_id: {e}")
            await update.message.reply_text("❌ Failed to connect Telegram to your account.")
    else:
        await update.message.reply_text("Welcome to PhantmOS Bot! Please connect via the Dashboard.")


if application:
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(button_callback))


# ── Webhook endpoint ───────────────────────────────────────────────────────────

@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Receive Telegram webhook updates."""
    if application:
        payload = await request.json()
        update  = Update.de_json(payload, application.bot)
        await application.process_update(update)
    return {"status": "ok"}


# ── Main card sender ───────────────────────────────────────────────────────────

async def send_job_card(lead: dict) -> bool:
    """
    Send a rich job card to Telegram.
    Serialised by _SEND_LOCK to avoid hammering the Cloudflare proxy with
    concurrent SSL connections (which causes SSLEOFError on the free tier).
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
    band   = lead.get("score_band", "WARM")

    logger.info(f"Telegram: attempting delivery job={job_id} band={band} chat={chat_id} token_ok={bool(TELEGRAM_BOT_TOKEN)}")

    # ── Acquire the global send lock ───────────────────────────────────────────
    # Only one coroutine may send at a time; all others wait their turn.
    async with _SEND_LOCK:
        global _LAST_SEND_TIME

        # Enforce minimum gap between sends (Telegram: 1 msg/s per chat)
        loop      = asyncio.get_event_loop()
        elapsed   = loop.time() - _LAST_SEND_TIME
        wait_secs = _MIN_SEND_INTERVAL - elapsed
        if wait_secs > 0:
            await asyncio.sleep(wait_secs)

        try:
            card_text   = format_job_card(lead)
            status      = lead.get("status", "")
            main_keyboard = _build_main_keyboard(job_id, status)

            payload = {
                "chat_id":                chat_id,
                "text":                   card_text,
                "parse_mode":             "Markdown",
                "reply_markup":           main_keyboard.to_dict(),
                "disable_web_page_preview": True,
            }

            def _send() -> requests.Response:
                return requests.post(
                    f"{TELEGRAM_API_BASE_URL}/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                    json=payload,
                    timeout=30.0,
                )

            resp = await asyncio.to_thread(_send)
            _LAST_SEND_TIME = asyncio.get_event_loop().time()

            if resp.status_code == 200:
                update_job_lead(job_id, {"status": "Approved"}, user_id=user_id)
                logger.info(f"Telegram: sent job card for {job_id} [{band}] to chat {chat_id}.")
                return True
            else:
                logger.error(
                    f"Telegram API error for job {job_id}: "
                    f"HTTP {resp.status_code} | {resp.text}"
                )
                return False

        except Exception as e:
            _LAST_SEND_TIME = asyncio.get_event_loop().time()  # still advance timer on error
            logger.error(
                f"Telegram: error sending card for {job_id} to chat {chat_id}: "
                f"[{type(e).__name__}] {repr(e)}"
            )
            return False


# ── Action handlers ────────────────────────────────────────────────────────────

async def _on_create_resume(context, chat_id: int, job_id: str, query):
    """Handle Create Resume button — trigger synthesis pipeline."""
    from core.database_manager import get_profile, get_lead_by_id, update_job_lead, get_client
    from synthesis.resume_tailor_impl import _tailor_hot, _tailor_warm
    from synthesis.pdf_factory import generate_and_upload_pdf

    await query.edit_message_text(
        text=query.message.text + "\n\n⏳ *Generating highly-tailored resume... Please wait ~15s.*",
        parse_mode="Markdown",
    )

    lead = get_lead_by_id(job_id)
    if not lead:
        return

    user_id = lead.get("user_id")
    profile = get_profile(user_id)
    if not profile:
        return

    band          = lead.get("score_band", "WARM")
    master_resume = profile.get("resume_data") or {}
    preferences   = profile.get("preferences") or {}

    if not master_resume:
        await context.bot.send_message(
            chat_id=chat_id,
            text="❌ You haven't uploaded a master resume yet! Please go to your Dashboard to upload one before tailoring.",
        )
        return

    try:
        if band == "HOT":
            success = await _tailor_hot(lead, master_resume, user_id=user_id, preferences=preferences)
        else:
            success = await _tailor_warm(lead, master_resume, user_id=user_id, preferences=preferences)

        if success:
            lead      = get_lead_by_id(job_id)
            notes_raw = lead.get("notes") or "{}"
            try:
                notes = json.loads(notes_raw)
            except Exception:
                notes = {}

            resume_data = notes.get("updated_resume_json") or master_resume

            url = await generate_and_upload_pdf(job_id=job_id, resume_data=resume_data, user_id=user_id)
            if url:
                update_job_lead(job_id, {"resume_url": url}, user_id=user_id)
                lead["resume_url"] = url
                lead["status"]     = "Tailored"
                get_client().table("delivery_queue").delete().eq("job_id", job_id).execute()
            else:
                logger.error(f"Telegram: PDF generation failed for {job_id} — delivery queue entry preserved for retry.")
                await context.bot.send_message(chat_id=chat_id, text="⚠️ PDF generation failed. Please try again.")
                return

            new_text = format_job_card(lead)
            new_kb   = _build_main_keyboard(job_id, "Tailored")

            await context.bot.send_message(
                chat_id=chat_id,
                text=new_text + "\n\n✅ *Resume successfully generated!*",
                parse_mode="Markdown",
                reply_markup=new_kb,
                disable_web_page_preview=True,
            )
        else:
            await context.bot.send_message(chat_id=chat_id, text="❌ Failed to tailor resume.")
    except Exception as e:
        await context.bot.send_message(chat_id=chat_id, text=f"❌ Error generating resume: {e}")


async def _on_send_cold_email(context, chat_id: int, job_id: str):
    """Handle Send Cold Email button."""
    from interface.email_dispatcher import send_cold_email
    from intelligence.email_hunter import find_company_email
    from core.database_manager import get_profile, update_job_lead

    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=chat_id, text="Lead not found.")
        return

    notes_raw = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw)
    except Exception:
        notes = {}

    cold_email = notes.get("cold_email", "")
    resume_url = lead.get("resume_url") or notes.get("resume_path", "")
    company    = lead.get("company", "")
    title      = lead.get("title", "")

    if not cold_email:
        await context.bot.send_message(chat_id=chat_id, text="⚠️ No cold email generated for this lead.")
        return

    user_id = lead.get("user_id")
    profile = get_profile(user_id)
    if not profile:
        logger.error(f"Telegram: could not load profile for user {user_id} — aborting cold email.")
        await context.bot.send_message(chat_id=chat_id, text="❌ Could not load your profile. Please try again.")
        return

    prefs      = profile.get("preferences") or {}
    llm_prefs  = prefs.get("llm") or {}
    gmail_user = llm_prefs.get("gmail_user", "")
    gmail_pass = llm_prefs.get("gmail_app_password", "")

    target_email = find_company_email(company)

    if not target_email:
        target_email = os.getenv("GMAIL_USER", gmail_user)
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⚠️ Could not find recruiter email. Sending to default ({target_email}) for manual forwarding.",
        )
    else:
        await context.bot.send_message(chat_id=chat_id, text=f"🎯 Recruiter found: {target_email}. Dispatching…")

    lines   = cold_email.strip().split("\n")
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
            text=f"✅ Successfully applied to *{company}*! Cold email sent to {target_email}.",
            parse_mode="Markdown",
        )
    else:
        await context.bot.send_message(chat_id=chat_id, text="❌ Failed to send email. Check SMTP credentials.")


async def _on_review(context, chat_id: int, job_id: str):
    """Handle Review button — show JD + tailoring summary."""
    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=chat_id, text="Lead not found.")
        return

    await handle_review(job_id)
    review_text = format_review_card(lead)
    await context.bot.send_message(
        chat_id=chat_id,
        text=review_text,
        parse_mode="Markdown",
    )


async def _show_skip_reasons(context, chat_id: int, job_id: str):
    """Show an inline keyboard of skip reasons."""
    reasons  = get_skip_reasons()
    keyboard = [
        [InlineKeyboardButton(r["label"], callback_data=f"skip_{job_id}|{r['value']}")]
        for r in reasons
    ]
    await context.bot.send_message(
        chat_id=chat_id,
        text="❌ Why are you skipping this lead?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def _on_skip(context, chat_id: int, job_id: str, reason: str):
    """Handle Skip button — store feedback and dismiss lead."""
    await handle_skip(job_id, reason)
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"❌ Lead dismissed (reason: {reason.replace('_', ' ')}). Preferences updated.",
    )


# ── Keyboard builders ──────────────────────────────────────────────────────────

def _build_main_keyboard(job_id: str, status: str) -> InlineKeyboardMarkup:
    """Main action keyboard (dynamic based on status)."""
    buttons = []

    if status == "Tailored":
        buttons.append(InlineKeyboardButton("⚡ 1-Click Apply", callback_data=f"sendemail_{job_id}"))
        buttons.append(InlineKeyboardButton("📄 View PDF",      callback_data=f"resume_{job_id}"))
    else:
        buttons.append(InlineKeyboardButton("📄 Create Resume", callback_data=f"createresume_{job_id}"))

    buttons.append(InlineKeyboardButton("🔍 Inspect & Edit", callback_data=f"review_{job_id}"))
    buttons.append(InlineKeyboardButton("🗑️ Pass",           callback_data=f"skipask_{job_id}"))

    rows = [buttons[i:i+2] for i in range(0, len(buttons), 2)]
    return InlineKeyboardMarkup(rows)


if __name__ == "__main__":
    if not TELEGRAM_BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN is missing in .env")
    else:
        print("Starting Telegram Bot in Polling Mode (Local Development)...")
        application.run_polling(drop_pending_updates=True)