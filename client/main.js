// ── Client entry point ────────────────────────────────────────────

import { S } from './systems/state.js';
import { loadState }             from './persistence/load.js';
import { saveProgress, saveOnUnload } from './persistence/save.js';
import { initCanvas, startLoop, stopLoop } from './renderer/canvas.js';
import { syncSpriteLayer }       from './renderer/sprites.js';
import { initSprites }           from './renderer/sprites.js';
import { showLevelUpMsg, spawnFireballEffect } from './renderer/fx.js';
import { updateHUD, doBuyWeapon, doBuyArea, setCurrentArea } from './ui/hud.js';
import { renderSkillPanel }      from './ui/skill_panel.js';
import { initChat, sendChat }    from './ui/chat.js';
import { toggleScoreboard }      from './ui/scoreboard.js';
import {
    doAscend, doRespec,
    showCraftingModal, showInventoryModal,
} from './ui/modals.js';
import { getAreaById }           from './data/areas.js';
import { WEAPONS }               from './data/weapons.js';
import {
    effectiveBasicCooldown, effectiveAutoCooldown,
} from './systems/skills.js';
import {
    rollClickDmg, rollAutoDmg, levelFromExp, expForLevel,
} from './systems/combat.js';
import {
    checkSpawnBoss, fillToMaxMonsters,
} from './systems/spawner.js';
import { goldGain, expGain, rollEssenceDrops, applyEssenceDrops } from './systems/loot.js';
import { canFireGfb, castGfb, canFireHmm, castHmm, canFireSuddenDeath, castSuddenDeath } from './systems/abilities.js';
import { spawnFloatingDmg }      from './renderer/fx.js';

// ── Initialise ───────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    const canvas      = document.getElementById('gameCanvas');
    const spriteLayer = document.getElementById('spriteLayer');

    if (canvas)      initCanvas(canvas);
    if (spriteLayer) initSprites(spriteLayer);

    _bindUI();
    initAuth();
});

// ── Authentication ───────────────────────────────────────────────

async function initAuth() {
    // Try restoring existing session from cookie/localStorage
    try {
        const res = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}` },
        });
        if (res.ok) {
            const data = await res.json();
            loadState({ ...data.player, token: localStorage.getItem('token') });
            startGame();
            return;
        }
    } catch {/* not logged in */ }

    _showAuthForm();
}

export async function doLogin(username, password) {
    const res  = await fetch('/api/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
        const el = document.getElementById('auth-login-err');
        if (el) el.textContent = data.error ?? 'Login failed.';
        return;
    }

    localStorage.setItem('token', data.token);
    loadState({ ...data.player, token: data.token });
    startGame();
}

export async function doRegister(username, password, email) {
    const body = { username, password };
    if (email) body.email = email;

    const res  = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
        const el = document.getElementById('auth-reg-err');
        if (el) el.textContent = data.error ?? 'Registration failed.';
        return;
    }

    localStorage.setItem('token', data.token);
    loadState({ ...data.player, token: data.token });
    startGame();
}

export async function doLogout() {
    await fetch('/api/logout', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${S.authToken}` },
    }).catch(() => {});
    localStorage.removeItem('token');
    location.reload();
}

// ── Game start ───────────────────────────────────────────────────

function startGame() {
    _hideAuthForm();
    document.getElementById('gameWrapper')?.style?.setProperty('display', '');

    updateHUD();
    renderSkillPanel();
    initChat();

    const area = getAreaById(S.currentArea);
    if (area) fillToMaxMonsters(area);

    startLoop();

    // Auto-save every 5 minutes
    setInterval(() => saveProgress(), 300_000);

    // Server-sent announcement
    _loadAnnouncement();
}

// ── Click on game area (manual attacks) ──────────────────────────

let _lastClickMs = 0;

export function handleGameClick(e) {
    if (!S.loggedInPlayer) return;

    const now = Date.now();
    const cd  = effectiveBasicCooldown();
    if (now - _lastClickMs < cd) return;

    // Hit-test: find which monster was clicked
    const target = _pickClickedTarget(e);
    if (!target) return;   // clicked empty space — don't consume cooldown

    _lastClickMs = now;
    S.totalClicks++;

    const area   = getAreaById(S.currentArea);
    const isBoss = target.isBoss;
    const dmg    = rollClickDmg(target, isBoss);
    target.hp   -= dmg;

    _spawnDmgFx(target, dmg);

    _checkKill(target, area, now);
    saveProgress();
    updateHUD();
}

// Auto-attack (dispatched from canvas loop)
let _lastAutoSaveMs = 0;
window.addEventListener('autoAttack', () => {
    const area   = getAreaById(S.currentArea);
    const target = _pickTarget();
    if (!target) return;

    const isBoss = target.isBoss;
    const dmg    = rollAutoDmg(target, isBoss);
    target.hp   -= dmg;

    _spawnDmgFx(target, dmg);
    _checkKill(target, area, Date.now());

    // Save to DB at most once every 30 s during auto-attack so area unlock works
    const now = Date.now();
    if (now - _lastAutoSaveMs > 30_000) {
        _lastAutoSaveMs = now;
        saveProgress();
    }
});

// ── Damage FX helper — top-center of sprite ───────────────────────

function _spawnDmgFx(target, dmg) {
    spawnFloatingDmg(target.x + target.size / 2, target.y - 22, dmg, { isBoss: target.isBoss });
}

// ── Pick the monster that was clicked (hit-test) ──────────────────

function _pickClickedTarget(e) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return null;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / (rect.width  || canvas.width);
    const scaleY = canvas.height / (rect.height || canvas.height);
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    // Boss takes priority (larger target)
    if (S.boss) {
        const b = S.boss;
        if (cx >= b.x && cx <= b.x + b.size &&
            cy >= b.y && cy <= b.y + b.size) return b;
    }
    // Check worms — prefer lowest HP among clicked ones
    const hit = S.worms.filter(w =>
        cx >= w.x && cx <= w.x + w.size &&
        cy >= w.y && cy <= w.y + w.size
    );
    if (hit.length === 0) return null;
    return hit.reduce((a, b) => a.hp < b.hp ? a : b);
}

// ── Pick the lowest-HP target for auto-attack ─────────────────────

function _pickTarget() {
    // Always attack boss if present; no boss-focus toggle needed
    if (S.boss) return S.boss;
    if (S.worms.length === 0) return null;
    // Lowest current HP wins
    return S.worms.reduce((a, b) => a.hp < b.hp ? a : b);
}

// ── Kill logic ────────────────────────────────────────────────────

function _checkKill(target, area, now) {
    if (target.hp > 0) return;

    const isBoss = !!target.isBoss;
    const isUber = !!target.isUber;

    // Remove from state
    if (isBoss) {
        S.boss = null;
        S.bossKillCounter++;
        S.arcaneWeakeningStacks = 0;
    } else {
        S.worms = S.worms.filter(w => w.id !== target.id);
        S.bossSpawnCounter++;
        S.totalMonstersKilled++;
    }

    // Rewards
    const g      = goldGain(area, isBoss, isUber);
    const e      = expGain(area, isBoss, isUber);
    const drops  = rollEssenceDrops(isBoss, isUber);

    S.gold  += g;
    S.exp   += e;
    S.score += isBoss ? 100 : 10;

    // Floating reward numbers above the killed entity
    const rx = target.x + target.size / 2;
    const ry = target.y;
    spawnFloatingDmg(rx,      ry - 20, e, { type: 'exp'  });
    spawnFloatingDmg(rx + 20, ry - 4,  g, { type: 'gold' });

    applyEssenceDrops(drops);

    // Level up
    const newLv = levelFromExp(S.exp);
    if (newLv > S.level) {
        S.level = newLv;
        showLevelUpMsg(newLv);
    }

    // Boss spawn check
    if (!S.boss) checkSpawnBoss(area);

    updateHUD();
}

// ── Ability buttons ───────────────────────────────────────────────

export function handleGfbClick() {
    const now = Date.now();
    if (!canFireGfb(now)) return;
    const area = getAreaById(S.currentArea);
    const cast = castGfb(now, area);
    if (!cast) return;
    _applyGfbCast(cast, area, now);
    saveProgress();
    updateHUD();
}

// Auto-GFB fired from canvas loop
window.addEventListener('autoGfbFired', (e) => {
    const cast = e.detail;
    const area = getAreaById(S.currentArea);
    _applyGfbCast(cast, area, Date.now());
    updateHUD();
});

function _applyGfbCast(cast, area, now) {
    const { results, center } = cast;
    spawnFireballEffect(center.x, center.y);
    for (const { target, dmg } of results) {
        spawnFloatingDmg(target.x + target.size / 2, target.y - 22, dmg, { isBoss: target.isBoss });
        _checkKill(target, area, now);
    }
}

export function handleHmmClick() {
    const now = Date.now();
    if (!canFireHmm(now)) return;
    const area = getAreaById(S.currentArea);
    const results = castHmm(now, area);
    if (!results) return;
    for (const { target, dmg } of results) {
        spawnFloatingDmg(target.x + target.size / 2, target.y, dmg, { isBoss: target.isBoss });
        _checkKill(target, area, now);
    }
    saveProgress();
    updateHUD();
}

export function handleSuddenDeathClick() {
    const now     = Date.now();
    const results = castSuddenDeath(now);
    if (!results) return;
    const area = getAreaById(S.currentArea);
    for (const { target, dmg } of results) {
        spawnFloatingDmg(target.x + target.size / 2, target.y, dmg, { isBoss: true });
        _checkKill(target, area, now);
    }
    saveProgress();
    updateHUD();
}

// ── Bind all static UI handlers ───────────────────────────────────

function _bindUI() {
    // Auth form
    _on('btnLogin', 'click', () => {
        const u = document.getElementById('inputUsername')?.value ?? '';
        const p = document.getElementById('inputPassword')?.value ?? '';
        doLogin(u, p);
    });
    _on('btnRegister', 'click', () => {
        const u = document.getElementById('auth-reg-user')?.value ?? '';
        const p = document.getElementById('auth-reg-pass')?.value ?? '';
        const e = document.getElementById('inputEmail')?.value ?? '';
        doRegister(u, p, e);
    });
    _on('btnLogout', 'click', doLogout);

    // Game canvas click
    document.getElementById('gameCanvas')?.addEventListener('click', handleGameClick);
    document.getElementById('spriteLayer')?.addEventListener('click', handleGameClick);

    // Abilities
    _on('btnGfb',         'click', handleGfbClick);
    _on('btnHmm',         'click', handleHmmClick);
    _on('btnSuddenDeath', 'click', handleSuddenDeathClick);

    // Weapon / area
    _on('btnBuyWeapon',  'click', doBuyWeapon);
    _on('btnUnlockArea', 'click', doBuyArea);

    // Area selector
    document.getElementById('areaSelector')?.addEventListener('change', e => {
        setCurrentArea(e.target.value);
    });

    // Ascend / respec
    _on('btnAscendKnight',   'click', () => doAscend('knight'));
    _on('btnAscendSorcerer', 'click', () => doAscend('sorcerer'));
    _on('btnRespecKnight',   'click', () => doRespec('knight'));
    _on('btnRespecSorcerer', 'click', () => doRespec('sorcerer'));

    // Modals
    _on('btnOpenCrafting',  'click', showCraftingModal);
    _on('btnOpenInventory', 'click', showInventoryModal);
    _on('btnScoreboard',    'click', toggleScoreboard);

    // Skill tree modal
    _on('btnSkillTree', 'click', () => {
        renderSkillPanel();
        const m = document.getElementById('skill-modal');
        if (m) m.style.display = 'flex';
    });

    // Ascend / Respec modal
    _on('btnAscendOpen', 'click', () => {
        const ascended = S.ascended;
        const ascSection   = document.getElementById('ascend-section');
        const respecSection = document.getElementById('respec-section');
        if (ascSection)   ascSection.style.display   = ascended ? 'none' : '';
        if (respecSection) respecSection.style.display = ascended ? '' : 'none';
        if (ascended) {
            const curLbl  = document.getElementById('cur-class-label');
            const costLbl = document.getElementById('respec-cost-label');
            if (curLbl)  curLbl.textContent  = S.ascendedClass === 'knight' ? 'Knight' : 'Sorcerer';
            if (costLbl) {
                const COSTS = [1_000_000, 100_000_000, 10_000_000_000];
                const cost  = COSTS[Math.min(S.respecCount, 2)];
                costLbl.textContent = `Respec cost: ${_fmtGold(cost)}g`;
            }
        }
        const m = document.getElementById('class-modal');
        if (m) m.style.display = 'flex';
    });

    // Chat
    _on('chat-send-btn', 'click', () => {
        const inp = document.getElementById('chat-input');
        if (inp) { sendChat(inp.value); inp.value = ''; }
    });
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { sendChat(e.target.value); e.target.value = ''; }
    });

    // Auto GFB toggle
    _on('chkAutoGfb', 'change', e => { S.autoGfbEnabled = e.target.checked; });

    // Auto attack toggle
    _on('chkAutoAttack', 'change', e => { S.autoEnabled = e.target.checked; });

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.closeModal;
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    });

    // Page unload — save via sendBeacon
    window.addEventListener('beforeunload', saveOnUnload);

    // ── Global functions called from inline onclick attributes ────
    // (ES modules don't expose to global scope automatically)

    window.switchAuthTab = function(tab) {
        const isLogin = tab === 'login';
        document.getElementById('auth-login-form').style.display  = isLogin ? '' : 'none';
        document.getElementById('auth-reg-form').style.display    = isLogin ? 'none' : '';
        document.getElementById('auth-forgot-panel').style.display = 'none';
        document.getElementById('auth-tabs').style.display        = '';
        document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
        document.getElementById('tab-reg-btn').classList.toggle('active', !isLogin);
    };

    window.closeAnnouncement = function() {
        document.getElementById('announcement-overlay').style.display = 'none';
    };

    window.switchSkillTab = function(tab) {
        const MAP = { general: 'panelGeneral', knight: 'panelKnight', sorc: 'panelSorc' };
        for (const [t, id] of Object.entries(MAP)) {
            const el = document.getElementById(id);
            if (el) el.style.display = t === tab ? '' : 'none';
        }
        document.querySelectorAll('.st-tab').forEach(btn =>
            btn.classList.toggle('st-tab-active', btn.dataset.tab === tab)
        );
    };

    window.chatToggle = function() {
        const box = document.getElementById('chat-messages');
        const btn = document.getElementById('chat-toggle-btn');
        if (!box) return;
        const hidden = box.style.display === 'none';
        box.style.display = hidden ? '' : 'none';
        if (btn) btn.textContent = hidden ? '[hide]' : '[show]';
    };

    // Forgot-password flow
    _on('forgotLink', 'click', e => {
        e.preventDefault();
        document.getElementById('auth-login-form').style.display   = 'none';
        document.getElementById('auth-reg-form').style.display     = 'none';
        document.getElementById('auth-tabs').style.display         = 'none';
        document.getElementById('auth-forgot-panel').style.display = '';
        document.getElementById('auth-forgot-email').value         = '';
        document.getElementById('auth-forgot-msg').textContent     = '';
    });
    _on('forgotBackLink', 'click', e => {
        e.preventDefault();
        document.getElementById('auth-forgot-panel').style.display = 'none';
        document.getElementById('auth-tabs').style.display         = '';
        window.switchAuthTab('login');
    });
    _on('auth-forgot-btn', 'click', async () => {
        const email = document.getElementById('auth-forgot-email').value.trim();
        const msgEl = document.getElementById('auth-forgot-msg');
        const btn   = document.getElementById('auth-forgot-btn');
        msgEl.style.color = '#e05050';
        msgEl.textContent = '';
        if (!email) { msgEl.textContent = 'Please enter your email address.'; return; }
        btn.disabled = true;
        try {
            await fetch('/api/forgot-password', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email }),
            });
            msgEl.style.color = '#7fff9e';
            msgEl.textContent = 'If an account with that email exists, a reset link has been sent.';
        } catch {
            msgEl.textContent = 'Connection error.';
        }
        btn.disabled = false;
    });
}

function _on(id, event, handler) {
    document.getElementById(id)?.addEventListener(event, handler);
}

function _fmtGold(n) {
    if (n >= 1e9)  return (n / 1e9 ).toFixed(1) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(1) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(Math.floor(n));
}

// ── Announcement ─────────────────────────────────────────────────

async function _loadAnnouncement() {
    try {
        const res  = await fetch('/api/announcement');
        if (!res.ok) return;
        const data = await res.json();
        const el   = document.getElementById('announcement');
        if (el && data.message) el.textContent = data.message;
    } catch {/* ignore */ }
}

// ── Auth form helpers ─────────────────────────────────────────────

function _showAuthForm() {
    document.getElementById('authWrapper')?.style?.setProperty('display', 'flex');
    document.getElementById('gameWrapper')?.style?.setProperty('display', 'none');
    document.getElementById('top-nav')?.style?.setProperty('display', 'none');
}

function _hideAuthForm() {
    document.getElementById('authWrapper')?.style?.setProperty('display', 'none');
    document.getElementById('top-nav')?.style?.setProperty('display', '');
}
