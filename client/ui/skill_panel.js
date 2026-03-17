// ── Skill panel — buy general, knight, and sorcerer skills ────────

import { S } from '../systems/state.js';
import { GENERAL_SKILLS, KNIGHT_SKILLS, SORC_SKILLS } from '../data/skills.js';
import { apiFetch } from '../persistence/save.js';
import { updateHUD } from './hud.js';

// ── Buy a skill point ──────────────────────────────────────────────

export async function buySkill(id) {
    const res = await apiFetch('/api/buy/skill', { id });
    if (!res.ok) {
        _showToast(res.error ?? 'Failed to buy skill.');
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

    // Show/hide class-specific tabs
    const kTab = document.getElementById('skillTabKnight');
    const sTab = document.getElementById('skillTabSorc');
    if (kTab) kTab.style.display = S.ascendedClass === 'knight'   ? '' : 'none';
    if (sTab) sTab.style.display = S.ascendedClass === 'sorcerer' ? '' : 'none';
}

// ── Render one skill tree as a 3-column grid ───────────────────────

function _renderTree(type, skills, ptsMap, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Group skills by column, sort each column by row
    const cols = {};
    for (const sk of skills) {
        if (!cols[sk.col]) cols[sk.col] = [];
        cols[sk.col].push(sk);
    }
    for (const c of Object.values(cols)) c.sort((a, b) => a.row - b.row);

    const grid = document.createElement('div');
    grid.className = 'st-grid';

    for (const colKey of Object.keys(cols).sort()) {
        const colEl   = document.createElement('div');
        colEl.className = 'st-col';
        const entries = cols[colKey];

        for (let i = 0; i < entries.length; i++) {
            const sk   = entries[i];
            const pts  = ptsMap[sk.id] ?? 0;
            const maxed      = pts >= sk.max;
            const prereqMet  = sk.prereqs.length === 0 || sk.prereqs.every(pid => (ptsMap[pid] ?? 0) > 0);
            const canAfford  = S.gold >= (sk.costs[pts] ?? Infinity);

            // Node state class
            let nodeClass = 'st-node';
            if (maxed)           nodeClass += ' st-node-maxed';
            else if (!prereqMet) nodeClass += ' st-node-locked';
            else if (!canAfford) nodeClass += ' st-node-unaffordable';
            else                 nodeClass += ' st-node-available';

            const node = document.createElement('div');
            node.className = nodeClass;

            // Header: name + pts counter
            const header = document.createElement('div');
            header.className = 'st-node-header';
            const nameSpan = document.createElement('span');
            nameSpan.className   = 'st-node-name';
            nameSpan.textContent = sk.name;
            const ptsSpan = document.createElement('span');
            ptsSpan.className   = maxed ? 'st-node-pts st-pts-maxed' : 'st-node-pts';
            ptsSpan.textContent = `${pts}/${sk.max}`;
            header.appendChild(nameSpan);
            header.appendChild(ptsSpan);
            node.appendChild(header);

            // Description
            const desc = document.createElement('p');
            desc.className   = 'st-node-desc';
            desc.textContent = sk.desc;
            node.appendChild(desc);

            // Prerequisite badges
            if (sk.prereqs.length > 0) {
                const reqs = document.createElement('div');
                reqs.className = 'st-node-reqs';
                for (const pid of sk.prereqs) {
                    const prereqSk = skills.find(s => s.id === pid);
                    if (!prereqSk) continue;
                    const has     = (ptsMap[pid] ?? 0) > 0;
                    const reqSpan = document.createElement('span');
                    reqSpan.className   = 'st-req ' + (has ? 'st-req-met' : 'st-req-fail');
                    reqSpan.textContent = '▲ ' + prereqSk.name;
                    reqs.appendChild(reqSpan);
                }
                node.appendChild(reqs);
            }

            if (maxed) {
                const maxLabel = document.createElement('div');
                maxLabel.className   = 'st-node-maxed-label';
                maxLabel.textContent = 'MAXED';
                node.appendChild(maxLabel);
            } else {
                const btn = document.createElement('button');
                btn.className   = 'st-buy-btn';
                btn.textContent = `Buy (${_fmt(sk.costs[pts] ?? 0)}g)`;
                btn.disabled    = !prereqMet || !canAfford;
                btn.addEventListener('click', () => buySkill(sk.id));
                node.appendChild(btn);
            }

            colEl.appendChild(node);

            // Connector arrow between tiers
            if (i < entries.length - 1) {
                const nextSk      = entries[i + 1];
                const nextUnlocked = nextSk.prereqs.every(pid => (ptsMap[pid] ?? 0) > 0);
                const conn = document.createElement('div');
                conn.className = 'st-connector';
                const arrow = document.createElement('span');
                arrow.className   = nextUnlocked ? 'st-conn-open' : 'st-conn-locked';
                arrow.textContent = '▼';
                conn.appendChild(arrow);
                colEl.appendChild(conn);
            }
        }

        grid.appendChild(colEl);
    }

    container.appendChild(grid);
}

function _fmt(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(n);
}

function _showToast(msg) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        toast.style.cssText =
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
            'background:#1a1006;border:1px solid #aa3300;color:#cc6030;' +
            'padding:8px 18px;font-family:Verdana,sans-serif;font-size:11px;' +
            'z-index:9999;pointer-events:none;display:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}
