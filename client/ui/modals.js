// ── Modals — ascend, respec, crafting, inventory ──────────────────

import * as S from '../systems/state.js';
import { CRAFTING_RECIPES, LOOT_TABLE } from '../data/recipes.js';
import { craftPotion, isPotionActive } from '../systems/crafting.js';
import { apiFetch } from '../persistence/save.js';
import { updateHUD }        from './hud.js';
import { renderSkillPanel } from './skill_panel.js';

// ── Ascend ─────────────────────────────────────────────────────────

export async function doAscend(cls) {
    if (S.ascended) return alert('Already ascended.');
    if (!['knight', 'sorcerer'].includes(cls)) return alert('Invalid class.');
    if (S.level < 30) return alert('Requires level 30.');

    if (!confirm(`Ascend as a ${cls.charAt(0).toUpperCase() + cls.slice(1)}?`)) return;

    const res = await apiFetch('/api/ascend', { class: cls });
    if (!res.ok) return alert(res.error ?? 'Ascension failed.');

    S.ascended      = true;
    S.ascendedClass = res.ascended_class;
    S.gold          = res.gold;

    _hideModal('ascendModal');
    renderSkillPanel();
    updateHUD();
    alert(`You have ascended as a ${S.ascendedClass}!`);
}

// ── Respec ─────────────────────────────────────────────────────────

export async function doRespec(cls) {
    if (!S.ascended) return alert('Must be ascended to respec.');
    if (!['knight', 'sorcerer'].includes(cls)) return alert('Invalid class.');

    const COSTS = [1_000_000, 100_000_000, 10_000_000_000];
    const cost  = COSTS[Math.min(S.respecCount, 2)];

    if (S.gold < cost) return alert(`Requires ${_fmt(cost)} gold.`);
    if (!confirm(`Respec to ${cls} for ${_fmt(cost)} gold?`)) return;

    const res = await apiFetch('/api/respec', { class: cls });
    if (!res.ok) return alert(res.error ?? 'Respec failed.');

    S.ascendedClass  = res.ascended_class;
    S.knightSkillPts = res.knight_pts    ?? {};
    S.sorcSkillPts   = res.sorc_pts      ?? {};
    S.respecCount    = res.respec_count  ?? S.respecCount;
    S.gold           = res.gold;

    _hideModal('ascendModal');
    renderSkillPanel();
    updateHUD();
}

// ── Crafting modal ─────────────────────────────────────────────────

export function showCraftingModal() {
    const modal = document.getElementById('craftingModal');
    if (!modal) return;

    _renderCraftingList();
    modal.style.display = 'flex';
}

function _renderCraftingList() {
    const list = document.getElementById('craftingList');
    if (!list) return;
    list.innerHTML = '';

    for (const r of CRAFTING_RECIPES) {
        if (r.ascendedOnly && !S.ascended) continue;

        const row = document.createElement('div');
        row.className = 'craft-row';

        const active = isPotionActive(r.id);
        const canAfford = S.gold >= r.goldCost && _hasIngredients(r);

        const info = document.createElement('span');
        info.textContent = `${r.name} — ${_fmt(r.goldCost)}g`;
        info.title       = r.desc;

        const ingStr = Object.entries(r.ingredients ?? {})
            .map(([k, v]) => `${v}× ${k}`)
            .join(', ');
        if (ingStr) {
            const ingSpan = document.createElement('small');
            ingSpan.textContent = ` [${ingStr}]`;
            info.appendChild(ingSpan);
        }

        const btn = document.createElement('button');
        btn.textContent = active ? 'Active' : 'Craft';
        btn.disabled    = active || !canAfford;
        btn.addEventListener('click', () => {
            const result = craftPotion(r.id);
            if (!result.ok) alert(result.msg);
            else _renderCraftingList();
            updateHUD();
        });

        row.appendChild(info);
        row.appendChild(btn);
        list.appendChild(row);
    }
}

function _hasIngredients(r) {
    for (const [item, qty] of Object.entries(r.ingredients ?? {})) {
        if ((S.inventory[item] ?? 0) < qty) return false;
    }
    return true;
}

// ── Inventory modal ────────────────────────────────────────────────

export function showInventoryModal() {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;

    _renderInventory();
    modal.style.display = 'flex';
}

function _renderInventory() {
    const container = document.getElementById('inventoryList');
    if (!container) return;
    container.innerHTML = '';

    const items = Object.entries(S.inventory).filter(([, qty]) => qty > 0);
    if (items.length === 0) {
        container.textContent = 'Inventory is empty.';
        return;
    }

    for (const [name, qty] of items) {
        const row = document.createElement('div');
        row.textContent = `${name}: ${qty}`;
        container.appendChild(row);
    }
}

// ── Utility ────────────────────────────────────────────────────────

function _hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function _fmt(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(Math.floor(n));
}
