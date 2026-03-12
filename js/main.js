// simple rotworm killer game stub
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const rotwormImg = new Image();
rotwormImg.src = 'Rotworm.gif'; // ensure path matches filename

const versperothImg = new Image();
versperothImg.src = 'Versperoth.gif';

const BOSS_EVERY     = 50;   // spawn a boss every N worm kills
const BOSS_HP        = 500;
const BOSS_EXP       = 600;
const BOSS_GOLD      = 1000;
const BOSS_KILLS     = 10;   // counts as this many kills
const BOSS_SIZE      = 32;   // half-width for hitbox/draw (64px sprite)
let bossSpawnCounter = 0;    // increments with every worm/boss kill

// ── Auth & persistence ───────────────────────────────────────────
let authToken    = localStorage.getItem('rk_token');
let authUsername = localStorage.getItem('rk_username');
let guestMode    = false;
let gameStarted  = false;
let _saveTimer   = null;
let _sbTimer     = null;

const floorImg = new Image();
floorImg.src = 'Muddy_Floor_(Dark).gif';

// pre-generate a random flip map for floor tiles (25 cols × 19 rows)
const TILE = 32;
const TILE_COLS = Math.ceil(canvas.width  / TILE);
const TILE_ROWS = Math.ceil(canvas.height / TILE);
const floorMap = Array.from({ length: TILE_ROWS }, () =>
    Array.from({ length: TILE_COLS }, () => ({
        flipH: Math.random() < 0.5,
        flipV: Math.random() < 0.5,
    }))
);

let worms = [];
let boss  = null;  // single boss, or null
let score = 0;
let gold = 0;  // loot currency
let exp = 0;   // experience points
let level = 1; // player level
let levelUpMsg = 0; // timer for level-up flash

const WORM_MAXHP = 65;
const WORM_EXP   = 40;

// weapon progression
const WEAPONS = [
    { name: 'Serpent Sword',   min:  5, max: 15, cost:     0, sprite: 'Serpent_Sword.gif'   },
    { name: 'Clerical Mace',   min:  10, max: 20, cost:  1000, sprite: 'Clerical_Mace.gif'   },
    { name: 'Fire Sword',      min: 15, max: 30, cost:  5000, sprite: 'Fire_Sword.gif'       },
    { name: 'Warhammer',       min: 25, max: 45, cost: 10000, sprite: 'War_Hammer.gif'       },
    { name: 'Stonecutter Axe', min: 45, max: 55, cost: 50000, sprite: 'Stonecutter_Axe.gif' },
];
let weaponIndex = 0; // current weapon

// damage scaling: +1 min/max per 5 levels on top of weapon base
function levelBonus() { return Math.floor(level / 5); }
function basicDmgMin()  { return WEAPONS[weaponIndex].min + levelBonus(); }
function basicDmgMax()  { return WEAPONS[weaponIndex].max + levelBonus(); }
function fireDmgMin()   { return 10 + levelBonus() * 2; }
function fireDmgMax()   { return 20 + levelBonus() * 2; }
function rollBasicDmg() { return basicDmgMin() + Math.floor(Math.random() * (basicDmgMax() - basicDmgMin() + 1)); }
function rollFireDmg()  { return fireDmgMin()  + Math.floor(Math.random() * (fireDmgMax()  - fireDmgMin()  + 1)); }

// Tibia XP formula: total XP required to reach level x
function expForLevel(x) {
    return Math.floor((50 * (x*x*x - 6*x*x + 17*x - 12)) / 3);
}

function checkLevelUp() {
    while (exp >= expForLevel(level + 1)) {
        level++;
        levelUpMsg = 120; // show message for ~2s
    }
}

function updateHUD() {
    const expNeeded = expForLevel(level + 1);
    const expCurrent = expForLevel(level);
    const progress = (exp - expCurrent) / (expNeeded - expCurrent);
    document.getElementById('hud-level').textContent = level;
    document.getElementById('hud-exp').textContent = `${exp} / ${expNeeded}`;
    document.getElementById('hud-xpbar').style.width = (Math.min(progress, 1) * 100) + '%';
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-gold').textContent = gold;
    document.getElementById('hud-dmg-basic').textContent = `${basicDmgMin()}–${basicDmgMax()}`;
    document.getElementById('hud-dmg-fire').textContent  = `${fireDmgMin()}–${fireDmgMax()}`;
    // weapon
    const nextWeapon = WEAPONS[weaponIndex + 1];
    document.getElementById('hud-weapon-name').textContent = WEAPONS[weaponIndex].name;
    document.getElementById('hud-weapon-img').src = WEAPONS[weaponIndex].sprite;
    if (nextWeapon) {
        const canUpgrade = gold >= nextWeapon.cost;
        const upgradeBtn = document.getElementById('weaponUpgradeBtn');
        upgradeBtn.innerHTML = `<img src="${nextWeapon.sprite}" class="btn-icon"> ${nextWeapon.name} (${nextWeapon.cost}g)`;
        upgradeBtn.disabled = !canUpgrade;
        upgradeBtn.style.display = 'block';
    } else {
        document.getElementById('weaponUpgradeBtn').style.display = 'none';
    }
    // upgrade buttons
    const upgAtkBtn = document.getElementById('upgradeAtkSpeedBtn');
    if (atkSpeedUpgrades >= MAX_UPGRADES) {
        upgAtkBtn.textContent = 'Atk Speed MAX';
        upgAtkBtn.disabled = true;
    } else {
        const aCost = atkSpeedCost();
        upgAtkBtn.textContent = `Atk Speed +10% (${fmtCost(aCost)}g) ${atkSpeedUpgrades}/${MAX_UPGRADES}`;
        upgAtkBtn.disabled = gold < aCost;
    }
    const upgGfbBtn = document.getElementById('upgradeGfbCdBtn');
    if (gfbCdUpgrades >= MAX_UPGRADES) {
        upgGfbBtn.textContent = 'GFB CD MAX';
        upgGfbBtn.disabled = true;
    } else {
        const gCost = gfbCdCost();
        upgGfbBtn.textContent = `GFB CD -10% (${fmtCost(gCost)}g) ${gfbCdUpgrades}/${MAX_UPGRADES}`;
        upgGfbBtn.disabled = gold < gCost;
    }
    const upgUeBtn = document.getElementById('upgradeUeCdBtn');
    if (ueCdUpgrades >= MAX_UPGRADES) {
        upgUeBtn.textContent = 'Ult CD MAX';
        upgUeBtn.disabled = true;
    } else {
        const uCost = ueCdCost();
        upgUeBtn.textContent = `Ult CD -10% (${fmtCost(uCost)}g) ${ueCdUpgrades}/${MAX_UPGRADES}`;
        upgUeBtn.disabled = gold < uCost;
    }
    // auto attack button
    const autoBtn = document.getElementById('autoAttackBtn');
    if (!autoUnlocked) {
        autoBtn.textContent = level < AUTO_UNLOCK_LEVEL
            ? `Auto Attack (need lvl ${AUTO_UNLOCK_LEVEL})`
            : `Auto Attack (Free)`;
        autoBtn.disabled = level < AUTO_UNLOCK_LEVEL;
        autoBtn.classList.remove('auto-on');
    } else {
        autoBtn.textContent = autoEnabled ? 'Auto: ON' : 'Auto: OFF';
        autoBtn.disabled = false;
        autoBtn.classList.toggle('auto-on', autoEnabled);
    }
    // auto GFB button
    const autoGfbBtn = document.getElementById('autoGfbBtn');
    if (!autoGfbUnlocked) {
        autoGfbBtn.textContent = !gfbUnlocked
            ? `Auto GFB (unlock GFB first)`
            : level < AUTO_GFB_UNLOCK_LEVEL
                ? `Auto GFB (need lvl ${AUTO_GFB_UNLOCK_LEVEL})`
                : gold < AUTO_GFB_UNLOCK_GOLD
                    ? `Auto GFB (need ${AUTO_GFB_UNLOCK_GOLD}g)`
                    : `Auto GFB (${AUTO_GFB_UNLOCK_GOLD}g)`;
        autoGfbBtn.disabled = !gfbUnlocked || level < AUTO_GFB_UNLOCK_LEVEL || gold < AUTO_GFB_UNLOCK_GOLD;
        autoGfbBtn.classList.remove('auto-on');
    } else {
        autoGfbBtn.textContent = autoGfbEnabled ? 'Auto GFB: ON' : 'Auto GFB: OFF';
        autoGfbBtn.disabled = false;
        autoGfbBtn.classList.toggle('auto-on', autoGfbEnabled);
    }
    // auto UE button
    const autoUeBtn = document.getElementById('autoUeBtn');
    if (!autoUeUnlocked) {
        autoUeBtn.textContent = !ueUnlocked
            ? `Auto UE (unlock UE first)`
            : level < AUTO_UE_UNLOCK_LEVEL
                ? `Auto UE (need lvl ${AUTO_UE_UNLOCK_LEVEL})`
                : gold < AUTO_UE_UNLOCK_GOLD
                    ? `Auto UE (need ${AUTO_UE_UNLOCK_GOLD}g)`
                    : `Auto UE (${AUTO_UE_UNLOCK_GOLD}g)`;
        autoUeBtn.disabled = !ueUnlocked || level < AUTO_UE_UNLOCK_LEVEL || gold < AUTO_UE_UNLOCK_GOLD;
        autoUeBtn.classList.remove('auto-on');
    } else {
        autoUeBtn.textContent = autoUeEnabled ? 'Auto UE: ON' : 'Auto UE: OFF';
        autoUeBtn.disabled = false;
        autoUeBtn.classList.toggle('auto-on', autoUeEnabled);
    }
    // boss focus button
    const bossFocusBtn = document.getElementById('bossFocusBtn');
    if (!bossFocusUnlocked) {
        bossFocusBtn.textContent = !autoUnlocked
            ? `Boss Focus (unlock Auto first)`
            : level < BOSS_FOCUS_UNLOCK_LEVEL
                ? `Boss Focus (need lvl ${BOSS_FOCUS_UNLOCK_LEVEL})`
                : gold < BOSS_FOCUS_UNLOCK_GOLD
                    ? `Boss Focus (need ${BOSS_FOCUS_UNLOCK_GOLD}g)`
                    : `Boss Focus (${BOSS_FOCUS_UNLOCK_GOLD}g)`;
        bossFocusBtn.disabled = !autoUnlocked || level < BOSS_FOCUS_UNLOCK_LEVEL || gold < BOSS_FOCUS_UNLOCK_GOLD;
        bossFocusBtn.classList.remove('auto-on');
    } else {
        bossFocusBtn.textContent = 'Boss Focus: ON';
        bossFocusBtn.disabled = true;
        bossFocusBtn.classList.add('auto-on');
    }
}

let fireballActive = false;
let spawnPaused = false;
let dmgNumbers = []; // floating damage numbers

const BASIC_COOLDOWN_MS  = 500;    // 0.5s
const GFB_COOLDOWN_MS    = 10000;  // 10s
const GFB_GOLD_COST      = 0;      // free to cast
const GFB_UNLOCK_LEVEL   = 4;
const GFB_UNLOCK_GOLD    = 100;
let gfbUnlocked     = false;
let lastBasicAttack = 0;   // timestamp of last basic hit
let gfbCooldownEnd  = 0;   // timestamp when GFB is ready again

const UE_UNLOCK_LEVEL = 10;
const UE_UNLOCK_GOLD  = 1000;
const UE_COOLDOWN_MS  = 30000; // 30s
let ueUnlocked    = false;
let ueCooldownEnd = 0;

const AUTO_UNLOCK_LEVEL = 5;
const AUTO_UNLOCK_GOLD  = 0;
const AUTO_COOLDOWN_MS  = 1000; // fixed 1s, unaffected by upgrades
let autoUnlocked   = false;
let autoEnabled    = false;
let autoTarget     = null;
let lastAutoAttack = 0;

const AUTO_GFB_UNLOCK_LEVEL = 15;
const AUTO_GFB_UNLOCK_GOLD  = 1000;
let autoGfbUnlocked = false;
let autoGfbEnabled  = false;

const AUTO_UE_UNLOCK_LEVEL = 25;
const AUTO_UE_UNLOCK_GOLD  = 10000;
let autoUeUnlocked = false;
let autoUeEnabled  = false;

const BOSS_FOCUS_UNLOCK_LEVEL = 10;
const BOSS_FOCUS_UNLOCK_GOLD  = 1000;
let bossFocusUnlocked = false;

// upgrades
const MAX_UPGRADES   = 10;
let atkSpeedUpgrades = 0;
let gfbCdUpgrades    = 0;
let ueCdUpgrades     = 0;

function effectiveBasicCooldown() { return BASIC_COOLDOWN_MS * Math.pow(0.9, atkSpeedUpgrades); }
function effectiveGfbCooldown()   { return GFB_COOLDOWN_MS   * Math.pow(0.9, gfbCdUpgrades); }
function effectiveUeCooldown()    { return UE_COOLDOWN_MS    * Math.pow(0.9, ueCdUpgrades); }
const ATK_SPEED_COSTS = [1000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000];
const GFB_CD_COSTS    = [1000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000];
const UE_CD_COSTS     = [5000, 10000, 20000, 50000, 100000, 250000, 750000, 1000000, 2000000, 5000000];
function atkSpeedCost() { return ATK_SPEED_COSTS[atkSpeedUpgrades] ?? Infinity; }
function gfbCdCost()    { return GFB_CD_COSTS[gfbCdUpgrades]       ?? Infinity; }
function ueCdCost()     { return UE_CD_COSTS[ueCdUpgrades]         ?? Infinity; }
function fmtCost(n) {
    if (n >= 1e12) return (n/1e12).toFixed(0) + 'T';
    if (n >= 1e9)  return (n/1e9).toFixed(0)  + 'B';
    if (n >= 1e6)  return (n/1e6).toFixed(0)  + 'M';
    if (n >= 1e3)  return (n/1e3).toFixed(0)  + 'K';
    return n.toString();
}

// ── Progress save / load ─────────────────────────────────────────
function getProgress() {
    return {
        score, gold, exp, level, weaponIndex,
        atkSpeedUpgrades, gfbCdUpgrades, ueCdUpgrades,
        gfbUnlocked, ueUnlocked,
        autoUnlocked, autoEnabled,
        autoGfbUnlocked, autoGfbEnabled,
        autoUeUnlocked,  autoUeEnabled,
        bossFocusUnlocked,
        bossSpawnCounter,
        savedAt: Date.now(),
    };
}

function loadProgress(state) {
    if (!state) return;
    try {
        const s = typeof state === 'string' ? JSON.parse(state) : state;
        if (s.score            != null) score            = s.score;
        if (s.gold             != null) gold             = s.gold;
        if (s.exp              != null) exp              = s.exp;
        if (s.level            != null) level            = s.level;
        if (s.weaponIndex      != null) weaponIndex      = Math.min(s.weaponIndex, WEAPONS.length - 1);
        if (s.atkSpeedUpgrades != null) atkSpeedUpgrades = s.atkSpeedUpgrades;
        if (s.gfbCdUpgrades    != null) gfbCdUpgrades    = s.gfbCdUpgrades;
        if (s.ueCdUpgrades     != null) ueCdUpgrades     = s.ueCdUpgrades;
        if (s.gfbUnlocked      != null) gfbUnlocked      = s.gfbUnlocked;
        if (s.ueUnlocked       != null) ueUnlocked       = s.ueUnlocked;
        if (s.autoUnlocked     != null) autoUnlocked     = s.autoUnlocked;
        if (s.autoEnabled      != null) autoEnabled      = s.autoEnabled;
        if (s.autoGfbUnlocked  != null) autoGfbUnlocked  = s.autoGfbUnlocked;
        if (s.autoGfbEnabled   != null) autoGfbEnabled   = s.autoGfbEnabled;
        if (s.autoUeUnlocked   != null) autoUeUnlocked   = s.autoUeUnlocked;
        if (s.autoUeEnabled    != null) autoUeEnabled    = s.autoUeEnabled;
        if (s.bossFocusUnlocked!= null) bossFocusUnlocked= s.bossFocusUnlocked;
        if (s.bossSpawnCounter != null) bossSpawnCounter = s.bossSpawnCounter;
    } catch (_) {}
}

async function saveProgress() {
    if (!authToken) return;
    try {
        await fetch('/api/save', {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken,
            },
            body: JSON.stringify({ state: getProgress() }),
        });
    } catch (_) {}
}

// ── Offline progress simulation ─────────────────────────────────
function fmtDuration(sec) {
    if (sec >= 3600) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const m = Math.floor(sec / 60);
    return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`;
}

function simulateOffline(offlineSec, s) {
    const MAX_SEC = 8 * 3600; // cap at 8 hours
    const simSec  = Math.min(Math.max(0, Math.floor(offlineSec)), MAX_SEC);
    if (simSec < 5) return null;

    const anyAuto = s.autoEnabled ||
                    (s.autoGfbEnabled && s.gfbUnlocked) ||
                    (s.autoUeEnabled  && s.ueUnlocked);
    if (!anyAuto) return null;

    const wIdx       = Math.min(s.weaponIndex || 0, WEAPONS.length - 1);
    const lvlBon     = Math.floor((s.level || 1) / 5);
    const avgDmg     = (WEAPONS[wIdx].min + WEAPONS[wIdx].max) / 2 + lvlBon;
    const gfbCoolSec = Math.max(1, Math.floor(GFB_COOLDOWN_MS * Math.pow(0.9, s.gfbCdUpgrades || 0) / 1000));
    const ueCoolSec  = Math.max(1, Math.floor(UE_COOLDOWN_MS  * Math.pow(0.9, s.ueCdUpgrades  || 0) / 1000));

    let wormsOnField  = 5;
    let wormHp        = WORM_MAXHP;
    let bossAlive     = false;
    let bossCurrentHp = BOSS_HP;
    let killCounter   = s.bossSpawnCounter || 0;
    let gold          = s.gold || 0;
    let gfbCd         = 0;
    let ueCd          = 0;

    let gainKills     = 0;
    let gainBossKills = 0;
    let gainExp       = 0;
    let gainGold      = 0;

    const doKillWorm = () => {
        gainKills++;
        killCounter++;
        gainExp  += WORM_EXP;
        gainGold += 15; // avg (0+30)/2
        gold     += 15;
        if (!bossAlive && killCounter % BOSS_EVERY === 0) {
            bossAlive     = true;
            bossCurrentHp = BOSS_HP;
        }
    };

    const doKillBoss = () => {
        bossAlive      = false;
        gainBossKills++;
        gainExp  += BOSS_EXP;
        gainGold += BOSS_GOLD;
        gold     += BOSS_GOLD;
    };

    for (let t = 0; t < simSec; t++) {
        // Worm spawning: ~1/sec, capped at 10
        if (wormsOnField < 10 && !bossAlive) wormsOnField++;

        // Auto UE — clears all worms, boss immune
        if (s.autoUeEnabled && s.ueUnlocked) {
            if (ueCd <= 0) {
                ueCd = ueCoolSec;
                const n = wormsOnField;
                for (let i = 0; i < n; i++) doKillWorm();
                wormsOnField = 0;
                wormHp       = WORM_MAXHP;
            } else ueCd--;
        }

        // Auto GFB — clears all worms in radius (effectively all), costs gold
        if (s.autoGfbEnabled && s.gfbUnlocked) {
            if (gfbCd <= 0 && wormsOnField > 0 && gold >= GFB_GOLD_COST) {
                gfbCd     = gfbCoolSec;
                gold     -= GFB_GOLD_COST;
                gainGold -= GFB_GOLD_COST;
                const n = wormsOnField;
                for (let i = 0; i < n; i++) doKillWorm();
                wormsOnField = 0;
                wormHp       = WORM_MAXHP;
            } else if (gfbCd > 0) gfbCd--;
        }

        // Auto attack — 1 hit/sec
        if (s.autoEnabled) {
            if (bossAlive) {
                bossCurrentHp -= avgDmg;
                if (bossCurrentHp <= 0) doKillBoss();
            } else if (wormsOnField > 0) {
                wormHp -= avgDmg;
                if (wormHp <= 0) {
                    doKillWorm();
                    wormsOnField--;
                    wormHp = WORM_MAXHP;
                }
            }
        }
    }

    if (gainKills === 0 && gainBossKills === 0) return null;

    return {
        simSec,
        wormKills:         gainKills,
        bossKills:         gainBossKills,
        expGained:         gainExp,
        goldGained:        Math.max(0, gainGold),
        finalKillCounter:  killCounter,
    };
}

function applyOfflineGains(gains) {
    score            += gains.wormKills + gains.bossKills * BOSS_KILLS;
    exp              += gains.expGained;
    gold             += gains.goldGained;
    bossSpawnCounter  = gains.finalKillCounter;
    checkLevelUp();
}

function showOfflineSummary(gains, rawOfflineSec) {
    const capped  = gains.simSec < rawOfflineSec;
    const timeStr = fmtDuration(gains.simSec);
    const capNote = capped ? ` <em>(max 8h)</em>` : '';
    const wFmt    = gains.wormKills.toLocaleString();
    const eFmt    = gains.expGained.toLocaleString();
    const gFmt    = gains.goldGained.toLocaleString();
    const bossRow = gains.bossKills > 0
        ? `<div class="offline-stat"><span>Bosses killed</span><span class="offline-gold">+${gains.bossKills}</span></div>`
        : '';
    document.getElementById('offline-content').innerHTML = `
        <p class="offline-time">Away for <strong>${timeStr}</strong>${capNote}</p>
        <div class="offline-stat"><span>Rotworms killed</span><span>+${wFmt}</span></div>
        ${bossRow}
        <div class="offline-stat"><span>EXP gained</span><span class="offline-exp">+${eFmt}</span></div>
        <div class="offline-stat"><span>Gold gained</span><span class="offline-gold">+${gFmt}</span></div>
    `;
    document.getElementById('offline-modal').style.display = 'flex';
}

// ── Scoreboard ───────────────────────────────────────────────────
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchScoreboard() {
    try {
        const res  = await fetch('/api/scoreboard', {
            headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {},
        });
        const data = await res.json();
        const el   = document.getElementById('scoreboard-list');
        if (!el || !Array.isArray(data.players)) return;
        el.innerHTML = '';
        data.players.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'sb-row' + (p.username === authUsername ? ' sb-me' : '');
            row.innerHTML =
                `<span class="sb-rank">#${i + 1}</span>` +
                `<span class="sb-name">${escHtml(p.username)}</span>` +
                `<span class="sb-score">${p.score}</span>` +
                `<span class="sb-level">lv${p.level}</span>`;
            el.appendChild(row);
        });
        if (data.me) {
            const sep = document.createElement('div');
            sep.className = 'sb-row sb-sep';
            sep.innerHTML = `<span style="grid-column:1/-1;text-align:center">···</span>`;
            el.appendChild(sep);
            const row = document.createElement('div');
            row.className = 'sb-row sb-me';
            row.innerHTML =
                `<span class="sb-rank">#${data.me.rank}</span>` +
                `<span class="sb-name">${escHtml(data.me.username)}</span>` +
                `<span class="sb-score">${data.me.score}</span>` +
                `<span class="sb-level">lv${data.me.level}</span>`;
            el.appendChild(row);
        }
    } catch (_) {}
}

// ── Auth flow ────────────────────────────────────────────────────
function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('auth-login-form').style.display = isLogin ? '' : 'none';
    document.getElementById('auth-reg-form').style.display   = isLogin ? 'none' : '';
    document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
    document.getElementById('tab-reg-btn').classList.toggle('active', !isLogin);
}

function startGame(stateRaw) {
    let parsedState = null;
    if (stateRaw) {
        try { parsedState = typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw; }
        catch (_) {}
    }
    loadProgress(parsedState);

    // Offline progress
    if (parsedState && parsedState.savedAt) {
        const offlineSec = Math.max(0, Math.floor((Date.now() - parsedState.savedAt) / 1000));
        const gains = simulateOffline(offlineSec, parsedState);
        if (gains) {
            applyOfflineGains(gains);
            showOfflineSummary(gains, offlineSec);
            saveProgress(); // persist the applied gains immediately
        }
    }

    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('hud-player').textContent = guestMode ? 'Guest' : authUsername;
    document.getElementById('logoutBtn').textContent = guestMode ? 'Exit' : 'Logout';
    if (!gameStarted) {
        gameStarted = true;
        loop();
        _saveTimer = setInterval(saveProgress, 30000);
        _sbTimer   = setInterval(fetchScoreboard, 60000);
        fetchScoreboard();
    }
}

async function doLogout() {
    if (guestMode) { location.reload(); return; }
    await saveProgress();
    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + authToken },
        });
    } catch (_) {}
    clearInterval(_saveTimer);
    clearInterval(_sbTimer);
    localStorage.removeItem('rk_token');
    localStorage.removeItem('rk_username');
    location.reload();
}

async function initAuth() {
    ctx.fillStyle = '#0d0900';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 26px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Rotworm Killer', canvas.width / 2, canvas.height / 2 - 16);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = '#8a7040';
    ctx.fillText('Log in to hunt rotworms.', canvas.width / 2, canvas.height / 2 + 14);
    ctx.textAlign = 'left';

    if (authToken) {
        try {
            const res = await fetch('/api/me', {
                headers: { 'Authorization': 'Bearer ' + authToken },
            });
            if (res.ok) {
                const data = await res.json();
                authUsername = data.player.username;
                localStorage.setItem('rk_username', authUsername);
                startGame(data.player.state);
                return;
            }
        } catch (_) {}
        authToken = null;
        localStorage.removeItem('rk_token');
        localStorage.removeItem('rk_username');
    }
    document.getElementById('login-modal').style.display = 'flex';
}

window.addEventListener('beforeunload', () => { saveProgress(); });

function spawnEffect(x, y, radius) {
    const tileSize = 100; // native gif size
    const rect = canvas.getBoundingClientRect();
    const baseX = rect.left + x;
    const baseY = rect.top + y;
    for (let tx = -radius; tx < radius; tx += tileSize) {
        for (let ty = -radius; ty < radius; ty += tileSize) {
            const cx = tx + tileSize / 2;
            const cy = ty + tileSize / 2;
            // only spawn tile if its center is within the radius
            if (Math.hypot(cx, cy) <= radius) {
                const img = document.createElement('img');
                img.src = 'Fireball_Effect.gif';
                img.className = 'effect';
                img.style.left = (baseX + tx) + 'px';
                img.style.top  = (baseY + ty) + 'px';
                document.body.appendChild(img);
                setTimeout(() => img.remove(), 1000);
            }
        }
    }
}

function spawnUltimateExplosion() {
    const tileSize = 32; // native size of Explosion_Effect.gif
    const rect = canvas.getBoundingClientRect();
    for (let tx = 0; tx < canvas.width; tx += tileSize) {
        for (let ty = 0; ty < canvas.height; ty += tileSize) {
            const img = document.createElement('img');
            img.src = 'Explosion_Effect.gif';
            img.className = 'effect';
            img.style.left = (rect.left + tx) + 'px';
            img.style.top  = (rect.top  + ty) + 'px';
            img.style.width  = tileSize + 'px';
            img.style.height = tileSize + 'px';
            document.body.appendChild(img);
            setTimeout(() => img.remove(), 1200);
        }
    }
}

function spawnAttackEffect(x, y) {
    const size = 32;
    const rect = canvas.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = 'Attack_Effect_(Red).gif';
    img.className = 'effect';
    img.style.left = (rect.left + x - size / 2) + 'px';
    img.style.top  = (rect.top  + y - size / 2) + 'px';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 800);
}

function spawnWorm() {
    if (worms.length >= 10) return; // cap at 10 worms
    const size = 20;
    const margin = size + 8; // keep worm fully inside the canvas
    worms.push({
        x: margin + Math.random() * (canvas.width  - margin * 2),
        y: margin + Math.random() * (canvas.height - margin * 2),
        size,
        hp: WORM_MAXHP
    });
}

function spawnBoss() {
    if (boss) return;
    const margin = BOSS_SIZE + 8;
    boss = {
        x: margin + Math.random() * (canvas.width  - margin * 2),
        y: margin + Math.random() * (canvas.height - margin * 2),
        size: BOSS_SIZE,
        hp: BOSS_HP,
        maxHp: BOSS_HP,
    };
}

function killWorm(w) {
    score++;
    exp += WORM_EXP;
    checkLevelUp();
    gold += Math.floor(Math.random() * 31);
    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 18, value: WORM_EXP, color: 'white', life: 80 });
    bossSpawnCounter++;
    if (bossSpawnCounter % BOSS_EVERY === 0) spawnBoss();
}

function killBoss(b) {
    score += BOSS_KILLS;
    exp   += BOSS_EXP;
    checkLevelUp();
    gold  += BOSS_GOLD;
    dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 18, value: BOSS_EXP, color: '#ffd700', life: 100 });
    boss = null;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw tiled muddy floor
    if (floorImg.complete && floorImg.naturalWidth > 0) {
        for (let row = 0; row < TILE_ROWS; row++) {
            for (let col = 0; col < TILE_COLS; col++) {
                const tx = col * TILE;
                const ty = row * TILE;
                const { flipH, flipV } = floorMap[row][col];
                ctx.save();
                ctx.translate(tx, ty);
                if (flipH) { ctx.translate(TILE, 0); ctx.scale(-1, 1); }
                if (flipV) { ctx.translate(0, TILE); ctx.scale(1, -1); }
                ctx.drawImage(floorImg, 0, 0, TILE, TILE);
                ctx.restore();
            }
        }
    }
    worms.forEach(w => {
        if (rotwormImg.complete) {
            ctx.drawImage(rotwormImg, w.x - w.size, w.y - w.size, w.size * 2, w.size * 2);
        } else {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
            ctx.fill();
        }
        // draw health bar above worm
        const barW = w.size * 2;
        const barH = 4;
        const barX = w.x - w.size;
        const barY = w.y - w.size - 8;
        ctx.fillStyle = '#600';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(barX, barY, barW * (w.hp / WORM_MAXHP), barH);
    });
    // draw boss
    if (boss) {
        if (versperothImg.complete) {
            ctx.drawImage(versperothImg, boss.x - boss.size, boss.y - boss.size, boss.size * 2, boss.size * 2);
        } else {
            ctx.fillStyle = '#c00';
            ctx.beginPath();
            ctx.arc(boss.x, boss.y, boss.size, 0, Math.PI * 2);
            ctx.fill();
        }
        // boss HP bar (wider, red/orange)
        const bBarW = boss.size * 2;
        const bBarH = 6;
        const bBarX = boss.x - boss.size;
        const bBarY = boss.y - boss.size - 10;
        ctx.fillStyle = '#600';
        ctx.fillRect(bBarX, bBarY, bBarW, bBarH);
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(bBarX, bBarY, bBarW * (boss.hp / boss.maxHp), bBarH);
        // boss label
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.fillText('BOSS', boss.x - 14, boss.y - boss.size - 13);
    }
    // highlight auto-attack target
    if (autoEnabled && autoTarget && worms.includes(autoTarget)) {
        ctx.save();
        ctx.strokeStyle = '#dd88ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(autoTarget.x, autoTarget.y, autoTarget.size + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    // level-up message (canvas only)
    if (levelUpMsg > 0) {
        ctx.globalAlpha = Math.min(levelUpMsg / 30, 1);
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 32px Verdana, sans-serif';
        ctx.fillText(`LEVEL UP! (${level})`, canvas.width / 2 - 100, canvas.height / 2);
        ctx.globalAlpha = 1;
    }
    // draw floating damage numbers
    dmgNumbers.forEach(d => {
        ctx.globalAlpha = d.life / 60;
        ctx.fillStyle = d.color;
        ctx.font = 'bold 12px Verdana, sans-serif';
        ctx.fillText(d.value, d.x, d.y);
    });
    ctx.globalAlpha = 1;
    updateHUD();
}

canvas.addEventListener('click', e => {
    const now = Date.now();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (fireballActive) {
        // area of effect kill
        const radius = 200; // doubled size
        spawnEffect(mx, my, radius);
        fireballActive = false;
        spawnPaused = true;
        document.getElementById('fireballBtn').disabled = false;
        // delay worm removal until fireball animation completes
        setTimeout(() => {
            worms = worms.filter(w => {
                const dx = w.x - mx;
                const dy = w.y - my;
                if (Math.hypot(dx, dy) < radius) {
                    const dmg = WORM_MAXHP;
                    w.hp -= dmg;
                    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: dmg, color: 'orange', life: 60 });
                    if (w.hp <= 0) {
                        killWorm(w);
                        return false;
                    }
                }
                return true;
            });
            // GFB also damages boss (but does not one-shot)
            if (boss) {
                const dx = boss.x - mx, dy = boss.y - my;
                if (Math.hypot(dx, dy) < radius) {
                    const dmg = WORM_MAXHP;
                    boss.hp -= dmg;
                    dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#ff6600', life: 60 });
                    if (boss.hp <= 0) killBoss(boss);
                }
            }
            spawnPaused = false;
        }, 300);
        return;
    }
    // basic attack cooldown check
    if (now - lastBasicAttack < effectiveBasicCooldown()) return;
    // check boss click first
    if (boss) {
        const dx = boss.x - mx, dy = boss.y - my;
        if (Math.hypot(dx, dy) < boss.size) {
            lastBasicAttack = now;
            const dmg = rollBasicDmg();
            boss.hp -= dmg;
            spawnAttackEffect(boss.x, boss.y);
            dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#ff6600', life: 60 });
            if (boss.hp <= 0) killBoss(boss);
            return;
        }
    }
    worms = worms.filter(w => {
        const dx = w.x - mx;
        const dy = w.y - my;
        if (Math.hypot(dx, dy) < w.size) {
            lastBasicAttack = now;
            const dmg = rollBasicDmg();
            w.hp -= dmg;
            spawnAttackEffect(w.x, w.y);
            dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: dmg, color: 'red', life: 60 });
            if (w.hp <= 0) {
                killWorm(w);
                return false;
            }
        }
        return true;
    });
});

function update() {
    if (!spawnPaused && Math.random() < 0.02) spawnWorm();
    // auto attack logic — merged worm + boss targeting
    if (autoEnabled) {
        const now = Date.now();
        if (now - lastAutoAttack >= AUTO_COOLDOWN_MS) {
            if (bossFocusUnlocked && boss) {
                // boss focus: always hit boss first when alive
                lastAutoAttack = now;
                const dmg = rollBasicDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#ff6600', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            } else if (worms.length > 0) {
                lastAutoAttack = now;
                if (!autoTarget || !worms.includes(autoTarget)) autoTarget = worms[0];
                if (autoTarget) {
                    const dmg = rollBasicDmg();
                    autoTarget.hp -= dmg;
                    spawnAttackEffect(autoTarget.x, autoTarget.y);
                    dmgNumbers.push({ x: autoTarget.x + (Math.random()*20-10), y: autoTarget.y - autoTarget.size, value: dmg, color: '#dd88ff', life: 60 });
                    if (autoTarget.hp <= 0) {
                        killWorm(autoTarget);
                        worms = worms.filter(w => w !== autoTarget);
                        autoTarget = worms.length > 0 ? worms[0] : null;
                    }
                }
            } else if (boss) {
                // no worms — attack boss even without boss focus
                lastAutoAttack = now;
                const dmg = rollBasicDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#ff6600', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            }
        }
    }
    // auto GFB logic — cluster targeting, also hits boss
    if (autoGfbEnabled && gfbUnlocked && (worms.length > 0 || boss) && !fireballActive && !spawnPaused &&
            Date.now() >= gfbCooldownEnd && gold >= GFB_GOLD_COST) {
        const radius = 200;
        // pick best cluster center (among worms + boss)
        const candidates = [...worms, ...(boss ? [boss] : [])];
        let t = candidates[0], bestCount = 0;
        for (const c of candidates) {
            const cnt = candidates.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < radius).length;
            if (cnt > bestCount) { bestCount = cnt; t = c; }
        }
        gold -= GFB_GOLD_COST;
        gfbCooldownEnd = Date.now() + effectiveGfbCooldown();
        spawnEffect(t.x, t.y, radius);
        spawnPaused = true;
        const fx = t.x, fy = t.y;
        setTimeout(() => {
            worms = worms.filter(w => {
                const dx = w.x - fx, dy = w.y - fy;
                if (Math.hypot(dx, dy) < radius) {
                    const dmg = WORM_MAXHP;
                    w.hp -= dmg;
                    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: dmg, color: 'orange', life: 60 });
                    if (w.hp <= 0) { killWorm(w); return false; }
                }
                return true;
            });
            if (boss) {
                const dx = boss.x - fx, dy = boss.y - fy;
                if (Math.hypot(dx, dy) < radius) {
                    boss.hp -= WORM_MAXHP;
                    dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: WORM_MAXHP, color: '#ff6600', life: 60 });
                    if (boss.hp <= 0) killBoss(boss);
                }
            }
            spawnPaused = false;
        }, 300);
    }
    // auto UE logic — fires whenever off cooldown, boss immune
    if (autoUeEnabled && ueUnlocked && !spawnPaused && Date.now() >= ueCooldownEnd) {
        spawnUltimateExplosion();
        ueCooldownEnd = Date.now() + effectiveUeCooldown();
        spawnPaused = true;
        setTimeout(() => {
            worms = worms.filter(w => {
                killWorm(w);
                return false;
            });
            // boss is intentionally NOT affected
            spawnPaused = false;
        }, 900);
    }
    // float damage numbers upward and expire
    dmgNumbers.forEach(d => { d.y -= 1; d.life--; });
    dmgNumbers = dmgNumbers.filter(d => d.life > 0);
    if (levelUpMsg > 0) levelUpMsg--;
    // update UE button
    const ueRemaining = Math.max(0, ueCooldownEnd - Date.now());
    const ueBtn = document.getElementById('ultimateExplosionBtn');
    const ueIcon = `<img src="Ultimate_Explosion.gif" class="btn-icon">`;
    if (!ueUnlocked) {
        ueBtn.innerHTML = level < UE_UNLOCK_LEVEL
            ? `${ueIcon} Ultimate Explosion (need lvl ${UE_UNLOCK_LEVEL})`
            : gold < UE_UNLOCK_GOLD
                ? `${ueIcon} Unlock Ult. Explosion (need ${UE_UNLOCK_GOLD}g)`
                : `${ueIcon} Unlock Ult. Explosion (${UE_UNLOCK_GOLD}g)`;
        ueBtn.disabled = level < UE_UNLOCK_LEVEL || gold < UE_UNLOCK_GOLD;
    } else if (ueRemaining > 0) {
        ueBtn.innerHTML = `${ueIcon} Ultimate Explosion (${(ueRemaining / 1000).toFixed(1)}s)`;
        ueBtn.disabled = true;
    } else {
        ueBtn.innerHTML = `${ueIcon} Ultimate Explosion`;
        ueBtn.disabled = false;
    }
    document.getElementById('cd-ue-bar').style.width  = ueUnlocked && ueRemaining > 0 ? ((1 - ueRemaining / effectiveUeCooldown()) * 100) + '%' : (ueUnlocked ? '100%' : '0%');
    document.getElementById('cd-ue-text').textContent = !ueUnlocked ? 'Locked' : (ueRemaining > 0 ? (ueRemaining / 1000).toFixed(1) + 's' : 'Ready');
    // update GFB button cooldown label
    const remaining = Math.max(0, gfbCooldownEnd - Date.now());
    if (remaining > 0) {
        fireBtn.innerHTML = `<img src="Great_Fireball_Rune.gif" class="btn-icon"> Great Fireball (${(remaining / 1000).toFixed(1)}s)`;
        fireBtn.disabled = true;
    } else if (!fireballActive) {
        const icon = `<img src="Great_Fireball_Rune.gif" class="btn-icon">`;
        if (!gfbUnlocked) {
            if (level < GFB_UNLOCK_LEVEL) {
                fireBtn.innerHTML = `${icon} Great Fireball (need lvl ${GFB_UNLOCK_LEVEL})`;
            } else if (gold < GFB_UNLOCK_GOLD) {
                fireBtn.innerHTML = `${icon} Unlock GFB (need ${GFB_UNLOCK_GOLD}g)`;
            } else {
                fireBtn.innerHTML = `${icon} Unlock GFB (${GFB_UNLOCK_GOLD}g)`;
            }
            fireBtn.disabled = (level < GFB_UNLOCK_LEVEL || gold < GFB_UNLOCK_GOLD);
        } else {
            fireBtn.innerHTML = gold >= GFB_GOLD_COST
                ? `${icon} Great Fireball`
                : `${icon} Great Fireball (need ${GFB_GOLD_COST}g)`;
            fireBtn.disabled = false;
        }
    }
    // cooldown bars
    const basicElapsed = Date.now() - lastBasicAttack;
    const basicFrac = Math.min(basicElapsed / effectiveBasicCooldown(), 1);
    document.getElementById('cd-basic-bar').style.width  = (basicFrac * 100) + '%';
    document.getElementById('cd-basic-text').textContent = basicFrac >= 1 ? 'Ready' : (((effectiveBasicCooldown() - basicElapsed) / 1000).toFixed(1) + 's');

    const fireFrac = remaining > 0 ? (1 - remaining / effectiveGfbCooldown()) : 1;
    document.getElementById('cd-fire-bar').style.width  = gfbUnlocked ? (fireFrac * 100) + '%' : '0%';
    document.getElementById('cd-fire-text').textContent = !gfbUnlocked ? 'Locked' : (remaining > 0 ? ((remaining / 1000).toFixed(1) + 's') : 'Ready');
}

// fireball button logic
const fireBtn = document.getElementById('fireballBtn');
fireBtn.innerHTML = `<img src="Great_Fireball_Rune.gif" class="btn-icon"> Great Fireball (need lvl ${GFB_UNLOCK_LEVEL})`;
fireBtn.disabled = true;
fireBtn.addEventListener('click', () => {
    // one-time unlock purchase
    if (!gfbUnlocked) {
        if (level < GFB_UNLOCK_LEVEL || gold < GFB_UNLOCK_GOLD) return;
        gold -= GFB_UNLOCK_GOLD;
        gfbUnlocked = true;
        return;
    }
    if (Date.now() < gfbCooldownEnd) return; // still on cooldown
    if (gold < GFB_GOLD_COST) {
        // flash button red briefly to indicate not enough gold
        fireBtn.style.background = '#800';
        setTimeout(() => { fireBtn.style.background = ''; }, 400);
        return;
    }
    gold -= GFB_GOLD_COST;
    gfbCooldownEnd = Date.now() + effectiveGfbCooldown();
    fireballActive = true;
    fireBtn.disabled = true;
});

// weapon upgrade button
const weaponUpgradeBtn = document.getElementById('weaponUpgradeBtn');
weaponUpgradeBtn.addEventListener('click', () => {
    const next = WEAPONS[weaponIndex + 1];
    if (!next || gold < next.cost) return;
    gold -= next.cost;
    weaponIndex++;
});

// ultimate explosion button
const ueBtn = document.getElementById('ultimateExplosionBtn');
ueBtn.addEventListener('click', () => {
    if (!ueUnlocked) {
        if (level < UE_UNLOCK_LEVEL || gold < UE_UNLOCK_GOLD) return;
        gold -= UE_UNLOCK_GOLD;
        ueUnlocked = true;
        return;
    }
    if (Date.now() < ueCooldownEnd) return;
    spawnUltimateExplosion();
    ueCooldownEnd = Date.now() + effectiveUeCooldown();
    spawnPaused = true;
    setTimeout(() => {
        worms = worms.filter(w => {
            killWorm(w);
            return false;
        });
        // boss is immune to UE
        spawnPaused = false;
    }, 900);
});

// auto attack button
document.getElementById('autoAttackBtn').addEventListener('click', () => {
    if (!autoUnlocked) {
        if (level < AUTO_UNLOCK_LEVEL || gold < AUTO_UNLOCK_GOLD) return;
        gold -= AUTO_UNLOCK_GOLD;
        autoUnlocked = true;
        autoEnabled = true;
        autoTarget = worms.length > 0 ? worms[0] : null;
        return;
    }
    autoEnabled = !autoEnabled;
    if (!autoEnabled) autoTarget = null;
});

// auto GFB button
document.getElementById('autoGfbBtn').addEventListener('click', () => {
    if (!autoGfbUnlocked) {
        if (!gfbUnlocked || level < AUTO_GFB_UNLOCK_LEVEL || gold < AUTO_GFB_UNLOCK_GOLD) return;
        gold -= AUTO_GFB_UNLOCK_GOLD;
        autoGfbUnlocked = true;
        autoGfbEnabled = true;
        return;
    }
    autoGfbEnabled = !autoGfbEnabled;
});

// auto UE button
document.getElementById('autoUeBtn').addEventListener('click', () => {
    if (!autoUeUnlocked) {
        if (!ueUnlocked || level < AUTO_UE_UNLOCK_LEVEL || gold < AUTO_UE_UNLOCK_GOLD) return;
        gold -= AUTO_UE_UNLOCK_GOLD;
        autoUeUnlocked = true;
        autoUeEnabled = true;
        return;
    }
    autoUeEnabled = !autoUeEnabled;
});

// boss focus button
document.getElementById('bossFocusBtn').addEventListener('click', () => {
    if (bossFocusUnlocked) return;
    if (!autoUnlocked || level < BOSS_FOCUS_UNLOCK_LEVEL || gold < BOSS_FOCUS_UNLOCK_GOLD) return;
    gold -= BOSS_FOCUS_UNLOCK_GOLD;
    bossFocusUnlocked = true;
});

// upgrade button listeners
document.getElementById('upgradeAtkSpeedBtn').addEventListener('click', () => {
    if (atkSpeedUpgrades >= MAX_UPGRADES) return;
    const cost = atkSpeedCost();
    if (gold < cost) return;
    gold -= cost;
    atkSpeedUpgrades++;
});
document.getElementById('upgradeGfbCdBtn').addEventListener('click', () => {
    if (gfbCdUpgrades >= MAX_UPGRADES) return;
    const cost = gfbCdCost();
    if (gold < cost) return;
    gold -= cost;
    gfbCdUpgrades++;
});
document.getElementById('upgradeUeCdBtn').addEventListener('click', () => {
    if (ueCdUpgrades >= MAX_UPGRADES) return;
    const cost = ueCdCost();
    if (gold < cost) return;
    gold -= cost;
    ueCdUpgrades++;
});

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ── Auth form handlers ────────────────────────────────────────────
document.getElementById('auth-login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('auth-login-user').value.trim();
    const password = document.getElementById('auth-login-pass').value;
    const errEl    = document.getElementById('auth-login-err');
    const btn      = e.currentTarget.querySelector('button[type=submit]');
    errEl.textContent = '';
    btn.disabled = true;
    try {
        const res  = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.error) { errEl.textContent = data.error; btn.disabled = false; return; }
        authToken    = data.token;
        authUsername = data.player.username;
        localStorage.setItem('rk_token',    authToken);
        localStorage.setItem('rk_username', authUsername);
        startGame(data.player.state);
    } catch (_) {
        errEl.textContent = 'Connection error.';
        btn.disabled = false;
    }
});

document.getElementById('auth-reg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('auth-reg-user').value.trim();
    const password = document.getElementById('auth-reg-pass').value;
    const errEl    = document.getElementById('auth-reg-err');
    const btn      = e.currentTarget.querySelector('button[type=submit]');
    errEl.textContent = '';
    btn.disabled = true;
    try {
        const res  = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.error) { errEl.textContent = data.error; btn.disabled = false; return; }
        authToken    = data.token;
        authUsername = data.player.username;
        localStorage.setItem('rk_token',    authToken);
        localStorage.setItem('rk_username', authUsername);
        startGame(data.player.state);
    } catch (_) {
        errEl.textContent = 'Connection error.';
        btn.disabled = false;
    }
});

document.getElementById('logoutBtn').addEventListener('click', doLogout);

document.getElementById('guestBtn').addEventListener('click', () => {
    guestMode = true;
    startGame(null);
});

initAuth();