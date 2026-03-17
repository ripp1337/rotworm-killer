"""All environment variables and top-level constants in one place."""
import os


def _norm(value: str) -> str:
    return (value or '').strip().strip('"').strip("'")


PORT             = int(os.environ.get('PORT', 3000))
ADMIN_TOKEN      = _norm(os.environ.get('ADMIN_TOKEN', ''))
GAME_URL         = os.environ.get('GAME_URL', '')

# Turso — persistent remote SQLite
TURSO_URL        = os.environ.get('TURSO_URL', '')
TURSO_AUTH_TOKEN = _norm(os.environ.get('TURSO_AUTH_TOKEN', ''))
USE_TURSO        = bool(TURSO_URL and TURSO_AUTH_TOKEN)

# Email — Resend API (preferred on Railway)
RESEND_API_KEY   = _norm(os.environ.get('RESEND_API_KEY', ''))
RESEND_FROM      = os.environ.get('RESEND_FROM', '')
NOTIFY_EMAIL     = os.environ.get('NOTIFY_EMAIL', '')

# Email — SMTP fallback
SMTP_HOST        = os.environ.get('SMTP_HOST', '')
SMTP_PORT        = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER        = os.environ.get('SMTP_USER', '')
SMTP_PASS        = os.environ.get('SMTP_PASS', '')
SMTP_FROM        = os.environ.get('SMTP_FROM', '') or SMTP_USER

# Cache TTLs
SESSION_TTL_S    = 10 * 60        # 10 minutes
PLAYER_TTL_S     = 60 * 60        # 1 hour

# Password reset
RESET_TOKEN_EXPIRY_S = 3600       # 1 hour

# Chat
CHAT_HISTORY_MAX    = 100
CHAT_RATE_LIMIT_MS  = 2000

# Gold/EXP cap table (per area, per second, with all buffs active)
AREA_GOLD_CAP_PER_SEC: dict[str, float] = {
    'Rookgaard':      50,
    'Rotworm Cave':   300,
    'Cyclopolis':     1200,
    'Hell Gate':      1800,
    'Dragon Lair':    3200,
    'Plains of Havoc': 4500,
    'Demona':         15000,
    'Goroma':         30000,
    'Formogar Mines': 30000,
    'Roshamuul':      45000,
    'The Void':       75000,
}

AREA_EXP_CAP_PER_SEC: dict[str, float] = {
    'Rookgaard':      200,
    'Rotworm Cave':   1500,
    'Cyclopolis':     7000,
    'Hell Gate':      10000,
    'Dragon Lair':    27000,
    'Plains of Havoc': 35000,
    'Demona':         108000,
    'Goroma':         215000,
    'Formogar Mines': 323000,
    'Roshamuul':      485000,
    'The Void':       808000,
}

# Area game data mirrored here for server-side validation
AREA_ORDER = [
    'Rookgaard', 'Rotworm Cave', 'Cyclopolis', 'Hell Gate', 'Dragon Lair',
    'Plains of Havoc', 'Demona', 'Goroma', 'Formogar Mines', 'Roshamuul', 'The Void',
]

AREA_LEVEL_REQS: dict[str, int] = dict(zip(
    AREA_ORDER, [1, 8, 30, 50, 70, 100, 130, 175, 200, 250, 300]
))

AREA_GOLD_COSTS: dict[str, int] = dict(zip(
    AREA_ORDER, [0, 100, 5000, 50000, 100000, 200000, 1000000, 5000000, 10000000, 50000000, 100000000]
))

# Weapon data mirrored here for server-side validation (index → cost, minLevel)
WEAPONS: list[dict] = [
    {'name': 'Club',               'cost':           0, 'minLevel':   1},
    {'name': 'Rapier',             'cost':          50, 'minLevel':   2},
    {'name': 'Mace',               'cost':         200, 'minLevel':   4},
    {'name': 'Longsword',          'cost':         500, 'minLevel':   5},
    {'name': 'Clerical Mace',      'cost':        1000, 'minLevel':   7},
    {'name': 'Orcish Axe',         'cost':        2500, 'minLevel':  10},
    {'name': 'Dwarven Axe',        'cost':        5000, 'minLevel':  12},
    {'name': 'Fire Sword',         'cost':       10000, 'minLevel':  14},
    {'name': 'Skull Staff',        'cost':       20000, 'minLevel':  17},
    {'name': 'Fire Axe',           'cost':       50000, 'minLevel':  20},
    {'name': 'Giant Sword',        'cost':      100000, 'minLevel':  25},
    {'name': "Queen's Sceptre",    'cost':      150000, 'minLevel':  30},
    {'name': 'Stonecutter Axe',    'cost':      200000, 'minLevel':  35},
    {'name': 'Thunder Hammer',     'cost':      500000, 'minLevel':  40},
    {'name': 'Magic Longsword',    'cost':     1000000, 'minLevel':  50},
    {'name': 'War Axe',            'cost':     2500000, 'minLevel':  60},
    {'name': 'Bright Sword',       'cost':     5000000, 'minLevel':  70},
    {'name': 'Dragon Hammer',      'cost':    10000000, 'minLevel':  80},
    {'name': 'Warlord Sword',      'cost':    20000000, 'minLevel':  90},
    {'name': 'Great Axe',          'cost':    35000000, 'minLevel': 100},
    {'name': 'Arcane Staff',       'cost':    50000000, 'minLevel': 120},
    {'name': 'Silver Mace',        'cost':    75000000, 'minLevel': 130},
    {'name': 'Guardian Halberd',   'cost':   100000000, 'minLevel': 150},
    {'name': 'Twin Axe',           'cost':   150000000, 'minLevel': 175},
    {'name': 'Pharaoh Sword',      'cost':   200000000, 'minLevel': 200},
    {'name': 'War Hammer',         'cost':   300000000, 'minLevel': 220},
    {'name': 'Magic Sword',        'cost':   500000000, 'minLevel': 240},
    {'name': 'Hammer of Wrath',    'cost':   750000000, 'minLevel': 250},
    {'name': 'Enchanted Staff',    'cost':  1000000000, 'minLevel': 275},
    {'name': 'Ice Rapier',         'cost':  2500000000, 'minLevel': 300},
]

# Respec gold costs (index = respec_count, capped at index 2)
RESPEC_COSTS = [1_000_000, 100_000_000, 10_000_000_000]

# Skill max points per skill ID
SKILL_MAXES_GENERAL: dict[int, int] = {k: 10 for k in [11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34]}
SKILL_MAXES_KNIGHT:  dict[int, int] = {k: 10 for k in range(101, 113)}
SKILL_MAXES_SORC:    dict[int, int] = {k: 10 for k in range(201, 213)}

# Skill costs: each doubles from previous point, per-tier base costs
def _skill_costs(base: int) -> list[int]:
    return [base * (2 ** i) for i in range(10)]

SKILL_COSTS_GENERAL: dict[int, list[int]] = {
    11: _skill_costs(100),
    12: _skill_costs(1000),
    13: _skill_costs(100000),
    14: _skill_costs(1000000),
    21: _skill_costs(1000),
    22: _skill_costs(10000),
    23: _skill_costs(100000),
    24: _skill_costs(1000000),
    31: _skill_costs(1000),
    32: _skill_costs(10000),
    33: _skill_costs(100000),
    34: _skill_costs(1000000),
}

SKILL_COSTS_KNIGHT: dict[int, list[int]] = {
    101: _skill_costs(10000),
    102: _skill_costs(100000),
    103: _skill_costs(1000000),
    104: _skill_costs(10000000),
    105: _skill_costs(10000),
    106: _skill_costs(100000),
    107: _skill_costs(1000000),
    108: _skill_costs(10000000),
    109: _skill_costs(10000),
    110: _skill_costs(100000),
    111: _skill_costs(1000000),
    112: _skill_costs(10000000),
}

SKILL_COSTS_SORC: dict[int, list[int]] = {
    201: _skill_costs(10000),
    202: _skill_costs(100000),
    203: _skill_costs(1000000),
    204: _skill_costs(10000000),
    205: _skill_costs(10000),
    206: _skill_costs(100000),
    207: _skill_costs(1000000),
    208: _skill_costs(10000000),
    209: _skill_costs(10000),
    210: _skill_costs(100000),
    211: _skill_costs(1000000),
    212: _skill_costs(10000000),
}

# Skill prereqs (id → list of required ids, at least 1pt each)
SKILL_PREREQS_GENERAL: dict[int, list[int]] = {
    11: [], 12: [11], 13: [12], 14: [13],
    21: [], 22: [21], 23: [22], 24: [23],
    31: [], 32: [31], 33: [32], 34: [33],
}

SKILL_PREREQS_KNIGHT: dict[int, list[int]] = {
    101: [], 102: [101], 103: [102], 104: [103],
    105: [], 106: [105], 107: [106], 108: [107],
    109: [], 110: [109], 111: [110], 112: [111],
}

SKILL_PREREQS_SORC: dict[int, list[int]] = {
    201: [], 202: [201], 203: [202], 204: [203],
    205: [], 206: [205], 207: [206], 208: [207],
    209: [], 210: [209], 211: [210], 212: [211],
}

ASCEND_LEVEL = 30
