// simple rotworm killer game stub
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Monster sprites are managed as DOM <img> elements in #sprite-layer (canvas drawImage never animates GIFs)
let _eid = 0; // entity ID counter
const _sprites = new Map(); // eid -> <img> element

function syncSpriteLayer() {
    const layer = document.getElementById('sprite-layer');
    if (!layer) return;
    const activeIds = new Set();
    const area = getCurrentArea();

    worms.forEach(w => {
        activeIds.add(w._id);
        let img = _sprites.get(w._id);
        if (!img) {
            img = document.createElement('img');
            img.style.cssText = 'position:absolute;pointer-events:none;image-rendering:pixelated;';
            layer.appendChild(img);
            _sprites.set(w._id, img);
        }
        const src = area.mobSprite;
        if (!img.getAttribute('data-src') || img.getAttribute('data-src') !== src) {
            img.src = src;
            img.setAttribute('data-src', src);
        }
        img.style.left   = (w.x - w.size) + 'px';
        img.style.top    = (w.y - w.size) + 'px';
        img.style.width  = (w.size * 2) + 'px';
        img.style.height = (w.size * 2) + 'px';
    });

    if (boss) {
        activeIds.add(boss._id);
        let img = _sprites.get(boss._id);
        if (!img) {
            img = document.createElement('img');
            img.src = (area.bossSprite || 'Versperoth.gif');
            img.style.cssText = 'position:absolute;pointer-events:none;image-rendering:pixelated;';
            layer.appendChild(img);
            _sprites.set(boss._id, img);
        }
        img.style.left   = (boss.x - boss.size) + 'px';
        img.style.top    = (boss.y - boss.size) + 'px';
        img.style.width  = (boss.size * 2) + 'px';
        img.style.height = (boss.size * 2) + 'px';
    }

    for (const [id, img] of _sprites) {
        if (!activeIds.has(id)) {
            img.remove();
            _sprites.delete(id);
        }
    }
}


const BOSS_EVERY     = 50;   // spawn a boss every N worm kills
const BOSS_HP        = 1000;
const BOSS_EXP       = 600;
const BOSS_GOLD      = 1000;
const BOSS_KILLS     = 10;   // counts as this many kills
const BOSS_SIZE      = 64;   // half-width for hitbox/draw (128px sprite)
const UBER_BOSS_EVERY = 10;  // spawn an uber boss every N boss kills

// Scaling
const MONSTER_SCALE = 2;  // enlarge monsters by this factor
let bossSpawnCounter = 0;    // increments with every worm/boss kill
let bossKillCounter  = 0;    // increments with every boss kill; uber spawns every UBER_BOSS_EVERY
// boss spawning is handled by bossSpawnCounter + skillBossInterval()
let firstBossSpawned = false; // (legacy) no longer used

// ── Area progression ───────────────────────────────────────────────
const AREAS = [
    {
        id: 'Rookgaard',
        name: 'Rookgaard',
        levelReq: 1,
        goldCost: 0,
        floor: 'Lush_Grass.gif',
        mobName: 'Rat',
        mobSprite: 'Rat.gif',
        mobHp: 15,
        mobExp: 10,
        mobGoldMin: 2,
        mobGoldMax: 4,
        mobSize: 28,
        bossName: 'Cave Rat',
        bossSprite: 'Cave_Rat.gif',
        hpBarOffset: 6,
    },
    {
        id: 'Rotworm Cave',
        name: 'Rotworm Cave',
        levelReq: 8,
        goldCost: 100,
        floor: 'Muddy_Floor_(Dark).gif',
        mobName: 'Rotworm',
        mobSprite: 'Rotworm.gif',
        mobHp: 60,
        mobExp: 40,
        mobGoldMin: 5,
        mobGoldMax: 15,
        mobSize: 30,
        bossName: 'Vesperoth',
        bossSprite: 'Vesperoth.gif',
    },
    {
        id: 'Cyclopolis',
        name: 'Cyclopolis',
        levelReq: 30,
        goldCost: 5000,
        floor: 'Gravel.gif',
        mobName: 'Cyclops',
        mobSprite: 'Cyclops.gif',
        mobHp: 260,
        mobExp: 150,
        mobGoldMin: 10,
        mobGoldMax: 30,
        mobSize: 52,
        bossName: 'Behemoth',
        bossSprite: 'Behemoth.gif',
    },
    {
        id: 'Hell Gate',
        name: 'Hell Gate',
        levelReq: 50,
        goldCost: 50000,
        floor: 'Stone_Floor_(Grey).gif',
        mobName: 'Demon Skeleton',
        mobSprite: 'Demon_Skeleton.gif',
        mobHp: 400,
        mobExp: 240,
        mobGoldMin: 20,
        mobGoldMax: 50,
        mobSize: 58,
        hpBarOffset: 18,
        bossName: 'Bonebeast',
        bossSprite: 'Bonebeast.gif',
    },
    {
        id: 'Dragon Lair',
        name: 'Dragon Lair',
        levelReq: 70,
        goldCost: 100000,
        floor: 'Earth_Ground.gif',
        mobName: 'Dragon',
        mobSprite: 'Dragon.gif',
        mobHp: 1000,
        mobExp: 700,
        mobGoldMin: 30,
        mobGoldMax: 60,
        mobSize: 64,
        bossName: 'Dragon Lord',
        bossSprite: 'Dragon_Lord.gif',
    },
    {
        id: 'Plains of Havoc',
        name: 'Plains of Havoc',
        levelReq: 100,
        goldCost: 200000,
        floor: 'Grass_(Tile).gif',
        mobName: 'Giant Spider',
        mobSprite: 'Giant_Spider.gif',
        mobHp: 1300,
        mobExp: 900,
        mobGoldMin: 40,
        mobGoldMax: 80,
        bossName: 'Mamma Long Legs',
        bossSprite: 'Unwanted.gif',
    },
    {
        id: 'Demona',
        name: 'Demona',
        levelReq: 130,
        goldCost: 1000000,
        floor: 'Black_Marble_Floor.gif',
        mobName: 'Warlock',
        mobSprite: 'Warlock.gif',
        mobHp: 4000,
        mobExp: 3000,
        mobGoldMin: 50,
        mobGoldMax: 100,
        bossName: 'Infernalist',
        bossSprite: 'Infernalist.gif',
    },
    {
        id: 'Goroma',
        name: 'Goroma',
        levelReq: 175,
        goldCost: 5000000,
        floor: 'Strange_Sand.gif',
        mobName: 'Demon',
        mobSprite: 'Demon.gif',
        mobHp: 8000,
        mobExp: 6000,
        mobGoldMin: 75,
        mobGoldMax: 125,
        bossName: 'Weakened Demon',
        bossSprite: 'Weakened_Demon.gif',
    },
    {
        id: 'Formogar Mines',
        name: 'Formogar Mines',
        levelReq: 200,
        goldCost: 10000000,
        floor: 'Ice_Stone_Floor.gif',
        mobName: 'Juggernaut',
        mobSprite: 'Juggernaut.gif',
        mobHp: 12000,
        mobExp: 9000,
        mobGoldMin: 100,
        mobGoldMax: 150,
        bossName: 'Arbaziloth',
        bossSprite: 'Arbaziloth.gif',
    },
    {
        id: 'Roshamuul',
        name: 'Roshamuul',
        levelReq: 250,
        goldCost: 50000000,
        floor: 'Dry_Earth_(Zao).gif',
        mobName: 'Guzzlemaw',
        mobSprite: 'Guzzlemaw.gif',
        mobHp: 18000,
        mobExp: 14000,
        mobGoldMin: 200,
        mobGoldMax: 300,
        bossName: 'Sight of Surrender',
        bossSprite: 'Sight_of_Surrender.gif',
    },
    {
        id: 'The Void',
        name: 'The Void',
        levelReq: 300,
        goldCost: 100000000,
        floor: 'Void_(Tile).gif',
        mobName: 'Void Emissary',
        mobSprite: 'The_Unarmored_Voidborn.gif',
        mobHp: 30000,
        mobExp: 20000,
        mobGoldMin: 300,
        mobGoldMax: 500,
        bossName: 'Devovorga',
        bossSprite: 'Devovorga.gif',
    },
];
let currentArea = 'Rookgaard';
let unlockedAreas = ['Rookgaard'];

function getAreaById(id) {
    return AREAS.find(a => a.id === id) || AREAS[0];
}

function getCurrentArea() {
    return getAreaById(currentArea);
}

function getNextArea() {
    const idx = AREAS.findIndex(a => a.id === currentArea);
    if (idx < 0 || idx + 1 >= AREAS.length) return null;
    return AREAS[idx + 1];
}

function canUnlockNextArea() {
    const next = getNextArea();
    if (!next) return false;
    return level >= next.levelReq && gold >= next.goldCost;
}

// ── Auth & persistence ───────────────────────────────────────────
let authToken    = localStorage.getItem('rk_token');
let authUsername = localStorage.getItem('rk_username');
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
let ascendMsg  = 0; // timer for ascension flash

const stoneFloorImg = new Image();
stoneFloorImg.src = 'Gravel.gif';

// ── Ascension ────────────────────────────────────────────────────────────────
const ASCEND_LEVEL = 30;
let ascended      = false;
let ascendedClass = null; // 'knight' | 'sorcerer'

// mob stats — updated by ascend()
let MOB_MAXHP  = 65;
let MOB_EXP    = 40;
let MOB_KILLS  = 1;   // score contribution per kill
let MOB_GOLD_MIN = 0;
let MOB_GOLD_MAX = 39; // random gold [MOB_GOLD_MIN, MOB_GOLD_MAX]
let MOB_SIZE   = 20 * MONSTER_SCALE;

function applyMobConfig() {
    const area = getCurrentArea();
    MOB_MAXHP  = area.mobHp;
    MOB_EXP    = area.mobExp;
    MOB_KILLS  = 1; // per-kill score multiplier
    MOB_GOLD_MIN = area.mobGoldMin;
    MOB_GOLD_MAX = area.mobGoldMax;
    MOB_SIZE   = (area.mobSize || 20) * MONSTER_SCALE;
    floorImg.src = area.floor;

    // Ascension gives a class bonus (skills, etc.) but does not change area.
    if (ascended) {
        // Small buff vs. pre-ascension stats
        MOB_MAXHP  = Math.floor(MOB_MAXHP * 1.2);
        MOB_EXP    = Math.floor(MOB_EXP * 1.2);
        MOB_GOLD_MAX = Math.floor(MOB_GOLD_MAX * 1.2);
    }
}


function openAscendModal() {
    if (ascended || level < ASCEND_LEVEL) return;
    document.getElementById('class-modal').style.display = 'flex';
}

function doAscendAsClass(cls) {
    if (ascended) return;
    ascendedClass = cls;
    ascended = true;
    worms    = [];
    boss     = null;
    bossSpawnCounter = 0;
    bossKillCounter  = 0;
    ascendMsg = 240; // ~4s at 60fps
    applyMobConfig();
    document.getElementById('class-modal').style.display = 'none';
    // regenerate floor tile map with new floor
    for (let r = 0; r < TILE_ROWS; r++)
        for (let c = 0; c < TILE_COLS; c++) {
            floorMap[r][c].flipH = Math.random() < 0.5;
            floorMap[r][c].flipV = Math.random() < 0.5;
        }
}

// weapon progression
const WEAPONS = [
    { name: 'Club',             min:   3, max:   8, cost:        0, minLevel:  1, sprite: 'Club.gif'             },
    { name: 'Rapier',           min:   5, max:  10, cost:       50, minLevel:  2, sprite: 'Rapier.gif'           },
    { name: 'Mace',             min:   7, max:  12, cost:      200, minLevel:  4, sprite: 'Mace.gif'             },
    { name: 'Longsword',        min:   9, max:  14, cost:      500, minLevel:  5, sprite: 'Longsword.gif'        },
    { name: 'Clerical Mace',    min:  11, max:  16, cost:     1000, minLevel:  7, sprite: 'Clerical_Mace.gif'    },
    { name: 'Orcish Axe',       min:  13, max:  18, cost:     2500, minLevel: 10, sprite: 'Orcish_Axe.gif'       },
    { name: 'Dwarven Axe',      min:  15, max:  22, cost:     5000, minLevel: 12, sprite: 'Dwarven_Axe.gif'      },
    { name: 'Fire Sword',       min:  18, max:  25, cost:    10000, minLevel: 14, sprite: 'Fire_Sword.gif'       },
    { name: 'Skull Staff',      min:  20, max:  27, cost:    20000, minLevel: 17, sprite: 'Skull_Staff.gif'      },
    { name: 'Fire Axe',         min:  22, max:  30, cost:    50000, minLevel: 20, sprite: 'Fire_Axe.gif'         },
    { name: 'Giant Sword',      min:  25, max:  35, cost:   100000, minLevel: 25, sprite: 'Giant_Sword.gif'      },
    { name: "Queen's Sceptre",  min:  30, max:  40, cost:   150000, minLevel: 30, sprite: "Queen's_Sceptre.gif"  },
    { name: 'Stonecutter Axe',  min:  40, max:  55, cost:   200000, minLevel: 35, sprite: 'Stonecutter_Axe.gif'  },
    { name: 'Thunder Hammer',   min:  55, max:  70, cost:   500000, minLevel: 40, sprite: 'Thunder_Hammer.gif'   },
    { name: 'Magic Longsword',  min:  70, max: 100, cost:  1000000, minLevel: 50, sprite: 'Magic_Longsword.gif'  },
];
let weaponIndex = 0; // current weapon

function basicDmgMin()  { return WEAPONS[weaponIndex].min + knightDmgMinBonus() + sorcDmgMinBonus(); }
function basicDmgMax()  { return WEAPONS[weaponIndex].max + knightDmgMaxBonus() + sorcDmgMaxBonus(); }
function rollBasicDmg() { return basicDmgMin() + Math.floor(Math.random() * (basicDmgMax() - basicDmgMin() + 1)); }

// Tibia-accurate health bar color based on HP ratio
function hpBarColor(ratio) {
    if (ratio > 0.92) return '#00BC00';
    if (ratio > 0.60) return '#A0E000';
    if (ratio > 0.30) return '#DCB400';
    if (ratio > 0.14) return '#C86400';
    if (ratio > 0.03) return '#C80000';
    return '#960000';
}


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
    console.log('updateHUD called', { weaponIndex, weapon: WEAPONS[weaponIndex], img: document.getElementById('hud-weapon-img') });
    const expNeeded = expForLevel(level + 1);
    const expCurrent = expForLevel(level);
    const progress = (exp - expCurrent) / (expNeeded - expCurrent);
    document.getElementById('hud-level').textContent = level;
    document.getElementById('hud-exp').textContent = `${exp} / ${expNeeded}`;
    document.getElementById('hud-xpbar').style.width = (Math.min(progress, 1) * 100) + '%';
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-gold').textContent = gold;
    const area = getCurrentArea();
    document.getElementById('hud-area').textContent = area.name;
    const next = getNextArea();
    const unlockBtn = document.getElementById('areaUnlockBtn');
    const infoEl = document.getElementById('hud-area-info');
    if (next) {
        const canUnlock = canUnlockNextArea();
        unlockBtn.disabled = !canUnlock;
        infoEl.textContent = `Next: ${next.name} (Lv ${next.levelReq}, ${next.goldCost.toLocaleString()}g)`;
    } else {
        unlockBtn.disabled = true;
        infoEl.textContent = 'Max area reached';
    }
    document.getElementById('hud-dmg-basic').textContent = `${basicDmgMin()}–${basicDmgMax()}`;
    // weapon
    const nextWeapon = WEAPONS[weaponIndex + 1];
    document.getElementById('hud-weapon-name').textContent = WEAPONS[weaponIndex].name;
    document.getElementById('hud-weapon-img').src = WEAPONS[weaponIndex].sprite;
    if (nextWeapon) {
        const canAfford   = gold >= nextWeapon.cost;
        const meetsLevel  = level >= nextWeapon.minLevel;
        const canUpgrade  = canAfford && meetsLevel;
        const upgradeBtn  = document.getElementById('weaponUpgradeBtn');
        const costFmt     = nextWeapon.cost.toLocaleString();
        let label = `<img src="${nextWeapon.sprite}" class="btn-icon"> ${nextWeapon.name} (${costFmt}g`;
        if (!meetsLevel) label += ` · Lv.${nextWeapon.minLevel} req`;
        label += ')';
        upgradeBtn.innerHTML = label;
        upgradeBtn.disabled  = !canUpgrade;
        upgradeBtn.style.display = 'block';
    } else {
        document.getElementById('weaponUpgradeBtn').style.display = 'none';
    }
    // auto attack button
    const autoBtn = document.getElementById('autoAttackBtn');
    if (!autoUnlocked) {
        autoBtn.textContent = 'Auto Attack (unlock in Skill Tree)';
        autoBtn.disabled = true;
        autoBtn.classList.remove('auto-on');
    } else {
        autoBtn.textContent = autoEnabled ? 'Auto: ON' : 'Auto: OFF';
        autoBtn.disabled = false;
        autoBtn.classList.toggle('auto-on', autoEnabled);
    }
    // boss focus button
    const bossFocusBtn = document.getElementById('bossFocusBtn');
    if (!bossFocusUnlocked) {
        bossFocusBtn.textContent = 'Boss Focus (unlock in Skill Tree)';
        bossFocusBtn.disabled = true;
        bossFocusBtn.classList.remove('auto-on');
    } else {
        bossFocusBtn.textContent = 'Boss Focus: ON';
        bossFocusBtn.disabled = true;
        bossFocusBtn.classList.add('auto-on');
    }
    // auto fireball button
    const autoGfbBtn = document.getElementById('autoGfbBtn');
    if (!autoGfbUnlocked) {
        autoGfbBtn.textContent = 'Auto Fireball (unlock in Skill Tree)';
        autoGfbBtn.disabled = true;
        autoGfbBtn.classList.remove('auto-on');
    } else {
        autoGfbBtn.textContent = autoGfbEnabled ? 'Auto Fireball: ON' : 'Auto Fireball: OFF';
        autoGfbBtn.disabled = false;
        autoGfbBtn.classList.toggle('auto-on', autoGfbEnabled);
    }
    // Class-specific button visibility
    const isSorcerer = ascendedClass === 'sorcerer';
    const isKnight   = ascendedClass === 'knight';
    document.getElementById('fireballBtn').style.display  = gfbUnlocked ? '' : 'none';
    document.getElementById('cd-fire-wrap').style.display  = gfbUnlocked ? '' : 'none';
    document.getElementById('ultimateExplosionBtn').style.display = isSorcerer ? '' : 'none';
    document.getElementById('cd-ue-wrap').style.display           = isSorcerer ? '' : 'none';
    document.getElementById('annihilationBtn').style.display      = isKnight   ? '' : 'none';
    document.getElementById('cd-anni-wrap').style.display         = isKnight   ? '' : 'none';
    document.getElementById('autoAnniBtn').style.display          = isKnight   ? '' : 'none';
    document.getElementById('autoUeBtn').style.display            = isSorcerer ? '' : 'none';
    document.getElementById('autoPsBtn').style.display             = isSorcerer ? '' : 'none';
    document.getElementById('powerStanceBtn').style.display       = isSorcerer ? '' : 'none';
    document.getElementById('cd-ps-wrap').style.display           = isSorcerer ? '' : 'none';
    // Crafting button state
    const _cb = document.getElementById('craftingBtn');
    if (_cb) {
        if (level >= CRAFTING_UNLOCK_LEVEL) {
            _cb.textContent = '\u2697 Crafting';
            _cb.disabled = false;
        } else {
            _cb.textContent = '\u2697 Crafting (lv.' + CRAFTING_UNLOCK_LEVEL + ')';
            _cb.disabled = true;
        }
    }
    // Active potions section
    const _pn = Date.now();
    const _fp = ms => Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    const _pl = [];
    if (_pn < potionWealthEnd)       _pl.push('<div class="hud-row"><span>\uD83D\uDCB0 Sm. Wealth</span><span class="potion-timer">'    + _fp(potionWealthEnd       - _pn) + '</span></div>');
    if (_pn < potionWisdomEnd)       _pl.push('<div class="hud-row"><span>\uD83D\uDCDA Sm. Wisdom</span><span class="potion-timer">'    + _fp(potionWisdomEnd       - _pn) + '</span></div>');
    if (_pn < potionSwiftnessEnd)    _pl.push('<div class="hud-row"><span>\u26A1 Sm. Swift</span><span class="potion-timer">'          + _fp(potionSwiftnessEnd    - _pn) + '</span></div>');
    if (_pn < potionMedWealthEnd)    _pl.push('<div class="hud-row"><span>\uD83D\uDCB0 Med. Wealth</span><span class="potion-timer">'  + _fp(potionMedWealthEnd    - _pn) + '</span></div>');
    if (_pn < potionMedWisdomEnd)    _pl.push('<div class="hud-row"><span>\uD83D\uDCDA Med. Wisdom</span><span class="potion-timer">'  + _fp(potionMedWisdomEnd    - _pn) + '</span></div>');
    if (_pn < potionMedSwiftnessEnd) _pl.push('<div class="hud-row"><span>\u26A1 Med. Swift</span><span class="potion-timer">'         + _fp(potionMedSwiftnessEnd - _pn) + '</span></div>');
    if (_pn < potionMadnessEnd)      _pl.push('<div class="hud-row"><span>\uD83C\uDF00 Madness</span><span class="potion-timer">'      + _fp(potionMadnessEnd      - _pn) + '</span></div>');
    if (_pn < potionDangerEnd)       _pl.push('<div class="hud-row"><span>\uD83D\uDC80 Danger</span><span class="potion-timer">'       + _fp(potionDangerEnd       - _pn) + '</span></div>');
    const _ps = document.getElementById('hud-potions-section');
    if (_ps) _ps.style.display = _pl.length ? '' : 'none';
    const _pe = document.getElementById('hud-potions');
    if (_pe) _pe.innerHTML = _pl.join('');
}

let totalClicks = 0;   // lifetime successful click-attacks
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

const UE_UNLOCK_LEVEL = 40; // Sorcerer only
const UE_UNLOCK_GOLD  = 1000;
const UE_COOLDOWN_MS  = 5 * 60 * 1000; // 5 min (Sorcerer only)
let ueUnlocked    = false;
let ueCooldownEnd = 0;

const POWER_STANCE_COOLDOWN_MS = 6 * 60 * 1000; // 6 min
const POWER_STANCE_DURATION_MS = 90 * 1000;      // 90 sec
let powerStanceUnlocked    = false;
let powerStanceActive      = false;
let powerStanceEnd         = 0;
let powerStanceCooldownEnd = 0;
let autoPsEnabled          = false;

// ── Annihilation (Knight only) ────────────────────────────────────────
const ANNIHILATION_UNLOCK_LEVEL = 40;
const ANNIHILATION_COOLDOWN_MS  = 3 * 60 * 1000; // 3 min
let annihilationUnlocked    = false;
let annihilationCooldownEnd = 0;
let autoAnniEnabled         = false;

// ── Inventory & crafting ─────────────────────────────────────────
let inventory = { lumpOfDirt: 0, rotwormFang: 0, worm: 0, gland: 0,
                   cyclopsToe: 0, wolfToothChain: 0, cyclopsEye: 0, battleStone: 0 };
let potionWealthEnd       = 0;   // ms timestamp when Small Potion of Wealth buff expires
let potionWisdomEnd       = 0;   // ms timestamp when Small Potion of Wisdom buff expires
let potionSwiftnessEnd    = 0;   // ms timestamp when Small Potion of Swiftness buff expires
let potionMedWealthEnd    = 0;   // Medium Potion of Wealth
let potionMedWisdomEnd    = 0;   // Medium Potion of Wisdom
let potionMedSwiftnessEnd = 0;   // Medium Potion of Swiftness
let potionMadnessEnd      = 0;   // Potion of Madness
let potionDangerEnd       = 0;   // Potion of Danger
let _lastCraftRenderSec = -1;

const AUTO_UNLOCK_LEVEL = 5;
const AUTO_UNLOCK_GOLD  = 0;
const AUTO_COOLDOWN_MS  = 1000; // fixed 1s, unaffected by upgrades
let autoUnlocked   = false;
let autoEnabled    = false;
let autoTarget     = null;
let lastAutoAttack = 0;

// Always target the lowest-HP worm; skip worms listed in `exclude`.
function _pickAutoTarget(exclude = []) {
    const pool = exclude.length ? worms.filter(w => !exclude.includes(w)) : worms;
    if (!pool.length) return null;
    return pool.reduce((a, b) => a.hp <= b.hp ? a : b);
}

const AUTO_GFB_UNLOCK_LEVEL = 15;
const AUTO_GFB_UNLOCK_GOLD  = 1000;
let autoGfbUnlocked = false;
let autoGfbEnabled  = false;

const AUTO_UE_UNLOCK_LEVEL = 45; // Sorcerer only, requires UE unlocked first
const AUTO_UE_UNLOCK_GOLD  = 10000;
let autoUeUnlocked = false;
let autoUeEnabled  = false;

const BOSS_FOCUS_UNLOCK_LEVEL = 10;
const BOSS_FOCUS_UNLOCK_GOLD  = 1000;
let bossFocusUnlocked = false;

function fmtCost(n) {
    if (n >= 1e12) return (n/1e12).toFixed(0) + 'T';
    if (n >= 1e9)  return (n/1e9).toFixed(0)  + 'B';
    if (n >= 1e6)  return (n/1e6).toFixed(0)  + 'M';
    if (n >= 1e3)  return (n/1e3).toFixed(0)  + 'K';
    return n.toString();
}

// ── Dev helpers (only active on non-production hostnames) ───────────────────────
function _isDevEnv() {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
}
// Removed devFillMaterials and devFillMatsBtn for production

// ── Drop tables & crafting ─────────────────────────────────────────────────────
const ROTWORM_DROPS      = ['lumpOfDirt', 'rotwormFang', 'worm'];
const ROTWORM_BOSS_DROPS = ['lumpOfDirt', 'rotwormFang', 'worm', 'gland'];
const CYCLOPS_DROPS      = ['lumpOfDirt', 'rotwormFang', 'worm', 'cyclopsToe', 'wolfToothChain', 'cyclopsEye'];
const CYCLOPS_BOSS_DROPS = ['lumpOfDirt', 'rotwormFang', 'worm', 'gland', 'cyclopsToe', 'wolfToothChain', 'cyclopsEye', 'battleStone'];

const ITEM_DEFS = [
    { key: 'lumpOfDirt',     name: 'Lump of Dirt',     icon: '🪨' },
    { key: 'rotwormFang',    name: 'Rotworm Fang',     icon: '🦷' },
    { key: 'worm',           name: 'Worm',             icon: '🪱' },
    { key: 'gland',          name: 'Gland',            icon: '💧' },
    { key: 'cyclopsToe',     name: 'Cyclops Toe',      icon: '🦶' },
    { key: 'wolfToothChain', name: 'Wolf Tooth Chain', icon: '⛓'  },
    { key: 'cyclopsEye',     name: 'Cyclops Eye',      icon: '👁'  },
    { key: 'battleStone',    name: 'Battle Stone',     icon: '💎' },
];

const CRAFTING_RECIPES = [
    { id: 'wealth',       name: 'Small Potion of Wealth',    icon: '💰', desc: '+50% gold gain for 5 minutes',                                  goldCost:  10000, ingredients: { lumpOfDirt: 5, rotwormFang: 5, worm: 5, gland: 1 } },
    { id: 'wisdom',       name: 'Small Potion of Wisdom',    icon: '📚', desc: '+50% experience gain for 5 minutes',                              goldCost:  10000, ingredients: { lumpOfDirt: 5, rotwormFang: 5, worm: 5, gland: 1 } },
    { id: 'swiftness',    name: 'Small Potion of Swiftness', icon: '⚡', desc: '-20% all cooldowns for 5 minutes',                                goldCost:  10000, ingredients: { lumpOfDirt: 5, rotwormFang: 5, worm: 5, gland: 1 } },
    { id: 'medWealth',    name: 'Medium Potion of Wealth',   icon: '💰', desc: '+75% gold gain for 5 minutes',                                   goldCost:  20000, ingredients: { cyclopsToe: 5, wolfToothChain: 5, cyclopsEye: 5, battleStone: 1 }, ascendedOnly: true },
    { id: 'medWisdom',    name: 'Medium Potion of Wisdom',   icon: '📚', desc: '+75% experience gain for 5 minutes',                             goldCost:  20000, ingredients: { cyclopsToe: 5, wolfToothChain: 5, cyclopsEye: 5, battleStone: 1 }, ascendedOnly: true },
    { id: 'medSwiftness', name: 'Medium Potion of Swiftness',icon: '⚡', desc: '-50% all cooldowns for 5 minutes',                               goldCost:  20000, ingredients: { cyclopsToe: 5, wolfToothChain: 5, cyclopsEye: 5, battleStone: 1 }, ascendedOnly: true },
    { id: 'madness',      name: 'Potion of Madness',         icon: '🌀', desc: '+10 max spawn cap & 10× spawn rate for 5 minutes',               goldCost:  50000, ingredients: { cyclopsToe: 10, wolfToothChain: 10, cyclopsEye: 10, battleStone: 2 }, ascendedOnly: true },
    { id: 'danger',       name: 'Potion of Danger',          icon: '💀', desc: 'Reduces kills required for boss by 25% for 5 minutes',           goldCost:  50000, ingredients: { cyclopsToe: 10, wolfToothChain: 10, cyclopsEye: 10, battleStone: 2 }, ascendedOnly: true },
];

const CRAFTING_UNLOCK_LEVEL = 20;

// Maps each potion id to the opposite-tier counterpart (no stacking allowed).
const _POTION_COUNTERPART = { wealth: 'medWealth', medWealth: 'wealth', wisdom: 'medWisdom', medWisdom: 'wisdom', swiftness: 'medSwiftness', medSwiftness: 'swiftness' };
function rollDrops(pool, isUber, isBoss) {
    if (isUber) return pool.map(k => ({ k, qty: 2 }));
    if (isBoss) {
        if (Math.random() >= 0.5) return [];
        const sh = [...pool].sort(() => Math.random() - 0.5);
        return sh.slice(0, 2).map(k => ({ k, qty: 2 }));
    }
    if (Math.random() >= 0.25) return [];
    return [{ k: pool[Math.floor(Math.random() * pool.length)], qty: 1 }];
}

function potionGoldMult()  { const now = Date.now(); if (now < potionMedWealthEnd) return 1.75; if (now < potionWealthEnd) return 1.5; return 1.0; }
function potionExpMult()   { const now = Date.now(); if (now < potionMedWisdomEnd)  return 1.75; if (now < potionWisdomEnd)  return 1.5; return 1.0; }
function potionCdrMult()   { const now = Date.now(); if (now < potionMedSwiftnessEnd) return 0.5; if (now < potionSwiftnessEnd) return 0.8; return 1.0; }
function potionMadnessActive() { return Date.now() < potionMadnessEnd; }
function potionDangerActive()  { return Date.now() < potionDangerEnd; }

function _getPotionEnd(id) {
    if (id === 'wealth')       return potionWealthEnd;
    if (id === 'wisdom')       return potionWisdomEnd;
    if (id === 'swiftness')    return potionSwiftnessEnd;
    if (id === 'medWealth')    return potionMedWealthEnd;
    if (id === 'medWisdom')    return potionMedWisdomEnd;
    if (id === 'medSwiftness') return potionMedSwiftnessEnd;
    if (id === 'madness')      return potionMadnessEnd;
    if (id === 'danger')       return potionDangerEnd;
    return 0;
}
function _setPotionEnd(id, val) {
    if      (id === 'wealth')       potionWealthEnd       = val;
    else if (id === 'wisdom')       potionWisdomEnd       = val;
    else if (id === 'swiftness')    potionSwiftnessEnd    = val;
    else if (id === 'medWealth')    potionMedWealthEnd    = val;
    else if (id === 'medWisdom')    potionMedWisdomEnd    = val;
    else if (id === 'medSwiftness') potionMedSwiftnessEnd = val;
    else if (id === 'madness')      potionMadnessEnd      = val;
    else if (id === 'danger')       potionDangerEnd       = val;
}

function openInventory() {
    document.getElementById('inventory-modal').style.display = 'flex';
    renderInventory();
}
function renderInventory(filterKey) {
    const body = document.getElementById('inv-body');
    if (!body) return;
    const used = new Set(CRAFTING_RECIPES.flatMap(r => Object.keys(r.ingredients)));
    body.innerHTML = ITEM_DEFS.map(def => {
        const qty       = inventory[def.key] || 0;
        const clickable = used.has(def.key) && qty > 0;
        let cls = 'inv-item' +
                  (qty === 0         ? ' inv-item-empty'     : '') +
                  (clickable         ? ' inv-item-clickable' : '') +
                  (filterKey === def.key ? ' inv-item-highlight' : '');
        return `<div class="${cls}" data-key="${def.key}" title="${def.name}${clickable ? ' \u2014 click to see recipes' : ''}">
            <div class="inv-icon">${def.icon}</div>
            <div class="inv-qty">${qty}</div>
            <div class="inv-name">${def.name}</div>
        </div>`;
    }).join('');
    // Add event listeners for click/touch, prevent double firing
    // Debounce handler to prevent double firing
    Array.from(body.getElementsByClassName('inv-item-clickable')).forEach(el => {
        const key = el.getAttribute('data-key');
        let fired = false;
        const handler = (e) => {
            if (fired) return;
            fired = true;
            setTimeout(() => { fired = false; }, 300);
            openCraftingFromItem(key);
        };
        el.addEventListener('click', handler);
        el.addEventListener('touchend', handler);
    });
}
function openCraftingFromItem(key) {
    document.getElementById('inventory-modal').style.display = 'none';
    openCrafting(key);
}
function openCrafting(filterKey) {
    if (level < CRAFTING_UNLOCK_LEVEL) return;
    document.getElementById('crafting-modal').style.display = 'flex';
    renderCrafting(filterKey);
}
function renderCrafting(filterKey) {
    const body = document.getElementById('craft-body');
    if (!body) return;
    const now   = Date.now();
    const fmtMs = ms => Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    body.innerHTML = CRAFTING_RECIPES.filter(r => !r.ascendedOnly || ascended).map(r => {
        const active        = now < _getPotionEnd(r.id);
        const counterpart   = _POTION_COUNTERPART[r.id];
        const counterActive = counterpart ? now < _getPotionEnd(counterpart) : false;
        const ingOk    = Object.entries(r.ingredients).every(([k, v]) => (inventory[k] || 0) >= v);
        const goldOk   = gold >= r.goldCost;
        const canCraft = !active && !counterActive && ingOk && goldOk;
        const hi       = filterKey != null && r.ingredients[filterKey] != null;
        const ingsHtml = Object.entries(r.ingredients).map(([k, need]) => {
            const have = inventory[k] || 0;
            const d    = ITEM_DEFS.find(d => d.key === k);
            return `<span class="craft-ing${have >= need ? '' : ' craft-ing-miss'}">${d ? d.icon : ''} ${d ? d.name : k}: ${have}/${need}</span>`;
        }).join('');
        const statusHtml = active
            ? `<div class="craft-active">\u2713 ACTIVE \u2014 ${fmtMs(_getPotionEnd(r.id) - now)}</div>`
            : counterActive
                ? `<div class="craft-active" style="border-color:#8a6a2a;color:#c08040;">\u26A0 ${CRAFTING_RECIPES.find(x=>x.id===counterpart)?.name} active</div>`
                : '';
        const btnLabel = active ? 'Already active' : counterActive ? 'Other tier active' : 'Craft';
        return `<div class="craft-card${hi ? ' craft-card-highlight' : ''}">
            <div class="craft-header"><span class="craft-icon">${r.icon}</span><span class="craft-name">${r.name}</span></div>
            <div class="craft-desc">${r.desc}</div>
            <div class="craft-ings">${ingsHtml}</div>
            <div class="craft-cost${goldOk ? '' : ' craft-cost-miss'}">\uD83D\uDCB0 ${r.goldCost.toLocaleString()} gold</div>
            ${statusHtml}
            <button class="craft-btn" onclick="craftPotion('${r.id}')" ${canCraft ? '' : 'disabled'}>${btnLabel}</button>
        </div>`;
    }).join('');
}

function craftPotion(id) {
    const r = CRAFTING_RECIPES.find(r => r.id === id);
    if (!r || level < CRAFTING_UNLOCK_LEVEL) return;
    if (gold < r.goldCost) return;
    if (!Object.entries(r.ingredients).every(([k, v]) => (inventory[k] || 0) >= v)) return;
    if (Date.now() < _getPotionEnd(id)) return;
    const counterpart = _POTION_COUNTERPART[id];
    if (counterpart && Date.now() < _getPotionEnd(counterpart)) return; // block stacking
    if (counterpart) _setPotionEnd(counterpart, 0);
    gold -= r.goldCost;
    Object.entries(r.ingredients).forEach(([k, v]) => { inventory[k] -= v; });
    _setPotionEnd(id, Date.now() + 5 * 60 * 1000);
    renderCrafting();
}

// ── Skill Tree ────────────────────────────────────────────────────────────────
// Cost per point: tier 1 = 500g, tier 2 = 2000g, tier 3 = 10000g
const SKILL_COST_PER_TIER = [0, 500, 2000, 10000];

// General skill tree definition
// col: 1-indexed column (1=Automation, 2=Monster/Boss, 3=Economy/CDR)
// row: tier within column (1=base, 2=mid, 3=top) — must unlock previous tier fully first
const GENERAL_SKILLS = [
    // Column 1 — Automation
    { id: 7, col: 1, row: 1, name: 'Auto Attack',       max: 1, reqLevel: 5,  prereqs: [],     desc: 'Automatically attacks once per second' },
    { id: 8, col: 1, row: 2, name: 'Boss Focus',        max: 1, reqLevel: 10, prereqs: [7],    desc: 'Auto attack prioritises the boss when alive' },
    { id: 9, col: 1, row: 3, name: 'Double Strike',     max: 1, reqLevel: 20, prereqs: [7, 8], desc: 'Auto attack hits two monsters simultaneously' },
    // Column 2 — Monster/Boss
    { id: 1, col: 2, row: 1, name: 'More Monsters',  max: 5, reqLevel: 1,  prereqs: [],     costs: [100, 500, 750, 1000, 2000], desc: '+1 max spawn cap per point (base: 10)' },
    { id: 2, col: 2, row: 2, name: 'More Bosses',    max: 5, reqLevel: 5,  prereqs: [1],    costs: [100, 500, 750, 1000, 2000], desc: 'Boss spawns every -2 kills per point (base: 50)' },
    { id: 3, col: 2, row: 3, name: 'Uber Bosses',    max: 1, reqLevel: 15, prereqs: [1, 2], desc: 'Enables uber bosses (every 10 normal bosses)' },
    // Column 3 — Economy/CDR
    { id: 4, col: 3, row: 1, name: 'More Gold',      max: 5, reqLevel: 1,  prereqs: [],     costs: [100, 500, 750, 1000, 2000], desc: '+10% gold per kill per point' },
    { id: 5, col: 3, row: 2, name: 'More EXP',       max: 5, reqLevel: 5,  prereqs: [4],    costs: [100, 500, 750, 1000, 2000], desc: '+10% exp per kill per point' },
    { id: 6, col: 3, row: 3, name: 'Cooldown Reset', max: 1, reqLevel: 15, prereqs: [4, 5], desc: '1% chance on kill to reset all cooldowns' },
    // Column 4 — Fireball
    { id: 10, col: 4, row: 1, name: 'Unlock Fireball', max: 1, reqLevel: 3,  prereqs: [],       cost: 500,  desc: 'Unlocks Fireball: 50% max HP AoE, 10s cooldown' },
    { id: 11, col: 4, row: 2, name: 'Fireball CDR',    max: 5, reqLevel: 1,  prereqs: [10],     costs: [100, 500, 750, 1000, 2000],  desc: '-10% Fireball cooldown per point (base: 10s)' },
    { id: 12, col: 4, row: 3, name: 'Auto Fireball',   max: 1, reqLevel: 10, prereqs: [10, 11], cost: 1000, desc: 'Automatically casts Fireball on the best target cluster' },
];

// skill points spent: keyed by skill id
let skillPoints = {}; // e.g. { 1: 3, 4: 5 }

function skillPts(id) { return skillPoints[id] || 0; }

function skillPrereqsMet(skill) {
    return skill.prereqs.every(pid => skillPts(pid) >= 1);
}

function skillCanBuy(skill) {
    if (level < skill.reqLevel) return false;
    if (skillPts(skill.id) >= skill.max) return false;
    if (!skillPrereqsMet(skill)) return false;
    const cost = skill.costs ? (skill.costs[skillPts(skill.id)] ?? 0) : (skill.cost ?? SKILL_COST_PER_TIER[skill.row] ?? 0);
    return gold >= cost;
}

function buySkill(id) {
    const skill = GENERAL_SKILLS.find(s => s.id === id);
    if (!skill || !skillCanBuy(skill)) return;
    const cost = skill.costs ? (skill.costs[skillPts(skill.id)] ?? 0) : (skill.cost ?? SKILL_COST_PER_TIER[skill.row] ?? 0);
    gold -= cost;
    skillPoints[id] = (skillPoints[id] || 0) + 1;
    // Side-effects for automation skills
    if (id === 7)  { autoUnlocked = true; autoEnabled = true; autoTarget = _pickAutoTarget(); }
    if (id === 8)  { bossFocusUnlocked = true; }
    // Side-effects for fireball skills
    if (id === 10) { gfbUnlocked = true; }
    if (id === 12) { autoGfbUnlocked = true; autoGfbEnabled = true; }
    renderSkillTree();
}

// ── Skill effect helpers ──────────────────────────────────────────
function skillMonsterCap()     { return 10 + skillPts(1) + (potionMadnessActive() ? 10 : 0); }
function skillBossInterval()   { return Math.max(5, Math.floor((Math.max(20, BOSS_EVERY - skillPts(2) * 2)) * (potionDangerActive() ? 0.75 : 1.0))); }
function skillGoldMult()       { return 1 + skillPts(4) * 0.1; }
function skillExpMult()        { return 1 + skillPts(5) * 0.1; }
function skillCdResetEnabled() { return skillPts(6) >= 1; }
function skillUberBossEnabled(){ return skillPts(3) >= 1; }
function skillDoubleAuto()     { return skillPts(9) >= 1; }
function skillAutoFireball()   { return skillPts(12) >= 1; }

// ── Knight skill tree ─────────────────────────────────────────────
// costs[] = gold cost per level [lvl1, lvl2, ...]
const KNIGHT_SKILLS = [
    // Column 1 — Speed
    { id: 101, col: 1, row: 1, name: 'Attack Speed',      max: 5, reqLevel: 30, prereqs: [],           costs: [100, 500, 2000, 5000, 10000],             desc: '-10% click attack cooldown per point (max -50%)' },
    { id: 102, col: 1, row: 2, name: 'Auto Speed',        max: 5, reqLevel: 35, prereqs: [101],          costs: [500, 1000, 5000, 20000, 50000],            desc: '-10% auto attack cooldown per point (max -50%)' },
    { id: 103, col: 1, row: 3, name: 'Extra Auto Target', max: 1, reqLevel: 50, prereqs: [101, 102],     costs: [50000],                                    desc: 'Auto attack hits one additional target (stacks with Double Strike)' },
    // Column 2 — Annihilation
    { id: 104, col: 2, row: 1, name: 'Annihilation',      max: 1, reqLevel: 40, prereqs: [],             costs: [20000],                                    desc: 'Unlock Annihilation: instantly slay the boss (3 min CD, no effect on Uber bosses)' },
    { id: 105, col: 2, row: 2, name: 'Auto Annihilation', max: 1, reqLevel: 50, prereqs: [104],          costs: [50000],                                    desc: 'Automatically casts Annihilation whenever ready' },
    { id: 106, col: 2, row: 3, name: 'Anni CDR',          max: 5, reqLevel: 60, prereqs: [104, 105],     costs: [1000, 2000, 5000, 20000, 100000],          desc: '-10% Annihilation cooldown per point (max -50%)' },
    // Column 3 — Damage
    { id: 107, col: 3, row: 1, name: 'Max Damage',        max: 5, reqLevel: 30, prereqs: [],             costs: [100, 500, 2000, 5000, 10000],             desc: '+5 max damage per point' },
    { id: 108, col: 3, row: 2, name: 'Min Damage',        max: 5, reqLevel: 40, prereqs: [107],          costs: [500, 1000, 5000, 20000, 50000],           desc: '+5 min damage per point' },
    { id: 109, col: 3, row: 3, name: 'Power Surge',       max: 5, reqLevel: 50, prereqs: [107, 108],     costs: [1000, 2000, 5000, 20000, 100000],         desc: '+5 min and max damage per point' },
];

let knightSkillPts = {};

function kPts(id)           { return knightSkillPts[id] || 0; }
function kPrereqsMet(skill) { return skill.prereqs.every(pid => kPts(pid) >= 1); }
function kCanBuy(skill) {
    if (level < skill.reqLevel)      return false;
    if (kPts(skill.id) >= skill.max) return false;
    if (!kPrereqsMet(skill))         return false;
    return gold >= (skill.costs[kPts(skill.id)] ?? 0);
}
function buyKnightSkill(id) {
    const skill = KNIGHT_SKILLS.find(s => s.id === id);
    if (!skill || !kCanBuy(skill)) return;
    gold -= (skill.costs[kPts(skill.id)] ?? 0);
    knightSkillPts[id] = (knightSkillPts[id] || 0) + 1;
    if (id === 104) annihilationUnlocked = true;
    if (id === 105) { autoAnniEnabled = true; }
    renderSkillTree();
}

// Knight effect helpers
function knightDmgMinBonus()     { return (kPts(108) + kPts(109)) * 5; }
function knightDmgMaxBonus()     { return (kPts(107) + kPts(109)) * 5; }
function knightExtraAutoTarget() { return kPts(103) >= 1; }
function knightAutoAnniOn()      { return kPts(105) >= 1 && autoAnniEnabled; }

// ── Sorcerer skill tree ───────────────────────────────────────────
// costs[] = gold cost per level [lvl1, lvl2, ...]
const SORC_SKILLS = [
    // Column 1 — Great Fireball
    { id: 201, col: 1, row: 1, name: 'Great Fireball',      max: 1, reqLevel: 30, prereqs: [],           costs: [5000],                              desc: 'Upgrades Fireball to Great Fireball: instantly kills all non-boss enemies in range (requires Fireball from General Skill Tree)' },
    { id: 202, col: 1, row: 2, name: 'Volatile Blast',     max: 1, reqLevel: 35, prereqs: [201],         costs: [20000],                              desc: 'GFB also deals 50% of boss max HP as bonus damage when boss is in range' },
    { id: 203, col: 1, row: 3, name: 'Double Fireball',     max: 1, reqLevel: 50, prereqs: [201, 202],    costs: [50000],                             desc: 'Each Fireball cast fires a second Fireball at the best remaining cluster' },
    // Column 2 — Ultimate Explosion
    { id: 204, col: 2, row: 1, name: 'Ultimate Explosion',  max: 1, reqLevel: 40, prereqs: [],            costs: [20000],                             desc: 'Unlock Ultimate Explosion: instantly kills all non-boss enemies (5 min CD)' },
    { id: 205, col: 2, row: 2, name: 'Auto Ult. Explosion', max: 1, reqLevel: 50, prereqs: [204],         costs: [50000],                             desc: 'Automatically casts Ultimate Explosion whenever off cooldown' },
    { id: 206, col: 2, row: 3, name: 'UE CDR',              max: 5, reqLevel: 60, prereqs: [204, 205],    costs: [1000, 2000, 5000, 20000, 100000],    desc: '-10% Ultimate Explosion cooldown per point (max -50%)' },
    // Column 3 — Damage
    { id: 207, col: 3, row: 1, name: 'Max Damage',          max: 5, reqLevel: 30, prereqs: [],            costs: [100, 500, 2000, 5000, 10000],        desc: '+5 max damage per point' },
    { id: 208, col: 3, row: 2, name: 'Min Damage',          max: 5, reqLevel: 40, prereqs: [207],         costs: [500, 1000, 5000, 20000, 50000],      desc: '+5 min damage per point' },
    { id: 209, col: 3, row: 3, name: 'Power Surge',         max: 5, reqLevel: 50, prereqs: [207, 208],    costs: [1000, 2000, 5000, 20000, 100000],    desc: '+5 min and max damage per point' },
    // Column 4 — Power Stance
    { id: 210, col: 4, row: 1, name: 'Power Stance',        max: 1, reqLevel: 40, prereqs: [],            costs: [10000],                             desc: 'Unlock Power Stance: +15 min/max damage, +50% attack speed for 90s (6 min CD)' },
    { id: 211, col: 4, row: 2, name: 'Auto Power Stance',   max: 1, reqLevel: 50, prereqs: [210],         costs: [20000],                             desc: 'Automatically activates Power Stance whenever off cooldown' },
    { id: 212, col: 4, row: 3, name: 'PS CDR',              max: 5, reqLevel: 60, prereqs: [210, 211],    costs: [1000, 2000, 5000, 20000, 100000],    desc: '-10% Power Stance cooldown per point (max -50%)' },
];

let sorcSkillPts = {};

function sPts(id)           { return sorcSkillPts[id] || 0; }
function sPrereqsMet(skill) { return skill.prereqs.every(pid => sPts(pid) >= 1); }
function sCanBuy(skill) {
    if (level < skill.reqLevel)      return false;
    if (sPts(skill.id) >= skill.max) return false;
    if (!sPrereqsMet(skill))         return false;
    if (skill.id === 201 && !gfbUnlocked) return false; // requires Fireball from General tree first
    return gold >= (skill.costs[sPts(skill.id)] ?? 0);
}
function buySorcSkill(id) {
    const skill = SORC_SKILLS.find(s => s.id === id);
    if (!skill || !sCanBuy(skill)) return;
    gold -= (skill.costs[sPts(skill.id)] ?? 0);
    sorcSkillPts[id] = (sorcSkillPts[id] || 0) + 1;
    // id 201: no side-effect — fireball already unlocked via general tree; 201 just upgrades it
    if (id === 204) ueUnlocked = true;
    if (id === 205) { autoUeUnlocked = true; autoUeEnabled = true; }
    if (id === 210) powerStanceUnlocked = true;
    if (id === 211) { autoPsEnabled = true; }
    renderSkillTree();
}

// Sorc effect helpers
function sorcDmgMinBonus()  { return (sPts(208) + sPts(209)) * 5 + (powerStanceActive ? 15 : 0); }
function sorcDmgMaxBonus()  { return (sPts(207) + sPts(209)) * 5 + (powerStanceActive ? 15 : 0); }
function sorcDoubleGfb()    { return sPts(203) >= 1; }
function sorcGfbUpgraded()  { return ascendedClass === 'sorcerer' && sPts(201) >= 1; }
function sorcAutoUe()       { return sPts(205) >= 1; }
function sorcAutoPs()       { return sPts(211) >= 1 && autoPsEnabled; }

// ── Skill tree UI ─────────────────────────────────────────────────
let _skillTab = 'general';

function openSkillTree() {
    _skillTab = 'general';
    document.getElementById('skill-modal').style.display = 'flex';
    renderSkillTree();
}

function switchSkillTab(tab) {
    _skillTab = tab;
    ['general', 'knight', 'sorcerer'].forEach(t => {
        document.getElementById('st-tab-' + t).classList.toggle('st-tab-active', t === tab);
    });
    renderSkillTree();
}

function renderSkillTree() {
    // Update tab visibility
    const knightTab   = document.getElementById('st-tab-knight');
    const sorcTab     = document.getElementById('st-tab-sorcerer');
    knightTab.style.display  = ascendedClass === 'knight'   ? '' : 'none';
    sorcTab.style.display    = ascendedClass === 'sorcerer' ? '' : 'none';

    // If current tab is unavailable, fall back to general
    if ((_skillTab === 'knight'   && ascendedClass !== 'knight') ||
        (_skillTab === 'sorcerer' && ascendedClass !== 'sorcerer')) {
        _skillTab = 'general';
    }

    ['general', 'knight', 'sorcerer'].forEach(t => {
        document.getElementById('st-tab-' + t).classList.toggle('st-tab-active', t === _skillTab);
        document.getElementById('st-pane-' + t).style.display = t === _skillTab ? '' : 'none';
    });

    if (_skillTab === 'general')  renderGeneralPane();
    if (_skillTab === 'knight')   renderKnightPane();
    if (_skillTab === 'sorcerer') renderSorcPane();
}

function renderGeneralPane() {
    const pane = document.getElementById('st-pane-general');

    // Build a 3-column × 3-row grid of skill nodes
    // col indices 1,2,3 ; row indices 1,2,3
    let html = '<div class="st-grid">';
    for (let col = 1; col <= 4; col++) {
        html += '<div class="st-col">';
        for (let row = 1; row <= 3; row++) {
            const skill = GENERAL_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) {
                // Placeholder column or empty slot
                if (col === 1) {
                    html += `<div class="st-node st-node-placeholder"><span class="st-node-name">—</span><span class="st-node-sub">Coming soon</span></div>`;
                } else {
                    html += `<div class="st-node st-node-empty"></div>`;
                }
                continue;
            }
            const pts     = skillPts(skill.id);
            const maxed   = pts >= skill.max;
            const prereqs = skillPrereqsMet(skill);
            const lvlOk   = level >= skill.reqLevel;
const cost    = skill.costs ? (skill.costs[pts] ?? 0) : (skill.cost ?? SKILL_COST_PER_TIER[skill.row]);
            const canBuy  = !maxed && prereqs && lvlOk && gold >= cost;
            const locked  = !prereqs || !lvlOk;

            let cls = 'st-node';
            if (maxed)       cls += ' st-node-maxed';
            else if (locked) cls += ' st-node-locked';
            else if (canBuy) cls += ' st-node-available';
            else             cls += ' st-node-unaffordable';

            // Connector arrow from previous row (row > 1)
            const connector = row > 1
                ? `<div class="st-connector ${prereqs ? 'st-conn-open' : 'st-conn-locked'}">▾</div>`
                : '';

            const reqChips = [];
            if (skill.reqLevel > 1) reqChips.push(`<span class="st-req ${lvlOk ? 'st-req-met' : 'st-req-fail'}">Lv.${skill.reqLevel}</span>`);
            skill.prereqs.forEach(pid => {
                const pname = GENERAL_SKILLS.find(s => s.id === pid)?.name || `Skill ${pid}`;
                reqChips.push(`<span class="st-req ${skillPts(pid) >= 1 ? 'st-req-met' : 'st-req-fail'}">${pname}</span>`);
            });
            const reqsHTML = reqChips.length ? `<div class="st-node-reqs">${reqChips.join('')}</div>` : '';

            html += `
                ${connector}
                <div class="${cls}" data-id="${skill.id}" title="${skill.desc}">
                    <div class="st-node-header">
                        <span class="st-node-name">${skill.name}</span>
                        <span class="st-node-pts ${maxed ? 'st-pts-maxed' : ''}">${pts}/${skill.max}</span>
                    </div>
                    <div class="st-node-desc">${skill.desc}</div>
                    ${reqsHTML}
                    ${!maxed
                        ? `<button class="st-buy-btn" onclick="buySkill(${skill.id})" ${canBuy ? '' : 'disabled'}>${fmtCost(cost)}g</button>`
                        : `<div class="st-node-maxed-label">MAXED</div>`
                    }
                </div>`;
        }
        html += '</div>'; // st-col
    }
    html += '</div>'; // st-grid

    pane.innerHTML = html;
}

function renderKnightPane() {
    const pane = document.getElementById('st-pane-knight');
    let html = '<div class="st-grid st-grid-knight">';
    for (let col = 1; col <= 3; col++) {
        html += '<div class="st-col">';
        for (let row = 1; row <= 3; row++) {
            const skill = KNIGHT_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) { html += `<div class="st-node st-node-empty"></div>`; continue; }
            const pts    = kPts(skill.id);
            const maxed  = pts >= skill.max;
            const prereqs = kPrereqsMet(skill);
            const lvlOk  = level >= skill.reqLevel;
            const cost   = skill.costs[pts] ?? 0;
            const canBuy = !maxed && prereqs && lvlOk && gold >= cost;
            const locked = !prereqs || !lvlOk;
            let cls = 'st-node';
            if (maxed)       cls += ' st-node-maxed';
            else if (locked) cls += ' st-node-locked';
            else if (canBuy) cls += ' st-node-available';
            else             cls += ' st-node-unaffordable';
            const connector = row > 1
                ? `<div class="st-connector ${prereqs ? 'st-conn-open' : 'st-conn-locked'}">&#9660;</div>`
                : '';
            const reqChips = [];
            if (skill.reqLevel > 1) reqChips.push(`<span class="st-req ${lvlOk ? 'st-req-met' : 'st-req-fail'}">Lv.${skill.reqLevel}</span>`);
            skill.prereqs.forEach(pid => {
                const pname = KNIGHT_SKILLS.find(s => s.id === pid)?.name || `Skill ${pid}`;
                reqChips.push(`<span class="st-req ${kPts(pid) >= 1 ? 'st-req-met' : 'st-req-fail'}">${pname}</span>`);
            });
            const reqsHTML = reqChips.length ? `<div class="st-node-reqs">${reqChips.join('')}</div>` : '';
            html += `
                ${connector}
                <div class="${cls}" data-id="${skill.id}" title="${skill.desc}">
                    <div class="st-node-header">
                        <span class="st-node-name">${skill.name}</span>
                        <span class="st-node-pts ${maxed ? 'st-pts-maxed' : ''}">${pts}/${skill.max}</span>
                    </div>
                    <div class="st-node-desc">${skill.desc}</div>
                    ${reqsHTML}
                    ${!maxed
                        ? `<button class="st-buy-btn" onclick="buyKnightSkill(${skill.id})" ${canBuy ? '' : 'disabled'}>${cost === 0 ? 'Free' : fmtCost(cost) + 'g'}</button>`
                        : `<div class="st-node-maxed-label">MAXED</div>`
                    }
                </div>`;
        }
        html += '</div>';
    }
    html += '</div>';
    pane.innerHTML = html;
}

function renderSorcPane() {
    const pane = document.getElementById('st-pane-sorcerer');
    let html = '<div class="st-grid">';
    for (let col = 1; col <= 4; col++) {
        html += '<div class="st-col">';
        for (let row = 1; row <= 3; row++) {
            const skill = SORC_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) { html += `<div class="st-node st-node-empty"></div>`; continue; }
            const pts     = sPts(skill.id);
            const maxed   = pts >= skill.max;
            const prereqs = sPrereqsMet(skill);
            const lvlOk   = level >= skill.reqLevel;
            const extraLock = skill.id === 201 && !gfbUnlocked;
            const cost    = skill.costs[pts] ?? 0;
            const canBuy  = !maxed && prereqs && lvlOk && !extraLock && gold >= cost;
            const locked  = !prereqs || !lvlOk || extraLock;
            let cls = 'st-node';
            if (maxed)       cls += ' st-node-maxed';
            else if (locked) cls += ' st-node-locked';
            else if (canBuy) cls += ' st-node-available';
            else             cls += ' st-node-unaffordable';
            const connector = row > 1
                ? `<div class="st-connector ${prereqs ? 'st-conn-open' : 'st-conn-locked'}">&#9660;</div>`
                : '';
            const reqChips = [];
            if (skill.reqLevel > 1) reqChips.push(`<span class="st-req ${lvlOk ? 'st-req-met' : 'st-req-fail'}">Lv.${skill.reqLevel}</span>`);
            skill.prereqs.forEach(pid => {
                const pname = SORC_SKILLS.find(s => s.id === pid)?.name || `Skill ${pid}`;
                reqChips.push(`<span class="st-req ${sPts(pid) >= 1 ? 'st-req-met' : 'st-req-fail'}">${pname}</span>`);
            });
            if (skill.id === 201) reqChips.push(`<span class="st-req ${gfbUnlocked ? 'st-req-met' : 'st-req-fail'}">Fireball</span>`);
            const reqsHTML = reqChips.length ? `<div class="st-node-reqs">${reqChips.join('')}</div>` : '';
            html += `
                ${connector}
                <div class="${cls}" data-id="${skill.id}" title="${skill.desc}">
                    <div class="st-node-header">
                        <span class="st-node-name">${skill.name}</span>
                        <span class="st-node-pts ${maxed ? 'st-pts-maxed' : ''}">${pts}/${skill.max}</span>
                    </div>
                    <div class="st-node-desc">${skill.desc}</div>
                    ${reqsHTML}
                    ${!maxed
                        ? `<button class="st-buy-btn" onclick="buySorcSkill(${skill.id})" ${canBuy ? '' : 'disabled'}>${fmtCost(cost)}g</button>`
                        : `<div class="st-node-maxed-label">MAXED</div>`
                    }
                </div>`;
        }
        html += '</div>';
    }
    html += '</div>';
    pane.innerHTML = html;
}

function effectiveBasicCooldown() { return BASIC_COOLDOWN_MS * (ascendedClass === 'knight' ? (1 - kPts(101) * 0.1) : 1) * (powerStanceActive ? 0.5 : 1) * potionCdrMult(); }
function effectiveAutoCooldown()  { return AUTO_COOLDOWN_MS  * (ascendedClass === 'knight' ? (1 - kPts(102) * 0.1) : 1) * (powerStanceActive ? 0.5 : 1) * potionCdrMult(); }
function effectiveGfbCooldown()   { return GFB_COOLDOWN_MS * (1 - skillPts(11) * 0.1) * potionCdrMult(); }
function sorcVolatileBlast()      { return sPts(202) >= 1; }
function effectiveUeCooldown()    { return UE_COOLDOWN_MS * (1 - sPts(206) * 0.1) * potionCdrMult(); }
function effectivePsCooldown()    { return POWER_STANCE_COOLDOWN_MS * (1 - sPts(212) * 0.1) * potionCdrMult(); }
function effectiveAnniCooldown()  { return ANNIHILATION_COOLDOWN_MS * (1 - kPts(106) * 0.1) * potionCdrMult(); }

// ── Progress save / load ─────────────────────────────────────────
function getProgress() {
    return {
        score, gold, exp, level, weaponIndex,
        skillPoints, knightSkillPts, sorcSkillPts,
        gfbUnlocked, ueUnlocked,
        powerStanceUnlocked, powerStanceCooldownEnd,
        autoUnlocked, autoEnabled,
        autoGfbUnlocked, autoGfbEnabled,
        autoUeUnlocked,  autoUeEnabled,
        autoPsEnabled,
        autoAnniEnabled,
        bossFocusUnlocked,
        ascended, ascendedClass,
        annihilationUnlocked,
        bossSpawnCounter,
        bossKillCounter,
        // firstBossSpawned (legacy) 
        totalClicks,
        inventory,
        potionWealthEnd, potionWisdomEnd, potionSwiftnessEnd,
        potionMedWealthEnd, potionMedWisdomEnd, potionMedSwiftnessEnd,
        potionMadnessEnd, potionDangerEnd,
        currentArea, unlockedAreas,
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
        if (s.weaponIndex      != null) {
            // v4 migration: remap old 5-weapon indices to new 15-weapon list
            const _WPN_MIGRATE = [2, 4, 7, 11, 12];
            let wi = s.weaponIndex;
            if ((s.stateVersion || 0) < 4 && wi < _WPN_MIGRATE.length) wi = _WPN_MIGRATE[wi];
            weaponIndex = Math.min(wi, WEAPONS.length - 1);
        }
        if (s.skillPoints      != null) skillPoints      = s.skillPoints;
        if (s.knightSkillPts       != null) knightSkillPts       = s.knightSkillPts;
        if (s.sorcSkillPts         != null) sorcSkillPts         = s.sorcSkillPts;
        if (s.powerStanceUnlocked  != null) powerStanceUnlocked  = s.powerStanceUnlocked;
        if (s.powerStanceCooldownEnd != null) powerStanceCooldownEnd = s.powerStanceCooldownEnd;
        // legacy migration: old upgrade fields → skill points ignored (fresh start for skill tree)
        if (s.gfbUnlocked      != null) gfbUnlocked      = s.gfbUnlocked;
        if (s.ueUnlocked       != null) ueUnlocked       = s.ueUnlocked;
        if (s.autoUnlocked     != null) autoUnlocked     = s.autoUnlocked;
        if (s.autoEnabled      != null) autoEnabled      = s.autoEnabled;
        if (s.autoGfbUnlocked  != null) autoGfbUnlocked  = s.autoGfbUnlocked;
        if (s.autoGfbEnabled   != null) autoGfbEnabled   = s.autoGfbEnabled;
        if (s.autoUeUnlocked   != null) autoUeUnlocked   = s.autoUeUnlocked;
        if (s.autoUeEnabled    != null) autoUeEnabled    = s.autoUeEnabled;
        if (s.autoPsEnabled    != null) autoPsEnabled    = s.autoPsEnabled;
        if (s.autoAnniEnabled  != null) autoAnniEnabled  = s.autoAnniEnabled;
        if (s.bossFocusUnlocked!= null) bossFocusUnlocked= s.bossFocusUnlocked;
        if (s.ascended             != null) { ascended = s.ascended; applyMobConfig(); }
        if (s.ascendedClass         != null) ascendedClass         = s.ascendedClass;
        if (s.annihilationUnlocked  != null) annihilationUnlocked  = s.annihilationUnlocked;
        if (s.bossSpawnCounter      != null) bossSpawnCounter      = s.bossSpawnCounter;
        if (s.bossKillCounter        != null) bossKillCounter        = s.bossKillCounter;
        // legacy: firstBossSpawned is no longer used
        if (s.totalClicks             != null) totalClicks           = s.totalClicks;
        if (s.inventory        != null) inventory        = Object.assign({}, inventory, s.inventory);
        if (s.potionWealthEnd       != null) potionWealthEnd       = s.potionWealthEnd;
        if (s.potionWisdomEnd       != null) potionWisdomEnd       = s.potionWisdomEnd;
        if (s.potionSwiftnessEnd    != null) potionSwiftnessEnd    = s.potionSwiftnessEnd;
        if (s.potionMedWealthEnd    != null) potionMedWealthEnd    = s.potionMedWealthEnd;
        if (s.potionMedWisdomEnd    != null) potionMedWisdomEnd    = s.potionMedWisdomEnd;
        if (s.potionMedSwiftnessEnd != null) potionMedSwiftnessEnd = s.potionMedSwiftnessEnd;
        if (s.potionMadnessEnd      != null) potionMadnessEnd      = s.potionMadnessEnd;
        if (s.potionDangerEnd       != null) potionDangerEnd       = s.potionDangerEnd;
        if (s.currentArea           != null) currentArea           = s.currentArea;
        if (s.unlockedAreas         != null) unlockedAreas         = Array.isArray(s.unlockedAreas) ? s.unlockedAreas : ['Rookgaard'];
    } catch (_) {}
    applyMobConfig();
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
    let wormHp        = MOB_MAXHP;
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
        gainExp  += MOB_EXP;
        const avgGold = MOB_GOLD_MAX / 2;
        gainGold += avgGold;
        gold     += avgGold;
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
                wormHp       = MOB_MAXHP;
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
                wormHp       = MOB_MAXHP;
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
                    wormHp = MOB_MAXHP;
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
    applyMobConfig();

    // Migration: existing ascended saves without a class choice
    if (ascended && !ascendedClass) {
        setTimeout(() => {
            document.getElementById('class-modal').style.display = 'flex';
        }, 300);
    }

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
    document.getElementById('hud-player').textContent = authUsername;
    document.getElementById('logoutBtn').textContent = 'Logout';
    chatInit(true);
    if (!gameStarted) {
        gameStarted = true;
        loop();
        _saveTimer = setInterval(saveProgress, 30000);
        _sbTimer   = setInterval(fetchScoreboard, 60000);
        fetchScoreboard();
    }
}

async function doLogout() {
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

// ── Fireball cast (shared by manual button + auto-GFB) ───────────────────────────
function castGfb() {
    if (!gfbUnlocked || fireballActive || spawnPaused) return false;
    if (Date.now() < gfbCooldownEnd || gold < GFB_GOLD_COST) return false;
    const candidates = [...worms, ...(boss ? [boss] : [])];
    if (candidates.length === 0) return false;
    const upgraded = sorcGfbUpgraded();
    const radius = 200;
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
                if (upgraded) { killWorm(w); return false; }
                const fbDmg = Math.ceil(MOB_MAXHP * 0.5);
                w.hp -= fbDmg;
                dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: fbDmg, color: '#8b0000', life: 60 });
                if (w.hp <= 0) { killWorm(w); return false; }
            }
            return true;
        });
        if (upgraded && boss && sorcVolatileBlast()) {
            // Volatile Blast: always hits boss for 50% max HP regardless of range
            const vbDmg = Math.floor(boss.maxHp * 0.5);
            boss.hp -= vbDmg;
            dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: vbDmg, color: '#8b0000', life: 60 });
            if (boss.hp <= 0) killBoss(boss);
        }
        // Double Fireball (sorc skill 203) — fire a second fireball at next best cluster
        if (sorcDoubleGfb() && (worms.length > 0 || boss)) {
            const alive2 = [...worms, ...(boss ? [boss] : [])];
            let t2 = alive2[0], best2 = 0;
            for (const c of alive2) {
                const cnt = alive2.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < radius).length;
                if (cnt > best2) { best2 = cnt; t2 = c; }
            }
            spawnEffect(t2.x, t2.y, radius);
            const gx = t2.x, gy = t2.y;
            setTimeout(() => {
                worms = worms.filter(w => {
                    const dx = w.x - gx, dy = w.y - gy;
                    if (Math.hypot(dx, dy) < radius) {
                        if (upgraded) { killWorm(w); return false; }
                        const fbDmg = Math.ceil(MOB_MAXHP * 0.5);
                        w.hp -= fbDmg;
                        dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: fbDmg, color: '#8b0000', life: 60 });
                        if (w.hp <= 0) { killWorm(w); return false; }
                    }
                    return true;
                });
                if (upgraded && boss && sorcVolatileBlast()) {
                    const vbDmg = Math.floor(boss.maxHp * 0.5);
                    boss.hp -= vbDmg;
                    dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: vbDmg, color: '#8b0000', life: 60 });
                    if (boss.hp <= 0) killBoss(boss);
                }
                spawnPaused = false;
            }, 300);
        } else {
            spawnPaused = false;
        }
    }, 300);
    return true;
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
    if (worms.length >= skillMonsterCap()) return; // cap from skill tree (base 10)
    const size = MOB_SIZE;
    const margin = size + 8; // keep worm fully inside the canvas
    const minDist = size * 2 + 6; // minimum center-to-center distance (no overlap, small gap)
    for (let attempt = 0; attempt < 15; attempt++) {
        const x = margin + Math.random() * (canvas.width  - margin * 2);
        const y = margin + Math.random() * (canvas.height - margin * 2);
        const tooClose = worms.some(w => Math.hypot(w.x - x, w.y - y) < minDist)
                      || (boss && Math.hypot(boss.x - x, boss.y - y) < size + BOSS_SIZE + 6);
        if (!tooClose) {
            worms.push({ x, y, size, hp: MOB_MAXHP, _id: ++_eid });
            return;
        }
    }
    // no valid position found this frame — skip; next frame will retry
}

function spawnBoss() {
    if (boss) return;
    const isUber  = skillUberBossEnabled() && bossKillCounter > 0 && bossKillCounter % UBER_BOSS_EVERY === 0;
    const baseSz  = ascended ? Math.round(BOSS_SIZE * 1.5) : BOSS_SIZE;
    const sz      = isUber ? baseSz * 2 : baseSz;
    const hp     = isUber ? BOSS_HP   * 2 : BOSS_HP;
    const margin = sz + 8;
    boss = {
        x: margin + Math.random() * (canvas.width  - margin * 2),
        y: margin + Math.random() * (canvas.height - margin * 2),
        size: sz,
        hp: hp,
        maxHp: hp,
        isUber: isUber,
        _id: ++_eid,
    };
}

function killWorm(w) {
    score += MOB_KILLS;
    const expGain  = Math.floor(MOB_EXP  * skillExpMult() * potionExpMult());
    const goldBase = MOB_GOLD_MIN + Math.floor(Math.random() * (MOB_GOLD_MAX - MOB_GOLD_MIN + 1));
    const goldGain = Math.floor(goldBase * skillGoldMult() * potionGoldMult());
    exp  += expGain;
    gold += goldGain;
    checkLevelUp();
    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 18, value: expGain, color: 'white', life: 80 });
    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 32, value: goldGain, color: '#f0c040', life: 80 });
    // Loot drop
    const _wd = rollDrops(ascended ? CYCLOPS_DROPS : ROTWORM_DROPS, false, false);
    let _wq = 0;
    _wd.forEach(({ k, qty }) => { inventory[k] = (inventory[k] || 0) + qty; _wq += qty; });
    if (_wq > 0) dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 46, value: '+' + _wq, color: '#5599ff', life: 80 });
    bossSpawnCounter++;
    // Spawn boss once per interval (based on kill count). Reset counter when boss appears.
    if (!boss && bossSpawnCounter >= skillBossInterval()) {
        bossSpawnCounter = 0;
        spawnBoss();
    }
    // Cooldown reset proc (skill 6)
    if (skillCdResetEnabled() && Math.random() < 0.01) {
        gfbCooldownEnd  = 0;
        ueCooldownEnd   = 0;
        annihilationCooldownEnd = 0;
        powerStanceCooldownEnd  = 0;
    }
}

function killBoss(b) {
    score += BOSS_KILLS;
    const rewardMult = b.isUber ? 2 : 1;
    const expGain  = Math.floor(BOSS_EXP  * skillExpMult()  * rewardMult * potionExpMult());
    const goldGain = Math.floor(BOSS_GOLD * skillGoldMult() * rewardMult * potionGoldMult());
    exp  += expGain;
    gold += goldGain;
    checkLevelUp();
    dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 18, value: expGain, color: '#ffd700', life: 100 });
    dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 32, value: goldGain, color: '#f0c040', life: 100 });
    // Loot drop
    const _bd = rollDrops(ascended ? CYCLOPS_BOSS_DROPS : ROTWORM_BOSS_DROPS, b.isUber, true);
    let _bq = 0;
    _bd.forEach(({ k, qty }) => { inventory[k] = (inventory[k] || 0) + qty; _bq += qty; });
    if (_bq > 0) dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 46, value: '+' + _bq, color: '#5599ff', life: 100 });
    bossKillCounter++;
    boss = null;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw tiled floor (changes with current area)
    const activeFloor = floorImg;
    if (activeFloor.complete && activeFloor.naturalWidth > 0) {
        for (let row = 0; row < TILE_ROWS; row++) {
            for (let col = 0; col < TILE_COLS; col++) {
                const tx = col * TILE;
                const ty = row * TILE;
                const { flipH, flipV } = floorMap[row][col];
                ctx.save();
                ctx.translate(tx, ty);
                if (flipH) { ctx.translate(TILE, 0); ctx.scale(-1, 1); }
                if (flipV) { ctx.translate(0, TILE); ctx.scale(1, -1); }
                ctx.drawImage(activeFloor, 0, 0, TILE, TILE);
                ctx.restore();
            }
        }
    }
    const area = getCurrentArea();
    worms.forEach(w => {
        // sprite drawn as DOM <img> via syncSpriteLayer() — only draw HP bar here
        const barW = 40;
        const barH = 4;
        const barX = w.x - 20;
        const barOffset = area.hpBarOffset || 8;
        const barY = w.y - w.size - barOffset;
        const hpRatio = w.hp / MOB_MAXHP;
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpBarColor(hpRatio);
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // Monster name above health bar
        ctx.save();
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = hpBarColor(hpRatio);
        ctx.fillText(area.mobName || '', w.x, barY - 4);
        ctx.restore();
    });
    // draw boss
    if (boss) {
        // sprite drawn as DOM <img> via syncSpriteLayer()
        // boss HP bar (wider, red/orange)
        const bBarW = boss.size * 2;
        const bBarH = 6;
        const bBarX = boss.x - boss.size;
        const bBarOffset = area.bossBarOffset != null ? area.bossBarOffset : 10;
        const bBarY = boss.y - boss.size - bBarOffset;
        const bHpRatio = boss.hp / boss.maxHp;
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(bBarX, bBarY, bBarW, bBarH);
        ctx.fillStyle = hpBarColor(bHpRatio);
        ctx.fillRect(bBarX, bBarY, bBarW * bHpRatio, bBarH);
        // boss label (use area name, but preserve Uber label)
        ctx.save();
        ctx.font = boss.isUber ? 'bold 12px Verdana, sans-serif' : 'bold 10px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = hpBarColor(bHpRatio);
        const bossLabel = boss.isUber ? `UBER ${area.bossName || 'BOSS'}` : (area.bossName || 'BOSS');
        ctx.fillText(bossLabel, boss.x, bBarY - 4);
        ctx.restore();
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
    // Double Strike — highlight second target too
    if (autoEnabled && skillDoubleAuto()) {
        const second = _pickAutoTarget([autoTarget]);
        if (second) {
            ctx.save();
            ctx.strokeStyle = '#dd88ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(second.x, second.y, second.size + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    // level-up message (canvas only)
    if (levelUpMsg > 0) {
        ctx.globalAlpha = Math.min(levelUpMsg / 30, 1);
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 32px Verdana, sans-serif';
        ctx.fillText(`LEVEL UP! (${level})`, canvas.width / 2 - 100, canvas.height / 2);
        ctx.globalAlpha = 1;
    }
    // ascension message
    if (ascendMsg > 0) {
        const className = ascendedClass === 'knight' ? 'KNIGHT' : 'SORCERER';
        ctx.globalAlpha = Math.min(ascendMsg / 40, 1);
        ctx.fillStyle = '#ffe066';
        ctx.font = 'bold 28px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`\u2726 ASCENDED \u2014 ${className} \u2726`, canvas.width / 2, canvas.height / 2 - 36);
        ctx.font = '16px Verdana, sans-serif';
        ctx.fillStyle = '#ffcc33';
        ctx.fillText('Cyclops Realm \u2014 Stronger monsters, greater rewards!', canvas.width / 2, canvas.height / 2 - 6);
        ctx.textAlign = 'left';
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
    syncSpriteLayer();
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
        // delay worm removal until fireball animation completes
        setTimeout(() => {
            worms = worms.filter(w => {
                const dx = w.x - mx;
                const dy = w.y - my;
                if (Math.hypot(dx, dy) < radius) {
                    const fbDmg = Math.ceil(MOB_MAXHP * 0.5);
                    w.hp -= fbDmg;
                    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: fbDmg, color: '#8b0000', life: 60 });
                    if (w.hp <= 0) { killWorm(w); return false; }
                }
                return true;
            });
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
            totalClicks++;
            const dmg = rollBasicDmg();
            boss.hp -= dmg;
            spawnAttackEffect(boss.x, boss.y);
            dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
            if (boss.hp <= 0) killBoss(boss);
            return;
        }
    }
    {
        let clickedWorm = null;
        for (const w of worms) {
            const dx = w.x - mx;
            const dy = w.y - my;
            if (Math.hypot(dx, dy) < w.size) { clickedWorm = w; break; }
        }
        if (clickedWorm) {
            lastBasicAttack = now;
            totalClicks++;
            const dmg = rollBasicDmg();
            clickedWorm.hp -= dmg;
            spawnAttackEffect(clickedWorm.x, clickedWorm.y);
            dmgNumbers.push({ x: clickedWorm.x + (Math.random()*20-10), y: clickedWorm.y - clickedWorm.size, value: dmg, color: '#8b0000', life: 60 });
            if (clickedWorm.hp <= 0) killWorm(clickedWorm);
            worms = worms.filter(w => w.hp > 0);
        }
    }
});

function update() {
    if (!spawnPaused && Math.random() < (potionMadnessActive() ? 0.2 : 0.02)) spawnWorm();
    // auto attack logic — merged worm + boss targeting
    if (autoEnabled) {
        const now = Date.now();
        if (now - lastAutoAttack >= effectiveAutoCooldown()) {
            if (bossFocusUnlocked && boss) {
                // boss focus: always hit boss first when alive
                lastAutoAttack = now;
                const dmg = rollBasicDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            } else if (worms.length > 0) {
                lastAutoAttack = now;
                if (!autoTarget || !worms.includes(autoTarget)) autoTarget = _pickAutoTarget();
                if (autoTarget) {
                    const dmg = rollBasicDmg();
                    autoTarget.hp -= dmg;
                    spawnAttackEffect(autoTarget.x, autoTarget.y);
                    dmgNumbers.push({ x: autoTarget.x + (Math.random()*20-10), y: autoTarget.y - autoTarget.size, value: dmg, color: '#8b0000', life: 60 });
                    if (autoTarget.hp <= 0) {
                        killWorm(autoTarget);
                        worms = worms.filter(w => w !== autoTarget);
                        autoTarget = _pickAutoTarget();
                    }
                    // Double Strike (general skill 9) — hit a second worm
                    if (skillDoubleAuto()) {
                        const second = _pickAutoTarget([autoTarget]);
                        if (second) {
                            const dmg2 = rollBasicDmg();
                            second.hp -= dmg2;
                            spawnAttackEffect(second.x, second.y);
                            dmgNumbers.push({ x: second.x + (Math.random()*20-10), y: second.y - second.size, value: dmg2, color: '#8b0000', life: 60 });
                            if (second.hp <= 0) {
                                killWorm(second);
                                worms = worms.filter(w => w !== second);
                                if (autoTarget && !worms.includes(autoTarget)) autoTarget = worms.length > 0 ? worms[0] : null;
                            }
                        }
                    }
                    // Extra Auto Target (knight skill 103) — hit one more worm
                    if (knightExtraAutoTarget()) {
                        const _secondRef = skillDoubleAuto() ? _pickAutoTarget([autoTarget]) : null;
                        const third = _pickAutoTarget([autoTarget, _secondRef].filter(Boolean));
                        if (third) {
                            const dmg3 = rollBasicDmg();
                            third.hp -= dmg3;
                            spawnAttackEffect(third.x, third.y);
                            dmgNumbers.push({ x: third.x + (Math.random()*20-10), y: third.y - third.size, value: dmg3, color: '#8b0000', life: 60 });
                            if (third.hp <= 0) {
                                killWorm(third);
                                worms = worms.filter(w => w !== third);
                            }
                        }
                    }
                }
            } else if (boss) {
                // no worms — attack boss even without boss focus
                lastAutoAttack = now;
                const dmg = rollBasicDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            }
        }
    }
    // Auto Annihilation (knight skill 105)
    if (knightAutoAnniOn() && annihilationUnlocked && boss && !boss.isUber && Date.now() >= annihilationCooldownEnd) {
        annihilationCooldownEnd = Date.now() + effectiveAnniCooldown();
        killBoss(boss);
    }
    // auto GFB logic
    if (autoGfbEnabled && gfbUnlocked && (worms.length > 0 || boss) && !fireballActive && !spawnPaused &&
            Date.now() >= gfbCooldownEnd && gold >= GFB_GOLD_COST) {
        castGfb();
    }
    // auto UE logic — fires whenever off cooldown, boss immune (Sorcerer only)
    if (autoUeEnabled && ueUnlocked && ascendedClass === 'sorcerer' && !spawnPaused && Date.now() >= ueCooldownEnd) {
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
    // Power Stance deactivation
    if (powerStanceActive && Date.now() >= powerStanceEnd) {
        powerStanceActive = false;
    }
    // Auto Power Stance (sorc skill 211)
    if (powerStanceUnlocked && sorcAutoPs() && !powerStanceActive && Date.now() >= powerStanceCooldownEnd) {
        powerStanceActive      = true;
        powerStanceEnd         = Date.now() + POWER_STANCE_DURATION_MS;
        powerStanceCooldownEnd = powerStanceEnd + effectivePsCooldown();
    }
    // float damage numbers upward and expire
    dmgNumbers.forEach(d => { d.y -= 1; d.life--; });
    dmgNumbers = dmgNumbers.filter(d => d.life > 0);
    if (levelUpMsg > 0) levelUpMsg--;
    if (ascendMsg  > 0) ascendMsg--;
    // update Fireball button (all classes when unlocked)
    if (gfbUnlocked) {
        const fbRemaining = Math.max(0, gfbCooldownEnd - Date.now());
        const fbBtnEl = document.getElementById('fireballBtn');
        const fbName = sorcGfbUpgraded() ? 'Great Fireball' : 'Fireball';
        if (fbRemaining > 0) {
            fbBtnEl.textContent = `🔥 ${fbName} (${(fbRemaining / 1000).toFixed(1)}s)`;
            fbBtnEl.disabled = true;
        } else {
            fbBtnEl.textContent = `🔥 ${fbName}`;
            fbBtnEl.disabled = worms.length === 0 && !boss;
        }
        document.getElementById('cd-fire-bar').style.width  = fbRemaining > 0 ? ((1 - fbRemaining / effectiveGfbCooldown()) * 100) + '%' : '100%';
        document.getElementById('cd-fire-text').textContent = fbRemaining > 0 ? (fbRemaining / 1000).toFixed(1) + 's' : 'Ready';
    }
    // update UE + Power Stance buttons (Sorcerer only)
    if (ascendedClass === 'sorcerer') {
        const ueRemaining = Math.max(0, ueCooldownEnd - Date.now());
        const ueBtnEl = document.getElementById('ultimateExplosionBtn');
        const ueIcon = `<img src="Ultimate_Explosion.gif" class="btn-icon">`;
        if (!ueUnlocked) {
            ueBtnEl.innerHTML = `${ueIcon} Ultimate Explosion (unlock in Skill Tree)`;
            ueBtnEl.disabled = true;
        } else if (ueRemaining > 0) {
            ueBtnEl.innerHTML = `${ueIcon} Ultimate Explosion (${(ueRemaining / 1000).toFixed(1)}s)`;
            ueBtnEl.disabled = true;
        } else {
            ueBtnEl.innerHTML = `${ueIcon} Ultimate Explosion`;
            ueBtnEl.disabled = false;
        }
        document.getElementById('cd-ue-bar').style.width  = ueUnlocked && ueRemaining > 0 ? ((1 - ueRemaining / effectiveUeCooldown()) * 100) + '%' : (ueUnlocked ? '100%' : '0%');
        document.getElementById('cd-ue-text').textContent = !ueUnlocked ? 'Locked' : (ueRemaining > 0 ? (ueRemaining / 1000).toFixed(1) + 's' : 'Ready');
        // Auto UE button
        const autoUeEl = document.getElementById('autoUeBtn');
        if (!autoUeUnlocked) {
            autoUeEl.textContent = 'Auto UE (unlock in Skill Tree)';
            autoUeEl.disabled = true;
            autoUeEl.classList.remove('auto-on');
        } else {
            autoUeEl.textContent = autoUeEnabled ? 'Auto UE: ON' : 'Auto UE: OFF';
            autoUeEl.disabled = false;
            autoUeEl.classList.toggle('auto-on', autoUeEnabled);
        }
        // Power Stance button
        const psRemaining = Math.max(0, powerStanceCooldownEnd - Date.now());
        const psBtnEl = document.getElementById('powerStanceBtn');
        if (!powerStanceUnlocked) {
            psBtnEl.innerHTML = '&#9889; Power Stance (unlock in Skill Tree)';
            psBtnEl.disabled = true;
        } else if (powerStanceActive) {
            const psLeft = Math.max(0, powerStanceEnd - Date.now());
            psBtnEl.innerHTML = `&#9889; Power Stance: ACTIVE (${Math.ceil(psLeft / 1000)}s)`;
            psBtnEl.disabled = true;
        } else if (psRemaining > 0) {
            psBtnEl.innerHTML = `&#9889; Power Stance (${Math.ceil(psRemaining / 1000)}s)`;
            psBtnEl.disabled = true;
        } else {
            psBtnEl.innerHTML = '&#9889; Power Stance';
            psBtnEl.disabled = false;
        }
        const postActiveRemaining = powerStanceActive ? effectivePsCooldown() : psRemaining;
        document.getElementById('cd-ps-bar').style.width  = powerStanceUnlocked && postActiveRemaining > 0 ? ((1 - postActiveRemaining / effectivePsCooldown()) * 100) + '%' : ((powerStanceUnlocked && !powerStanceActive) ? '100%' : '0%');
        document.getElementById('cd-ps-text').textContent = !powerStanceUnlocked ? 'Locked' : (powerStanceActive ? `Active (${Math.ceil(Math.max(0, powerStanceEnd - Date.now()) / 1000)}s)` : (psRemaining > 0 ? Math.ceil(psRemaining / 1000) + 's' : 'Ready'));
        // Auto Power Stance button
        const autoPsEl = document.getElementById('autoPsBtn');
        if (sPts(211) < 1) {
            autoPsEl.textContent = 'Auto Power Stance (unlock in Skill Tree)';
            autoPsEl.disabled = true;
            autoPsEl.classList.remove('auto-on');
        } else {
            autoPsEl.textContent = autoPsEnabled ? 'Auto Power Stance: ON' : 'Auto Power Stance: OFF';
            autoPsEl.disabled = false;
            autoPsEl.classList.toggle('auto-on', autoPsEnabled);
        }
    }
    // update Annihilation button (Knight only)
    if (ascendedClass === 'knight') {
        const anniRemaining = Math.max(0, annihilationCooldownEnd - Date.now());
        const anniBtnEl = document.getElementById('annihilationBtn');
        const anniIcon = `<img src="annihilation.gif" class="btn-icon">`;
        if (!annihilationUnlocked) {
            anniBtnEl.innerHTML = `${anniIcon} Annihilation (unlock in Skill Tree)`;
            anniBtnEl.disabled = true;
        } else if (anniRemaining > 0) {
            anniBtnEl.innerHTML = `${anniIcon} Annihilation (${Math.ceil(anniRemaining / 1000)}s)`;
            anniBtnEl.disabled = true;
        } else {
            anniBtnEl.innerHTML = `${anniIcon} Annihilation`;
            anniBtnEl.disabled = !boss || boss.isUber;
        }
        // Auto Annihilation button
        const autoAnniEl = document.getElementById('autoAnniBtn');
        if (kPts(105) < 1) {
            autoAnniEl.textContent = 'Auto Annihilation (unlock in Skill Tree)';
            autoAnniEl.disabled = true;
            autoAnniEl.classList.remove('auto-on');
        } else {
            autoAnniEl.textContent = autoAnniEnabled ? 'Auto Annihilation: ON' : 'Auto Annihilation: OFF';
            autoAnniEl.disabled = false;
            autoAnniEl.classList.toggle('auto-on', autoAnniEnabled);
        }
        document.getElementById('cd-anni-bar').style.width  = annihilationUnlocked && anniRemaining > 0 ? ((1 - anniRemaining / effectiveAnniCooldown()) * 100) + '%' : (annihilationUnlocked ? '100%' : '0%');
        document.getElementById('cd-anni-text').textContent = !annihilationUnlocked ? 'Locked' : (anniRemaining > 0 ? Math.ceil(anniRemaining / 1000) + 's' : (boss ? 'Ready' : 'No boss'));
        // Whirlwind CD bar — no longer used (skill removed)
        const wwWrap = document.getElementById('cd-whirlwind-wrap');
        if (wwWrap) wwWrap.style.display = 'none';
    }
    // cooldown bars
    const basicElapsed = Date.now() - lastBasicAttack;
    const basicFrac = Math.min(basicElapsed / effectiveBasicCooldown(), 1);
    document.getElementById('cd-basic-bar').style.width  = (basicFrac * 100) + '%';
    document.getElementById('cd-basic-text').textContent = basicFrac >= 1 ? 'Ready' : (((effectiveBasicCooldown() - basicElapsed) / 1000).toFixed(1) + 's');
    // update Ascend button
    const ascendBtn = document.getElementById('ascendBtn');
    if (ascendBtn) {
        if (ascended) {
            const cName = ascendedClass === 'knight' ? 'Knight' : 'Sorcerer';
            ascendBtn.textContent = `✦ Ascended — ${cName}`;
            ascendBtn.disabled = true;
        } else if (level >= ASCEND_LEVEL) {
            ascendBtn.textContent = `✦ Ascend (lvl ${ASCEND_LEVEL} reached!)`;
            ascendBtn.disabled = false;
        } else {
            ascendBtn.textContent = `✦ Ascend (need lvl ${ASCEND_LEVEL})`;
            ascendBtn.disabled = true;
        }
    }
    // Refresh crafting modal once per second while open
    if (document.getElementById('crafting-modal').style.display !== 'none') {
        const _cs = Math.floor(Date.now() / 1000);
        if (_cs !== _lastCraftRenderSec) { _lastCraftRenderSec = _cs; renderCrafting(); }
    }
}
// weapon upgrade button
const weaponUpgradeBtn = document.getElementById('weaponUpgradeBtn');
weaponUpgradeBtn.addEventListener('click', () => {
    const next = WEAPONS[weaponIndex + 1];
    if (!next || gold < next.cost || level < next.minLevel) return;
    gold -= next.cost;
    weaponIndex++;
});

// Area unlock button
const areaUnlockBtn = document.getElementById('areaUnlockBtn');
if (areaUnlockBtn) {
    areaUnlockBtn.addEventListener('click', () => {
        const next = getNextArea();
        if (!next) return;
        if (!canUnlockNextArea()) return;
        gold -= next.goldCost;
        currentArea = next.id;
        if (!unlockedAreas.includes(next.id)) unlockedAreas.push(next.id);
        // Reset the fight state when moving to a new area.
        worms = [];
        boss = null;
        bossSpawnCounter = 0;
        bossKillCounter = 0;
        applyMobConfig();
        saveProgress();
    });
}

// Fireball / Great Fireball button (all classes when fireball unlocked)
document.getElementById('fireballBtn').addEventListener('click', () => {
    castGfb();
});

// ultimate explosion button
const ueBtn = document.getElementById('ultimateExplosionBtn');
ueBtn.addEventListener('click', () => {
    if (ascendedClass !== 'sorcerer' || !ueUnlocked) return;
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

// Annihilation button (Knight only — unlocked via Skill Tree, skill 104)
document.getElementById('annihilationBtn').addEventListener('click', () => {
    if (ascendedClass !== 'knight' || !annihilationUnlocked) return;
    if (!boss || boss.isUber || Date.now() < annihilationCooldownEnd) return;
    annihilationCooldownEnd = Date.now() + effectiveAnniCooldown();
    killBoss(boss);
});

// auto attack button — pure toggle (unlock via Skill Tree)
document.getElementById('autoAttackBtn').addEventListener('click', () => {
    if (!autoUnlocked) return;
    autoEnabled = !autoEnabled;
    if (!autoEnabled) autoTarget = null;
});

// boss focus button — always-on once unlocked via Skill Tree (no click action)
document.getElementById('bossFocusBtn').addEventListener('click', () => {});

// auto fireball button — toggle (unlock via Skill Tree, skill 12)
document.getElementById('autoGfbBtn').addEventListener('click', () => {
    if (!autoGfbUnlocked) return;
    autoGfbEnabled = !autoGfbEnabled;
});

document.getElementById('autoUeBtn').addEventListener('click', () => {
    if (!autoUeUnlocked) return;
    autoUeEnabled = !autoUeEnabled;
});

document.getElementById('autoAnniBtn').addEventListener('click', () => {
    if (kPts(105) < 1) return;
    autoAnniEnabled = !autoAnniEnabled;
});

document.getElementById('autoPsBtn').addEventListener('click', () => {
    if (sPts(211) < 1) return;
    autoPsEnabled = !autoPsEnabled;
});

document.getElementById('powerStanceBtn').addEventListener('click', () => {
    if (!powerStanceUnlocked || powerStanceActive || Date.now() < powerStanceCooldownEnd) return;
    powerStanceActive      = true;
    powerStanceEnd         = Date.now() + POWER_STANCE_DURATION_MS;
    powerStanceCooldownEnd = powerStanceEnd + effectivePsCooldown();
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
    const email    = document.getElementById('auth-reg-email').value.trim();
    const errEl    = document.getElementById('auth-reg-err');
    const btn      = e.currentTarget.querySelector('button[type=submit]');
    errEl.textContent = '';
    btn.disabled = true;
    try {
        const res  = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email }),
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

document.getElementById('forgotLink').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('auth-login-form').style.display   = 'none';
    document.getElementById('auth-reg-form').style.display     = 'none';
    document.getElementById('auth-tabs').style.display         = 'none';
    document.getElementById('auth-forgot-panel').style.display = '';
    document.getElementById('auth-forgot-email').value         = '';
    document.getElementById('auth-forgot-msg').textContent     = '';
});

document.getElementById('forgotBackLink').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('auth-forgot-panel').style.display = 'none';
    document.getElementById('auth-tabs').style.display         = '';
    switchAuthTab('login');
});

document.getElementById('auth-forgot-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-forgot-email').value.trim();
    const msgEl = document.getElementById('auth-forgot-msg');
    const btn   = document.getElementById('auth-forgot-btn');
    msgEl.style.color = '#e05050';
    msgEl.textContent = '';
    if (!email) { msgEl.textContent = 'Please enter your email address.'; return; }
    btn.disabled = true;
    try {
        await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        msgEl.style.color = '#7fff9e';
        msgEl.textContent = 'If an account with that email exists, a reset link has been sent.';
    } catch (_) {
        msgEl.textContent = 'Connection error.';
    }
    btn.disabled = false;
});

document.getElementById('logoutBtn').addEventListener('click', doLogout);

document.getElementById('ascendBtn').addEventListener('click', () => {
    if (!ascended && level >= ASCEND_LEVEL) openAscendModal();
});

initAuth();

// ── Announcement ─────────────────────────────────────────────
(function () {
    const VERSION = '2026-03-15-v2';
    if (localStorage.getItem('announcementDismissed') !== VERSION) {
        document.getElementById('announcement-overlay').classList.add('visible');
    }
})();

function closeAnnouncement() {
    localStorage.setItem('announcementDismissed', '2026-03-15-v2');
    document.getElementById('announcement-overlay').classList.remove('visible');
}

// ── Live Chat ─────────────────────────────────────────────────────
let _chatSource = null;

function _chatEscapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _chatAppend(msg) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const d   = new Date(msg.ts);
    const hh  = String(d.getHours()).padStart(2, '0');
    const mm  = String(d.getMinutes()).padStart(2, '0');
    const div = document.createElement('div');
    div.className   = 'chat-msg';
    div.innerHTML   =
        `<span class="chat-time">${hh}:${mm}</span> ` +
        `<span class="chat-user">${_chatEscapeHtml(msg.username)}</span>` +
        `<span class="chat-text">: ${_chatEscapeHtml(msg.text)}</span>`;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.appendChild(div);
    while (box.children.length > 200) box.removeChild(box.firstChild);
    if (atBottom) box.scrollTop = box.scrollHeight;
}

function _chatConnect() {
    if (_chatSource) { _chatSource.close(); _chatSource = null; }
    _chatSource = new EventSource('/api/chat/stream');
    _chatSource.onmessage = e => {
        try { _chatAppend(JSON.parse(e.data)); } catch (_) {}
    };
    _chatSource.onerror = () => {
        _chatSource.close();
        _chatSource = null;
        setTimeout(_chatConnect, 5000);
    };
}

function chatToggle() {
    const msgs   = document.getElementById('chat-messages');
    const footer = document.getElementById('chat-footer');
    const btn    = document.getElementById('chat-toggle-btn');
    const hidden = msgs && msgs.style.display === 'none';
    if (msgs)   msgs.style.display   = hidden ? '' : 'none';
    if (footer) footer.style.display = hidden ? '' : 'none';
    if (btn)    btn.textContent       = hidden ? '[hide]' : '[show]';
    try { localStorage.setItem('chatOpen', hidden ? '1' : '0'); } catch (_) {}
}

function chatInit(loggedIn) {
    const hint = document.getElementById('chat-login-hint');
    const row  = document.getElementById('chat-input-row');
    if (hint) hint.style.display = loggedIn ? 'none' : '';
    if (row)  row.style.display  = loggedIn ? ''     : 'none';
    // Restore saved open/closed preference (default: open)
    try {
        if (localStorage.getItem('chatOpen') === '0') {
            const msgs   = document.getElementById('chat-messages');
            const footer = document.getElementById('chat-footer');
            const btn    = document.getElementById('chat-toggle-btn');
            if (msgs)   msgs.style.display   = 'none';
            if (footer) footer.style.display = 'none';
            if (btn)    btn.textContent       = '[show]';
        }
    } catch (_) {}
    _chatConnect();
}

function chatSend() {
    const input = document.getElementById('chat-input');
    const text  = (input.value || '').trim();
    if (!text) return;
    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;
    fetch('/api/chat/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
        body:    JSON.stringify({ text }),
    }).then(r => r.json()).then(d => {
        if (d.ok) { input.value = ''; }
        else if (d.error) { console.warn('[chat]', d.error); }
    }).catch(() => {}).finally(() => { btn.disabled = false; });
}

document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') chatSend();
});

// Start chat for anyone (history is visible to guests; input is locked until login)
chatInit(!!authToken);

// ── Debug helpers (test server only) ─────────────────────────────
function debugAddExp() {
    exp += 10000;
    checkLevelUp();
    updateHUD();
}

function debugAddGold() {
    gold += 10000;
    updateHUD();
}

(function initDebugPanel() {
    const host = window.location.hostname;
    const isProd = host === 'rotworm-killer.up.railway.app' || host === 'rotwormkiller.com' || host === 'www.rotwormkiller.com';
    if (!isProd) {
        const panel = document.getElementById('debug-panel');
        if (panel) panel.style.display = '';

        const devTools = document.getElementById('dev-tools');
        if (devTools) {
            devTools.style.display = '';
            const addGoldBtn = document.getElementById('dev-add-gold');
            const addExpBtn  = document.getElementById('dev-add-exp');
            if (addGoldBtn) addGoldBtn.addEventListener('click', () => { gold += 1000000000; updateHUD(); });
            if (addExpBtn)  addExpBtn.addEventListener('click', () => { exp += 1000000000; checkLevelUp(); updateHUD(); });
        }
    }
})();