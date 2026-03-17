"""Scoreboard and stats routes."""
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.auth import auth_player, get_token_from_request
from app.db import get_conn

router = APIRouter()


@router.get('/api/scoreboard')
async def scoreboard(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)

    conn = get_conn()
    rows = conn.execute(
        'SELECT username, score, exp, level, ascended_class FROM players ORDER BY exp DESC LIMIT 10'
    ).fetchall()

    board = []
    for i, r in enumerate(rows):
        board.append({
            'rank':          i + 1,
            'username':      r['username'],
            'score':         r['score'],
            'exp':           r['exp'],
            'level':         r['level'],
            'ascended_class': r['ascended_class'],
        })

    me_entry = None
    if player:
        # Check if player is in top-10
        in_top = any(e['username'] == player['username'] for e in board)
        if not in_top:
            rank_row = conn.execute(
                'SELECT COUNT(*) FROM players WHERE exp > ?',
                (int(player.get('exp', 0)),),
            ).fetchone()
            rank = (rank_row[0] if rank_row else 0) + 1
            me_entry = {
                'rank':          rank,
                'username':      player['username'],
                'score':         player.get('score', 0),
                'exp':           player.get('exp', 0),
                'level':         player.get('level', 1),
                'ascended_class': player.get('ascended_class'),
            }

    return JSONResponse({'ok': True, 'board': board, 'me': me_entry})


@router.get('/api/stats')
async def stats_page(request: Request):
    conn = get_conn()
    now  = int(time.time() * 1000)

    def _count(query, params=()):  # type: ignore[misc]
        row = conn.execute(query, params).fetchone()
        return row[0] if row else 0

    total     = _count('SELECT COUNT(*) FROM players')
    active5   = _count('SELECT COUNT(*) FROM players WHERE last_save_ms > ?', (now - 5 * 60 * 1000,))
    active1h  = _count('SELECT COUNT(*) FROM players WHERE last_save_ms > ?', (now - 60 * 60 * 1000,))
    active24h = _count('SELECT COUNT(*) FROM players WHERE last_save_ms > ?', (now - 24 * 60 * 60 * 1000,))
    knights   = _count("SELECT COUNT(*) FROM players WHERE ascended_class = 'knight'")
    sorcerers = _count("SELECT COUNT(*) FROM players WHERE ascended_class = 'sorcerer'")

    all_rows = conn.execute(
        'SELECT username, score, exp, level, total_clicks, ascended_class FROM players ORDER BY exp DESC'
    ).fetchall()
    players = [
        {
            'rank':          i + 1,
            'username':      r['username'],
            'score':         r['score'],
            'exp':           r['exp'],
            'level':         r['level'],
            'total_clicks':  r['total_clicks'],
            'ascended_class': r['ascended_class'],
        }
        for i, r in enumerate(all_rows)
    ]

    return JSONResponse({
        'ok':           True,
        'total':        total,
        'active_5min':  active5,
        'active_1h':    active1h,
        'active_24h':   active24h,
        'knights':      knights,
        'sorcerers':    sorcerers,
        'players':      players,
    })
