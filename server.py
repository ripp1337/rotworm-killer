#!/usr/bin/env python3
"""Rotworm Killer – backend server (Python 3 stdlib only, no pip needed)"""

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import os
import tempfile
PORT    = int(os.environ.get('PORT', 3000))
STATIC  = Path(__file__).parent
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', '')

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
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS players (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            salt          TEXT    NOT NULL,
            score         INTEGER DEFAULT 0,
            level         INTEGER DEFAULT 1,
            state         TEXT    DEFAULT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT    PRIMARY KEY,
            player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
        );
    """)
    conn.close()

init_db()

# Thread-local SQLite connections (WAL mode for concurrency)
_tls        = threading.local()
_write_lock = threading.Lock()

def db():
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
    row = db().execute('SELECT player_id FROM sessions WHERE token=?', (token,)).fetchone()
    if not row:
        return None
    return db().execute(
        'SELECT id,username,score,level,state FROM players WHERE id=?',
        (row['player_id'],)
    ).fetchone()

def is_admin(request: BaseHTTPRequestHandler) -> bool:
    if not ADMIN_TOKEN:
        return False
    supplied = request.headers.get('X-Admin-Token', '')
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

# ── Request handler ────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):

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

        data = target.read_bytes()
        mime = MIME.get(target.suffix.lower(), 'application/octet-stream')
        try:
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
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
                self.send_json(200, {'player': dict(player)})

            elif path == '/healthz':
                self.send_json(200, {'ok': True})

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
                        my_entry = {
                            'rank':     row['rnk'],
                            'username': player['username'],
                            'score':    player['score'],
                            'level':    player['level'],
                        }
                self.send_json(200, {'players': top10, 'me': my_entry})

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
                username = (body.get('username') or '').strip()
                password =  body.get('password') or ''
                if not re.fullmatch(r'[a-zA-Z0-9_]{3,20}', username):
                    return self.send_json(400, {'error': 'Username: 3–20 chars, letters/numbers/underscore.'})
                if not (4 <= len(password) <= 100):
                    return self.send_json(400, {'error': 'Password must be 4–100 characters.'})
                salt  = secrets.token_hex(16)
                hsh   = hash_pwd(password, salt)
                with _write_lock:
                    conn = db()
                    try:
                        conn.execute(
                            'INSERT INTO players (username,password_hash,salt) VALUES (?,?,?)',
                            (username, hsh, salt)
                        )
                        conn.commit()
                    except sqlite3.IntegrityError:
                        return self.send_json(409, {'error': 'Username already taken.'})
                    player = conn.execute(
                        'SELECT id,username,score,level,state FROM players WHERE username=?', (username,)
                    ).fetchone()
                    token = secrets.token_hex(32)
                    conn.execute('INSERT INTO sessions (token,player_id) VALUES (?,?)', (token, player['id']))
                    conn.commit()
                self.send_json(200, {'token': token, 'player': dict(player)})

            elif path == '/api/admin/delete-users':
                if not is_admin(self):
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
                        cleaned,
                    ).fetchall()

                    if not rows:
                        return self.send_json(200, {'deleted': [], 'missing': cleaned, 'sessionsDeleted': 0, 'playersDeleted': 0})

                    ids = [r['id'] for r in rows]
                    found = [r['username'] for r in rows]
                    missing = [u for u in cleaned if u not in found]

                    id_placeholders = ','.join('?' for _ in ids)
                    sess_result = conn.execute(
                        f'DELETE FROM sessions WHERE player_id IN ({id_placeholders})',
                        ids,
                    )
                    player_result = conn.execute(
                        f'DELETE FROM players WHERE id IN ({id_placeholders})',
                        ids,
                    )
                    conn.commit()

                self.send_json(200, {
                    'deleted': found,
                    'missing': missing,
                    'sessionsDeleted': sess_result.rowcount,
                    'playersDeleted': player_result.rowcount,
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
                    conn.commit()
                player = db().execute(
                    'SELECT id,username,score,level,state FROM players WHERE id=?', (row['id'],)
                ).fetchone()
                self.send_json(200, {'token': token, 'player': dict(player)})

            elif path == '/api/logout':
                token = self.get_token()
                if token:
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
                score = max(0, int(state.get('score') or 0))
                level = max(1, int(state.get('level') or 1))
                with _write_lock:
                    conn = db()
                    conn.execute(
                        'UPDATE players SET state=?,score=?,level=? WHERE id=?',
                        (json.dumps(state), score, level, player['id'])
                    )
                    conn.commit()
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
    server = ThreadingHTTPServer(('', PORT), Handler)
    print(f'Rotworm Killer  →  http://localhost:{PORT}')
    print('Press Ctrl+C to stop.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
