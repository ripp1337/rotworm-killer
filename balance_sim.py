"""
balance_sim.py  —  Sorcerer vs Knight 1-hour balance comparison
================================================================
Simulates 1 hour of ACTIVE play and 1 hour of PASSIVE (AFK idle) play
for both classes with ALL skill trees maxed out, fighting in The Void
(last/hardest area: Void Emissary HP=30000, Boss=Devovorga).

Run:  python balance_sim.py
"""

import random
import math
from dataclasses import dataclass, field

# ─── Area data (The Void) ─────────────────────────────────────────────────────
MOB_HP_BASE       = 30_000   # Void Emissary
MOB_EXP_BASE      = 20_000
MOB_GOLD_MIN_BASE = 300
MOB_GOLD_MAX_BASE = 500
BOSS_HP_BASE      = 1_000    # game constant BOSS_HP

# After ascension mobs/boss get +20%
ASCENSION_MULT = 1.2
MOB_HP       = int(MOB_HP_BASE       * ASCENSION_MULT)   # 36,000
MOB_EXP      = int(MOB_EXP_BASE      * ASCENSION_MULT)   # 24,000
MOB_GOLD_MIN = MOB_GOLD_MIN_BASE
MOB_GOLD_MAX = int(MOB_GOLD_MAX_BASE * ASCENSION_MULT)   # 600
BOSS_HP      = int(BOSS_HP_BASE      * ASCENSION_MULT)   # 1,200  (regular boss)
# Uber boss = BOSS_HP * 2 = 2,400

BOSS_EXP        = 600
BOSS_GOLD       = 1_000
BOSS_EVERY      = 50     # boss spawns every N worm kills
UBER_BOSS_EVERY = 10     # uber spawns every N boss kills

# Best weapon: Magic Longsword 70-100
WEAPON_MIN = 70
WEAPON_MAX = 100

# Spawn: 2% chance per 16ms frame, max 10 worms
FRAME_MS   = 16
SPAWN_PROB = 0.02
MAX_WORMS  = 10

SIM_DURATION_MS = 3_600_000  # 1 hour

# ─── General skill helpers (ALL MAXED, pts=10) ────────────────────────────────
def g_auto_cd():
    """A1 max: max(100, 500 - 10*40) = 100 ms"""
    return 100

def g_auto_dmg_mult():
    """A2+A4 each 10pts × +10%/pt => 1 + 20*0.10 = 3.0"""
    return 3.0

def g_multi_target_chance():
    """A3 10pts × 10%/pt = 1.00 (always hit 2nd target)"""
    return 1.0

def g_third_target_chance():
    """A4 10pts × 10%/pt = 1.00 (always hit 3rd target)"""
    return 1.0

def g_gold_mult():         return 1.50   # B1: +5%/pt * 10 = +50%
def g_exp_mult():          return 1.50   # B2: +5%/pt * 10 = +50%
def g_boss_spawn_mult():   return 1.20   # B4: +2%/pt * 10 = +20%
def g_boss_loot_mult():    return 1.30   # B4: +3%/pt * 10 = +30% boss loot

def g_fb_dmg_frac():       return 0.60  # C1: 10% + 10*5% = 60% mob HP
def g_fb_cd():             return 10_000  # C2 max: max(10000, 20000-10*1000) = 10 000 ms

def g_fb_annihilate():     return 0.30  # C3: 10pts * 3% = 30%
def g_ember_reset():       return 0.20  # C4: 10pts * 2% = 20%

def g_boss_interval():
    return max(5, math.floor(BOSS_EVERY / g_boss_spawn_mult()))  # floor(50/1.2) = 41

# ─── Knight skill helpers (ALL MAXED) ─────────────────────────────────────────
def k_click_cd():           return 100   # K5: max(100, 500-10*40) = 100 ms
def k_click_dmg_mult():     return 3.0   # K1: 1 + 10*0.20 = 3.0
def k_hp_bonus_frac():      return 0.10  # K2: 10pts * 1%/pt
def k_cleave_frac():        return 0.10  # K3: 10pts * 1%/pt AoE
def k_double_strike():      return 0.30  # K4: 10pts * 3%/pt
def k_adrenaline_reset():   return 0.20  # K6: 10pts * 2%/pt
def k_sweep():              return 0.30  # K7: 10pts * 3%/pt +1 target
def k_whirlwind():          return 0.20  # K8: 10pts * 2%/pt +2 targets
def k_decap():              return 0.05  # K9: 10pts * 0.5%/pt = 5%
def k_endless_challenge():  return 0.10  # K10: 10pts * 1%/pt = 10%
def k_battlefield_purge():  return 0.50  # K11: 10pts * 5%/pt = 50%
# K12: 0.00001 * total_clicks per point, 10pts => 0.0001% per click bonus (dynamic)

# ─── Sorcerer skill helpers (ALL MAXED) ───────────────────────────────────────
def s_hmm_dmg_frac():       return 0.60  # S1: (10+10*5)% = 60%
def s_hmm_dmg_mult():       return 1.40  # S2: 1 + 10*0.04 = 1.40
def s_triple_chance():      return 0.50  # S3: 10pts * 5%/pt
def s_ult_explode():        return 0.15  # S4: 10pts * 1.5%/pt = 15%
def s_gold_mult():          return 1.10  # S5: 1 + 10*0.01
def s_boss_dmg_mult():      return 1.20  # S9: 1 + 10*0.02 = 1.20

def s_weakening_mult(stacks):
    """S10: +2% per stack per point = +2%*10pts per stack"""
    return 1 + stacks * 10 * 0.02  # each stack = +20% dmg at max

def s_sd_cd():
    """S11 max: max(150000, 600000 - 10*45000) = max(150000, 150000) = 150s"""
    return 150_000

def s_eg_duration():        return 60_000  # S12: 30000 + 10*3000 = 60 s


# ─── Simulation state ─────────────────────────────────────────────────────────
@dataclass
class Sim:
    now: int = 0
    worms: list = field(default_factory=list)
    boss_hp: int = 0
    boss_max_hp: int = 0
    boss_is_uber: bool = False
    boss_alive: bool = False
    worm_kill_ctr: int = 0
    boss_kill_ctr: int = 0
    worm_kills: int = 0
    boss_kills: int = 0
    uber_kills: int = 0
    gold: int = 0
    exp: int = 0
    total_clicks: int = 0   # K12 tracking
    last_auto: int    = -999_999
    last_click: int   = -999_999
    last_hmm: int     = -999_999
    last_sd: int      = -999_999
    last_fb: int      = -999_999
    last_anni: int    = -999_999
    eg_end: int       = 0       # S12 Essence Gathering buff
    arcane_stacks: int = 0      # S10
    dmg_auto: int   = 0
    dmg_click: int  = 0
    dmg_hmm: int    = 0
    dmg_sd: int     = 0
    dmg_fb: int     = 0
    dmg_anni: int   = 0

    def eg_mult(self):
        return 2.0 if self.now < self.eg_end else 1.0

    def spawn_worm(self):
        if len(self.worms) < MAX_WORMS and not self.boss_alive:
            self.worms.append(MOB_HP)

    def spawn_boss(self):
        if self.boss_alive:
            return
        u = (self.boss_kill_ctr > 0 and self.boss_kill_ctr % UBER_BOSS_EVERY == 0)
        hp = BOSS_HP * (2 if u else 1)
        self.boss_hp = self.boss_max_hp = hp
        self.boss_is_uber = u
        self.boss_alive   = True
        self.arcane_stacks = 0

    def kill_worm(self):
        self.worm_kills += 1
        self.worm_kill_ctr += 1
        self.exp  += math.floor(MOB_EXP  * g_exp_mult())
        gold_roll  = MOB_GOLD_MIN + random.randint(0, MOB_GOLD_MAX - MOB_GOLD_MIN)
        self.gold += math.floor(gold_roll * g_gold_mult())
        if not self.boss_alive and self.worm_kill_ctr >= g_boss_interval():
            self.worm_kill_ctr = 0
            self.spawn_boss()

    def kill_boss(self, cls: str):
        if not self.boss_alive:
            return
        mult   = 2 if self.boss_is_uber else 1
        eg_m   = self.eg_mult()
        self.exp  += math.floor(BOSS_EXP  * g_exp_mult() * mult)
        self.gold += math.floor(BOSS_GOLD * g_gold_mult()
                                * (s_gold_mult() if cls == 'sorcerer' else 1.0)
                                * g_boss_loot_mult() * mult)
        if self.boss_is_uber:
            self.uber_kills += 1
        else:
            self.boss_kills += 1
        was_uber     = self.boss_is_uber
        self.boss_alive = False
        self.arcane_stacks = 0
        self.boss_kill_ctr += 1
        # S12 Essence Gathering buff
        if cls == 'sorcerer':
            self.eg_end = self.now + s_eg_duration()
        # K11 Battlefield Purge
        if cls == 'knight' and self.worms:
            if random.random() < k_battlefield_purge():
                n = len(self.worms)
                self.worms = []
                for _ in range(n):
                    self.kill_worm()
        # K10 Endless Challenge
        if cls == 'knight' and random.random() < k_endless_challenge():
            self.spawn_boss()


def roll_basic(eg=1.0):
    return math.ceil((WEAPON_MIN + random.randint(0, WEAPON_MAX - WEAPON_MIN)) * eg)

def roll_auto(eg=1.0):
    return math.ceil(roll_basic(eg) * g_auto_dmg_mult())


# ─── KNIGHT ───────────────────────────────────────────────────────────────────
def sim_knight(active: bool, runs: int = 5):
    results = []
    for _ in range(runs):
        s = Sim()
        s.last_auto  = -g_auto_cd()
        s.last_click = -k_click_cd()
        s.last_fb    = -g_fb_cd()
        s.last_anni  = -3 * 60_000
        t = 0
        while t < SIM_DURATION_MS:
            t += FRAME_MS
            s.now = t

            if random.random() < SPAWN_PROB:
                s.spawn_worm()

            # Manual click (active only)
            if active and (t - s.last_click) >= k_click_cd():
                s.last_click = t
                s.total_clicks += 1
                k12 = 1 + 10 * 0.000001 * s.total_clicks  # K12 at max

                if s.boss_alive:
                    if random.random() < k_decap():
                        s.dmg_click += s.boss_hp
                        s.kill_boss('knight')
                    else:
                        d = math.ceil(roll_basic() * k_click_dmg_mult() * k12
                                      + s.boss_max_hp * k_hp_bonus_frac())
                        s.boss_hp -= d;  s.dmg_click += d
                        if random.random() < k_double_strike():
                            d2 = math.ceil(roll_basic() * k_click_dmg_mult() * k12
                                           + s.boss_max_hp * k_hp_bonus_frac())
                            if s.boss_alive:
                                s.boss_hp -= d2;  s.dmg_click += d2
                        if s.boss_alive and s.boss_hp <= 0:
                            s.kill_boss('knight')
                elif s.worms:
                    d_base = math.ceil(roll_basic() * k_click_dmg_mult() * k12
                                       + MOB_HP * k_hp_bonus_frac())
                    cleave = math.ceil(MOB_HP * k_cleave_frac())
                    # primary hit
                    s.worms[0] -= d_base;  s.dmg_click += d_base
                    # cleave to all
                    for i in range(len(s.worms)):
                        s.worms[i] -= cleave;  s.dmg_click += cleave
                    # double strike on primary
                    if random.random() < k_double_strike() and s.worms:
                        s.worms[0] -= d_base;  s.dmg_click += d_base
                    # K7 sweep (+1 extra)
                    if len(s.worms) > 1 and random.random() < k_sweep():
                        s.worms[1] -= d_base;  s.dmg_click += d_base
                    # K8 whirlwind (+2 extras)
                    if len(s.worms) > 2 and random.random() < k_whirlwind():
                        for ei in [1, 2]:
                            if ei < len(s.worms):
                                s.worms[ei] -= d_base;  s.dmg_click += d_base
                    dead = [w for w in s.worms if w <= 0]
                    s.worms = [w for w in s.worms if w > 0]
                    for _ in dead:
                        s.kill_worm()
                        if random.random() < k_adrenaline_reset():
                            s.last_click = t - k_click_cd()

            # Auto-attack
            if (t - s.last_auto) >= g_auto_cd():
                s.last_auto = t
                if s.boss_alive:
                    d = roll_auto()
                    s.boss_hp -= d;  s.dmg_auto += d
                    if s.boss_hp <= 0:
                        s.kill_boss('knight')
                elif s.worms:
                    hits = [0]
                    if len(s.worms) > 1 and random.random() < g_multi_target_chance():
                        hits.append(1)
                    if len(s.worms) > 2 and random.random() < g_third_target_chance():
                        hits.append(2)
                    for i in hits:
                        if i < len(s.worms):
                            d = roll_auto()
                            s.worms[i] -= d;  s.dmg_auto += d
                    dead = [w for w in s.worms if w <= 0]
                    s.worms = [w for w in s.worms if w > 0]
                    for _ in dead:
                        s.kill_worm()
                        if random.random() < k_adrenaline_reset():
                            s.last_click = t - k_click_cd()

            # Fireball
            if (t - s.last_fb) >= g_fb_cd():
                s.last_fb = t
                if s.worms:
                    if random.random() < g_fb_annihilate():
                        n = len(s.worms)
                        s.dmg_fb += n * MOB_HP;  s.worms = []
                        for _ in range(n):
                            s.kill_worm()
                        if random.random() < g_ember_reset():
                            s.last_fb = t - g_fb_cd()
                    else:
                        fb_d = math.ceil(MOB_HP * g_fb_dmg_frac())
                        alive, dead = [], 0
                        for hp in s.worms:
                            hp -= fb_d;  s.dmg_fb += fb_d
                            if hp <= 0: dead += 1
                            else:       alive.append(hp)
                        s.worms = alive
                        for _ in range(dead): s.kill_worm()
                        if dead and random.random() < g_ember_reset():
                            s.last_fb = t - g_fb_cd()

            # Annihilation (kills non-uber boss, 3-min CD)
            if s.boss_alive and not s.boss_is_uber and (t - s.last_anni) >= 3*60_000:
                s.last_anni = t
                s.dmg_anni += s.boss_hp
                s.kill_boss('knight')

        results.append(s)
    return results


# ─── SORCERER ─────────────────────────────────────────────────────────────────
def sim_sorcerer(active: bool, runs: int = 5):
    results = []
    for _ in range(runs):
        s = Sim()
        s.last_auto  = -g_auto_cd()
        s.last_click = -500
        s.last_hmm   = -20_000
        s.last_sd    = -s_sd_cd()
        s.last_fb    = -g_fb_cd()
        t = 0
        while t < SIM_DURATION_MS:
            t += FRAME_MS
            s.now = t
            eg = s.eg_mult()

            if random.random() < SPAWN_PROB:
                s.spawn_worm()

            # Manual click (active, base 500ms CD — no K5 for sorc)
            if active and (t - s.last_click) >= 500:
                s.last_click = t
                if s.boss_alive:
                    d = math.ceil(roll_basic(eg) * s_boss_dmg_mult()
                                  * s_weakening_mult(s.arcane_stacks))
                    s.boss_hp -= d;  s.dmg_click += d
                    if s.boss_hp <= 0:
                        s.kill_boss('sorcerer')
                elif s.worms:
                    d = roll_basic(eg)
                    s.worms[0] -= d;  s.dmg_click += d
                    if s.worms[0] <= 0:
                        s.worms.pop(0);  s.kill_worm()

            # Auto-attack
            if (t - s.last_auto) >= g_auto_cd():
                s.last_auto = t
                if s.boss_alive:
                    d = math.ceil(roll_auto(eg) * s_boss_dmg_mult()
                                  * s_weakening_mult(s.arcane_stacks))
                    s.boss_hp -= d;  s.dmg_auto += d
                    if s.boss_hp <= 0:
                        s.kill_boss('sorcerer')
                elif s.worms:
                    hits = [0]
                    if len(s.worms) > 1 and random.random() < g_multi_target_chance():
                        hits.append(1)
                    if len(s.worms) > 2 and random.random() < g_third_target_chance():
                        hits.append(2)
                    for i in hits:
                        if i < len(s.worms):
                            d = roll_auto(eg)
                            s.worms[i] -= d;  s.dmg_auto += d
                    dead = [w for w in s.worms if w <= 0]
                    s.worms = [w for w in s.worms if w > 0]
                    for _ in dead: s.kill_worm()

            # Heavy Magic Missile (20s CD)
            if (t - s.last_hmm) >= 20_000:
                s.last_hmm = t
                missiles = 1
                if random.random() < s_triple_chance():
                    missiles = 3  # fires 2 extra
                for _ in range(missiles):
                    if s.boss_alive:
                        base = s.boss_max_hp
                        d = math.ceil(base * s_hmm_dmg_frac() * s_hmm_dmg_mult() * eg
                                      * s_boss_dmg_mult() * s_weakening_mult(s.arcane_stacks))
                        s.arcane_stacks = min(10, s.arcane_stacks + 1)
                        s.boss_hp -= d;  s.dmg_hmm += d
                        if s.boss_hp <= 0:
                            s.kill_boss('sorcerer');  break
                    elif s.worms:
                        d = math.ceil(MOB_HP * s_hmm_dmg_frac() * s_hmm_dmg_mult() * eg)
                        s.worms[0] -= d;  s.dmg_hmm += d
                        # S4 Ultimate Explosion
                        if s.worms and random.random() < s_ult_explode():
                            n = len(s.worms)
                            s.dmg_hmm += sum(max(0, w) for w in s.worms)
                            s.worms = []
                            for _ in range(n): s.kill_worm()
                        elif s.worms and s.worms[0] <= 0:
                            s.worms.pop(0);  s.kill_worm()

            # Fireball
            if (t - s.last_fb) >= g_fb_cd():
                s.last_fb = t
                if s.worms:
                    if random.random() < g_fb_annihilate():
                        n = len(s.worms)
                        s.dmg_fb += n * MOB_HP;  s.worms = []
                        for _ in range(n): s.kill_worm()
                        if random.random() < g_ember_reset():
                            s.last_fb = t - g_fb_cd()
                    else:
                        fb_d = math.ceil(MOB_HP * g_fb_dmg_frac() * eg)
                        alive, dead = [], 0
                        for hp in s.worms:
                            hp -= fb_d;  s.dmg_fb += fb_d
                            if hp <= 0: dead += 1
                            else:       alive.append(hp)
                        s.worms = alive
                        for _ in range(dead): s.kill_worm()
                        if dead and random.random() < g_ember_reset():
                            s.last_fb = t - g_fb_cd()

            # Sudden Death (S11: 100% boss HP, CD=150s at max)
            if s.boss_alive and (t - s.last_sd) >= s_sd_cd():
                s.last_sd = t
                d = math.ceil(s.boss_max_hp * 1.0 * s_boss_dmg_mult()
                              * s_weakening_mult(s.arcane_stacks) * eg)
                s.boss_hp -= d;  s.dmg_sd += d
                if s.boss_hp <= 0:
                    s.kill_boss('sorcerer')

        results.append(s)
    return results


# ─── REPORT ───────────────────────────────────────────────────────────────────
def avg(results, attr):
    return sum(getattr(r, attr) for r in results) / len(results)

def report(label, results):
    wk  = avg(results, 'worm_kills')
    bk  = avg(results, 'boss_kills')
    ubk = avg(results, 'uber_kills')
    g   = avg(results, 'gold')
    e   = avg(results, 'exp')
    da  = avg(results, 'dmg_auto')
    dc  = avg(results, 'dmg_click')
    dh  = avg(results, 'dmg_hmm')
    ds  = avg(results, 'dmg_sd')
    df  = avg(results, 'dmg_fb')
    dan = avg(results, 'dmg_anni')
    tot = da + dc + dh + ds + df + dan

    print(f"\n{'='*62}")
    print(f"  {label}")
    print(f"{'='*62}")
    print(f"  Worm kills:           {wk:>14,.0f}")
    print(f"  Boss kills:           {bk:>14,.0f}")
    print(f"  Uber boss kills:      {ubk:>14,.0f}")
    print(f"  Total EXP:            {e:>14,.0f}")
    print(f"  Total Gold:           {g:>14,.0f}")
    if tot:
        print(f"  --- Damage sources ---")
        for name, val in [('Auto-attack', da), ('Manual click', dc),
                          ('HMM', dh), ('Sudden Death', ds),
                          ('Fireball', df), ('Annihilation', dan)]:
            if val:
                print(f"  {name:<22} {val:>14,.0f}  ({val/tot*100:5.1f}%)")
        print(f"  {'TOTAL':<22} {tot:>14,.0f}")


def compare_row(label, ra, la, rb, lb, metric):
    va = avg(ra, metric)
    vb = avg(rb, metric)
    if max(va, vb) == 0:
        return
    bigger, smaller = (la, lb) if va >= vb else (lb, la)
    pct = abs(va / vb - 1) * 100 if vb else 0
    print(f"  {metric:<22}: {la}={va:>12,.0f}   {lb}={vb:>12,.0f}   "
          f"=> {bigger} +{pct:.1f}%")


if __name__ == '__main__':
    random.seed(42)
    RUNS = 5

    print(f"\n{'#'*62}")
    print(f"  BALANCE SIM: Sorcerer vs Knight  |  The Void  |  1 hour")
    print(f"  All skills maxed  |  {RUNS} simulation runs averaged")
    print(f"{'#'*62}")
    print(f"\n  === Skill constants at max ===")
    print(f"  Auto CD:              {g_auto_cd()} ms        (A1)")
    print(f"  Auto dmg mult:        {g_auto_dmg_mult():.1f}x         (A2+A4)")
    print(f"  Multi-target:         2nd={g_multi_target_chance()*100:.0f}%  3rd={g_third_target_chance()*100:.0f}%")
    print(f"  Boss interval:        every {g_boss_interval()} kills  (B4 boost)")
    print(f"  Fireball:             {g_fb_dmg_frac()*100:.0f}% mob HP, CD {g_fb_cd()//1000}s")
    print(f"  FB Annihilate:        {g_fb_annihilate()*100:.0f}% instant kill  (C3)")
    print(f"  Ember reset:          {g_ember_reset()*100:.0f}% CD reset      (C4)")
    print(f"  [Knight]  Click CD:   {k_click_cd()} ms, {k_click_dmg_mult():.1f}x mult, decap {k_decap()*100:.1f}%")
    print(f"  [Sorc]    HMM:        {s_hmm_dmg_frac()*100:.0f}% HP × {s_hmm_dmg_mult():.2f}, triple {s_triple_chance()*100:.0f}%, CD 20s")
    print(f"  [Sorc]    SD:         100% boss HP every {s_sd_cd()//1000}s")
    print(f"  [Sorc]    EG buff:    2× dmg for {s_eg_duration()//1000}s after boss kill")
    print(f"  Mob HP: {MOB_HP:,}   |   Boss HP: {BOSS_HP:,} / {BOSS_HP*2:,} (uber)")

    print(f"\nRunning simulations...")
    res_ka = sim_knight(active=True,  runs=RUNS)
    res_kp = sim_knight(active=False, runs=RUNS)
    res_sa = sim_sorcerer(active=True,  runs=RUNS)
    res_sp = sim_sorcerer(active=False, runs=RUNS)

    report("KNIGHT   — 1 HOUR ACTIVE",  res_ka)
    report("KNIGHT   — 1 HOUR PASSIVE", res_kp)
    report("SORCERER — 1 HOUR ACTIVE",  res_sa)
    report("SORCERER — 1 HOUR PASSIVE", res_sp)

    print(f"\n{'='*62}")
    print(f"  COMPARISON SUMMARY")
    print(f"{'='*62}")

    print(f"\n  ACTIVE — Knight vs Sorcerer:")
    for m in ('worm_kills','boss_kills','uber_kills','gold','exp'):
        compare_row('',res_ka,'Knight',res_sa,'Sorc',m)

    print(f"\n  PASSIVE — Knight vs Sorcerer:")
    for m in ('worm_kills','boss_kills','uber_kills','gold','exp'):
        compare_row('',res_kp,'Knight',res_sp,'Sorc',m)

    print(f"\n  Knight — ACTIVE vs PASSIVE:")
    for m in ('worm_kills','boss_kills','gold','exp'):
        compare_row('',res_ka,'Active',res_kp,'Passive',m)

    print(f"\n  Sorcerer — ACTIVE vs PASSIVE:")
    for m in ('worm_kills','boss_kills','gold','exp'):
        compare_row('',res_sa,'Active',res_sp,'Passive',m)
    print()
