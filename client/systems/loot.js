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
    // Mob gold is a random range; boss/uber values fall back to multiples of mob avg.
    const mobGold  = Math.floor(Math.random() * (area.mobGoldMax - area.mobGoldMin + 1) + area.mobGoldMin);
    const bossGold = area.bossGold  ?? Math.floor((area.mobGoldMin + area.mobGoldMax) / 2) * 10;
    const uberGold = area.uberBossGold ?? bossGold * 10;

    let g;
    if (isUber)      g = uberGold;
    else if (isBoss) g = bossGold;
    else             g = mobGold;

    g *= skillGoldMult();
    g *= potionGoldMult();
    return Math.max(1, Math.floor(g));
}

// ── Exp gain ─────────────────────────────────────────────────────

export function expGain(area, isBoss, isUber) {
    // Boss/uber exp falls back to multiples of mob exp when not explicitly set.
    const mobExp  = area.mobExp;
    const bossExp = area.bossExp  ?? mobExp * 10;
    const uberExp = area.uberBossExp ?? bossExp * 10;

    let e;
    if (isUber)      e = uberExp;
    else if (isBoss) e = bossExp;
    else             e = mobExp;

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
