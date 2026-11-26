let party = JSON.parse(JSON.stringify(INITIAL_PARTY_TEMPLATE));

let floatingPopups = [];
function addOverheadIcon(tileX, tileY, iconText, color = "#dfc484", size = 15) {
    const rawStr = String(iconText);
    const svgKey = (typeof resolveCombatPopupSvgKey === 'function') ? resolveCombatPopupSvgKey(rawStr, color) : null;
    const cleanText = rawStr
        .replace(/<[^>]*>/g, '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleanText) return;
    const jitterX = (Math.random() - 0.5) * 14;
    floatingPopups.push({
        x: tileX,
        y: tileY,
        text: cleanText,
        svgKey: svgKey,
        color: color,
        offsetX: jitterX,
        offsetY: -4,
        vy: -1.45,
        scale: 1.24,
        alpha: 1.0,
        life: 0,
        maxLife: 44,
        size: size
    });
    if (typeof drawGame === 'function') drawGame();
}

function unlockMastery(heroIndex, nodeId) {
    const hero = party[heroIndex];
    if (!hero || !MASTERY_CATALOG[nodeId]) return;
    if (!hero.mastery) hero.mastery = [];
    if (hero.mastery.includes(nodeId)) return;
    if ((hero.perkPoints || 0) <= 0) { addLog('❌ Perk point tidak cukup.'); return; }
    hero.perkPoints--;
    hero.mastery.push(nodeId);
    MASTERY_CATALOG[nodeId].apply(hero);
    addLog('🌟 ' + hero.name + ' menguasai ' + MASTERY_CATALOG[nodeId].name + '!');
    recalculateStats(hero);
    updateUI();
    if (typeof renderEquipModal === 'function') renderEquipModal();
}

function getHeroCharmId(hero) {
    if (!hero || !hero.charm) return null;
    return hero.charm.id || null;
}

function grantRandomCharm(hero) {
    if (!hero) return;
    const keys = Object.keys(CHARM_CATALOG);
    const key = keys[Math.floor(rng() * keys.length)];
    const charm = CHARM_CATALOG[key];
    hero.charm = { id: key, name: charm.name, desc: charm.desc };
    hero.equipment.charm = { slot: 'charm', name: charm.name, rarity: 'Charm', stats: {}, charmId: key, boonDesc: charm.desc };
    // apply stat
    if (key === 'charm_guard') { hero.baseDef = (hero.baseDef||0)+8; hero.def += 8; }
    else if (key === 'charm_haste') { hero.baseSpd = (hero.baseSpd||0)+3; hero.spd += 3; }
    addLog('✨ ' + hero.name + ' menerima ' + charm.name + ' (' + charm.desc + ')');
    if (typeof addOverheadIcon === 'function') addOverheadIcon(hero.x, hero.y, '✨ CHARM!', '#9b59b6');
    if (typeof updateUI === 'function') updateUI();
}

// =========================================================
// PARTY SYNERGY BONUS
// =========================================================
function getPartySynergyBonus() {
    const names = party.filter(p => p.hp > 0).map(p => p.name);
    const has = (n) => names.includes(n);
    let bonus = { patk: 0, matk: 0, def: 0, maxHp: 0, spd: 0 };
    // Tank + Healer
    if (has('Tank') && has('Healer')) { bonus.def += 3; bonus.maxHp += 10; }
    // DPS + Mage
    if (has('DPS') && has('Mage')) { bonus.patk += 2; bonus.matk += 2; }
    // Healer + Mage
    if (has('Healer') && has('Mage')) { bonus.spd += 2; }
    return bonus;
}

function grantRandomRune(hero) {
    if (!hero) return;
    if (!hero.runes) hero.runes = [];
    const keys = Object.keys(RUNE_CATALOG);
    const key = keys[Math.floor(rng() * keys.length)];
    const rune = RUNE_CATALOG[key];
    if (key === 'rune_power') { hero.basePatk = (hero.basePatk||0)+3; hero.baseMatk = (hero.baseMatk||0)+3; hero.patk += 3; hero.matk += 3; }
    else if (key === 'rune_guard') { hero.baseDef = (hero.baseDef||0)+5; hero.def += 5; hero.baseMaxHp = (hero.baseMaxHp||0)+10; hero.maxHp += 10; hero.hp = Math.min(hero.maxHp, hero.hp + 10); }
    else if (key === 'rune_swift') { hero.baseSpd = (hero.baseSpd||0)+2; hero.spd += 2; }
    else if (key === 'rune_mana') { hero.baseMaxMp = (hero.baseMaxMp||0)+10; hero.maxMp += 10; hero.mp = Math.min(hero.maxMp, hero.mp + 10); }
    hero.runes.push(key);
    addLog(`🔮 [RUNE] ${hero.name} menerima ${rune.name}! (${rune.desc})`);
    if (typeof addOverheadIcon === 'function') addOverheadIcon(hero.x, hero.y, "🔮 RUNE!", "#9b59b6");
    if (typeof updateUI === 'function') updateUI();
}

// Menghitung jumlah bagian Set yang sedang dipakai oleh seorang Ksatria
function getHeroActiveSets(hero) {
    const counts = {};
    if (!hero || !hero.equipment) return counts;
    Object.values(hero.equipment).forEach(item => {
        if (item && item.setId && EQUIPMENT_SETS[item.setId]) {
            counts[item.setId] = (counts[item.setId] || 0) + 1;
        }
    });
    return counts;
}

function hasHeroSetBonus(hero, setId, requiredPieces = 2) {
    const counts = getHeroActiveSets(hero);
    return (counts[setId] || 0) >= requiredPieces;
}

function getHeroCursedRelicId(hero) {
    if (!hero || !hero.equipment || !hero.equipment.artifact) return null;
    return hero.equipment.artifact.curseId || null;
}

function gainPartyXP(baseExp, killerHero = null) {
    let expLogs = [];
    let leveledUpHeroes = [];
    let unlockedSkill2 = [];

    // Cek apakah ada anggota hidup yang memakai Cursed Idol of Greed (+45% EXP)
    const hasGreedRelic = party.some(p => p.hp > 0 && getHeroCursedRelicId(p) === 'greed_idol');
    const greedMult = hasGreedRelic ? 1.45 : 1.0;

    party.forEach(hero => {
        if (hero.hp <= 0) return;

        let multiplier = 0.30 + ((hero.combatContrib || 0) * 0.15);
        if (hero === killerHero) multiplier += 0.40;

        const finalXp = Math.max(4, Math.floor(baseExp * multiplier * greedMult));
        hero.xp += finalXp;
        hero.combatContrib = 0;
        expLogs.push(`${hero.name} +${finalXp}XP`);

        while (hero.xp >= hero.maxXp) {
            hero.xp -= hero.maxXp;
            hero.level++;
            hero.maxXp = Math.floor(hero.maxXp * 1.6);
            hero.statPoints += 3;

            if (hero.level % 2 === 1) {
                hero.perkPoints = (hero.perkPoints || 0) + 1;
            }
            if (hero.level === 5) {
                unlockedSkill2.push(`${hero.name} -> [${hero.skill2Name}]`);
            }

            hero.baseMaxHp += 5;
            hero.baseMaxMp += 4;
            recalculateStats(hero);
            hero.hp = Math.min(hero.maxHp, hero.hp + 15);
            hero.mp = Math.min(hero.maxMp, hero.mp + 10);
            leveledUpHeroes.push(`${hero.name} (Lv.${hero.level})`);
        }
    });

    addLog(`✨ EXP Kontribusi: ${expLogs.join(' | ')}`);

    if (leveledUpHeroes.length > 0) {
        setTimeout(() => SFX.levelup(), 250);
        const ldr = getLeader();
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🌟 LEVEL UP!", "#ffcc00");
        addLog(`🌟 LEVEL UP! ${leveledUpHeroes.join(', ')} naik level! Cek Stat & Perk di Menu [E].`);
    }

    if (unlockedSkill2.length > 0) {
        addLog(`🔥 MASTERY ART UNLOCKED (Lv.5)! ${unlockedSkill2.join(', ')} kini dapat digunakan dengan tombol [8]!`);
    }
}

function allocateStatPoint(heroIndex, statType) {
    const hero = party[heroIndex];
    if (!hero || hero.statPoints <= 0) return;

    hero.statPoints--;
    if (statType === 'hp') {
        hero.baseMaxHp += 12;
        if (hero.hp > 0) hero.hp += 12;
    } else if (statType === 'mp') {
        hero.baseMaxMp += 8;
        if (hero.hp > 0) hero.mp += 8;
    } else if (statType === 'patk') {
        hero.basePatk += 2;
    } else if (statType === 'matk') {
        hero.baseMatk += 2;
    } else if (statType === 'def') {
        hero.baseDef += 2;
    } else if (statType === 'spd') {
        hero.baseSpd += 1;
    }

    SFX.equip();
    recalculateStats(hero);
    updateUI();
    renderEquipModal();
}

function unlockHeroPerk(heroIndex, perkId) {
    const hero = party[heroIndex];
    if (!hero || hero.perkPoints <= 0 || hero.perks.includes(perkId)) return;

    hero.perkPoints--;
    hero.perks.push(perkId);
    SFX.levelup();
    recalculateStats(hero);
    addLog(`🌟 PERK UNLOCKED: [${hero.name}] menguasai talent ${PERK_CATALOG[perkId].name}!`);
    updateUI();
    renderEquipModal();
}

function recalculateStats(hero) {
    let bHp = 0, bMp = 0, bPatk = 0, bMatk = 0, bDef = 0, bSpd = 0;

    Object.values(hero.equipment).forEach(item => {
        if (item) {
            bHp   += (item.stats.hp || 0);
            bMp   += (item.stats.mp || 0);
            bPatk += (item.stats.patk || 0);
            bMatk += (item.stats.matk || 0);
            bDef  += (item.stats.def || 0);
            bSpd  += (item.stats.spd || 0);
        }
    });

    const oldMaxHp = hero.maxHp;
    let totalMaxHp = hero.baseMaxHp + bHp;
    let totalMaxMp = hero.baseMaxMp + bMp;
    let totalPatk  = hero.basePatk + bPatk;
    let totalMatk  = hero.baseMatk + bMatk;
    let totalDef   = hero.baseDef + bDef;
    let totalSpd   = hero.baseSpd + bSpd;

    // 1. Terapkan Bonus 2-Piece Equipment Set
    if (hasHeroSetBonus(hero, 'crusader', 2)) {
        totalMaxHp = Math.floor(totalMaxHp * 1.20);
        totalDef   = Math.floor(totalDef * 1.15);
    }
    if (hasHeroSetBonus(hero, 'shadowstalker', 2)) {
        totalPatk  = Math.floor(totalPatk * 1.20);
        totalSpd   += 3;
    }
    if (hasHeroSetBonus(hero, 'archmage', 2)) {
        totalMatk  = Math.floor(totalMatk * 1.20);
        totalMaxMp = Math.floor(totalMaxMp * 1.25);
    }
    if (hasHeroSetBonus(hero, 'dreadlord', 2)) {
        totalPatk  = Math.floor(totalPatk * 1.15);
        totalMatk  = Math.floor(totalMatk * 1.15);
        totalMaxHp = Math.floor(totalMaxHp * 1.10);
    }

    // 2. Terapkan Efek Perk Glass Cannon
    if (hero.perks && hero.perks.includes('glass_cannon')) {
        totalPatk  = Math.floor(totalPatk * 1.30);
        totalMatk  = Math.floor(totalMatk * 1.30);
        totalMaxHp = Math.max(30, Math.floor(totalMaxHp * 0.85));
    }

    // 3. Terapkan Boon & Kutukan Stat dari Cursed Relics
    const curseId = getHeroCursedRelicId(hero);
    if (curseId === 'berserker_ring') {
        totalPatk = Math.floor(totalPatk * 1.60);
        totalSpd  += 4;
    } else if (curseId === 'void_crown') {
        totalMatk  = Math.floor(totalMatk * 1.65);
        totalMaxMp += 30;
    } else if (curseId === 'titan_shackles') {
        totalMaxHp = Math.floor(totalMaxHp * 1.50);
        totalDef   = Math.floor(totalDef * 1.50);
        totalSpd   = 5; // Kutukan: Kecepatan membatu menjadi 5
    }

    const prestMult = 1 + (getPrestigeLevel() * 0.05);
    hero.maxHp = Math.floor(totalMaxHp * prestMult);
    hero.maxMp = Math.floor(totalMaxMp * prestMult);
    hero.patk  = Math.floor(totalPatk * prestMult);
    hero.matk  = Math.floor(totalMatk * prestMult);
    hero.def   = Math.floor(totalDef * prestMult);
    hero.spd   = Math.floor(totalSpd * prestMult);

    if (hero.hp > 0) {
        if (hero.maxHp > oldMaxHp) hero.hp += (hero.maxHp - oldMaxHp);
        hero.hp = Math.min(hero.hp, hero.maxHp);
        hero.mp = Math.min(hero.mp, hero.maxMp);
    }
}

function getLeader() {
    return party.find(member => member.hp > 0) || null;
}

function resetPartyPosition() {
    party.forEach(member => {
        member.x = 2;
        member.y = 2;
        member.defending = false;
    });
}

// =========================================================
// SISTEM FORMASI BARISAN (FRONTLINE POS 1-2 & BACKLINE 3-4)
// =========================================================
function getHeroFormationInfo(hero) {
    const idx = party.indexOf(hero);
    const isFront = (idx === 0 || idx === 1);
    return {
        index: idx,
        posNumber: idx + 1,
        roman: ['I', 'II', 'III', 'IV'][idx] || String(idx + 1),
        isFront: isFront,
        roleLabel: isFront ? "VANGUARD" : "REARGUARD",
        badgeColor: isFront ? "#7a441f" : "#264d59"
    };
}

function swapPartyFormation(idxA, idxB, isFreeSwap = true) {
    if (idxA < 0 || idxA >= party.length || idxB < 0 || idxB >= party.length) return;
    if (gameMode === 'COMBAT' && isFreeSwap) {
        addLog(`⚠️ Saat bertempur, gunakan perintah [7] Reposition pada giliran ksatria untuk bertukar barisan!`);
        return;
    }

    const tempX = party[idxA].x, tempY = party[idxA].y;
    party[idxA].x = party[idxB].x; party[idxA].y = party[idxB].y;
    party[idxB].x = tempX; party[idxB].y = tempY;

    const tempHero = party[idxA];
    party[idxA] = party[idxB];
    party[idxB] = tempHero;

    SFX.step();
    if (isFreeSwap) {
        addLog(`🔄 FORMASI DIUBAH: [${party[idxA].name}] (Pos ${idxA + 1}) bertukar barisan dengan [${party[idxB].name}] (Pos ${idxB + 1}).`);
        saveGameProgress();
        updateUI();
        drawGame();
    }
}
