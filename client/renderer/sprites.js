// ── Sprite layer — DOM image elements for worms and boss ──────────

import * as S from '../systems/state.js';

const _spritePool = new Map();  // id → <img> element
let   _container  = null;

export function initSprites(containerEl) {
    _container = containerEl;
}

// Synchronise DOM sprites with current worms + boss arrays
export function syncSpriteLayer() {
    if (!_container) return;

    const living = new Set();

    // Worms
    for (const w of S.worms) {
        living.add(w.id);
        _upsertSprite(w);
    }

    // Boss
    if (S.boss) {
        living.add(S.boss.id);
        _upsertSprite(S.boss);
    }

    // Remove stale sprites
    for (const [id, el] of _spritePool) {
        if (!living.has(id)) {
            el.remove();
            _spritePool.delete(id);
        }
    }
}

function _upsertSprite(entity) {
    let el = _spritePool.get(entity.id);
    if (!el) {
        el = document.createElement('img');
        el.className         = 'mob-sprite';
        el.style.position    = 'absolute';
        el.style.imageRendering = 'pixelated';
        if (entity.isBoss) el.classList.add('boss-sprite');
        _container.appendChild(el);
        _spritePool.set(entity.id, el);
    }

    el.src              = entity.sprite ?? 'css/entity-placeholder.png';
    el.style.left       = `${entity.x}px`;
    el.style.top        = `${entity.y}px`;
    el.style.width      = `${entity.size}px`;
    el.style.height     = `${entity.size}px`;

    // Health tint: red as HP drops
    const pct           = entity.hp / entity.maxHp;
    el.style.filter     = `hue-rotate(${Math.floor((1 - pct) * 120)}deg)`;
}
