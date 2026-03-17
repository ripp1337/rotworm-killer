// ── Skill tree definitions ────────────────────────────────────────
// All buy logic is server-authoritative (see client/ui/skill_panel.js).
// These arrays are used for rendering only.

// costs[i] = gold cost to buy the (i+1)-th point
function _costs(base) {
    return Array.from({ length: 10 }, (_, i) => base * Math.pow(2, i));
}

// ── General skill tree (3×4, IDs 11–34) ─────────────────────────
export const GENERAL_SKILLS = [
    // Column A — Automation
    { id: 11, col: 1, row: 1, name: 'Auto-Attack',           max: 10, prereqs: [],   costs: _costs(100),
      desc: 'Unlocks auto-attack. Reduces auto-attack cooldown by 0.05s per point (0.70s → 0.20s at max)' },
    { id: 12, col: 1, row: 2, name: 'Auto-Attack Damage',    max: 10, prereqs: [11], costs: _costs(1000),
      desc: '+10% auto-attack damage per point (+100% at max). Requires 1pt Auto-Attack' },
    { id: 13, col: 1, row: 3, name: 'Multi-Target',          max: 10, prereqs: [12], costs: _costs(100000),
      desc: '+10% chance per point to hit a 2nd monster (100% at max). Requires 1pt Auto-Attack Damage' },
    { id: 14, col: 1, row: 4, name: 'Hyper Automation',      max: 10, prereqs: [13], costs: _costs(1000000),
      desc: '+10% auto-attack damage per point, +10% chance to hit a 3rd target. Requires 1pt Multi-Target' },
    // Column B — Gold / EXP / Drops / Boss
    { id: 21, col: 2, row: 1, name: 'Wealth Training',       max: 10, prereqs: [],   costs: _costs(1000),
      desc: '+5% gold gain per point (+50% at max)' },
    { id: 22, col: 2, row: 2, name: 'Exp. Mastery',          max: 10, prereqs: [21], costs: _costs(10000),
      desc: '+5% experience gain per point (+50% at max). Requires 1pt Wealth Training' },
    { id: 23, col: 2, row: 3, name: 'Material Harvesting',   max: 10, prereqs: [22], costs: _costs(100000),
      desc: '+3% essence drop chance, +2% drop quantity per point. Requires 1pt Exp. Mastery' },
    { id: 24, col: 2, row: 4, name: 'Boss Attraction',       max: 10, prereqs: [23], costs: _costs(1000000),
      desc: '+2% boss spawn rate, +3% boss loot, +1% extra boss chance per point. Requires 1pt Material Harvesting' },
    // Column C — Fireball
    { id: 31, col: 3, row: 1, name: 'Fireball Mastery',      max: 10, prereqs: [],   costs: _costs(1000),
      desc: 'Unlocks Fireball (auto-casts). Base 10% HP dmg +5%/pt (60% at max). 15s base cooldown' },
    { id: 32, col: 3, row: 2, name: 'Fireball CDR',          max: 10, prereqs: [31], costs: _costs(10000),
      desc: '-0.7s fireball cooldown per point (min 8s). Requires 1pt Fireball Mastery' },
    { id: 33, col: 3, row: 3, name: 'Fireball Annihilation', max: 10, prereqs: [32], costs: _costs(100000),
      desc: '+3% chance per fireball hit to instantly kill all non-boss monsters (30% at max). Requires 1pt Fireball CDR' },
    { id: 34, col: 3, row: 4, name: 'Ember of Renewal',      max: 10, prereqs: [33], costs: _costs(1000000),
      desc: '+2% chance per point for fireball to instantly reset its cooldown on kill (20% at max). Requires 1pt Fireball Annihilation' },
];

// ── Knight skill tree (3×4, IDs 101–112) ────────────────────────
export const KNIGHT_SKILLS = [
    // Column 1 — Click Damage
    { id: 101, col: 1, row: 1, name: 'Strike Training',        max: 10, prereqs: [],    costs: _costs(10000),
      desc: '+20% click damage per point (+200% at max)' },
    { id: 102, col: 1, row: 2, name: 'Precision Execution',    max: 10, prereqs: [101], costs: _costs(100000),
      desc: '+1%/pt of target max HP as bonus click damage (+10% at max). Requires 1pt Strike Training' },
    { id: 103, col: 1, row: 3, name: 'Cleaving Blows',         max: 10, prereqs: [102], costs: _costs(1000000),
      desc: 'Every click deals AoE +1%/pt max HP damage to all non-boss enemies. Requires 1pt Precision Execution' },
    { id: 104, col: 1, row: 4, name: 'Double Strike Instinct', max: 10, prereqs: [103], costs: _costs(10000000),
      desc: '+3%/pt chance to strike twice (30% at max). Requires 1pt Cleaving Blows' },
    // Column 2 — Speed / Multi-target
    { id: 105, col: 2, row: 1, name: 'Combo Meter',            max: 10, prereqs: [],    costs: _costs(10000),
      desc: 'Reduces manual click cooldown: 0.35s base, -0.015s/pt → 0.20s min' },
    { id: 106, col: 2, row: 2, name: 'Adrenaline Reset',       max: 10, prereqs: [105], costs: _costs(100000),
      desc: '+2%/pt chance to fully reset manual CD on any kill (20% at max). Requires 1pt Combo Meter' },
    { id: 107, col: 2, row: 3, name: 'Sweeping Strikes',       max: 10, prereqs: [106], costs: _costs(1000000),
      desc: '+3%/pt chance to also hit +1 extra monster per click (30% at max). Requires 1pt Adrenaline Reset' },
    { id: 108, col: 2, row: 4, name: 'Whirlwind Extension',    max: 10, prereqs: [107], costs: _costs(10000000),
      desc: '+2%/pt chance to hit +2 additional monsters (20% max, stacks with Sweeping Strikes). Requires 1pt Sweeping Strikes' },
    // Column 3 — Boss / Uber Boss
    { id: 109, col: 3, row: 1, name: 'Decapitation Chance',    max: 10, prereqs: [],    costs: _costs(10000),
      desc: '+0.5%/pt chance to instantly kill a boss or uber boss on click (5% at max)' },
    { id: 110, col: 3, row: 2, name: 'Endless Challenge',      max: 10, prereqs: [109], costs: _costs(100000),
      desc: '+1%/pt chance to instantly spawn the next uber boss after killing a boss. Requires 1pt Decapitation Chance' },
    { id: 111, col: 3, row: 3, name: 'Battlefield Purge',      max: 10, prereqs: [110], costs: _costs(1000000),
      desc: '+5%/pt chance to kill all non-boss enemies on boss kill (50% at max). Requires 1pt Endless Challenge' },
    { id: 112, col: 3, row: 4, name: 'Momentum Overdrive',     max: 10, prereqs: [111], costs: _costs(10000000),
      desc: 'Each manual click permanently increases damage multiplier by +0.0001%/pt per click. Requires 1pt Battlefield Purge' },
];

// ── Sorcerer skill tree (3×4, IDs 201–212) ──────────────────────
export const SORC_SKILLS = [
    // Column 1 — Magic Missile
    { id: 201, col: 1, row: 1, name: 'Light Magic Missile',    max: 10, prereqs: [],    costs: _costs(10000),
      desc: 'Unlocks Light Magic Missile: auto-fires dealing (30+7×pts)% of mob max HP (up to 100%). Base CD 10s, -0.5s/pt' },
    { id: 202, col: 1, row: 2, name: 'Heavy Magic Missile',    max: 10, prereqs: [201], costs: _costs(100000),
      desc: 'Upgrades to Heavy Magic Missile: -0.5s CD/pt and hits +0.5 extra worms/pt (up to +5 at max, min 2s CD). Requires 1pt Light Magic Missile' },
    { id: 203, col: 1, row: 3, name: 'Triple Missile Chance',  max: 10, prereqs: [202], costs: _costs(1000000),
      desc: '+2% chance per point to fire 2 extra missiles (20% at max). Requires 1pt Heavy Magic Missile' },
    { id: 204, col: 1, row: 4, name: 'Ultimate Explosion',     max: 10, prereqs: [203], costs: _costs(10000000),
      desc: 'Each HMM has +1%/pt chance to instantly kill all non-boss enemies (capped 10% at max). Requires 1pt Triple Missile Chance' },
    // Column 2 — Loot / Crafting / Potions
    { id: 205, col: 2, row: 1, name: 'Arcane Fortune',         max: 10, prereqs: [],    costs: _costs(10000),
      desc: '+1% gold gained per point (+10% at max)' },
    { id: 206, col: 2, row: 2, name: 'Mystic Salvaging',       max: 10, prereqs: [205], costs: _costs(100000),
      desc: '+1% material drop chance per point (+10% at max). Requires 1pt Arcane Fortune' },
    { id: 207, col: 2, row: 3, name: 'Arcane Extraction',      max: 10, prereqs: [206], costs: _costs(1000000),
      desc: '+2% potion duration per point (+20% at max). Requires 1pt Mystic Salvaging' },
    { id: 208, col: 2, row: 4, name: 'Grand Alchemist',        max: 10, prereqs: [207], costs: _costs(10000000),
      desc: '+1%/pt chance per boss kill to auto-activate a random potion (10% at max). Requires 1pt Arcane Extraction' },
    // Column 3 — Boss Killer
    { id: 209, col: 3, row: 1, name: 'Bane of Titans',         max: 10, prereqs: [],    costs: _costs(10000),
      desc: '+2% damage to bosses per point (+20% at max)' },
    { id: 210, col: 3, row: 2, name: 'Arcane Weakening',       max: 10, prereqs: [209], costs: _costs(100000),
      desc: 'Bosses hit by HMM take +2%/pt extra damage per stack (max 10 stacks). Requires 1pt Bane of Titans' },
    { id: 211, col: 3, row: 3, name: 'Sudden Death',           max: 10, prereqs: [210], costs: _costs(1000000),
      desc: 'Fires every max(150s, 600s−pts×45s), dealing 100% of boss max HP. Requires 1pt Arcane Weakening' },
    { id: 212, col: 3, row: 4, name: 'Essence Gathering',      max: 10, prereqs: [211], costs: _costs(10000000),
      desc: 'Boss kill grants double damage for 30s (+3s/pt, 60s at max). Requires 1pt Sudden Death' },
];
