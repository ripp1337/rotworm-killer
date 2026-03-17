// ── Global mutable game state ─────────────────────────────────────
// All runtime variables live here. Imported by every module that needs state.
// Persistence modules read/write these directly.

export let worms       = [];
export let boss        = null;   // active boss or null
export let score       = 0;
export let gold        = 0;
export let exp         = 0;
export let level       = 1;
export let levelUpMsg  = 0;      // expiry timestamp of level-up flash
export let ascendMsg   = 0;      // expiry timestamp of ascension flash

export let weaponIndex    = 0;
export let skillPoints    = {};  // general skill pts  {id: pts}
export let knightSkillPts = {};  // knight skill pts
export let sorcSkillPts   = {};  // sorcerer skill pts

export let ascended      = false;
export let ascendedClass = null; // 'knight' | 'sorcerer' | null

export let respecCount   = 0;

export let currentArea    = 'Rookgaard';
export let unlockedAreas  = ['Rookgaard'];

export let inventory = {
    blueEssence: 0, greenEssence: 0, redEssence: 0, yellowEssence: 0,
};

// Potion timers — ms timestamp when buff expires (0 = inactive)
export let potionTimers = {
    small_gold:      0,
    small_exp:       0,
    small_cooldowns: 0,
    medium_gold:     0,
    medium_exp:      0,
    medium_cooldowns: 0,
    large_gold:      0,
    large_exp:       0,
    large_cooldowns: 0,
    potion_of_danger:  0,
    potion_of_madness: 0,
};

// Combat timers
export let lastBasicAttack     = 0;   // timestamp last click-attack landed
export let lastAutoAttack      = 0;   // timestamp last auto-attack fired
export let gfbCooldownEnd      = 0;   // fireball ready after this ms
export let hmmCooldownEnd      = 0;
export let arcaneWeakeningStacks = 0;
export let suddenDeathCooldownEnd = 0;
export let essenceGatheringEnd   = 0;

// Spawn counters
export let bossSpawnCounter  = 0;    // increments on every kill
export let bossKillCounter   = 0;    // increments on every boss kill

// Misc
export let totalClicks            = 0;
export let totalMonstersKilled    = 0;
export let totalBossesKilled      = 0;
export let totalUberBossesKilled  = 0;
export let totalMaterialsGathered = 0;
export let totalPotionsCrafted    = 0;
export let momentumClicks         = 0;  // K12 Momentum Overdrive lifetime click counter

// Feature unlock flags (derived from skill points — for convenience)
export let autoEnabled    = false;
export let autoGfbEnabled = false;
export let gfbUnlocked    = false;

// Entity ID counter for sprites
export let _eid = 0;
export function nextEid() { return ++_eid; }

// ── Setters ───────────────────────────────────────────────────────
// Use these to mutate state from other modules.

export function setState(patches) {
    if ('worms'                  in patches) worms                  = patches.worms;
    if ('boss'                   in patches) boss                   = patches.boss;
    if ('score'                  in patches) score                  = patches.score;
    if ('gold'                   in patches) gold                   = patches.gold;
    if ('exp'                    in patches) exp                    = patches.exp;
    if ('level'                  in patches) level                  = patches.level;
    if ('levelUpMsg'             in patches) levelUpMsg             = patches.levelUpMsg;
    if ('ascendMsg'              in patches) ascendMsg              = patches.ascendMsg;
    if ('weaponIndex'            in patches) weaponIndex            = patches.weaponIndex;
    if ('skillPoints'            in patches) skillPoints            = patches.skillPoints;
    if ('knightSkillPts'         in patches) knightSkillPts         = patches.knightSkillPts;
    if ('sorcSkillPts'           in patches) sorcSkillPts           = patches.sorcSkillPts;
    if ('ascended'               in patches) ascended               = patches.ascended;
    if ('ascendedClass'          in patches) ascendedClass          = patches.ascendedClass;
    if ('respecCount'            in patches) respecCount            = patches.respecCount;
    if ('currentArea'            in patches) currentArea            = patches.currentArea;
    if ('unlockedAreas'          in patches) unlockedAreas          = patches.unlockedAreas;
    if ('inventory'              in patches) inventory              = patches.inventory;
    if ('potionTimers'           in patches) potionTimers           = patches.potionTimers;
    if ('lastBasicAttack'        in patches) lastBasicAttack        = patches.lastBasicAttack;
    if ('lastAutoAttack'         in patches) lastAutoAttack         = patches.lastAutoAttack;
    if ('gfbCooldownEnd'         in patches) gfbCooldownEnd         = patches.gfbCooldownEnd;
    if ('hmmCooldownEnd'         in patches) hmmCooldownEnd         = patches.hmmCooldownEnd;
    if ('arcaneWeakeningStacks'  in patches) arcaneWeakeningStacks  = patches.arcaneWeakeningStacks;
    if ('suddenDeathCooldownEnd' in patches) suddenDeathCooldownEnd = patches.suddenDeathCooldownEnd;
    if ('essenceGatheringEnd'    in patches) essenceGatheringEnd    = patches.essenceGatheringEnd;
    if ('bossSpawnCounter'       in patches) bossSpawnCounter       = patches.bossSpawnCounter;
    if ('bossKillCounter'        in patches) bossKillCounter        = patches.bossKillCounter;
    if ('totalClicks'            in patches) totalClicks            = patches.totalClicks;
    if ('totalMonstersKilled'    in patches) totalMonstersKilled    = patches.totalMonstersKilled;
    if ('totalBossesKilled'      in patches) totalBossesKilled      = patches.totalBossesKilled;
    if ('totalUberBossesKilled'  in patches) totalUberBossesKilled  = patches.totalUberBossesKilled;
    if ('totalMaterialsGathered' in patches) totalMaterialsGathered = patches.totalMaterialsGathered;
    if ('totalPotionsCrafted'    in patches) totalPotionsCrafted    = patches.totalPotionsCrafted;
    if ('momentumClicks'         in patches) momentumClicks         = patches.momentumClicks;
    if ('autoEnabled'            in patches) autoEnabled            = patches.autoEnabled;
    if ('autoGfbEnabled'         in patches) autoGfbEnabled         = patches.autoGfbEnabled;
    if ('gfbUnlocked'            in patches) gfbUnlocked            = patches.gfbUnlocked;
}
