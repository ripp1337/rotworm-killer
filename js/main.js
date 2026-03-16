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
        mobSize: 36,
        bossName: 'Cave Rat',
        bossSprite: 'Cave_Rat.gif',
        hpBarOffset: 10,
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
        mobSize: 20,
        bossName: 'Versperoth',
        bossSprite: 'Versperoth.gif',
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
        mobSize: 40,
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
        mobSize: 42,
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
        mobSize: 48,
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
        mobSize: 40,
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
        mobSize: 40,
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
        mobSize: 40,
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
        mobSize: 40,
        bossName: 'Sight of Surrender',
        bossSprite: 'Sight_of_Surrender.gif',
    },
    {
        id: 'The Void',
        name: 'The Void',
        levelReq: 300,
        goldCost: 100000000,
        floor: 'Void.gif',
        mobName: 'Void Emissary',
        mobSprite: 'The_Unarmored_Voidborn.gif',
        mobHp: 30000,
        mobExp: 20000,
        mobGoldMin: 300,
        mobGoldMax: 500,
        mobSize: 40,
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
let MOB_SIZE   = 20;

function applyMobConfig() {
    const area = getCurrentArea();
    MOB_MAXHP  = area.mobHp;
    MOB_EXP    = area.mobExp;
    MOB_KILLS  = 1; // per-kill score multiplier
    MOB_GOLD_MIN = area.mobGoldMin;
    MOB_GOLD_MAX = area.mobGoldMax;
    MOB_SIZE   = area.mobSize || 20;
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
    // Auto-unlock fireball if already unlocked via skill tree (migration)
    if (skillPts(31) >= 1) { gfbUnlocked = true; autoGfbUnlocked = true; }
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
function rollBasicDmg() { return Math.ceil((basicDmgMin() + Math.floor(Math.random() * (basicDmgMax() - basicDmgMin() + 1))) * sorcEssenceGatheringMult()); }
function rollAutoDmg()  { return Math.ceil(rollBasicDmg() * skillAutoDmgMult()); }

// Knight click combat
function _processClick(isBoss) {
    return rollClickDmg(isBoss);
}

function rollClickDmg(isBoss) {
    let dmg = rollBasicDmg();
    if (ascendedClass === 'knight') {
        // K1 Strike Training: +20%/pt click damage
        let mult = 1 + kPts(101) * 0.20;
        // K12 Momentum Overdrive: permanent bonus per lifetime click
        if (kPts(112) > 0) mult *= (1 + kPts(112) * 0.000001 * totalClicks);
        dmg = Math.ceil(dmg * mult);
        // K2 Precision Execution: +1%/pt of target max HP as bonus damage
        if (kPts(102) > 0) {
            const maxHp = (isBoss && boss) ? boss.maxHp : MOB_MAXHP;
            dmg += Math.ceil(maxHp * kPts(102) * 0.01);
        }
    }
    // S9 Bane of Titans + S10 Arcane Weakening (sorcerer, boss target)
    if (isBoss && ascendedClass === 'sorcerer') {
        dmg = Math.ceil(dmg * sorcBossDmgMult() * sorcWeakeningBonusMult());
    }
    return dmg;
}

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
    // Class-specific button visibility
    const isSorcerer = ascendedClass === 'sorcerer';
    const isKnight   = ascendedClass === 'knight';
    document.getElementById('fireballBtn').style.display  = gfbUnlocked ? '' : 'none';
    document.getElementById('cd-fire-wrap').style.display  = gfbUnlocked ? '' : 'none';
    document.getElementById('cd-hmm-wrap').style.display  = isSorcerer && sPts(201) >= 1 ? '' : 'none';
    document.getElementById('cd-sd-wrap').style.display   = isSorcerer && sPts(211) >= 1 ? '' : 'none';
    document.getElementById('annihilationBtn').style.display      = isKnight   ? '' : 'none';
    document.getElementById('cd-anni-wrap').style.display         = isKnight   ? '' : 'none';
    document.getElementById('autoAnniBtn').style.display          = isKnight   ? '' : 'none';
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
    if (_pn < potionLargeWealthEnd)  _pl.push('<div class="hud-row"><span>\uD83D\uDCB0 Lg. Wealth</span><span class="potion-timer">'  + _fp(potionLargeWealthEnd  - _pn) + '</span></div>');
    if (_pn < potionLargeWisdomEnd)  _pl.push('<div class="hud-row"><span>\uD83D\uDCDA Lg. Wisdom</span><span class="potion-timer">'  + _fp(potionLargeWisdomEnd  - _pn) + '</span></div>');
    if (_pn < potionLargeSwiftnessEnd) _pl.push('<div class="hud-row"><span>\u26A1 Lg. Swift</span><span class="potion-timer">'      + _fp(potionLargeSwiftnessEnd - _pn) + '</span></div>');
    if (_pn < potionMadnessEnd)      _pl.push('<div class="hud-row"><span>\uD83C\uDF00 Madness</span><span class="potion-timer">'      + _fp(potionMadnessEnd      - _pn) + '</span></div>');
    if (_pn < potionDangerEnd)       _pl.push('<div class="hud-row"><span>\uD83D\uDC80 Danger</span><span class="potion-timer">'       + _fp(potionDangerEnd       - _pn) + '</span></div>');
    const _ps = document.getElementById('hud-potions-section');
    if (_ps) _ps.style.display = _pl.length ? '' : 'none';
    const _pe = document.getElementById('hud-potions');
    if (_pe) _pe.innerHTML = _pl.join('');
}

let totalClicks = 0;   // lifetime successful click-attacks
let totalMonstersKilled   = 0;  // lifetime worm kills
let totalBossesKilled     = 0;  // lifetime regular boss kills
let totalUberBossesKilled = 0;  // lifetime uber boss kills
let totalMaterialsGathered = 0; // lifetime items ever added to inventory
let totalPotionsCrafted   = 0;  // lifetime potions crafted
// Session counters (reset each page load — not persisted)
const sessionStartTime      = Date.now();
let sessionMonstersKilled   = 0;
let sessionBossesKilled     = 0;
let sessionUberBossesKilled = 0;
let sessionGoldEarned       = 0;
let sessionExpEarned        = 0;
let fireballActive = false;
let spawnPaused = false;
let dmgNumbers = []; // floating damage numbers

const BASIC_COOLDOWN_MS  = 500;    // 0.5s
const GFB_COOLDOWN_MS    = 20000;  // 20s base (reduced by Fireball CDR skill)
const GFB_GOLD_COST      = 0;      // free to cast
const GFB_UNLOCK_LEVEL   = 4;
const GFB_UNLOCK_GOLD    = 100;
const HMM_COOLDOWN_MS    = 20000;  // Light/Heavy Magic Missile: 20s (Sorcerer S1)
const SUDDEN_DEATH_COOLDOWN_MS = 600000; // Sudden Death: 10 min base (Sorcerer S11, reduced per level)
let gfbUnlocked     = false;
let lastBasicAttack = 0;   // timestamp of last basic hit
let gfbCooldownEnd  = 0;   // timestamp when GFB is ready again
// firestormCharges removed — C3 is now Fireball Annihilation (instant-kill chance)

// Sorcerer Heavy Magic Missile state
let hmmCooldownEnd = 0;
let hmmHitCounter  = 0;              // total HMM fires
let arcaneWeakeningStacks = 0;       // S10 Arcane Weakening stacks on current boss
let suddenDeathCooldownEnd = 0;
let essenceGatheringEnd = 0;         // S12 Essence Gathering double-damage buff expiry

// Knight combo state (legacy, kept for save migration only)
let comboStacks        = 0;
let flowStacks         = 0;
let clickOrderCount    = 0;

// ── Legacy sorcerer ability state (kept for save compatibility — no longer active) ──
const UE_COOLDOWN_MS           = 5 * 60 * 1000;  // was 5-min standalone UE spell
const POWER_STANCE_COOLDOWN_MS = 6 * 60 * 1000;
const POWER_STANCE_DURATION_MS = 90 * 1000;
let ueUnlocked          = false;
let ueCooldownEnd       = 0;
let powerStanceUnlocked = false;
let powerStanceActive   = false;
let powerStanceEnd      = 0;
let powerStanceCooldownEnd = 0;
let autoPsEnabled       = false;

// ── Inventory & crafting ─────────────────────────────────────────
let inventory = { lumpOfDirt: 0, rotwormFang: 0, worm: 0, gland: 0,
                   cyclopsToe: 0, wolfToothChain: 0, cyclopsEye: 0, battleStone: 0 };
let potionWealthEnd       = 0;   // ms timestamp when Small Potion of Wealth buff expires
let potionWisdomEnd       = 0;   // ms timestamp when Small Potion of Wisdom buff expires
let potionSwiftnessEnd    = 0;   // ms timestamp when Small Potion of Swiftness buff expires
let potionMedWealthEnd    = 0;   // Medium Potion of Wealth
let potionMedWisdomEnd    = 0;   // Medium Potion of Wisdom
let potionMedSwiftnessEnd = 0;   // Medium Potion of Swiftness
let potionLargeWealthEnd  = 0;   // Large Potion of Wealth
let potionLargeWisdomEnd  = 0;   // Large Potion of Wisdom
let potionLargeSwiftnessEnd = 0; // Large Potion of Swiftness
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

const AUTO_UE_UNLOCK_LEVEL = 45; // legacy — kept for save compatibility
const AUTO_UE_UNLOCK_GOLD  = 10000;
let autoUeUnlocked = false;
let autoUeEnabled  = false;

// ── Annihilation (Knight only) ────────────────────────────────────────────────
const ANNIHILATION_COOLDOWN_MS  = 3 * 60 * 1000; // 3 min
let annihilationUnlocked    = false;
let annihilationCooldownEnd = 0;
let autoAnniEnabled         = false;

const BOSS_FOCUS_UNLOCK_LEVEL = 10;
const BOSS_FOCUS_UNLOCK_GOLD  = 1000;
let bossFocusUnlocked = false;

function fmtCost(n) {
    if (n >= 1e12) return (n/1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (n >= 1e9)  return (n/1e9).toFixed(1).replace(/\.0$/, '')  + 'B';
    if (n >= 1e6)  return (n/1e6).toFixed(1).replace(/\.0$/, '')  + 'M';
    if (n >= 1e3)  return (n/1e3).toFixed(1).replace(/\.0$/, '')  + 'K';
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
    { key: 'blueEssence',   name: 'Blue Essence',   icon: '🔵' },
    { key: 'greenEssence',  name: 'Green Essence',  icon: '🟢' },
    { key: 'redEssence',    name: 'Red Essence',    icon: '🔴' },
    { key: 'yellowEssence', name: 'Yellow Essence', icon: '🟡' },
];

// Loot table per monster tier (M1..M11). Each row defines the base chance to drop any essence,
// and the relative chance of each essence color.
const LOOT_TABLE = [
    { dropChance: 0.05,  weights: { blue: 0.70, green: 0.20, red: 0.09, yellow: 0.01 } },
    { dropChance: 0.0625, weights: { blue: 0.68, green: 0.21, red: 0.10, yellow: 0.01 } },
    { dropChance: 0.078,  weights: { blue: 0.65, green: 0.23, red: 0.11, yellow: 0.01 } },
    { dropChance: 0.097,  weights: { blue: 0.62, green: 0.25, red: 0.12, yellow: 0.01 } },
    { dropChance: 0.12,   weights: { blue: 0.58, green: 0.27, red: 0.14, yellow: 0.01 } },
    { dropChance: 0.15,   weights: { blue: 0.55, green: 0.28, red: 0.15, yellow: 0.02 } },
    { dropChance: 0.19,   weights: { blue: 0.50, green: 0.30, red: 0.17, yellow: 0.03 } },
    { dropChance: 0.24,   weights: { blue: 0.45, green: 0.32, red: 0.19, yellow: 0.04 } },
    { dropChance: 0.30,   weights: { blue: 0.40, green: 0.34, red: 0.21, yellow: 0.05 } },
    { dropChance: 0.38,   weights: { blue: 0.35, green: 0.36, red: 0.23, yellow: 0.06 } },
    { dropChance: 0.48,   weights: { blue: 0.30, green: 0.38, red: 0.25, yellow: 0.07 } },
];

function _pickWeighted(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    const r = Math.random() * total;
    let acc = 0;
    for (const [key, value] of Object.entries(weights)) {
        acc += value;
        if (r <= acc) return key;
    }
    return Object.keys(weights)[0];
}

function getAreaTierIndex() {
    const idx = AREAS.findIndex(a => a.id === currentArea);
    return Math.max(0, Math.min(LOOT_TABLE.length - 1, idx));
}

function rollEssenceDrops(isBoss, isUber) {
    const tier = getAreaTierIndex();
    const row = LOOT_TABLE[tier];
    if (!row) return [];

    let chance = row.dropChance * skillMatDropMult() * sorcMatMult();
    let qty = 1;
    if (isBoss) {
        chance *= 2;
        qty *= 2;
    }
    if (isUber) {
        chance *= 2;
        qty *= 2;
    }
    qty = Math.ceil(qty * skillMatQtyMult() * sorcMatMult());

    if (Math.random() >= chance) return [];

    const color = _pickWeighted(row.weights);
    const key = {
        blue: 'blueEssence',
        green: 'greenEssence',
        red: 'redEssence',
        yellow: 'yellowEssence',
    }[color];
    return key ? [{ k: key, qty }] : [];
}

const CRAFTING_RECIPES = [
    { id: 'small_gold',          name: 'Small Potion of Wealth',    icon: '💰', desc: '+15% gold gain',         levelReq: 20, goldCost: 1000, durationMinutes: 2, ingredients: { blueEssence: 6, greenEssence: 1, redEssence: 0, yellowEssence: 0 } },
    { id: 'small_exp',           name: 'Small Potion of Wisdom',    icon: '📚', desc: '+15% experience gain',    levelReq: 20, goldCost: 1000, durationMinutes: 2, ingredients: { blueEssence: 5, greenEssence: 2, redEssence: 0, yellowEssence: 0 } },
    { id: 'small_cooldowns',     name: 'Small Potion of Swiftness', icon: '⚡', desc: '-10% cooldowns',          levelReq: 20, goldCost: 1000, durationMinutes: 1.5, ingredients: { blueEssence: 4, greenEssence: 2, redEssence: 1, yellowEssence: 0 } },

    { id: 'medium_gold',         name: 'Medium Potion of Wealth',   icon: '💰', desc: '+25% gold gain',         levelReq: 40, goldCost: 5000, durationMinutes: 4, ingredients: { blueEssence: 8, greenEssence: 4, redEssence: 2, yellowEssence: 0 } },
    { id: 'medium_exp',          name: 'Medium Potion of Wisdom',   icon: '📚', desc: '+25% experience gain',    levelReq: 40, goldCost: 5000, durationMinutes: 4, ingredients: { blueEssence: 6, greenEssence: 5, redEssence: 2, yellowEssence: 0 } },
    { id: 'medium_cooldowns',    name: 'Medium Potion of Swiftness',icon: '⚡', desc: '-15% cooldowns',          levelReq: 40, goldCost: 5000, durationMinutes: 3, ingredients: { blueEssence: 4, greenEssence: 4, redEssence: 3, yellowEssence: 0 } },

    { id: 'large_gold',          name: 'Large Potion of Wealth',    icon: '💰', desc: '+50% gold gain',        levelReq: 50, goldCost: 10000, durationMinutes: 8, ingredients: { blueEssence: 0, greenEssence: 6, redEssence: 4, yellowEssence: 1 } },
    { id: 'large_exp',           name: 'Large Potion of Wisdom',    icon: '📚', desc: '+50% experience gain',   levelReq: 50, goldCost: 10000, durationMinutes: 8, ingredients: { blueEssence: 0, greenEssence: 5, redEssence: 5, yellowEssence: 1 } },
    { id: 'large_cooldowns',     name: 'Large Potion of Swiftness', icon: '⚡', desc: '-25% cooldowns',          levelReq: 50, goldCost: 10000, durationMinutes: 6, ingredients: { blueEssence: 0, greenEssence: 4, redEssence: 6, yellowEssence: 1 } },

    { id: 'potion_of_danger',    name: 'Potion of Danger',          icon: '💀', desc: 'Reduces boss requirement by 25%', levelReq: 60, goldCost: 25000, durationMinutes: 10, ingredients: { blueEssence: 0, greenEssence: 3, redEssence: 6, yellowEssence: 3 }, ascendedOnly: true },
    { id: 'potion_of_madness',   name: 'Potion of Madness',         icon: '🌀', desc: '+10 max spawn & x10 spawn rate', levelReq: 70, goldCost: 50000, durationMinutes: 15, ingredients: { blueEssence: 0, greenEssence: 10, redEssence: 4, yellowEssence: 6 }, ascendedOnly: true },
];

const CRAFTING_UNLOCK_LEVEL = 20;

// Maps each potion id to the opposite-tier counterpart (no stacking allowed).
const POTION_TIERS = {
    gold: ['small_gold', 'medium_gold', 'large_gold'],
    exp:  ['small_exp',  'medium_exp',  'large_exp'],
    cooldowns: ['small_cooldowns', 'medium_cooldowns', 'large_cooldowns'],
};
function _getPotionGroup(id) {
    for (const group of Object.values(POTION_TIERS)) {
        if (group.includes(id)) return group;
    }
    return [id];
}

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

function potionGoldMult() {
    const now = Date.now();
    if (now < _getPotionEnd('large_gold'))  return 1.50;
    if (now < _getPotionEnd('medium_gold')) return 1.25;
    if (now < _getPotionEnd('small_gold'))  return 1.15;
    return 1.0;
}
function potionExpMult() {
    const now = Date.now();
    if (now < _getPotionEnd('large_exp'))  return 1.50;
    if (now < _getPotionEnd('medium_exp')) return 1.25;
    if (now < _getPotionEnd('small_exp'))  return 1.15;
    return 1.0;
}
function potionCdrMult() {
    const now = Date.now();
    if (now < _getPotionEnd('large_cooldowns'))  return 0.75;
    if (now < _getPotionEnd('medium_cooldowns')) return 0.85;
    if (now < _getPotionEnd('small_cooldowns'))  return 0.90;
    return 1.0;
}
function potionMadnessActive() { return Date.now() < potionMadnessEnd; }
function potionDangerActive()  { return Date.now() < potionDangerEnd; }

function _getPotionEnd(id) {
    if (id === 'small_gold')        return potionWealthEnd;
    if (id === 'medium_gold')       return potionMedWealthEnd;
    if (id === 'large_gold')        return potionLargeWealthEnd;
    if (id === 'small_exp')         return potionWisdomEnd;
    if (id === 'medium_exp')        return potionMedWisdomEnd;
    if (id === 'large_exp')         return potionLargeWisdomEnd;
    if (id === 'small_cooldowns')   return potionSwiftnessEnd;
    if (id === 'medium_cooldowns')  return potionMedSwiftnessEnd;
    if (id === 'large_cooldowns')   return potionLargeSwiftnessEnd;
    if (id === 'potion_of_madness') return potionMadnessEnd;
    if (id === 'potion_of_danger')  return potionDangerEnd;
    return 0;
}
function _setPotionEnd(id, val) {
    if      (id === 'small_gold')        potionWealthEnd       = val;
    else if (id === 'medium_gold')       potionMedWealthEnd    = val;
    else if (id === 'large_gold')        potionLargeWealthEnd  = val;
    else if (id === 'small_exp')         potionWisdomEnd       = val;
    else if (id === 'medium_exp')        potionMedWisdomEnd    = val;
    else if (id === 'large_exp')         potionLargeWisdomEnd  = val;
    else if (id === 'small_cooldowns')   potionSwiftnessEnd    = val;
    else if (id === 'medium_cooldowns')  potionMedSwiftnessEnd = val;
    else if (id === 'large_cooldowns')   potionLargeSwiftnessEnd = val;
    else if (id === 'potion_of_madness') potionMadnessEnd      = val;
    else if (id === 'potion_of_danger')  potionDangerEnd       = val;
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
    body.innerHTML = CRAFTING_RECIPES.map(r => {
        const active        = now < _getPotionEnd(r.id);
        const group = _getPotionGroup(r.id);
        const activeOther = group.find(other => other !== r.id && now < _getPotionEnd(other));
        const counterActive = Boolean(activeOther);
        const ingOk    = Object.entries(r.ingredients).every(([k, v]) => (inventory[k] || 0) >= v);
        const goldOk   = gold >= r.goldCost;
        const needsAscension = r.ascendedOnly && !ascended;
        const needsLevel = level < (r.levelReq || CRAFTING_UNLOCK_LEVEL);
        const canCraft = !counterActive && ingOk && goldOk && !needsAscension && !needsLevel;
        const hi       = filterKey != null && r.ingredients[filterKey] != null;
        const ingsHtml = Object.entries(r.ingredients).map(([k, need]) => {
            const have = inventory[k] || 0;
            const d    = ITEM_DEFS.find(d => d.key === k);
            return `<span class="craft-ing${have >= need ? '' : ' craft-ing-miss'}">${d ? d.icon : ''} ${d ? d.name : k}: ${have}/${need}</span>`;
        }).join('');
        const statusHtml = active
            ? `<div class="craft-active">\u2713 ACTIVE \u2014 ${fmtMs(_getPotionEnd(r.id) - now)}</div>`
            : counterActive
                ? `<div class="craft-active" style="border-color:#8a6a2a;color:#c08040;">\u26A0 ${CRAFTING_RECIPES.find(x=>x.id===activeOther)?.name} active</div>`
                : '';
        const levelNote = needsLevel
            ? `<div class="craft-active" style="border-color:#777;color:#999;">Requires level ${r.levelReq || CRAFTING_UNLOCK_LEVEL}</div>`
            : '';
        const ascensionNote = needsAscension
            ? `<div class="craft-active" style="border-color:#833;color:#c08040;">Requires ascension</div>`
            : '';
        const badgeLabel = needsAscension ? 'Ascension' : needsLevel ? `Lv ${r.levelReq || CRAFTING_UNLOCK_LEVEL}` : '';
        const badgeHtml = badgeLabel ? `<span class="craft-badge">${badgeLabel}</span>` : '';
        const btnLabel = needsAscension ? 'Requires ascension' : counterActive ? 'Other tier active' : 'Craft';
        return `<div class="craft-card${hi ? ' craft-card-highlight' : ''}">
            <div class="craft-header"><span class="craft-icon">${r.icon}</span><span class="craft-name">${r.name}</span>${badgeHtml}</div>
            <div class="craft-desc">${r.desc}</div>
            <div class="craft-ings">${ingsHtml}</div>
            <div class="craft-cost${goldOk ? '' : ' craft-cost-miss'}">\uD83D\uDCB0 ${r.goldCost.toLocaleString()} gold</div>
            ${levelNote}
            ${ascensionNote}
            ${statusHtml}
            <button class="craft-btn" onclick="craftPotion('${r.id}')" ${canCraft ? '' : 'disabled'}>${btnLabel}</button>
        </div>`;
    }).join('');
}

function craftPotion(id) {
    const r = CRAFTING_RECIPES.find(r => r.id === id);
    if (!r || level < (r.levelReq || CRAFTING_UNLOCK_LEVEL)) return;
    if (gold < r.goldCost) return;
    if (!Object.entries(r.ingredients).every(([k, v]) => (inventory[k] || 0) >= v)) return;

    const group = _getPotionGroup(id);
    const activeOther = group.find(other => other !== id && Date.now() < _getPotionEnd(other));
    if (activeOther) return; // block crafting other tier while one is active

    gold -= r.goldCost;
    Object.entries(r.ingredients).forEach(([k, v]) => { inventory[k] -= v; });

    totalPotionsCrafted++;
    // Stack duration for the same potion type when crafting again while it's active.
    const now = Date.now();
    const currentEnd = _getPotionEnd(id);
    const duration = (r.durationMinutes || 5) * 60 * 1000 * sorcPotionDurMult();
    _setPotionEnd(id, Math.max(now, currentEnd) + duration);

    renderCrafting();
}

// ── Skill Tree ─────────────────────────────────────────────────────────────────
// 3 columns × 4 rows, 10 points each. No level requirements — only prereq chain.
const GENERAL_SKILLS = [
    // Column A — Automation
    { id: 11, col: 1, row: 1, name: 'Auto-Attack',        max: 10, prereqs: [],   costs: [100,200,400,800,1600,3200,6400,12800,25600,51200],                                                          desc: 'Unlocks auto-attack. Reduces auto-attack cooldown by 0.04s per point (0.50s → 0.10s at max)' },
    { id: 12, col: 1, row: 2, name: 'Auto-Attack Damage', max: 10, prereqs: [11], costs: [1000,2000,4000,8000,16000,32000,64000,128000,256000,512000],                                               desc: '+10% auto-attack damage per point (+100% at max). Requires 1pt Auto-Attack' },
    { id: 13, col: 1, row: 3, name: 'Multi-Target',       max: 10, prereqs: [12], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                           desc: '+10% chance per point to hit a 2nd monster (100% at max). Requires 1pt Auto-Attack Damage' },
    { id: 14, col: 1, row: 4, name: 'Hyper Automation',   max: 10, prereqs: [13], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],               desc: '+10% auto-attack damage per point, +10% chance to hit a 3rd target (100% at max). Requires 1pt Multi-Target' },
    // Column B — More Numbers
    { id: 21, col: 2, row: 1, name: 'Wealth Training',    max: 10, prereqs: [],   costs: [1000,2000,4000,8000,16000,32000,64000,128000,256000,512000],                                               desc: '+5% gold gain per point (+50% at max)' },
    { id: 22, col: 2, row: 2, name: 'Exp. Mastery',       max: 10, prereqs: [21], costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],                                    desc: '+5% experience gain per point (+50% at max). Requires 1pt Wealth Training' },
    { id: 23, col: 2, row: 3, name: 'Material Harvesting',max: 10, prereqs: [22], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                           desc: '+3% essence drop chance, +2% drop quantity per point. Requires 1pt Exp. Mastery' },
    { id: 24, col: 2, row: 4, name: 'Boss Attraction',    max: 10, prereqs: [23], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],               desc: '+2% boss spawn rate, +3% boss loot, +1% extra boss chance per point. Requires 1pt Material Harvesting' },
    // Column C — Fireball
    { id: 31, col: 3, row: 1, name: 'Fireball Mastery',   max: 10, prereqs: [],   costs: [1000,2000,4000,8000,16000,32000,64000,128000,256000,512000],                                               desc: 'Unlocks Fireball (always auto-casts). Base 10% HP dmg +5%/pt (60% at max). 20s base cooldown' },
    { id: 32, col: 3, row: 2, name: 'Fireball CDR',       max: 10, prereqs: [31], costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],                                    desc: '-1s fireball cooldown per point (min 10s). Requires 1pt Fireball Mastery' },
    { id: 33, col: 3, row: 3, name: 'Fireball Annihilation', max: 10, prereqs: [32], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                      desc: '+3% chance per fireball hit to instantly kill all non-boss monsters (30% at max). Requires 1pt Fireball CDR' },
    { id: 34, col: 3, row: 4, name: 'Ember of Renewal',   max: 10, prereqs: [33], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],               desc: '+2% chance per point for fireball to instantly reset its cooldown on kill (20% at max). Requires 1pt Fireball Annihilation' },
];

let skillPoints = {};

function skillPts(id) { return skillPoints[id] || 0; }

function skillPrereqsMet(skill) {
    return skill.prereqs.every(pid => skillPts(pid) >= 1);
}

function skillCanBuy(skill) {
    if (skillPts(skill.id) >= skill.max) return false;
    if (!skillPrereqsMet(skill)) return false;
    return gold >= (skill.costs[skillPts(skill.id)] ?? 0);
}

function buySkill(id) {
    const skill = GENERAL_SKILLS.find(s => s.id === id);
    if (!skill || !skillCanBuy(skill)) return;
    const cost = skill.costs[skillPts(skill.id)] ?? 0;
    gold -= cost;
    skillPoints[id] = (skillPoints[id] || 0) + 1;
    if (id === 11 && skillPts(11) === 1) { autoUnlocked = true; bossFocusUnlocked = true; autoEnabled = true; autoTarget = _pickAutoTarget(); }
    if (id === 31 && skillPts(31) === 1) { gfbUnlocked = true; autoGfbUnlocked = true; autoGfbEnabled = true; }
    renderSkillTree();
}

// ── General skill effect helpers ──────────────────────────────────────────────
// Column A — Automation
// A1: CDR now handled inside effectiveAutoCooldown() — no separate probability model
function skillAutoDmgMult()       { return 1 + (skillPts(12) + skillPts(14)) * 0.10; }     // A2+A4: +10%/pt each
function skillMultiTargetChance() { return skillPts(13) * 0.10; }                           // A3: +10%/pt 2nd target
function skillThirdTargetChance() { return skillPts(14) * 0.10; }                           // A4: +10%/pt 3rd target
// Column B — More Numbers
function skillGoldMult()          { return 1 + skillPts(21) * 0.05; }                       // B1
function skillExpMult()           { return 1 + skillPts(22) * 0.05; }                       // B2
function skillMatDropMult()       { return 1 + skillPts(23) * 0.03; }                       // B3 drop chance
function skillMatQtyMult()        { return 1 + skillPts(23) * 0.02; }                       // B3 quantity
function skillBossSpawnMult()     { return 1 + skillPts(24) * 0.02; }                       // B4 spawn rate
function skillBossLootMult()      { return 1 + skillPts(24) * 0.03; }                       // B4 boss loot (C4 removed)
function skillExtraBossChance()   { return skillPts(24) * 0.01; }                           // B4 extra boss on kill
// Column C — Fireball
function skillFbDmgFrac()         { return (10 + skillPts(31) * 5) / 100; }                 // C1: 10%+5%/pt max HP
function skillFbAnnihilateChance(){ return skillPts(33) * 0.03; }                           // C3: 3%/pt instant kill
function skillEmberResetChance()  { return skillPts(34) * 0.02; }                           // C4: 2%/pt CD reset on kill
// Compatibility stubs
function skillMonsterCap()        { return 10 + (potionMadnessActive() ? 10 : 0); }
function skillBossInterval()      { return Math.max(5, Math.floor(BOSS_EVERY / skillBossSpawnMult() * (potionDangerActive() ? 0.75 : 1.0))); }
function skillUberBossEnabled()   { return ascended; }
function skillDoubleAuto()        { return false; }
function skillAutoFireball()      { return skillPts(31) >= 1; }
function skillCdResetEnabled()    { return false; }

// ── Knight skill tree ─────────────────────────────────────────────
// costs[] = gold cost per level [lvl1, lvl2, ...]
const KNIGHT_SKILLS = [
    // Column 1 — Click Damage Path
    { id: 101, col: 1, row: 1, name: 'Strike Training',       max: 10, prereqs: [],    costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],                                       desc: '+20% click damage per point (+200% at max)' },
    { id: 102, col: 1, row: 2, name: 'Precision Execution',   max: 10, prereqs: [101], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                             desc: '+1%/pt of target max HP as bonus click damage (+10% at max). Requires 1pt Strike Training' },
    { id: 103, col: 1, row: 3, name: 'Cleaving Blows',        max: 10, prereqs: [102], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],                   desc: 'Every click deals AoE +1%/pt max HP damage to all non-boss enemies (+10% at max). Requires 1pt Precision Execution' },
    { id: 104, col: 1, row: 4, name: 'Double Strike Instinct',max: 10, prereqs: [103], costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000],          desc: '+3%/pt chance to strike twice (30% at max). Requires 1pt Cleaving Blows' },
    // Column 2 — Speed / Multi-Target / Cooldowns
    { id: 105, col: 2, row: 1, name: 'Combo Meter',           max: 10, prereqs: [],    costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],                                       desc: 'Reduces manual attack cooldown by 0.04s per point (0.50s \u2192 0.10s at max)' },
    { id: 106, col: 2, row: 2, name: 'Adrenaline Reset',      max: 10, prereqs: [105], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                             desc: '+2%/pt chance to fully reset manual attack cooldown on any kill (20% at max). Requires 1pt Combo Meter' },
    { id: 107, col: 2, row: 3, name: 'Sweeping Strikes',      max: 10, prereqs: [106], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],                   desc: '+3%/pt chance for manual attacks to also hit +1 extra monster (30% at max). Requires 1pt Adrenaline Reset' },
    { id: 108, col: 2, row: 4, name: 'Whirlwind Extension',   max: 10, prereqs: [107], costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000],          desc: '+2%/pt chance to hit +2 additional monsters (20% at max, stacks with Sweeping Strikes). Requires 1pt Sweeping Strikes' },
    // Column 3 — Boss / Uber Boss Destruction
    { id: 109, col: 3, row: 1, name: 'Decapitation Chance',   max: 10, prereqs: [],    costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],                                       desc: '+0.5%/pt chance to instantly kill a boss or uber boss on click (5% at max)' },
    { id: 110, col: 3, row: 2, name: 'Endless Challenge',     max: 10, prereqs: [109], costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],                             desc: '+1%/pt chance to instantly spawn the next uber boss after killing a boss (10% at max). Requires 1pt Decapitation Chance' },
    { id: 111, col: 3, row: 3, name: 'Battlefield Purge',     max: 10, prereqs: [110], costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000],                   desc: '+5%/pt chance to kill all remaining non-boss enemies after a boss kill (50% at max). Requires 1pt Endless Challenge' },
    { id: 112, col: 3, row: 4, name: 'Momentum Overdrive',    max: 10, prereqs: [111], costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000],          desc: 'Each manual click permanently increases weapon damage multiplier by +0.0001%/pt (0.001% at max). Requires 1pt Battlefield Purge' },
];

let knightSkillPts = {};

function kPts(id)           { return knightSkillPts[id] || 0; }
function kPrereqsMet(skill) { return skill.prereqs.every(pid => kPts(pid) >= 1); }
function kCanBuy(skill) {
    if (kPts(skill.id) >= skill.max) return false;
    if (!kPrereqsMet(skill))         return false;
    return gold >= (skill.costs[kPts(skill.id)] ?? 0);
}
function buyKnightSkill(id) {
    const skill = KNIGHT_SKILLS.find(s => s.id === id);
    if (!skill || !kCanBuy(skill)) return;
    gold -= (skill.costs[kPts(skill.id)] ?? 0);
    knightSkillPts[id] = (knightSkillPts[id] || 0) + 1;
    renderSkillTree();
}

// Knight effect helpers
function knightDmgMinBonus()     { return 0; }
function knightDmgMaxBonus()     { return 0; }
function knightExtraAutoTarget() { return false; }
function knightAutoAnniOn()      { return autoAnniEnabled; }
function knightComboMaxStacks()  { return 0; } // legacy stub — combo system removed

// ── Sorcerer skill tree ───────────────────────────────────────────
// costs[] = gold cost per level [lvl1, lvl2, ...]
const SORC_SKILLS = [
    // Column 1 — Magic Missile
    { id: 201, col: 1, row: 1, name: 'Light Magic Missile',    max: 10, prereqs: [],       costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],               desc: 'Unlocks Light Magic Missile: auto-fires every 20s dealing (10+5\u00d7pts)% of monster max HP' },
    { id: 202, col: 1, row: 2, name: 'Heavy Magic Missile',    max: 10, prereqs: [201],    costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],     desc: '+4% Magic Missile damage per point (+40% at max). Requires 1pt Light Magic Missile' },
    { id: 203, col: 1, row: 3, name: 'Triple Missile Chance',  max: 10, prereqs: [202],    costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000], desc: '+5% chance per point to fire 2 extra missiles (50% at max). Requires 1pt Heavy Magic Missile' },
    { id: 204, col: 1, row: 4, name: 'Ultimate Explosion',     max: 10, prereqs: [203],    costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000], desc: 'Each HMM has a chance to instantly kill all non-boss enemies on screen (+1.5%/pt, 15% at max). Requires 1pt Triple Missile Chance' },
    // Column 2 — Loot / Crafting / Potions
    { id: 205, col: 2, row: 1, name: 'Arcane Fortune',         max: 10, prereqs: [],       costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],               desc: '+1% gold gained per point (+10% at max)' },
    { id: 206, col: 2, row: 2, name: 'Mystic Salvaging',       max: 10, prereqs: [205],    costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],     desc: '+1% crafting material drop chance per point (+10% at max). Requires 1pt Arcane Fortune' },
    { id: 207, col: 2, row: 3, name: 'Arcane Extraction',      max: 10, prereqs: [206],    costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000], desc: '+2% potion duration per point (+20% at max). Requires 1pt Mystic Salvaging' },
    { id: 208, col: 2, row: 4, name: 'Grand Alchemist',        max: 10, prereqs: [207],    costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000], desc: 'Each boss kill has +1%/pt chance to activate a random potion effect (10% at max). Requires 1pt Arcane Extraction' },
    // Column 3 — Boss Killer
    { id: 209, col: 3, row: 1, name: 'Bane of Titans',         max: 10, prereqs: [],       costs: [10000,20000,40000,80000,160000,320000,640000,1280000,2560000,5120000],               desc: '+2% damage dealt to bosses per point (+20% at max)' },
    { id: 210, col: 3, row: 2, name: 'Arcane Weakening',       max: 10, prereqs: [209],    costs: [100000,200000,400000,800000,1600000,3200000,6400000,12800000,25600000,51200000],     desc: 'Bosses hit by HMM take increased damage: +2%/pt per stack (max 10 stacks, +20% at max). Requires 1pt Bane of Titans' },
    { id: 211, col: 3, row: 3, name: 'Sudden Death',           max: 10, prereqs: [210],    costs: [1000000,2000000,4000000,8000000,16000000,32000000,64000000,128000000,256000000,512000000], desc: 'Fires every max(150s, 600s\u2212pts\u00d745s), dealing 100% of boss max HP. Requires 1pt Arcane Weakening' },
    { id: 212, col: 3, row: 4, name: 'Essence Gathering',      max: 10, prereqs: [211],    costs: [10000000,20000000,40000000,80000000,160000000,320000000,640000000,1280000000,2560000000,5120000000], desc: 'Boss kill grants double damage for 30s (+3s/pt, 60s at max). Requires 1pt Sudden Death' },
];

let sorcSkillPts = {};

function sPts(id)           { return sorcSkillPts[id] || 0; }
function sPrereqsMet(skill) { return skill.prereqs.every(pid => sPts(pid) >= 1); }
function sCanBuy(skill) {
    if (sPts(skill.id) >= skill.max) return false;
    if (!sPrereqsMet(skill))         return false;
    return gold >= (skill.costs[sPts(skill.id)] ?? 0);
}
function buySorcSkill(id) {
    const skill = SORC_SKILLS.find(s => s.id === id);
    if (!skill || !sCanBuy(skill)) return;
    gold -= (skill.costs[sPts(skill.id)] ?? 0);
    sorcSkillPts[id] = (sorcSkillPts[id] || 0) + 1;
    renderSkillTree();
}

// Sorc effect helpers
function sorcDmgMinBonus()           { return 0; }
function sorcDmgMaxBonus()           { return 0; }
function sorcHmmDmgFrac()            { return (10 + sPts(201) * 5) / 100; }       // S1: (10+5/pt)% max HP
function sorcHmmDmgMult()            { return 1 + sPts(202) * 0.04; }             // S2: +4%/pt
function sorcTripleMissileChance()   { return sPts(203) * 0.05; }                 // S3: +5%/pt chance to fire 2 extra missiles
function sorcUltimateExplosionChance(){ return sPts(204) * 0.015; }               // S4: +1.5%/pt chance (15% at max) instant kill all non-boss
function sorcGoldMult()              { return 1 + sPts(205) * 0.01; }             // S5: +1%/pt gold
function sorcMatMult()               { return 1 + sPts(206) * 0.01; }             // S6: +1%/pt material drop chance
function sorcBossLootMult()          { return 1; }                                 // S7 now gives potion duration, not boss loot
function sorcPotionDurMult()         { return 1 + sPts(207) * 0.02; }             // S7: +2%/pt potion duration
function sorcGrandAlchemistChance()  { return sPts(208) * 0.01; }                 // S8: +1%/pt chance per boss kill for random potion
function sorcBossDmgMult()           { return 1 + sPts(209) * 0.02; }             // S9: +2%/pt boss damage
function sorcWeakeningBonusMult()    { return 1 + arcaneWeakeningStacks * sPts(210) * 0.02; } // S10: +2%/pt per stack
function sorcSuddenDeathCooldownMs() { return Math.max(150000, 600000 - sPts(211) * 45000); } // S11: 10min→2.5min at max
function sorcEssenceGatheringMult()  { return (ascendedClass === 'sorcerer' && sPts(212) >= 1 && Date.now() < essenceGatheringEnd) ? 2 : 1; }
function sorcEssenceDuration()       { return 30000 + sPts(212) * 3000; }                      // S12: 30s+3s/pt (60s at max)
// Legacy stubs (old spells auto-unlocked on ascension, no longer skill-gated)
function sorcDoubleGfb()    { return false; }                                    // GFB double removed
function sorcGfbUpgraded()  { return false; }                                    // GFB upgrade removed
function sorcVolatileBlast(){ return false; }                                    // Volatile Blast removed
function sorcAutoUe()       { return false; }                                    // removed
function sorcAutoPs()       { return false; }                                    // removed

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

    // Build a 3-column × 4-row grid of skill nodes (A/B/C columns, rows 1-4)
    let html = '<div class="st-grid">';
    for (let col = 1; col <= 3; col++) {
        html += '<div class="st-col">';
        for (let row = 1; row <= 4; row++) {
            const skill = GENERAL_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) {
                html += `<div class="st-node st-node-empty"></div>`;
                continue;
            }
            const pts     = skillPts(skill.id);
            const maxed   = pts >= skill.max;
            const prereqs = skillPrereqsMet(skill);
            const cost    = skill.costs[pts] ?? 0;
            const canBuy  = !maxed && prereqs && gold >= cost;
            const locked  = !prereqs;

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
        for (let row = 1; row <= 4; row++) {
            const skill = KNIGHT_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) { html += `<div class="st-node st-node-empty"></div>`; continue; }
            const pts    = kPts(skill.id);
            const maxed  = pts >= skill.max;
            const prereqs = kPrereqsMet(skill);
            const cost   = skill.costs[pts] ?? 0;
            const canBuy = !maxed && prereqs && gold >= cost;
            const locked = !prereqs;
            let cls = 'st-node';
            if (maxed)       cls += ' st-node-maxed';
            else if (locked) cls += ' st-node-locked';
            else if (canBuy) cls += ' st-node-available';
            else             cls += ' st-node-unaffordable';
            const connector = row > 1
                ? `<div class="st-connector ${prereqs ? 'st-conn-open' : 'st-conn-locked'}">&#9660;</div>`
                : '';
            const reqChips = [];
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
    for (let col = 1; col <= 3; col++) {
        html += '<div class="st-col">';
        const maxRow = 4; // all columns have 4 rows
        for (let row = 1; row <= maxRow; row++) {
            const skill = SORC_SKILLS.find(s => s.col === col && s.row === row);
            if (!skill) { html += `<div class="st-node st-node-empty"></div>`; continue; }
            const pts     = sPts(skill.id);
            const maxed   = pts >= skill.max;
            const prereqs = sPrereqsMet(skill);
            const cost    = skill.costs[pts] ?? 0;
            const canBuy  = !maxed && prereqs && gold >= cost;
            const locked  = !prereqs;
            let cls = 'st-node';
            if (maxed)       cls += ' st-node-maxed';
            else if (locked) cls += ' st-node-locked';
            else if (canBuy) cls += ' st-node-available';
            else             cls += ' st-node-unaffordable';
            const connector = row > 1
                ? `<div class="st-connector ${prereqs ? 'st-conn-open' : 'st-conn-locked'}">&#9660;</div>`
                : '';
            const reqChips = [];
            skill.prereqs.forEach(pid => {
                const pname = SORC_SKILLS.find(s => s.id === pid)?.name || `Skill ${pid}`;
                reqChips.push(`<span class="st-req ${sPts(pid) >= 1 ? 'st-req-met' : 'st-req-fail'}">${pname}</span>`);
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

function effectiveBasicCooldown() {
    let cd = Math.max(100, BASIC_COOLDOWN_MS - kPts(105) * 40); // K5 Combo Meter: -40ms/pt (0.50s → 0.10s at max)
    return cd * potionCdrMult();
}
function effectiveAutoCooldown()  { return Math.max(100, 500 - skillPts(11) * 40) * potionCdrMult(); }  // A1: -40ms/pt (500→100ms)
function effectiveGfbCooldown()   { return Math.max(10000, GFB_COOLDOWN_MS - skillPts(32) * 1000) * potionCdrMult(); }
function effectiveAnniCooldown()  { return ANNIHILATION_COOLDOWN_MS * potionCdrMult(); }

// ── Progress save / load ─────────────────────────────────────────
function getProgress() {
    return {
        score, gold, exp, level, weaponIndex,
        skillPoints, knightSkillPts, sorcSkillPts,
        gfbUnlocked,
        autoUnlocked, autoEnabled,
        autoGfbUnlocked, autoGfbEnabled,
        autoAnniEnabled,
        bossFocusUnlocked,
        ascended, ascendedClass,
        annihilationUnlocked,
        bossSpawnCounter,
        bossKillCounter,
        totalClicks,
        totalMonstersKilled, totalBossesKilled, totalUberBossesKilled,
        totalMaterialsGathered, totalPotionsCrafted,
        inventory,
        potionWealthEnd, potionWisdomEnd, potionSwiftnessEnd,
        potionMedWealthEnd, potionMedWisdomEnd, potionMedSwiftnessEnd,
        potionLargeWealthEnd, potionLargeWisdomEnd, potionLargeSwiftnessEnd,
        potionMadnessEnd, potionDangerEnd,
        currentArea, unlockedAreas,
        hmmCooldownEnd, arcaneWeakeningStacks, suddenDeathCooldownEnd, essenceGatheringEnd,
        comboStacks, flowStacks, clickOrderCount,
        stateVersion: 7,
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
        // legacy migration: no longer storing many old fields, but load them if present
        if (s.gfbUnlocked      != null) gfbUnlocked      = s.gfbUnlocked;
        if (s.autoUnlocked     != null) autoUnlocked     = s.autoUnlocked;
        if (s.autoEnabled      != null) autoEnabled      = s.autoEnabled;
        if (s.autoGfbUnlocked  != null) autoGfbUnlocked  = s.autoGfbUnlocked;
        if (s.autoGfbEnabled   != null) autoGfbEnabled   = s.autoGfbEnabled;
        if (s.autoAnniEnabled  != null) autoAnniEnabled  = s.autoAnniEnabled;
        if (s.bossFocusUnlocked!= null) bossFocusUnlocked= s.bossFocusUnlocked;
        if (s.ascended             != null) { ascended = s.ascended; applyMobConfig(); }
        if (s.ascendedClass         != null) ascendedClass         = s.ascendedClass;
        if (s.annihilationUnlocked  != null) annihilationUnlocked  = s.annihilationUnlocked;
        if (s.bossSpawnCounter      != null) bossSpawnCounter      = s.bossSpawnCounter;
        if (s.bossKillCounter        != null) bossKillCounter        = s.bossKillCounter;
        // legacy: firstBossSpawned is no longer used
        if (s.totalClicks             != null) totalClicks           = s.totalClicks;
        if (s.totalMonstersKilled    != null) totalMonstersKilled    = s.totalMonstersKilled;
        if (s.totalBossesKilled      != null) totalBossesKilled      = s.totalBossesKilled;
        if (s.totalUberBossesKilled  != null) totalUberBossesKilled  = s.totalUberBossesKilled;
        if (s.totalMaterialsGathered != null) totalMaterialsGathered = s.totalMaterialsGathered;
        if (s.totalPotionsCrafted    != null) totalPotionsCrafted    = s.totalPotionsCrafted;
        if (s.inventory        != null) inventory        = Object.assign({}, inventory, s.inventory);
        if (s.potionWealthEnd       != null) potionWealthEnd       = s.potionWealthEnd;
        if (s.potionWisdomEnd       != null) potionWisdomEnd       = s.potionWisdomEnd;
        if (s.potionSwiftnessEnd    != null) potionSwiftnessEnd    = s.potionSwiftnessEnd;
        if (s.potionMedWealthEnd    != null) potionMedWealthEnd    = s.potionMedWealthEnd;
        if (s.potionMedWisdomEnd    != null) potionMedWisdomEnd    = s.potionMedWisdomEnd;
        if (s.potionMedSwiftnessEnd != null) potionMedSwiftnessEnd = s.potionMedSwiftnessEnd;
        if (s.potionLargeWealthEnd  != null) potionLargeWealthEnd  = s.potionLargeWealthEnd;
        if (s.potionLargeWisdomEnd  != null) potionLargeWisdomEnd  = s.potionLargeWisdomEnd;
        if (s.potionLargeSwiftnessEnd != null) potionLargeSwiftnessEnd = s.potionLargeSwiftnessEnd;
        if (s.potionMadnessEnd      != null) potionMadnessEnd      = s.potionMadnessEnd;
        if (s.potionDangerEnd       != null) potionDangerEnd       = s.potionDangerEnd;
        if (s.currentArea           != null) currentArea           = s.currentArea;
        if (s.unlockedAreas         != null) unlockedAreas         = Array.isArray(s.unlockedAreas) ? s.unlockedAreas : ['Rookgaard'];
        if (s.hmmCooldownEnd        != null) hmmCooldownEnd        = s.hmmCooldownEnd;
        if (s.arcaneWeakeningStacks != null) arcaneWeakeningStacks = s.arcaneWeakeningStacks;
        if (s.suddenDeathCooldownEnd      != null) suddenDeathCooldownEnd      = s.suddenDeathCooldownEnd;
        if (s.obliterationBeamCooldownEnd   != null) suddenDeathCooldownEnd      = s.obliterationBeamCooldownEnd; // legacy migration
        if (s.essenceGatheringEnd     != null) essenceGatheringEnd     = s.essenceGatheringEnd;
        if (s.comboStacks           != null) comboStacks           = s.comboStacks;
        if (s.flowStacks            != null) flowStacks            = s.flowStacks;
        if (s.clickOrderCount       != null) clickOrderCount       = s.clickOrderCount;
        // Derive unlock flags from skill points (migration-safe)
        if (skillPts(11) >= 1) { autoUnlocked = true; bossFocusUnlocked = true; autoEnabled = true; }
        if (skillPts(31) >= 1) { gfbUnlocked = true; autoGfbUnlocked = true; autoGfbEnabled = true; }
        // Annihilation is auto-unlocked for all knights on ascension
        if (ascendedClass === 'knight') { annihilationUnlocked = true; }
    } catch (_) {}
    applyMobConfig();
}

async function saveProgress() {
    if (!authToken) return;
    // Sanitize state variables before sending — prevents NaN/Infinity injection
    // and catches trivial console-based manipulation of numeric globals.
    if (!Number.isFinite(gold)  || gold  < 0) gold  = 0;
    if (!Number.isFinite(exp)   || exp   < 0) exp   = 0;
    if (!Number.isFinite(score) || score < 0) score = 0;
    if (!Number.isFinite(level) || level < 1) level = 1;
    // Snapshot the values being sent so we can compare against them (not the
    // current live values) when the response arrives.  A boss kill or worm kill
    // can happen in the ~100–300 ms the request is in-flight; comparing against
    // the snapshot avoids reverting those gains.
    const _snapScore = score, _snapLevel = level, _snapGold = gold, _snapExp = exp;
    try {
        const _res = await fetch('/api/save', {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken,
            },
            body: JSON.stringify({ state: getProgress() }),
        });
        // Reconcile client state with server-authoritative clamped values.
        // Apply corrections as a delta relative to the snapshot so that any
        // gains earned after the snapshot (during the in-flight window) are
        // preserved rather than reverted.
        if (_res.ok) {
            const _d = await _res.json();
            if (typeof _d.score === 'number' && _d.score < _snapScore) score = Math.max(1, score - (_snapScore - _d.score));
            if (typeof _d.level === 'number' && _d.level < _snapLevel) level = Math.max(1, level - (_snapLevel - _d.level));
            if (typeof _d.gold  === 'number' && _d.gold  < _snapGold)  gold  = Math.max(0, gold  - (_snapGold  - _d.gold));
            if (typeof _d.exp   === 'number' && _d.exp   < _snapExp)   exp   = Math.max(0, exp   - (_snapExp   - _d.exp));
        } else if (_res.status === 403) {
            const _d = await _res.json().catch(() => ({}));
            clearInterval(_saveTimer);
            clearInterval(_sbTimer);
            localStorage.removeItem('rk_token');
            localStorage.removeItem('rk_username');
            alert(_d.message || 'Your account has been banned.');
            location.reload();
        }
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
        if (s.autoEnabled || s.autoUnlocked) {
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

function _classLabel(cls) {
    if (cls === 'knight')   return 'KNI';
    if (cls === 'sorcerer') return 'SOR';
    return 'NV';
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
                `<span class="sb-class sb-class-${p.ascendedClass || 'nv'}">${_classLabel(p.ascendedClass)}</span>` +
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
                `<span class="sb-class sb-class-${data.me.ascendedClass || 'nv'}">${_classLabel(data.me.ascendedClass)}</span>` +
                `<span class="sb-score">${data.me.score}</span>` +
                `<span class="sb-level">lv${data.me.level}</span>`;
            el.appendChild(row);
        }
    } catch (_) {}
}

// ── Personal Statistics ──────────────────────────────────────────
function openStats() {
    const fmt = n => (n || 0).toLocaleString();
    const fmtTime = ms => {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };
    const sessionDuration = Date.now() - sessionStartTime;
    const className = ascendedClass === 'knight'   ? 'Knight'
                    : ascendedClass === 'sorcerer' ? 'Sorcerer'
                    : 'No Vocation';
    const totalBosses   = totalBossesKilled + totalUberBossesKilled;
    const sessionBosses = sessionBossesKilled + sessionUberBossesKilled;
    document.getElementById('stats-body').innerHTML = `
        <div class="stats-player-header">
            <span class="stats-player-name">${escHtml(authUsername || '?')}</span>
            <span class="stats-player-class stats-class-${ascendedClass || 'nv'}">${className}</span>
        </div>
        <div class="stats-meta-row">
            <span>Level <b>${fmt(level)}</b></span>
            <span>Score <b>${fmt(score)}</b></span>
            <span>Area <b>${escHtml(currentArea || 'Rookgaard')}</b></span>
        </div>
        <div class="stats-section-title">This Session &mdash; <span style="font-size:10px;font-weight:normal;color:#7a6030">${fmtTime(sessionDuration)} online</span></div>
        <div class="stats-grid">
            <span class="stats-label">Monsters killed</span><span class="stats-val">${fmt(sessionMonstersKilled)}</span>
            <span class="stats-label">Bosses killed</span><span class="stats-val">${fmt(sessionBossesKilled)}</span>
            <span class="stats-label">Uber bosses killed</span><span class="stats-val">${fmt(sessionUberBossesKilled)}</span>
            <span class="stats-label">Total kills</span><span class="stats-val">${fmt(sessionMonstersKilled + sessionBosses)}</span>
            <span class="stats-label">Gold earned</span><span class="stats-val">${fmt(sessionGoldEarned)}</span>
            <span class="stats-label">Experience earned</span><span class="stats-val">${fmt(sessionExpEarned)}</span>
        </div>
        <div class="stats-section-title" style="margin-top:14px">All Time</div>
        <div class="stats-grid">
            <span class="stats-label">Monsters killed</span><span class="stats-val">${fmt(totalMonstersKilled)}</span>
            <span class="stats-label">Bosses killed</span><span class="stats-val">${fmt(totalBossesKilled)}</span>
            <span class="stats-label">Uber bosses killed</span><span class="stats-val">${fmt(totalUberBossesKilled)}</span>
            <span class="stats-label">Total kills</span><span class="stats-val">${fmt(totalMonstersKilled + totalBosses)}</span>
            <span class="stats-label" style="margin-top:6px">Boss kill streak</span><span class="stats-val" style="margin-top:6px">${fmt(bossKillCounter)}</span>
            <span class="stats-label">Materials gathered</span><span class="stats-val">${fmt(totalMaterialsGathered)}</span>
            <span class="stats-label">Potions crafted</span><span class="stats-val">${fmt(totalPotionsCrafted)}</span>
            <span class="stats-label">Total clicks</span><span class="stats-val">${fmt(totalClicks)}</span>
        </div>
    `;
    document.getElementById('stats-modal').style.display = 'flex';
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
            // Only invalidate the token if the server explicitly rejects it (401).
            // For 5xx or other errors keep the token so the player can retry after
            // a server restart / temporary outage without losing their session.
            if (res.status === 401) {
                authToken = null;
                localStorage.removeItem('rk_token');
                localStorage.removeItem('rk_username');
            }
        } catch (_) {
            // Network error — keep the token; the session may still be valid
        }
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
    // C3: Fireball Annihilation — instantly kill all non-boss enemies
    if (skillFbAnnihilateChance() > 0 && Math.random() < skillFbAnnihilateChance()) {
        gold -= GFB_GOLD_COST;
        gfbCooldownEnd = Date.now() + effectiveGfbCooldown();
        const t = candidates[0];
        spawnEffect(t.x, t.y, radius);
        spawnPaused = true;
        setTimeout(() => {
            const fbKills = worms.length;
            worms.forEach(w => killWorm(w));
            worms = [];
            spawnUltimateExplosion();
            if (fbKills > 0 && skillEmberResetChance() > 0 && Math.random() < skillEmberResetChance()) {
                gfbCooldownEnd = 0;
            }
            spawnPaused = false;
        }, 300);
        return true;
    }
    // Boss priority: target boss directly if alive; otherwise pick best worm cluster
    let t = boss || candidates[0];
    if (!boss) {
        let bestCount = 0;
        for (const c of candidates) {
            const cnt = candidates.filter(o => Math.hypot(o.x - c.x, o.y - c.y) < radius).length;
            if (cnt > bestCount) { bestCount = cnt; t = c; }
        }
    }
    gold -= GFB_GOLD_COST;
    gfbCooldownEnd = Date.now() + effectiveGfbCooldown();
    spawnEffect(t.x, t.y, radius);
    spawnPaused = true;
    const fx = t.x, fy = t.y;
    setTimeout(() => {
        let fbKills = 0;
        worms = worms.filter(w => {
            const dx = w.x - fx, dy = w.y - fy;
            if (Math.hypot(dx, dy) < radius) {
                if (upgraded) { killWorm(w); fbKills++; return false; }
                const fbDmg = Math.ceil(MOB_MAXHP * skillFbDmgFrac() * sorcEssenceGatheringMult());
                w.hp -= fbDmg;
                dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: fbDmg, color: '#8b0000', life: 60 });
                if (w.hp <= 0) { killWorm(w); fbKills++; return false; }
            }
            return true;
        });
        // C4: Ember of Renewal — chance to reset fireball CD after kills
        if (fbKills > 0 && skillEmberResetChance() > 0 && Math.random() < skillEmberResetChance()) {
            gfbCooldownEnd = 0;
        }
        // Double Fireball (sorc skill) — fire a second fireball at next best cluster
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
                        const fbDmg = Math.ceil(MOB_MAXHP * skillFbDmgFrac() * sorcEssenceGatheringMult());
                        w.hp -= fbDmg;
                        dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size, value: fbDmg, color: '#8b0000', life: 60 });
                        if (w.hp <= 0) { killWorm(w); return false; }
                    }
                    return true;
                });
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
    img.src = ascendedClass === 'knight' ? 'KNIGHT_EFFECT.gif' : 'Attack_Effect_(Red).gif';
    img.className = 'effect';
    img.style.left = (rect.left + x - size / 2) + 'px';
    img.style.top  = (rect.top  + y - size / 2) + 'px';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 800);
}

function spawnMissileEffect(x, y) {
    const size = 80;
    const rect = canvas.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = 'HMM.gif';
    img.className = 'effect';
    img.style.left = (rect.left + x - size / 2) + 'px';
    img.style.top  = (rect.top  + y - size / 2) + 'px';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 1000);
}

function spawnSuddenDeathEffect(x, y) {
    const size = 120;
    const rect = canvas.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = 'SD.gif';
    img.className = 'effect';
    img.style.left = (rect.left + x - size / 2) + 'px';
    img.style.top  = (rect.top  + y - size / 2) + 'px';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 1500);
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
    const hp     = isUber ? MOB_MAXHP * 20 : MOB_MAXHP * 10;
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
    totalMonstersKilled++;
    sessionMonstersKilled++;
    const expGain  = Math.floor(MOB_EXP  * skillExpMult() * potionExpMult());
    const goldBase = MOB_GOLD_MIN + Math.floor(Math.random() * (MOB_GOLD_MAX - MOB_GOLD_MIN + 1));
    const goldGain = Math.floor(goldBase * skillGoldMult() * sorcGoldMult() * potionGoldMult());
    exp  += expGain;
    gold += goldGain;
    sessionGoldEarned += goldGain;
    sessionExpEarned  += expGain;
    checkLevelUp();
    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 18, value: expGain, color: 'white', life: 80 });
    dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 32, value: goldGain, color: '#f0c040', life: 80 });
    // Loot drop
    const _wd = rollEssenceDrops(false, false);
    let _wq = 0;
    _wd.forEach(({ k, qty }) => { inventory[k] = (inventory[k] || 0) + qty; _wq += qty; });
    totalMaterialsGathered += _wq;
    if (_wq > 0) dmgNumbers.push({ x: w.x + (Math.random()*20-10), y: w.y - w.size - 46, value: '+' + _wq, color: '#5599ff', life: 80 });
    bossSpawnCounter++;
    // Boss spawn: first boss guaranteed after 10 kills; afterwards probabilistic per kill
    if (!boss) {
        const _dangerMult = potionDangerActive() ? 1.5 : 1.0;
        if (bossSpawnCounter === 10 && bossKillCounter === 0) {
            spawnBoss(); // first-ever boss: guaranteed after 10 kills
        } else if (bossKillCounter > 0 || bossSpawnCounter > 10) {
            const _uberEligible = skillUberBossEnabled() && bossKillCounter > 0 && bossKillCounter % UBER_BOSS_EVERY === 0;
            const _r = Math.random();
            if (_uberEligible && _r < 0.01 * _dangerMult) {
                spawnBoss(); // uber boss (bossKillCounter % UBER_BOSS_EVERY === 0)
            } else if (!_uberEligible && _r < Math.min(0.90, 0.02 * skillBossSpawnMult() * _dangerMult)) {
                spawnBoss(); // regular boss
            }
        }
    }
    // Cooldown reset proc (legacy stub — skillCdResetEnabled always returns false)
    if (skillCdResetEnabled() && Math.random() < 0.01) {
        gfbCooldownEnd  = 0;
        annihilationCooldownEnd = 0;
    }
    // K6 Adrenaline Reset: killing a monster has a chance to fully reset manual attack cooldown
    if (ascendedClass === 'knight' && kPts(106) > 0 && Math.random() < kPts(106) * 0.02) {
        lastBasicAttack = 0;
    }
}

function killBoss(b) {
    score += b.isUber ? BOSS_KILLS * 2 : BOSS_KILLS;
    if (b.isUber) { totalUberBossesKilled++; sessionUberBossesKilled++; }
    else          { totalBossesKilled++;     sessionBossesKilled++; }
    const _bossMult = b.isUber ? 20 : 10;
    const expGain  = Math.floor(MOB_EXP  * _bossMult * skillExpMult() * potionExpMult());
    const goldGain = Math.floor(Math.floor((MOB_GOLD_MIN + MOB_GOLD_MAX) / 2) * _bossMult * skillGoldMult() * sorcGoldMult() * potionGoldMult());
    exp  += expGain;
    gold += goldGain;
    sessionGoldEarned += goldGain;
    sessionExpEarned  += expGain;
    checkLevelUp();
    dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 18, value: expGain, color: '#ffd700', life: 100 });
    dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 32, value: goldGain, color: '#f0c040', life: 100 });
    // Loot drop
    const _bd = rollEssenceDrops(true, b.isUber);
    let _bq = 0;
    _bd.forEach(({ k, qty }) => {
        const boostedQty = Math.ceil(qty * skillBossLootMult() * sorcBossLootMult());
        inventory[k] = (inventory[k] || 0) + boostedQty;
        _bq += boostedQty;
    });
    totalMaterialsGathered += _bq;
    if (_bq > 0) dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 46, value: '+' + _bq, color: '#5599ff', life: 100 });
    bossKillCounter++;
    boss = null;
    arcaneWeakeningStacks = 0; // S10 Arcane Weakening resets on boss death
    // S8 Grand Alchemist: chance to activate a random potion effect on boss kill
    if (ascendedClass === 'sorcerer' && sPts(208) > 0 && Math.random() < sorcGrandAlchemistChance()) {
        const _rndPotions = ['small_gold', 'small_exp', 'small_cooldowns'];
        const _rndId = _rndPotions[Math.floor(Math.random() * _rndPotions.length)];
        const _now2 = Date.now();
        const _dur = 5 * 60 * 1000 * sorcPotionDurMult();
        _setPotionEnd(_rndId, Math.max(_now2, _getPotionEnd(_rndId)) + _dur);
    }
    // K6 Adrenaline Reset: killing a boss also resets cooldown
    if (ascendedClass === 'knight' && kPts(106) > 0 && Math.random() < kPts(106) * 0.02) {
        lastBasicAttack = 0;
    }
    // K10 Endless Challenge: chance to instantly spawn next uber boss
    if (ascendedClass === 'knight' && kPts(110) > 0 && Math.random() < kPts(110) * 0.01) {
        spawnBoss();
    }
    // K11 Battlefield Purge: chance to kill all remaining non-boss enemies on screen
    if (ascendedClass === 'knight' && kPts(111) > 0 && Math.random() < kPts(111) * 0.05 && worms.length > 0) {
        worms.forEach(w => killWorm(w));
        worms = [];
    }
    // Extra boss spawn (B4)
    if (skillExtraBossChance() > 0 && Math.random() < skillExtraBossChance()) {
        spawnBoss();
    }
    // S12 Essence Gathering: boss kill grants double damage buff
    if (ascendedClass === 'sorcerer' && sPts(212) > 0) {
        essenceGatheringEnd = Date.now() + sorcEssenceDuration();
        dmgNumbers.push({ x: b.x + (Math.random()*20-10), y: b.y - b.size - 60, value: '2\u00d7 DMG', color: '#ff88ff', life: 120 });
    }
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
        const barOffset = area.hpBarOffset != null ? area.hpBarOffset : 14;
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
        const bBarOffset = area.bossBarOffset != null ? area.bossBarOffset : 14;
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
    if (autoEnabled) {
        const _circTarget = (bossFocusUnlocked && boss) ? boss
                          : (autoTarget && worms.includes(autoTarget)) ? autoTarget
                          : null;
        if (_circTarget) {
            ctx.save();
            ctx.strokeStyle = (bossFocusUnlocked && boss) ? '#ff6666' : '#dd88ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(_circTarget.x, _circTarget.y, _circTarget.size + 5, 0, Math.PI * 2);
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
            // K9 Decapitation Chance: instant kill boss/uber boss
            if (ascendedClass === 'knight' && kPts(109) > 0 && Math.random() < kPts(109) * 0.005) {
                killBoss(boss);
                // K3 Cleaving Blows: AoE to all non-boss after click
                if (ascendedClass === 'knight' && kPts(103) > 0 && worms.length > 0) {
                    const cleaveDmg = Math.ceil(MOB_MAXHP * kPts(103) * 0.01);
                    worms.forEach(w => { w.hp -= cleaveDmg; if (w.hp <= 0) killWorm(w); });
                    worms = worms.filter(w => w.hp > 0);
                }
                return;
            }
            const dmg = _processClick(true);
            boss.hp -= dmg;
            spawnAttackEffect(boss.x, boss.y);
            dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
            if (boss.hp <= 0) killBoss(boss);
            // K4 Double Strike Instinct: chance to strike twice
            if (ascendedClass === 'knight' && kPts(104) > 0 && boss && Math.random() < kPts(104) * 0.03) {
                const dmg2 = _processClick(true);
                boss.hp -= dmg2;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size - 6, value: dmg2, color: '#8b0000', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            }
            // K3 Cleaving Blows: AoE to all non-boss after click
            if (ascendedClass === 'knight' && kPts(103) > 0 && worms.length > 0) {
                const cleaveDmg = Math.ceil(MOB_MAXHP * kPts(103) * 0.01);
                worms.forEach(w => { w.hp -= cleaveDmg; if (w.hp <= 0) killWorm(w); });
                worms = worms.filter(w => w.hp > 0);
            }
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
            const dmg = _processClick(false);
            clickedWorm.hp -= dmg;
            spawnAttackEffect(clickedWorm.x, clickedWorm.y);
            dmgNumbers.push({ x: clickedWorm.x + (Math.random()*20-10), y: clickedWorm.y - clickedWorm.size, value: dmg, color: '#8b0000', life: 60 });
            if (clickedWorm.hp <= 0) killWorm(clickedWorm);
            worms = worms.filter(w => w.hp > 0);
            // K4 Double Strike Instinct: chance to strike the same target again
            if (ascendedClass === 'knight' && kPts(104) > 0 && Math.random() < kPts(104) * 0.03 && worms.length > 0) {
                const dsTgt = worms.includes(clickedWorm) ? clickedWorm : worms[0];
                if (dsTgt) {
                    const dmgDs = _processClick(false);
                    dsTgt.hp -= dmgDs;
                    spawnAttackEffect(dsTgt.x, dsTgt.y);
                    dmgNumbers.push({ x: dsTgt.x + (Math.random()*20-10), y: dsTgt.y - dsTgt.size - 6, value: dmgDs, color: '#8b0000', life: 60 });
                    if (dsTgt.hp <= 0) { killWorm(dsTgt); worms = worms.filter(w => w.hp > 0); }
                }
            }
            // K7 Sweeping Strikes: +3%/pt chance to hit +1 extra worm
            if (ascendedClass === 'knight' && kPts(107) > 0 && Math.random() < kPts(107) * 0.03 && worms.length > 0) {
                const sw1 = worms[0];
                if (sw1) {
                    const sw1Dmg = _processClick(false);
                    sw1.hp -= sw1Dmg;
                    spawnAttackEffect(sw1.x, sw1.y);
                    dmgNumbers.push({ x: sw1.x + (Math.random()*20-10), y: sw1.y - sw1.size, value: sw1Dmg, color: '#cc4400', life: 60 });
                    if (sw1.hp <= 0) { killWorm(sw1); worms = worms.filter(w => w.hp > 0); }
                }
            }
            // K8 Whirlwind Extension: +2%/pt chance to hit +2 additional worms
            if (ascendedClass === 'knight' && kPts(108) > 0 && Math.random() < kPts(108) * 0.02 && worms.length > 0) {
                for (let _wi = 0; _wi < 2 && worms.length > 0; _wi++) {
                    const wwTgt = worms[0];
                    if (!wwTgt) break;
                    const wwDmg = _processClick(false);
                    wwTgt.hp -= wwDmg;
                    spawnAttackEffect(wwTgt.x, wwTgt.y);
                    dmgNumbers.push({ x: wwTgt.x + (Math.random()*20-10), y: wwTgt.y - wwTgt.size, value: wwDmg, color: '#cc4400', life: 60 });
                    if (wwTgt.hp <= 0) { killWorm(wwTgt); worms = worms.filter(w => w.hp > 0); }
                }
            }
            // K3 Cleaving Blows: AoE % max HP to all non-boss enemies
            if (ascendedClass === 'knight' && kPts(103) > 0 && worms.length > 0) {
                const cleaveDmg = Math.ceil(MOB_MAXHP * kPts(103) * 0.01);
                worms.forEach(w => { w.hp -= cleaveDmg; if (w.hp <= 0) killWorm(w); });
                worms = worms.filter(w => w.hp > 0);
            }
        }
    }
});

function update() {
    if (!spawnPaused && Math.random() < (potionMadnessActive() ? 0.2 : 0.02)) spawnWorm();
    // auto attack logic — merged worm + boss targeting (probabilistic, A1 skill)
    if (autoUnlocked) {
        const now = Date.now();
        if (now - lastAutoAttack >= effectiveAutoCooldown()) {
            lastAutoAttack = now;
            const hitTargets = [];
            if (bossFocusUnlocked && boss) {
                // boss focus: always hit boss first when alive
                const dmg = rollAutoDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            } else if (worms.length > 0) {
                if (!autoTarget || !worms.includes(autoTarget)) autoTarget = _pickAutoTarget();
                if (autoTarget) {
                    const dmg = rollAutoDmg();
                    autoTarget.hp -= dmg;
                    spawnAttackEffect(autoTarget.x, autoTarget.y);
                    dmgNumbers.push({ x: autoTarget.x + (Math.random()*20-10), y: autoTarget.y - autoTarget.size, value: dmg, color: '#8b0000', life: 60 });
                    hitTargets.push(autoTarget);
                    if (autoTarget.hp <= 0) {
                        killWorm(autoTarget);
                        worms = worms.filter(w => w !== autoTarget);
                        autoTarget = _pickAutoTarget();
                    }
                    // Multi-target (A3) — hit a second worm
                    if (skillMultiTargetChance() > 0 && Math.random() < skillMultiTargetChance()) {
                        const second = _pickAutoTarget(hitTargets);
                        if (second) {
                            const dmg2 = rollAutoDmg();
                            second.hp -= dmg2;
                            spawnAttackEffect(second.x, second.y);
                            dmgNumbers.push({ x: second.x + (Math.random()*20-10), y: second.y - second.size, value: dmg2, color: '#8b0000', life: 60 });
                            hitTargets.push(second);
                            if (second.hp <= 0) {
                                killWorm(second);
                                worms = worms.filter(w => w !== second);
                                if (autoTarget && !worms.includes(autoTarget)) autoTarget = worms.length > 0 ? worms[0] : null;
                            }
                        }
                    }
                    // Third target (A4) — hit a third worm
                    if (skillThirdTargetChance() > 0 && Math.random() < skillThirdTargetChance()) {
                        const thirdA4 = _pickAutoTarget(hitTargets);
                        if (thirdA4) {
                            const dmg3 = rollAutoDmg();
                            thirdA4.hp -= dmg3;
                            spawnAttackEffect(thirdA4.x, thirdA4.y);
                            dmgNumbers.push({ x: thirdA4.x + (Math.random()*20-10), y: thirdA4.y - thirdA4.size, value: dmg3, color: '#8b0000', life: 60 });
                            hitTargets.push(thirdA4);
                            if (thirdA4.hp <= 0) {
                                killWorm(thirdA4);
                                worms = worms.filter(w => w !== thirdA4);
                            }
                        }
                    }
                    // Extra Auto Target (knight skill 103) — hit one more worm
                    if (knightExtraAutoTarget()) {
                        const extra = _pickAutoTarget(hitTargets);
                        if (extra) {
                            const dmg4 = rollAutoDmg();
                            extra.hp -= dmg4;
                            spawnAttackEffect(extra.x, extra.y);
                            dmgNumbers.push({ x: extra.x + (Math.random()*20-10), y: extra.y - extra.size, value: dmg4, color: '#8b0000', life: 60 });
                            if (extra.hp <= 0) {
                                killWorm(extra);
                                worms = worms.filter(w => w !== extra);
                            }
                        }
                    }
                }
            } else if (boss) {
                // no worms — attack boss even without boss focus
                const dmg = rollAutoDmg();
                boss.hp -= dmg;
                spawnAttackEffect(boss.x, boss.y);
                dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size, value: dmg, color: '#8b0000', life: 60 });
                if (boss.hp <= 0) killBoss(boss);
            }
        }
    }
    // Auto Annihilation (auto-unlocked on knight ascension)
    if (knightAutoAnniOn() && annihilationUnlocked && boss && !boss.isUber && Date.now() >= annihilationCooldownEnd) {
        annihilationCooldownEnd = Date.now() + effectiveAnniCooldown();
        spawnAttackEffect(boss.x, boss.y);
        killBoss(boss);
    }
    // Heavy Magic Missile (Sorcerer S1): auto-fires every 20s
    if (ascendedClass === 'sorcerer' && sPts(201) >= 1 && !spawnPaused && Date.now() >= hmmCooldownEnd) {
        const _hmmTargets = [...worms, ...(boss ? [boss] : [])];
        if (_hmmTargets.length > 0) {
            hmmCooldownEnd = Date.now() + HMM_COOLDOWN_MS;
            hmmHitCounter++;
            const _hmmTarget = boss || worms.reduce((a, b) => a.hp <= b.hp ? a : b, worms[0]);
            const _hmmIsBoss = _hmmTarget === boss;
            const _fireHmm = (target, isBoss2) => {
                const baseHp = isBoss2 ? target.maxHp : MOB_MAXHP;
                let d = Math.ceil(baseHp * sorcHmmDmgFrac() * sorcHmmDmgMult() * sorcEssenceGatheringMult());
                if (isBoss2) {
                    d = Math.ceil(d * sorcBossDmgMult() * sorcWeakeningBonusMult());
                    if (sPts(210) > 0) arcaneWeakeningStacks = Math.min(10, arcaneWeakeningStacks + 1);
                }
                target.hp -= d;
                dmgNumbers.push({ x: target.x + (Math.random()*20-10), y: target.y - target.size, value: d, color: '#9900ff', life: 60 });
                spawnMissileEffect(target.x, target.y);
            };
            _fireHmm(_hmmTarget, _hmmIsBoss);
            if (_hmmIsBoss) { if (boss && boss.hp <= 0) killBoss(boss); }
            else { if (_hmmTarget.hp <= 0) { killWorm(_hmmTarget); worms = worms.filter(w => w !== _hmmTarget); } }
            // S4 Ultimate Explosion: chance per missile to instantly kill all non-boss enemies
            if (sPts(204) > 0 && !_hmmIsBoss && Math.random() < sorcUltimateExplosionChance()) {
                worms.forEach(w => killWorm(w));
                worms = [];
                spawnUltimateExplosion(); // visual effect
            }
            // S3 Triple Missile Chance: chance to fire 2 extra missiles
            if (sPts(203) > 0 && Math.random() < sorcTripleMissileChance()) {
                for (let _mi = 0; _mi < 2; _mi++) {
                    const _extra = _hmmIsBoss ? boss : (worms.length > 0 ? worms[0] : null);
                    if (!_extra) break;
                    _fireHmm(_extra, _hmmIsBoss);
                    if (_hmmIsBoss) {
                        if (boss && boss.hp <= 0) { killBoss(boss); break; }
                    } else {
                        if (_extra.hp <= 0) { killWorm(_extra); worms = worms.filter(w => w !== _extra); }
                        // S4 Ultimate Explosion check for each extra missile too
                        if (sPts(204) > 0 && Math.random() < sorcUltimateExplosionChance() && worms.length > 0) {
                            worms.forEach(w => killWorm(w));
                            worms = [];
                            spawnUltimateExplosion(); // visual effect
                            break;
                        }
                    }
                }
            }

        }
    }
    // Sudden Death (Sorcerer S11): boss-only nuke, fires every max(150s, 600s-pts×45s), deals 100% boss maxHP
    if (ascendedClass === 'sorcerer' && sPts(211) >= 1 && boss && Date.now() >= suddenDeathCooldownEnd) {
        suddenDeathCooldownEnd = Date.now() + sorcSuddenDeathCooldownMs();
        const sdDmg = Math.ceil(boss.maxHp * 1.0 * sorcBossDmgMult() * sorcWeakeningBonusMult() * sorcEssenceGatheringMult());
        boss.hp -= sdDmg;
        dmgNumbers.push({ x: boss.x + (Math.random()*20-10), y: boss.y - boss.size - 16, value: sdDmg, color: '#ff00cc', life: 80 });
        spawnSuddenDeathEffect(boss.x, boss.y);
        if (boss.hp <= 0) killBoss(boss);
    }
    // auto GFB logic
    if (autoGfbUnlocked && gfbUnlocked && (worms.length > 0 || boss) && !fireballActive && !spawnPaused &&
            Date.now() >= gfbCooldownEnd && gold >= GFB_GOLD_COST) {
        castGfb();
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
    // update HMM + Sudden Death CD bars (Sorcerer only)
    if (ascendedClass === 'sorcerer') {
        if (sPts(201) >= 1) {
            const hmmRemaining = Math.max(0, hmmCooldownEnd - Date.now());
            document.getElementById('cd-hmm-bar').style.width  = hmmRemaining > 0 ? ((1 - hmmRemaining / HMM_COOLDOWN_MS) * 100) + '%' : '100%';
            document.getElementById('cd-hmm-text').textContent = hmmRemaining > 0 ? (hmmRemaining / 1000).toFixed(1) + 's' : 'Ready';
        }
        if (sPts(211) >= 1) {
            const sdRemaining = Math.max(0, suddenDeathCooldownEnd - Date.now());
            const sdCd = sorcSuddenDeathCooldownMs();
            document.getElementById('cd-sd-bar').style.width  = sdRemaining > 0 ? ((1 - sdRemaining / sdCd) * 100) + '%' : '100%';
            document.getElementById('cd-sd-text').textContent = sdRemaining > 0 ? Math.ceil(sdRemaining / 1000) + 's' : 'Ready';
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
        autoAnniEl.textContent = autoAnniEnabled ? 'Auto Annihilation: ON' : 'Auto Annihilation: OFF';
        autoAnniEl.disabled = false;
        autoAnniEl.classList.toggle('auto-on', autoAnniEnabled);
        document.getElementById('cd-anni-bar').style.width  = annihilationUnlocked && anniRemaining > 0 ? ((1 - anniRemaining / effectiveAnniCooldown()) * 100) + '%' : (annihilationUnlocked ? '100%' : '0%');
        document.getElementById('cd-anni-text').textContent = !annihilationUnlocked ? 'Locked' : (anniRemaining > 0 ? Math.ceil(anniRemaining / 1000) + 's' : (boss ? 'Ready' : 'No boss'));
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

// Annihilation button (Knight only — auto-unlocked on ascension)
document.getElementById('annihilationBtn').addEventListener('click', () => {
    if (ascendedClass !== 'knight' || !annihilationUnlocked) return;
    if (!boss || boss.isUber || Date.now() < annihilationCooldownEnd) return;
    spawnAttackEffect(boss.x, boss.y);
    annihilationCooldownEnd = Date.now() + effectiveAnniCooldown();
    killBoss(boss);
});

document.getElementById('autoAnniBtn').addEventListener('click', () => {
    if (!annihilationUnlocked) return;
    autoAnniEnabled = !autoAnniEnabled;
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
    const VERSION = '2026-03-16-v3';
    if (localStorage.getItem('announcementDismissed') !== VERSION) {
        document.getElementById('announcement-overlay').classList.add('visible');
    }
})();

function closeAnnouncement() {
    localStorage.setItem('announcementDismissed', '2026-03-16-v3');
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