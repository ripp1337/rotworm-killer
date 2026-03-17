"""Database connection, schema, and write-lock."""
import os
import sqlite3
import tempfile
import threading
import time
from pathlib import Path

from app.config import USE_TURSO, TURSO_URL, TURSO_AUTH_TOKEN

_write_lock = threading.Lock()

# ── Turso wrappers ─────────────────────────────────────────────────

class _DictRow:
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

    def get(self, key, default=None):
        try:
            return self[key]
        except (KeyError, ValueError):
            return default

    def __iter__(self):
        return iter(self._values)


class _TursoCursor:
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


_turso_conn           = None
_turso_reconnect_lock = threading.Lock()


def _turso_reconnect():
    global _turso_conn
    import libsql_experimental as libsql  # type: ignore[import-untyped]
    with _turso_reconnect_lock:
        print('[turso] reconnecting...')
        try:
            if _turso_conn is not None:
                _turso_conn._raw.close()
        except Exception:
            pass
        raw = libsql.connect(str(_DB_PATH), sync_url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)
        raw.sync()
        _turso_conn = _TursoConn(raw)
        print('[turso] reconnected.')
        return _turso_conn


class _TursoConn:
    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        try:
            return _TursoCursor(self._raw.execute(sql, params))
        except BaseException as e:
            if isinstance(e, (KeyboardInterrupt, SystemExit, GeneratorExit)):
                raise
            s = str(e)
            t = type(e).__name__
            if 'stream not found' in s or t == 'PanicException' or 'unwrap' in s.lower():
                fresh = _turso_reconnect()
                return _TursoCursor(fresh._raw.execute(sql, params))
            raise

    def commit(self):
        try:
            self._raw.commit()
        except BaseException as e:
            if isinstance(e, (KeyboardInterrupt, SystemExit, GeneratorExit)):
                raise
            s = str(e)
            t = type(e).__name__
            if 'stream not found' in s or t == 'PanicException' or 'unwrap' in s.lower():
                _turso_reconnect()
                raise RuntimeError('Turso stream expired during commit; caller must retry.') from e
            raise

    def sync(self):
        self._raw.sync()

    def close(self):
        self._raw.close()


# ── Path resolution ────────────────────────────────────────────────

def _is_writable_dir(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        test = path / '.rw-test'
        test.write_text('ok', encoding='utf-8')
        test.unlink(missing_ok=True)
        return True
    except Exception:
        return False


def _resolve_db_path() -> Path:
    static = Path(__file__).parent.parent
    candidates = []
    data_dir_env = os.environ.get('DATA_DIR')
    if data_dir_env:
        candidates.append(Path(data_dir_env))
    candidates.append(static)
    candidates.append(Path(tempfile.gettempdir()) / 'rotworm-killer')
    for c in candidates:
        if _is_writable_dir(c):
            return c / 'game.db'
    raise RuntimeError('No writable directory found for SQLite database.')


_DB_PATH: Path = _resolve_db_path()
print(f'[startup] DB_PATH={_DB_PATH}')

# ── Connection helper ──────────────────────────────────────────────

_tls = threading.local()


def get_conn():
    """Return the active database connection (Turso or thread-local SQLite)."""
    if USE_TURSO:
        if _turso_conn is None:
            raise RuntimeError('Turso connection not initialised; call init_db() first.')
        return _turso_conn
    if not getattr(_tls, 'conn', None):
        conn = sqlite3.connect(str(_DB_PATH))
        conn.row_factory = sqlite3.Row
        _tls.conn = conn
    return _tls.conn


# ── Schema ─────────────────────────────────────────────────────────

def init_db():
    global _turso_conn
    if USE_TURSO:
        import libsql_experimental as libsql  # type: ignore[import-untyped]
        raw = libsql.connect(str(_DB_PATH), sync_url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)
        raw.sync()
        _turso_conn = _TursoConn(raw)
        conn = _turso_conn
    else:
        conn = sqlite3.connect(str(_DB_PATH))
        conn.row_factory = sqlite3.Row

    conn.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            username                TEXT    UNIQUE NOT NULL,
            password_hash           TEXT    NOT NULL,
            salt                    TEXT    NOT NULL,
            email                   TEXT    UNIQUE DEFAULT NULL,
            score                   INTEGER DEFAULT 0,
            level                   INTEGER DEFAULT 1,
            exp                     INTEGER DEFAULT 0,
            gold                    INTEGER DEFAULT 0,
            weapon_index            INTEGER DEFAULT 0,
            skill_pts               TEXT    DEFAULT '{}',
            knight_pts              TEXT    DEFAULT '{}',
            sorc_pts                TEXT    DEFAULT '{}',
            ascended                INTEGER DEFAULT 0,
            ascended_class          TEXT    DEFAULT NULL,
            respec_count            INTEGER DEFAULT 0,
            current_area            TEXT    DEFAULT 'Rookgaard',
            unlocked_areas          TEXT    DEFAULT '["Rookgaard"]',
            inventory               TEXT    DEFAULT '{}',
            potion_timers           TEXT    DEFAULT '{}',
            hmm_cd_end              INTEGER DEFAULT 0,
            arcane_weakness_stacks  INTEGER DEFAULT 0,
            sudden_death_cd_end     INTEGER DEFAULT 0,
            essence_gathering_end   INTEGER DEFAULT 0,
            boss_spawn_counter      INTEGER DEFAULT 0,
            boss_kill_counter       INTEGER DEFAULT 0,
            total_clicks            INTEGER DEFAULT 0,
            last_save_ms            INTEGER DEFAULT 0
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

    if not USE_TURSO:
        conn.close()


# ── EXP / level helpers ────────────────────────────────────────────

def exp_for_level(x: int) -> int:
    return (50 * (x**3 - 6*x**2 + 17*x - 12)) // 3


def level_from_exp(exp: int) -> int:
    lv = 1
    while lv < 10_000 and exp >= exp_for_level(lv + 1):
        lv += 1
    return lv
