"""Password hashing and session-based authentication."""
import hashlib
import secrets
import json

from app import cache as _cache
from app.db import get_conn


def hash_pwd(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100_000)
    return dk.hex()


def check_pwd(password: str, salt: str, stored_hash: str) -> bool:
    return secrets.compare_digest(hash_pwd(password, salt), stored_hash)


def auth_player(token: str | None) -> dict | None:
    """Return player row dict for token, or None if invalid/expired."""
    if not token:
        return None

    # Cache check 1: session
    player_id = _cache.get_cached_session(token)

    if player_id is None:
        # DB lookup for session
        conn = get_conn()
        row  = conn.execute(
            'SELECT player_id FROM sessions WHERE token = ?', (token,)
        ).fetchone()
        if row is None:
            return None
        player_id = row['player_id']
        _cache.cache_session(token, player_id)

    # Cache check 2: player data
    player = _cache.get_cached_player(player_id)
    if player is not None:
        return player

    conn   = get_conn()
    prow   = conn.execute('SELECT * FROM players WHERE id = ?', (player_id,)).fetchone()
    if prow is None:
        return None

    player = _row_to_dict(prow)
    _cache.cache_player(player_id, player)
    return player


def _row_to_dict(row) -> dict:
    keys = row.keys()
    d = {k: row[k] for k in keys}
    # Parse JSON fields
    for field in ('skill_pts', 'knight_pts', 'sorc_pts', 'unlocked_areas', 'inventory', 'potion_timers'):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = {} if field != 'unlocked_areas' else ['Rookgaard']
    return d


def get_token_from_request(request) -> str | None:
    """Extract Bearer token from Authorization header or query param."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:].strip()
    return request.query_params.get('token', None)
