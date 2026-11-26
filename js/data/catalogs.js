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

// =========================================================
// CHARM / RELIC SLOT (item pasif dari boss)
// =========================================================
const CHARM_CATALOG = {
    charm_crit:  { id: 'charm_crit',  name: 'Charm of Precision',  desc: '+5% crit chance' },
    charm_vamp:  { id: 'charm_vamp',  name: 'Charm of Blood',      desc: 'Heal 3% damage dealt' },
    charm_guard: { id: 'charm_guard', name: 'Charm of Bulwark',     desc: '+8 DEF' },
    charm_haste: { id: 'charm_haste',name: 'Charm of Haste',       desc: '+3 SPD' }
};

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

const ACHIEVEMENTS_CATALOG = [
    { id: 'first_blood', name: 'First Blood', desc: 'Kalahkan musuh pertama.', check: (h) => (h.totalKills || 0) >= 1 },
    { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Kalahkan 5 boss.', check: (h) => (h.bossKills || 0) >= 5 },
    { id: 'deep_delver', name: 'Deep Delver', desc: 'Capai lantai 20.', check: (h) => (h.highestFloor || 0) >= 20 },
    { id: 'gold_hoarder', name: 'Gold Hoarder', desc: 'Kumpulkan 1000 gold total.', check: (h) => (h.totalGoldEarned || 0) >= 1000 },
    { id: 'bounty_hunter', name: 'Bounty Hunter', desc: 'Selesaikan 10 bounty.', check: (h) => (h.bountiesCompleted || 0) >= 10 },
    { id: 'survivor', name: 'Survivor', desc: 'Capai ascension 3.', check: (h) => (h.highestAscension || 0) >= 3 },
    { id: 'prestige_1', name: 'Prestige', desc: 'Lakukan prestige pertama.', check: (h) => (h.prestigeLevel || 0) >= 1 }
];

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
