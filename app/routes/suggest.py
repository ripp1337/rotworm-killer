"""Suggestions endpoint."""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.db import get_conn, _write_lock
from app.config import NOTIFY_EMAIL
from app.email_service import send_email

router = APIRouter()


@router.post('/api/suggest')
async def suggest(request: Request):
    body    = await request.json()
    message = (body.get('message') or '').strip()[:2000]
    contact = (body.get('contact') or '').strip()[:100]

    if not message:
        return JSONResponse({'error': 'Message is required.'}, 400)

    now_ms = int(time.time() * 1000)
    conn   = get_conn()
    with _write_lock:
        conn.execute(
            'INSERT INTO suggestions (message, contact, created_at_ms) VALUES (?, ?, ?)',
            (message, contact or None, now_ms),
        )
        conn.commit()

    if NOTIFY_EMAIL:
        html = (
            f'<h3>New Suggestion</h3>'
            f'<p><strong>Contact:</strong> {contact or "(anonymous)"}</p>'
            f'<p><strong>Message:</strong><br>{message}</p>'
        )
        send_email(NOTIFY_EMAIL, 'Rotworm Killer — New Suggestion', html)

    return JSONResponse({'ok': True})
