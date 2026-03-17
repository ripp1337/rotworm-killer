// ── Game-wide constants ───────────────────────────────────────────

export const BASIC_COOLDOWN_MS          = 350;   // base manual click cooldown
export const AUTO_COOLDOWN_BASE_MS      = 700;   // A1 base auto-attack cooldown
export const GFB_COOLDOWN_MS            = 15000; // fireball base cooldown
export const HMM_COOLDOWN_MS            = 10000; // Heavy Magic Missile base cooldown
export const SUDDEN_DEATH_COOLDOWN_MS   = 600000;// 10 minutes

export const BOSS_KILLS      = 10;   // score awarded per boss kill
export const BOSS_SPAWN_CHANCE      = 0.02;  // 2% chance per kill to spawn a regular boss
export const UBER_BOSS_SPAWN_CHANCE = 0.01;  // 1% chance per kill to spawn an uber boss
export const BOSS_SIZE       = 64;   // half-width for hit/draw (128px sprite)
export const UBER_BOSS_EVERY = 10;   // uber boss every N boss kills (legacy fallback)
export const BOSS_SPAWN_FIRST_AT = 10; // guaranteed first boss after this many kills

export const ASCEND_LEVEL    = 30;
export const CRAFTING_UNLOCK_LEVEL = 20;

export const TILE = 32;

// Respec cost ladder (index = respec_count, capped at last entry)
export const RESPEC_COSTS = [1_000_000, 100_000_000, 10_000_000_000];
