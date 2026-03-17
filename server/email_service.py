"""Email delivery: Resend API (preferred) with SMTP fallback."""
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.request import urlopen, Request as URLRequest

from server.config import (
    RESEND_API_KEY, RESEND_FROM,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Try Resend first, fall back to SMTP. Returns True on success."""
    if RESEND_API_KEY and RESEND_FROM:
        return _send_resend(to, subject, html_body)
    if SMTP_HOST and SMTP_USER:
        return _send_smtp(to, subject, html_body)
    print(f'[email] No provider configured — email to {to} not sent.')
    return False


def _send_resend(to: str, subject: str, html_body: str) -> bool:
    payload = json.dumps({
        'from':    RESEND_FROM,
        'to':      [to],
        'subject': subject,
        'html':    html_body,
    }).encode()
    req = URLRequest(
        'https://api.resend.com/emails',
        data=payload,
        headers={
            'Authorization': f'Bearer {RESEND_API_KEY}',
            'Content-Type':  'application/json',
        },
        method='POST',
    )
    try:
        with urlopen(req, timeout=10) as resp:
            return resp.status < 300
    except Exception as e:
        print(f'[email] Resend error: {e}')
        if SMTP_HOST and SMTP_USER:
            return _send_smtp(to, subject, html_body)
        return False


def _send_smtp(to: str, subject: str, html_body: str) -> bool:
    msg                   = MIMEMultipart('alternative')
    msg['Subject']        = subject
    msg['From']           = SMTP_FROM
    msg['To']             = to
    msg.attach(MIMEText(html_body, 'html'))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [to], msg.as_string())
        return True
    except Exception as e:
        print(f'[email] SMTP error: {e}')
        return False
