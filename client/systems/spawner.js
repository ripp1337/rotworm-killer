// ── Spawner — worm and boss spawn logic ───────────────────────────

import { S } from './state.js';
import { AREAS, getAreaIndex } from '../data/areas.js';
import {
    BOSS_KILLS, BOSS_SPAWN_CHANCE, UBER_BOSS_SPAWN_CHANCE,
    BOSS_SIZE, MOB_SIZE, TILE,
} from '../data/constants.js';
import { potionMadnessActive, potionDangerActive } from './skills.js';

const CANVAS_W = 800;
const CANVAS_H = 500;

// ── Monster cap ───────────────────────────────────────────────────

export function getMaxMonsters() {
    const areaIdx = getAreaIndex(S.currentArea);
    const base    = 10 + areaIdx + Math.floor(S.level / 50);
    return base + (potionMadnessActive() ? 10 : 0);
}

// ── Worm factory ─────────────────────────────────────────────────

let _nextId = 1;

function makeWorm(area, isBoss, isUber) {
    const size = isBoss ? BOSS_SIZE : MOB_SIZE;
    const x    = Math.random() * (CANVAS_W - size);
    const y    = Math.random() * (CANVAS_H - size);
    let hp;
    if (isUber)      hp = area.uberBossHp ?? area.bossHp * 3;
    else if (isBoss) hp = area.bossHp;
    else             hp = area.mobHp;
    return {
        id:    _nextId++,
        x, y,
        hp,
        maxHp: hp,
        size,
        isBoss,
        isUber,
        name:   isUber ? (area.uberBossName ?? area.bossName) : isBoss ? area.bossName : area.mobName,
        sprite: isUber ? (area.uberBossSprite ?? area.bossSprite) : isBoss ? area.bossSprite : area.mobSprite,
    };
}

// ── Spawn a regular worm ──────────────────────────────────────────

export function spawnWorm(area) {
    S.worms.push(makeWorm(area, false, false));
}

// ── Boss spawn check (called after each monster kill) ─────────────
// Roll uber first (1% + danger bonus), then regular boss (2% + danger bonus).
// The guaranteed-first-boss threshold is kept as a safety catch.

export function checkSpawnBoss(area) {
    if (S.boss) return;  // boss already alive

    // Danger potion bonuses
    const dangerBonus = potionDangerActive() ? 0.10 : 0;
    const uberBonus   = potionDangerActive() ? 0.05 : 0;

    // Uber boss roll (1% base)
    if (Math.random() < UBER_BOSS_SPAWN_CHANCE + uberBonus) {
        doSpawnBoss(area, true);
        return;
    }

    // Regular boss roll (2% base)
    if (Math.random() < BOSS_SPAWN_CHANCE + dangerBonus) {
        doSpawnBoss(area, false);
    }
}

function doSpawnBoss(area, isUber) {
    S.boss = makeWorm(area, true, isUber);
}

// ── Fill worms up to current cap ─────────────────────────────────

export function fillToMaxMonsters(area) {
    const cap = getMaxMonsters();
    while (S.worms.length < cap) {
        spawnWorm(area);
    }
}
