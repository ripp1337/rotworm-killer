// ── Sprite layer — DOM elements for worms and boss ───────────────

import { S } from '../systems/state.js';

// Each entity gets a wrapper <div> containing:
//   <div class="mob-name">Name</div>
//   <div class="mob-hpbar-wrap"><div class="mob-hpbar-fill"></div></div>
//   <img class="mob-sprite">
const _pool = new Map();  // id → { wrap, nameEl, barWrap, barFill, img }
let   _container = null;

export function initSprites(containerEl) {
    _container = containerEl;
}

// Synchronise DOM sprites with current worms + boss arrays
export function syncSpriteLayer() {
    if (!_container) return;

    const living = new Set();

    for (const w of S.worms) {
        living.add(w.id);
        _upsertSprite(w);
    }
    if (S.boss) {
        living.add(S.boss.id);
        _upsertSprite(S.boss);
    }

    // Remove stale sprites
    for (const [id, els] of _pool) {
        if (!living.has(id)) {
            els.wrap.remove();
            _pool.delete(id);
        }
    }
}

// ── HP → colour helper ────────────────────────────────────────────
// pct = 1 (full) → bright green  #44ee44
// pct = 0.75     → deep green    #22aa22
// pct = 0.50     → yellow        #dddd00
// pct = 0.25     → orange        #ff6600
// pct = 0        → deep red      #cc0000
function _hpColor(pct) {
    // Clamp
    const t = Math.max(0, Math.min(1, pct));

    let r, g, b;
    if (t >= 0.75) {
        // green → deep green  (1.0 → 0.75)
        const p = (t - 0.75) / 0.25;
        r = Math.round(0x22 + p * (0x44 - 0x22));
        g = Math.round(0xaa + p * (0xee - 0xaa));
        b = 0x22;
    } else if (t >= 0.50) {
        // deep green → yellow  (0.75 → 0.50)
        const p = (t - 0.50) / 0.25;
        r = Math.round(0xdd - p * (0xdd - 0x22));
        g = Math.round(0xdd - p * (0xdd - 0xaa));
        b = 0;
    } else if (t >= 0.25) {
        // yellow → orange  (0.50 → 0.25)
        const p = (t - 0.25) / 0.25;
        r = 0xff;
        g = Math.round(0x66 + p * (0xdd - 0x66));
        b = 0;
    } else {
        // orange → deep red  (0.25 → 0)
        const p = t / 0.25;
        r = Math.round(0xcc + p * (0xff - 0xcc));
        g = Math.round(p * 0x66);
        b = 0;
    }

    return `rgb(${r},${g},${b})`;
}

function _upsertSprite(entity) {
    let els = _pool.get(entity.id);

    if (!els) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:absolute;display:flex;flex-direction:column;align-items:center;';

        const nameEl = document.createElement('div');
        nameEl.style.cssText =
            'font-family:Verdana,sans-serif;font-size:10px;font-weight:bold;' +
            'text-shadow:1px 1px 2px #000,-1px -1px 2px #000;' +
            'white-space:nowrap;line-height:1;margin-bottom:2px;';

        const barWrap = document.createElement('div');
        barWrap.style.cssText =
            'width:100%;height:4px;background:#333;border:1px solid #000;margin-bottom:2px;';

        const barFill = document.createElement('div');
        barFill.style.cssText = 'height:100%;width:100%;';
        barWrap.appendChild(barFill);

        const img = document.createElement('img');
        img.className = 'mob-sprite';
        img.style.cssText = 'image-rendering:pixelated;display:block;';
        img.draggable = false;
        if (entity.isBoss) img.classList.add('boss-sprite');

        wrap.appendChild(nameEl);
        wrap.appendChild(barWrap);
        wrap.appendChild(img);
        _container.appendChild(wrap);

        els = { wrap, nameEl, barWrap, barFill, img };
        _pool.set(entity.id, els);
    }

    // Position wrapper at entity top-left
    els.wrap.style.left = `${entity.x}px`;
    els.wrap.style.top  = `${entity.y - 22}px`;   // 22px overhead for name + bar
    els.wrap.style.width = `${entity.size}px`;

    // Update image
    els.img.src    = entity.sprite ?? '';
    els.img.style.width  = `${entity.size}px`;
    els.img.style.height = `${entity.size}px`;

    // HP fraction
    const pct = Math.max(0, entity.hp / entity.maxHp);
    const col = _hpColor(pct);

    // Name (coloured)
    els.nameEl.textContent  = entity.name ?? '';
    els.nameEl.style.color  = col;

    // HP bar fill
    els.barFill.style.width      = `${(pct * 100).toFixed(1)}%`;
    els.barFill.style.background = col;
}
