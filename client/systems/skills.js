// ── Skill effect helpers ──────────────────────────────────────────
// Pure functions — read from state, return numeric modifiers.

import { S } from './state.js';
import { BASIC_COOLDOWN_MS, AUTO_COOLDOWN_BASE_MS, GFB_COOLDOWN_MS, HMM_COOLDOWN_MS } from '../data/constants.js';

export function skillPts(id)  { return (S.skillPoints[id]    || S.skillPoints[String(id)]   ) | 0; }
export function kPts(id)      { return (S.knightSkillPts[id] || S.knightSkillPts[String(id)]) | 0; }
export function sPts(id)      { return (S.sorcSkillPts[id]   || S.sorcSkillPts[String(id)]  ) | 0; }

// ── Potion multipliers ────────────────────────────────────────────

export function potionGoldMult() {
    const t = S.potionTimers, now = Date.now();
    if (now < (t.large_gold  || 0)) return 1.50;
    if (now < (t.medium_gold || 0)) return 1.25;
    if (now < (t.small_gold  || 0)) return 1.15;
    return 1.0;
}

export function potionExpMult() {
    const t = S.potionTimers, now = Date.now();
    if (now < (t.large_exp  || 0)) return 1.50;
    if (now < (t.medium_exp || 0)) return 1.25;
    if (now < (t.small_exp  || 0)) return 1.15;
    return 1.0;
}

export function potionCdrMult() {
    const t = S.potionTimers, now = Date.now();
    if (now < (t.large_cooldowns  || 0)) return 0.75;
    if (now < (t.medium_cooldowns || 0)) return 0.85;
    if (now < (t.small_cooldowns  || 0)) return 0.90;
    return 1.0;
}

export function potionMadnessActive() {
    return Date.now() < (S.potionTimers.potion_of_madness || 0);
}

export function potionDangerActive() {
    return Date.now() < (S.potionTimers.potion_of_danger || 0);
}

// ── General skill helpers ─────────────────────────────────────────

export function skillAutoDmgMult()        { return 1 + (skillPts(12) + skillPts(14)) * 0.10; }
export function skillMultiTargetChance()  { return skillPts(13) * 0.10; }
export function skillThirdTargetChance()  { return skillPts(14) * 0.10; }

export function skillGoldMult()           { return 1 + skillPts(21) * 0.05; }
export function skillExpMult()            { return 1 + skillPts(22) * 0.05; }
export function skillMatDropMult()        { return 1 + skillPts(23) * 0.03; }
export function skillMatQtyMult()         { return 1 + skillPts(23) * 0.02; }
export function skillBossSpawnMult()      { return 1 + skillPts(24) * 0.02; }
export function skillBossLootMult()       { return 1 + skillPts(24) * 0.03; }
export function skillExtraBossChance()    { return skillPts(24) * 0.01; }

export function skillFbDmgFrac()          { return (10 + skillPts(31) * 5) / 100; }   // 10%+5%/pt → 60% max
export function skillFbAnnihilateChance() { return skillPts(33) * 0.03; }              // 3%/pt → 30% max
export function skillEmberResetChance()   { return skillPts(34) * 0.02; }              // 2%/pt → 20% max
export function skillAutoFireball()       { return skillPts(31) >= 1; }

// ── Cooldown helpers ──────────────────────────────────────────────

export function effectiveBasicCooldown() {
    // K5 Combo Meter: 0.35s base, -0.015s/pt → 0.20s min
    const cd = Math.max(200, BASIC_COOLDOWN_MS - kPts(105) * 15);
    return cd * potionCdrMult();
}

export function effectiveAutoCooldown() {
    // A1: 0.70s base, -0.05s/pt → 0.20s min
    const cd = Math.max(200, AUTO_COOLDOWN_BASE_MS - skillPts(11) * 50);
    return cd * potionCdrMult();
}

export function effectiveGfbCooldown() {
    const cd = Math.max(8000, GFB_COOLDOWN_MS - skillPts(32) * 700);
    return cd * potionCdrMult();
}

export function effectiveHmmCooldown() {
    // S1 -0.5s/pt, S2 -0.5s/pt → min 2s
    const cd = Math.max(2000, HMM_COOLDOWN_MS - sPts(201) * 500 - sPts(202) * 500);
    return cd * potionCdrMult();
}

export function sorcSuddenDeathCooldownMs() {
    return Math.max(150000, 600000 - sPts(211) * 45000);
}

// ── Sorcerer helpers ──────────────────────────────────────────────

export function sorcHmmDmgFrac()           { return (30 + sPts(201) * 7) / 100; }   // 30+7/pt % → max 100%
export function sorcHmmExtraTargets()      { return Math.floor(sPts(202) * 0.5); }  // +0.5/pt → +5 at max
export function sorcTripleMissileChance()  { return sPts(203) * 0.02; }             // +2%/pt → 20% max
export function sorcUltExplosionChance()   { return Math.min(0.10, sPts(204) * 0.01); } // +1%/pt → 10% max
export function sorcGoldMult()             { return 1 + sPts(205) * 0.01; }
export function sorcMatMult()              { return 1 + sPts(206) * 0.01; }
export function sorcPotionDurMult()        { return 1 + sPts(207) * 0.02; }
export function sorcGrandAlchemistChance() { return sPts(208) * 0.01; }
export function sorcBossDmgMult()          { return 1 + sPts(209) * 0.02; }
export function sorcWeakeningMult()        { return 1 + S.arcaneWeakeningStacks * sPts(210) * 0.02; }
export function sorcEssenceGatheringMult() {
    return (S.ascendedClass === 'sorcerer' && sPts(212) >= 1 && Date.now() < S.essenceGatheringEnd) ? 2 : 1;
}
export function sorcEssenceDuration()      { return 30000 + sPts(212) * 3000; }

// ── Knight helpers ────────────────────────────────────────────────

export function knightClickDmgMult()   { return 1 + kPts(101) * 0.20; }             // K1 +20%/pt
export function knightMaxHpBonusFrac() { return kPts(102) * 0.01; }                 // K2 +1%/pt max HP
export function knightAoeFrac()        { return kPts(103) * 0.01; }                 // K3 +1%/pt AoE
export function knightDoubleStrikeChance() { return kPts(104) * 0.03; }             // K4 +3%/pt
export function knightSweepChance()    { return kPts(107) * 0.03; }                 // K7 +3%/pt +1 target
export function knightWhirlwindChance() { return kPts(108) * 0.02; }                // K8 +2%/pt +2 targets
export function knightDecapitationChance() { return kPts(109) * 0.005; }            // K9 +0.5%/pt instakill boss
export function knightEndlessChallengeChance() { return kPts(110) * 0.01; }         // K10 +1%/pt spawn uber
export function knightBattlefieldPurgeChance() { return kPts(111) * 0.05; }         // K11 +5%/pt kill all on boss kill
export function knightMomentumMult()   {                                              // K12 per-click permanent +
    return 1 + S.momentumClicks * kPts(112) * 0.000001;
}
export function knightAdrenalineChance() { return kPts(106) * 0.02; }               // K6 +2%/pt CD reset on kill

// ── Combined multipliers ──────────────────────────────────────────

export function totalGoldMult() {
    return potionGoldMult() * skillGoldMult() * sorcGoldMult();
}

export function totalExpMult() {
    return potionExpMult() * skillExpMult();
}

export function totalMatDropMult() {
    return skillMatDropMult() * sorcMatMult();
}

export function totalMatQtyMult() {
    return skillMatQtyMult() * sorcMatMult();
}

// Overall damage multiplier (boss context: pass isBoss=true)
export function totalDmgMult(isBoss = false) {
    let m = sorcEssenceGatheringMult() * knightMomentumMult();
    if (isBoss) m *= sorcBossDmgMult() * sorcWeakeningMult();
    return m;
}

export function getMaxMonsters(areaIndex) {
    const madnessBonus = potionMadnessActive() ? 10 : 0;
    return 10 + areaIndex + Math.floor(S.level / 50) + madnessBonus;
}

export function getBossSpawnChancePerKill() {
    let base = 0.02 * skillBossSpawnMult();
    if (potionDangerActive()) base += 0.10;
    return Math.min(base, 1.0);
}

export function getUberBossChancePerKill() {
    let base = 0.01;
    if (potionDangerActive()) base += 0.05;
    return Math.min(base, 1.0);
}
