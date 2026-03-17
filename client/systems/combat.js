// ── Combat damage calculations ────────────────────────────────────

import * as S from './state.js';
import { WEAPONS } from '../data/weapons.js';
import {
    knightClickDmgMult, knightMaxHpBonusFrac, knightDoubleStrikeChance,
    knightSweepChance, knightWhirlwindChance, knightDecapitationChance,
    knightAoeFrac, skillAutoDmgMult, sorcBossDmgMult, sorcWeakeningMult,
    totalDmgMult, skillFbDmgFrac, sorcHmmDmgFrac,
} from './skills.js';

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getWeapon() {
    return WEAPONS[Math.min(S.weaponIndex, WEAPONS.length - 1)];
}

// Raw weapon roll (min–max)
export function rollWeaponBase() {
    const w = getWeapon();
    return rand(w.min, w.max);
}

// Click damage on a specific target
export function rollClickDmg(target, isBoss) {
    const w   = getWeapon();
    let   dmg = rand(w.min, w.max);

    // Knight multipliers
    if (S.ascendedClass === 'knight') {
        dmg *= knightClickDmgMult();
        dmg += target.maxHp * knightMaxHpBonusFrac();
    }

    dmg *= totalDmgMult(isBoss);
    return Math.max(1, Math.floor(dmg));
}

// Auto-attack damage
export function rollAutoDmg(target, isBoss) {
    const w   = getWeapon();
    let   dmg = rand(w.min, w.max) * skillAutoDmgMult();
    dmg *= totalDmgMult(isBoss);
    return Math.max(1, Math.floor(dmg));
}

// AoE splash damage (Cleaving Blows K3) — percent of non-boss max HP
export function rollCleaveAoeDmg(target) {
    if (S.ascendedClass !== 'knight') return 0;
    return Math.floor(target.maxHp * knightAoeFrac());
}

// Fireball damage
export function rollGfbDmg(target) {
    return Math.max(1, Math.floor(target.maxHp * skillFbDmgFrac()));
}

// HMM damage
export function rollHmmDmg(target, isBoss) {
    let dmg = target.maxHp * sorcHmmDmgFrac();
    if (isBoss) dmg *= sorcBossDmgMult() * sorcWeakeningMult();
    return Math.max(1, Math.floor(dmg));
}

// Whether a double-strike fires
export function rollsDoubleStrike() {
    return S.ascendedClass === 'knight' && Math.random() < knightDoubleStrikeChance();
}

// Extra targets for a click (returns 0, 1, or 2 extra)
export function rollExtraClickTargets() {
    let extra = 0;
    if (S.ascendedClass === 'knight') {
        if (Math.random() < knightSweepChance())    extra += 1;
        if (Math.random() < knightWhirlwindChance()) extra += 2;
    }
    return extra;
}

// Boss instakill check (K9 Decapitation Chance)
export function rollsBossInstakill() {
    return S.ascendedClass === 'knight' && Math.random() < knightDecapitationChance();
}

// EXP needed to reach the next level
export function expForLevel(x) {
    return Math.floor(50 * (x**3 - 6*x**2 + 17*x - 12) / 3);
}

export function levelFromExp(e) {
    let lv = 1;
    while (lv < 10000 && e >= expForLevel(lv + 1)) lv++;
    return lv;
}
