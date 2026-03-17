// ── Loot — gold, exp, and essence drops ──────────────────────────

import { S } from './state.js';
import { getAreaIndex } from '../data/areas.js';
import { LOOT_TABLE }   from '../data/recipes.js';
import {
    potionGoldMult, potionExpMult, sorcEssenceGatheringMult,
    skillGoldMult, skillExpMult,
} from './skills.js';

// ── Gold gain ────────────────────────────────────────────────────

export function goldGain(area, isBoss, isUber) {
    let g;
    if (isUber)      g = area.uberBossGold  ?? area.bossGold * 10;
    else if (isBoss) g = area.bossGold;
    else             g = area.mobGold;

    g *= skillGoldMult();
    g *= potionGoldMult();
    return Math.max(1, Math.floor(g));
}

// ── Exp gain ─────────────────────────────────────────────────────

export function expGain(area, isBoss, isUber) {
    let e;
    if (isUber)      e = area.uberBossExp  ?? area.bossExp * 10;
    else if (isBoss) e = area.bossExp;
    else             e = area.mobExp;

    e *= skillExpMult();
    e *= potionExpMult();
    return Math.max(1, Math.floor(e));
}

// ── Essence drops ────────────────────────────────────────────────

export function rollEssenceDrops(isBoss, isUber) {
    const drops = [];
    const areaIdx = getAreaIndex(S.currentArea);
    const entry   = LOOT_TABLE[Math.min(areaIdx, LOOT_TABLE.length - 1)];
    if (!entry) return drops;

    let chance = entry.dropChance;
    if (isBoss)  chance *= 5;
    if (isUber)  chance *= 15;
    chance *= sorcEssenceGatheringMult();

    const rolls = (isBoss || isUber) ? 5 : 1;
    for (let i = 0; i < rolls; i++) {
        if (Math.random() < chance) {
            drops.push(entry.essence);
        }
    }
    return drops;
}

// Apply drops to inventory
export function applyEssenceDrops(drops) {
    for (const name of drops) {
        S.inventory[name] = (S.inventory[name] ?? 0) + 1;
    }
}
