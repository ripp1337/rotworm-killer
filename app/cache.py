"""In-memory session and player data caches."""
import time
from app.config import SESSION_TTL_S, PLAYER_TTL_S

# token → (player_id, expires_at_unix)
_session_cache: dict[str, tuple[int, float]] = {}

# player_id → (player_row_dict, expires_at_unix)
_player_cache: dict[int, tuple[dict, float]] = {}


# ── Session cache ──────────────────────────────────────────────────

def get_cached_session(token: str) -> int | None:
    """Return player_id if token is in cache and not expired, else None."""
    entry = _session_cache.get(token)
    if entry is None:
        return None
    player_id, expires_at = entry
    if time.time() > expires_at:
        _session_cache.pop(token, None)
        return None
    return player_id


def cache_session(token: str, player_id: int) -> None:
    _session_cache[token] = (player_id, time.time() + SESSION_TTL_S)


def evict_session(token: str) -> None:
    _session_cache.pop(token, None)


def evict_all_sessions_for_player(player_id: int) -> None:
    dead = [t for t, (pid, _) in _session_cache.items() if pid == player_id]
    for t in dead:
        _session_cache.pop(t, None)


# ── Player data cache ──────────────────────────────────────────────

def get_cached_player(player_id: int) -> dict | None:
    entry = _player_cache.get(player_id)
    if entry is None:
        return None
    data, expires_at = entry
    if time.time() > expires_at:
        _player_cache.pop(player_id, None)
        return None
    return data


def cache_player(player_id: int, data: dict) -> None:
    _player_cache[player_id] = (data, time.time() + PLAYER_TTL_S)


def evict_player(player_id: int) -> None:
    _player_cache.pop(player_id, None)
