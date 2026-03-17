// ── Global mutable game state ─────────────────────────────────────
// Single exported object. Import as:  import { S } from './state.js'
// Mutate directly: S.gold += 100  — works because S is an object, not a binding.

export const S = {
    // ── Auth ───────────────────────────────────────────────────────
    authToken:       null,
    loggedInPlayer:  null,

    // ── Combat ───────────────────────────────────────────────────
    worms:           [],
    boss:            null,
    score:           0,
    gold:            0,
    exp:             0,
    level:           1,
    levelUpMsg:      0,
    ascendMsg:       0,

    // ── Progression ───────────────────────────────────────────────
    weaponIndex:     0,
    skillPoints:     {},
    knightSkillPts:  {},
    sorcSkillPts:    {},

    // ── Ascension ─────────────────────────────────────────────────
    ascended:        false,
    ascendedClass:   null,
    respecCount:     0,

    // ── Areas ─────────────────────────────────────────────────────
    currentArea:     'Rookgaard',
    unlockedAreas:   ['Rookgaard'],

    // ── Inventory ─────────────────────────────────────────────────
    inventory: {
        blueEssence: 0, greenEssence: 0, redEssence: 0, yellowEssence: 0,
    },

    // ── Potion timers (ms timestamps when each buff expires) ───────
    potionTimers: {
        small_gold:       0,
        small_exp:        0,
        small_cooldowns:  0,
        medium_gold:      0,
        medium_exp:       0,
        medium_cooldowns: 0,
        large_gold:       0,
        large_exp:        0,
        large_cooldowns:  0,
        potion_of_danger:  0,
        potion_of_madness: 0,
    },

    // ── Combat timers ─────────────────────────────────────────────
    lastBasicAttack:        0,
    lastAutoAttack:         0,
    nextAutoAttackMs:       0,
    gfbCooldownEnd:         0,
    hmmCooldownEnd:         0,
    arcaneWeakeningStacks:  0,
    suddenDeathCooldownEnd: 0,
    essenceGatheringEnd:    0,

    // ── Spawn counters ────────────────────────────────────────────
    bossSpawnCounter: 0,
    bossKillCounter:  0,

    // ── Statistics ────────────────────────────────────────────────
    totalClicks:            0,
    totalMonstersKilled:    0,
    totalBossesKilled:      0,
    totalUberBossesKilled:  0,
    totalMaterialsGathered: 0,
    totalPotionsCrafted:    0,
    totalGoldGenerated:     0,
    momentumClicks:         0,

    // ── 5-minute stats window ────────────────────────────────────
    statsWindowGold:  0,
    statsWindowExp:   0,
    statsWindowStart: 0,

    // ── Feature flags ─────────────────────────────────────────────
    autoEnabled:    false,
    autoGfbEnabled: false,
    gfbUnlocked:    false,

    // ── Internal ──────────────────────────────────────────────────
    _eid: 0,
};

export function nextEid() { return ++S._eid; }
