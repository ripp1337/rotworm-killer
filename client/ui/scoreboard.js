// ── Scoreboard UI ─────────────────────────────────────────────────

import * as S from '../systems/state.js';

let _visible = false;

export async function fetchAndRenderScoreboard() {
    const container = document.getElementById('scoreboardList');
    if (!container) return;

    container.textContent = 'Loading…';

    try {
        const res = await fetch('/api/scoreboard');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        _render(container, data.scores ?? []);
    } catch (e) {
        container.textContent = 'Failed to load scoreboard.';
    }
}

function _render(container, scores) {
    container.innerHTML = '';

    if (scores.length === 0) {
        container.textContent = 'No scores yet.';
        return;
    }

    const table = document.createElement('table');
    table.className = 'scoreboard-table';

    const header = table.insertRow();
    for (const col of ['#', 'Player', 'Level', 'Class', 'Score']) {
        const th = document.createElement('th');
        th.textContent = col;
        header.appendChild(th);
    }

    scores.forEach((entry, i) => {
        const row = table.insertRow();
        const isMe = entry.username === S.loggedInPlayer;
        if (isMe) row.className = 'scoreboard-me';

        _addCell(row, String(i + 1));
        _addCell(row, entry.username);
        _addCell(row, String(entry.level));
        _addCell(row, entry.ascended_class ?? '—');
        _addCell(row, _fmt(entry.score));
    });

    container.appendChild(table);
}

function _addCell(row, text) {
    const td = row.insertCell();
    td.textContent = text;
}

export function showScoreboard() {
    const modal = document.getElementById('scoreboardModal');
    if (!modal) return;
    if (!_visible) {
        modal.style.display = 'flex';
        _visible = true;
        fetchAndRenderScoreboard();
    }
}

export function hideScoreboard() {
    const modal = document.getElementById('scoreboardModal');
    if (modal) modal.style.display = 'none';
    _visible = false;
}

export function toggleScoreboard() {
    _visible ? hideScoreboard() : showScoreboard();
}

function _fmt(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(Math.floor(n));
}
