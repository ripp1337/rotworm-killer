// ── HUD updates ──────────────────────────────────────────────────

import { S } from '../systems/state.js';
import { WEAPONS }        from '../data/weapons.js';
import { AREAS, getAreaIndex, getAreaById } from '../data/areas.js';
import { isPotionActive } from '../systems/crafting.js';
import { getMaxMonsters } from '../systems/spawner.js';
import { effectiveBasicCooldown, effectiveAutoCooldown, skillPts } from '../systems/skills.js';
import { expForLevel }    from '../systems/combat.js';
import { apiFetch }       from '../persistence/save.js';  // shared fetch helper

// ── Update all HUD elements ───────────────────────────────────────

export function updateHUD() {
    _setText('playerName',  S.loggedInPlayer ?? '');
    _setText('playerLevel', `Lv ${S.level}`);
    _setText('hud-score',   _fmt(S.score));
    _setHpBar();
    _setExpBar();
    _setGoldText();
    _setWeaponInfo();
    _setAreaInfo();
    _setPotionTimers();
    _setMobCount();
    _setCooldownBars();
    _setAbilityButtons();
}

function _setHpBar() {
    // No player HP in this game; show boss HP bar instead
}

function _setAbilityButtons() {
    const gfbUnlocked = skillPts(31) >= 1 || S.gfbUnlocked;
    const gfbBtn  = document.getElementById('btnGfb');
    const gfbWrap = document.getElementById('cd-fire-wrap');
    if (gfbBtn)  gfbBtn.style.display  = gfbUnlocked ? '' : 'none';
    if (gfbWrap) gfbWrap.style.display = gfbUnlocked ? '' : 'none';
}

function _setExpBar() {
    const cur  = S.exp;
    const need = expForLevel(S.level + 1);
    const pct  = need > 0 ? Math.min(1, cur / need) : 1;
    const bar  = document.getElementById('expBar');
    if (bar) bar.style.width = `${(pct * 100).toFixed(1)}%`;
    _setText('expText', `${_fmt(cur)} / ${_fmt(need)} XP`);
}

function _setGoldText() {
    _setText('goldCount', _fmt(S.gold));
}

function _setWeaponInfo() {
    const w    = WEAPONS[S.weaponIndex] ?? WEAPONS[0];
    const next = WEAPONS[S.weaponIndex + 1];
    _setText('weaponName',    w.name);
    _setText('weaponDmgRange', `${_fmt(w.min)}–${_fmt(w.max)}`);

    const btn = document.getElementById('btnBuyWeapon');
    if (btn) {
        if (!next) {
            btn.textContent = 'Max weapon';
            btn.disabled    = true;
        } else {
            btn.textContent = `Upgrade to ${next.name} (${_fmt(next.cost)}g, Lv${next.levelReq})`;
            btn.disabled    = S.gold < next.cost || S.level < next.levelReq;
        }
    }
}

function _setAreaInfo() {
    _setText('currentArea', S.currentArea);

    const areaIdx = getAreaIndex(S.currentArea);
    const next    = AREAS[areaIdx + 1];
    const btn     = document.getElementById('btnUnlockArea');
    if (btn) {
        if (!next) {
            btn.textContent = 'All areas unlocked';
            btn.disabled    = true;
        } else {
            btn.textContent = `Unlock ${next.id} (${_fmt(next.goldCost)}g, Lv${next.levelReq})`;
            btn.disabled    = S.gold < next.goldCost || S.level < next.levelReq
                              || S.unlockedAreas.includes(next.id);
        }
    }
}

function _setPotionTimers() {
    const now = Date.now();
    const active = [];
    for (const id of [
        'potion_small_speed', 'potion_medium_speed', 'potion_large_speed',
        'potion_small_gold',  'potion_medium_gold',  'potion_large_gold',
        'potion_small_exp',   'potion_medium_exp',   'potion_large_exp',
        'potion_danger', 'potion_madness',
    ]) {
        if (isPotionActive(id)) {
            active.push(id.replace(/_/g, ' '));
        }
    }
    _setText('activePotions', active.length ? active.join(', ') : 'None');
}

function _setMobCount() {
    _setText('mobCount', `${S.worms.length} / ${getMaxMonsters()}`);
}

function _setCooldownBars() {
    // GFB cooldown
    _setCdBar('cdGfb', S.gfbCooldownEnd, 15000);
    // HMM cooldown
    _setCdBar('cdHmm', S.hmmCooldownEnd, 10000);
    // Sudden Death cooldown
    _setCdBar('cdSuddenDeath', S.suddenDeathCooldownEnd, 600000);
}

function _setCdBar(id, endMs, totalMs) {
    const el  = document.getElementById(id);
    if (!el) return;
    const now = Date.now();
    const remaining = Math.max(0, endMs - now);
    const pct = remaining > 0 ? (remaining / totalMs) * 100 : 0;
    el.style.width = `${pct.toFixed(1)}%`;
}

// ── Weapon upgrade button ─────────────────────────────────────────

export async function doBuyWeapon() {
    const next = WEAPONS[S.weaponIndex + 1];
    if (!next) return;

    const res = await apiFetch('/api/buy/weapon', { index: S.weaponIndex + 1 });
    if (res.ok) {
        S.weaponIndex = res.weapon_index;
        S.gold        = res.gold;
        updateHUD();
    } else {
        _showToast(res.error ?? 'Failed to upgrade weapon.');
    }
}

// ── Area unlock button ────────────────────────────────────────────

export async function doBuyArea() {
    const areaIdx = getAreaIndex(S.currentArea);
    const next    = AREAS[areaIdx + 1];
    if (!next || S.unlockedAreas.includes(next.id)) return;

    const res = await apiFetch('/api/buy/area', { id: next.id });
    if (res.ok) {
        S.unlockedAreas = res.unlocked_areas;
        S.gold          = res.gold;
        updateHUD();
        _refreshAreaSelector();
    } else {
        _showToast(res.error ?? 'Failed to unlock area.');
    }
}

export function setCurrentArea(areaId) {
    if (S.unlockedAreas.includes(areaId)) {
        S.currentArea = areaId;
        updateHUD();
    }
}

function _refreshAreaSelector() {
    const sel = document.getElementById('areaSelector');
    if (!sel) return;
    sel.innerHTML = '';
    for (const area of AREAS) {
        if (!S.unlockedAreas.includes(area.id)) break;
        const opt = document.createElement('option');
        opt.value       = area.id;
        opt.textContent = area.id;
        if (area.id === S.currentArea) opt.selected = true;
        sel.appendChild(opt);
    }
}

// ── Utility helpers ───────────────────────────────────────────────

function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function _showToast(msg) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        toast.style.cssText =
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
            'background:#1a1006;border:1px solid #aa3300;color:#cc6030;' +
            'padding:8px 18px;font-family:Verdana,sans-serif;font-size:11px;' +
            'z-index:9999;pointer-events:none;display:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function _fmt(n) {
    n = Math.floor(n);
    if (n >= 1_000_000_000_000) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1_000_000_000)     return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1_000_000)         return (n / 1e6 ).toFixed(2) + 'M';
    // Exact value with dots as thousands separators (e.g. 1.234.567)
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
