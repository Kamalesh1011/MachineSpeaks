import smtplib
import json
from email.mime.text import MIMEText
import httpx
from app.core.config import get_settings


settings = get_settings()


async def send_webhook(payload: dict) -> None:
    if not settings.WEBHOOK_URL:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(settings.WEBHOOK_URL, json=payload)


def send_email(subject: str, body: str, recipients: list[str]) -> None:
    if not settings.SMTP_HOST or not recipients:
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(recipients)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, recipients, msg.as_string())


async def notify_alert(alert_payload: dict) -> None:
    await send_webhook({"event": "alert_created", "data": alert_payload})
