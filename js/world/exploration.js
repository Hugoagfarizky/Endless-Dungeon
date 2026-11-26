function pickupLootDrop(loot) {
    SFX.pickup();
    const ldr = getLeader();

    if (loot.category === 'equipment' && loot.gear) {
        const g = loot.gear;
        inventory.bag.push(g);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `${EQUIP_SLOTS[g.slot].icon} +Gear!`, g.rarity === 'Cursed' ? "#ff4757" : "#9b59b6");
        addLog(`🎒 LOOT DIAMBIL: ${EQUIP_SLOTS[g.slot].icon} [${g.name}] (${formatItemBuffs(g.stats)}) masuk ke Peti Zirah [E]!`);

        if (loot.bonusItems && loot.bonusItems.length > 0) {
            loot.bonusItems.forEach(itemKey => addConsumableToBackpack(itemKey, 1));
        }
    } else if (loot.category === 'item') {
        const meta = CONSUMABLE_CATALOG[loot.itemType] || CONSUMABLE_CATALOG.potion;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `${meta.icon} +1`, "#2ecc71");
        addConsumableToBackpack(loot.itemType, 1);
    } else if (loot.category === 'gold') {
        inventory.gold += loot.amount;
        hallOfFame.totalGoldEarned += loot.amount;
        saveCodexData();
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `💰+${loot.amount}G`, "#f1c40f");
        addLog(`🎒 LOOT DIAMBIL: Memungut kantong berisi 💰 ${loot.amount} Gold!`);
    }

    lootDrops = lootDrops.filter(d => d !== loot);
    updateUI();
}

function openChest(chest) {
    chest.opened = true;
    hallOfFame.chestsOpened = (hallOfFame.chestsOpened || 0) + 1;
    saveCodexData();
    if (typeof checkBountyCompletion === 'function') checkBountyCompletion('chest');
    const ldr = getLeader();

    if (chest.isMimic) {
        const ascMult = 1 + (ascensionLevel * 0.35);
        const mimicEnemy = {
            name: `Cursed Mimic [Lv.${currentFloor}]`,
            x: chest.x, y: chest.y,
            hp: Math.floor((95 + currentFloor * 24) * ascMult),
            maxHp: Math.floor((95 + currentFloor * 24) * ascMult),
            atk: Math.floor((14 + currentFloor * 3.5) * ascMult),
            def: 5 + currentFloor,
            spd: 15 + Math.floor(currentFloor / 2),
            color: "#e67e22", isEnemy: true,
            isBoss: false, bossTier: 0, isMimic: true, isElite: true,
            affix: 'vampiric',
            statuses: { burn: 0, stun: 0, break: 0 }
        };
        enemies.push(mimicEnemy);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "📦 MIMIC AMBUSH!", "#ff4757");
        addLog(`🚨 JEBAKAN PETI! Peti harta karun berubah menjadi monster [Cursed Mimic]!`);
        startCombat(mimicEnemy);
        return;
    }

    SFX.chest();
    const roll = rng();
    if (roll < 0.42) {
        const newGear = generateRandomEquipment(currentFloor);
        inventory.bag.push(newGear);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `${EQUIP_SLOTS[newGear.slot].icon} +Equip`, "#9b59b6");
        addLog(`📦 PETI HARTA: Mendapatkan ${EQUIP_SLOTS[newGear.slot].icon} [${newGear.name}]!`);
    } else if (roll < 0.65) {
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `🧪 +1 Draught`, "#2ecc71");
        addConsumableToBackpack('potion', 1);
    } else if (roll < 0.82) {
        inventory.ore += 2;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `⚒️ +2 Ore`, "#00d2ff");
        addLog(`📦 PETI HARTA: Menemukan +2x ⚒️ Damascus Ore untuk menempa Zirah!`);
    } else {
        const foundGold = (25 + (currentFloor * 15)) * ((typeof floorModifier !== 'undefined' && floorModifier === 'gilded') ? 2 : 1);
        inventory.gold += foundGold;
        hallOfFame.totalGoldEarned += foundGold;
        saveCodexData();
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `💰+${foundGold}G`, "#f1c40f");
        addConsumableToBackpack('revive', 1);
        addLog(`📦 PETI JACKPOT: Mendapatkan 💰 ${foundGold} Gold & 1x Phoenix Relic!`);
    }

    updateUI();
}

function triggerFloorTrap(trap) {
    trap.triggered = true;
    trap.detected = true;
    if (typeof checkBountyCompletion === 'function') checkBountyCompletion('trap');
    SFX.trap();
    const ldr = getLeader();

    if (trap.type === 'spike') {
        party.forEach(p => {
            if (p.hp > 0) p.hp = Math.max(1, p.hp - (8 + currentFloor * 2));
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🩸 SPIKE TRAP!", "#ff4757");
        addLog(`⚠️ JEBAKAN PAKU! Seluruh anggota Party terkena tusukan paku lantai!`);
    } 
    else if (trap.type === 'poison') {
        party.forEach(p => {
            if (p.hp > 0) p.statuses.poison = 4;
        });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🤢 POISON GAS!", "#2ecc71");
        addLog(`⚠️ GAS RACUN! Seluruh anggota Party terkena status Poison selama 4 langkah!`);
    } 
    else if (trap.type === 'teleport') {
        // Rune teleport kini selalu memulangkan party ke pintu masuk lantai.
        // Tidak lagi melempar party ke petak acak yang membingungkan.
        const entranceX = 2;
        const entranceY = 2;
        party.forEach(p => { p.x = entranceX; p.y = entranceY; });
        updateFogOfWar(entranceX, entranceY);
        addOverheadIcon(entranceX, entranceY, "🌀 WARP KE PINTU MASUK!", "#00ffff");
        addLog(`🌀 TELEPORT RUNE! Party terlempar kembali ke pintu masuk lantai ini.`);
    }
    updateUI();
}

function moveParty(dx, dy) {
    if (gameMode !== 'EXPLORE') return false;

    const aliveMembers = party.filter(p => p.hp > 0);
    if (aliveMembers.length === 0) return false;

    const leader = aliveMembers[0];
    const nx = leader.x + dx;
    const ny = leader.y + dy;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        SFX.bump();
        return false;
    }

    if (map[ny][nx] === 2) {
        map[ny][nx] = 0;
        SFX.crumble();
        const secretGear = generateRandomEquipment(currentFloor, 'Rare');
        lootDrops.push({
            x: nx, y: ny, category: 'equipment', gear: secretGear, bonusItems: ['potion']
        });
        addOverheadIcon(nx, ny, "SECRET VAULT!", "#ffcc00");
        addLog(`DINDING RAHASIA HANCUR! Kamu menemukan ruang simpanan berisi [${secretGear.name}]!`);
        if (rng() < 0.30) {
            const bonusGold = 20 + currentFloor * 5;
            inventory.gold += bonusGold;
            addLog(`💰 Bonus: +${bonusGold} Gold dari ruang rahasia!`);
        }
        drawGame();
        return false;
    }

    if (map[ny][nx] === 1) {
        SFX.bump();
        return false;
    }

    if (merchant && nx === merchant.x && ny === merchant.y) {
        openMerchantModal();
        return false;
    }

    if (shrine && !shrine.used && nx === shrine.x && ny === shrine.y) {
        openShrineModal();
        return false;
    }

    if (campfire && !campfire.used && nx === campfire.x && ny === campfire.y) {
        openCampfireModal();
        return false;
    }

    const hitEnemy = enemies.find(e => e.x === nx && e.y === ny);
    if (hitEnemy) {
        startCombat(hitEnemy);
        return false;
    }

    // Record smooth walking interpolation & facing direction for realistic stride physics
    for (let i = aliveMembers.length - 1; i > 0; i--) {
        const m = aliveMembers[i];
        const prev = aliveMembers[i - 1];
        m.walkFromX = m.x;
        m.walkFromY = m.y;
        if (prev.x !== m.x) m.facing = prev.x > m.x ? 1 : -1;
        m.x = prev.x;
        m.y = prev.y;
        m.walkProgress = 1.0;
    }
    leader.walkFromX = leader.x;
    leader.walkFromY = leader.y;
    if (dx !== 0) leader.facing = dx > 0 ? 1 : -1;
    leader.x = nx;
    leader.y = ny;
    leader.walkProgress = 1.0;

    if (typeof spawnFootstepDust === 'function') {
        spawnFootstepDust(leader.walkFromX, leader.walkFromY, dx, dy);
    }

    const torchDrain = (getCurrentBiome().id === 'void') ? 3 : 2;
    const modDrain = (typeof floorModifier !== 'undefined' && floorModifier === 'darkness') ? torchDrain * 2 : torchDrain;
    const upgradeReduction = (typeof torchUpgradeLevel !== 'undefined') ? torchUpgradeLevel : 0;
    torchLight = Math.max(0, torchLight - Math.max(1, modDrain - upgradeReduction));

    aliveMembers.forEach(p => {
        if ((p.overdrive || 0) > 50) {
            p.overdrive = Math.max(50, p.overdrive - 1);
        }
        if (p.statuses.poison > 0) {
            p.hp = Math.max(1, p.hp - 3);
            p.statuses.poison--;
        }
    });

    SFX.step();
    updateFogOfWar(leader.x, leader.y);

    // Environmental hazard: chance status saat berjalan di biome tertentu
    const biomeId = (typeof getCurrentBiome === 'function') ? getCurrentBiome().id : '';
    if (biomeId === 'lava' && rng() < 0.20) {
        leader.statuses.burn = Math.max(leader.statuses.burn || 0, 2);
        addLog(`🔥 [ENV] ${leader.name} terkena panas lava! Burn 2 turn.`);
    } else if (biomeId === 'ice' && rng() < 0.15) {
        leader.statuses.stun = Math.max(leader.statuses.stun || 0, 1);
        addLog(`❄️ [ENV] ${leader.name} terpeleset es! Stun 1 turn.`);
    } else if (biomeId === 'crypt' && rng() < 0.25) {
        leader.statuses.poison = Math.max(leader.statuses.poison || 0, 2);
        addLog(`🤢 [ENV] ${leader.name} menghirup gas makam! Poison 2 turn.`);
    }

    const hitTrap = traps.find(t => t.x === leader.x && t.y === leader.y && !t.triggered);
    if (hitTrap) {
        // Trap disarm: hero dengan SPD >= 15 bisa menonaktifkan trap terdeteksi.
        if (hitTrap.detected && (leader.spd || 0) >= 15) {
            hitTrap.triggered = true;
            hitTrap.detected = true;
            traps = traps.filter(t => t !== hitTrap);
            inventory.gold += 5;
            addLog('DISARMED! ' + leader.name + ' menonaktifkan jebakan! +5 Gold.');
            addOverheadIcon(leader.x, leader.y, 'DISARMED!', '#2ecc71');
        } else {
            triggerFloorTrap(hitTrap);
            if (hitTrap.type === 'teleport') {
                saveGameProgress();
                updateUI();
                drawGame();
                return true;
            }
        }
    }

    const foundLoot = lootDrops.find(d => d.x === leader.x && d.y === leader.y);
    if (foundLoot) pickupLootDrop(foundLoot);

    const foundChest = chests.find(c => c.x === leader.x && c.y === leader.y && !c.opened);
    if (foundChest) openChest(foundChest);

    if (leader.x === stairs.x && leader.y === stairs.y && isFloorCleared()) {
        SFX.stairs();
        currentFloor++;
        saveCodexData();
        const biome = getCurrentBiome();
        addLog(`⬇️ Menuruni tangga ke Lantai ${currentFloor} — Memasuki zona [${biome.name}]!`);
        resetPartyPosition();
        generateFloor();
        const currentLeader = getLeader();
        if (currentLeader) updateFogOfWar(currentLeader.x, currentLeader.y);
        if (typeof showFloorTransition === 'function') {
            showFloorTransition(currentFloor);
        }
        updateUI();
    }

    saveGameProgress();
    updateUI();
    drawGame();
    return true;
}
