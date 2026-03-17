// ── Save — send game state to the server ─────────────────────────

import * as S from '../systems/state.js';

let _saveTimer = null;

// Shared authenticated fetch helper (used by ui modules too)
export async function apiFetch(path, body) {
    const res = await fetch(path, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${S.authToken}`,
        },
        body: JSON.stringify(body),
    });
    return res.json();
}

// Build the save payload — client-owned fields only (NOT weapon, skills, areas)
function buildSavePayload() {
    return {
        gold:  S.gold,
        exp:   S.exp,
        score: S.score,
        total_clicks: S.totalClicks,

        inventory:    S.inventory,
        potion_timers: _collectPotionTimers(),

        hmm_cd_end:              S.hmmCooldownEnd,
        arcane_weakness_stacks:  S.arcaneWeakeningStacks,
        sudden_death_cd_end:     S.suddenDeathCooldownEnd,
        essence_gathering_end:   S.essenceGatheringEnd,

        boss_spawn_counter:      S.bossSpawnCounter,
        boss_kill_counter:       S.bossKillCounter,
    };
}

function _collectPotionTimers() {
    return {
        potion_small_speed:  S.potionSmallSpeedEnd,
        potion_medium_speed: S.potionMediumSpeedEnd,
        potion_large_speed:  S.potionLargeSpeedEnd,
        potion_small_gold:   S.potionSmallGoldEnd,
        potion_medium_gold:  S.potionMediumGoldEnd,
        potion_large_gold:   S.potionLargeGoldEnd,
        potion_small_exp:    S.potionSmallExpEnd,
        potion_medium_exp:   S.potionMediumExpEnd,
        potion_large_exp:    S.potionLargeExpEnd,
        potion_danger:       S.potionDangerEnd,
        potion_madness:      S.potionMadnessEnd,
    };
}

// Debounced save — coalesces rapid calls into one request
export function saveProgress(immediate = false) {
    if (!S.authToken) return;
    clearTimeout(_saveTimer);
    const delay = immediate ? 0 : 5000;
    _saveTimer = setTimeout(_doSave, delay);
}

async function _doSave() {
    if (!S.authToken) return;
    try {
        const res = await apiFetch('/api/save', buildSavePayload());
        if (res.ok) {
            // Server may return corrected level/score after capping
            if (res.level !== undefined) S.level = res.level;
            if (res.score !== undefined) S.score = res.score;
            if (res.gold  !== undefined) S.gold  = res.gold;
            if (res.exp   !== undefined) S.exp   = res.exp;
        }
    } catch {/* network error — will retry on next save */ }
}

// Send via sendBeacon on unload (no guarantee of response)
export function saveOnUnload() {
    if (!S.authToken) return;
    const payload = JSON.stringify(buildSavePayload());
    navigator.sendBeacon(
        '/api/save',
        new Blob([payload], { type: 'application/json' }),
    );
}
