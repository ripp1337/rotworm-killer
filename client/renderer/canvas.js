// ── Game loop — update, draw, and main loop ───────────────────────

import { S } from '../systems/state.js';
import { AREAS, getAreaById, getAreaIndex } from '../data/areas.js';
import { TILE } from '../data/constants.js';
import {
    effectiveBasicCooldown, effectiveAutoCooldown, skillPts,
} from '../systems/skills.js';
import { fillToMaxMonsters, checkSpawnBoss } from '../systems/spawner.js';
import { syncSpriteLayer }  from './sprites.js';
import { tickAutoGfb }      from '../systems/abilities.js';

const CANVAS_W = 800;
const CANVAS_H = 500;

let _canvas = null;
let _ctx    = null;
let _rafId  = null;
let _running = false;

// ── Floor image cache ─────────────────────────────────────────────
const _floorImgs = new Map(); // filename → HTMLImageElement

function _getFloorImg(filename) {
    if (!_floorImgs.has(filename)) {
        const img = new Image();
        img.src = filename;
        _floorImgs.set(filename, img);
    }
    return _floorImgs.get(filename);
}

// Physics sub-step (ms)
const DT      = 16.67;
let   _accum  = 0;
let   _lastTs = 0;

export function initCanvas(canvasEl) {
    _canvas = canvasEl;
    _ctx    = canvasEl.getContext('2d');
    canvasEl.width  = CANVAS_W;
    canvasEl.height = CANVAS_H;
}

export function startLoop() {
    if (_running) return;
    _running = true;
    _lastTs  = performance.now();
    _rafId   = requestAnimationFrame(_loop);
}

export function stopLoop() {
    _running = false;
    cancelAnimationFrame(_rafId);
}

// ── Main loop ────────────────────────────────────────────────────

function _loop(ts) {
    if (!_running) return;
    _rafId = requestAnimationFrame(_loop);

    const dt = ts - _lastTs;
    _lastTs  = ts;
    _accum  += dt;

    // Fixed-step physics: cap to avoid spiral of death
    const steps = Math.min(Math.floor(_accum / DT), 5);
    for (let i = 0; i < steps; i++) {
        update(DT / 1000);
        _accum -= DT;
    }

    draw();
    syncSpriteLayer();
}

// ── Update physics step ───────────────────────────────────────────

export function update(dtSec) {
    const area = getAreaById(S.currentArea);
    if (!area) return;

    // Auto-attack tick — fires if A1 skill is unlocked (or manual toggle enabled)
    const now = Date.now();
    if (skillPts(11) >= 1 && now >= S.nextAutoAttackMs) {
        S.nextAutoAttackMs = now + effectiveAutoCooldown();
        // dispatch a synthetic auto-attack event (handled in main.js)
        window.dispatchEvent(new CustomEvent('autoAttack'));
    }

    // Auto-GFB tick — fires automatically if C1 is unlocked and off-cooldown
    if (skillPts(31) >= 1) {
        const cast = tickAutoGfb(now, area);
        if (cast) window.dispatchEvent(new CustomEvent('autoGfbFired', { detail: cast }));
    }

    // Fill population
    fillToMaxMonsters(area);

    // Check boss spawn when a worm dies (handled in onMobKilled, but also
    // catch any stale gaps here)
    if (!S.boss) checkSpawnBoss(area);
}

function _moveEntity(e, dtSec) {
    e.x += e.dx * dtSec;
    e.y += e.dy * dtSec;

    const maxX = CANVAS_W - e.size;
    const maxY = CANVAS_H - e.size;

    if (e.x < 0)    { e.x = 0;    e.dx *= -1; }
    if (e.x > maxX) { e.x = maxX; e.dx *= -1; }
    if (e.y < 0)    { e.y = 0;    e.dy *= -1; }
    if (e.y > maxY) { e.y = maxY; e.dy *= -1; }
}

// ── Draw ──────────────────────────────────────────────────────────

export function draw() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Tiled floor ──────────────────────────────────────────────
    const area = getAreaById(S.currentArea);
    let floorDrawn = false;
    if (area?.floor) {
        const img = _getFloorImg(area.floor);
        if (img.complete && img.naturalWidth > 0) {
            const iw = img.naturalWidth;
            const ih = img.naturalHeight;
            for (let ty = 0; ty < CANVAS_H; ty += ih) {
                for (let tx = 0; tx < CANVAS_W; tx += iw) {
                    _ctx.drawImage(img, tx, ty);
                }
            }
            floorDrawn = true;
        }
    }
    if (!floorDrawn) {
        _ctx.fillStyle = '#1a1a2e';
        _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Boss HP bar
    if (S.boss) {
        _drawHpBar(S.boss, '#cc2200', '#ff6644');
    }

    // Worm HP bars (only if below max HP)
    for (const w of S.worms) {
        if (w.hp < w.maxHp) _drawHpBar(w, '#006600', '#44cc44');
    }
}

function _drawHpBar(entity, bgColor, fgColor) {
    const barW = entity.size;
    const barH = 4;
    const x    = entity.x;
    const y    = entity.y - 7;
    const pct  = Math.max(0, entity.hp / entity.maxHp);

    _ctx.fillStyle = bgColor;
    _ctx.fillRect(x, y, barW, barH);
    _ctx.fillStyle = fgColor;
    _ctx.fillRect(x, y, barW * pct, barH);
}
