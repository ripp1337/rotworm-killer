// ── Crafting recipes, loot table, item definitions ───────────────

export const CRAFTING_RECIPES = [
    // Small potions
    { id: 'small_gold',       name: 'Small Potion of Wealth',     icon: '💰', desc: '+15% gold gain for 2 min',
      levelReq: 20, goldCost: 1000,   durationMinutes: 2,
      ingredients: { blueEssence: 6, greenEssence: 1, redEssence: 0, yellowEssence: 0 } },
    { id: 'small_exp',        name: 'Small Potion of Wisdom',     icon: '📚', desc: '+15% EXP gain for 2 min',
      levelReq: 20, goldCost: 1000,   durationMinutes: 2,
      ingredients: { blueEssence: 5, greenEssence: 2, redEssence: 0, yellowEssence: 0 } },
    { id: 'small_cooldowns',  name: 'Small Potion of Swiftness',  icon: '⚡', desc: '-10% all cooldowns for 1.5 min',
      levelReq: 20, goldCost: 1000,   durationMinutes: 1.5,
      ingredients: { blueEssence: 4, greenEssence: 2, redEssence: 1, yellowEssence: 0 } },

    // Medium potions
    { id: 'medium_gold',      name: 'Medium Potion of Wealth',    icon: '💰', desc: '+25% gold gain for 4 min',
      levelReq: 40, goldCost: 10000,  durationMinutes: 4,
      ingredients: { blueEssence: 8, greenEssence: 4, redEssence: 2, yellowEssence: 0 } },
    { id: 'medium_exp',       name: 'Medium Potion of Wisdom',    icon: '📚', desc: '+25% EXP gain for 4 min',
      levelReq: 40, goldCost: 10000,  durationMinutes: 4,
      ingredients: { blueEssence: 6, greenEssence: 5, redEssence: 2, yellowEssence: 0 } },
    { id: 'medium_cooldowns', name: 'Medium Potion of Swiftness', icon: '⚡', desc: '-15% all cooldowns for 3 min',
      levelReq: 40, goldCost: 10000,  durationMinutes: 3,
      ingredients: { blueEssence: 4, greenEssence: 4, redEssence: 3, yellowEssence: 0 } },

    // Large potions
    { id: 'large_gold',       name: 'Large Potion of Wealth',     icon: '💰', desc: '+50% gold gain for 8 min',
      levelReq: 50, goldCost: 100000, durationMinutes: 8,
      ingredients: { blueEssence: 0, greenEssence: 6, redEssence: 4, yellowEssence: 1 } },
    { id: 'large_exp',        name: 'Large Potion of Wisdom',     icon: '📚', desc: '+50% EXP gain for 8 min',
      levelReq: 50, goldCost: 100000, durationMinutes: 8,
      ingredients: { blueEssence: 0, greenEssence: 5, redEssence: 5, yellowEssence: 1 } },
    { id: 'large_cooldowns',  name: 'Large Potion of Swiftness',  icon: '⚡', desc: '-25% all cooldowns for 6 min',
      levelReq: 50, goldCost: 100000, durationMinutes: 6,
      ingredients: { blueEssence: 0, greenEssence: 4, redEssence: 6, yellowEssence: 1 } },

    // Ascended-only
    { id: 'potion_of_danger',  name: 'Potion of Danger',  icon: '💀',
      desc: '+10% boss spawn chance, +5% uber boss chance for 5 min',
      levelReq: 60, goldCost: 500000, durationMinutes: 5,
      ingredients: { blueEssence: 0, greenEssence: 3, redEssence: 6, yellowEssence: 3 },
      ascendedOnly: true },
    { id: 'potion_of_madness', name: 'Potion of Madness', icon: '🌀',
      desc: '+10 max spawn count, ×10 spawn rate for 5 min',
      levelReq: 70, goldCost: 500000, durationMinutes: 5,
      ingredients: { blueEssence: 0, greenEssence: 10, redEssence: 4, yellowEssence: 6 },
      ascendedOnly: true },
];

// Potion tier groups — only one tier per type may be active at a time
export const POTION_TIERS = {
    gold:      ['small_gold',      'medium_gold',      'large_gold'],
    exp:       ['small_exp',       'medium_exp',       'large_exp'],
    cooldowns: ['small_cooldowns', 'medium_cooldowns', 'large_cooldowns'],
};

export function getPotionGroup(id) {
    for (const group of Object.values(POTION_TIERS)) {
        if (group.includes(id)) return group;
    }
    return [id];
}

// Loot table — one entry per area (same order as AREAS)
// dropChance = base chance per kill; weights = relative color probabilities
export const LOOT_TABLE = [
    { dropChance: 0.05, weights: { blue: 0.60, green: 0.30, red: 0.09, yellow: 0.01 } }, // Rookgaard
    { dropChance: 0.08, weights: { blue: 0.55, green: 0.32, red: 0.11, yellow: 0.02 } }, // Rotworm Cave
    { dropChance: 0.10, weights: { blue: 0.50, green: 0.33, red: 0.14, yellow: 0.03 } }, // Cyclopolis
    { dropChance: 0.14, weights: { blue: 0.45, green: 0.35, red: 0.16, yellow: 0.04 } }, // Hell Gate
    { dropChance: 0.18, weights: { blue: 0.42, green: 0.35, red: 0.18, yellow: 0.05 } }, // Dragon Lair
    { dropChance: 0.22, weights: { blue: 0.40, green: 0.35, red: 0.20, yellow: 0.05 } }, // Plains of Havoc
    { dropChance: 0.28, weights: { blue: 0.38, green: 0.35, red: 0.21, yellow: 0.06 } }, // Demona
    { dropChance: 0.34, weights: { blue: 0.35, green: 0.36, red: 0.23, yellow: 0.06 } }, // Goroma
    { dropChance: 0.38, weights: { blue: 0.35, green: 0.36, red: 0.23, yellow: 0.06 } }, // Formogar Mines
    { dropChance: 0.43, weights: { blue: 0.32, green: 0.37, red: 0.24, yellow: 0.07 } }, // Roshamuul
    { dropChance: 0.48, weights: { blue: 0.30, green: 0.38, red: 0.25, yellow: 0.07 } }, // The Void
];
