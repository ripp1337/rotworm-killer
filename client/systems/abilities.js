// ── Abilities — fireball, HMM, Sudden Death ───────────────────────

import { S } from './state.js';
import { AREAS, getAreaIndex } from '../data/areas.js';
import {
    GFB_COOLDOWN_MS, HMM_COOLDOWN_MS, SUDDEN_DEATH_COOLDOWN_MS,
} from '../data/constants.js';
import {
    kPts, sPts, skillPts,
    skillFbDmgFrac, sorcHmmDmgFrac, sorcBossDmgMult,
    sorcWeakeningMult, effectiveHmmCooldown,
    sorcTripleMissileChance, sorcUltExplosionChance,
} from './skills.js';
import { spawnFloatingDmg } from '../renderer/fx.js';

// ── Fireball (GFB) ───────────────────────────────────────────────

// Diamond AoE dimensions (in px, using TILE = 32):
//   OOOXXXOOO   row ±2 tiles: |dx| ≤ 1 tile
//   OOXXXXXOO   row ±1 tiles: |dx| ≤ 2 tiles
//   OXXXXXXXO   row  0      : |dx| ≤ 3 tiles
// Formula: |dx| + |dy| ≤ 3 * TILE  &&  |dy| ≤ 2 * TILE  (Manhattan diamond)
const _TILE = 32;
function _inGfbAoE(cx, cy, tx, ty) {
    const adx = Math.abs(tx - cx);
    const ady = Math.abs(ty - cy);
    return adx + ady <= 3 * _TILE && ady <= 2 * _TILE;
}

export function canFireGfb(now) {
    return S.gfbCooldownEnd <= now && (skillPts(31) >= 1 || S.gfbUnlocked);
}

export function castGfb(now, area) {
    if (!canFireGfb(now)) return null;

    const allTargets = S.boss ? [...S.worms, S.boss] : [...S.worms];
    if (allTargets.length === 0) return null;

    // Find the monster-center that maximises targets inside the AoE diamond
    let bestCenter = null;
    let bestCount  = 0;
    for (const cand of allTargets) {
        const cx = cand.x + cand.size / 2;
        const cy = cand.y + cand.size / 2;
        let count = 0;
        for (const t of allTargets) {
            if (_inGfbAoE(cx, cy, t.x + t.size / 2, t.y + t.size / 2)) count++;
        }
        if (count > bestCount) { bestCount = count; bestCenter = { x: cx, y: cy }; }
    }
    if (!bestCenter) return null;

    // Apply damage to every target inside the chosen AoE
    const results = [];
    for (const t of allTargets) {
        if (!_inGfbAoE(bestCenter.x, bestCenter.y, t.x + t.size / 2, t.y + t.size / 2)) continue;
        const dmg = Math.max(1, Math.floor(t.maxHp * skillFbDmgFrac()));
        t.hp -= dmg;
        results.push({ target: t, dmg });
        // C3 Annihilation chance: instant kill non-boss
        if (!t.isBoss && Math.random() < skillPts(34) * 0.03) t.hp = 0;
    }

    // C4 Ember Cascade: resets GFB CD if any target died
    const anythingDied = results.some(r => r.target.hp <= 0);
    const emberChance  = skillPts(33) * 0.02;
    const resetCd = anythingDied && Math.random() < emberChance;

    S.gfbCooldownEnd = resetCd ? now : now + GFB_COOLDOWN_MS;
    return { results, center: bestCenter };
}

// Auto GFB (fires automatically when off cooldown if skill is unlocked)
export function tickAutoGfb(now, area) {
    return castGfb(now, area);
}

// ── Holy Missile Mortar (HMM) ────────────────────────────────────

export function canFireHmm(now) {
    return S.hmmCooldownEnd <= now && S.hasHmm;
}

export function castHmm(now, area) {
    if (!canFireHmm(now)) return null;

    const allTargets = S.boss ? [...S.worms, S.boss] : [...S.worms];
    if (allTargets.length === 0) return null;

    const results = [];

    for (const t of allTargets) {
        const isBoss = !!t.isBoss;
        let dmg = Math.max(1, Math.floor(t.maxHp * sorcHmmDmgFrac()));

        // Arcane Weakening: stacks amplify dmg 10% each
        if (S.arcaneWeakeningStacks > 0) {
            dmg = Math.floor(dmg * (1 + S.arcaneWeakeningStacks * 0.10));
        }

        if (isBoss) {
            dmg = Math.floor(dmg * sorcBossDmgMult());
        }

        t.hp -= dmg;
        results.push({ target: t, dmg });

        // S3 Triple Missile: each missile fires extra projectiles (visual only,
        // but on boss the extra missiles deal the same damage)
        const tripleChance = sorcTripleMissileChance();
        if (t.isBoss && Math.random() < tripleChance) {
            const bonusDmg = Math.floor(dmg * 2);
            t.hp -= bonusDmg;
            results.push({ target: t, dmg: bonusDmg, isBonus: true });
        }

        // S4 Ultimate Explosion: chance to instantly kill all non-boss enemies
        const explodeChance = sorcUltExplosionChance();
        if (!t.isBoss && Math.random() < explodeChance) {
            t.hp = 0;
        }
    }

    // Apply arcane weakening stacks to boss
    if (S.boss) {
        const stackGain = sPts(202);  // S2 Arcane Weakening
        if (stackGain > 0) {
            S.arcaneWeakeningStacks = Math.min(10, S.arcaneWeakeningStacks + 1);
        }
    }

    S.hmmCooldownEnd = now + effectiveHmmCooldown();
    return results;
}

// ── Sudden Death ─────────────────────────────────────────────────

export function canFireSuddenDeath(now) {
    return S.suddenDeathCooldownEnd <= now && S.ascendedClass === 'sorcerer' && sPts(205) > 0;
}

export function castSuddenDeath(now) {
    if (!canFireSuddenDeath(now)) return null;

    const target = S.boss ?? S.worms[0];
    if (!target) return null;

    const dmg = target.hp;
    target.hp  = 0;

    S.suddenDeathCooldownEnd = now + SUDDEN_DEATH_COOLDOWN_MS;
    return [{ target, dmg }];
}
