"""Server-authoritative purchase endpoints: /api/buy/skill, weapon, area, ascend, respec."""
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.auth import auth_player, get_token_from_request
from app import cache as _cache
from app.db import get_conn, _write_lock
from app.config import (
    WEAPONS, AREA_ORDER, AREA_LEVEL_REQS, AREA_GOLD_COSTS,
    SKILL_MAXES_GENERAL, SKILL_MAXES_KNIGHT, SKILL_MAXES_SORC,
    SKILL_COSTS_GENERAL, SKILL_COSTS_KNIGHT, SKILL_COSTS_SORC,
    SKILL_PREREQS_GENERAL, SKILL_PREREQS_KNIGHT, SKILL_PREREQS_SORC,
    RESPEC_COSTS, ASCEND_LEVEL,
)

router = APIRouter()


# ── Skill purchase ─────────────────────────────────────────────────

@router.post('/api/buy/skill')
async def buy_skill(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body    = await request.json()
    skill_id = int(body.get('id', 0))

    # Determine which tree
    if skill_id in SKILL_MAXES_GENERAL:
        pts_field  = 'skill_pts'
        maxes      = SKILL_MAXES_GENERAL
        costs      = SKILL_COSTS_GENERAL
        prereqs    = SKILL_PREREQS_GENERAL
    elif skill_id in SKILL_MAXES_KNIGHT:
        if player.get('ascended_class') != 'knight':
            return JSONResponse({'error': 'Not a knight.'}, 403)
        pts_field  = 'knight_pts'
        maxes      = SKILL_MAXES_KNIGHT
        costs      = SKILL_COSTS_KNIGHT
        prereqs    = SKILL_PREREQS_KNIGHT
    elif skill_id in SKILL_MAXES_SORC:
        if player.get('ascended_class') != 'sorcerer':
            return JSONResponse({'error': 'Not a sorcerer.'}, 403)
        pts_field  = 'sorc_pts'
        maxes      = SKILL_MAXES_SORC
        costs      = SKILL_COSTS_SORC
        prereqs    = SKILL_PREREQS_SORC
    else:
        return JSONResponse({'error': 'Unknown skill id.'}, 400)

    current_pts  = dict(player.get(pts_field) or {})
    current_val  = int(current_pts.get(str(skill_id), 0))
    max_val      = maxes[skill_id]

    if current_val >= max_val:
        return JSONResponse({'error': 'Skill already maxed.'}, 400)

    # Check prereqs
    for pid in prereqs.get(skill_id, []):
        if int(current_pts.get(str(pid), 0)) < 1:
            return JSONResponse({'error': 'Prerequisite not met.'}, 400)

    cost = costs[skill_id][current_val]
    gold = int(player.get('gold', 0))
    if gold < cost:
        return JSONResponse({'error': 'Not enough gold.'}, 400)

    new_gold = gold - cost
    current_pts[str(skill_id)] = current_val + 1

    conn = get_conn()
    with _write_lock:
        conn.execute(
            f'UPDATE players SET gold = ?, {pts_field} = ? WHERE id = ?',
            (new_gold, json.dumps(current_pts), player['id']),
        )
        conn.commit()
    _cache.evict_player(player['id'])

    return JSONResponse({'ok': True, 'gold': new_gold, pts_field: current_pts})


# ── Weapon purchase ────────────────────────────────────────────────

@router.post('/api/buy/weapon')
async def buy_weapon(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body           = await request.json()
    desired_index  = int(body.get('index', -1))
    current_index  = int(player.get('weapon_index', 0))
    level          = int(player.get('level', 1))
    gold           = int(player.get('gold', 0))

    if desired_index != current_index + 1:
        return JSONResponse({'error': 'Weapons must be purchased sequentially.'}, 400)
    if desired_index < 0 or desired_index >= len(WEAPONS):
        return JSONResponse({'error': 'Invalid weapon index.'}, 400)

    wpn = WEAPONS[desired_index]
    if level < wpn['minLevel']:
        return JSONResponse({'error': f'Requires level {wpn["minLevel"]}.'}, 400)
    if gold < wpn['cost']:
        return JSONResponse({'error': 'Not enough gold.'}, 400)

    new_gold  = gold - wpn['cost']
    new_index = desired_index

    conn = get_conn()
    with _write_lock:
        conn.execute(
            'UPDATE players SET gold = ?, weapon_index = ? WHERE id = ?',
            (new_gold, new_index, player['id']),
        )
        conn.commit()
    _cache.evict_player(player['id'])

    return JSONResponse({'ok': True, 'gold': new_gold, 'weapon_index': new_index})


# ── Area unlock ────────────────────────────────────────────────────

@router.post('/api/buy/area')
async def buy_area(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body       = await request.json()
    area_id    = (body.get('id') or '').strip()
    unlocked   = list(player.get('unlocked_areas') or ['Rookgaard'])
    level      = int(player.get('level', 1))
    gold       = int(player.get('gold', 0))

    if area_id not in AREA_ORDER:
        return JSONResponse({'error': 'Unknown area.'}, 400)
    if area_id in unlocked:
        return JSONResponse({'error': 'Area already unlocked.'}, 400)

    # Must be sequential
    current_idx = AREA_ORDER.index(unlocked[-1]) if unlocked else 0
    target_idx  = AREA_ORDER.index(area_id)
    if target_idx != current_idx + 1:
        return JSONResponse({'error': 'Areas must be unlocked sequentially.'}, 400)

    level_req = AREA_LEVEL_REQS[area_id]
    gold_cost = AREA_GOLD_COSTS[area_id]
    if level < level_req:
        return JSONResponse({'error': f'Requires level {level_req}.'}, 400)
    if gold < gold_cost:
        return JSONResponse({'error': 'Not enough gold.'}, 400)

    new_gold     = gold - gold_cost
    new_unlocked = unlocked + [area_id]

    conn = get_conn()
    with _write_lock:
        conn.execute(
            'UPDATE players SET gold = ?, current_area = ?, unlocked_areas = ? WHERE id = ?',
            (new_gold, area_id, json.dumps(new_unlocked), player['id']),
        )
        conn.commit()
    _cache.evict_player(player['id'])

    return JSONResponse({'ok': True, 'gold': new_gold, 'current_area': area_id, 'unlocked_areas': new_unlocked})


# ── Ascension ──────────────────────────────────────────────────────

@router.post('/api/ascend')
async def ascend(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body        = await request.json()
    chosen_class = (body.get('class') or '').strip().lower()

    if chosen_class not in ('knight', 'sorcerer'):
        return JSONResponse({'error': 'Invalid class. Choose knight or sorcerer.'}, 400)
    if int(player.get('level', 1)) < ASCEND_LEVEL:
        return JSONResponse({'error': f'Requires level {ASCEND_LEVEL}.'}, 400)
    if player.get('ascended'):
        return JSONResponse({'error': 'Already ascended.'}, 400)

    conn = get_conn()
    with _write_lock:
        conn.execute(
            'UPDATE players SET ascended = 1, ascended_class = ? WHERE id = ?',
            (chosen_class, player['id']),
        )
        conn.commit()
    _cache.evict_player(player['id'])

    return JSONResponse({'ok': True, 'ascended': True, 'ascended_class': chosen_class})


# ── Respec ─────────────────────────────────────────────────────────

@router.post('/api/respec')
async def respec(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body         = await request.json()
    new_class    = (body.get('class') or '').strip().lower()

    if new_class not in ('knight', 'sorcerer'):
        return JSONResponse({'error': 'Invalid class.'}, 400)
    if not player.get('ascended'):
        return JSONResponse({'error': 'Not yet ascended.'}, 400)

    respec_count = int(player.get('respec_count', 0))
    cost         = RESPEC_COSTS[min(respec_count, len(RESPEC_COSTS) - 1)]
    gold         = int(player.get('gold', 0))

    if gold < cost:
        return JSONResponse({'error': f'Requires {cost:,} gold.'}, 400)

    new_gold        = gold - cost
    new_respec_count = respec_count + 1
    empty_pts       = json.dumps({})

    conn = get_conn()
    with _write_lock:
        conn.execute(
            """UPDATE players SET
                gold = ?, ascended_class = ?, respec_count = ?,
                knight_pts = ?, sorc_pts = ?
            WHERE id = ?""",
            (new_gold, new_class, new_respec_count, empty_pts, empty_pts, player['id']),
        )
        conn.commit()
    _cache.evict_player(player['id'])

    return JSONResponse({
        'ok':           True,
        'gold':         new_gold,
        'ascended_class': new_class,
        'respec_count': new_respec_count,
        'knight_pts':   {},
        'sorc_pts':     {},
    })
