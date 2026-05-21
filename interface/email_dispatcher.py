import os
import smtplib
from email.message import EmailMessage
import mimetypes
from dotenv import load_dotenv

load_dotenv()

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")

def send_cold_email(target_email: str, subject: str, body_text: str, attachment_path: str = None) -> bool:
    """
    Sends an email using the configured Gmail account via SMTP.
    Returns True if successful, False otherwise.
    """
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("[Email Dispatcher] GMAIL_USER or GMAIL_APP_PASSWORD not set in .env")
        return False
        
    try:
        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = GMAIL_USER
        msg['To'] = target_email
        msg.set_content(body_text)

        # Attach PDF if provided
        if attachment_path and os.path.exists(attachment_path):
            mime_type, _ = mimetypes.guess_type(attachment_path)
            mime_type = mime_type or 'application/octet-stream'
            maintype, subtype = mime_type.split('/', 1)
            
            with open(attachment_path, 'rb') as fp:
                attachment_data = fp.read()
                
            msg.add_attachment(
                attachment_data, 
                maintype=maintype, 
                subtype=subtype, 
                filename=os.path.basename(attachment_path)
            )

        # Send via Gmail SMTP server
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)
            
        print(f"[Email Dispatcher] Successfully sent email to {target_email}")
        return True
    except Exception as e:
        print(f"[Email Dispatcher] Failed to send email: {e}")
        return False
