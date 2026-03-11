'use strict';

const express  = require('express');
const crypto   = require('crypto');
const Database = require('better-sqlite3');
const path     = require('path');

const app  = express();
const db   = new Database(path.join(__dirname, 'game.db'));
const PORT = process.env.PORT || 3000;

// ── Schema ────────────────────────────────────────────────────────
db.exec(`
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
`);

// ── Prepared statements ───────────────────────────────────────────
const stmts = {
  insertPlayer:  db.prepare('INSERT INTO players (username, password_hash, salt) VALUES (?, ?, ?)'),
  playerByName:  db.prepare('SELECT * FROM players WHERE username = ?'),
  playerById:    db.prepare('SELECT id, username, score, level, state FROM players WHERE id = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, player_id) VALUES (?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  getSession:    db.prepare('SELECT player_id FROM sessions WHERE token = ?'),
  updateState:   db.prepare('UPDATE players SET state = ?, score = ?, level = ? WHERE id = ?'),
  top10:         db.prepare('SELECT username, score, level FROM players ORDER BY score DESC, level DESC LIMIT 10'),
};

// ── Helpers ───────────────────────────────────────────────────────
function hashPwd(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function authPlayer(req) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const row = stmts.getSession.get(token);
  return row ? stmts.playerById.get(row.player_id) : null;
}

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname)));

// ── POST /api/register ────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Username and password required.' });

  const u = username.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(u))
    return res.status(400).json({ error: 'Username: 3–20 chars, letters/numbers/underscore.' });
  if (password.length < 4 || password.length > 100)
    return res.status(400).json({ error: 'Password must be 4–100 characters.' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPwd(password, salt);

  try {
    const { lastInsertRowid } = stmts.insertPlayer.run(u, hash, salt);
    const token  = newToken();
    stmts.insertSession.run(token, lastInsertRowid);
    const player = stmts.playerById.get(lastInsertRowid);
    res.json({ token, player });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE')
      return res.status(409).json({ error: 'Username already taken.' });
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/login ───────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Username and password required.' });

  const row = stmts.playerByName.get(username.trim());
  if (!row || hashPwd(password, row.salt) !== row.password_hash)
    return res.status(401).json({ error: 'Invalid username or password.' });

  const token  = newToken();
  stmts.insertSession.run(token, row.id);
  const player = stmts.playerById.get(row.id);
  res.json({ token, player });
});

// ── POST /api/logout ──────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) stmts.deleteSession.run(token);
  res.json({ ok: true });
});

// ── GET /api/me ───────────────────────────────────────────────────
app.get('/api/me', (req, res) => {
  const player = authPlayer(req);
  if (!player) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ player });
});

// ── POST /api/save ────────────────────────────────────────────────
app.post('/api/save', (req, res) => {
  const player = authPlayer(req);
  if (!player) return res.status(401).json({ error: 'Not authenticated.' });

  const { state } = req.body ?? {};
  if (!state || typeof state !== 'object' || Array.isArray(state))
    return res.status(400).json({ error: 'Invalid state.' });

  const score = Math.max(0, parseInt(state.score)  || 0);
  const level = Math.max(1, parseInt(state.level)  || 1);
  stmts.updateState.run(JSON.stringify(state), score, level, player.id);
  res.json({ ok: true });
});

// ── GET /api/scoreboard ───────────────────────────────────────────
app.get('/api/scoreboard', (req, res) => {
  const top10 = stmts.top10.all();

  // If authenticated and outside top 10, include their rank at the bottom
  let myEntry = null;
  const player = authPlayer(req);
  if (player) {
    const inTop = top10.some(p => p.username === player.username);
    if (!inTop) {
      const { rnk } = db.prepare(
        'SELECT COUNT(*) + 1 AS rnk FROM players WHERE score > ? OR (score = ? AND level > ?)'
      ).get(player.score, player.score, player.level);
      myEntry = { rank: rnk, username: player.username, score: player.score, level: player.level };
    }
  }

  res.json({ players: top10, me: myEntry });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () =>
  console.log(`Rotworm Killer  →  http://localhost:${PORT}`)
);
