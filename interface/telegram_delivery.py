"""
interface/telegram_delivery.py — Ghost Protocol v2.0

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
from fastapi import FastAPI, Request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes
from dotenv import load_dotenv

from core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from core.database_manager import update_job_lead, get_lead_by_id
from core.logger import get_logger
from delivery.card_formatter import (
    format_job_card,
    format_cold_email_preview,
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

# FastAPI app (webhook endpoint)
app = FastAPI(title="Ghost Protocol Webhook")

# Telegram bot + application
bot         = Bot(token=TELEGRAM_BOT_TOKEN) if TELEGRAM_BOT_TOKEN else None
application = (
    Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    if TELEGRAM_BOT_TOKEN else None
)


# ── Button callback handler ────────────────────────────────────────────────────

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dispatch all inline button clicks."""
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    chat_id = query.message.chat_id

    if "_" not in data:
        return

    parts  = data.split("_", 1)
    action = parts[0]
    payload = parts[1] if len(parts) > 1 else ""

    if action == "apply":
        await _on_auto_apply(context, chat_id, payload)

    elif action == "review":
        await _on_review(context, chat_id, payload)
        await query.edit_message_reply_markup(reply_markup=None)

    elif action == "skipask":
        # Show skip reason keyboard
        await _show_skip_reasons(context, chat_id, payload)

    elif action == "skip":
        # payload = "{job_id}|{reason}"
        job_id, _, reason = payload.partition("|")
        await _on_skip(context, chat_id, job_id, reason)
        await query.edit_message_reply_markup(reply_markup=None)

    elif action == "email":
        # Show cold email preview
        lead = get_lead_by_id(payload)
        if lead:
            msg = format_cold_email_preview(lead)
            await context.bot.send_message(
                chat_id=chat_id, text=msg, parse_mode="Markdown"
            )

    elif action == "resume":
        # Legacy PDF button — send resume URL or upload local file
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
                    import os
                    if os.path.exists(resume_url):
                        with open(resume_url, "rb") as f:
                            await context.bot.send_document(
                                chat_id=chat_id,
                                document=f,
                                filename=os.path.basename(resume_url)
                            )
                    else:
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"Resume file path not found: {resume_url}"
                        )
            else:
                await context.bot.send_message(
                    chat_id=chat_id, text="Resume PDF not yet generated."
                )

    elif action == "sendemail":
        await _on_auto_apply(context, chat_id, payload)


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
            await update.message.reply_text("✅ Ghost Protocol connected successfully to your account!")
        except Exception as e:
            logger.error(f"Error mapping telegram chat_id: {e}")
            await update.message.reply_text("❌ Failed to connect Telegram to your account.")
    else:
        await update.message.reply_text("Welcome to Ghost Protocol Bot! Please connect via the Dashboard.")


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
    Returns True on success, False on failure.
    """
    if not bot:
        logger.warning("Telegram: bot not configured.")
        return False

    user_id = lead.get("user_id")
    chat_id = None
    if user_id:
        from core.database_manager import get_profile
        profile = get_profile(user_id)
        if profile:
            chat_id = profile.get("telegram_chat_id")

    # Fallback to default from env if profile/chat_id not found
    chat_id = chat_id or TELEGRAM_CHAT_ID
    if not chat_id:
        logger.warning("Telegram: chat_id missing.")
        return False

    job_id = lead.get("job_id", "")
    band   = lead.get("score_band", "WARM")

    try:
        # ── 1. Send the main job card ─────────────────────────────────────────
        card_text = format_job_card(lead)
        resume_url = lead.get("resume_url")
        main_keyboard = _build_main_keyboard(job_id, has_resume=bool(resume_url))

        await bot.send_message(
            chat_id=chat_id,
            text=card_text,
            parse_mode="Markdown",
            reply_markup=main_keyboard,
            disable_web_page_preview=True,
        )

        # ── 2. Send cold email preview inline ─────────────────────────────────
        notes_raw = lead.get("notes") or "{}"
        try:
            notes = json.loads(notes_raw)
        except Exception:
            notes = {}

        cold_email = notes.get("cold_email", "")
        if cold_email:
            email_preview = format_cold_email_preview(lead)
            email_keyboard = _build_email_keyboard(job_id)
            await bot.send_message(
                chat_id=chat_id,
                text=email_preview,
                parse_mode="Markdown",
                reply_markup=email_keyboard,
            )

        # Mark as Approved (delivered to user)
        update_job_lead(job_id, {"status": "Approved"})
        logger.info(f"Telegram: sent job card for {job_id} [{band}] to chat {chat_id}.")
        return True

    except Exception as e:
        logger.error(f"Telegram: error sending card for {job_id} to chat {chat_id}: {e}")
        return False


# ── Action handlers ────────────────────────────────────────────────────────────

async def _on_auto_apply(context, chat_id: int, job_id: str):
    """Handle Auto-Apply button — send cold email via Gmail."""
    from interface.email_dispatcher import send_cold_email
    from intelligence.email_hunter import find_company_email

    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=chat_id, text="Lead not found.")
        return

    notes_raw = lead.get("notes") or "{}"
    try:
        notes = json.loads(notes_raw)
    except Exception:
        notes = {}

    cold_email  = notes.get("cold_email", "")
    resume_url  = lead.get("resume_url") or notes.get("resume_path", "")
    company     = lead.get("company", "")
    title       = lead.get("title", "")

    if not cold_email:
        await context.bot.send_message(
            chat_id=chat_id,
            text="⚠️ No cold email generated for this lead."
        )
        return

    # Hunt for recruiter email
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"🔍 Hunting recruiter email at {company}…"
    )
    target_email = find_company_email(company)

    if not target_email:
        target_email = os.getenv("GMAIL_USER", "")
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"⚠️ Could not find recruiter email. Sending to self ({target_email}) for manual forwarding."
        )
    else:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"🎯 Recruiter found: {target_email}. Dispatching…"
        )

    # Parse subject/body
    lines   = cold_email.strip().split("\n")
    subject = (
        lines[0].replace("Subject: ", "")
        if lines[0].startswith("Subject:")
        else f"Application: {title} at {company}"
    )
    body    = "\n".join(lines[1:]).strip() if lines[0].startswith("Subject:") else cold_email

    success = send_cold_email(target_email, subject, body, resume_url)

    if success:
        await handle_apply(job_id)
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"✅ Applied to *{company}*! Email sent to {target_email}.",
            parse_mode="Markdown",
        )
    else:
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"❌ Failed to send email. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env."
        )


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
    reasons = get_skip_reasons()
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
        text=f"❌ Lead dismissed (reason: {reason.replace('_', ' ')}). Preferences updated."
    )


# ── Keyboard builders ──────────────────────────────────────────────────────────

def _build_main_keyboard(job_id: str, has_resume: bool = False) -> InlineKeyboardMarkup:
    """Main action keyboard (optionally with PDF download button)."""
    buttons = [
        InlineKeyboardButton("✅ Auto-Apply",  callback_data=f"apply_{job_id}"),
        InlineKeyboardButton("👀 Review",      callback_data=f"review_{job_id}"),
        InlineKeyboardButton("❌ Skip",        callback_data=f"skipask_{job_id}"),
    ]
    if has_resume:
        buttons.append(InlineKeyboardButton("📄 PDF", callback_data=f"resume_{job_id}"))
    return InlineKeyboardMarkup([buttons])


def _build_email_keyboard(job_id: str) -> InlineKeyboardMarkup:
    """Email action keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🚀 Send This Email", callback_data=f"sendemail_{job_id}"),
        ]
    ])
