// ── Load — apply server-owned state from login/me response ────────

import * as S from '../systems/state.js';

// Called after a successful /api/login or /api/me response.
// Only sets fields that the server owns; client-owned combat state is
// either kept as-is or initialised to 0.
export function loadState(data) {
    // Auth
    S.authToken      = data.token   ?? S.authToken;
    S.loggedInPlayer = data.username ?? S.loggedInPlayer;

    // Progression — server-owned
    S.level          = data.level         ?? 1;
    S.exp            = data.exp           ?? 0;
    S.gold           = data.gold          ?? 0;
    S.score          = data.score         ?? 0;
    S.weaponIndex    = data.weapon_index  ?? 0;

    // Skill maps
    S.skillPoints    = data.skill_pts    ?? {};
    S.knightSkillPts = data.knight_pts   ?? {};
    S.sorcSkillPts   = data.sorc_pts     ?? {};

    // Ascension
    S.ascended       = !!data.ascended;
    S.ascendedClass  = data.ascended_class ?? null;
    S.respecCount    = data.respec_count   ?? 0;

    // Areas
    S.currentArea    = data.current_area    ?? 'Rookgaard';
    S.unlockedAreas  = data.unlocked_areas  ?? ['Rookgaard'];

    // Inventory + potions
    S.inventory = data.inventory ?? {};
    _applyPotionTimers(data.potion_timers ?? {});

    // Cooldown timestamps (server-persisted)
    S.hmmCooldownEnd         = data.hmm_cd_end              ?? 0;
    S.arcaneWeakeningStacks  = data.arcane_weakness_stacks   ?? 0;
    S.suddenDeathCooldownEnd = data.sudden_death_cd_end      ?? 0;
    S.essenceGatheringEnd    = data.essence_gathering_end    ?? 0;

    // Kill counters
    S.bossSpawnCounter = data.boss_spawn_counter ?? 0;
    S.bossKillCounter  = data.boss_kill_counter  ?? 0;
    S.totalClicks      = data.total_clicks       ?? 0;
}

function _applyPotionTimers(timers) {
    S.potionSmallSpeedEnd  = timers.potion_small_speed  ?? 0;
    S.potionMediumSpeedEnd = timers.potion_medium_speed ?? 0;
    S.potionLargeSpeedEnd  = timers.potion_large_speed  ?? 0;
    S.potionSmallGoldEnd   = timers.potion_small_gold   ?? 0;
    S.potionMediumGoldEnd  = timers.potion_medium_gold  ?? 0;
    S.potionLargeGoldEnd   = timers.potion_large_gold   ?? 0;
    S.potionSmallExpEnd    = timers.potion_small_exp    ?? 0;
    S.potionMediumExpEnd   = timers.potion_medium_exp   ?? 0;
    S.potionLargeExpEnd    = timers.potion_large_exp    ?? 0;
    S.potionDangerEnd      = timers.potion_danger       ?? 0;
    S.potionMadnessEnd     = timers.potion_madness      ?? 0;
}
