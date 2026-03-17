"""Save route — accepts client-side combat state, clamps gold/exp gains."""
import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.auth import auth_player, get_token_from_request
from app import cache as _cache
from app.db import get_conn, _write_lock, level_from_exp
from app.config import AREA_GOLD_CAP_PER_SEC, AREA_EXP_CAP_PER_SEC

router = APIRouter()


@router.post('/api/save')
async def save(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body = await request.json()
    now_ms = int(time.time() * 1000)

    # ── Compute elapsed time for rate clamping ────────────────────
    last_ms  = int(player.get('last_save_ms') or 0)
    elapsed  = max(0.0, (now_ms - last_ms) / 1000.0) if last_ms > 0 else 60.0
    elapsed  = min(elapsed, 300.0)   # cap at 5 min to prevent huge offline gains

    area = player.get('current_area', 'Rookgaard')
    gold_cap = AREA_GOLD_CAP_PER_SEC.get(area, 50) * elapsed
    exp_cap  = AREA_EXP_CAP_PER_SEC.get(area, 200)  * elapsed

    # ── Client-owned numeric fields ───────────────────────────────
    # Use `or 0` instead of .get(key, default) so that NULL DB values
    # (key present but value=None) are also coerced to 0 instead of
    # reaching int(None) and raising TypeError.
    client_gold  = int(body.get('gold')  or player.get('gold')  or 0)
    client_exp   = int(body.get('exp')   or player.get('exp')   or 0)
    client_score = int(body.get('score') or player.get('score') or 0)

    # Clamp gold/exp gains against per-area cap
    prev_gold = int(player.get('gold') or 0)
    prev_exp  = int(player.get('exp')  or 0)
    gold_gain = max(0, client_gold - prev_gold)
    exp_gain  = max(0, client_exp  - prev_exp)

    if gold_gain > gold_cap:
        client_gold = prev_gold + int(gold_cap)
    if exp_gain > exp_cap:
        client_exp = prev_exp + int(exp_cap)

    # Score can only go up
    new_score = max(int(player.get('score') or 0), client_score)

    new_level = level_from_exp(client_exp)

    # ── Transient combat state (stored as-is) ────────────────────
    total_clicks            = int(body.get('total_clicks')           or player.get('total_clicks')           or 0)
    inventory               = body.get('inventory')               or player.get('inventory')               or {}
    potion_timers           = body.get('potion_timers')           or player.get('potion_timers')           or {}
    hmm_cd_end              = int(body.get('hmm_cd_end')             or player.get('hmm_cd_end')             or 0)
    arcane_weakness_stacks  = int(body.get('arcane_weakness_stacks') or player.get('arcane_weakness_stacks') or 0)
    sudden_death_cd_end     = int(body.get('sudden_death_cd_end')    or player.get('sudden_death_cd_end')    or 0)
    essence_gathering_end   = int(body.get('essence_gathering_end')  or player.get('essence_gathering_end')  or 0)
    boss_spawn_counter      = int(body.get('boss_spawn_counter')     or player.get('boss_spawn_counter')     or 0)
    boss_kill_counter       = int(body.get('boss_kill_counter')      or player.get('boss_kill_counter')      or 0)

    # ── Persist ──────────────────────────────────────────────────
    conn = get_conn()
    for attempt in range(3):
        try:
            with _write_lock:
                conn.execute(
                    """UPDATE players SET
                        gold = ?, exp = ?, score = ?, level = ?,
                        total_clicks = ?,
                        inventory = ?,
                        potion_timers = ?,
                        hmm_cd_end = ?,
                        arcane_weakness_stacks = ?,
                        sudden_death_cd_end = ?,
                        essence_gathering_end = ?,
                        boss_spawn_counter = ?,
                        boss_kill_counter = ?,
                        last_save_ms = ?
                    WHERE id = ?""",
                    (
                        client_gold, client_exp, new_score, new_level,
                        total_clicks,
                        json.dumps(inventory),
                        json.dumps(potion_timers),
                        hmm_cd_end,
                        arcane_weakness_stacks,
                        sudden_death_cd_end,
                        essence_gathering_end,
                        boss_spawn_counter,
                        boss_kill_counter,
                        now_ms,
                        player['id'],
                    ),
                )
                conn.commit()
            break
        except RuntimeError:
            if attempt == 2:
                return JSONResponse({'error': 'Save failed after retries.'}, 500)

    _cache.evict_player(player['id'])

    return JSONResponse({
        'ok':           True,
        'gold':         client_gold,
        'exp':          client_exp,
        'level':        new_level,
        'score':        new_score,
        'last_save_ms': now_ms,
    })
