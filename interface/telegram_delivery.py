import os
from fastapi import FastAPI, Request
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes
from dotenv import load_dotenv

from core.database_manager import update_job_lead, get_lead_by_id

load_dotenv()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_ALLOWED_CHAT_ID", "")

# We initialize FastAPI and the Python-Telegram-Bot Application
app = FastAPI(title="Ghost Protocol Webhook")

bot = Bot(token=TELEGRAM_BOT_TOKEN) if TELEGRAM_BOT_TOKEN else None
application = Application.builder().token(TELEGRAM_BOT_TOKEN).build() if TELEGRAM_BOT_TOKEN else None

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle custom inline button clicks."""
    query = update.callback_query
    await query.answer()
    data = query.data
    
    if not data or "_" not in data:
        return
        
    action, job_id = data.split("_", 1)
    lead = get_lead_by_id(job_id)
    if not lead:
        await context.bot.send_message(chat_id=query.message.chat_id, text="Lead not found.")
        return

    if action == "resume":
        import json
        notes_data = json.loads(lead.get('notes') or '{}')
        resume_path = notes_data.get('resume_path')
        if resume_path and os.path.exists(resume_path):
            with open(resume_path, 'rb') as doc:
                await context.bot.send_document(
                    chat_id=query.message.chat_id, 
                    document=doc,
                    filename=os.path.basename(resume_path)
                )
        else:
            await context.bot.send_message(chat_id=query.message.chat_id, text="Resume PDF not generated yet.")
            
    elif action == "email":
        import json
        notes_data = json.loads(lead.get('notes') or '{}')
        email_text = notes_data.get('cold_email')
        if email_text:
            escaped_text = email_text.replace("_", "\\_").replace("*", "\\*").replace("[", "\\[").replace("]", "\\]")
            await context.bot.send_message(
                chat_id=query.message.chat_id, 
                text=f"```\n{email_text}\n```", 
                parse_mode='Markdown'
            )
            
    elif action == "sendemail":
        import json
        from interface.email_dispatcher import send_cold_email
        from intelligence.email_hunter import find_company_email
        
        notes_data = json.loads(lead.get('notes') or '{}')
        email_text = notes_data.get('cold_email', '')
        resume_path = notes_data.get('resume_path')
        
        if not email_text:
            await context.bot.send_message(chat_id=query.message.chat_id, text="No cold email generated for this lead.")
            return
            
        # Parse subject and body from the generated email string
        lines = email_text.strip().split('\n')
        subject = lines[0].replace("Subject: ", "") if lines[0].startswith("Subject:") else f"Application for {lead.get('title')}"
        body = "\n".join(lines[1:]).strip() if lines[0].startswith("Subject:") else email_text
        
        # 1. Try to dynamically find the HR email via Hunter.io
        await context.bot.send_message(chat_id=query.message.chat_id, text=f"🔍 Hunting for HR/Recruiter email at {lead.get('company')}...")
        target_email = find_company_email(lead.get('company'))
        
        # 2. Fallback if not found or API key missing
        if not target_email:
            target_email = os.getenv("GMAIL_USER") # Fallback to sending to self for review
            await context.bot.send_message(
                chat_id=query.message.chat_id, 
                text=f"⚠️ Could not find HR email via API. Falling back to self-delivery ({target_email}) so you can forward it manually."
            )
        else:
            await context.bot.send_message(chat_id=query.message.chat_id, text=f"🎯 Target Acquired: {target_email}. Dispatching email...")
        
        # 3. Dispatch the email
        success = send_cold_email(target_email, subject, body, resume_path)
        if success:
            await context.bot.send_message(chat_id=query.message.chat_id, text=f"✅ Auto-Apply Successful! Email sent to {target_email}.")
            update_job_lead(job_id, {"status": "Applied"})
            # Remove the button so it can't be clicked twice
            await query.edit_message_reply_markup(reply_markup=None)
        else:
            await context.bot.send_message(chat_id=query.message.chat_id, text="❌ Failed to send email. Check your GMAIL_USER and GMAIL_APP_PASSWORD in .env.")
            
    elif action == "dismiss":
        update_job_lead(job_id, {"status": "Dismissed"})
        # Remove buttons to indicate it's been handled
        await query.edit_message_reply_markup(reply_markup=None)
        await context.bot.send_message(chat_id=query.message.chat_id, text="Lead dismissed.")

if application:
    application.add_handler(CallbackQueryHandler(button_callback))

@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Endpoint for Telegram to push updates."""
    if application:
        payload = await request.json()
        update = Update.de_json(payload, application.bot)
        await application.process_update(update)
    return {"status": "ok"}

async def send_job_card(lead: dict):
    """Deliver a rich markdown card to the user."""
    if not bot or not CHAT_ID:
        print("[Telegram] Token or Chat ID missing. Cannot send card.")
        return
        
    import json
    notes_data = json.loads(lead.get('notes') or '{}')
    rationale = notes_data.get('rationale', 'N/A')
    resume_path = notes_data.get('resume_path')
    email_text = notes_data.get('cold_email')
    
    text = (
        f"🏢 *{lead.get('company')}*\n"
        f"🎯 {lead.get('title')}\n\n"
        f"📊 *Relevance:* {lead.get('match_score', 0)*100:.1f}%\n"
        f"🧠 *AI Rationale:* {rationale}\n\n"
        f"🛡️ *Trust:* {'Verified' if lead.get('genuity_flag') else 'Suspicious'}\n"
        f"🔗 [Apply Here]({lead.get('job_url', 'No Link')})"
    )
    
    try:
        # First send the text card
        await bot.send_message(
            chat_id=CHAT_ID, 
            text=text, 
            parse_mode='Markdown'
        )
        
        # Then proactively attach the PDF document if it exists!
        if resume_path and os.path.exists(resume_path):
            with open(resume_path, 'rb') as doc:
                await bot.send_document(
                    chat_id=CHAT_ID, 
                    document=doc,
                    filename=f"{lead.get('company', 'Company').replace(' ', '_')}_Akash_Yaduwanshi.pdf",
                    caption="📄 Your ATS-optimized tailored resume."
                )
                
        # Proactively send the Cold Email text
        if email_text:
            escaped_text = email_text.replace("_", "\\_").replace("*", "\\*").replace("[", "\\[").replace("]", "\\]")
            
            # Create the interactive Auto-Apply button
            keyboard = [
                [InlineKeyboardButton("🚀 Auto-Apply (Send Email)", callback_data=f"sendemail_{lead['job_id']}")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await bot.send_message(
                chat_id=CHAT_ID, 
                text=f"✉️ *Cold Email Template:*\n\n```\n{email_text}\n```", 
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
                
        update_job_lead(lead["job_id"], {"status": "Sent"})
        print(f"[Telegram] Sent Job Card & Resume & Email for {lead['job_id']}")
    except Exception as e:
        print(f"[Telegram] Error sending card: {e}")
