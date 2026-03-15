# Rotworm Killer 2.0 Migration Runbook

This runbook upgrades safely without deleting current players.

## 1. Goal

- Keep all existing players and progress.
- Deploy new features with minimal risk.
- Have clear rollback steps.

## 2. Current Architecture

- Runtime: Python (`server.py`)
- DB: SQLite (`game.db`) in `DATA_DIR` (or fallback path)
- Health endpoint: `GET /healthz`
- Admin endpoints:
  - `POST /api/admin/list-users`
  - `POST /api/admin/delete-users`

## 3. Core Rule: Additive Changes Only

For schema and state migrations:

- Add columns, do not drop/rename existing columns in production rollouts.
- Use safe defaults for new columns.
- Upgrade old player `state` in code.
- Keep backward compatibility for at least one release.

## 4. Pre-Deploy Checklist (Production)

1. Record current production commit hash.
2. Create Railway DB backup/snapshot.
3. Confirm env vars are set:
   - `DATA_DIR`
   - `ADMIN_TOKEN`
4. Confirm health endpoint works:
   - `GET /healthz` -> `{ "ok": true }`
5. Confirm admin list endpoint works.

## 5. Staging Setup (Recommended)

Create a separate Railway service:

- Same codebase branch.
- Different `DATA_DIR` / separate volume.
- Different `ADMIN_TOKEN`.
- Same start command: `python server.py`.

Never point staging and production to the same DB.

## 6. Branch and Deploy Flow

1. Create feature branch for 2.0.
2. Implement additive schema/state changes.
3. Push and deploy to staging.
4. Run smoke tests.
5. Merge to `master`.
6. Deploy production in low-traffic window.

## 7. Smoke Tests (Staging)

Run all after staging deploy:

1. Register/login/logout works.
2. Save/load works for a new account.
3. Save/load works for an old account snapshot.
4. Scoreboard still returns expected ordering.
5. Anti-cheat does not block normal progression.
6. Anti-cheat flags obvious impossible jumps.
7. Admin list and delete endpoints work with staging token.

## 8. Production Verification

Immediately after deploy:

1. Check service healthy (`/healthz`).
2. Check startup log contains DB path.
3. Check `/api/admin/list-users` responds.
4. Verify at least one known old account can login and save.
5. Monitor logs for `[error]` and `[anti-cheat]` lines.

## 9. Rollback Plan

If major issue appears:

1. Redeploy previous stable commit in Railway.
2. If DB corruption happened, restore from snapshot.
3. Re-run smoke tests.
4. Freeze new writes if needed while restoring.

Avoid manual mass data edits during incident response.

## 10. Suggested 2.0 Safety Patterns

- Add `stateVersion` to saved state.
- On save/load:
  - If missing version, treat as version 1.
  - Run deterministic upgrader to latest version.
- Keep migration functions small and idempotent.

Example strategy:

- `upgrade_state_v1_to_v2(state)`
- `upgrade_state_v2_to_v3(state)`
- `upgrade_state_to_latest(state)`

## 11. Admin Commands (Production)

List users:

```powershell
$URL = "https://web-production-413c2.up.railway.app/api/admin/list-users"
$JSON = '{"adminToken":"<ADMIN_TOKEN>"}'
Invoke-RestMethod -Method Post -Uri $URL -ContentType "application/json" -Body $JSON | ConvertTo-Json -Depth 8
```

Delete user(s):

```powershell
$URL = "https://web-production-413c2.up.railway.app/api/admin/delete-users"
$JSON = '{"adminToken":"<ADMIN_TOKEN>","usernames":["name1","name2"]}'
Invoke-RestMethod -Method Post -Uri $URL -ContentType "application/json" -Body $JSON | ConvertTo-Json -Depth 8
```

## 12. Security Hygiene

- Rotate `ADMIN_TOKEN` after admin operations.
- Do not store real tokens in git.
- Prefer header-based admin auth long term.
- Remove temporary auth fallbacks after stabilization.

## 13. Definition of Done for 2.0

- No player data loss.
- Backward compatibility validated on staging and production.
- Health and core gameplay endpoints stable for 24h.
- Monitoring/log review completed.
- Rollback tested at least once in staging.
