# State Versioning Guide (Rotworm Killer)

This file defines a safe pattern for evolving player `state` without breaking old accounts.

## 1. Why

Players already have JSON in `players.state`. New game features can add fields or change meaning.
Versioning avoids data loss and lets old saves upgrade automatically.

## 2. Current State Shape (Observed)

Typical keys seen in existing saves:

- `score`
- `level`
- `exp`
- `gold`
- `weaponIndex`
- `autoUnlocked`
- `autoEnabled`
- `autoGfbUnlocked`
- `autoGfbEnabled`
- `autoUeUnlocked`
- `autoUeEnabled`
- `gfbUnlocked`
- `ueUnlocked`
- `atkSpeedUpgrades`
- `gfbCdUpgrades`
- `ueCdUpgrades`
- `bossSpawnCounter`
- `savedAt` (sometimes)

## 3. Target Pattern

Add a numeric field in state:

- `stateVersion`

Rules:

1. Missing `stateVersion` means `1`.
2. Upgrade step-by-step: `1 -> 2 -> 3`.
3. Every upgrader must be idempotent and additive.
4. Never delete critical fields during migration.

## 4. Suggested Constants

In `server.py`:

```python
LATEST_STATE_VERSION = 2
```

## 5. Example Upgrader Functions

Add near your helper section in `server.py`.

```python
def _as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def normalize_base_state(state: dict) -> dict:
    # Defensive defaults so old or malformed saves still work.
    out = dict(state or {})
    out['score'] = max(0, _as_int(out.get('score'), 0))
    out['level'] = max(1, _as_int(out.get('level'), 1))
    out['exp'] = max(0, _as_int(out.get('exp'), 0))
    out['gold'] = max(0, _as_int(out.get('gold'), 0))
    out['weaponIndex'] = max(0, _as_int(out.get('weaponIndex'), 0))
    return out


def upgrade_state_v1_to_v2(state: dict) -> dict:
    # Example: introduce manual click counters for future analytics/anti-cheat.
    out = dict(state)
    out.setdefault('manualClicks', 0)
    out.setdefault('autoClicks', 0)
    out.setdefault('totalDamageDealt', 0)
    out['stateVersion'] = 2
    return out


def upgrade_state_to_latest(state: dict) -> dict:
    out = normalize_base_state(state)
    version = _as_int(out.get('stateVersion'), 1)

    while version < LATEST_STATE_VERSION:
        if version == 1:
            out = upgrade_state_v1_to_v2(out)
            version = 2
        else:
            # Unknown old/new version fallback: normalize and mark latest.
            out['stateVersion'] = LATEST_STATE_VERSION
            version = LATEST_STATE_VERSION

    out['stateVersion'] = LATEST_STATE_VERSION
    return out
```

## 6. Where To Use It

Use in `POST /api/save` before reading reported values:

```python
state = body.get('state')
if not isinstance(state, dict):
    return self.send_json(400, {'error': 'Invalid state.'})

state = upgrade_state_to_latest(state)
```

Then continue anti-cheat clamping and DB update as you already do.

## 7. Optional: Upgrade On Login

You can also normalize on `POST /api/login` for accounts that do not save often:

1. Parse `players.state` if present.
2. `upgrade_state_to_latest`.
3. Persist upgraded JSON once.

This keeps data consistent before gameplay starts.

## 8. Backward Compatibility Checklist

For each new version:

1. Add new keys with defaults only.
2. Never assume key exists.
3. Keep old keys accepted for at least one release.
4. Add migration test cases:
   - missing state
   - stateVersion missing
   - stateVersion old
   - malformed values

## 9. Suggested v2 Feature Payload

If you plan manual/auto click telemetry, v2 keys could be:

- `manualClicks`
- `autoClicks`
- `manualDamage`
- `autoDamage`
- `lastClientTick`

Keep server authoritative for score/level regardless.

## 10. Deployment Steps

1. Add upgrader code.
2. Deploy to staging.
3. Test old account login/save.
4. Verify no regressions in scoreboard.
5. Deploy production.
6. Monitor logs for migration errors.

## 11. Rollback Safety

Because migrations are additive in JSON and schema, rollback is safe:

- Old code will ignore unknown JSON keys.
- Existing columns remain intact.

Avoid destructive JSON rewrites during rollout.
