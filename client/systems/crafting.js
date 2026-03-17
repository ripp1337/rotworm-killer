// ── Crafting — potion craft and timer helpers ─────────────────────

import { S } from './state.js';
import { CRAFTING_RECIPES } from '../data/recipes.js';
import { saveProgress } from '../persistence/save.js';

// ── Potion timer map ─────────────────────────────────────────────
// Each recipe has an `id` that maps to a state field for its end-timestamp.
const TIMER_MAP = {
    'potion_small_speed':     () => S.potionSmallSpeedEnd,
    'potion_medium_speed':    () => S.potionMediumSpeedEnd,
    'potion_large_speed':     () => S.potionLargeSpeedEnd,
    'potion_small_gold':      () => S.potionSmallGoldEnd,
    'potion_medium_gold':     () => S.potionMediumGoldEnd,
    'potion_large_gold':      () => S.potionLargeGoldEnd,
    'potion_small_exp':       () => S.potionSmallExpEnd,
    'potion_medium_exp':      () => S.potionMediumExpEnd,
    'potion_large_exp':       () => S.potionLargeExpEnd,
    'potion_danger':          () => S.potionDangerEnd,
    'potion_madness':         () => S.potionMadnessEnd,
};

const TIMER_SETTERS = {
    'potion_small_speed':     v => { S.potionSmallSpeedEnd  = v; },
    'potion_medium_speed':    v => { S.potionMediumSpeedEnd = v; },
    'potion_large_speed':     v => { S.potionLargeSpeedEnd  = v; },
    'potion_small_gold':      v => { S.potionSmallGoldEnd   = v; },
    'potion_medium_gold':     v => { S.potionMediumGoldEnd  = v; },
    'potion_large_gold':      v => { S.potionLargeGoldEnd   = v; },
    'potion_small_exp':       v => { S.potionSmallExpEnd    = v; },
    'potion_medium_exp':      v => { S.potionMediumExpEnd   = v; },
    'potion_large_exp':       v => { S.potionLargeExpEnd    = v; },
    'potion_danger':          v => { S.potionDangerEnd      = v; },
    'potion_madness':         v => { S.potionMadnessEnd     = v; },
};

// Potion groups — only one from each group active at a time
const GROUPS = {
    speed:  ['potion_small_speed', 'potion_medium_speed', 'potion_large_speed'],
    gold:   ['potion_small_gold',  'potion_medium_gold',  'potion_large_gold'],
    exp:    ['potion_small_exp',   'potion_medium_exp',   'potion_large_exp'],
    danger: ['potion_danger'],
    madness:['potion_madness'],
};

function getGroupOf(id) {
    for (const [g, ids] of Object.entries(GROUPS)) {
        if (ids.includes(id)) return g;
    }
    return null;
}

function isGroupActive(group) {
    const now = Date.now();
    return GROUPS[group]?.some(id => (TIMER_MAP[id]?.() ?? 0) > now);
}

export function getPotionEnd(id)       { return TIMER_MAP[id]?.()  ?? 0; }
export function setPotionEnd(id, ts)   { TIMER_SETTERS[id]?.(ts); }
export function isPotionActive(id)     { return getPotionEnd(id) > Date.now(); }

// ── Craft a potion ───────────────────────────────────────────────

export function craftPotion(recipeId) {
    const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { ok: false, msg: 'Unknown recipe.' };

    // Level gate
    if (recipe.levelReq && S.level < recipe.levelReq)
        return { ok: false, msg: `Requires level ${recipe.levelReq}.` };

    // Ascension gate (ascendedOnly)
    if (recipe.ascendedOnly && !S.ascended)
        return { ok: false, msg: 'Requires ascension.' };

    // Group conflict
    const group = getGroupOf(recipeId);
    if (group && isGroupActive(group))
        return { ok: false, msg: 'A potion of this type is already active.' };

    // Check gold
    if (S.gold < recipe.goldCost)
        return { ok: false, msg: 'Not enough gold.' };

    // Check ingredients
    for (const [item, qty] of Object.entries(recipe.ingredients ?? {})) {
        if ((S.inventory[item] ?? 0) < qty)
            return { ok: false, msg: `Missing ${qty}× ${item}.` };
    }

    // Consume
    S.gold -= recipe.goldCost;
    for (const [item, qty] of Object.entries(recipe.ingredients ?? {})) {
        S.inventory[item] -= qty;
    }

    // Set timer
    const durationMs = recipe.durationMs ?? 300_000;
    setPotionEnd(recipeId, Date.now() + durationMs);

    saveProgress();
    return { ok: true };
}
