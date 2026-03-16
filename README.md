# Rotworm Killer

A browser-based idle/active RPG inspired by Tibia. Kill monsters, level up, unlock skill trees, craft gear, and push through 11 increasingly dangerous locations — from Rookgaard rats to something far worse.

Play at: **[rotwormkiller.xyz](https://rotwormkiller.xyz/)**  
Community: **[discord.gg/d8rE8qSk](https://discord.gg/d8rE8qSk)**

---

## Gameplay

- Click monsters to deal damage; auto-attack handles the rest when turned on.
- Kill monsters to earn **gold** and **experience**. Level up to unlock new areas and skill points.
- Spend skill points in the **General**, **Knight**, or **Sorcerer** tree.
  - **Knight** — active playstyle; benefits heavily from clicking (Combo Meter, Cleaving Blows, Adrenaline Reset).
  - **Sorcerer** — idle/AFK playstyle; Heavy Magic Missile, Sudden Death, and Essence Gathering deliver strong output passively.
- Bosses spawn every 10 kills and scale with your area. Uber Bosses appear every 10 normal boss kills.
- Ascend at level 100 to reset progress for a permanent multiplier.
- Craft gear using essences dropped by monsters to boost stats.

---

## Tech Stack

| Layer | Details |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript (`js/main.js`) |
| Backend | Python 3 stdlib only — `http.server.ThreadingHTTPServer` (`server.py`) |
| Database | [Turso](https://turso.tech) — remote libSQL (SQLite), survives Railway redeploys |
| Hosting | [Railway](https://railway.app) — auto-deploys on push to `master` |

No build step, no bundler. Edit files and refresh.

---

## Development Setup

1. Clone the repo.
2. Set environment variables (see below).
3. `python server.py` — starts the server on `http://localhost:3000`.
4. Open `http://localhost:3000` in a browser.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TURSO_URL` | Yes (prod) | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Yes (prod) | Turso auth token |
| `ADMIN_TOKEN` | Yes | Secret token for admin endpoints |
| `PORT` | No | HTTP port (default: `3000`) |
| `DATA_DIR` | No | Path for local SQLite fallback (dev without Turso) |
| `SMTP_*` | No | Email config for password reset |

Without `TURSO_URL`/`TURSO_AUTH_TOKEN` the server falls back to a local SQLite file in `DATA_DIR`.

---

## Deployment Workflow

1. Develop and commit on `dev`.
2. Push to `origin dev` — Railway dev environment auto-deploys.
3. Smoke test on dev.
4. Merge `dev` → `master` and push — Railway production auto-deploys (~2 min).

Never commit directly to `master`.

---

## Admin Endpoints

All require `adminToken` in the POST body.

| Endpoint | Description |
|---|---|
| `POST /api/admin/list-users` | List all players with score/level/cheat flags |
| `POST /api/admin/delete-users` | Delete specific accounts by username |
| `POST /api/admin/get-player-state` | Inspect a player's full saved state |
| `POST /api/admin/reset-db` | **Wipe all players, sessions and tokens** |
| `POST /api/admin/list-suggestions` | View player feedback submissions |

### Reset DB example

```powershell
Invoke-WebRequest -Uri "https://your-app.railway.app/api/admin/reset-db" `
  -Method POST -ContentType "application/json" `
  -Body '{"adminToken":"YOUR_ADMIN_TOKEN"}'
```

---

## Anti-Cheat

Server validates every save against rate limits (gold/s, exp/s, levels/min, area unlock order). Values exceeding the limits are clamped and returned to the client. After `ANTI_CHEAT_BAN_THRESHOLD` (default: 3) flags the account is automatically deleted.

Thresholds are tunable via env vars: `ANTI_CHEAT_MAX_GOLD_PER_SEC`, `ANTI_CHEAT_MAX_EXP_PER_SEC`, `ANTI_CHEAT_MAX_LEVELS_PER_MIN`, etc.

---

## Contact

- Email: [ripp1337@gmail.com](mailto:ripp1337@gmail.com)
- Discord: [discord.gg/d8rE8qSk](https://discord.gg/d8rE8qSk)
