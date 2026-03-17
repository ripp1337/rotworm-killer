// ── Skill panel — buy general, knight, and sorcerer skills ────────

import { S } from '../systems/state.js';
import { GENERAL_SKILLS, KNIGHT_SKILLS, SORC_SKILLS } from '../data/skills.js';
import { apiFetch } from '../persistence/save.js';
import { updateHUD } from './hud.js';

const TREE_MAP = {
    general: GENERAL_SKILLS,
    knight:  KNIGHT_SKILLS,
    sorc:    SORC_SKILLS,
};

// ── Buy a skill point ──────────────────────────────────────────────

export async function buySkill(id) {
    const res = await apiFetch('/api/buy/skill', { id });
    if (!res.ok) {
        alert(res.error ?? 'Failed to buy skill.');
        return;
    }

    // Server returns updated skill maps + gold
    S.skillPoints     = res.skill_pts    ?? S.skillPoints;
    S.knightSkillPts  = res.knight_pts   ?? S.knightSkillPts;
    S.sorcSkillPts    = res.sorc_pts     ?? S.sorcSkillPts;
    S.gold            = res.gold         ?? S.gold;

    renderSkillPanel();
    updateHUD();
}

// ── Render skill panel ─────────────────────────────────────────────

export function renderSkillPanel() {
    _renderTree('general', GENERAL_SKILLS, S.skillPoints,    'panelGeneral');
    if (S.ascendedClass === 'knight')   _renderTree('knight', KNIGHT_SKILLS, S.knightSkillPts, 'panelKnight');
    if (S.ascendedClass === 'sorcerer') _renderTree('sorc',   SORC_SKILLS,   S.sorcSkillPts,   'panelSorc');

    // Hide/show class panels
    const kPanel = document.getElementById('panelKnight');
    const sPanel = document.getElementById('panelSorc');
    if (kPanel) kPanel.style.display = S.ascendedClass === 'knight'   ? '' : 'none';
    if (sPanel) sPanel.style.display = S.ascendedClass === 'sorcerer' ? '' : 'none';
}

function _renderTree(type, skills, ptsMap, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (const sk of skills) {
        const pts    = ptsMap[sk.id] ?? 0;
        const maxed  = pts >= sk.maxPts;
        const prereqMet = !sk.prereq || (ptsMap[sk.prereq] ?? 0) > 0;

        const row = document.createElement('div');
        row.className = 'skill-row';

        const nameSpan = document.createElement('span');
        nameSpan.className   = 'skill-name';
        nameSpan.textContent = `${sk.name} (${pts}/${sk.maxPts})`;
        nameSpan.title       = sk.desc;

        const btn = document.createElement('button');
        btn.textContent = maxed ? 'MAX' : `Buy (${_fmt(sk.cost)}g)`;
        btn.disabled    = maxed || !prereqMet || S.gold < sk.cost;
        btn.addEventListener('click', () => buySkill(sk.id));

        row.appendChild(nameSpan);
        row.appendChild(btn);
        container.appendChild(row);
    }
}

function _fmt(n) {
    if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(n);
}
