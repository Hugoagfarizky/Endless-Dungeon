// =========================================================
// PRESTIGE
// =========================================================
function getPrestigeLevel() {
    if (typeof hallOfFame !== 'undefined') return hallOfFame.prestigeLevel || 0;
    return 0;
}

function triggerPrestige() {
    if (typeof hallOfFame === 'undefined') return;
    hallOfFame.prestigeLevel = (hallOfFame.prestigeLevel || 0) + 1;
    if (typeof saveCodexData === 'function') saveCodexData();
    addLog('⭐ PRESTIGE ' + hallOfFame.prestigeLevel + '! Semua Ksatria mendapat +5% stat permanen.');
    resetGameRun();
}

const CODEX_STORAGE_KEY = 'endless_dungeon_codex_v1';

let hallOfFame = {
    highestFloor: 1,
    highestAscension: 0,
    totalKills: 0,
    bossKills: 0,
    totalGoldEarned: 0,
    chestsOpened: 0,
    bountiesCompleted: 0,
    totalRuns: 1,
    totalWipes: 0,
    prestigeLevel: 0,
    achievements: [],
    runHistory: [],
    dailyBest: 0,
    bestiaryKills: {
        slime: 0, skeleton: 0, guard: 0, mimic: 0, warden: 0, overlord: 0
    }
};

function checkAchievements() {
    if (typeof hallOfFame === 'undefined') return;
    if (!hallOfFame.achievements) hallOfFame.achievements = [];
    ACHIEVEMENTS_CATALOG.forEach(a => {
        if (hallOfFame.achievements.includes(a.id)) return;
        if (a.check(hallOfFame)) {
            hallOfFame.achievements.push(a.id);
            if (typeof addLog === 'function') addLog('🏆 Achievement Unlocked: ' + a.name + ' - ' + a.desc);
            if (typeof SFX !== 'undefined' && SFX.levelup) SFX.levelup();
        }
    });
    if (typeof saveCodexData === 'function') saveCodexData();
}

function recordRunHistory() {
    if (typeof hallOfFame === 'undefined') return;
    if (!hallOfFame.runHistory) hallOfFame.runHistory = [];
    const run = {
        floor: currentFloor,
        ascension: ascensionLevel,
        prestige: getPrestigeLevel(),
        gold: inventory.gold,
        time: new Date().toISOString()
    };
    hallOfFame.runHistory.unshift(run);
    if (hallOfFame.runHistory.length > 10) hallOfFame.runHistory = hallOfFame.runHistory.slice(0, 10);
    if (typeof saveCodexData === 'function') saveCodexData();
}

function startDailyChallenge() {
    const d = new Date();
    const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (typeof setRunSeed === 'function') setRunSeed(key);
    // apply a random modifier for the day
    const mods = ['blood_moon', 'gilded', 'darkness'];
    const mod = mods[Math.floor(rng() * mods.length)];
    if (typeof floorModifier !== 'undefined') floorModifier = mod;
    if (typeof addLog === 'function') addLog('📅 Daily Challenge: seed ' + key + ', modifier ' + mod);
    resetGameRun();
    if (typeof updateUI === 'function') updateUI();
}

function loadCodexData() {
    const raw = localStorage.getItem(CODEX_STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        hallOfFame = {
            ...hallOfFame,
            ...parsed,
            bestiaryKills: { ...hallOfFame.bestiaryKills, ...(parsed.bestiaryKills || {}) }
        };
    } catch (e) {}
}

function saveCodexData() {
    if (currentFloor > hallOfFame.highestFloor) hallOfFame.highestFloor = currentFloor;
    if (ascensionLevel > hallOfFame.highestAscension) hallOfFame.highestAscension = ascensionLevel;
    localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(hallOfFame));
}

function getEnemyBestiaryKey(enemy) {
    if (!enemy) return 'slime';
    const n = enemy.name || '';
    if (n.includes("Mimic")) return 'mimic';
    if (enemy.isBoss && enemy.bossTier === 10) return 'overlord';
    if (enemy.isBoss && enemy.bossTier === 5) return 'warden';
    if (n.includes("Royal Guard")) return 'guard';
    if (n.includes("Skeleton")) return 'skeleton';
    return 'slime';
}

function hasBestiaryMastery(enemy) {
    const key = getEnemyBestiaryKey(enemy);
    const meta = BESTIARY_CATALOG[key];
    if (!meta) return false;
    return (hallOfFame.bestiaryKills[key] || 0) >= meta.targetKills;
}

function recordMonsterKill(enemy, goldEarned = 0) {
    const key = getEnemyBestiaryKey(enemy);
    const prevKills = hallOfFame.bestiaryKills[key] || 0;
    hallOfFame.bestiaryKills[key] = prevKills + 1;
    hallOfFame.totalKills++;
    if (enemy.isBoss) hallOfFame.bossKills++;
    hallOfFame.totalGoldEarned += goldEarned;

    const meta = BESTIARY_CATALOG[key];
    if (meta && prevKills < meta.targetKills && hallOfFame.bestiaryKills[key] >= meta.targetKills) {
        addLog(`📖 BESTIARY MASTERY! Kamu telah menumpas ${meta.targetKills}x [${meta.name}]! Bonus permanen +10% DMG terhadap spesies ini aktif!`);
    }
    saveCodexData();
}

loadCodexData();

const SAVE_STORAGE_KEY = 'endless_dungeon_save_v2';
let activeSaveSlot = null; // null = autosave slot
let ascensionModifier = null; // 'empowered' | 'frugal' | 'hardened'

function getSaveKey(slot) {
    if (!slot) return SAVE_STORAGE_KEY;
    return SAVE_STORAGE_KEY + '_slot_' + slot;
}

// ==========================================
// SISTEM AUTO-SAVE & AUTO-LOAD LOCALSTORAGE
// ==========================================
function saveGameProgress(slot) {
    if (party.every(p => p.hp <= 0)) return;
    saveCodexData();
    const targetSlot = (slot === undefined) ? activeSaveSlot : slot;
    const key = getSaveKey(targetSlot);
    const state = {
        currentFloor, ascensionLevel, torchLight, sharpenedBuff,
        party, inventory, itemIdCounter,
        map, revealed, stairs, enemies, chests, lootDrops, traps, shrine, merchant, campfire, floorBounty, floorModifier, runSeed, torchUpgradeLevel
    };
    localStorage.setItem(key, JSON.stringify(state));
    if (targetSlot !== null) addLog(`💾 Progress disimpan ke Slot ${targetSlot}.`);
}

function loadGameProgress(slot) {
    const targetSlot = (slot === undefined) ? activeSaveSlot : slot;
    const key = getSaveKey(targetSlot);
    loadCodexData();
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
        const s = JSON.parse(raw);
        currentFloor   = s.currentFloor || 1;
        ascensionLevel = s.ascensionLevel || 0;
        torchLight     = s.torchLight ?? 100;
        sharpenedBuff  = s.sharpenedBuff || false;
        party          = s.party;

        party.forEach((p, idx) => {
            const tmpl = INITIAL_PARTY_TEMPLATE[idx] || INITIAL_PARTY_TEMPLATE[0];
            if (!p.skill2Name) p.skill2Name = tmpl.skill2Name;
            if (!p.skill2Cost) p.skill2Cost = tmpl.skill2Cost;
            if (p.defendStreak === undefined) p.defendStreak = 0;
            if (!p.mastery) p.mastery = [];
            if (p.charm === undefined) p.charm = null;
            if (p.equipment && p.equipment.charm === undefined) p.equipment.charm = null;
            recalculateStats(p);
        });

        inventory.gold = s.inventory.gold || 0;
        inventory.ore  = s.inventory.ore ?? 0;
        inventory.consumables = s.inventory.consumables;
        inventory.bag  = s.inventory.bag || [];
        itemIdCounter  = s.itemIdCounter || 1;

        map         = s.map;
        revealed    = s.revealed;
        stairs      = s.stairs;
        enemies     = s.enemies || [];
        chests      = s.chests || [];
        lootDrops   = s.lootDrops || [];
        traps       = s.traps || [];
        shrine      = s.shrine || null;
        merchant    = s.merchant || null;
        campfire    = s.campfire || null;
        floorBounty = s.floorBounty || null;
        floorModifier = s.floorModifier || null;
        if (typeof setRunSeed === 'function') setRunSeed(s.runSeed || null);
        if (typeof torchUpgradeLevel !== 'undefined') torchUpgradeLevel = s.torchUpgradeLevel || 0;

        gameMode = 'EXPLORE';
        activeEnemy = null;
        turnQueue = [];
        activeSaveSlot = targetSlot;
        return true;
    } catch (err) {
        return false;
    }
}

function clearSavedGame() {
    localStorage.removeItem(SAVE_STORAGE_KEY);
}

function triggerAscension(chosenMod = null) {
    if (currentFloor < 10) return;
    if (!chosenMod && typeof openAscensionModal === 'function') {
        openAscensionModal();
        return;
    }
    ascensionModifier = chosenMod || 'empowered';
    ascensionLevel++;
    saveCodexData();
    SFX.levelup();

    party.forEach(p => {
        p.baseMaxHp = Math.floor(p.baseMaxHp * 1.25);
        p.basePatk  = Math.floor(p.basePatk * 1.25);
        p.baseMatk  = Math.floor(p.baseMatk * 1.25);
        p.baseDef   = Math.floor(p.baseDef * 1.25);
        p.perkPoints += (ascensionModifier === 'frugal') ? 2 : 1;
        recalculateStats(p);
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        p.overdrive = 100;
        p.statuses = { poison: 0, burn: 0, stun: 0 };
    });

    if (typeof recordRunHistory === 'function') recordRunHistory();
    if (typeof checkAchievements === 'function') checkAchievements();
    currentFloor = 1;
    torchLight = 100;
    gameMode = 'EXPLORE';
    activeEnemy = null;
    turnQueue = [];

    resetPartyPosition();
    generateFloor();
    updateFogOfWar(party[0].x, party[0].y);
    saveGameProgress();
    updateModeUI();
    updateUI();
    drawGame();
    if (typeof showFloorTransition === 'function') {
        showFloorTransition(currentFloor, `ASCENSION CYCLE LV.${ascensionLevel} BEGINS`);
    }
    addLog(`🌟 ASCENSION LV.${ascensionLevel} AKTIF! Kembali ke Lantai 1 dengan +25% Base Stats & Overdrive Penuh!`);
}

function resetGameRun() {
    clearSavedGame();
    hallOfFame.totalRuns = (hallOfFame.totalRuns || 1) + 1;
    saveCodexData();

    ascensionLevel = 0;
    torchLight = 100;
    sharpenedBuff = false;
    party = JSON.parse(JSON.stringify(INITIAL_PARTY_TEMPLATE));
    inventory.gold = 0;
    inventory.ore = 0;
    inventory.consumables = {
        potion: 0, hi_potion: 0, energy_potion: 0, torch_oil: 0, revive: 0, elixir: 0, tonic: 0
    };
    inventory.bag = [];
    currentFloor = 1;
    gameMode = 'EXPLORE';
    activeEnemy = null;
    turnQueue = [];

    if (typeof closeAllModals === 'function') closeAllModals();

    generateFloor();
    updateFogOfWar(party[0].x, party[0].y);
    saveGameProgress();
    updateModeUI();
    setCombatButtons(true);
    updateUI();
    drawGame();
    addLog(`🔄 RUN DIRESET! Memulai Ekspedisi ke-${hallOfFame.totalRuns}. (Rekor Hall of Fame & Bestiary tetap tersimpan di Codex [C]!)`);
}


// =========================================================
// SEED MODAL, SAVE ARCHIVES, HOVER TOOLTIP, PAUSE & SHAKE
// =========================================================
function promptSetSeed() {
    toggleDialogById('seed-modal', () => {
        const inp = document.getElementById('seed-input-field');
        if (inp) inp.value = (typeof runSeed !== 'undefined' && runSeed) ? runSeed : '';
    });
}

function applySeedPreset(mode) {
    if (mode === 'daily') {
        const d = new Date();
        setRunSeed(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    } else {
        setRunSeed(null);
        addLog('Mode normal aktif: tata letak ruang bawah tanah kembali acak.');
    }
    closeDialogById('seed-modal');
    updateUI();
}

function submitSeedModal(e) {
    if (e) e.preventDefault();
    const inp = document.getElementById('seed-input-field');
    const v = inp ? inp.value.trim() : '';
    if (v.toLowerCase() === 'daily') {
        applySeedPreset('daily');
        return;
    }
    if (v === '') {
        applySeedPreset('random');
        return;
    }
    setRunSeed(v);
    closeDialogById('seed-modal');
    updateUI();
}

function toggleSaveSlotModal() {
    toggleDialogById('save-slot-modal', renderSaveSlotModal);
}

function renderSaveSlotModal() {
    const el = document.getElementById('save-slot-list');
    if (!el) return;
    let html = '';
    for (let i = 1; i <= 3; i++) {
        const raw = localStorage.getItem('endless_dungeon_save_v2_slot_' + i);
        let info = 'Empty Archive';
        if (raw) {
            try {
                const s = JSON.parse(raw);
                let partyInfo = '';
                if (s.party && s.party.length) {
                    const avgLv = Math.round(s.party.reduce((a, p) => a + (p.level || 1), 0) / s.party.length);
                    const totalHp = s.party.reduce((a, p) => a + (p.hp || 0), 0);
                    const totalMax = s.party.reduce((a, p) => a + (p.maxHp || 0), 0);
                    partyInfo = ` · HP ${totalHp}/${totalMax} · Lv~${avgLv}`;
                }
                info = `Floor ${s.currentFloor || '?'} · Asc ${s.ascensionLevel || 0}${partyInfo}`;
            } catch (e) { info = 'Corrupted Seal'; }
        }
        const active = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot === i) ? ' <span style="color:#92c4a4;">(Active)</span>' : '';
        html += `
        <div class="bag-item-row">
            <div><b>Archive Slot ${i}${active}</b><div class="item-buff-text">${info}</div></div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-use" onclick="saveToSlot(${i})">Inscribe</button>
                <button type="button" class="btn-small-equip" onclick="loadFromSlot(${i})">Restore</button>
                <button type="button" class="btn-small-unequip" onclick="deleteSlot(${i})">Erase</button>
            </div>
        </div>`;
    }
    el.innerHTML = html;
}

function saveToSlot(n) {
    if (typeof saveGameProgress === 'function') saveGameProgress(n);
    renderSaveSlotModal();
    updateUI();
}

function loadFromSlot(n) {
    const raw = localStorage.getItem('endless_dungeon_save_v2_slot_' + n);
    if (!raw) { addLog(`Archive Slot ${n} masih kosong.`); return; }
    if (typeof loadGameProgress === 'function' && loadGameProgress(n)) {
        activeSaveSlot = n;
        addLog(`Memulihkan ekspedisi dari Archive Slot ${n}.`);
        closeDialogById('save-slot-modal');
        updateModeUI();
        updateUI();
        drawGame();
    }
}

function deleteSlot(n) {
    localStorage.removeItem('endless_dungeon_save_v2_slot_' + n);
    if (activeSaveSlot === n) activeSaveSlot = null;
    renderSaveSlotModal();
    addLog(`Catatan pada Archive Slot ${n} telah dihapus.`);
}

function exportSave() {
    const ta = document.getElementById('save-io-text');
    if (!ta) return;
    const key = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot)
        ? ('endless_dungeon_save_v2_slot_' + activeSaveSlot)
        : 'endless_dungeon_save_v2';
    ta.value = localStorage.getItem(key) || '';
    addLog('Data ekspedisi diekspor ke kotak teks JSON.');
}

function importSave() {
    const ta = document.getElementById('save-io-text');
    if (!ta || !ta.value.trim()) return;
    try {
        const obj = JSON.parse(ta.value.trim());
        const key = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot)
            ? ('endless_dungeon_save_v2_slot_' + activeSaveSlot)
            : 'endless_dungeon_save_v2';
        localStorage.setItem(key, JSON.stringify(obj));
        loadGameProgress(activeSaveSlot);
        closeDialogById('save-slot-modal');
        updateModeUI();
        updateUI();
        drawGame();
        addLog('Data ekspedisi berhasil diimpor dan dimuat.');
    } catch (e) {
        addLog('Format JSON tidak valid: ' + e.message);
    }
}
