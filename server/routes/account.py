"""Account routes: register, login, logout, /api/me."""
import json
import re
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from server.auth import hash_pwd, check_pwd, get_token_from_request, auth_player, _row_to_dict
from server import cache as _cache
from server.db import get_conn, _write_lock

router = APIRouter()

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,20}$')
EMAIL_RE    = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


def _player_public(player: dict) -> dict:
    """Fields sent to the client after login or /api/me."""
    return {
        'username':              player['username'],
        'score':                 player.get('score', 0),
        'level':                 player.get('level', 1),
        'exp':                   player.get('exp', 0),
        'gold':                  player.get('gold', 0),
        'weapon_index':          player.get('weapon_index', 0),
        'skill_pts':             player.get('skill_pts', {}),
        'knight_pts':            player.get('knight_pts', {}),
        'sorc_pts':              player.get('sorc_pts', {}),
        'ascended':              bool(player.get('ascended', 0)),
        'ascended_class':        player.get('ascended_class'),
        'respec_count':          player.get('respec_count', 0),
        'current_area':          player.get('current_area', 'Rookgaard'),
        'unlocked_areas':        player.get('unlocked_areas', ['Rookgaard']),
        'inventory':             player.get('inventory', {}),
        'potion_timers':         player.get('potion_timers', {}),
        'hmm_cd_end':            player.get('hmm_cd_end', 0),
        'arcane_weakness_stacks': player.get('arcane_weakness_stacks', 0),
        'sudden_death_cd_end':   player.get('sudden_death_cd_end', 0),
        'essence_gathering_end': player.get('essence_gathering_end', 0),
        'boss_spawn_counter':    player.get('boss_spawn_counter', 0),
        'boss_kill_counter':     player.get('boss_kill_counter', 0),
        'total_clicks':          player.get('total_clicks', 0),
        'last_save_ms':          player.get('last_save_ms', 0),
    }


@router.post('/api/register')
async def register(request: Request):
    body = await request.json()
    username = (body.get('username') or '').strip()
    password = (body.get('password') or '')
    email    = (body.get('email') or '').strip() or None

    if not USERNAME_RE.match(username):
        return JSONResponse({'error': 'Username must be 3–20 characters: letters, numbers, underscore.'}, 400)
    if not (4 <= len(password) <= 100):
        return JSONResponse({'error': 'Password must be 4–100 characters.'}, 400)
    if email and not EMAIL_RE.match(email):
        return JSONResponse({'error': 'Invalid email address.'}, 400)

    salt  = secrets.token_hex(16)
    phash = hash_pwd(password, salt)
    token = secrets.token_hex(32)

    conn = get_conn()
    with _write_lock:
        existing = conn.execute(
            'SELECT id FROM players WHERE username = ?', (username,)
        ).fetchone()
        if existing:
            return JSONResponse({'error': 'Username already taken.'}, 409)
        if email:
            dup = conn.execute(
                'SELECT id FROM players WHERE email = ?', (email,)
            ).fetchone()
            if dup:
                return JSONResponse({'error': 'Email already registered.'}, 409)

        conn.execute(
            'INSERT INTO players (username, password_hash, salt, email) VALUES (?, ?, ?, ?)',
            (username, phash, salt, email),
        )
        conn.commit()
        player_row = conn.execute(
            'SELECT * FROM players WHERE username = ?', (username,)
        ).fetchone()
        player_id = player_row['id']
        conn.execute('INSERT INTO sessions (token, player_id) VALUES (?, ?)', (token, player_id))
        conn.commit()

    player = _row_to_dict(player_row)
    _cache.cache_session(token, player_id)
    _cache.cache_player(player_id, player)
    return JSONResponse({'ok': True, 'token': token, 'player': _player_public(player)})


@router.post('/api/login')
async def login(request: Request):
    body     = await request.json()
    username = (body.get('username') or '').strip()
    password = (body.get('password') or '')

    conn = get_conn()
    row  = conn.execute(
        'SELECT * FROM players WHERE username = ?', (username,)
    ).fetchone()
    if row is None:
        return JSONResponse({'error': 'Invalid username or password.'}, 401)

    player = _row_to_dict(row)
    if not check_pwd(password, player['salt'], player['password_hash']):
        return JSONResponse({'error': 'Invalid username or password.'}, 401)

    token = secrets.token_hex(32)
    with _write_lock:
        conn.execute('INSERT INTO sessions (token, player_id) VALUES (?, ?)', (token, player['id']))
        conn.commit()

    _cache.cache_session(token, player['id'])
    _cache.cache_player(player['id'], player)
    return JSONResponse({'ok': True, 'token': token, 'player': _player_public(player)})


@router.post('/api/logout')
async def logout(request: Request):
    token = get_token_from_request(request)
    if not token:
        return JSONResponse({'ok': True})
    conn = get_conn()
    with _write_lock:
        conn.execute('DELETE FROM sessions WHERE token = ?', (token,))
        conn.commit()
    _cache.evict_session(token)
    return JSONResponse({'ok': True})


@router.get('/api/me')
async def me(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)
    return JSONResponse({'ok': True, 'player': _player_public(player)})
