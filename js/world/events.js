function chooseCampfireAction(actionType) {
    if (!campfire || campfire.used) return;
    const ldr = getLeader();

    if (actionType === 'rest') {
        torchLight = 100;
        const isFamine = (typeof floorModifier !== 'undefined' && floorModifier === 'famine');
        if (!isFamine) {
            party.forEach(p => {
                if (p.hp > 0) {
                    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.45));
                    p.mp = Math.min(p.maxMp, p.mp + Math.floor(p.maxMp * 0.45));
                    p.statuses = { poison: 0, burn: 0, stun: 0 };
                }
            });
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "RESTORED", "#92c4a4");
            addLog(`PERKEMAHAN: Seluruh Ksatria pulih +45% HP/MP & Obor menyala 100%.`);
        } else {
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "FAMINE", "#c78d44");
            addLog(`PERKEMAHAN: Kutukan Famine mencegah pemulihan raga, namun Obor menyala 100%.`);
        }
    }
    else if (actionType === 'sharpen') {
        sharpenedBuff = true;
        party.forEach(p => { if (p.hp > 0) p.overdrive = Math.min(100, (p.overdrive || 0) + 50); });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+25% DMG", "#e2ceb4");
        addLog(`BATU ASAH: Bilah senjata diberkati (+25% DMG & +50% Overdrive).`);
    }
    else if (actionType === 'scout') {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) revealed[y][x] = true;
        }
        traps.forEach(t => t.detected = true);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "MAP FOUND", "#e2ceb4");
        addLog(`PENGINTAIAN: Seluruh lorong, musuh, dan jebakan di lantai ini terpetakan.`);
    }
    else if (actionType === 'upgrade_torch') {
        const costOre = 3;
        const costGold = 50;
        if (inventory.ore < costOre || inventory.gold < costGold) {
            addLog(`Butuh ${costOre} Ore & ${costGold} Gold untuk menempa Obor Abadi.`);
            return;
        }
        inventory.ore -= costOre;
        inventory.gold -= costGold;
        torchUpgradeLevel = (torchUpgradeLevel || 0) + 1;
        torchLight = 100;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, 'TORCH FORGED', '#e2ceb4');
        addLog(`OBOR ABADI LV.${torchUpgradeLevel}: Konsumsi obor per langkah berkurang & obor terisi penuh.`);
    }

    campfire.used = true;
    SFX.shrine();
    closeCampfireModal();
    updateUI();
    drawGame();
}

function spawnAltarGuardians() {
    const ldr = (typeof getLeader === 'function') ? getLeader() : null;
    if (!ldr) return;

    const ascMult = 1 + (ascensionLevel * 0.35);
    const free = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const x = ldr.x + dx, y = ldr.y + dy;
            if (!map[y] || map[y][x] !== 0) continue;
            if (typeof isTileOccupied === 'function' && isTileOccupied(x, y)) continue;
            free.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
        }
    }
    free.sort((a, b) => a.dist - b.dist);

    if (free.length < 2) {
        torchLight = 100;
        party.forEach(p => {
            if (p.hp > 0) { p.hp = Math.min(p.maxHp, p.hp + 30); p.mp = Math.min(p.maxMp, p.mp + 25); p.statuses = { poison: 0, burn: 0, stun: 0 }; }
        });
        if (ldr) { updateFogOfWar(ldr.x, ldr.y); addOverheadIcon(ldr.x, ldr.y, "BLESSED", "#e2ceb4"); }
        addLog("Altar terlalu sempit untuk memanggil penjaga. Berkah Katedral diberikan sebagai gantinya.");
        return;
    }

    const guardians = [];
    for (let i = 0; i < 2; i++) {
        const pos = free[i];
        const hp = Math.floor((70 + currentFloor * 20) * ascMult);
        const g = {
            name: `Altar Guardian ${i + 1} [Lv.${currentFloor}]`,
            x: pos.x, y: pos.y, hp, maxHp: hp,
            atk: Math.floor((11 + currentFloor * 3) * ascMult),
            def: 3 + Math.floor(currentFloor * 0.9),
            spd: 12 + Math.floor(currentFloor / 3) + i,
            color: "#9d72c4", isEnemy: true, isBoss: false, bossTier: 0,
            isElite: true, affix: null,
            statuses: { burn: 0, stun: 0, break: 0 }
        };
        revealed[pos.y][pos.x] = true;
        enemies.push(g);
        guardians.push(g);
        addOverheadIcon(pos.x, pos.y, "GUARDIAN", "#ad85cc");
    }
    addLog("TANTANGAN ALTAR: Dua Altar Guardian (Elite) bangkit menjaga monolit!");
    startCombat(guardians[0]);
}

function chooseShrineBlessing(optionType) {
    if (!shrine || shrine.used) return;
    const ldr = getLeader();

    if (optionType === 'blood') {
        party.forEach(p => {
            if (p.hp > 0) p.hp = Math.max(1, Math.floor(p.hp * 0.70));
        });
        const legGear = (rng() < 0.60) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');
        inventory.bag.push(legGear);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "CURSED RELIC", "#cf5b64");
        addLog(`SUMPAH DARAH: Mengorbankan 30% darah Ksatria & memperoleh pusaka [${legGear.name}].`);
    }
    else if (optionType === 'wisdom') {
        const wisdomCost = 40 + (currentFloor * 10);
        if (inventory.gold < wisdomCost) {
            addLog(`Butuh minimal ${wisdomCost} Gold untuk persembahan Altar Kebijaksanaan.`);
            return;
        }
        inventory.gold -= wisdomCost;
        gainPartyXP(75 + currentFloor * 15, ldr);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+ANCIENT EXP", "#8eb5d9");
        addLog(`ALTAR KEBIJAKSANAAN: Mempersembahkan ${wisdomCost} Gold untuk pengetahuan kuno.`);
    }
    else if (optionType === 'radiance') {
        torchLight = 100;
        party.forEach(p => {
            if (p.hp > 0) {
                p.hp = Math.min(p.maxHp, p.hp + 30);
                p.mp = Math.min(p.maxMp, p.mp + 25);
                p.statuses = { poison: 0, burn: 0, stun: 0 };
            }
        });
        if (ldr) {
            updateFogOfWar(ldr.x, ldr.y);
            addOverheadIcon(ldr.x, ldr.y, "SANCTIFIED", "#e2ceb4");
        }
        addLog(`BERKAH KATEDRAL: Obor 100%, seluruh Ksatria pulih +30 HP, +25 MP & bebas kutukan.`);
    }
    else if (optionType === 'trial') {
        if (gameMode !== 'EXPLORE') return;
        shrine.used = true;
        SFX.shrine();
        closeShrineModal();
        spawnAltarGuardians();
        updateUI();
        drawGame();
        return;
    }
    else if (optionType === 'memory') {
        shrine.used = true;
        party.forEach(p => { if (p.hp > 0) p.statPoints = (p.statPoints || 0) + 1; });
        addLog('SHRINE OF MEMORY: Seluruh Ksatria hidup menerima +1 Stat Point kuno.');
        if (ldr) addOverheadIcon(ldr.x, ldr.y, '+1 STAT PT', '#8eb5d9');
        SFX.shrine();
        closeShrineModal();
        updateUI();
        drawGame();
        return;
    }

    shrine.used = true;
    SFX.shrine();
    closeShrineModal();
    updateUI();
    drawGame();
}

function ensureMerchantInventory() {
    if (!merchant) return;
    if (merchant.stock && merchant.stock.length > 0) return;

    const ascFactor = 1 + (ascensionLevel * 0.25);
    const calcPrice = (base, perFloor) => Math.floor((base + (currentFloor - 1) * perFloor) * ascFactor);

    const gear1 = generateRandomEquipment(currentFloor, 'Rare');
    const gear2 = (rng() < 0.35) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');

    const getGearPrice = (g) => {
        let rarityBase = 45;
        if (g.rarity === 'Rare') rarityBase = 75;
        else if (g.rarity === 'Epic') rarityBase = 115;
        else if (g.rarity === 'Legendary' || g.rarity === 'Cursed') rarityBase = 155;
        return calcPrice(rarityBase, 10);
    };

    merchant.stock = [
        { id: 'potion', name: `${icon('satchel', 13)} Herbal Draught`, desc: "Memulihkan +35 HP & menyembuhkan status Poison Party.", cost: calcPrice(20, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'energy_potion', name: `${icon('bolt', 13)} Astral Vial`, desc: "Memulihkan +30 Energi (MP) ke seluruh anggota Party.", cost: calcPrice(25, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'torch_oil', name: `${icon('torch', 13)} Pitch Torch Oil`, desc: "Mengisi ulang cahaya Obor (Torch) +60% agar jarak pandang terang.", cost: calcPrice(15, 4), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'forge_ore', name: `${icon('ingot', 13)} Damascus Iron Ore (x2)`, desc: "2x Bijih Besi Tempa untuk menaikkan level (+1, +2) Zirah Ksatria.", cost: calcPrice(30, 6), stock: 2, maxStock: 2, type: 'ore' },
        { id: 'revive', name: `${icon('feather', 13)} Phoenix Pinion`, desc: "Membangkitkan 1 Ksatria yang gugur dengan 50% Max HP.", cost: calcPrice(60, 8), stock: 1, maxStock: 1, type: 'consumable' },
        {
            id: 'specific_gear_1',
            name: `${EQUIP_SLOTS[gear1.slot].icon} ${gear1.name}`,
            rarity: gear1.rarity, slotLabel: EQUIP_SLOTS[gear1.slot].label,
            desc: `Attributes: ${formatItemBuffs(gear1.stats)}`,
            cost: getGearPrice(gear1), stock: 1, maxStock: 1, type: 'specific_gear', gearData: gear1
        },
        {
            id: 'specific_gear_2',
            name: `${EQUIP_SLOTS[gear2.slot].icon} ${gear2.name}`,
            rarity: gear2.rarity, slotLabel: EQUIP_SLOTS[gear2.slot].label,
            desc: `Attributes: ${formatItemBuffs(gear2.stats)}`,
            cost: getGearPrice(gear2), stock: 1, maxStock: 1, type: 'specific_gear', gearData: gear2
        }
    ];
}

function buyMerchantItem(shopIdx) {
    if (!merchant || !merchant.stock) return;
    const item = merchant.stock[shopIdx];
    if (!item || item.stock <= 0 || inventory.gold < item.cost) return;

    inventory.gold -= item.cost;
    item.stock--;
    SFX.pickup();
    const ldr = getLeader();

    if (item.type === 'consumable') {
        addConsumableToBackpack(item.id, 1);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+SUPPLY", "#92c4a4");
    } else if (item.type === 'ore') {
        inventory.ore += 2;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+2 ORE", "#8eb5d9");
        addLog(`CARAVAN: Membeli +2x Damascus Iron Ore seharga ${item.cost} Gold.`);
    } else if (item.type === 'specific_gear' && item.gearData) {
        const g = item.gearData;
        inventory.bag.push(g);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+ARMOR", "#e2ceb4");
        addLog(`CARAVAN: Membeli zirah [${g.name}] ke Armory [E].`);
    }

    updateUI();
    renderMerchantModal();
}

function rerollMerchantStock() {
    if (!merchant || merchant.rerolled) return;
    const cost = 35 + currentFloor * 8;
    if (inventory.gold < cost) return;
    inventory.gold -= cost;
    merchant.rerolled = true;
    merchant.stock = [];
    ensureMerchantInventory();
    SFX.pickup();
    addLog(`CARAVAN: Stok dagangan diperbarui (${cost} Gold).`);
    updateUI();
    renderMerchantModal();
}
