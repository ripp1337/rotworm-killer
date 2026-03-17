// ── Spawner — worm and boss spawn logic ───────────────────────────

import { S } from './state.js';
import { AREAS, getAreaIndex } from '../data/areas.js';
import {
    BOSS_KILLS, BOSS_SPAWN_CHANCE, UBER_BOSS_SPAWN_CHANCE,
    BOSS_SIZE, TILE,
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
    const size = isBoss ? BOSS_SIZE : TILE;
    const x    = size + Math.random() * (CANVAS_W - size * 2);
    const y    = size + Math.random() * (CANVAS_H - size * 2);
    let hp;
    if (isUber)    hp = area.uberBossHp;
    else if (isBoss) hp = area.bossHp;
    else           hp = area.mobHp;
    return {
        id:    _nextId++,
        x, y,
        hp,
        maxHp: hp,
        size,
        isBoss,
        isUber,
        name:  isUber ? area.uberBossName : isBoss ? area.bossName : area.mobName,
        sprite: isUber ? (area.uberBossSprite ?? area.bossSprite) : isBoss ? area.bossSprite : area.mobSprite,
    };
}

// ── Spawn a regular worm ──────────────────────────────────────────

export function spawnWorm(area) {
    S.worms.push(makeWorm(area, false, false));
}

// ── Boss spawn checks ─────────────────────────────────────────────

export function checkSpawnBoss(area) {
    // Guaranteed first boss at kill threshold
    if (S.bossSpawnCounter >= BOSS_KILLS && S.bossKillCounter === 0 && !S.boss) {
        doSpawnBoss(area, false);
        return;
    }

    if (S.boss) return;  // already alive

    // Danger potion: +10% boss spawn chance, +5% uber chance
    const dangerBonus = potionDangerActive() ? 0.10 : 0;
    const uberBonus   = potionDangerActive() ? 0.05 : 0;

    // Check uber boss first (1% base)
    if (Math.random() < UBER_BOSS_SPAWN_CHANCE + uberBonus) {
        doSpawnBoss(area, true);
        return;
    }

    // Regular boss (2% base)
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
