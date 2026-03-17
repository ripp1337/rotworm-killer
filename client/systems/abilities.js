// ── Abilities — fireball, HMM, Sudden Death ───────────────────────

import * as S from './state.js';
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

export function canFireGfb(now) {
    return S.gfbCooldownEnd <= now && S.hasGfb;
}

export function castGfb(now, area) {
    if (!canFireGfb(now)) return null;

    const allTargets = S.boss ? [...S.worms, S.boss] : [...S.worms];
    if (allTargets.length === 0) return null;

    // C4 Ember Cascade: 30% chance to reset GFB CD on kill
    let resetCd = false;
    let totalDmg = 0;
    const results = [];

    for (const t of allTargets) {
        const dmg  = Math.max(1, Math.floor(t.maxHp * skillFbDmgFrac()));
        t.hp -= dmg;
        totalDmg += dmg;
        results.push({ target: t, dmg });

        // C3 Annihilation chance: 30% at max → instant kill non-boss
        const anniChance = skillPts(34) * 0.03;
        if (!t.isBoss && Math.random() < anniChance) {
            t.hp = 0;
        }
    }

    // C4 Ember Cascade: resets GFB CD if any target was killed
    const anythingDied = results.some(r => r.target.hp <= 0);
    const embarCascadeChance = kPts(112) * 0.03;
    if (anythingDied && Math.random() < embarCascadeChance) {
        resetCd = true;
    }

    S.gfbCooldownEnd = resetCd ? now : now + GFB_COOLDOWN_MS;
    return results;
}

// Auto GFB (fires automatically when off cooldown if autoGfbEnabled)
export function tickAutoGfb(now, area) {
    if (!S.autoGfbEnabled) return null;
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
