// ── FX — floating damage numbers and level-up flash ───────────────

const _fxContainer = document.createElement('div');
_fxContainer.id    = 'fxLayer';
_fxContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;';
document.addEventListener('DOMContentLoaded', () => {
    const arena = document.getElementById('gameArena') ?? document.body;
    arena.appendChild(_fxContainer);
});

// ── Floating damage number ─────────────────────────────────────────

export function spawnFloatingDmg(x, y, dmg, { isBoss = false, isCrit = false } = {}) {
    const el = document.createElement('span');
    el.className   = 'float-dmg';
    el.textContent = _fmt(dmg);

    el.style.cssText = [
        `left:${x}px`,
        `top:${y}px`,
        `color:${isBoss ? '#ff6600' : isCrit ? '#fff700' : '#ffffff'}`,
        `font-size:${isCrit ? '18px' : '14px'}`,
        `font-weight:bold`,
        `position:absolute`,
        `pointer-events:none`,
        `animation:floatUp 1s ease forwards`,
    ].join(';');

    _fxContainer.appendChild(el);
    setTimeout(() => el.remove(), 1050);
}

// ── Level-up message ──────────────────────────────────────────────

export function showLevelUpMsg(level) {
    const el = document.createElement('div');
    el.className   = 'level-up-msg';
    el.textContent = `LEVEL UP! → ${level}`;
    el.style.cssText = [
        `position:absolute`,
        `top:40%`,
        `left:50%`,
        `transform:translateX(-50%)`,
        `color:#ffe566`,
        `font-size:28px`,
        `font-weight:bold`,
        `text-shadow:0 2px 8px #000`,
        `animation:floatUp 2s ease forwards`,
        `pointer-events:none`,
    ].join(';');

    _fxContainer.appendChild(el);
    setTimeout(() => el.remove(), 2100);
}

function _fmt(n) {
    if (n >= 1e9)  return (n / 1e9 ).toFixed(1) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(1) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(n);
}

// ── Fireball explosion visual ─────────────────────────────────────
// Diamond AoE: 7 tiles wide × 5 tiles tall  (7×32 = 224, 5×32 = 160)
const GFB_VFX_W = 224;
const GFB_VFX_H = 160;

export function spawnFireballEffect(cx, cy) {
    const el = document.createElement('img');
    el.src = 'Fireball_Effect.gif';
    // Force GIF restart by appending a timestamp query param
    el.src = `Fireball_Effect.gif?t=${Date.now()}`;
    el.style.cssText = [
        'position:absolute',
        `left:${Math.round(cx - GFB_VFX_W / 2)}px`,
        `top:${Math.round(cy - GFB_VFX_H / 2)}px`,
        `width:${GFB_VFX_W}px`,
        `height:${GFB_VFX_H}px`,
        'pointer-events:none',
        'z-index:20',
        'image-rendering:pixelated',
    ].join(';');
    _fxContainer.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
