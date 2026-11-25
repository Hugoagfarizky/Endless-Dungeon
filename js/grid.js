const TILE_SIZE = 48;
const COLS = 24;
const ROWS = 14;

let currentFloor = 1;
let ascensionLevel = 0;
let torchLight = 100;
let sharpenedBuff = false;

let map = [];
let revealed = [];
let rooms = [];
let stairs = { x: 0, y: 0 };
let enemies = [];
let chests = [];
let lootDrops = [];
let traps = [];
let floorDecals = []; // Menyimpan bercak darah, tulang, & bekas ledakan di lantai
let shrine = null;
let merchant = null;
let campfire = null;
let floorBounty = null;
let floorModifier = null; // Modifier lantai (cursed floor): blood_moon, famine, gilded, darkness, silence
let merchantCaravan = false; // Merchant caravan: merchant mengikuti ke lantai berikutnya
let torchUpgradeLevel = 0; // Torch upgrade: kurangi drain per langkah

// =========================================================
// SEEDED RNG (untuk Seed Run / Daily Challenge)
// =========================================================
let runSeed = null;
let rngGen = null;

function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function setRunSeed(seed) {
    if (!seed) { runSeed = null; rngGen = null; return; }
    runSeed = String(seed);
    rngGen = mulberry32(hashSeed(runSeed));
    if (typeof addLog === 'function') addLog(`🎲 SEED RUN aktif: "${runSeed}". Lantai akan deterministik.`);
}

function rng() {
    return rngGen ? rngGen() : Math.random();
}

// Konfigurasi 4 Biome Dungeon (Berganti tiap 5 lantai)
function getCurrentBiome() {
    const cycle = Math.floor((currentFloor - 1) / 5) % 4;
    if (cycle === 0) {
        return {
            id: 'crypt', name: "Abandoned Crypt", color: "#d4af37",
            wallBase: "#3a3a48", wallTop: "#505062", floorBase: "#181820", floorDot: "#252532"
        };
    } else if (cycle === 1) {
        return {
            id: 'ice', name: "Frozen Cavern", color: "#70a1ff",
            wallBase: "#24476e", wallTop: "#3b6ea5", floorBase: "#102030", floorDot: "#1d3852"
        };
    } else if (cycle === 2) {
        return {
            id: 'lava', name: "Infernal Core", color: "#ff6b81",
            wallBase: "#5c2018", wallTop: "#802f24", floorBase: "#261010", floorDot: "#421c1c"
        };
    } else {
        return {
            id: 'void', name: "Void Abyss", color: "#e056fd",
            wallBase: "#3c1f54", wallTop: "#572f78", floorBase: "#160d24", floorDot: "#281740"
        };
    }
}

// Katalog Boss Spesifik Tiap Biome (Mini-Boss Tier 5 & Grand Boss Tier 10)
const BIOME_BOSS_ROSTER = {
    crypt: {
        mini:  { name: "Crypt Gargoyle Warden", color: "#a4b0be", skillName: "Tombstone Cleave" },
        grand: { name: "Necrolord Malakor",     color: "#5fa36d", skillName: "Plague of the Undead" }
    },
    ice: {
        mini:  { name: "Frostbite Wendigo",     color: "#6b9bc7", skillName: "Glacial Smash" },
        grand: { name: "Glacial Wyrm King",     color: "#8ab8d9", skillName: "Absolute Zero Blizzard" }
    },
    lava: {
        mini:  { name: "Magma Juggernaut",      color: "#d97c38", skillName: "Molten Cleave" },
        grand: { name: "Ignis the Balrog Lord", color: "#cf4646", skillName: "Cataclysmic Eruption" }
    },
    void: {
        mini:  { name: "Void Stalker Executioner",    color: "#a374c9", skillName: "Dimensional Rift Slash" },
        grand: { name: "Xal'korath the Void Emperor", color: "#b87ce0", skillName: "Singularity Collapse" }
    }
};

const MONSTER_AFFIXES = [
    { id: 'vampiric', label: "Vampiric", color: "#c9444e" },
    { id: 'berserk',  label: "Berserk",  color: "#d97c38" },
    { id: 'armored',  label: "Armored",  color: "#838c96" },
    { id: 'arcane',   label: "Arcane",   color: "#9d72c4" }
];

function generateFloorBounty() {
    const types = ['kill_all', 'open_chests', 'no_trap'];
    const chosen = types[Math.floor(rng() * types.length)];
    const rewardGold = (30 + (currentFloor * 12)) * (floorModifier === 'gilded' ? 2 : 1);
    const rewardOre  = 1 + Math.floor(currentFloor / 4) + (floorModifier === 'gilded' ? 1 : 0);

    if (chosen === 'kill_all') {
        floorBounty = {
            type: 'kill_all',
            desc: `Basmi ${enemies.length} Musuh`,
            progress: 0,
            target: enemies.length,
            completed: false,
            rewardGold, rewardOre
        };
    } else if (chosen === 'open_chests') {
        floorBounty = {
            type: 'open_chests',
            desc: `Buka ${chests.length} Peti`,
            progress: 0,
            target: chests.length,
            completed: false,
            rewardGold, rewardOre
        };
    } else {
        floorBounty = {
            type: 'no_trap',
            desc: `Clear Tanpa Kena Trap`,
            progress: 0,
            target: 1,
            failed: false,
            completed: false,
            rewardGold: rewardGold + 15,
            rewardOre: rewardOre + 1
        };
    }
}

function checkBountyCompletion(eventType) {
    if (!floorBounty || floorBounty.completed || floorBounty.failed) return;

    if (eventType === 'kill' && floorBounty.type === 'kill_all') {
        floorBounty.progress++;
        if (floorBounty.progress >= floorBounty.target) completeBounty();
    } 
    else if (eventType === 'chest' && floorBounty.type === 'open_chests') {
        floorBounty.progress++;
        if (floorBounty.progress >= floorBounty.target) completeBounty();
    } 
    else if (eventType === 'trap' && floorBounty.type === 'no_trap') {
        floorBounty.failed = true;
        addLog(`❌ TITAH GAGAL: Kamu menginjak jebakan! Hadiah misi lantai ini hangus.`);
    } 
    else if (eventType === 'floor_clear' && floorBounty.type === 'no_trap' && !floorBounty.failed) {
        floorBounty.progress = 1;
        completeBounty();
    }
}

function completeBounty() {
    floorBounty.completed = true;
    inventory.gold += floorBounty.rewardGold;
    inventory.ore  += floorBounty.rewardOre;

    if (typeof hallOfFame !== 'undefined') {
        hallOfFame.bountiesCompleted = (hallOfFame.bountiesCompleted || 0) + 1;
        hallOfFame.totalGoldEarned = (hallOfFame.totalGoldEarned || 0) + floorBounty.rewardGold;
        if (typeof saveCodexData === 'function') saveCodexData();
    }
    if (typeof checkAchievements === 'function') checkAchievements();

    SFX.levelup();
    const ldr = getLeader();
    if (ldr) addOverheadIcon(ldr.x, ldr.y, `📜 BOUNTY CLEAR!`, "#ffcc00");
    addLog(`📜 TITAH LANTAI TUNTAS (${floorBounty.desc})! Hadiah: +${floorBounty.rewardGold} 💰Gold & +${floorBounty.rewardOre} ⚒️Ore!`);
    updateUI();
}

function isReachable(sx, sy, tx, ty) {
    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const queue = [{ x: sx, y: sy }];
    visited[sy][sx] = true;

    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];

    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr.x === tx && curr.y === ty) return true;

        for (const d of dirs) {
            const nx = curr.x + d.dx;
            const ny = curr.y + d.dy;
            if (nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1) {
                if (!visited[ny][nx] && map[ny][nx] === 0) {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
    return false;
}

function carveCorridor(x1, y1, x2, y2) {
    let cx = x1;
    let cy = y1;
    const horizFirst = rng() < 0.5;

    if (horizFirst) {
        while (cx !== x2) {
            map[cy][cx] = 0;
            cx += (x2 > cx) ? 1 : -1;
        }
        while (cy !== y2) {
            map[cy][cx] = 0;
            cy += (y2 > cy) ? 1 : -1;
        }
    } else {
        while (cy !== y2) {
            map[cy][cx] = 0;
            cy += (y2 > cy) ? 1 : -1;
        }
        while (cx !== x2) {
            map[cy][cx] = 0;
            cx += (x2 > cx) ? 1 : -1;
        }
    }
    map[y2][x2] = 0;
}

function isFloorCleared() {
    return enemies.length === 0;
}

function isTileOccupied(x, y) {
    if (x <= 0 || x >= COLS - 1 || y <= 0 || y >= ROWS - 1) return true;
    if (map[y][x] !== 0) return true;
    if (x === 2 && y === 2) return true;
    if (x === stairs.x && y === stairs.y) return true;
    if (chests.some(c => c.x === x && c.y === y)) return true;
    if (enemies.some(e => e.x === x && e.y === y)) return true;
    if (traps.some(t => t.x === x && t.y === y)) return true;
    if (merchant && merchant.x === x && merchant.y === y) return true;
    if (shrine && shrine.x === x && shrine.y === y) return true;
    if (campfire && campfire.x === x && campfire.y === y) return true;
    return false;
}

function getRandomFloorTile(excludeSpawnRoom = true) {
    for (let attempt = 0; attempt < 150; attempt++) {
        if (rooms.length > 1 && rng() < 0.80) {
            const startIdx = excludeSpawnRoom ? 1 : 0;
            const r = rooms[startIdx + Math.floor(rng() * (rooms.length - startIdx))];
            const rx = r.x + Math.floor(rng() * r.w);
            const ry = r.y + Math.floor(rng() * r.h);
            if (!isTileOccupied(rx, ry)) return { x: rx, y: ry };
        } else {
            const rx = Math.floor(rng() * (COLS - 2)) + 1;
            const ry = Math.floor(rng() * (ROWS - 2)) + 1;
            if (excludeSpawnRoom && rx <= 5 && ry <= 5) continue;
            if (!isTileOccupied(rx, ry)) return { x: rx, y: ry };
        }
    }
    for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
            if (!isTileOccupied(x, y)) return { x, y };
        }
    }
    return { x: 3, y: 2 };
}

// NPC/Event hanya boleh muncul di dalam ruangan (bukan koridor 1-petak)
// supaya Merchant/Shrine/Campfire tidak pernah menyumbat jalan menuju tangga.
function isInsideAnyRoom(x, y) {
    return rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

function getRandomEventTile() {
    for (let attempt = 0; attempt < 120; attempt++) {
        const pos = getRandomFloorTile(true);
        if (pos.x <= 5 && pos.y <= 5) continue;
        if (!isInsideAnyRoom(pos.x, pos.y)) continue;

        const openNeighbors = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ].filter(d => map[pos.y + d.dy] && map[pos.y + d.dy][pos.x + d.dx] === 0).length;

        if (openNeighbors >= 2) return pos;
    }

    // Fallback: pindai semua petak di dalam ruangan (selain ruang awal).
    for (let i = 1; i < rooms.length; i++) {
        const r = rooms[i];
        for (let y = r.y; y < r.y + r.h; y++) {
            for (let x = r.x; x < r.x + r.w; x++) {
                if (isTileOccupied(x, y)) continue;
                const openNeighbors = [
                    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
                ].filter(d => map[y + d.dy] && map[y + d.dy][x + d.dx] === 0).length;
                if (openNeighbors >= 2) return { x, y };
            }
        }
    }
    return null;
}

// Cari petak kosong di sekitar tangga agar Boss tidak menimpa peti/jebakan/event.
function findBossSpawnTile() {
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const x = stairs.x + dx;
            const y = stairs.y + dy;
            if (x <= 0 || x >= COLS - 1 || y <= 0 || y >= ROWS - 1) continue;
            if (map[y][x] !== 0) continue;
            if (x === 2 && y === 2) continue;
            if (chests.some(c => c.x === x && c.y === y)) continue;
            if (traps.some(t => t.x === x && t.y === y)) continue;
            if (enemies.some(e => e.x === x && e.y === y)) continue;
            candidates.push({ x, y });
        }
    }

    if (candidates.length > 0) {
        return candidates[Math.floor(rng() * candidates.length)];
    }

    // Fallback: buka petak di samping tangga lalu bersihkan objek yang menempatinya.
    let bx = (stairs.x > 1) ? stairs.x - 1 : stairs.x + 1;
    let by = stairs.y;
    bx = Math.max(1, Math.min(COLS - 2, bx));
    by = Math.max(1, Math.min(ROWS - 2, by));
    map[by][bx] = 0;
    chests = chests.filter(c => !(c.x === bx && c.y === by));
    traps = traps.filter(t => !(t.x === bx && t.y === by));
    return { x: bx, y: by };
}

// =========================================================================
// ARCHITECTURAL ROOM & CORRIDOR GENERATOR
// =========================================================================
function generateFloor() {
    map = [];
    revealed = [];
    rooms = [];
    enemies = [];
    chests = [];
    lootDrops = [];
    traps = [];
    floorDecals = [];
    merchant = null;
    shrine = null;
    campfire = null;
    floorModifier = null;

    // Merchant caravan: jika aktif, spawn merchant di pintu masuk.
    if (merchantCaravan) {
        merchant = { x: 2, y: 2 };
        merchantCaravan = false; // reset setelah spawn
        addLog('Merchant caravan mengikuti ke lantai ini!');
    }

    // Lantai terkutuk: tiap 3 lantai ada peluang 60% mendapat 1 modifier.
    if (currentFloor >= 3 && currentFloor % 3 === 0 && rng() < 0.60) {
        const mods = ['blood_moon', 'famine', 'gilded', 'darkness', 'silence'];
        floorModifier = mods[Math.floor(rng() * mods.length)];
        const modNames = { blood_moon:'🌑 Blood Moon (+25% ATK musuh)', famine:'🌾 Famine (Campfire tidak menyembuhkan)', gilded:'💰 Gilded (Gold ×2, Trap ×2)', darkness:'🕯️ Darkness (Obor turun 2× lebih cepat)', silence:'🤫 Silence (Skill +50% biaya MP)' };
        addLog(`⚠️ LANTAI TERKUTUK: ${modNames[floorModifier]}!`);
    }
    for (let y = 0; y < ROWS; y++) {
        map[y] = [];
        revealed[y] = [];
        for (let x = 0; x < COLS; x++) {
            map[y][x] = 1;
            revealed[y][x] = false;
        }
    }

    const startRoom = { x: 1, y: 1, w: 4, h: 4, cx: 2, cy: 2 };
    rooms.push(startRoom);

    const targetRooms = 6 + Math.floor(rng() * 2);
    for (let attempt = 0; attempt < 120 && rooms.length < targetRooms; attempt++) {
        const w = 3 + Math.floor(rng() * 4);
        const h = 3 + Math.floor(rng() * 3);
        const x = 1 + Math.floor(rng() * (COLS - w - 2));
        const y = 1 + Math.floor(rng() * (ROWS - h - 2));

        const overlaps = rooms.some(r =>
            x < r.x + r.w + 1 &&
            x + w + 1 > r.x &&
            y < r.y + r.h + 1 &&
            y + h + 1 > r.y
        );

        if (!overlaps) {
            rooms.push({
                x, y, w, h,
                cx: Math.floor(x + w / 2),
                cy: Math.floor(y + h / 2)
            });
        }
    }

    rooms.forEach((r, idx) => {
        for (let ry = r.y; ry < r.y + r.h; ry++) {
            for (let rx = r.x; rx < r.x + r.w; rx++) {
                map[ry][rx] = 0;
            }
        }
        if (idx > 0 && r.w >= 5 && r.h >= 4 && rng() < 0.5) {
            map[r.y + 1][r.x + 1] = 1;
            map[r.y + 1][r.x + r.w - 2] = 1;
        }
    });

    const startRef = rooms[0];
    const otherRooms = rooms.slice(1).sort((a, b) => a.cx - b.cx);
    rooms = [startRef, ...otherRooms];

    for (let i = 1; i < rooms.length; i++) {
        carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
    }
    if (rooms.length >= 4) {
        carveCorridor(rooms[1].cx, rooms[1].cy, rooms[rooms.length - 1].cx, rooms[rooms.length - 1].cy);
    }

    map[2][2] = 0;
    map[2][3] = 0;
    map[3][2] = 0;

    const lastRoom = rooms[rooms.length - 1];
    stairs.x = lastRoom.cx;
    stairs.y = lastRoom.cy;
    map[stairs.y][stairs.x] = 0;

    if (!isReachable(2, 2, stairs.x, stairs.y)) {
        carveCorridor(2, 2, stairs.x, stairs.y);
    }

    let crackedCount = 0;
    for (let attempt = 0; attempt < 90 && crackedCount < 2; attempt++) {
        const wx = Math.floor(rng() * (COLS - 4)) + 2;
        const wy = Math.floor(rng() * (ROWS - 4)) + 2;
        if (map[wy][wx] !== 1) continue;

        const openDirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ].filter(d => map[wy + d.dy][wx + d.dx] === 0);

        if (openDirs.length === 1) {
            map[wy][wx] = 2;
            crackedCount++;
        }
    }

    const chestCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < chestCount; i++) {
        const pos = getRandomFloorTile(true);
        chests.push({ x: pos.x, y: pos.y, opened: false, isMimic: rng() < 0.18 });
    }

    const ascMult = 1 + (ascensionLevel * 0.35);
    const hpMod = (typeof ascensionModifier !== 'undefined' && ascensionModifier === 'empowered') ? 1.2 : 1.0;
    const biome = getCurrentBiome();
    const bossRoster = BIOME_BOSS_ROSTER[biome.id] || BIOME_BOSS_ROSTER.crypt;

    const isMajorBossFloor = (currentFloor % 10 === 0);
    const isMiniBossFloor  = (currentFloor % 5 === 0 && !isMajorBossFloor);

    if (isMajorBossFloor || isMiniBossFloor) {
        const bossTile = findBossSpawnTile();
        const bx = bossTile.x;
        const by = bossTile.y;
        map[by][bx] = 0;

        if (isMajorBossFloor) {
            const bossMeta = bossRoster.grand;
            const bossHp  = Math.floor((225 + currentFloor * 46) * ascMult * hpMod);
            const bossAtk = Math.floor((22 + currentFloor * 4.5) * ascMult);
            const bossSpd = 16 + Math.floor(currentFloor / 2);

            enemies.push({
                name: `${bossMeta.name} [Lv.${currentFloor}]`,
                x: bx, y: by, hp: bossHp, maxHp: bossHp, atk: bossAtk, def: 8 + currentFloor, spd: bossSpd,
                color: bossMeta.color, isEnemy: true, isBoss: true, bossTier: 10,
                bossBiome: biome.id, bossSkillName: bossMeta.skillName, affix: null,
                statuses: { burn: 0, stun: 0, break: 0 }
            });
            addLog(`⚠️ PERINGATAN: DREAD LORD [${bossMeta.name}] (${biome.name}) bersemayam di Aula Terakhir Lantai ${currentFloor}!`);
        } else {
            const bossMeta = bossRoster.mini;
            const bossHp  = Math.floor((135 + currentFloor * 30) * ascMult * hpMod);
            const bossAtk = Math.floor((15 + currentFloor * 3.5) * ascMult);
            const bossSpd = 13 + Math.floor(currentFloor / 3);

            enemies.push({
                name: `${bossMeta.name} [Lv.${currentFloor}]`,
                x: bx, y: by, hp: bossHp, maxHp: bossHp, atk: bossAtk, def: 5 + currentFloor, spd: bossSpd,
                color: bossMeta.color, isEnemy: true, isBoss: true, bossTier: 5,
                bossBiome: biome.id, bossSkillName: bossMeta.skillName, affix: null,
                statuses: { burn: 0, stun: 0, break: 0 }
            });
            addLog(`⚠️ PERHATIAN: MINI-BOSS [${bossMeta.name}] menjaga Aula Tangga Lantai ${currentFloor}!`);
        }
    }

    const normalEnemyCount = (isMajorBossFloor || isMiniBossFloor) ? 3 : (4 + Math.min(currentFloor, 5));
    for (let i = 0; i < normalEnemyCount; i++) {
        const pos = getRandomFloorTile(true);

        const isSkeleton = (currentFloor % 3 === 0 || rng() < 0.35);
        let baseName = isSkeleton ? "Dark Skeleton" : "Dungeon Slime";
        let eHp  = Math.floor((40 + currentFloor * 16) * ascMult);
        let eAtk = Math.floor((9 + currentFloor * 3) * ascMult);
        let affixObj = null;

        if (rng() < 0.35) {
            affixObj = MONSTER_AFFIXES[Math.floor(rng() * MONSTER_AFFIXES.length)];
            baseName = `${affixObj.label} ${baseName}`;
            eHp = Math.floor(eHp * 1.25);
        }

        enemies.push({
            name: baseName,
            x: pos.x, y: pos.y, hp: eHp, maxHp: eHp, atk: eAtk, def: 2 + Math.floor(currentFloor * 0.8),
            spd: isSkeleton ? 15 + Math.floor(currentFloor / 2) : 11 + Math.floor(currentFloor / 3),
            color: affixObj ? affixObj.color : "#ff4757",
            isEnemy: true, isBoss: false, bossTier: 0,
            affix: affixObj ? affixObj.id : null,
            statuses: { burn: 0, stun: 0, break: 0 }
        });
    }

    const trapTypes = ['spike', 'poison', 'teleport'];
    let trapCount = (3 + Math.min(3, Math.floor(currentFloor / 2))) * (floorModifier === 'gilded' ? 2 : 1);
    if (typeof ascensionModifier !== 'undefined' && ascensionModifier === 'empowered') trapCount += 1;
    for (let i = 0; i < trapCount; i++) {
        const pos = getRandomFloorTile(true);
        traps.push({
            x: pos.x, y: pos.y,
            type: trapTypes[Math.floor(rng() * trapTypes.length)],
            triggered: false,
            detected: false
        });
    }

    // Event khusus lantai: maksimal 1 event per lantai, dan tidak muncul di Lantai 1.
    // Altar (shrine) & Merchant dibuat langka; Campfire jadi hasil paling umum supaya
    // lantai tidak terasa penuh toko/altar, tapi istirahat/heal tetap tersedia.
    if (currentFloor >= 2) {
        const isPreBossFloor = (currentFloor % 5 === 4);
        const eventChance = isPreBossFloor ? 0.55 : 0.40;

        if (rng() < eventChance) {
            const roll = rng();
            const pos = getRandomEventTile();

            if (pos) {
                if (isPreBossFloor) {
                    // Pre-boss: sedikit lebih longgar supaya party bisa siap sebelum boss.
                    if (roll < 0.50) campfire = { x: pos.x, y: pos.y, used: false };
                    else if (roll < 0.75) shrine = { x: pos.x, y: pos.y, used: false };
                    else merchant = { x: pos.x, y: pos.y };
                } else {
                    if (roll < 0.55) campfire = { x: pos.x, y: pos.y, used: false };
                    else if (roll < 0.80) shrine = { x: pos.x, y: pos.y, used: false };
                    else merchant = { x: pos.x, y: pos.y };
                }
            }
        }
    }

    // Merchant caravan: 20% chance merchant berikutnya akan mengikuti ke lantai berikut.
    if (merchant && rng() < 0.20) {
        merchantCaravan = true;
        addLog('Merchant caravan akan mengikuti ke lantai berikutnya!');
    }

    generateFloorBounty();
}

function updateFogOfWar(leaderX, leaderY) {
    const sightRadius = torchLight > 50 ? 4.6 : (torchLight > 15 ? 3.3 : 2.1);
    const maxPartySpd = Math.max(...party.filter(p => p.hp > 0).map(p => p.spd), 10);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const dist = Math.hypot(x - leaderX, y - leaderY);
            if (dist <= sightRadius) {
                revealed[y][x] = true;
            }
        }
    }

    traps.forEach(t => {
        const dist = Math.hypot(t.x - leaderX, t.y - leaderY);
        if (dist <= 2.2 && maxPartySpd >= 16 && !t.detected) {
            t.detected = true;
        }
    });
}
