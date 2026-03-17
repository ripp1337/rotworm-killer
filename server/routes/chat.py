"""Live chat via SSE and message posting."""
import asyncio
import json
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from server.auth import auth_player, get_token_from_request
from server.config import CHAT_HISTORY_MAX, CHAT_RATE_LIMIT_MS

router = APIRouter()

_chat_history: list[dict]                = []
_chat_subscribers: list[asyncio.Queue]   = []
_chat_last_send: dict[int, int]          = {}   # player_id → last send timestamp ms
_chat_lock = asyncio.Lock()


def _make_msg(username: str, text: str) -> dict:
    return {'username': username, 'text': text, 'ts': int(time.time() * 1000)}


async def _broadcast(msg: dict) -> None:
    async with _chat_lock:
        _chat_history.append(msg)
        if len(_chat_history) > CHAT_HISTORY_MAX:
            _chat_history.pop(0)
        dead = []
        for q in _chat_subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            try:
                _chat_subscribers.remove(q)
            except ValueError:
                pass


@router.get('/api/chat/stream')
async def chat_stream(request: Request):
    q = asyncio.Queue(maxsize=50)

    async with _chat_lock:
        _chat_subscribers.append(q)
        history_snapshot = list(_chat_history)

    async def event_generator():
        try:
            # Send existing history
            for msg in history_snapshot:
                yield f'data: {json.dumps(msg)}\n\n'

            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield f'data: {json.dumps(msg)}\n\n'
                except asyncio.TimeoutError:
                    yield ': ping\n\n'   # keep-alive
        finally:
            async with _chat_lock:
                try:
                    _chat_subscribers.remove(q)
                except ValueError:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            'Cache-Control':  'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


@router.post('/api/chat/send')
async def chat_send(request: Request):
    token  = get_token_from_request(request)
    player = auth_player(token)
    if player is None:
        return JSONResponse({'error': 'Not authenticated.'}, 401)

    body = await request.json()
    text = (body.get('text') or '').strip()[:200]
    if not text:
        return JSONResponse({'error': 'Empty message.'}, 400)

    now_ms      = int(time.time() * 1000)
    player_id   = player['id']
    last_send   = _chat_last_send.get(player_id, 0)
    if now_ms - last_send < CHAT_RATE_LIMIT_MS:
        return JSONResponse({'error': 'Slow down!'}, 429)

    _chat_last_send[player_id] = now_ms
    msg = _make_msg(player['username'], text)
    await _broadcast(msg)
    return JSONResponse({'ok': True})
