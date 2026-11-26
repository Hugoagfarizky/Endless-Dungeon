// =========================================================
// NATIVE <dialog> MODAL HELPERS + LIGHT-DISMISS FALLBACK
// =========================================================
function isAnyModalOpen() {
    return document.querySelector('dialog.game-dialog[open]') !== null;
}

function closeAllModals() {
    document.querySelectorAll('dialog.game-dialog[open]').forEach(d => d.close());
}

function closeDialogById(id) {
    const dlg = document.getElementById(id);
    if (dlg && dlg.open) dlg.close();
}

function toggleDialogById(id, onOpenRender = null) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    if (dlg.open) {
        dlg.close();
        return;
    }
    closeAllModals();
    dlg.showModal();
    if (typeof onOpenRender === 'function') onOpenRender();
}

if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
        dialog.addEventListener('click', (event) => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            const isDialogContent = (
                rect.top <= event.clientY &&
                event.clientY <= rect.top + rect.height &&
                rect.left <= event.clientX &&
                event.clientX <= rect.left + rect.width
            );
            if (!isDialogContent) dialog.close();
        });
    });
}

let pendingConfirmCallback = null;
function openConfirmModal(titleText, htmlMessage, confirmLabel, onConfirm) {
    const dlg = document.getElementById('confirm-modal');
    if (!dlg) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }
    const cleanTitle = String(titleText).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
    const titleEl = document.getElementById('confirm-modal-title');
    const bodyEl = document.getElementById('confirm-modal-body');
    const okBtn = document.getElementById('confirm-modal-ok');
    if (titleEl) titleEl.innerText = cleanTitle;
    if (bodyEl) bodyEl.innerHTML = htmlMessage;
    if (okBtn) okBtn.innerText = confirmLabel || 'Confirm';
    pendingConfirmCallback = onConfirm;
    closeAllModals();
    dlg.showModal();
}

document.addEventListener('DOMContentLoaded', () => {
    const okBtn = document.getElementById('confirm-modal-ok');
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            const cb = pendingConfirmCallback;
            pendingConfirmCallback = null;
            closeDialogById('confirm-modal');
            if (typeof cb === 'function') cb();
        });
    }
});

function confirmResetRun() {
    openConfirmModal(
        'Abandon Current Expedition',
        'Seluruh progres lantai, level party, dan isi tas pada ekspedisi ini akan diulang dari <b>Lantai 1</b>.<br><small style="color:#78ab8c;">Data Hall of Fame, Prestige, dan Bestiary Mastery di Royal Codex tetap tersimpan permanen.</small>',
        'Abandon & Restart',
        () => resetGameRun()
    );
}

function confirmPrestige() {
    if (currentFloor < 10) return;
    const nextPrest = ((typeof getPrestigeLevel === 'function') ? getPrestigeLevel() : 0) + 1;
    openConfirmModal(
        `Rite of Prestige Lv.${nextPrest}`,
        `Ordo Ksatria akan memulai siklus baru dari Lantai 1 dengan berkah abadi <b>+${nextPrest * 5}% Semua Atribut Permanen</b> lintas ekspedisi.`,
        `Claim Prestige Lv.${nextPrest}`,
        () => triggerPrestige()
    );
}

function openAscensionModal() {
    toggleDialogById('ascension-modal');
}

function confirmAscensionChoice(mod) {
    closeDialogById('ascension-modal');
    triggerAscension(mod);
}

// =========================================================
// DIALOG 6: ROYAL CODEX — ANNALS, HONORS & BESTIARY
// =========================================================
function toggleBestiaryModal() {
    toggleDialogById('bestiary-modal', () => {
        SFX.chest();
        renderBestiaryModal();
    });
}

function renderBestiaryModal() {
    if (typeof saveCodexData === 'function') saveCodexData();

    const hofEl = document.getElementById('hall-of-fame-stats');
    const bestiaryEl = document.getElementById('bestiary-list');
    if (!hofEl || !bestiaryEl || typeof hallOfFame === 'undefined') return;

    const masteredCount = Object.values(BESTIARY_CATALOG).filter(
        m => (hallOfFame.bestiaryKills[m.id] || 0) >= m.targetKills
    ).length;

    const unlockedAch = hallOfFame.achievements || [];
    const achRows = (typeof ACHIEVEMENTS_CATALOG !== 'undefined' ? ACHIEVEMENTS_CATALOG : []).map(a => {
        const done = unlockedAch.includes(a.id);
        return `
            <div class="slot-row" style="opacity:${done ? '1' : '0.45'};">
                <div>
                    <b style="color:${done ? '#e2ceb4' : '#8c7d6e'};">${done ? icon('trophy', 13) : icon('lock', 12)} ${a.name}</b>
                    <div style="font-size:12px; color:#8c7d6e;">${a.desc}</div>
                </div>
                <span class="item-qty-badge" style="color:${done ? '#92c4a4' : '#6e5a49'};">${done ? 'Earned' : 'Locked'}</span>
            </div>
        `;
    }).join('');

    const historyList = (hallOfFame.runHistory || []).slice(0, 5).map((r, i) => `
        <div class="slot-row" style="font-size:12.5px;">
            <span>#${i + 1} · <b>Floor ${r.floor}</b> (Asc.${r.ascension || 0} · Prest.${r.prestige || 0})</span>
            <span class="gold-val">${r.gold || 0} G</span>
        </div>
    `).join('') || `<div style="font-size:13px; color:#8c7d6e; font-style:italic; padding:4px;">Belum ada ekspedisi yang tercatat.</div>`;

    hofEl.innerHTML = `
        <div class="slot-row">
            <span><b>Deepest Descent</b></span>
            <b class="gold-val">Floor ${hallOfFame.highestFloor}</b>
        </div>
        <div class="slot-row">
            <span><b>Ascension &amp; Prestige</b></span>
            <b style="color:#8eb5d9;">Asc Lv.${hallOfFame.highestAscension} · Prest Lv.${hallOfFame.prestigeLevel || 0}</b>
        </div>
        <div class="slot-row">
            <span><b>Adversaries Vanquished</b></span>
            <b style="color:#92c4a4;">${hallOfFame.totalKills} Foes (${hallOfFame.bossKills} Bosses)</b>
        </div>
        <div class="slot-row">
            <span><b>Gold Amassed</b></span>
            <b class="gold-val">${hallOfFame.totalGoldEarned} G</b>
        </div>
        <div class="slot-row">
            <span><b>Coffers &amp; Decrees</b></span>
            <b>${hallOfFame.chestsOpened || 0} Chests · ${hallOfFame.bountiesCompleted || 0} Decrees</b>
        </div>
        <div class="slot-row">
            <span><b>Bestiary Mastery</b></span>
            <b style="color:#c7ae91;">${masteredCount} / ${Object.keys(BESTIARY_CATALOG).length} Species</b>
        </div>
        <div class="slot-row">
            <span><b>Expedition Ledger</b></span>
            <span style="color:#8c7d6e;">Run #${hallOfFame.totalRuns || 1} (${hallOfFame.totalWipes || 0} Fallen)</span>
        </div>
        <h3 style="margin-top:8px;">Honors (${unlockedAch.length}/${(typeof ACHIEVEMENTS_CATALOG !== 'undefined' ? ACHIEVEMENTS_CATALOG.length : 0)})</h3>
        ${achRows}
        <h3 style="margin-top:8px;">Recent Chronicles</h3>
        ${historyList}
    `;

    bestiaryEl.innerHTML = Object.values(BESTIARY_CATALOG).map(monster => {
        const kills = hallOfFame.bestiaryKills[monster.id] || 0;
        const isDiscovered = kills > 0;
        const isMastered = kills >= monster.targetKills;
        const progressPct = Math.min(100, Math.floor((kills / monster.targetKills) * 100));

        if (!isDiscovered) {
            return `
            <div class="bag-item-row" style="opacity:0.45;">
                <div>
                    <div>${icon('lock', 13)} <b>Unknown Specimen</b> <small style="color:#8c7d6e">[${monster.role}]</small></div>
                    <div class="item-buff-text" style="color:#8c7d6e;">Tumpas makhluk ini minimal 1x di dalam dungeon untuk membuka catatan anatominya.</div>
                </div>
                <span class="item-qty-badge">0 / ${monster.targetKills}</span>
            </div>
            `;
        }

        return `
        <div class="bag-item-row">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>
                        ${monster.icon} <b style="color:${isMastered ? '#e2ceb4' : '#dfd0bc'}">${monster.name}</b>
                        <small style="color:#8c7d6e">[${monster.role}]</small>
                    </span>
                    <span class="item-qty-badge" style="color:${isMastered ? '#92c4a4' : '#c7ae91'};">
                        ${isMastered ? 'MASTERED (+10%)' : `${kills} / ${monster.targetKills}`}
                    </span>
                </div>
                <div style="font-family:var(--font-prose); font-size:13px; color:#9e8f7f; margin-top:3px; font-style:italic;">"${monster.lore}"</div>
                <div class="pointed-bar-track" style="inline-size:100%; margin-top:5px;">
                    <div class="pointed-bar-fill ${isMastered ? 'fill-amber' : 'fill-cobalt'}" style="width:${progressPct}%;"></div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// =========================================================
// "MAP FOUND" STYLE FLOOR & DEATH TRANSITION OVERLAY
// =========================================================
const BIOME_LORE = {
    crypt: "Lorong makam kuno yang lembap, tempat tulang-belulang prajurit masa silam bangkit menjaga ruang bawah tanah.",
    ice:   "Rongga es abadi yang membekukan napas; setiap langkah di atas lantai licin mengundang bahaya kelumpuhan.",
    lava:  "Jantung perapian bumi yang membara; hawa panasnya melipatgandakan luka bakar bagi siapa pun yang lengah.",
    void:  "Jurang kehampaan tanpa dasar yang melahap cahaya obor dengan cepat, namun menyimpan pusaka legendaris."
};

function showDeathTransition(titleText = "THE ORDER HAS FALLEN", subtitleText = "EXPEDITION TERMINATED") {
    const overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) return;

    const subEl   = document.getElementById('trans-subtitle');
    const titleEl = document.getElementById('trans-floor-title');
    const biomeEl = document.getElementById('trans-biome-name');
    const loreEl  = document.getElementById('trans-lore-text');
    const warnEl  = document.getElementById('trans-boss-warning');

    if (subEl)   subEl.innerText = subtitleText;
    if (titleEl) titleEl.innerText = titleText;
    if (biomeEl) {
        biomeEl.innerText = 'Endless Dungeon';
        biomeEl.style.color = '#b83a3e';
    }
    if (loreEl) loreEl.innerText = '"Kegelapan menelan seluruh Ordo. Catatan kehormatan tetap terukir di Royal Codex."';
    if (warnEl) warnEl.classList.add('hidden');

    const prevMode = gameMode;
    gameMode = 'TRANSITION';

    overlay.classList.add('death-mode');
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('death-mode');
            if (gameMode === 'TRANSITION') gameMode = prevMode === 'TRANSITION' ? 'EXPLORE' : prevMode;
        }, 450);
    }, 2100);
}

function showFloorTransition(floorNum, customSubtitle = "DESCENDING INTO THE DEPTHS") {
    const overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) return;

    const biome = getCurrentBiome();
    const roster = (typeof BIOME_BOSS_ROSTER !== 'undefined' && BIOME_BOSS_ROSTER[biome.id])
        ? BIOME_BOSS_ROSTER[biome.id]
        : { mini: { name: "Abyssal Warden" }, grand: { name: "Dread Overlord" } };

    const subEl   = document.getElementById('trans-subtitle');
    const titleEl = document.getElementById('trans-floor-title');
    const biomeEl = document.getElementById('trans-biome-name');
    const loreEl  = document.getElementById('trans-lore-text');
    const warnEl  = document.getElementById('trans-boss-warning');

    if (subEl)   subEl.innerText = customSubtitle;
    if (titleEl) titleEl.innerText = `FLOOR ${floorNum}`;
    if (biomeEl) {
        biomeEl.innerText = biome.name;
        biomeEl.style.color = '#c7ae91';
    }
    if (loreEl) loreEl.innerText = `"${BIOME_LORE[biome.id] || BIOME_LORE.crypt}"`;

    if (warnEl) {
        if (floorNum % 10 === 0) {
            warnEl.innerText = `Dread Lord Awaits: ${roster.grand.name}`;
            warnEl.classList.remove('hidden');
        } else if (floorNum % 5 === 0) {
            warnEl.innerText = `Warden of the Threshold: ${roster.mini.name}`;
            warnEl.classList.remove('hidden');
        } else {
            warnEl.classList.add('hidden');
        }
    }

    const prevMode = gameMode;
    gameMode = 'TRANSITION';

    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.classList.add('hidden');
            if (gameMode === 'TRANSITION') gameMode = prevMode === 'TRANSITION' ? 'EXPLORE' : prevMode;
        }, 450);
    }, 1850);
}

// =========================================================
// STAT DIFF PREVIEW & SET / CURSE META HELPERS
// =========================================================
function formatStatDiffHtml(candidateItem, hero) {
    if (!candidateItem || !hero) return '';
    const currentEq = hero.equipment[candidateItem.slot];

    const statMeta = [
        { key: 'hp',   label: 'HP' },
        { key: 'mp',   label: 'MP' },
        { key: 'patk', label: 'P.ATK' },
        { key: 'matk', label: 'M.ATK' },
        { key: 'def',  label: 'DEF' },
        { key: 'spd',  label: 'SPD' }
    ];

    if (!currentEq) {
        const gains = statMeta
            .filter(s => (candidateItem.stats[s.key] || 0) > 0)
            .map(s => `<span style="color:#92c4a4; font-weight:600;">+${candidateItem.stats[s.key]} ${s.label}</span>`);
        return `<span style="color:#8c7d6e;">Empty Slot:</span> ${gains.join(' · ')}`;
    }

    const diffs = [];
    statMeta.forEach(s => {
        const newVal = candidateItem.stats[s.key] || 0;
        const oldVal = currentEq.stats[s.key] || 0;
        const diff = newVal - oldVal;

        if (diff > 0) {
            diffs.push(`<span style="color:#92c4a4; font-weight:600;">+${diff} ${s.label}</span>`);
        } else if (diff < 0) {
            diffs.push(`<span style="color:#cf5b64; font-weight:600;">${diff} ${s.label}</span>`);
        } else if (newVal > 0 && diff === 0) {
            diffs.push(`<span style="color:#8c7d6e;">=${s.label}</span>`);
        }
    });

    if (diffs.length === 0) {
        return `<span style="color:#8c7d6e;">Identical to equipped</span>`;
    }
    return `<span style="color:#9e8f7f;">vs ${hero.name}:</span> ${diffs.join(' · ')}`;
}

function formatSetAndCurseMetaHtml(item, hero = null) {
    let html = '';
    if (item.setId && typeof EQUIPMENT_SETS !== 'undefined' && EQUIPMENT_SETS[item.setId]) {
        const s = EQUIPMENT_SETS[item.setId];
        const count = hero ? (getHeroActiveSets(hero)[item.setId] || 0) : 0;
        html += `<div style="font-size:12px; color:${s.color}; margin-top:2px;">
            ${s.icon} <b>${s.name}</b> ${hero ? `(${count}/4)` : ''} · <small>2pc: ${s.bonus2Desc}</small>
        </div>`;
    }
    if (item.curseId) {
        html += `
            <div style="font-size:12px; color:#d69a56; margin-top:2px; font-weight:600;">${item.boonDesc}</div>
            <div class="curse-drawback-text">${item.curseDesc}</div>
        `;
    }
    return html;
}

// ==========================================
// DIALOG 5: CAMPFIRE / SANCTUARY HEARTH
// ==========================================
function openCampfireModal() {
    SFX.shrine();
    toggleDialogById('campfire-modal', renderCampfireModal);
}

function closeCampfireModal() {
    closeDialogById('campfire-modal');
}

function renderCampfireModal() {
    const listEl = document.getElementById('campfire-options-list');
    if (!listEl) return;
    const canUpgradeTorch = (inventory.ore >= 3 && inventory.gold >= 50);
    listEl.innerHTML = `
        <div class="bag-item-row">
            <div>
                <b>${icon('campfire', 14)} Rest by the Embers</b>
                <div class="item-buff-text">Pulihkan +45% Max HP &amp; MP seluruh Party, bersihkan racun/debuff, &amp; Obor 100%.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseCampfireAction('rest')">Rest</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('sword', 14)} Whetstone &amp; War Prayer</b>
                <div class="item-buff-text">Berikan +25% Damage pada pertarungan berikutnya &amp; +50% Overdrive semua Ksatria.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseCampfireAction('sharpen')">Hone Blades</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('map', 14)} Falcon Recon</b>
                <div class="item-buff-text">Buka seluruh Fog of War di lantai ini &amp; ungkap semua lokasi jebakan.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseCampfireAction('scout')">Scout Floor</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('torch', 14)} Temper Iron Brazier (Lv.${torchUpgradeLevel || 0} → Lv.${(torchUpgradeLevel || 0) + 1})</b>
                <div class="item-buff-text">Kurangi konsumsi obor per langkah secara permanen &amp; isi penuh Obor. Biaya: 3 Ore + 50 Gold.</div>
            </div>
            <button type="button" class="btn-small-use" ${!canUpgradeTorch ? 'disabled' : ''} onclick="chooseCampfireAction('upgrade_torch')">Forge Torch</button>
        </div>
    `;
}

// ==========================================
// DIALOG 4: SHRINE OF THE OLD GODS
// ==========================================
function openShrineModal() {
    SFX.shrine();
    toggleDialogById('shrine-modal', renderShrineModal);
}

function closeShrineModal() {
    closeDialogById('shrine-modal');
}

function renderShrineModal() {
    const listEl = document.getElementById('shrine-options-list');
    if (!listEl) return;
    const wisdomCost = 40 + (currentFloor * 10);
    listEl.innerHTML = `
        <div class="bag-item-row">
            <div>
                <b class="rarity-Cursed">${icon('skull', 13)} Blood Tithe (Sacrifice 30% HP)</b>
                <div class="item-buff-text">Dijamin 1x Cursed Relic atau Zirah Epic/Legendary masuk ke Reliquary Coffer.</div>
            </div>
            <button type="button" class="btn-small-danger" onclick="chooseShrineBlessing('blood')">Bleed</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Legendary">${icon('coin', 13)} Tribute of Kings (${wisdomCost} G)</b>
                <div class="item-buff-text">Seluruh Ksatria menerima limpahan EXP kuno secara instan.</div>
            </div>
            <button type="button" class="btn-small-equip" ${inventory.gold < wisdomCost ? 'disabled' : ''} onclick="chooseShrineBlessing('wisdom')">Offer Gold</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('crest', 13)} Grace of the Cathedral</b>
                <div class="item-buff-text">Obor penuh 100%, pulihkan +30 HP, +25 MP &amp; sucikan semua racun/debuff.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseShrineBlessing('radiance')">Pray</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Epic">${icon('sword', 13)} Trial of the Guardians</b>
                <div class="item-buff-text">Panggil 2 Altar Guardian (Elite). Tumpas keduanya untuk jaminan zirah Epic + Ore.</div>
            </div>
            <button type="button" class="btn-small-danger" onclick="chooseShrineBlessing('trial')">Challenge</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Rare">${icon('arcane', 13)} Shrine of Memory</b>
                <div class="item-buff-text">Seluruh Ksatria hidup langsung memperoleh +1 Stat Point bebas alokasi.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseShrineBlessing('memory')">Commune</button>
        </div>
    `;
}

// =========================================================================
// DIALOG 3: WANDERING CARAVAN (MERCHANT)
// =========================================================================
function openMerchantModal() {
    ensureMerchantInventory();
    SFX.chest();
    toggleDialogById('merchant-modal', renderMerchantModal);
}

function closeMerchantModal() {
    closeDialogById('merchant-modal');
}

function renderMerchantModal() {
    ensureMerchantInventory();
    const goldEl = document.getElementById('merchant-gold');
    if (goldEl) goldEl.innerText = inventory.gold;
    const listEl = document.getElementById('merchant-items-list');
    if (!listEl || !merchant || !merchant.stock) return;

    const previewHero = party[selectedHeroIndex] || getLeader() || party[0];

    listEl.innerHTML = merchant.stock.map((item, idx) => {
        const isSoldOut = (item.stock <= 0);
        const canAfford = (inventory.gold >= item.cost && !isSoldOut);
        const titleClass = item.rarity ? `class="rarity-${item.rarity}"` : '';
        const slotTag = item.slotLabel ? `<small style="color:#8c7d6e">[${item.slotLabel}]</small>` : '';
        const stockBadge = isSoldOut
            ? `<span class="item-qty-badge" style="color:#cf5b64;">SOLD</span>`
            : `<span class="item-qty-badge">${item.stock}/${item.maxStock}</span>`;

        const extraMeta = (item.type === 'specific_gear' && item.gearData)
            ? `${formatSetAndCurseMetaHtml(item.gearData, previewHero)}<div style="font-size:12px; margin-top:2px;">${formatStatDiffHtml(item.gearData, previewHero)}</div>`
            : '';

        return `
        <div class="bag-item-row" style="opacity:${isSoldOut ? '0.42' : '1'};">
            <div>
                <div><b ${titleClass}>${item.name}</b> ${slotTag} ${stockBadge}</div>
                <div class="item-buff-text">${item.desc}</div>
                ${extraMeta}
                <div style="font-family:var(--font-gothic); font-size:12.5px; color:#e2ceb4; margin-top:2px;">${item.cost} G</div>
            </div>
            <button type="button" class="btn-small-use" ${!canAfford ? 'disabled' : ''} onclick="buyMerchantItem(${idx})">
                ${isSoldOut ? 'Sold' : 'Acquire'}
            </button>
        </div>
        `;
    }).join('');

    const rerollCost = 35 + currentFloor * 8;
    const rerollRow = `
        <div class="bag-item-row" style="margin-top:6px;">
            <div>
                <b>${icon('reset', 13)} Restock Caravan Wares</b>
                <div class="item-buff-text">${merchant.rerolled ? 'Sudah digunakan pada pedagang lantai ini.' : `Perbarui seluruh stok lantai ini (sekali per pedagang). Biaya: ${rerollCost} G.`}</div>
            </div>
            <button type="button" class="btn-small-equip" ${(merchant.rerolled || inventory.gold < rerollCost) ? 'disabled' : ''} onclick="rerollMerchantStock()">
                ${merchant.rerolled ? 'Used' : `Restock (${rerollCost}G)`}
            </button>
        </div>
    `;

    const sellRows = inventory.bag.length === 0
        ? `<div class="bag-item-row"><div class="item-buff-text" style="color:#8c7d6e;">Reliquary Coffer kosong — tidak ada zirah cadangan untuk dijual.</div></div>`
        : inventory.bag.map((item, idx) => {
            const ico = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].icon) ? EQUIP_SLOTS[item.slot].icon : icon('chest', 13);
            const slotLabel = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].label) ? EQUIP_SLOTS[item.slot].label : item.slot;
            const up = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
            return `
            <div class="bag-item-row">
                <div>
                    <b class="rarity-${item.rarity || 'Common'}">${ico} ${item.name}</b> <small style="color:#8c7d6e">[${slotLabel}${up}]</small>
                    <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                </div>
                <button type="button" class="btn-small-unequip" onclick="sellBagItem(${idx})">Sell +${getItemSellValue(item)}G</button>
            </div>
            `;
        }).join('');

    listEl.innerHTML += `
        ${rerollRow}
        <h3 style="margin-top:10px;">Barter Spare Equipment</h3>
        ${sellRows}
    `;
}

// ==========================================
// DIALOG 1: APOTHECARY SATCHEL
// ==========================================
function toggleBackpackModal() {
    toggleDialogById('backpack-modal', renderBackpackModal);
}

function renderBackpackModal() {
    const listEl = document.getElementById('backpack-items-list');
    if (!listEl) return;
    const keys = Object.keys(CONSUMABLE_CATALOG).filter(k => (inventory.consumables[k] || 0) > 0);

    if (keys.length === 0) {
        listEl.innerHTML = `<div style="color:#8c7d6e; font-style:italic; font-size:14.5px; padding:22px; text-align:center;">Satchel kosong. Tumpas penghuni ruang bawah tanah atau temui Wandering Caravan.</div>`;
        return;
    }

    const activeActor = getCurrentActor();
    const isEnemyTurn = (gameMode === 'COMBAT' && activeActor && activeActor.isEnemy);

    listEl.innerHTML = keys.map(key => {
        const meta = CONSUMABLE_CATALOG[key];
        const qty = inventory.consumables[key];
        return `
        <div class="bag-item-row">
            <div>
                <div>${meta.icon} <b>${meta.name}</b> <span class="item-qty-badge">x${qty}</span></div>
                <div class="item-buff-text">${meta.desc}</div>
            </div>
            <button type="button" class="btn-small-use" ${isEnemyTurn ? 'disabled' : ''} onclick="useBackpackItem('${key}')">Imbibe</button>
        </div>
        `;
    }).join('');
}

// ==========================================
// DIALOG 2: ROYAL ARMORY & BLACKSMITH FORGE
// ==========================================
function toggleEquipModal(forceHeroIdx = null) {
    const equipModal = document.getElementById('equip-modal');
    if (!equipModal) return;

    if (forceHeroIdx !== null) {
        closeAllModals();
        selectedHeroIndex = forceHeroIdx;
        equipModal.showModal();
        renderEquipModal();
        return;
    }
    toggleDialogById('equip-modal', renderEquipModal);
}

function selectHeroTab(idx) {
    selectedHeroIndex = idx;
    renderEquipModal();
}

function renderEquipModal() {
    const hero = party[selectedHeroIndex];
    if (!hero) return;

    const oreEl = document.getElementById('modal-ore-count');
    const goldEl = document.getElementById('modal-gold-count');
    if (oreEl) oreEl.innerText = inventory.ore;
    if (goldEl) goldEl.innerText = inventory.gold;

    const tabsEl = document.getElementById('hero-tabs');
    if (tabsEl) {
        tabsEl.innerHTML = party.map((p, idx) => {
            const avatarUrl = (typeof getHeroPortraitDataURL === 'function') ? getHeroPortraitDataURL(p.role) : '';
            return `
            <button type="button" class="hero-tab-btn ${idx === selectedHeroIndex ? 'active' : ''}" onclick="selectHeroTab(${idx})">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${p.role}">` : ''}
                <span>${p.name} · Lv.${p.level}</span>
            </button>
            `;
        }).join('');
    }

    const pts = hero.statPoints;
    const btnHtml = (stat, label) => pts > 0
        ? `<button type="button" class="btn-small-use" style="padding:1px 5px; font-size:10.5px; margin-left:4px;" onclick="allocateStatPoint(${selectedHeroIndex}, '${stat}')">+${label}</button>`
        : '';

    const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(hero) : { roman: 'I', roleLabel: 'VANGUARD' };

    document.getElementById('modal-hero-title').innerHTML = `
        ${hero.name} (${hero.role}) · Rank ${form.roman} ${form.roleLabel} <small>EXP ${hero.xp}/${hero.maxXp}</small>
        ${pts > 0 ? `<span style="color:#92c4a4; margin-left:6px;">[+${pts} Attr Pt]</span>` : ''}
    `;

    document.getElementById('modal-hero-stats').innerHTML = `
        <span>HP<b>${hero.maxHp}</b>${btnHtml('hp','12')}</span>
        <span>MP<b>${hero.maxMp}</b>${btnHtml('mp','8')}</span>
        <span>P.ATK<b>${hero.patk}</b>${btnHtml('patk','2')}</span>
        <span>M.ATK<b>${hero.matk}</b>${btnHtml('matk','2')}</span>
        <span>DEF<b>${hero.def}</b>${btnHtml('def','2')}</span>
        <span>SPD<b>${hero.spd}</b>${btnHtml('spd','1')}</span>
    `;

    const setCounts = getHeroActiveSets(hero);
    const activeSetBadges = Object.keys(setCounts).map(sKey => {
        const s = EQUIPMENT_SETS[sKey];
        const cnt = setCounts[sKey];
        const b2 = cnt >= 2 ? `<b style="color:#92c4a4">[2pc: ${s.bonus2Desc}]</b>` : `<small style="color:#8c7d6e">(Requires 2pc)</small>`;
        const b4 = cnt >= 4 ? ` <b style="color:#e2ceb4">[4pc: ${s.bonus4Desc}]</b>` : '';
        return `<div style="margin-top:2px;"><span style="color:${s.color}">${s.icon} <b>${s.name} (${cnt}/4):</b></span> ${b2}${b4}</div>`;
    }).join('');

    const perkEl = document.getElementById('modal-hero-perks');
    const activePerkNames = (hero.perks || []).map(k => PERK_CATALOG[k] ? PERK_CATALOG[k].name : k).join(', ') || 'None';
    const perkBtns = Object.values(PERK_CATALOG).map(pk => {
        const owned = hero.perks && hero.perks.includes(pk.id);
        return `<button type="button" class="${owned ? 'btn-small-use' : 'btn-small-unequip'}"
            ${(owned || hero.perkPoints <= 0) ? 'disabled' : ''}
            title="${pk.desc}" onclick="unlockHeroPerk(${selectedHeroIndex}, '${pk.id}')">
            ${owned ? `${icon('check', 11)} ` : ''}${pk.name}
        </button>`;
    }).join('');

    const masteryBtns = Object.values(MASTERY_CATALOG).map(m => {
        const owned = hero.mastery && hero.mastery.includes(m.id);
        return `<button type="button" class="${owned ? 'btn-small-use' : 'btn-small-unequip'}"
            ${(owned || (hero.perkPoints || 0) <= 0) ? 'disabled' : ''}
            title="${m.desc}" onclick="unlockMastery(${selectedHeroIndex}, '${m.id}')">
            ${owned ? `${icon('check', 11)} ` : ''}${m.name}
        </button>`;
    }).join('');
    const activeMastery = (hero.mastery || []).map(k => MASTERY_CATALOG[k].name).join(', ') || 'None';

    perkEl.innerHTML = `
        <div><b>Knightly Vows:</b> <span style="color:#e2ceb4">${activePerkNames}</span>
        ${hero.perkPoints > 0 ? `<b style="color:#92c4a4; margin-left:6px;">(${hero.perkPoints} Vow Pt)</b>` : `<small style="color:#8c7d6e">(Odd Levels)</small>`}</div>
        <div class="perk-btn-row">${perkBtns}</div>
        <div style="margin-top:6px; border-top:1px solid #2e2620; padding-top:5px;">
            <b>Combat Mastery:</b> <span style="color:#e2ceb4">${activeMastery}</span>
            <div class="perk-btn-row">${masteryBtns}</div>
        </div>
        ${activeSetBadges ? `<div style="border-top:1px solid #2e2620; margin-top:5px; padding-top:4px;">${activeSetBadges}</div>` : ''}
    `;

    const runeEl = document.getElementById('modal-hero-runes');
    if (runeEl) {
        const runes = hero.runes || [];
        const charm = hero.charm;
        let html = charm
            ? `<div>${icon('relic', 12)} <b>Charm:</b> <span style="color:#e2ceb4;">${charm.name}</span> <small style="color:#8c7d6e">(${charm.desc})</small></div>`
            : `<div>${icon('relic', 12)} <b>Charm:</b> <small style="color:#8c7d6e">Empty (Dropped by Bosses)</small></div>`;
        if (runes.length === 0) {
            html += `<div style="margin-top:2px;">${icon('arcane', 12)} <b>Runes:</b> <small style="color:#8c7d6e">None inscribed (Dropped by Elites &amp; Bosses)</small></div>`;
        } else {
            const list = runes.map(k => {
                const r = (typeof RUNE_CATALOG !== 'undefined') ? RUNE_CATALOG[k] : null;
                return r ? `<span style="color:#c8addb; margin-right:8px;" title="${r.desc}">${r.name}</span>` : k;
            }).join('');
            html += `<div style="margin-top:2px;">${icon('arcane', 12)} <b>Runes (${runes.length}):</b> ${list}</div>`;
        }
        runeEl.innerHTML = html;
    }

    const slotsEl = document.getElementById('equipped-slots-list');
    slotsEl.innerHTML = Object.keys(EQUIP_SLOTS).map(slotKey => {
        const slotMeta = EQUIP_SLOTS[slotKey];
        const eqItem = hero.equipment[slotKey];

        if (eqItem) {
            const upgLv = eqItem.upgradeLevel || 0;
            const costOre = 1 + upgLv;
            const costGold = 25 + (upgLv * 20);
            const canForge = (inventory.ore >= costOre && inventory.gold >= costGold);

            return `
            <div class="slot-row">
                <div>
                    <div>
                        ${slotMeta.icon} <b>${slotMeta.label}:</b>
                        <span class="rarity-${eqItem.rarity}">${eqItem.name} ${upgLv > 0 ? `<b style="color:#8eb5d9">+${upgLv}</b>` : ''}</span>
                    </div>
                    <div class="item-buff-text">${formatItemBuffs(eqItem.stats)}</div>
                    ${formatSetAndCurseMetaHtml(eqItem, hero)}
                </div>
                <div style="display:flex; gap:5px;">
                    <button type="button" class="btn-small-equip" ${!canForge ? 'disabled' : ''}
                        title="Temper: Requires ${costOre} Ore & ${costGold} Gold"
                        onclick="upgradeEquippedItem(${selectedHeroIndex}, '${slotKey}')">
                        Temper (${costOre} Ore · ${costGold}G)
                    </button>
                    <button type="button" class="btn-small-unequip" onclick="unequipItemFromHero(${selectedHeroIndex}, '${slotKey}')">Unequip</button>
                </div>
            </div>
            `;
        }
        return `
        <div class="slot-row" style="opacity:0.48;">
            <div>${slotMeta.icon} <b>${slotMeta.label}:</b> <i>Empty Slot</i></div>
            <span style="color:#6e5a49;">—</span>
        </div>
        `;
    }).join('');

    const bagEl = document.getElementById('bag-items-list');
    if (inventory.bag.length === 0) {
        bagEl.innerHTML = '<div style="color:#8c7d6e; font-style:italic; font-size:14px; padding:14px;">Reliquary Coffer kosong.</div>';
        return;
    }

    const rarityRank = { 'Common':0, 'Rare':1, 'Epic':2, 'Legendary':3, 'Cursed':3 };
    const sortSel = document.getElementById('bag-sort-select');
    const filterSel = document.getElementById('bag-filter-select');
    const sortMode = sortSel ? sortSel.value : 'rarity';
    const filterMode = filterSel ? filterSel.value : 'all';

    let indexed = inventory.bag.map((item, bagIdx) => ({ item, bagIdx }));
    if (filterMode === 'upgrade') {
        indexed = indexed.filter(o => {
            const cur = hero.equipment[o.item.slot];
            if (!cur) return true;
            return ['hp','mp','patk','matk','def','spd'].some(k => (o.item.stats[k] || 0) > (cur.stats[k] || 0));
        });
    } else if (filterMode !== 'all') {
        indexed = indexed.filter(o => {
            if (filterMode === 'legendary') return o.item.rarity === 'Legendary' || o.item.rarity === 'Cursed';
            const target = filterMode.charAt(0).toUpperCase() + filterMode.slice(1);
            return o.item.rarity === target;
        });
    }
    if (sortMode === 'rarity') {
        indexed.sort((a, b) => (rarityRank[b.item.rarity] || 0) - (rarityRank[a.item.rarity] || 0));
    } else if (sortMode === 'slot') {
        indexed.sort((a, b) => String(a.item.slot).localeCompare(String(b.item.slot)));
    } else if (sortMode === 'name') {
        indexed.sort((a, b) => String(a.item.name).localeCompare(String(b.item.name)));
    }

    if (indexed.length === 0) {
        bagEl.innerHTML = '<div style="color:#8c7d6e; font-style:italic; padding:12px;">Tidak ada zirah yang sesuai filter.</div>';
        return;
    }

    bagEl.innerHTML = indexed.map(o => {
        const item = o.item;
        const bagIdx = o.bagIdx;
        const slotMeta = EQUIP_SLOTS[item.slot];
        const upgLv = item.upgradeLevel || 0;
        const diffHtml = formatStatDiffHtml(item, hero);
        return `
        <div class="bag-item-row">
            <div>
                <div>${slotMeta.icon} <span class="rarity-${item.rarity}">${item.name}${upgLv > 0 ? ' +' + upgLv : ''}</span> <small style="color:#8c7d6e">[${slotMeta.label}]</small></div>
                <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                ${formatSetAndCurseMetaHtml(item, hero)}
                <div style="font-size:12px; margin-top:4px; padding:3px 6px; background:#110f11; border:1px solid #2e2620;">${diffHtml}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-equip" onclick="equipItemToHero(${bagIdx}, ${selectedHeroIndex})">Equip</button>
                <button type="button" class="btn-small-unequip" title="Lebur menjadi Forge Ore & Gold" onclick="dismantleBagItem(${bagIdx})">Smelt</button>
            </div>
        </div>`;
    }).join('');
}

function togglePauseModal() {
    toggleDialogById('pause-modal');
}
