import os
import asyncio
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
import httpx

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")

async def send_cold_email(
    target_email: str,
    subject: str,
    body_text: str,
    attachment_path: str = None,
    gmail_user: str = None,
    gmail_password: str = None,
) -> bool:
    """
    Sends an email using the provided Gmail account via SMTP.
    Async-safe: PDF downloads use httpx, SMTP is run in a thread pool.
    Returns True if successful, False otherwise.
    """
    user = gmail_user or GMAIL_USER
    password = gmail_password or GMAIL_APP_PASSWORD

    if not user or not password:
        print("[Email Dispatcher] GMAIL_USER or GMAIL_APP_PASSWORD not provided")
        return False

    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = user
        msg['To'] = target_email
        msg.set_content(body_text)

        # Attach PDF if provided
        if attachment_path:
            attachment_data = None
            filename = ""

            if attachment_path.startswith("http"):
                # BUG-11 fix: use httpx instead of blocking requests.get
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        res = await client.get(attachment_path)
                        if res.status_code == 200:
                            attachment_data = res.content
                            filename = attachment_path.split("/")[-1].split("?")[0]
                except Exception as e:
                    print(f"[Email Dispatcher] Failed to download PDF from URL: {e}")
            elif os.path.exists(attachment_path):
                with open(attachment_path, 'rb') as fp:
                    attachment_data = fp.read()
                filename = os.path.basename(attachment_path)

            if attachment_data:
                msg.add_attachment(
                    attachment_data,
                    maintype='application',
                    subtype='pdf',
                    filename=filename or "Resume.pdf"
                )

        # BUG-11 fix: run blocking SMTP in a thread so the event loop is not blocked
        def _smtp_send():
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(user, password)
                server.send_message(msg)

        await asyncio.to_thread(_smtp_send)
        print(f"[Email Dispatcher] Successfully sent email to {target_email}")
        return True
    except Exception as e:
        print(f"[Email Dispatcher] Failed to send email: {e}")
        return False
