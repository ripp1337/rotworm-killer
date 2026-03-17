"""Admin endpoints — all require ADMIN_TOKEN."""
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from server.config import ADMIN_TOKEN
from server.db import get_conn, _write_lock
from server import cache as _cache

router = APIRouter()


def _check_admin(request: Request, body: dict) -> bool:
    token = (
        request.headers.get('X-Admin-Token', '')
        or body.get('admin_token', '')
    )
    return bool(ADMIN_TOKEN and token == ADMIN_TOKEN)


@router.post('/api/admin/list-users')
async def list_users(request: Request):
    body = await request.json()
    if not _check_admin(request, body):
        return JSONResponse({'error': 'Unauthorized.'}, 403)
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, username, score, level, exp, ascended_class, last_save_ms FROM players ORDER BY exp DESC'
    ).fetchall()
    return JSONResponse({'ok': True, 'users': [
        {k: r[k] for k in r.keys()} for r in rows
    ]})


@router.post('/api/admin/delete-users')
async def delete_users(request: Request):
    body = await request.json()
    if not _check_admin(request, body):
        return JSONResponse({'error': 'Unauthorized.'}, 403)
    usernames = body.get('usernames', [])
    if not isinstance(usernames, list) or not usernames:
        return JSONResponse({'error': 'Provide usernames list.'}, 400)
    conn = get_conn()
    deleted = []
    with _write_lock:
        for uname in usernames:
            row = conn.execute('SELECT id FROM players WHERE username = ?', (uname,)).fetchone()
            if row:
                conn.execute('DELETE FROM sessions WHERE player_id = ?', (row['id'],))
                conn.execute('DELETE FROM players WHERE id = ?', (row['id'],))
                _cache.evict_player(row['id'])
                deleted.append(uname)
        conn.commit()
    return JSONResponse({'ok': True, 'deleted': deleted})


@router.post('/api/admin/get-player-state')
async def get_player_state(request: Request):
    body = await request.json()
    if not _check_admin(request, body):
        return JSONResponse({'error': 'Unauthorized.'}, 403)
    username = (body.get('username') or '').strip()
    conn     = get_conn()
    row      = conn.execute('SELECT * FROM players WHERE username = ?', (username,)).fetchone()
    if row is None:
        return JSONResponse({'error': 'Player not found.'}, 404)
    return JSONResponse({'ok': True, 'player': {k: row[k] for k in row.keys()}})


@router.post('/api/admin/list-suggestions')
async def list_suggestions(request: Request):
    body = await request.json()
    if not _check_admin(request, body):
        return JSONResponse({'error': 'Unauthorized.'}, 403)
    conn = get_conn()
    rows = conn.execute(
        'SELECT id, message, contact, created_at_ms FROM suggestions ORDER BY created_at_ms DESC'
    ).fetchall()
    return JSONResponse({'ok': True, 'suggestions': [
        {k: r[k] for k in r.keys()} for r in rows
    ]})


@router.post('/api/admin/reset-db')
async def reset_db(request: Request):
    body = await request.json()
    if not _check_admin(request, body):
        return JSONResponse({'error': 'Unauthorized.'}, 403)
    conn = get_conn()
    with _write_lock:
        conn.execute('DELETE FROM sessions')
        conn.execute('DELETE FROM password_reset_tokens')
        conn.execute('DELETE FROM players')
        conn.commit()
    _cache._session_cache.clear()
    _cache._player_cache.clear()
    return JSONResponse({'ok': True, 'message': 'All players, sessions and tokens deleted.'})
