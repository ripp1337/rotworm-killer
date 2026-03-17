"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.db import init_db
from app.routes.account        import router as account_router
from app.routes.save            import router as save_router
from app.routes.buy             import router as buy_router
from app.routes.password_reset  import router as pw_router
from app.routes.scoreboard      import router as sb_router
from app.routes.chat            import router as chat_router
from app.routes.suggest         import router as suggest_router
from app.routes.admin           import router as admin_router

_ROOT = Path(__file__).parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

# ── API routes (must come before static mounts) ───────────────────
for r in (account_router, save_router, buy_router, pw_router,
          sb_router, chat_router, suggest_router, admin_router):
    app.include_router(r)


# ── Explicit HTML pages so StaticFiles html=True works correctly ──
@app.get('/')
async def index():
    return FileResponse(_ROOT / 'index.html')


@app.get('/stats')
async def stats_html():
    return FileResponse(_ROOT / 'stats.html')


@app.get('/reset-password')
async def reset_pw_html():
    return FileResponse(_ROOT / 'reset-password.html')


# ── Static file mounts ─────────────────────────────────────────────
_CLIENT_DIR = _ROOT / 'client'
if _CLIENT_DIR.exists():
    app.mount('/client', StaticFiles(directory=str(_CLIENT_DIR)), name='client')

_CSS_DIR = _ROOT / 'css'
if _CSS_DIR.exists():
    app.mount('/css', StaticFiles(directory=str(_CSS_DIR)), name='css')

_JS_DIR = _ROOT / 'js'
if _JS_DIR.exists():
    app.mount('/js', StaticFiles(directory=str(_JS_DIR)), name='js')

# Serve root-level static assets (sprites, etc.)
app.mount('/', StaticFiles(directory=str(_ROOT), html=False), name='root_static')
