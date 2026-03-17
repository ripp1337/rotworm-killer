// ── Modals — ascend, respec, crafting, inventory ──────────────────

import { S } from '../systems/state.js';
import { CRAFTING_RECIPES } from '../data/recipes.js';
import { craftPotion, isPotionActive } from '../systems/crafting.js';
import { apiFetch } from '../persistence/save.js';
import { updateHUD }        from './hud.js';
import { renderSkillPanel } from './skill_panel.js';

const ESSENCE_ICON = {
    blueEssence:   '🔵',
    greenEssence:  '🟢',
    redEssence:    '🔴',
    yellowEssence: '🟡',
};
const ESSENCE_LABEL = {
    blueEssence:   'Blue',
    greenEssence:  'Green',
    redEssence:    'Red',
    yellowEssence: 'Yellow',
};

// ── Ascend ─────────────────────────────────────────────────────────

export async function doAscend(cls) {
    if (S.ascended)                            return _showToast('Already ascended.');
    if (!['knight', 'sorcerer'].includes(cls)) return _showToast('Invalid class.');
    if (S.level < 30)                          return _showToast('Requires level 30.');

    const res = await apiFetch('/api/ascend', { class: cls });
    if (!res.ok) return _showToast(res.error ?? 'Ascension failed.');

    S.ascended      = true;
    S.ascendedClass = res.ascended_class;
    S.gold          = res.gold;

    _hideModal('class-modal');
    renderSkillPanel();
    updateHUD();
    _showToast(`Ascended as ${S.ascendedClass}!`, false);
}

// ── Respec ─────────────────────────────────────────────────────────

export async function doRespec(cls) {
    if (!S.ascended)                           return _showToast('Must be ascended to respec.');
    if (!['knight', 'sorcerer'].includes(cls)) return _showToast('Invalid class.');

    const COSTS = [1_000_000, 100_000_000, 10_000_000_000];
    const cost  = COSTS[Math.min(S.respecCount, 2)];

    if (S.gold < cost) return _showToast(`Requires ${_fmt(cost)} gold.`);

    const res = await apiFetch('/api/respec', { class: cls });
    if (!res.ok) return _showToast(res.error ?? 'Respec failed.');

    S.ascendedClass  = res.ascended_class;
    S.knightSkillPts = res.knight_pts    ?? {};
    S.sorcSkillPts   = res.sorc_pts      ?? {};
    S.respecCount    = res.respec_count  ?? S.respecCount;
    S.gold           = res.gold;

    _hideModal('class-modal');
    renderSkillPanel();
    updateHUD();
    _showToast(`Respecced to ${S.ascendedClass}!`, false);
}

// ── Crafting modal ─────────────────────────────────────────────────

export function showCraftingModal() {
    const modal = document.getElementById('crafting-modal');
    if (!modal) return;
    _renderCraftingList();
    modal.style.display = 'flex';
}

function _renderCraftingList() {
    const list = document.getElementById('craftingList');
    if (!list) return;
    list.innerHTML = '';

    if (S.level < 20) {
        const hint = document.createElement('p');
        hint.style.cssText = 'text-align:center;color:#5a4020;font-size:11px;padding:20px';
        hint.textContent = 'Crafting unlocks at level 20.';
        list.appendChild(hint);
        return;
    }

    for (const r of CRAFTING_RECIPES) {
        if (r.ascendedOnly && !S.ascended) continue;
        if (S.level < r.levelReq) continue;

        const active    = isPotionActive(r.id);
        const hasIngs   = _hasIngredients(r);
        const canAfford = S.gold >= r.goldCost && hasIngs;

        const card = document.createElement('div');
        card.className = canAfford ? 'craft-card craft-card-highlight' : 'craft-card';

        // Header
        const hdr = document.createElement('div');
        hdr.className = 'craft-header';
        const icon = document.createElement('span');
        icon.className   = 'craft-icon';
        icon.textContent = r.icon ?? '⚗';
        const name = document.createElement('span');
        name.className   = 'craft-name';
        name.textContent = r.name;
        hdr.appendChild(icon);
        hdr.appendChild(name);
        if (active) {
            const badge = document.createElement('span');
            badge.className   = 'craft-badge';
            badge.textContent = 'Active';
            hdr.appendChild(badge);
        }
        card.appendChild(hdr);

        // Description
        const desc = document.createElement('p');
        desc.className   = 'craft-desc';
        desc.textContent = r.desc;
        card.appendChild(desc);

        // Ingredients
        const ings = document.createElement('div');
        ings.className = 'craft-ings';
        for (const [key, qty] of Object.entries(r.ingredients ?? {})) {
            if (qty <= 0) continue;
            const have   = (S.inventory[key] ?? 0) >= qty;
            const ingSpan = document.createElement('span');
            ingSpan.className   = 'craft-ing' + (have ? '' : ' craft-ing-miss');
            ingSpan.textContent = `${ESSENCE_ICON[key] ?? '◆'} ${qty}× ${ESSENCE_LABEL[key] ?? key} (${S.inventory[key] ?? 0})`;
            ings.appendChild(ingSpan);
        }
        card.appendChild(ings);

        // Gold cost
        const costP = document.createElement('p');
        costP.className   = 'craft-cost' + (S.gold >= r.goldCost ? '' : ' craft-cost-miss');
        costP.textContent = `Cost: ${_fmt(r.goldCost)}g`;
        card.appendChild(costP);

        // Craft button
        const btn = document.createElement('button');
        btn.className   = 'craft-btn';
        btn.textContent = active ? 'Already Active' : 'Craft';
        btn.disabled    = active || !canAfford;
        btn.addEventListener('click', () => {
            const result = craftPotion(r.id);
            if (!result.ok) _showToast(result.msg);
            else _showToast(r.name + ' crafted!', false);
            _renderCraftingList();
            updateHUD();
        });
        card.appendChild(btn);

        list.appendChild(card);
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
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    _renderInventory();
    modal.style.display = 'flex';
}

function _renderInventory() {
    const container = document.getElementById('inventoryList');
    if (!container) return;
    container.innerHTML = '';

    const essences = [
        ['blueEssence',   'Blue Essence'],
        ['greenEssence',  'Green Essence'],
        ['redEssence',    'Red Essence'],
        ['yellowEssence', 'Yellow Essence'],
    ];

    for (const [key, label] of essences) {
        const qty = S.inventory[key] ?? 0;
        const item = document.createElement('div');
        item.className = qty > 0 ? 'inv-item' : 'inv-item inv-item-empty';

        const iconEl = document.createElement('div');
        iconEl.className   = 'inv-icon';
        iconEl.textContent = ESSENCE_ICON[key];
        const qtyEl = document.createElement('div');
        qtyEl.className   = 'inv-qty';
        qtyEl.textContent = qty;
        const nameEl = document.createElement('div');
        nameEl.className   = 'inv-name';
        nameEl.textContent = label;

        item.appendChild(iconEl);
        item.appendChild(qtyEl);
        item.appendChild(nameEl);
        container.appendChild(item);
    }
}

// ── Utility ────────────────────────────────────────────────────────

function _hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function _showToast(msg, isError = true) {
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
    toast.textContent    = msg;
    toast.style.borderColor = isError ? '#aa3300' : '#2a6a3a';
    toast.style.color       = isError ? '#cc6030' : '#70cc80';
    toast.style.display     = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function _fmt(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return (n / 1e9 ).toFixed(2) + 'B';
    if (n >= 1e6)  return (n / 1e6 ).toFixed(2) + 'M';
    if (n >= 1e3)  return (n / 1e3 ).toFixed(1) + 'K';
    return String(Math.floor(n));
}
