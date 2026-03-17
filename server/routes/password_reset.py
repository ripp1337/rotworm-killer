"""Password reset routes."""
import re
import secrets
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from server.db import get_conn, _write_lock
from server import cache as _cache
from server.config import RESET_TOKEN_EXPIRY_S, GAME_URL, NOTIFY_EMAIL
from server.email_service import send_email

router = APIRouter()

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


@router.post('/api/forgot-password')
async def forgot_password(request: Request):
    body  = await request.json()
    email = (body.get('email') or '').strip()

    # Always respond generically to prevent user enumeration
    if not email or not EMAIL_RE.match(email):
        return JSONResponse({'ok': True})

    conn   = get_conn()
    player = conn.execute('SELECT id FROM players WHERE email = ?', (email,)).fetchone()
    if player is None:
        return JSONResponse({'ok': True})

    token      = secrets.token_hex(32)
    now_ms     = int(time.time() * 1000)
    reset_link = f'{GAME_URL}/reset-password.html?token={token}'

    with _write_lock:
        conn.execute(
            'INSERT INTO password_reset_tokens (token, player_id, created_at_ms) VALUES (?, ?, ?)',
            (token, player['id'], now_ms),
        )
        conn.commit()

    html = (
        f'<p>A password reset was requested for your Rotworm Killer account.</p>'
        f'<p><a href="{reset_link}">Click here to reset your password</a></p>'
        f'<p>This link expires in 1 hour. If you did not request this, ignore this email.</p>'
    )
    send_email(email, 'Rotworm Killer — Password Reset', html)
    return JSONResponse({'ok': True})


@router.post('/api/reset-password')
async def reset_password(request: Request):
    import hashlib
    from server.auth import hash_pwd

    body     = await request.json()
    token    = (body.get('token') or '').strip()
    password = (body.get('password') or '')

    if not token:
        return JSONResponse({'error': 'Missing token.'}, 400)
    if not (4 <= len(password) <= 100):
        return JSONResponse({'error': 'Password must be 4–100 characters.'}, 400)

    conn   = get_conn()
    now_ms = int(time.time() * 1000)
    row    = conn.execute(
        'SELECT * FROM password_reset_tokens WHERE token = ?', (token,)
    ).fetchone()

    if row is None or row['used']:
        return JSONResponse({'error': 'Invalid or already-used reset link.'}, 400)
    if now_ms - row['created_at_ms'] > RESET_TOKEN_EXPIRY_S * 1000:
        return JSONResponse({'error': 'Reset link has expired.'}, 400)

    salt  = secrets.token_hex(16)
    phash = hash_pwd(password, salt)

    with _write_lock:
        conn.execute(
            'UPDATE players SET password_hash = ?, salt = ? WHERE id = ?',
            (phash, salt, row['player_id']),
        )
        conn.execute(
            'UPDATE password_reset_tokens SET used = 1 WHERE token = ?',
            (token,),
        )
        # Invalidate all sessions for this player
        conn.execute('DELETE FROM sessions WHERE player_id = ?', (row['player_id'],))
        conn.commit()

    _cache.evict_all_sessions_for_player(row['player_id'])
    _cache.evict_player(row['player_id'])
    return JSONResponse({'ok': True})
