const inventory = {
    gold: 0,
    ore: 0,
    consumables: {
        potion: 0, hi_potion: 0, energy_potion: 0, torch_oil: 0, revive: 0, elixir: 0, tonic: 0
    },
    bag: []
};

let itemIdCounter = 1;
function getTotalBackpackCount() {
    return Object.values(inventory.consumables).reduce((sum, qty) => sum + qty, 0);
}

function addConsumableToBackpack(itemKey, qty = 1) {
    if (inventory.consumables[itemKey] === undefined) inventory.consumables[itemKey] = 0;
    inventory.consumables[itemKey] += qty;
    const meta = CONSUMABLE_CATALOG[itemKey];
    if (meta) {
        addLog(`🎒 Masuk ke Satchel: +${qty}x ${meta.icon} [${meta.name}]!`);
    }
    updateUI();
}

function useBackpackItem(itemKey) {
    const qty = inventory.consumables[itemKey] || 0;
    const meta = CONSUMABLE_CATALOG[itemKey];

    if (qty <= 0 || !meta) {
        addLog(`❌ Stok ${meta ? meta.name : 'Item'} di Satchel habis!`);
        return false;
    }

    const activeActor = getCurrentActor();
    if (gameMode === 'COMBAT' && activeActor && activeActor.isEnemy) {
        addLog(`⏳ Tunggu giliran ksatriamu untuk menggunakan ramuan!`);
        return false;
    }

    const ldr = getLeader();

    if (itemKey === 'potion' || itemKey === 'hi_potion') {
        const healVal = (itemKey === 'hi_potion') ? 75 : 35;
        inventory.consumables[itemKey]--;
        SFX.potion();
        party.forEach(p => {
            if (p.hp > 0) {
                p.hp = Math.min(p.maxHp, p.hp + healVal);
                p.statuses.poison = 0;
            }
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `❤️+${healVal} HP`, "#2ecc71");
        addLog(`${meta.icon} Menggunakan [${meta.name}]! HP Party pulih +${healVal} & racun sembuh.`);
    } 
    else if (itemKey === 'energy_potion') {
        inventory.consumables.energy_potion--;
        SFX.potion();
        party.forEach(p => {
            if (p.hp > 0) p.mp = Math.min(p.maxMp, p.mp + 30);
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `⚡+30 MP`, "#00ffff");
        addLog(`⚡ Menggunakan [Mana Vial]! Energi seluruh Party pulih +30 MP.`);
    }
    else if (itemKey === 'torch_oil') {
        inventory.consumables.torch_oil--;
        SFX.shrine();
        torchLight = Math.min(100, torchLight + 60);
        if (ldr) {
            updateFogOfWar(ldr.x, ldr.y);
            addOverheadIcon(ldr.x, ldr.y, `🔥+60% Light`, "#f39c12");
        }
        addLog(`🔥 Menggunakan [Pitch Torch Oil]! Cahaya Obor kembali terang (${torchLight}%).`);
    }
    else if (itemKey === 'revive') {
        const fallenHero = party.find(p => p.hp <= 0);
        if (!fallenHero) {
            addLog(`ℹ️ Tidak ada anggota party yang gugur saat ini!`);
            return false;
        }
        inventory.consumables.revive--;
        SFX.revive();

        fallenHero.hp = Math.floor(fallenHero.maxHp * 0.5);
        fallenHero.mp = Math.floor(fallenHero.maxMp * 0.5);
        fallenHero.defending = false;
        fallenHero.statuses = { poison: 0, burn: 0, stun: 0 };
        if (ldr) {
            fallenHero.x = ldr.x;
            fallenHero.y = ldr.y;
            addOverheadIcon(ldr.x, ldr.y, `🪶 REVIVE!`, "#f39c12");
        }
        if (gameMode === 'COMBAT' && !turnQueue.includes(fallenHero)) {
            turnQueue.push(fallenHero);
        }
        addLog(`🪶 Menggunakan [Phoenix Relic]! [${fallenHero.name}] bangkit kembali!`);
    } 
    else if (itemKey === 'elixir') {
        inventory.consumables.elixir--;
        SFX.potion();
        party.forEach(p => {
            p.basePatk += 2;
            p.baseMatk += 2;
            recalculateStats(p);
            if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 25);
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `⚗️+ATK & HP`, "#e056fd");
        addLog(`⚗️ Menggunakan [Battle Elixir]! Party pulih +25 HP & Base P.ATK/M.ATK +2 permanen!`);
    } 
    else if (itemKey === 'tonic') {
        inventory.consumables.tonic--;
        SFX.potion();
        party.forEach(p => {
            p.baseDef += 2;
            p.baseMaxHp += 10;
            recalculateStats(p);
            if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 10);
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `🛡️+DEF & HP`, "#3498db");
        addLog(`🛡️ Menggunakan [Iron Skin Tonic]! Base DEF +2 & Max HP +10 seluruh Party permanen!`);
    }

    updateUI();
    renderBackpackModal();
    drawGame();

    if (gameMode === 'COMBAT') {
        if (typeof closeDialogById === 'function') closeDialogById('backpack-modal');
        nextTurn();
    }
    return true;
}

// Membuat Pusaka Terkutuk (Cursed Relic) Spesifik
function generateCursedRelic(floor) {
    const keys = Object.keys(CURSED_RELIC_CATALOG);
    const chosenKey = keys[Math.floor(rng() * keys.length)];
    const meta = CURSED_RELIC_CATALOG[chosenKey];
    const scale = Math.max(1, Math.floor(1 + floor * 0.4 + ascensionLevel * 0.6));

    const stats = {};
    if (chosenKey === 'berserker_ring') {
        stats.patk = 7 * scale;
        stats.spd = 3;
    } else if (chosenKey === 'void_crown') {
        stats.matk = 8 * scale;
        stats.mp = 15 * scale;
    } else if (chosenKey === 'titan_shackles') {
        stats.hp = 25 * scale;
        stats.def = 5 * scale;
    } else if (chosenKey === 'greed_idol') {
        stats.hp = 12 * scale;
        stats.patk = 4 * scale;
        stats.matk = 4 * scale;
    }

    return {
        id: itemIdCounter++,
        name: `Cursed ${meta.baseName}`,
        slot: 'artifact',
        rarity: 'Cursed',
        curseId: chosenKey,
        boonDesc: meta.boonDesc,
        curseDesc: meta.curseDesc,
        upgradeLevel: 0,
        stats: stats
    };
}

function generateRandomEquipment(floor, minRarity = null) {
    if (minRarity === 'Cursed') {
        return generateCursedRelic(floor);
    }

    const slotKeys = ['helm', 'armor', 'pants', 'boots', 'artifact'];
    const slot = slotKeys[Math.floor(rng() * slotKeys.length)];

    // Peluang 18% menghasilkan Cursed Relic saat roll jatuh pada slot Artifact
    if (slot === 'artifact' && rng() < 0.18) {
        return generateCursedRelic(floor);
    }

    const voidBonus = (getCurrentBiome().id === 'void') ? 0.08 : 0;
    const roll = rng() + voidBonus;
    let rarity = 'Common', mult = 1;

    if (minRarity === 'Legendary') {
        rarity = 'Legendary'; mult = 2.3;
    } else if (minRarity === 'Epic') {
        if (roll > 0.65) { rarity = 'Legendary'; mult = 2.3; }
        else { rarity = 'Epic'; mult = 1.7; }
    } else if (minRarity === 'Rare') {
        if (roll > 0.80) { rarity = 'Legendary'; mult = 2.2; }
        else if (roll > 0.45) { rarity = 'Epic'; mult = 1.6; }
        else { rarity = 'Rare'; mult = 1.35; }
    } else {
        if (roll > 0.90) { rarity = 'Legendary'; mult = 2.2; }
        else if (roll > 0.72) { rarity = 'Epic'; mult = 1.6; }
        else if (roll > 0.45) { rarity = 'Rare'; mult = 1.3; }
    }

    const scale = Math.max(1, Math.floor((1 + floor * 0.35 + ascensionLevel * 0.5) * mult));
    const stats = {};
    let baseName = "";

    // Tetapkan Afiliasi Equipment Set untuk Helm, Armor, Pants, & Boots (Dijamin pada Rare ke atas, 40% pada Common)
    let setId = null;
    if (slot !== 'artifact' && (rarity !== 'Common' || rng() < 0.40)) {
        const setKeys = Object.keys(EQUIPMENT_SETS);
        setId = setKeys[Math.floor(rng() * setKeys.length)];
    }

    if (slot === 'helm') {
        const names = ["Iron Greathelm", "Crusader Visor", "Crown of Wisdom", "Mystic Circlet"];
        baseName = names[Math.floor(rng() * names.length)];
        stats.hp = 10 * scale;
        stats.def = 2 * scale;
        stats.mp = 5 * scale;
    } else if (slot === 'armor') {
        const names = ["Plate Cuirass", "Dragon Scale Mail", "Archmage Robe", "Templar Hauberk"];
        baseName = names[Math.floor(rng() * names.length)];
        stats.hp = 18 * scale;
        stats.def = 3 * scale;
        if (rng() < 0.5) stats.matk = 2 * scale;
    } else if (slot === 'pants') {
        const names = ["Chainmail Greaves", "Ranger Leggings", "Silk Trousers", "Templar Tassets"];
        baseName = names[Math.floor(rng() * names.length)];
        stats.hp = 10 * scale;
        stats.def = 2 * scale;
        stats.spd = Math.max(1, Math.floor(1 * mult));
    } else if (slot === 'boots') {
        const names = ["Winged Sabatons", "Assassin Treads", "Iron Greaves", "Windwalkers"];
        baseName = names[Math.floor(rng() * names.length)];
        stats.spd = Math.max(1, Math.floor(2 * mult) + Math.floor(floor / 3));
        stats.patk = 2 * scale;
    } else if (slot === 'artifact') {
        const names = ["Blood Chalice", "Holy Rosary", "Signet of Kings", "Chrono Hourglass"];
        baseName = names[Math.floor(rng() * names.length)];
        if (rng() < 0.5) {
            stats.patk = 5 * scale;
        } else {
            stats.matk = 5 * scale;
            stats.mp = 8 * scale;
        }
        stats.spd = Math.max(1, Math.floor(1.5 * mult));
    }

    const setPrefix = setId ? `[${EQUIPMENT_SETS[setId].name.split("'")[0]}] ` : "";

    return {
        id: itemIdCounter++,
        name: `${setPrefix}${rarity} ${baseName}`,
        slot: slot,
        rarity: rarity,
        setId: setId,
        upgradeLevel: 0,
        stats: stats
    };
}

function formatItemBuffs(stats) {
    const parts = [];
    if (stats.hp)   parts.push(`+${stats.hp} HP`);
    if (stats.mp)   parts.push(`+${stats.mp} MP`);
    if (stats.patk) parts.push(`+${stats.patk} P.ATK`);
    if (stats.matk) parts.push(`+${stats.matk} M.ATK`);
    if (stats.def)  parts.push(`+${stats.def} DEF`);
    if (stats.spd)  parts.push(`+${stats.spd} SPD`);
    return parts.join(', ');
}

function upgradeEquippedItem(heroIndex, slotKey) {
    const hero = party[heroIndex];
    if (!hero) return;
    const item = hero.equipment[slotKey];
    if (!item) return;

    const upgLv = item.upgradeLevel || 0;
    const costOre  = 1 + upgLv;
    const costGold = 25 + (upgLv * 20);

    if (inventory.ore < costOre || inventory.gold < costGold) {
        addLog(`❌ Bahan tempa kurang! Butuh ${costOre} ⚒️Ore & ${costGold} 💰Gold.`);
        return;
    }

    inventory.ore  -= costOre;
    inventory.gold -= costGold;
    item.upgradeLevel = upgLv + 1;

    Object.keys(item.stats).forEach(k => {
        if (k === 'spd') item.stats[k] += 1;
        else item.stats[k] += Math.max(2, Math.floor(item.stats[k] * 0.22));
    });

    SFX.forge();
    recalculateStats(hero);
    if (gameMode === 'COMBAT') refreshTurnQueueKeepingActor();
    addLog(`⚒️ FORGE SUCCESS! [${item.name}] ditempa menjadi +${item.upgradeLevel}!`);
    updateUI();
    renderEquipModal();
}

function dismantleBagItem(bagIndex) {
    const item = inventory.bag[bagIndex];
    if (!item) return;

    let oreGain = 1;
    let goldGain = 10;
    if (item.rarity === 'Rare') { oreGain = 2; goldGain = 20; }
    else if (item.rarity === 'Epic') { oreGain = 3; goldGain = 35; }
    else if (item.rarity === 'Legendary' || item.rarity === 'Cursed') { oreGain = 5; goldGain = 65; }

    inventory.ore  += oreGain;
    inventory.gold += goldGain;
    inventory.bag.splice(bagIndex, 1);

    SFX.forge();
    addLog(`🔨 DISMANTLE: Melebur [${item.name}] menjadi +${oreGain} ⚒️Ore & +${goldGain} 💰Gold!`);
    updateUI();
    renderEquipModal();
}

function dismantleAllCommon() {
    const commons = inventory.bag.filter(i => i.rarity === 'Common');
    if (commons.length === 0) {
        addLog(`ℹ️ Tidak ada equipment Common di dalam peti untuk dilebur.`);
        return;
    }
    const count = commons.length;
    inventory.bag = inventory.bag.filter(i => i.rarity !== 'Common');
    inventory.ore  += count;
    inventory.gold += count * 10;

    SFX.forge();
    addLog(`🔨 MASS DISMANTLE: Melebur ${count}x Common Gear menjadi +${count} ⚒️Ore & +${count * 10} 💰Gold!`);
    updateUI();
    renderEquipModal();
}

// =========================================================
// JUAL EQUIPMENT KE MERCHANT
// =========================================================
function getItemSellValue(item) {
    if (!item) return 0;
    let baseCost = 45;
    if (item.rarity === 'Rare') baseCost = 75;
    else if (item.rarity === 'Epic') baseCost = 115;
    else if (item.rarity === 'Legendary' || item.rarity === 'Cursed') baseCost = 155;
    baseCost += (currentFloor - 1) * 10;
    const upgradeBonus = (item.upgradeLevel || 0) * 15;
    return Math.max(5, Math.floor(baseCost * 0.45) + upgradeBonus);
}

function sellBagItem(bagIndex) {
    const item = inventory.bag[bagIndex];
    if (!item) return;
    const price = getItemSellValue(item);
    inventory.bag.splice(bagIndex, 1);
    inventory.gold += price;
    SFX.pickup();
    addLog(`💰 PEDAGANG: Menjual [${item.name}] seharga ${price} Gold.`);
    saveGameProgress();
    updateUI();
    if (typeof renderMerchantModal === 'function') renderMerchantModal();
}

function equipItemToHero(bagIndex, heroIndex) {
    const item = inventory.bag[bagIndex];
    const hero = party[heroIndex];
    if (!item || !hero) return;

    const currentEquipped = hero.equipment[item.slot];
    if (currentEquipped) inventory.bag.push(currentEquipped);

    hero.equipment[item.slot] = item;
    inventory.bag.splice(bagIndex, 1);

    SFX.equip();
    recalculateStats(hero);

    if (item.curseId) {
        addLog(`💀 CURSED RELIC DIPASANG! [${hero.name}] mengenakan [${item.name}] — ${item.boonDesc} | ${item.curseDesc}`);
    } else {
        addLog(`🛡️ [${hero.name}] memasang ${EQUIP_SLOTS[item.slot].icon} ${item.name}!`);
    }

    if (gameMode === 'COMBAT') refreshTurnQueueKeepingActor();
    updateUI();
    renderEquipModal();
}

function unequipItemFromHero(heroIndex, slotKey) {
    const hero = party[heroIndex];
    if (!hero) return;
    const item = hero.equipment[slotKey];
    if (!item) return;

    inventory.bag.push(item);
    hero.equipment[slotKey] = null;

    SFX.equip();
    recalculateStats(hero);
    addLog(`🎒 [${hero.name}] melepas ${item.name} ke dalam peti zirah.`);

    if (gameMode === 'COMBAT') refreshTurnQueueKeepingActor();
    updateUI();
    renderEquipModal();
}

function spawnEnemyLoot(enemy) {
    let lootData = {
        x: enemy.x, y: enemy.y, category: '', itemType: '', amount: 0, gear: null, bonusItems: []
    };

    if (enemy.isMimic) {
        lootData.category = 'equipment';
        lootData.gear = (rng() < 0.25) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Rare');
        lootData.bonusItems = ['potion', 'torch_oil'];
        inventory.ore += 1;
        addLog(`📦 MIMIC DIKALAHKAN! Dapat +1 ⚒️Ore & Kantong Harta di lantai!`);
        lootDrops.push(lootData);
        return;
    }

    if (enemy.isElite) {
        lootData.category = 'equipment';
        lootData.gear = (rng() < 0.20) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');
        lootData.bonusItems = ['potion', 'energy_potion'];
        inventory.ore += 2;
        addLog(`⚔️ ELITE [${enemy.name}] DIKALAHKAN! Dapat +2 ⚒️Ore & Kantong Zirah Epic di lantai!`);
        lootDrops.push(lootData);
        return;
    }

    if (enemy.isBoss && enemy.bossTier === 10) {
        lootData.category = 'equipment';
        // Boss Lantai 10 berpeluang 40% menjatuhkan Cursed Relic atau Epic Gear
        lootData.gear = (rng() < 0.40) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');
        lootData.bonusItems = ['revive', 'hi_potion', 'torch_oil'];
        inventory.ore += 3;
        addLog(`👑 DREAD LORD DIKALAHKAN! Dapat +3 ⚒️Ore & Kantong Drop Boss di lantai!`);
        lootDrops.push(lootData);
        return;
    }

    if (enemy.isBoss && enemy.bossTier === 5) {
        lootData.category = 'equipment';
        lootData.gear = (rng() < 0.25) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Rare');
        lootData.bonusItems = ['potion', 'torch_oil'];
        inventory.ore += 1;
        addLog(`🔥 MINI-BOSS WARDEN DIKALAHKAN! Dapat +1 ⚒️Ore & Kantong Drop di lantai!`);
        lootDrops.push(lootData);
        return;
    }

    const roll = rng();
    if (roll < 0.38) {
        lootData.category = 'equipment';
        lootData.gear = generateRandomEquipment(currentFloor);
        addLog(`🎁 ${enemy.name} menjatuhkan Kantong Zirah di lantai!`);
    } else if (roll < 0.80) {
        lootData.category = 'item';
        const itemRoll = rng();
        if (itemRoll < 0.28) lootData.itemType = 'potion';
        else if (itemRoll < 0.50) lootData.itemType = 'energy_potion';
        else if (itemRoll < 0.70) lootData.itemType = 'torch_oil';
        else if (itemRoll < 0.82) lootData.itemType = 'hi_potion';
        else if (itemRoll < 0.91) lootData.itemType = 'revive';
        else lootData.itemType = 'elixir';

        addLog(`🎁 ${enemy.name} menjatuhkan Kantong Perbekalan di lantai!`);
    } else {
        lootData.category = 'gold';
        lootData.amount = (20 + (currentFloor * 12) + Math.floor(rng() * 20)) * ((typeof floorModifier !== 'undefined' && floorModifier === 'gilded') ? 2 : 1);
        if (typeof ascensionModifier !== 'undefined' && ascensionModifier === 'frugal') lootData.amount = Math.floor(lootData.amount * 0.8);
        addLog(`🎁 ${enemy.name} menjatuhkan Kantong Koin Emas di lantai!`);
    }

    lootDrops.push(lootData);
}
