#!/usr/bin/env python3
"""Rotworm Killer – backend server (Python 3 stdlib only, no pip needed)"""

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen, Request as URLRequest
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import collections
import queue as _queue_mod
import os
import tempfile
PORT    = int(os.environ.get('PORT', 3000))
STATIC  = Path(__file__).parent
ANTI_CHEAT_MAX_SCORE_PER_SEC = float(os.environ.get('ANTI_CHEAT_MAX_SCORE_PER_SEC', '80'))
ANTI_CHEAT_MAX_LEVELS_PER_MIN = float(os.environ.get('ANTI_CHEAT_MAX_LEVELS_PER_MIN', '18'))
ANTI_CHEAT_MIN_SCORE_BURST = int(os.environ.get('ANTI_CHEAT_MIN_SCORE_BURST', '500'))
ANTI_CHEAT_MIN_LEVEL_BURST = int(os.environ.get('ANTI_CHEAT_MIN_LEVEL_BURST', '3'))

def _normalize_token(value: str) -> str:
    # Railway/env values can accidentally include whitespace or wrapping quotes.
    return (value or '').strip().strip('"').strip("'")

ADMIN_TOKEN = _normalize_token(os.environ.get('ADMIN_TOKEN', ''))

SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SMTP_FROM = os.environ.get('SMTP_FROM', '') or SMTP_USER
GAME_URL  = os.environ.get('GAME_URL', '')

# Resend (https://resend.com) — preferred on Railway (no SMTP port blocking)
RESEND_API_KEY = _normalize_token(os.environ.get('RESEND_API_KEY', ''))
RESEND_FROM    = os.environ.get('RESEND_FROM', '')  # e.g. "Rotworm Killer <noreply@yourdomain.com>"
NOTIFY_EMAIL   = os.environ.get('NOTIFY_EMAIL', '')  # where to send suggestion notifications

# Turso (https://turso.tech) — persistent remote SQLite, survives Railway redeploys
TURSO_URL        = os.environ.get('TURSO_URL', '')
TURSO_AUTH_TOKEN = _normalize_token(os.environ.get('TURSO_AUTH_TOKEN', ''))
_USE_TURSO       = bool(TURSO_URL and TURSO_AUTH_TOKEN)

if _USE_TURSO:
    import libsql_experimental as libsql  # type: ignore[import-untyped]
    print('[startup] Using Turso remote database')


class _DictRow:
    """sqlite3.Row-compatible wrapper for libsql cursor rows."""
    __slots__ = ('_keys', '_values')
    def __init__(self, description, row):
        self._keys   = [d[0] for d in description]
        self._values = list(row)
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return self._values[self._keys.index(key)]
    def keys(self):
        return self._keys
    def __iter__(self):
        return iter(self._values)

class _TursoCursor:
    """Cursor wrapper that yields _DictRow objects."""
    def __init__(self, cur):
        self._cur = cur
    @property
    def rowcount(self):
        return getattr(self._cur, 'rowcount', -1)
    def fetchone(self):
        desc = self._cur.description
        row  = self._cur.fetchone()
        return _DictRow(desc, row) if row is not None else None
    def fetchall(self):
        desc = self._cur.description
        return [_DictRow(desc, r) for r in self._cur.fetchall()]

class _TursoConn:
    """Connection wrapper that adds sqlite3.Row-style column-name access."""
    def __init__(self, raw):
        self._raw = raw
        self.row_factory = None  # present so assignment doesn't fail
    def execute(self, sql, params=()):
        return _TursoCursor(self._raw.execute(sql, params))
    def commit(self):
        self._raw.commit()
    def sync(self):
        self._raw.sync()
    def close(self):
        self._raw.close()

_turso_conn: _TursoConn | None = None  # single global connection; set in init_db() when _USE_TURSO

RESET_TOKEN_EXPIRY_MS = 3600 * 1000  # 1 hour

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

def _is_writable_dir(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        test_file = path / '.rw-test'
        test_file.write_text('ok', encoding='utf-8')
        try:
            if test_file.exists():
                test_file.unlink()
        except Exception:
            pass
        return True
    except Exception:
        return False

def resolve_db_path() -> Path:
    candidates = []
    data_dir_env = os.environ.get('DATA_DIR')
    if data_dir_env:
        candidates.append(Path(data_dir_env))
    candidates.append(STATIC)
    candidates.append(Path(tempfile.gettempdir()) / 'rotworm-killer')

    for candidate in candidates:
        if _is_writable_dir(candidate):
            return candidate / 'game.db'

    raise RuntimeError('No writable directory found for SQLite database.')

DB_PATH = resolve_db_path()
print(f'[startup] DB_PATH={DB_PATH}')

# ── Database ───────────────────────────────────────────────────────
def init_db():
    global _turso_conn
    if _USE_TURSO:
        raw = libsql.connect(str(DB_PATH), sync_url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)
        raw.sync()
        _turso_conn = _TursoConn(raw)
        conn = _turso_conn
    else:
        conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            salt          TEXT    NOT NULL,
            email         TEXT    UNIQUE DEFAULT NULL,
            score         INTEGER DEFAULT 0,
            level         INTEGER DEFAULT 1,
            state         TEXT    DEFAULT NULL,
            last_save_ms  INTEGER DEFAULT 0,
            cheat_flags   INTEGER DEFAULT 0,
            total_clicks  INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT    PRIMARY KEY,
            player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token         TEXT    PRIMARY KEY,
            player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            created_at_ms INTEGER NOT NULL,
            used          INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS suggestions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            message       TEXT    NOT NULL,
            contact       TEXT    DEFAULT NULL,
            created_at_ms INTEGER NOT NULL
        )
    """)
    conn.commit()

    # Backfill anti-cheat columns for older databases.
    existing_cols = {
        row[1] for row in conn.execute('PRAGMA table_info(players)').fetchall()
    }
    if 'last_save_ms' not in existing_cols:
        conn.execute('ALTER TABLE players ADD COLUMN last_save_ms INTEGER DEFAULT 0')
    if 'cheat_flags' not in existing_cols:
        conn.execute('ALTER TABLE players ADD COLUMN cheat_flags INTEGER DEFAULT 0')
    if 'total_clicks' not in existing_cols:
        conn.execute('ALTER TABLE players ADD COLUMN total_clicks INTEGER DEFAULT 0')
    if 'email' not in existing_cols:
        conn.execute('ALTER TABLE players ADD COLUMN email TEXT DEFAULT NULL')
        conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email ON players(email) WHERE email IS NOT NULL')

    conn.commit()
    if not _USE_TURSO:
        conn.close()  # keep _turso_conn open for the lifetime of the process

init_db()

# Thread-local SQLite connections (WAL mode for concurrency)
_tls        = threading.local()
_write_lock = threading.Lock()

# ── In-memory session cache ────────────────────────────────────────
# Avoids 2 Turso round-trips on every authenticated request; only the
# first request per session hits the remote DB for the session row.
_session_cache: dict = {}   # token -> (player_id, expires_at)
_SESSION_CACHE_TTL = 600.0  # 10 minutes

def _cache_session(token: str, player_id: int) -> None:
    _session_cache[token] = (player_id, time.time() + _SESSION_CACHE_TTL)

def _invalidate_session(token: str) -> None:
    _session_cache.pop(token, None)

def _invalidate_player_sessions(player_id: int) -> None:
    dead = [t for t, (pid, _) in list(_session_cache.items()) if pid == player_id]
    for t in dead:
        del _session_cache[t]

# ── Player data cache ─────────────────────────────────────────────
# After the first DB fetch, every subsequent auth'd request is served
# entirely from memory — zero Turso round-trips on the hot path.
_player_data_cache: dict = {}   # player_id -> (row_dict, expires_at)
_PLAYER_DATA_CACHE_TTL = 3600.0  # 1 hour

_PLAYER_ALL_COLS = 'id,username,score,level,state,last_save_ms,cheat_flags,total_clicks'

def _cache_player_data(row) -> None:
    d = {k: row[k] for k in row.keys()}
    _player_data_cache[d['id']] = (d, time.time() + _PLAYER_DATA_CACHE_TTL)

def _get_cached_player_data(player_id: int):
    entry = _player_data_cache.get(player_id)
    if not entry:
        return None
    d, exp = entry
    if time.time() < exp:
        return d
    del _player_data_cache[player_id]
    return None

def _evict_player(player_id: int) -> None:
    """Remove player from both caches (on delete / password reset)."""
    _player_data_cache.pop(player_id, None)
    _invalidate_player_sessions(player_id)

def _player_public(player) -> dict:
    """Return only the fields the client needs — never expose anti-cheat data."""
    return {
        'id':       player['id'],
        'username': player['username'],
        'score':    player['score'],
        'level':    player['level'],
        'state':    player['state'],
    }

# ── Live chat ──────────────────────────────────────────────────────
_chat_messages: collections.deque = collections.deque(maxlen=100)
_chat_subscribers: list = []   # list of queue.Queue
_chat_lock      = threading.Lock()
_chat_rate: dict = {}           # username -> last send timestamp (ms)

def db() -> _TursoConn | sqlite3.Connection:
    if _USE_TURSO:
        assert _turso_conn is not None
        return _turso_conn  # single global connection — no per-request libsql overhead
    if not hasattr(_tls, 'conn'):
        _tls.conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        _tls.conn.row_factory = sqlite3.Row
        _tls.conn.execute('PRAGMA journal_mode=WAL')
        _tls.conn.execute('PRAGMA foreign_keys=ON')
    return _tls.conn

# ── Auth helpers ───────────────────────────────────────────────────
def hash_pwd(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 260_000)
    return dk.hex()

def auth_player(token: str):
    if not token:
        return None
    # Fast path: session cached — try player cache next (0 Turso queries).
    entry = _session_cache.get(token)
    if entry:
        player_id, exp = entry
        if time.time() < exp:
            _session_cache[token] = (player_id, time.time() + _SESSION_CACHE_TTL)
            cached = _get_cached_player_data(player_id)
            if cached:
                return cached
            row = db().execute(
                f'SELECT {_PLAYER_ALL_COLS} FROM players WHERE id=?', (player_id,)
            ).fetchone()
            if row:
                _cache_player_data(row)
            return row
        del _session_cache[token]  # expired
    # Slow path: first request for this session — check DB.
    row = db().execute('SELECT player_id FROM sessions WHERE token=?', (token,)).fetchone()
    if not row:
        return None
    player_id = row['player_id']
    _cache_session(token, player_id)
    cached = _get_cached_player_data(player_id)
    if cached:
        return cached
    row = db().execute(
        f'SELECT {_PLAYER_ALL_COLS} FROM players WHERE id=?', (player_id,)
    ).fetchone()
    if row:
        _cache_player_data(row)
    return row

# ── State versioning ──────────────────────────────────────────────
LATEST_STATE_VERSION = 4

def _upgrade_state(state: dict) -> dict:
    """Bring any player state up to LATEST_STATE_VERSION, filling missing keys
    with safe defaults. Never overwrites existing values.
    Add a new `if v < N` block here for every future version bump."""
    v = int(state.get('stateVersion') or 0)

    if v < 1:
        # Baseline – stamp all the keys that exist in v1.
        state.setdefault('score', 0)
        state.setdefault('gold', 0)
        state.setdefault('exp', 0)
        state.setdefault('level', 1)
        state.setdefault('weaponIndex', 0)
        state.setdefault('skillPoints', 0)
        state.setdefault('knightSkillPts', {})
        state.setdefault('sorcSkillPts', {})
        state.setdefault('gfbUnlocked', False)
        state.setdefault('ueUnlocked', False)
        state.setdefault('powerStanceUnlocked', False)
        state.setdefault('powerStanceCooldownEnd', 0)
        state.setdefault('autoUnlocked', False)
        state.setdefault('autoEnabled', False)
        state.setdefault('autoGfbUnlocked', False)
        state.setdefault('autoGfbEnabled', False)
        state.setdefault('autoUeUnlocked', False)
        state.setdefault('autoUeEnabled', False)
        state.setdefault('bossFocusUnlocked', False)
        state.setdefault('ascended', False)
        state.setdefault('ascendedClass', None)
        state.setdefault('annihilationUnlocked', False)
        state.setdefault('bossSpawnCounter', 0)
        state.setdefault('firstBossSpawned', False)
        state['stateVersion'] = 1

    if v < 2:
        # v2 adds totalClicks tracking.
        state.setdefault('totalClicks', 0)
        state['stateVersion'] = 2

    if v < 3:
        # v3 adds inventory and potion buff timers.
        state.setdefault('inventory', {})
        state.setdefault('potionWealthEnd', 0)
        state.setdefault('potionWisdomEnd', 0)
        state.setdefault('potionSwiftnessEnd', 0)
        state['stateVersion'] = 3

    if v < 4:
        # v4 expands weapon list from 5 to 15; remap old indices to closest new equivalents.
        _WEAPON_MIGRATION = {0: 2, 1: 4, 2: 7, 3: 11, 4: 12}
        old_idx = int(state.get('weaponIndex') or 0)
        state['weaponIndex'] = _WEAPON_MIGRATION.get(old_idx, old_idx)
        state['stateVersion'] = 4

    return state

def _send_suggest_notification(message: str, contact: str) -> None:
    """Fire-and-forget email to NOTIFY_EMAIL when a suggestion arrives."""
    if not (RESEND_API_KEY and RESEND_FROM and NOTIFY_EMAIL):
        return
    contact_line = f'<p><b>Contact:</b> {contact}</p>' if contact else '<p><i>Anonymous</i></p>'
    html = (
        '<h3>New Rotworm Killer Feedback</h3>'
        f'{contact_line}'
        f'<p><b>Message:</b></p><pre style="white-space:pre-wrap">{message}</pre>'
    )
    plain = f'Contact: {contact or "(anonymous)"} \n\nMessage:\n{message}'
    try:
        payload = json.dumps({
            'from':    RESEND_FROM,
            'to':      [NOTIFY_EMAIL],
            'subject': 'Rotworm Killer \u2013 New Feedback',
            'html':    html,
            'text':    plain,
        }).encode()
        req = URLRequest(
            'https://api.resend.com/emails',
            data=payload,
            headers={
                'Authorization': f'Bearer {RESEND_API_KEY}',
                'Content-Type':  'application/json',
                'User-Agent':    'RotwormKiller/1.0',
            },
            method='POST',
        )
        with urlopen(req, timeout=10) as resp:
            if resp.status not in (200, 201):
                print(f'[suggest-notify] Resend HTTP {resp.status}')
    except Exception as exc:
        print(f'[suggest-notify] failed: {exc}')


def _send_reset_email(to_email: str, reset_url: str) -> bool:
    """Send a password-reset email. Uses Resend HTTP API if configured (preferred
    on Railway), otherwise falls back to SMTP."""
    plain = (
        'Click the link below to reset your Rotworm Killer password:\n\n'
        f'{reset_url}\n\n'
        'This link expires in 1 hour.\n'
        'If you did not request a password reset, please ignore this email.'
    )
    html = (
        '<p>Click the link below to reset your <b>Rotworm Killer</b> password:</p>'
        f'<p><a href="{reset_url}">{reset_url}</a></p>'
        '<p>This link expires in <b>1 hour</b>.</p>'
        '<p><small>If you did not request a password reset, please ignore this email.</small></p>'
    )

    # ── Resend HTTP API (works on Railway) ─────────────────────────
    if RESEND_API_KEY and RESEND_FROM:
        try:
            payload = json.dumps({
                'from':    RESEND_FROM,
                'to':      [to_email],
                'subject': 'Rotworm Killer \u2013 Password Reset',
                'html':    html,
                'text':    plain,
            }).encode()
            req = URLRequest(
                'https://api.resend.com/emails',
                data=payload,
                headers={
                    'Authorization': f'Bearer {RESEND_API_KEY}',
                    'Content-Type':  'application/json',
                    'User-Agent':    'RotwormKiller/1.0',
                },
                method='POST',
            )
            with urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    return True
                body = resp.read().decode(errors='replace')
                print(f'[email] Resend returned HTTP {resp.status}: {body}')
                return False
        except Exception as exc:
            body = getattr(exc, 'read', lambda: b'')()
            if body:
                body = body.decode(errors='replace')
                print(f'[email] Resend failed: {exc} — {body}')
            else:
                print(f'[email] Resend failed: {exc}')
            return False

    # ── SMTP fallback (may be blocked on Railway) ──────────────────
    if not SMTP_HOST:
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = 'Rotworm Killer \u2013 Password Reset'
        msg['From']    = SMTP_FROM
        msg['To']      = to_email
        msg.attach(MIMEText(plain, 'plain'))
        msg.attach(MIMEText(html,  'html'))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            s.ehlo()
            s.starttls()
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as exc:
        print(f'[email] SMTP failed: {exc}')
        return False


def is_admin(request: BaseHTTPRequestHandler, body_token: str = '') -> bool:
    if not ADMIN_TOKEN:
        return False
    supplied = request.headers.get('X-Admin-Token', '')
    if not supplied:
        auth = request.headers.get('Authorization', '')
        supplied = auth[7:] if auth.startswith('Bearer ') else ''
    if not supplied and body_token:
        supplied = body_token
    supplied = _normalize_token(supplied)
    return hmac.compare_digest(supplied, ADMIN_TOKEN)

# ── MIME types ─────────────────────────────────────────────────────
MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.gif':  'image/gif',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
}

# ── Server (suppress harmless Railway health-probe noise) ────────────
class _Server(ThreadingHTTPServer):
    import sys as _sys
    def handle_error(self, request, client_address):
        import sys
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionResetError, BrokenPipeError, ConnectionAbortedError)):
            return  # Railway TCP health probes — harmless, not worth logging
        super().handle_error(request, client_address)

# ── Request handler ────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'  # persistent connections — one TCP handshake for all assets

    def log_message(self, fmt, *args):
        pass  # suppress per-request logs (startup message still shown)

    # helpers ──────────────────────────────────────────────────────
    def send_json(self, code: int, data):
        body = json.dumps(data).encode()
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # Client closed the connection before we could write the response.
            return

    def read_json(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length > 65_536:
                return None
            return json.loads(self.rfile.read(length))
        except Exception:
            return None

    def get_token(self) -> str:
        auth = self.headers.get('Authorization', '')
        return auth[7:] if auth.startswith('Bearer ') else ''

    def serve_static(self, url_path: str, head_only: bool = False):
        # Prevent path traversal
        try:
            target = (STATIC / url_path.lstrip('/')).resolve()
            if not str(target).startswith(str(STATIC.resolve())):
                self.send_response(403); self.end_headers(); return
        except Exception:
            self.send_response(400); self.end_headers(); return

        if target.is_dir():
            target = target / 'index.html'
        if not target.exists():
            self.send_response(404); self.end_headers(); return

        stat = target.stat()
        etag = f'"{stat.st_mtime_ns}-{stat.st_size}"'

        # Conditional GET — 304 if browser already has the current version
        if self.headers.get('If-None-Match', '') == etag:
            self.send_response(304)
            self.send_header('ETag', etag)
            self.end_headers()
            return

        data = target.read_bytes()
        mime = MIME.get(target.suffix.lower(), 'application/octet-stream')
        # HTML + JS: always revalidate (ETag handles 304s efficiently). Other assets: cache 24 h.
        no_cache_exts = {'.html', '.js'}
        cache_control = 'no-cache' if target.suffix.lower() in no_cache_exts else 'public, max-age=86400'
        try:
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', cache_control)
            self.send_header('ETag', etag)
            self.end_headers()
            if not head_only:
                self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            # Connection may be closed by reverse proxy/client; ignore safely.
            return

    # GET ──────────────────────────────────────────────────────────
    def do_GET(self):
        try:
            path = urlparse(self.path).path

            if path == '/api/me':
                player = auth_player(self.get_token())
                if not player:
                    return self.send_json(401, {'error': 'Not authenticated.'})
                self.send_json(200, {'player': _player_public(player)})

            elif path == '/healthz':
                self.send_json(200, {'ok': True})

            elif path == '/api/stats':
                conn  = db()
                now_ms = int(time.time() * 1000)
                ms_5min = now_ms - 5  * 60 * 1000
                ms_1h   = now_ms - 60 * 60 * 1000
                ms_24h  = now_ms - 24 * 60 * 60 * 1000

                total    = conn.execute('SELECT COUNT(*) FROM players').fetchone()[0]  # type: ignore[index]
                active5  = conn.execute('SELECT COUNT(*) FROM players WHERE last_save_ms >= ?', (ms_5min,)).fetchone()[0]  # type: ignore[index]
                active1h = conn.execute('SELECT COUNT(*) FROM players WHERE last_save_ms >= ?', (ms_1h,)).fetchone()[0]  # type: ignore[index]
                active24 = conn.execute('SELECT COUNT(*) FROM players WHERE last_save_ms >= ?', (ms_24h,)).fetchone()[0]  # type: ignore[index]

                rows = conn.execute(
                    'SELECT username,score,level,total_clicks FROM players '
                    'ORDER BY score DESC, level DESC, username ASC'
                ).fetchall()

                players = [
                    {
                        'rank':        i + 1,
                        'username':    r['username'],
                        'score':       int(r['score'] or 0),
                        'level':       int(r['level'] or 1),
                        'totalClicks': int(r['total_clicks'] or 0),
                    }
                    for i, r in enumerate(rows)
                ]

                self.send_json(200, {
                    'totalPlayers':   total,
                    'activeLast5Min': active5,
                    'activeLast1h':   active1h,
                    'activeLast24h':  active24,
                    'players':        players,
                })

            elif path == '/api/scoreboard':
                conn  = db()
                top10 = [dict(r) for r in conn.execute(
                    'SELECT username,score,level FROM players ORDER BY score DESC,level DESC LIMIT 10'
                ).fetchall()]
                my_entry = None
                player   = auth_player(self.get_token())
                if player:
                    in_top = any(p['username'] == player['username'] for p in top10)
                    if not in_top:
                        row = conn.execute(
                            'SELECT COUNT(*)+1 AS rnk FROM players '
                            'WHERE score>? OR (score=? AND level>?)',
                            (player['score'], player['score'], player['level'])
                        ).fetchone()
                        assert row is not None
                        my_entry = {
                            'rank':     row['rnk'],
                            'username': player['username'],
                            'score':    player['score'],
                            'level':    player['level'],
                        }
                self.send_json(200, {'players': top10, 'me': my_entry})

            elif path == '/api/chat/stream':
                q: _queue_mod.Queue = _queue_mod.Queue()
                with _chat_lock:
                    _chat_subscribers.append(q)
                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-cache')
                    self.send_header('X-Accel-Buffering', 'no')
                    self.end_headers()
                    # Send history first
                    with _chat_lock:
                        history = list(_chat_messages)
                    for msg in history:
                        self.wfile.write(f'data: {json.dumps(msg)}\n\n'.encode())
                    self.wfile.flush()
                    while True:
                        try:
                            msg = q.get(timeout=25)
                            if msg is None:
                                break
                            self.wfile.write(f'data: {json.dumps(msg)}\n\n'.encode())
                            self.wfile.flush()
                        except _queue_mod.Empty:
                            self.wfile.write(b': ping\n\n')
                            self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass
                finally:
                    with _chat_lock:
                        try:
                            _chat_subscribers.remove(q)
                        except ValueError:
                            pass
                return

            else:
                self.serve_static(path)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            print(f'[error] GET {self.path}: {exc}')
            self.send_json(500, {'error': 'Internal server error.'})

    def do_HEAD(self):
        try:
            path = urlparse(self.path).path
            if path == '/healthz' or path.startswith('/api/'):
                self.send_response(200)
                self.end_headers()
                return
            self.serve_static(path, head_only=True)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            print(f'[error] HEAD {self.path}: {exc}')
            self.send_response(500)
            self.end_headers()

    # POST ─────────────────────────────────────────────────────────
    def do_POST(self):
        try:
            path = urlparse(self.path).path
            body = self.read_json() or {}

            if path == '/api/register':
                username  = (body.get('username') or '').strip()
                password  =  body.get('password') or ''
                email_raw = (body.get('email') or '').strip().lower()
                email     = email_raw if email_raw else None
                if not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', username):
                    return self.send_json(400, {'error': 'Username: 3–20 chars, letters/numbers/underscore.'})
                if not (4 <= len(password) <= 100):
                    return self.send_json(400, {'error': 'Password must be 4–100 characters.'})
                if email and not EMAIL_RE.fullmatch(email):
                    return self.send_json(400, {'error': 'Invalid email address.'})
                salt  = secrets.token_hex(16)
                hsh   = hash_pwd(password, salt)
                with _write_lock:
                    conn = db()
                    try:
                        conn.execute(
                            'INSERT INTO players (username,password_hash,salt,email) VALUES (?,?,?,?)',
                            (username, hsh, salt, email)
                        )
                        conn.commit()
                    except Exception as e:
                        if not (isinstance(e, sqlite3.IntegrityError) or 'UNIQUE constraint failed' in str(e)):
                            raise
                        if email and 'players.email' in str(e):
                            return self.send_json(409, {'error': 'Email address already registered to another account.'})
                        return self.send_json(409, {'error': 'Username already taken.'})
                    player = conn.execute(
                        f'SELECT {_PLAYER_ALL_COLS} FROM players WHERE username=?', (username,)
                    ).fetchone()
                    assert player is not None
                    token = secrets.token_hex(32)
                    conn.execute('INSERT INTO sessions (token,player_id) VALUES (?,?)', (token, player['id']))
                    conn.commit()
                _cache_session(token, player['id'])
                _cache_player_data(player)
                self.send_json(200, {'token': token, 'player': _player_public(player)})

            elif path == '/api/admin/delete-users':
                body_token = _normalize_token(str(body.get('adminToken', '')))
                if not is_admin(self, body_token=body_token):
                    return self.send_json(401, {'error': 'Unauthorized.'})

                usernames = body.get('usernames')
                if not isinstance(usernames, list) or not usernames:
                    return self.send_json(400, {'error': 'usernames must be a non-empty array.'})

                cleaned = sorted({str(u).strip() for u in usernames if str(u).strip()})
                if not cleaned:
                    return self.send_json(400, {'error': 'No valid usernames provided.'})

                placeholders = ','.join('?' for _ in cleaned)

                with _write_lock:
                    conn = db()
                    rows = conn.execute(
                        f'SELECT id,username FROM players WHERE username IN ({placeholders}) ORDER BY username',
                        tuple(cleaned),
                    ).fetchall()

                    if not rows:
                        return self.send_json(200, {'deleted': [], 'missing': cleaned, 'sessionsDeleted': 0, 'playersDeleted': 0})

                    ids = [r['id'] for r in rows]
                    found = [r['username'] for r in rows]
                    missing = [u for u in cleaned if u not in found]

                    id_placeholders = ','.join('?' for _ in ids)
                    conn.execute(
                        f'DELETE FROM sessions WHERE player_id IN ({id_placeholders})',
                        tuple(ids),
                    )
                    conn.execute(
                        f'DELETE FROM password_reset_tokens WHERE player_id IN ({id_placeholders})',
                        tuple(ids),
                    )
                    player_result = conn.execute(
                        f'DELETE FROM players WHERE id IN ({id_placeholders})',
                        tuple(ids),
                    )
                    conn.commit()

                for pid in ids:
                    _evict_player(pid)

                self.send_json(200, {
                    'deleted': found,
                    'missing': missing,
                    'playersDeleted': player_result.rowcount,
                })

            elif path == '/api/admin/list-suggestions':
                body_token = _normalize_token(str(body.get('adminToken', '')))
                if not is_admin(self, body_token=body_token):
                    return self.send_json(401, {'error': 'Unauthorized.'})
                rows = db().execute(
                    'SELECT id,message,contact,created_at_ms FROM suggestions ORDER BY created_at_ms DESC'
                ).fetchall()
                self.send_json(200, {
                    'count': len(rows),
                    'suggestions': [dict(r) for r in rows]
                })

            elif path == '/api/admin/list-users':
                body_token = _normalize_token(str(body.get('adminToken', '')))
                if not is_admin(self, body_token=body_token):
                    return self.send_json(401, {'error': 'Unauthorized.'})

                conn = db()
                rows = conn.execute(
                    'SELECT username,score,level,cheat_flags FROM players '
                    'ORDER BY score DESC, level DESC, username ASC'
                ).fetchall()

                players = [
                    {
                        'username': r['username'],
                        'score': int(r['score'] or 0),
                        'level': int(r['level'] or 1),
                        'cheatFlags': int(r['cheat_flags'] or 0),
                    }
                    for r in rows
                ]

                self.send_json(200, {'count': len(players), 'players': players})

            elif path == '/api/admin/get-player-state':
                body_token = _normalize_token(str(body.get('adminToken', '')))
                if not is_admin(self, body_token=body_token):
                    return self.send_json(401, {'error': 'Unauthorized.'})

                username = (body.get('username') or '').strip()
                if not username:
                    return self.send_json(400, {'error': 'username is required.'})

                row = db().execute(
                    'SELECT username,score,level,cheat_flags,last_save_ms,state '
                    'FROM players WHERE username=?',
                    (username,)
                ).fetchone()
                if not row:
                    return self.send_json(404, {'error': 'Player not found.'})

                raw_state = row['state']
                try:
                    parsed_state = json.loads(raw_state) if raw_state else None
                except Exception:
                    parsed_state = raw_state  # return as-is if corrupt

                self.send_json(200, {
                    'username':   row['username'],
                    'score':      int(row['score'] or 0),
                    'level':      int(row['level'] or 1),
                    'cheatFlags': int(row['cheat_flags'] or 0),
                    'lastSaveMs': int(row['last_save_ms'] or 0),
                    'state':      parsed_state,
                })

            elif path == '/api/login':
                username = (body.get('username') or '').strip()
                password =  body.get('password') or ''
                row = db().execute('SELECT * FROM players WHERE username=?', (username,)).fetchone()
                if not row or not hmac.compare_digest(
                    hash_pwd(password, row['salt']), row['password_hash']
                ):
                    return self.send_json(401, {'error': 'Invalid username or password.'})
                token = secrets.token_hex(32)
                with _write_lock:
                    conn = db()
                    conn.execute('INSERT INTO sessions (token,player_id) VALUES (?,?)', (token, row['id']))
                    # Upgrade stored state on login so the client receives the latest shape.
                    raw = row['state']
                    try:
                        stored_state = json.loads(raw) if raw else {}
                    except Exception:
                        stored_state = {}
                    upgraded = _upgrade_state(stored_state)
                    if upgraded.get('stateVersion', 0) != (stored_state.get('stateVersion') or 0):
                        conn.execute(
                            'UPDATE players SET state=? WHERE id=?',
                            (json.dumps(upgraded), row['id'])
                        )
                    conn.commit()
                _cache_session(token, row['id'])
                player = db().execute(
                    f'SELECT {_PLAYER_ALL_COLS} FROM players WHERE id=?', (row['id'],)
                ).fetchone()
                assert player is not None
                _cache_player_data(player)
                self.send_json(200, {'token': token, 'player': _player_public(player)})

            elif path == '/api/logout':
                token = self.get_token()
                if token:
                    _invalidate_session(token)
                    with _write_lock:
                        conn = db()
                        conn.execute('DELETE FROM sessions WHERE token=?', (token,))
                        conn.commit()
                self.send_json(200, {'ok': True})

            elif path == '/api/save':
                player = auth_player(self.get_token())
                if not player:
                    return self.send_json(401, {'error': 'Not authenticated.'})
                state = body.get('state')
                if not isinstance(state, dict):
                    return self.send_json(400, {'error': 'Invalid state.'})
                state = _upgrade_state(state)

                reported_score = max(0, int(state.get('score') or 0))
                reported_level = max(1, int(state.get('level') or 1))
                now_ms = int(time.time() * 1000)

                # Anti-cheat: use player cache — no extra DB query needed.
                prev_score   = int(player['score']        or 0)
                prev_level   = int(player['level']        or 1)
                last_save_ms = int(player['last_save_ms'] or 0)
                cheat_flags  = int(player['cheat_flags']  or 0)

                elapsed_sec = max(0.0, (now_ms - last_save_ms) / 1000.0)

                allowed_score_increase = max(
                    ANTI_CHEAT_MIN_SCORE_BURST,
                    int(elapsed_sec * ANTI_CHEAT_MAX_SCORE_PER_SEC),
                )
                allowed_level_increase = max(
                    ANTI_CHEAT_MIN_LEVEL_BURST,
                    int(elapsed_sec * (ANTI_CHEAT_MAX_LEVELS_PER_MIN / 60.0)),
                )

                max_allowed_score = prev_score + allowed_score_increase
                max_allowed_level = prev_level + allowed_level_increase

                score = min(max(reported_score, prev_score), max_allowed_score)
                level = min(max(reported_level, prev_level), max_allowed_level)
                suspicious = (reported_score > max_allowed_score) or (reported_level > max_allowed_level)
                if suspicious:
                    cheat_flags += 1
                    print(
                        f"[anti-cheat] user={player['username']} flagged=#{cheat_flags} "
                        f"reported(score={reported_score},level={reported_level}) "
                        f"allowed(score<={max_allowed_score},level<={max_allowed_level})"
                    )

                state['score'] = score
                state['level'] = level
                new_total_clicks = max(0, int(state.get('totalClicks') or 0))
                state_json = json.dumps(state)

                # Update player cache immediately so next request sees fresh anti-cheat state.
                cached_entry = _player_data_cache.get(player['id'])
                if cached_entry:
                    cd, cexp = cached_entry
                    cd.update(score=score, level=level, last_save_ms=now_ms,
                              cheat_flags=cheat_flags, total_clicks=new_total_clicks,
                              state=state_json)

                # Write to Turso asynchronously — HTTP response returns immediately.
                pid   = player['id']
                uname = player['username']
                def _do_save(_sj=state_json, _sc=score, _lv=level, _ts=now_ms,
                             _cf=cheat_flags, _tc=new_total_clicks, _pid=pid, _un=uname):
                    try:
                        with _write_lock:
                            c = db()
                            c.execute(
                                'UPDATE players SET state=?,score=?,level=?,last_save_ms=?,cheat_flags=?,total_clicks=? WHERE id=?',
                                (_sj, _sc, _lv, _ts, _cf, _tc, _pid)
                            )
                            c.commit()
                    except Exception as exc:
                        print(f'[save-async] player={_un} error: {exc}')
                threading.Thread(target=_do_save, daemon=True).start()

                self.send_json(200, {'ok': True, 'score': score, 'level': level, 'flagged': suspicious})

            elif path == '/api/forgot-password':
                email = (body.get('email') or '').strip().lower()
                # Always return 200 to prevent email enumeration.
                if email and EMAIL_RE.fullmatch(email):
                    row = db().execute(
                        'SELECT id FROM players WHERE email=?', (email,)
                    ).fetchone()
                    print(f'[forgot-password] email={email!r} found={row is not None}')
                    if row:
                        token = secrets.token_hex(32)
                        now_ms = int(time.time() * 1000)
                        with _write_lock:
                            conn = db()
                            conn.execute(
                                'INSERT INTO password_reset_tokens (token,player_id,created_at_ms) VALUES (?,?,?)',
                                (token, row['id'], now_ms)
                            )
                            conn.commit()
                        host   = self.headers.get('Host', 'localhost')
                        scheme = 'https' if (GAME_URL or 'railway' in host) else 'http'
                        base   = GAME_URL or f'{scheme}://{host}'
                        reset_url = f'{base}/reset-password.html?token={token}'
                        _send_reset_email(email, reset_url)
                self.send_json(200, {'ok': True})

            elif path == '/api/suggest':
                message = (body.get('message') or '').strip()
                contact = (body.get('contact') or '').strip()[:100]
                if not message:
                    return self.send_json(400, {'error': 'Message is required.'})
                if len(message) > 2000:
                    return self.send_json(400, {'error': 'Message too long (max 2000 chars).'})
                now_ms = int(time.time() * 1000)
                with _write_lock:
                    conn = db()
                    conn.execute(
                        'INSERT INTO suggestions (message,contact,created_at_ms) VALUES (?,?,?)',
                        (message, contact or None, now_ms)
                    )
                    conn.commit()
                print(f'[suggest] contact={contact!r} msg={message[:80]!r}')
                threading.Thread(target=_send_suggest_notification, args=(message, contact), daemon=True).start()
                self.send_json(200, {'ok': True})

            elif path == '/api/reset-password':
                token    = (body.get('token') or '').strip()
                password =  body.get('password') or ''
                if not token:
                    return self.send_json(400, {'error': 'Token is required.'})
                if not (4 <= len(password) <= 100):
                    return self.send_json(400, {'error': 'Password must be 4\u2013100 characters.'})
                now_ms    = int(time.time() * 1000)
                expire_ms = now_ms - RESET_TOKEN_EXPIRY_MS
                row = db().execute(
                    'SELECT player_id, used, created_at_ms FROM password_reset_tokens WHERE token=?',
                    (token,)
                ).fetchone()
                if not row or row['used'] or row['created_at_ms'] < expire_ms:
                    return self.send_json(400, {'error': 'This link is invalid or has expired.'})
                salt = secrets.token_hex(16)
                hsh  = hash_pwd(password, salt)
                with _write_lock:
                    conn = db()
                    conn.execute(
                        'UPDATE players SET password_hash=?,salt=? WHERE id=?',
                        (hsh, salt, row['player_id'])
                    )
                    conn.execute(
                        'UPDATE password_reset_tokens SET used=1 WHERE token=?',
                        (token,)
                    )
                    # Invalidate all existing sessions for security.
                    conn.execute('DELETE FROM sessions WHERE player_id=?', (row['player_id'],))
                    conn.commit()
                _evict_player(row['player_id'])
                self.send_json(200, {'ok': True})

            elif path == '/api/chat/send':
                player = auth_player(self.get_token())
                if not player:
                    return self.send_json(401, {'error': 'Login to chat.'})
                text = (body.get('text') or '').strip()
                if not text:
                    return self.send_json(400, {'error': 'Empty message.'})
                if len(text) > 200:
                    return self.send_json(400, {'error': 'Message too long (max 200 chars).'})
                now_ms = int(time.time() * 1000)
                with _chat_lock:
                    # Rate-limit: 1 message per 2 seconds per user
                    last_ms = _chat_rate.get(player['username'], 0)
                    if now_ms - last_ms < 2000:
                        return self.send_json(429, {'error': 'Slow down! One message per 2 seconds.'})
                    _chat_rate[player['username']] = now_ms
                    msg = {'ts': now_ms, 'username': player['username'], 'text': text}
                    _chat_messages.append(msg)
                    for sub_q in list(_chat_subscribers):
                        try:
                            sub_q.put_nowait(msg)
                        except Exception:
                            pass
                self.send_json(200, {'ok': True})

            else:
                self.send_json(404, {'error': 'Not found.'})
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            print(f'[error] POST {self.path}: {exc}')
            self.send_json(500, {'error': 'Internal server error.'})


# ── Main ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    server = _Server(('', PORT), Handler)
    print(f'Rotworm Killer  →  http://localhost:{PORT}')
    print('Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
