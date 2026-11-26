const EQUIP_SLOTS = {
    helm:     { label: "Greathelm", icon: icon('helm', 13) },
    armor:    { label: "Cuirass",   icon: icon('cuirass', 13) },
    pants:    { label: "Greaves",   icon: icon('greaves', 13) },
    boots:    { label: "Sabatons",  icon: icon('sabatons', 13) },
    artifact: { label: "Relic",     icon: icon('relic', 13) }
};
const PERK_CATALOG = {
    quick_reflexes: { id: 'quick_reflexes', name: "Quick Reflexes",  desc: "22% Peluang menghindar (Dodge) serangan musuh." },
    mana_flow:      { id: 'mana_flow',      name: "Mana Flow",       desc: "Memulihkan +6 MP setiap giliran & biaya Skill -3 MP." },
    vampirism:      { id: 'vampirism',      name: "Blood Vampirism", desc: "Menyerap 15% damage serangan menjadi HP pemakai." },
    glass_cannon:   { id: 'glass_cannon',   name: "Glass Cannon",    desc: "+30% P.ATK & M.ATK, namun Max HP berkurang 15%." }
};

// =========================================================
// KATALOG RUNE (DROP DARI ELITE/BOSS)
// =========================================================
const RUNE_CATALOG = {
    rune_crit:  { id: 'rune_crit',  name: "Rune of Precision",   desc: "+8% Critical Strike (1.5x DMG)" },
    rune_vamp:  { id: 'rune_vamp',  name: "Rune of Bloodthirst", desc: "Menyembuhkan 5% dari damage yang diberikan" },
    rune_power: { id: 'rune_power', name: "Rune of Might",       desc: "+3 P.ATK & +3 M.ATK" },
    rune_guard: { id: 'rune_guard', name: "Rune of Bulwark",     desc: "+5 DEF & +10 Max HP" },
    rune_swift: { id: 'rune_swift', name: "Rune of Haste",       desc: "+2 SPD" },
    rune_mana:  { id: 'rune_mana',  name: "Rune of Arcana",      desc: "+10 Max MP" }
};

// =========================================================
// MASTERY (Skill Tree) — 3 node per hero, unlock pakai perkPoints
// =========================================================
const MASTERY_CATALOG = {
    offense:  { id: 'offense',  name: 'Offense Mastery',  desc: '+10% P.ATK & M.ATK', apply: (h) => { h.basePatk = (h.basePatk||0)+2; h.baseMatk = (h.baseMatk||0)+2; h.patk += 2; h.matk += 2; } },
    defense:  { id: 'defense',  name: 'Defense Mastery',  desc: '+10% Max HP & DEF',   apply: (h) => { h.baseMaxHp = (h.baseMaxHp||0)+15; h.baseDef = (h.baseDef||0)+3; h.maxHp += 15; h.hp = Math.min(h.maxHp, h.hp+15); h.def += 3; } },
    utility:  { id: 'utility',  name: 'Utility Mastery',  desc: '+2 SPD & +10 Max MP', apply: (h) => { h.baseSpd = (h.baseSpd||0)+2; h.baseMaxMp = (h.baseMaxMp||0)+10; h.spd += 2; h.maxMp += 10; h.mp = Math.min(h.maxMp, h.mp+10); } }
};

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

// =========================================================
// CHARM / RELIC SLOT (item pasif dari boss)
// =========================================================
const CHARM_CATALOG = {
    charm_crit:  { id: 'charm_crit',  name: 'Charm of Precision',  desc: '+5% crit chance' },
    charm_vamp:  { id: 'charm_vamp',  name: 'Charm of Blood',      desc: 'Heal 3% damage dealt' },
    charm_guard: { id: 'charm_guard', name: 'Charm of Bulwark',     desc: '+8 DEF' },
    charm_haste: { id: 'charm_haste',name: 'Charm of Haste',       desc: '+3 SPD' }
};

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

// =========================================================
// KATALOG EQUIPMENT SET BONUS (2-PC & 4-PC) & CURSED RELICS
// =========================================================
const EQUIPMENT_SETS = {
    crusader: {
        id: 'crusader', name: "Crusader's Bastion", icon: icon('shield', 12), color: "#d4b87b",
        bonus2Desc: "+20% Max HP & +15% DEF",
        bonus4Desc: "Regen +8% Max HP tiap giliran & Kebal Stun"
    },
    shadowstalker: {
        id: 'shadowstalker', name: "Shadowstalker's Garb", icon: icon('sword', 12), color: "#75b88c",
        bonus2Desc: "+20% P.ATK & +3 SPD",
        bonus4Desc: "25% Peluang Critical Lethal Strike (1.6x DMG)"
    },
    archmage: {
        id: 'archmage', name: "Archmage's Vestments", icon: icon('arcane', 12), color: "#6ea3cf",
        bonus2Desc: "+20% M.ATK & +25% Max MP",
        bonus4Desc: "Biaya MP Skill -35% & Serangan pulihkan +5 MP"
    },
    dreadlord: {
        id: 'dreadlord', name: "Dreadlord's Panoply", icon: icon('skull', 12), color: "#cf5b64",
        bonus2Desc: "+15% P.ATK, +15% M.ATK & +10% Max HP",
        bonus4Desc: "Soul Leech: Serap 18% DMG jadi HP & +10% Overdrive"
    }
};

const CURSED_RELIC_CATALOG = {
    berserker_ring: {
        id: 'berserker_ring',
        baseName: "Berserker's Bloodring",
        boonDesc: "Boon: +60% Physical Damage & +4 SPD",
        curseDesc: "Curse: Kehilangan 6% HP tiap giliran & tidak dapat Guard"
    },
    void_crown: {
        id: 'void_crown',
        baseName: "Crown of the Void Eye",
        boonDesc: "Boon: +65% Magic Damage & +30 Max MP",
        curseDesc: "Curse: Merapal Skill/Ultimate membakar 8% HP pemakai"
    },
    titan_shackles: {
        id: 'titan_shackles',
        baseName: "Shackles of the Titan",
        boonDesc: "Boon: +50% Max HP & +50% DEF",
        curseDesc: "Curse: Kecepatan terkunci (SPD = 5) & tidak dapat Dodge"
    },
    greed_idol: {
        id: 'greed_idol',
        baseName: "Idol of Abyssal Greed",
        boonDesc: "Boon: Perolehan Gold & EXP Party meningkat +45%",
        curseDesc: "Curse: Pemakai menerima +25% Damage tambahan dari musuh"
    }
};

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

const CONSUMABLE_CATALOG = {
    potion: {
        key: 'potion', name: "Herbal Draught", icon: icon('satchel', 14),
        desc: "Memulihkan +35 HP & menyembuhkan status Poison Party."
    },
    hi_potion: {
        key: 'hi_potion', name: "Crimson Draught", icon: icon('heart', 14),
        desc: "Memulihkan +75 HP ke seluruh anggota Party yang hidup."
    },
    energy_potion: {
        key: 'energy_potion', name: "Astral Vial", icon: icon('bolt', 14),
        desc: "Memulihkan +30 Energi (MP) ke seluruh anggota Party."
    },
    torch_oil: {
        key: 'torch_oil', name: "Pitch Torch Oil", icon: icon('torch', 14),
        desc: "Mengisi ulang cahaya Obor (Torch) +60% agar jarak pandang kembali terang."
    },
    revive: {
        key: 'revive', name: "Phoenix Pinion", icon: icon('feather', 14),
        desc: "Membangkitkan 1 anggota Party yang gugur dengan 50% Max HP."
    },
    elixir: {
        key: 'elixir', name: "Warlord's Elixir", icon: icon('arcane', 14),
        desc: "Memulihkan +25 HP & meningkatkan P.ATK / M.ATK +2 seluruh Party permanen."
    },
    tonic: {
        key: 'tonic', name: "Ironbark Tonic", icon: icon('shield', 14),
        desc: "Meningkatkan Base DEF +2 & Max HP +10 seluruh Party secara permanen."
    }
};

// =========================================================
// KATALOG ENSIKLOPEDIA BESTIARY & HALL OF FAME PERMANEN
// =========================================================
const BESTIARY_CATALOG = {
    slime: {
        id: 'slime', name: "Plague Dungeon Slime", icon: icon('satchel', 14), targetKills: 10,
        role: "Swarm Ooze",
        lore: "Lendir asam pemakan bangkai yang merayap di celah batu lembap. Sering membelah diri memanggil kawanan saat terdesak."
    },
    skeleton: {
        id: 'skeleton', name: "Fallen Dark Skeleton", icon: icon('skull', 14), targetKills: 10,
        role: "Undead Halberdier",
        lore: "Kerangka prajurit kastil kuno yang bangkit oleh kutukan. Memiliki kecepatan tinggi dan tombak halberd penembus zirah."
    },
    guard: {
        id: 'guard', name: "Royal Abyssal Guard", icon: icon('shield', 14), targetKills: 8,
        role: "Boss Escort",
        lore: "Pengawal pribadi para penguasa ruang bawah tanah yang selalu muncul mengapit Boss saat pertempuran pecah."
    },
    mimic: {
        id: 'mimic', name: "Cursed Chest Mimic", icon: icon('chest', 14), targetKills: 3,
        role: "Ambush Predator",
        lore: "Monster rakus berwujud peti harta karun. Memiliki taring Vampiric yang menyerap darah ksatria yang tertipu."
    },
    warden: {
        id: 'warden', name: "Abyssal Gargoyle Warden", icon: icon('sword', 14), targetKills: 3,
        role: "Floor 5 Mini-Boss",
        lore: "Penjaga gerbang tiap kelipatan Lantai 5. Kapak raksasanya sanggup menebas dua ksatria barisan depan sekaligus (Warden Cleave)."
    },
    overlord: {
        id: 'overlord', name: "Nether Lich Overlord", icon: icon('crown', 14), targetKills: 2,
        role: "Floor 10 Dread Lord",
        lore: "Penguasa tertinggi kegelapan di tiap Lantai 10. Menguasai sihir Hellfire AoE yang membakar seluruh anggota Ordo."
    }
};

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

const ACHIEVEMENTS_CATALOG = [
    { id: 'first_blood', name: 'First Blood', desc: 'Kalahkan musuh pertama.', check: (h) => (h.totalKills || 0) >= 1 },
    { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Kalahkan 5 boss.', check: (h) => (h.bossKills || 0) >= 5 },
    { id: 'deep_delver', name: 'Deep Delver', desc: 'Capai lantai 20.', check: (h) => (h.highestFloor || 0) >= 20 },
    { id: 'gold_hoarder', name: 'Gold Hoarder', desc: 'Kumpulkan 1000 gold total.', check: (h) => (h.totalGoldEarned || 0) >= 1000 },
    { id: 'bounty_hunter', name: 'Bounty Hunter', desc: 'Selesaikan 10 bounty.', check: (h) => (h.bountiesCompleted || 0) >= 10 },
    { id: 'survivor', name: 'Survivor', desc: 'Capai ascension 3.', check: (h) => (h.highestAscension || 0) >= 3 },
    { id: 'prestige_1', name: 'Prestige', desc: 'Lakukan prestige pertama.', check: (h) => (h.prestigeLevel || 0) >= 1 }
];

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

const INITIAL_PARTY_TEMPLATE = [
    {
        name: "Tank", role: "Warrior", dmgType: "Physical", x: 2, y: 2,
        level: 1, xp: 0, maxXp: 80, statPoints: 0, perkPoints: 0, perks: [], combatContrib: 0, overdrive: 0, defendStreak: 0,
        baseMaxHp: 120, baseMaxMp: 30, basePatk: 16, baseMatk: 5, baseDef: 7, baseSpd: 9,
        hp: 120, maxHp: 120, mp: 30, maxMp: 30, patk: 16, matk: 5, def: 7, spd: 9,
        skillCost: 10, skill2Cost: 14,
        color: "#3498db", skillName: "Shield Bash", skill2Name: "Whirlwind Cleave", ultName: "Immortal Bastion", defending: false,
        statuses: { poison: 0, burn: 0, stun: 0 },
        equipment: { helm: null, armor: null, pants: null, boots: null, artifact: null, charm: null }
    },
    {
        name: "DPS", role: "Ranger", dmgType: "Physical", x: 2, y: 2,
        level: 1, xp: 0, maxXp: 80, statPoints: 0, perkPoints: 0, perks: [], combatContrib: 0, overdrive: 0, defendStreak: 0,
        baseMaxHp: 90, baseMaxMp: 35, basePatk: 23, baseMatk: 6, baseDef: 3, baseSpd: 18,
        hp: 90, maxHp: 90, mp: 35, maxMp: 35, patk: 23, matk: 6, def: 3, spd: 18,
        skillCost: 12, skill2Cost: 15,
        color: "#e74c3c", skillName: "Armor Piercer", skill2Name: "Viper Volley", ultName: "Rain of Arrows", defending: false,
        statuses: { poison: 0, burn: 0, stun: 0 },
        equipment: { helm: null, armor: null, pants: null, boots: null, artifact: null, charm: null }
    },
    {
        name: "Healer", role: "Cleric", dmgType: "Magic", x: 2, y: 2,
        level: 1, xp: 0, maxXp: 80, statPoints: 0, perkPoints: 0, perks: [], combatContrib: 0, overdrive: 0, defendStreak: 0,
        baseMaxHp: 85, baseMaxMp: 50, basePatk: 8, baseMatk: 20, baseDef: 4, baseSpd: 12,
        hp: 85, maxHp: 85, mp: 50, maxMp: 50, patk: 8, matk: 20, def: 4, spd: 12,
        skillCost: 15, skill2Cost: 18,
        color: "#2ecc71", skillName: "Holy Purify", skill2Name: "Divine Aegis", ultName: "Divine Miracle", defending: false,
        statuses: { poison: 0, burn: 0, stun: 0 },
        equipment: { helm: null, armor: null, pants: null, boots: null, artifact: null, charm: null }
    },
    {
        name: "Mage", role: "Control", dmgType: "Magic", x: 2, y: 2,
        level: 1, xp: 0, maxXp: 80, statPoints: 0, perkPoints: 0, perks: [], combatContrib: 0, overdrive: 0, defendStreak: 0,
        baseMaxHp: 75, baseMaxMp: 60, basePatk: 6, baseMatk: 26, baseDef: 2, baseSpd: 14,
        hp: 75, maxHp: 75, mp: 60, maxMp: 60, patk: 6, matk: 26, def: 2, spd: 14,
        skillCost: 16, skill2Cost: 18,
        color: "#9b59b6", skillName: "Hellfire Blast", skill2Name: "Frost Nova", ultName: "Meteor Apocalypse", defending: false,
        statuses: { poison: 0, burn: 0, stun: 0 },
        equipment: { helm: null, armor: null, pants: null, boots: null, artifact: null, charm: null }
    }
];

let party = JSON.parse(JSON.stringify(INITIAL_PARTY_TEMPLATE));

const inventory = {
    gold: 0,
    ore: 0,
    consumables: {
        potion: 0, hi_potion: 0, energy_potion: 0, torch_oil: 0, revive: 0, elixir: 0, tonic: 0
    },
    bag: []
};

let itemIdCounter = 1;
let floatingPopups = [];
const SAVE_STORAGE_KEY = 'endless_dungeon_save_v2';
let activeSaveSlot = null; // null = autosave slot
let ascensionModifier = null; // 'empowered' | 'frugal' | 'hardened'

function getSaveKey(slot) {
    if (!slot) return SAVE_STORAGE_KEY;
    return SAVE_STORAGE_KEY + '_slot_' + slot;
}

function addOverheadIcon(tileX, tileY, iconText, color = "#dfc484", size = 15) {
    const cleanText = String(iconText)
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
