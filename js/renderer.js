// ============================================================================
// REALISTIC 2.5D DARK-FANTASY RENDERER & PROCEDURAL MATERIAL ENGINE
// Pre-baked stone/ice/lava/void textures, shaded 2.5D miniatures, dynamic
// multi-source offscreen lighting, feathered Fog of War, & portrait avatars.
// ============================================================================

const WORLD_WIDTH = 1152;
const WORLD_HEIGHT = 672;
const RENDER_SCALE = 2; // Hi-DPI 2x internal resolution (2304 x 1344)

const lightCanvas = document.createElement('canvas');
lightCanvas.width = WORLD_WIDTH;
lightCanvas.height = WORLD_HEIGHT;
const lightCtx = lightCanvas.getContext('2d');

const biomeAtlasCache = {};

function seededNoise(x, y, seed = 1) {
    let n = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177);
    n = (n ^ (n >>> 13)) >>> 0;
    return (n % 10000) / 10000;
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function clampByte(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
}

// ============================================================================
// 1. PROCEDURAL PBR-STYLE STONE & BIOME TEXTURE ATLAS BAKER
// ============================================================================
const BIOME_MATERIAL_SPECS = {
    crypt: {
        floorA: '#22201d', floorB: '#1c1a17', mortar: '#0c0b09',
        bevel: 'rgba(215, 200, 175, 0.14)', moss: 'rgba(54, 108, 58, 0.34)',
        wallTop: '#2c2925', wallFace: '#3d3832', wallDark: '#1b1815',
        ambientDark: 'rgba(6, 5, 4, 0.86)', torchTint: 'rgba(255, 168, 72, 0.24)'
    },
    ice: {
        floorA: '#172838', floorB: '#132231', mortar: '#08111a',
        bevel: 'rgba(180, 232, 255, 0.20)', moss: 'rgba(135, 215, 255, 0.22)',
        wallTop: '#1f3b54', wallFace: '#2e5578', wallDark: '#102030',
        ambientDark: 'rgba(4, 10, 18, 0.84)', torchTint: 'rgba(190, 225, 255, 0.20)'
    },
    lava: {
        floorA: '#241514', floorB: '#1d1110', mortar: '#0d0504',
        bevel: 'rgba(255, 145, 90, 0.14)', moss: 'rgba(255, 88, 28, 0.42)',
        wallTop: '#361916', wallFace: '#4f241e', wallDark: '#1c0a08',
        ambientDark: 'rgba(12, 4, 3, 0.82)', torchTint: 'rgba(255, 120, 45, 0.26)'
    },
    void: {
        floorA: '#191229', floorB: '#140e21', mortar: '#07040e',
        bevel: 'rgba(210, 150, 255, 0.16)', moss: 'rgba(176, 72, 255, 0.28)',
        wallTop: '#281a40', wallFace: '#3b265e', wallDark: '#120a20',
        ambientDark: 'rgba(7, 3, 14, 0.88)', torchTint: 'rgba(215, 140, 255, 0.22)'
    }
};

function bakeFloorVariant(biomeId, variantIdx) {
    const spec = BIOME_MATERIAL_SPECS[biomeId] || BIOME_MATERIAL_SPECS.crypt;
    const size = TILE_SIZE * RENDER_SCALE; // 96x96
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const c = off.getContext('2d');

    const baseRgb = hexToRgb(variantIdx % 2 === 0 ? spec.floorA : spec.floorB);
    const img = c.createImageData(size, size);
    const data = img.data;

    // Stone micro-grain + mineral variation + subtle radial slab shading
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const n1 = seededNoise(px, py, variantIdx * 31 + 7);
            const n2 = seededNoise(Math.floor(px / 3), Math.floor(py / 3), variantIdx * 17 + 3);
            const n3 = seededNoise(Math.floor(px / 8), Math.floor(py / 8), variantIdx * 53 + 11);
            const grain = (n1 - 0.5) * 14 + (n2 - 0.5) * 18 + (n3 - 0.5) * 12;

            const idx = (py * size + px) * 4;
            data[idx]     = clampByte(baseRgb.r + grain);
            data[idx + 1] = clampByte(baseRgb.g + grain);
            data[idx + 2] = clampByte(baseRgb.b + grain);
            data[idx + 3] = 255;
        }
    }
    c.putImageData(img, 0, 0);

    // Hand-laid medieval flagstones (irregular slabs + mortar crevices + bevel highlights)
    const splitY = Math.floor(size * (0.46 + (variantIdx % 3) * 0.05));
    const splitX1 = Math.floor(size * (0.42 + ((variantIdx * 7) % 4) * 0.06));
    const splitX2 = Math.floor(size * (0.58 - ((variantIdx * 5) % 3) * 0.07));

    const slabs = [
        { x: 1, y: 1, w: splitX1 - 2, h: splitY - 2 },
        { x: splitX1 + 1, y: 1, w: size - splitX1 - 2, h: splitY - 2 },
        { x: 1, y: splitY + 1, w: splitX2 - 2, h: size - splitY - 2 },
        { x: splitX2 + 1, y: splitY + 1, w: size - splitX2 - 2, h: size - splitY - 2 }
    ];

    // Deep mortar background lines
    c.strokeStyle = spec.mortar;
    c.lineWidth = 2.6;
    c.strokeRect(0.5, 0.5, size - 1, size - 1);
    c.beginPath();
    c.moveTo(0, splitY); c.lineTo(size, splitY);
    c.moveTo(splitX1, 0); c.lineTo(splitX1, splitY);
    c.moveTo(splitX2, splitY); c.lineTo(splitX2, size);
    c.stroke();

    slabs.forEach((s, sIdx) => {
        // Subtle per-slab tone shift
        const tone = ((variantIdx + sIdx) % 3 - 1) * 0.045;
        if (tone !== 0) {
            c.fillStyle = tone > 0 ? `rgba(255,255,255,${tone})` : `rgba(0,0,0,${-tone * 1.4})`;
            c.fillRect(s.x, s.y, s.w, s.h);
        }
        // Top-left stone bevel highlight
        c.strokeStyle = spec.bevel;
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(s.x + 1, s.y + s.h - 2);
        c.lineTo(s.x + 1, s.y + 1);
        c.lineTo(s.x + s.w - 2, s.y + 1);
        c.stroke();

        // Bottom-right stone shadow edge
        c.strokeStyle = 'rgba(0, 0, 0, 0.42)';
        c.beginPath();
        c.moveTo(s.x + s.w - 1, s.y + 2);
        c.lineTo(s.x + s.w - 1, s.y + s.h - 1);
        c.lineTo(s.x + 2, s.y + s.h - 1);
        c.stroke();
    });

    // Cracks & biome-specific surface details
    if (variantIdx % 2 === 0) {
        c.strokeStyle = 'rgba(0, 0, 0, 0.48)';
        c.lineWidth = 1.2;
        c.beginPath();
        const cx = 18 + (variantIdx * 13) % 45;
        const cy = 16 + (variantIdx * 19) % 45;
        c.moveTo(cx, cy);
        c.lineTo(cx + 9, cy + 7);
        c.lineTo(cx + 16, cy + 4);
        c.moveTo(cx + 9, cy + 7);
        c.lineTo(cx + 7, cy + 15);
        c.stroke();
    }

    if (biomeId === 'crypt') {
        if (variantIdx % 3 === 0) {
            // Creeping damp moss in mortar joints
            c.fillStyle = spec.moss;
            c.beginPath();
            c.arc(splitX1, splitY, 8, 0, Math.PI * 2);
            c.arc(splitX1 + 7, splitY + 1, 5, 0, Math.PI * 2);
            c.fill();
        } else if (variantIdx === 5) {
            // Shallow damp water puddle with reflection
            const pGrad = c.createRadialGradient(54, 56, 2, 54, 56, 20);
            pGrad.addColorStop(0, 'rgba(90, 125, 150, 0.24)');
            pGrad.addColorStop(0.75, 'rgba(20, 32, 42, 0.35)');
            pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = pGrad;
            c.beginPath();
            c.ellipse(54, 56, 20, 13, 0.2, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = 'rgba(210, 235, 255, 0.16)';
            c.lineWidth = 1;
            c.beginPath();
            c.arc(49, 52, 7, -Math.PI * 0.8, -Math.PI * 0.2);
            c.stroke();
        }
    } else if (biomeId === 'ice') {
        // Crystalline frost veins & specular ice glint
        c.strokeStyle = 'rgba(175, 235, 255, 0.26)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(12 + variantIdx * 6, 14);
        c.lineTo(34 + variantIdx * 4, 38);
        c.lineTo(62, 44 + variantIdx * 3);
        c.stroke();
    } else if (biomeId === 'lava') {
        if (variantIdx % 2 === 1) {
            // Subsurface glowing magma fissure
            c.save();
            c.shadowColor = '#ff5e00';
            c.shadowBlur = 8;
            c.strokeStyle = 'rgba(255, 115, 25, 0.65)';
            c.lineWidth = 2.0;
            c.beginPath();
            c.moveTo(splitX2, splitY);
            c.lineTo(splitX2 - 8, splitY + 18);
            c.lineTo(splitX2 + 4, splitY + 30);
            c.stroke();
            c.strokeStyle = 'rgba(255, 230, 120, 0.6)';
            c.lineWidth = 0.9;
            c.stroke();
            c.restore();
        }
    } else if (biomeId === 'void') {
        if (variantIdx % 3 === 1) {
            // Faint arcane obsidian crystal vein
            c.save();
            c.shadowColor = '#c56cf0';
            c.shadowBlur = 6;
            c.strokeStyle = 'rgba(198, 110, 255, 0.38)';
            c.lineWidth = 1.4;
            c.beginPath();
            c.moveTo(splitX1, splitY - 12);
            c.lineTo(splitX1, splitY + 12);
            c.moveTo(splitX1 - 8, splitY);
            c.lineTo(splitX1 + 8, splitY);
            c.stroke();
            c.restore();
        }
    }

    return off;
}

function bakeWallVariant(biomeId, variantIdx, isCracked = false) {
    const spec = BIOME_MATERIAL_SPECS[biomeId] || BIOME_MATERIAL_SPECS.crypt;
    const w = TILE_SIZE * RENDER_SCALE; // 96
    const wallH = WALL_HEIGHT * RENDER_SCALE; // 40
    const totalH = (TILE_SIZE + WALL_HEIGHT) * RENDER_SCALE; // 136
    const off = document.createElement('canvas');
    off.width = w;
    off.height = totalH;
    const c = off.getContext('2d');

    const topRgb = hexToRgb(spec.wallTop);
    const faceRgb = hexToRgb(spec.wallFace);

    // 1. Top Roof / Cap Surface (0 .. 96) with textured stone grain
    const topImg = c.createImageData(w, w);
    for (let py = 0; py < w; py++) {
        for (let px = 0; px < w; px++) {
            const n = (seededNoise(px, py, variantIdx * 41 + 99) - 0.5) * 18
                    + (seededNoise(Math.floor(px / 4), Math.floor(py / 4), variantIdx * 13) - 0.5) * 16;
            const i = (py * w + px) * 4;
            topImg.data[i]     = clampByte(topRgb.r + n);
            topImg.data[i + 1] = clampByte(topRgb.g + n);
            topImg.data[i + 2] = clampByte(topRgb.b + n);
            topImg.data[i + 3] = 255;
        }
    }
    c.putImageData(topImg, 0, 0);

    // Inner darker stone core on roof for architectural depth
    const coreGrad = c.createLinearGradient(0, 0, 0, w);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    coreGrad.addColorStop(0.2, 'rgba(0, 0, 0, 0.18)');
    coreGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.34)');
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
    c.fillStyle = coreGrad;
    c.fillRect(0, 0, w, w);

    // Chiseled cornice border on top edge & front lip
    c.strokeStyle = 'rgba(255, 245, 225, 0.18)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, w - 2);
    c.fillStyle = 'rgba(255, 245, 220, 0.16)';
    c.fillRect(0, w - 5, w, 3);
    c.fillStyle = 'rgba(0, 0, 0, 0.55)';
    c.fillRect(0, w - 2, w, 2);

    // 2. 3D Front Masonry Face (96 .. 136)
    const faceImg = c.createImageData(w, wallH);
    for (let py = 0; py < wallH; py++) {
        const vertShade = (1 - py / wallH) * 14 - 8;
        for (let px = 0; px < w; px++) {
            const n = (seededNoise(px, py + 200, variantIdx * 29 + 5) - 0.5) * 20;
            const i = (py * w + px) * 4;
            faceImg.data[i]     = clampByte(faceRgb.r + n + vertShade);
            faceImg.data[i + 1] = clampByte(faceRgb.g + n + vertShade);
            faceImg.data[i + 2] = clampByte(faceRgb.b + n + vertShade);
            faceImg.data[i + 3] = 255;
        }
    }
    c.putImageData(faceImg, 0, w);

    // Dressed stone courses (3 rows of ashlar blocks on the front wall)
    const r1 = w + 13;
    const r2 = w + 27;
    c.strokeStyle = spec.mortar;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(0, r1); c.lineTo(w, r1);
    c.moveTo(0, r2); c.lineTo(w, r2);
    // Vertical joints staggered
    const off1 = (variantIdx % 2) * 10;
    c.moveTo(30 + off1, w); c.lineTo(30 + off1, r1);
    c.moveTo(72 - off1, w); c.lineTo(72 - off1, r1);
    c.moveTo(16 + off1, r1); c.lineTo(16 + off1, r2);
    c.moveTo(54, r1); c.lineTo(54, r2);
    c.moveTo(38 - off1, r2); c.lineTo(38 - off1, totalH);
    c.moveTo(80 - off1, r2); c.lineTo(80 - off1, totalH);
    c.stroke();

    // Top bevel on each course + base AO gradient
    c.strokeStyle = 'rgba(255, 245, 225, 0.14)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, r1 + 1.5); c.lineTo(w, r1 + 1.5);
    c.moveTo(0, r2 + 1.5); c.lineTo(w, r2 + 1.5);
    c.stroke();

    const baseAo = c.createLinearGradient(0, totalH - 12, 0, totalH);
    baseAo.addColorStop(0, 'rgba(0,0,0,0)');
    baseAo.addColorStop(1, 'rgba(0,0,0,0.65)');
    c.fillStyle = baseAo;
    c.fillRect(0, totalH - 12, w, 12);

    // Cracked Secret Wall: realistic structural fracture + warm golden vault glimmer
    if (isCracked) {
        c.save();
        // Dark deep fissure
        c.strokeStyle = '#070504';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(46, 36);
        c.lineTo(52, 58);
        c.lineTo(42, 78);
        c.lineTo(50, 98);
        c.lineTo(44, 118);
        c.lineTo(48, 133);
        c.moveTo(42, 78); c.lineTo(26, 88);
        c.moveTo(50, 98); c.lineTo(68, 110);
        c.stroke();

        // Glowing golden secret draft seeping out of fissure
        c.shadowColor = '#f1c40f';
        c.shadowBlur = 10;
        c.strokeStyle = 'rgba(255, 210, 85, 0.88)';
        c.lineWidth = 1.8;
        c.stroke();
        c.restore();
    }

    return off;
}

function getBiomeAtlas(biomeId) {
    if (!biomeAtlasCache[biomeId]) {
        const floors = [];
        for (let i = 0; i < 8; i++) floors.push(bakeFloorVariant(biomeId, i));
        const walls = [];
        for (let i = 0; i < 4; i++) walls.push(bakeWallVariant(biomeId, i, false));
        const crackedWall = bakeWallVariant(biomeId, 0, true);
        biomeAtlasCache[biomeId] = { floors, walls, crackedWall };
    }
    return biomeAtlasCache[biomeId];
}

// ============================================================================
// 2. REALISTIC ARCHITECTURAL DETAILS (SHADOWS, CARPET, STAIRS, TORCHES, DECALS)
// ============================================================================
function drawRealisticFloor(c, tileX, tileY, biomeId, dynamicLights) {
    const atlas = getBiomeAtlas(biomeId);
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const vIdx = (tileX * 17 + tileY * 31) % atlas.floors.length;

    c.drawImage(atlas.floors[vIdx], x, y, TILE_SIZE, TILE_SIZE);

    // Royal Throne Runner Carpet in Final Room leading to Stairs
    if (typeof rooms !== 'undefined' && rooms.length > 1) {
        const lastRoom = rooms[rooms.length - 1];
        if (tileX >= lastRoom.x && tileX < lastRoom.x + lastRoom.w &&
            tileY >= lastRoom.y && tileY < lastRoom.y + lastRoom.h &&
            (tileX === stairs.x || tileY === stairs.y)) {
            const cGrad = c.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
            cGrad.addColorStop(0, 'rgba(115, 16, 26, 0.85)');
            cGrad.addColorStop(0.5, 'rgba(148, 22, 34, 0.88)');
            cGrad.addColorStop(1, 'rgba(92, 12, 20, 0.85)');
            c.fillStyle = cGrad;
            c.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);

            c.strokeStyle = 'rgba(218, 175, 58, 0.72)';
            c.lineWidth = 1.5;
            c.strokeRect(x + 8.5, y + 8.5, TILE_SIZE - 17, TILE_SIZE - 17);
            c.strokeStyle = 'rgba(60, 8, 12, 0.6)';
            c.lineWidth = 1;
            c.strokeRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        }
    }

    // Subtle procedural dungeon bones / cobwebs in quiet corners
    const propHash = (tileX * 23 + tileY * 41) % 31;
    if (propHash === 0 && tileY > 0 && map[tileY - 1][tileX] >= 1 && tileX > 0 && map[tileY][tileX - 1] >= 1) {
        c.save();
        c.strokeStyle = 'rgba(220, 225, 235, 0.22)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(x, y); c.lineTo(x + 20, y + 5);
        c.moveTo(x, y); c.lineTo(x + 14, y + 14);
        c.moveTo(x, y); c.lineTo(x + 5, y + 20);
        c.arc(x, y, 9, 0, Math.PI * 0.5);
        c.arc(x, y, 15, 0, Math.PI * 0.5);
        c.stroke();
        c.restore();
    } else if (propHash === 4) {
        // Small weathered skull & pebble on stone
        c.save();
        c.fillStyle = 'rgba(205, 196, 178, 0.48)';
        c.beginPath();
        c.arc(x + 35, y + 14, 3.2, 0, Math.PI * 2);
        c.fill();
        c.fillRect(x + 33.5, y + 16, 3, 2);
        c.fillStyle = 'rgba(15, 12, 10, 0.8)';
        c.fillRect(x + 33.6, y + 13.5, 1.1, 1.2);
        c.fillRect(x + 35.4, y + 13.5, 1.1, 1.2);
        c.restore();
    }

    // Lava fissure glow light registration
    if (biomeId === 'lava' && vIdx % 2 === 1 && dynamicLights) {
        dynamicLights.push({
            x: x + TILE_SIZE * 0.6,
            y: y + TILE_SIZE * 0.7,
            r: 42,
            color: 'rgba(255, 95, 20, 0.14)',
            cutout: 0.25
        });
    }

    // Soft Directional Cast Shadows from adjacent Walls (Ambient Occlusion)
    if (tileY > 0 && map[tileY - 1][tileX] >= 1) {
        const nGrad = c.createLinearGradient(x, y, x, y + 22);
        nGrad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
        nGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
        nGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = nGrad;
        c.fillRect(x, y, TILE_SIZE, 22);
    }
    if (tileX > 0 && map[tileY][tileX - 1] >= 1) {
        const wGrad = c.createLinearGradient(x, y, x + 12, y);
        wGrad.addColorStop(0, 'rgba(0, 0, 0, 0.48)');
        wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = wGrad;
        c.fillRect(x, y, 12, TILE_SIZE);
    }
    if (tileX < COLS - 1 && map[tileY][tileX + 1] >= 1) {
        const eGrad = c.createLinearGradient(x + TILE_SIZE - 8, y, x + TILE_SIZE, y);
        eGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        eGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        c.fillStyle = eGrad;
        c.fillRect(x + TILE_SIZE - 8, y, 8, TILE_SIZE);
    }
}

function drawRealisticDecals(c) {
    if (typeof floorDecals === 'undefined') return;
    floorDecals.forEach(d => {
        if (!revealed[d.y] || !revealed[d.y][d.x]) return;
        const cx = d.x * TILE_SIZE + 24;
        const cy = d.y * TILE_SIZE + 27;
        const s = (d.seed || 1);

        c.save();
        if (d.type === 'blood') {
            const bGrad = c.createRadialGradient(cx, cy, 2, cx, cy, 16);
            bGrad.addColorStop(0, 'rgba(115, 6, 12, 0.85)');
            bGrad.addColorStop(0.65, 'rgba(155, 14, 22, 0.65)');
            bGrad.addColorStop(1, 'rgba(90, 5, 10, 0)');
            c.fillStyle = bGrad;
            c.beginPath();
            c.ellipse(cx, cy, 14, 9, (s % 5) * 0.3, 0, Math.PI * 2);
            c.fill();
            // Splatter droplets
            c.fillStyle = 'rgba(135, 10, 18, 0.72)';
            c.beginPath();
            c.arc(cx - 11, cy + 5, 2.8, 0, Math.PI * 2);
            c.arc(cx + 12, cy - 4, 2.2, 0, Math.PI * 2);
            c.arc(cx + 6, cy + 8, 1.8, 0, Math.PI * 2);
            c.fill();
        } else if (d.type === 'bones') {
            c.strokeStyle = 'rgba(218, 212, 195, 0.78)';
            c.lineWidth = 2.4;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(cx - 9, cy - 4); c.lineTo(cx + 9, cy + 5);
            c.moveTo(cx - 7, cy + 6); c.lineTo(cx + 8, cy - 5);
            c.stroke();
            c.fillStyle = 'rgba(226, 220, 204, 0.82)';
            c.beginPath();
            c.arc(cx + 3, cy - 2, 3.8, 0, Math.PI * 2);
            c.fill();
        } else if (d.type === 'scorch') {
            const sGrad = c.createRadialGradient(cx, cy, 2, cx, cy, 18);
            sGrad.addColorStop(0, 'rgba(8, 6, 5, 0.86)');
            sGrad.addColorStop(0.55, 'rgba(28, 16, 10, 0.62)');
            sGrad.addColorStop(0.8, 'rgba(180, 65, 15, 0.18)');
            sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = sGrad;
            c.beginPath();
            c.ellipse(cx, cy, 17, 11, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
    });
}

function drawRealisticStairs(c, tileX, tileY, cleared, phase, dynamicLights) {
    const x = tileX * TILE_SIZE;
    const y = tileY * TILE_SIZE;
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;

    c.save();
    // Carved stone frame bezel
    const bezelGrad = c.createLinearGradient(x + 4, y + 4, x + TILE_SIZE - 4, y + TILE_SIZE - 4);
    bezelGrad.addColorStop(0, '#5a5042');
    bezelGrad.addColorStop(1, '#262019');
    c.fillStyle = bezelGrad;
    c.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Recessed stairwell pit
    c.fillStyle = '#050403';
    c.fillRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16);

    // Carved descending stone steps with shadow & bevel
    const steps = 4;
    for (let i = 0; i < steps; i++) {
        const sy = y + 9 + i * 7;
        const inset = 9 + i * 2.2;
        const sw = TILE_SIZE - inset * 2;
        const shade = Math.max(22, 115 - i * 24);
        c.fillStyle = `rgb(${shade + 12}, ${shade + 4}, ${shade - 10})`;
        c.fillRect(x + inset, sy, sw, 5.5);
        c.fillStyle = 'rgba(255, 240, 200, 0.22)';
        c.fillRect(x + inset, sy, sw, 1.2);
    }

    if (cleared) {
        // Warm inviting golden-emerald portal glow from below
        const pulse = 0.75 + Math.sin(phase * 1.4) * 0.2;
        const gGrad = c.createRadialGradient(cx, cy + 6, 2, cx, cy, 24);
        gGrad.addColorStop(0, `rgba(120, 255, 185, ${0.42 * pulse})`);
        gGrad.addColorStop(0.55, `rgba(212, 175, 55, ${0.22 * pulse})`);
        gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gGrad;
        c.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        c.strokeStyle = '#d4af37';
        c.lineWidth = 1.8;
        c.strokeRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);

        if (dynamicLights) {
            dynamicLights.push({ x: cx, y: cy, r: 85, color: 'rgba(100, 240, 175, 0.20)', cutout: 0.55 });
        }
    } else {
        // Locked iron portcullis bars + crimson seal rune
        c.strokeStyle = '#485460';
        c.lineWidth = 2.2;
        for (let bx = x + 12; bx <= x + 36; bx += 8) {
            c.beginPath(); c.moveTo(bx, y + 8); c.lineTo(bx, y + 40); c.stroke();
        }
        c.beginPath();
        c.moveTo(x + 8, y + 18); c.lineTo(x + 40, y + 18);
        c.moveTo(x + 8, y + 30); c.lineTo(x + 40, y + 30);
        c.stroke();

        // Glowing crimson lock seal
        const rPulse = 0.55 + Math.sin(phase * 2) * 0.25;
        c.strokeStyle = `rgba(255, 71, 87, ${rPulse})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(cx, cy, 8, 0, Math.PI * 2);
        c.stroke();
    }
    c.restore();
}

function drawRealisticWall(c, tileX, tileY, tileType, biomeId, phase, dynamicLights) {
    const atlas = getBiomeAtlas(biomeId);
    const x = tileX * TILE_SIZE;
    const topY = tileY * TILE_SIZE - WALL_HEIGHT;
    const totalH = TILE_SIZE + WALL_HEIGHT;

    if (tileType === 2) {
        c.drawImage(atlas.crackedWall, x, topY, TILE_SIZE, totalH);
        if (dynamicLights) {
            dynamicLights.push({
                x: x + 24, y: tileY * TILE_SIZE + 16, r: 46,
                color: 'rgba(255, 205, 70, 0.16)', cutout: 0.30
            });
        }
    } else {
        const vIdx = (tileX * 13 + tileY * 29) % atlas.walls.length;
        c.drawImage(atlas.walls[vIdx], x, topY, TILE_SIZE, totalH);
    }

    // Wall Sconce Torch on south-facing walls
    if (tileType === 1 && tileY < ROWS - 1 && map[tileY + 1][tileX] === 0 && (tileX + tileY) % 4 === 0) {
        const tx = x + TILE_SIZE / 2;
        const ty = tileY * TILE_SIZE + TILE_SIZE - WALL_HEIGHT + 7;
        const sway = Math.sin(phase * 2.4 + tileX * 1.9) * 1.4;
        const stretch = Math.cos(phase * 3.1 + tileY) * 1.5;

        c.save();
        // Iron bracket & pitch cup
        c.fillStyle = '#1e2226';
        c.fillRect(tx - 2, ty + 2, 4, 9);
        c.fillStyle = '#3b4248';
        c.beginPath();
        c.moveTo(tx - 4.5, ty + 1);
        c.lineTo(tx + 4.5, ty + 1);
        c.lineTo(tx + 2.5, ty + 5);
        c.lineTo(tx - 2.5, ty + 5);
        c.closePath();
        c.fill();

        // Outer flame halo
        const fGrad = c.createRadialGradient(tx + sway * 0.4, ty - 3, 1, tx, ty - 2, 13);
        fGrad.addColorStop(0, 'rgba(255, 240, 150, 0.95)');
        fGrad.addColorStop(0.45, 'rgba(255, 125, 25, 0.65)');
        fGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
        c.fillStyle = fGrad;
        c.beginPath();
        c.arc(tx, ty - 2, 13, 0, Math.PI * 2);
        c.fill();

        // Organic flame tongue
        c.fillStyle = '#ff6b1a';
        c.beginPath();
        c.moveTo(tx - 3.8, ty + 1);
        c.quadraticCurveTo(tx - 4.5, ty - 5, tx + sway, ty - 10 - stretch);
        c.quadraticCurveTo(tx + 4.5, ty - 5, tx + 3.8, ty + 1);
        c.closePath();
        c.fill();

        // Hot white-gold inner core
        c.fillStyle = '#fff5b8';
        c.beginPath();
        c.moveTo(tx - 1.8, ty + 1);
        c.quadraticCurveTo(tx - 2, ty - 3, tx + sway * 0.5, ty - 6 - stretch * 0.5);
        c.quadraticCurveTo(tx + 2, ty - 3, tx + 1.8, ty + 1);
        c.closePath();
        c.fill();
        c.restore();

        if (dynamicLights) {
            dynamicLights.push({
                x: tx,
                y: tileY * TILE_SIZE + TILE_SIZE + 4,
                r: 92 + stretch * 4,
                color: 'rgba(255, 150, 48, 0.20)',
                cutout: 0.52
            });
        }
    }
}

// ============================================================================
// 3. REALISTIC SHADED 2.5D CHARACTER, MONSTER & PROP MINIATURES
// ============================================================================
function drawSoftGroundShadow(c, cx, cy, rx = 16, ry = 6.5) {
    c.save();
    const sGrad = c.createRadialGradient(cx, cy, 1, cx, cy, rx);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    sGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.38)');
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = sGrad;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
}

function drawHeroFigure(c, role, cx, baseY, phase = 0, scale = 1.0, flashColor = null) {
    c.save();
    c.translate(cx, baseY);
    c.scale(scale, scale);

    if (flashColor) {
        c.shadowColor = flashColor;
        c.shadowBlur = 14;
    }

    if (role === 'Warrior') {
        // Flowing crimson battle cloak behind armor
        const cloakGrad = c.createLinearGradient(-12, -32, 12, -4);
        cloakGrad.addColorStop(0, '#8f1d24');
        cloakGrad.addColorStop(1, '#420a0e');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-9, -30);
        c.quadraticCurveTo(-15, -14, -12 + Math.sin(phase) * 1.2, -3);
        c.lineTo(10, -3);
        c.quadraticCurveTo(13, -16, 9, -30);
        c.closePath();
        c.fill();

        // Steel armored sabatons / legs
        c.fillStyle = flashColor || '#485460';
        c.fillRect(-7, -10, 5, 9);
        c.fillRect(2, -10, 5, 9);
        c.fillStyle = flashColor || '#95a5a6';
        c.fillRect(-6, -10, 2, 7);
        c.fillRect(3, -10, 2, 7);

        // Brushed steel plate cuirass & crimson surcoat
        const plateGrad = c.createLinearGradient(-10, -28, 10, -10);
        plateGrad.addColorStop(0, '#dfe6e9');
        plateGrad.addColorStop(0.45, '#7f8fa6');
        plateGrad.addColorStop(1, '#2f3640');
        c.fillStyle = flashColor || plateGrad;
        c.beginPath();
        c.roundRect(-10, -29, 20, 20, 4);
        c.fill();

        // Crimson tabard & golden cross heraldry
        c.fillStyle = flashColor || '#b32428';
        c.fillRect(-5, -25, 10, 15);
        c.fillStyle = flashColor || '#f1c40f';
        c.fillRect(-1, -24, 2, 12);
        c.fillRect(-4, -20, 8, 2);

        // Layered steel pauldrons
        c.fillStyle = flashColor || '#b2bec3';
        c.beginPath(); c.arc(-10, -26, 5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(10, -26, 5, 0, Math.PI * 2); c.fill();

        // Crusader Greathelm with brass cross & glowing visor slit
        const helmGrad = c.createLinearGradient(-7, -42, 7, -28);
        helmGrad.addColorStop(0, '#f5f6fa');
        helmGrad.addColorStop(0.5, '#8395a7');
        helmGrad.addColorStop(1, '#353b48');
        c.fillStyle = flashColor || helmGrad;
        c.beginPath();
        c.roundRect(-7, -42, 14, 14, [6, 6, 3, 3]);
        c.fill();
        c.strokeStyle = '#1e272e';
        c.lineWidth = 1;
        c.stroke();

        // Brass cross & visor eye slit
        c.fillStyle = flashColor || '#d4af37';
        c.fillRect(-1, -41, 2, 12);
        c.fillRect(-6, -36, 12, 2);
        c.fillStyle = '#0f1419';
        c.fillRect(-5, -36, 10, 1.8);
        c.fillStyle = '#70d6ff';
        c.fillRect(-4, -35.8, 3, 1.3);
        c.fillRect(1, -35.8, 3, 1.3);

        // Broadsword (right hand, raised steel blade catching light)
        c.save();
        c.translate(12, -22);
        c.rotate(0.18 + Math.sin(phase * 0.8) * 0.04);
        const bladeGrad = c.createLinearGradient(-2, -22, 3, 0);
        bladeGrad.addColorStop(0, '#ffffff');
        bladeGrad.addColorStop(0.5, '#c8d6e5');
        bladeGrad.addColorStop(1, '#576574');
        c.fillStyle = flashColor || bladeGrad;
        c.beginPath();
        c.moveTo(0, -23);
        c.lineTo(3, -18);
        c.lineTo(2.5, 0);
        c.lineTo(-2.5, 0);
        c.lineTo(-3, -18);
        c.closePath();
        c.fill();
        // Golden crossguard & pommel
        c.fillStyle = flashColor || '#d4af37';
        c.fillRect(-5.5, -1, 11, 2.5);
        c.fillRect(-1.5, 1.5, 3, 4);
        c.restore();

        // Heavy Kite Shield (left arm)
        const shGrad = c.createLinearGradient(-17, -27, -5, -8);
        shGrad.addColorStop(0, '#d4af37');
        shGrad.addColorStop(0.2, '#2980b9');
        shGrad.addColorStop(0.85, '#192a56');
        shGrad.addColorStop(1, '#0c1630');
        c.fillStyle = flashColor || shGrad;
        c.beginPath();
        c.moveTo(-16, -26);
        c.lineTo(-5, -26);
        c.lineTo(-5, -16);
        c.quadraticCurveTo(-10.5, -7, -10.5, -7);
        c.quadraticCurveTo(-16, -16, -16, -16);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || '#f1c40f';
        c.lineWidth = 1.5;
        c.stroke();
    } else if (role === 'Ranger') {
        // Quiver of arrows on back
        c.fillStyle = flashColor || '#5c3416';
        c.save();
        c.translate(-7, -30);
        c.rotate(-0.28);
        c.fillRect(-2.5, -8, 5, 14);
        c.fillStyle = flashColor || '#ecf0f1';
        c.fillRect(-2, -12, 1.4, 5);
        c.fillRect(0.8, -13, 1.4, 6);
        c.restore();

        // Forest ranger cloak
        const cloakGrad = c.createLinearGradient(-11, -34, 11, -3);
        cloakGrad.addColorStop(0, '#1e6f50');
        cloakGrad.addColorStop(1, '#0c3324');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-8, -30);
        c.quadraticCurveTo(-14, -14, -11 + Math.sin(phase) * 1.5, -3);
        c.lineTo(10, -3);
        c.quadraticCurveTo(12, -16, 8, -30);
        c.closePath();
        c.fill();

        // Leather boots
        c.fillStyle = flashColor || '#4a2a12';
        c.fillRect(-6, -10, 4.5, 9);
        c.fillRect(1.5, -10, 4.5, 9);

        // Studded leather brigandine & belt
        const leatherGrad = c.createLinearGradient(-8, -28, 8, -10);
        leatherGrad.addColorStop(0, '#8c5428');
        leatherGrad.addColorStop(1, '#4a2810');
        c.fillStyle = flashColor || leatherGrad;
        c.beginPath();
        c.roundRect(-8.5, -28, 17, 18, 3);
        c.fill();
        c.fillStyle = flashColor || '#d4af37';
        c.fillRect(-8.5, -16, 17, 2.4);
        c.strokeStyle = flashColor || '#b89456';
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-6, -27); c.lineTo(6, -13); c.stroke();

        // Deep hooded head with shadowed face & keen emerald eyes
        c.fillStyle = flashColor || '#1b6347';
        c.beginPath();
        c.arc(0, -35, 8, Math.PI * 0.85, Math.PI * 2.15);
        c.lineTo(7, -28);
        c.lineTo(-7, -28);
        c.closePath();
        c.fill();
        // Hood peak
        c.beginPath();
        c.moveTo(-6, -39); c.lineTo(0, -44); c.lineTo(6, -39);
        c.fill();
        // Shadowed face & glowing emerald eyes
        c.fillStyle = flashColor || '#16120e';
        c.beginPath(); c.arc(0, -34, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#55efc4';
        c.fillRect(-3.2, -35, 2.2, 1.5);
        c.fillRect(1.0, -35, 2.2, 1.5);

        // Curved Recurve Bow & Nocked Steel Arrow (right side)
        c.save();
        c.translate(11, -21);
        c.strokeStyle = flashColor || '#b37436';
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(-3, 0, 13, -Math.PI * 0.44, Math.PI * 0.44);
        c.stroke();
        // Taut bowstring
        c.strokeStyle = 'rgba(235, 240, 245, 0.75)';
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(-0.5, -12.5);
        c.lineTo(-4, 0);
        c.lineTo(-0.5, 12.5);
        c.stroke();
        // Nocked arrow
        c.strokeStyle = flashColor || '#dfe6e9';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-4, 0); c.lineTo(12, 0);
        c.stroke();
        c.fillStyle = '#00cec9';
        c.beginPath();
        c.moveTo(14, 0); c.lineTo(10, -2.5); c.lineTo(10, 2.5);
        c.closePath();
        c.fill();
        c.restore();
    } else if (role === 'Cleric') {
        // Soft golden halo behind head
        c.save();
        c.strokeStyle = flashColor || 'rgba(248, 212, 72, 0.78)';
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, -36, 10.5, 0, Math.PI * 2);
        c.stroke();
        c.restore();

        // Flowing ivory & gold-trimmed vestments
        const robeGrad = c.createLinearGradient(-11, -30, 11, -2);
        robeGrad.addColorStop(0, '#f7f4eb');
        robeGrad.addColorStop(0.65, '#d8d0be');
        robeGrad.addColorStop(1, '#8f846e');
        c.fillStyle = flashColor || robeGrad;
        c.beginPath();
        c.moveTo(-8, -29);
        c.lineTo(-12, -2);
        c.lineTo(12, -2);
        c.lineTo(8, -29);
        c.closePath();
        c.fill();

        // Golden stole / tabard
        c.fillStyle = flashColor || '#d4af37';
        c.fillRect(-3.5, -28, 7, 25);
        c.fillStyle = flashColor || '#2ecc71';
        c.fillRect(-1.5, -25, 3, 18);

        // Hooded head & serene face
        c.fillStyle = flashColor || '#f5f2e8';
        c.beginPath();
        c.arc(0, -35, 7.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = flashColor || '#f3cfa4';
        c.beginPath();
        c.arc(0, -34, 4.8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2c3e50';
        c.fillRect(-2.6, -35, 1.6, 1.6);
        c.fillRect(1.0, -35, 1.6, 1.6);
        // Golden circlet
        c.strokeStyle = flashColor || '#f1c40f';
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, -36, 5.5, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();

        // Ornate Sun-Staff with levitating emerald/cyan crystal
        c.save();
        c.translate(12, -18);
        c.fillStyle = flashColor || '#c89b2b';
        c.fillRect(-1.3, -18, 2.6, 34);
        c.strokeStyle = flashColor || '#ffeaa7';
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, -21, 5, 0, Math.PI * 2);
        c.stroke();
        // Glowing jewel
        const gemY = -21 + Math.sin(phase * 2) * 1.2;
        c.fillStyle = '#55efc4';
        c.shadowColor = '#00ffff';
        c.shadowBlur = 8;
        c.beginPath();
        c.moveTo(0, gemY - 3.5);
        c.lineTo(3, gemY);
        c.lineTo(0, gemY + 3.5);
        c.lineTo(-3, gemY);
        c.closePath();
        c.fill();
        c.restore();
    } else {
        // Control / Arcane Battlemage
        const robeGrad = c.createLinearGradient(-12, -30, 12, -2);
        robeGrad.addColorStop(0, '#6c42b8');
        robeGrad.addColorStop(0.6, '#3b1f70');
        robeGrad.addColorStop(1, '#1a0c36');
        c.fillStyle = flashColor || robeGrad;
        c.beginPath();
        c.moveTo(-8, -29);
        c.lineTo(-13, -2);
        c.lineTo(13, -2);
        c.lineTo(8, -29);
        c.closePath();
        c.fill();

        // Gold arcane trim & mantle
        c.strokeStyle = flashColor || '#f1c40f';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(-4, -28); c.lineTo(-6, -3);
        c.moveTo(4, -28); c.lineTo(6, -3);
        c.stroke();

        // Shadowed face with glowing cyan arcane eyes
        c.fillStyle = flashColor || '#130924';
        c.beginPath(); c.arc(0, -34, 5.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#00ffff';
        c.shadowColor = '#00ffff';
        c.shadowBlur = 6;
        c.fillRect(-3.2, -34.5, 2.3, 1.6);
        c.fillRect(0.9, -34.5, 2.3, 1.6);
        c.shadowBlur = 0;

        // Classic pointed Archmage Hat & wide curved brim
        const hatGrad = c.createLinearGradient(-8, -50, 8, -35);
        hatGrad.addColorStop(0, '#8c5ce6');
        hatGrad.addColorStop(1, '#2d1657');
        c.fillStyle = flashColor || hatGrad;
        c.beginPath();
        c.ellipse(0, -37, 12.5, 3.6, -0.05, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(-7.5, -37);
        c.quadraticCurveTo(-2, -48, 4, -52);
        c.quadraticCurveTo(5, -44, 7.5, -37);
        c.closePath();
        c.fill();
        // Hat gold band
        c.fillStyle = flashColor || '#f1c40f';
        c.fillRect(-7, -39, 14, 2.2);

        // Gnarled Staff & Floating Fire/Arcane Orb
        c.save();
        c.translate(12, -18);
        c.strokeStyle = flashColor || '#5c3818';
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(0, 16);
        c.lineTo(0, -14);
        c.arc(-2, -18, 4.5, 0.2, Math.PI * 1.6);
        c.stroke();

        const orbY = -20 + Math.cos(phase * 2.2) * 1.5;
        const orbGrad = c.createRadialGradient(-1, orbY, 1, -1, orbY, 6);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.45, '#e056fd');
        orbGrad.addColorStop(1, 'rgba(142, 68, 173, 0)');
        c.fillStyle = orbGrad;
        c.beginPath();
        c.arc(-1, orbY, 6, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }

    c.restore();
}

function drawEnemyFigure(c, enemy, cx, baseY, phase = 0, flashColor = null) {
    c.save();
    c.translate(cx, baseY);

    if (flashColor) {
        c.shadowColor = flashColor;
        c.shadowBlur = 16;
    }

    if (enemy.isBoss && enemy.bossTier === 10) {
        // COLOSSAL GRAND BOSS (Dread Overlord / Wyrm / Balrog / Void Emperor)
        const bZone = enemy.bossBiome || 'crypt';
        const palette = {
            crypt: { cape: '#133b22', armor: '#2d3436', glow: '#2ecc71', trim: '#d4af37' },
            ice:   { cape: '#13385c', armor: '#54a0ff', glow: '#00ffff', trim: '#dff9fb' },
            lava:  { cape: '#4f110c', armor: '#2c1816', glow: '#ff5e00', trim: '#f1c40f' },
            void:  { cape: '#2a1045', armor: '#1b112e', glow: '#e056fd', trim: '#00ffff' }
        }[bZone] || { cape: '#3a144a', armor: '#2d3436', glow: '#ff4757', trim: '#f1c40f' };

        const wingSpread = Math.sin(phase * 1.4) * 2.5;
        // Sweeping demonic/draconic wings / tattered royal mantle
        c.fillStyle = flashColor || palette.cape;
        c.beginPath();
        c.moveTo(0, -34);
        c.quadraticCurveTo(-26 - wingSpread, -46, -24 - wingSpread, -16);
        c.quadraticCurveTo(-15, -20, -11, -5);
        c.lineTo(11, -5);
        c.quadraticCurveTo(15, -20, 24 + wingSpread, -16);
        c.quadraticCurveTo(26 + wingSpread, -46, 0, -34);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || palette.glow;
        c.lineWidth = 1.2;
        c.stroke();

        // Hulking armored torso
        const torsoGrad = c.createLinearGradient(-13, -38, 13, -6);
        torsoGrad.addColorStop(0, palette.trim);
        torsoGrad.addColorStop(0.25, palette.armor);
        torsoGrad.addColorStop(1, '#0b0b0e');
        c.fillStyle = flashColor || torsoGrad;
        c.beginPath();
        c.roundRect(-12, -36, 24, 30, 5);
        c.fill();

        // Blazing elemental chest core
        const coreGrad = c.createRadialGradient(0, -24, 1, 0, -24, 8);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.45, palette.glow);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = coreGrad;
        c.beginPath(); c.arc(0, -24, 8, 0, Math.PI * 2); c.fill();

        // Spiked Pauldrons
        c.fillStyle = flashColor || palette.armor;
        c.beginPath();
        c.moveTo(-11, -35); c.lineTo(-21, -41); c.lineTo(-15, -27); c.closePath(); c.fill();
        c.beginPath();
        c.moveTo(11, -35); c.lineTo(21, -41); c.lineTo(15, -27); c.closePath(); c.fill();

        // Crowned Skull / Horned Dread Visage
        c.fillStyle = flashColor || '#141418';
        c.beginPath(); c.arc(0, -42, 8.5, 0, Math.PI * 2); c.fill();
        // Curved Great Horns + Floating Crown
        c.strokeStyle = flashColor || palette.trim;
        c.lineWidth = 2.6;
        c.beginPath();
        c.moveTo(-5, -46); c.quadraticCurveTo(-15, -54, -11, -58);
        c.moveTo(5, -46);  c.quadraticCurveTo(15, -54, 11, -58);
        c.stroke();
        // Blazing Boss Eyes
        c.fillStyle = palette.glow;
        c.shadowColor = palette.glow;
        c.shadowBlur = 8;
        c.fillRect(-4.5, -43, 3.2, 2.0);
        c.fillRect(1.3, -43, 3.2, 2.0);
        c.shadowBlur = 0;

        // Runic Dreadblade / Greatsword
        c.save();
        c.translate(16, -24);
        c.rotate(0.22);
        c.fillStyle = flashColor || palette.glow;
        c.beginPath();
        c.moveTo(0, -26); c.lineTo(4, -18); c.lineTo(3, 6); c.lineTo(-3, 6); c.lineTo(-4, -18);
        c.closePath();
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(-0.8, -21, 1.6, 22);
        c.fillStyle = palette.trim;
        c.fillRect(-6, 5, 12, 2.8);
        c.restore();
    } else if (enemy.isBoss) {
        // TIER 5 MINI-BOSS (Armored Warden / Wendigo / Magma Juggernaut / Void Executioner)
        const bColor = enemy.color || '#e67e22';
        const bodyGrad = c.createLinearGradient(-12, -36, 12, -4);
        bodyGrad.addColorStop(0, '#7f8fa6');
        bodyGrad.addColorStop(0.5, '#2f3640');
        bodyGrad.addColorStop(1, '#14171c');
        c.fillStyle = flashColor || bodyGrad;
        c.beginPath();
        c.roundRect(-11, -33, 22, 28, 5);
        c.fill();
        c.strokeStyle = flashColor || bColor;
        c.lineWidth = 1.5;
        c.stroke();

        // Horns & Visor
        c.fillStyle = flashColor || '#2f3640';
        c.beginPath(); c.arc(0, -38, 7.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#dcdde1';
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(-5, -41); c.lineTo(-12, -49);
        c.moveTo(5, -41);  c.lineTo(12, -49);
        c.stroke();

        c.fillStyle = bColor;
        c.shadowColor = bColor;
        c.shadowBlur = 7;
        c.fillRect(-4, -39, 3, 2);
        c.fillRect(1, -39, 3, 2);
        c.shadowBlur = 0;

        // Twin-bladed Warden Greataxe
        c.save();
        c.translate(14, -22);
        c.fillStyle = '#8c5828';
        c.fillRect(-1.5, -18, 3, 30);
        c.fillStyle = flashColor || '#dfe6e9';
        c.beginPath();
        c.moveTo(0, -16);
        c.quadraticCurveTo(10, -21, 9, -8);
        c.quadraticCurveTo(4, -5, 0, -8);
        c.quadraticCurveTo(-4, -5, -9, -8);
        c.quadraticCurveTo(-10, -21, 0, -16);
        c.fill();
        c.restore();
    } else if (enemy.isMimic) {
        // CURSED CHEST MIMIC (Jagged fangs + writhing tongue + predatory eyes)
        c.fillStyle = flashColor || '#5c2d12';
        c.fillRect(-13, -18, 26, 15);
        c.strokeStyle = '#7f8fa6';
        c.lineWidth = 2;
        c.strokeRect(-13, -18, 26, 15);

        // Dark gaping maw
        c.fillStyle = '#140508';
        c.fillRect(-11, -24, 22, 10);

        // Upper lid tilted back
        c.save();
        c.translate(0, -22);
        c.rotate(-0.22 + Math.sin(phase * 3) * 0.08);
        c.fillStyle = flashColor || '#7d3f1a';
        c.beginPath();
        c.roundRect(-13, -10, 26, 10, [5, 5, 0, 0]);
        c.fill();
        c.strokeStyle = '#95a5a6';
        c.stroke();
        // Glowing Mimic Eyes
        c.fillStyle = '#ff0044';
        c.fillRect(-7, -6, 3, 2.5);
        c.fillRect(4, -6, 3, 2.5);
        c.restore();

        // Ivory fangs
        c.fillStyle = '#f5f6fa';
        for (let fx = -9; fx <= 7; fx += 4) {
            c.beginPath(); c.moveTo(fx, -23); c.lineTo(fx + 2, -19); c.lineTo(fx + 4, -23); c.fill();
            c.beginPath(); c.moveTo(fx, -14); c.lineTo(fx + 2, -18); c.lineTo(fx + 4, -14); c.fill();
        }
        // Writhing crimson tongue
        c.strokeStyle = '#e84393';
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, -16);
        c.quadraticCurveTo(6, -12, 9 + Math.sin(phase * 3) * 3, -7);
        c.stroke();
    } else if (enemy.name && (enemy.name.includes('Skeleton') || enemy.name.includes('Guard'))) {
        // FALLEN DARK SKELETON / UNDEAD HALBERDIER
        const accent = enemy.affix ? (enemy.color || '#e84118') : '#e84118';
        // Tattered burial shroud
        c.fillStyle = flashColor || '#262b34';
        c.beginPath();
        c.moveTo(-8, -28); c.lineTo(-11, -5); c.lineTo(9, -5); c.lineTo(8, -28);
        c.closePath();
        c.fill();

        // Articulated ivory ribcage & spine
        c.strokeStyle = flashColor || '#dcdde1';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -28); c.lineTo(0, -12);
        c.moveTo(-5, -25); c.lineTo(5, -25);
        c.moveTo(-6, -21); c.lineTo(6, -21);
        c.moveTo(-4, -17); c.lineTo(4, -17);
        // Skeletal legs
        c.moveTo(-3, -12); c.lineTo(-4, -2);
        c.moveTo(3, -12);  c.lineTo(4, -2);
        c.stroke();

        // Detailed Skull & Rusted Iron Helm
        c.fillStyle = flashColor || '#ecf0f1';
        c.beginPath(); c.arc(0, -34, 6, 0, Math.PI * 2); c.fill();
        c.fillRect(-3, -30, 6, 3);
        c.fillStyle = flashColor || '#485460';
        c.beginPath(); c.arc(0, -36, 6.6, Math.PI, Math.PI * 2); c.fill();

        // Blazing Undead Eye Sockets
        c.fillStyle = accent;
        c.shadowColor = accent;
        c.shadowBlur = 5;
        c.fillRect(-3.4, -35, 2.2, 2.0);
        c.fillRect(1.2, -35, 2.2, 2.0);
        c.shadowBlur = 0;

        // Steel Halberd
        c.save();
        c.translate(10, -18);
        c.fillStyle = '#6e4720';
        c.fillRect(-1, -20, 2.2, 34);
        c.fillStyle = flashColor || '#bdc3c7';
        c.beginPath();
        c.moveTo(0, -24); c.lineTo(6, -15); c.lineTo(1, -10); c.lineTo(0, -20);
        c.closePath();
        c.fill();
        c.restore();
    } else {
        // TRANSLUCENT GELATINOUS PLAGUE SLIME (with internal floating skull & glossy sheen!)
        const baseCol = enemy.affix ? (enemy.color || '#e84118') : '#c23616';
        const squishX = 1 + Math.sin(phase * 2.1) * 0.07;
        const squishY = 1 - Math.sin(phase * 2.1) * 0.07;
        c.scale(squishX, squishY);

        // Internal digested skull silhouette inside translucent ooze!
        c.fillStyle = 'rgba(235, 230, 210, 0.42)';
        c.beginPath(); c.arc(-2, -14, 4.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(20, 10, 10, 0.5)';
        c.fillRect(-3.8, -15, 1.4, 1.4);
        c.fillRect(-1.4, -15, 1.4, 1.4);

        // Translucent 3D dome body
        const slimeGrad = c.createRadialGradient(-4, -18, 2, 0, -12, 16);
        slimeGrad.addColorStop(0, '#ff9f7f');
        slimeGrad.addColorStop(0.35, baseCol);
        slimeGrad.addColorStop(1, 'rgba(65, 10, 8, 0.92)');
        c.fillStyle = flashColor || slimeGrad;
        c.beginPath();
        c.moveTo(-14, -4);
        c.quadraticCurveTo(-15, -24, 0, -25);
        c.quadraticCurveTo(15, -24, 14, -4);
        c.quadraticCurveTo(7, -1, 0, -2.5);
        c.quadraticCurveTo(-7, -1, -14, -4);
        c.closePath();
        c.fill();

        // Predatory glowing eyes
        c.fillStyle = '#fffa65';
        c.beginPath();
        c.arc(-4.5, -12, 2.0, 0, Math.PI * 2);
        c.arc(4.5, -12, 2.0, 0, Math.PI * 2);
        c.fill();

        // Wet specular highlight arc
        c.strokeStyle = 'rgba(255, 255, 255, 0.62)';
        c.lineWidth = 2.0;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(-3, -15, 7.5, Math.PI * 1.12, Math.PI * 1.52);
        c.stroke();
    }

    c.restore();
}

function drawPropMiniature(c, type, tileX, tileY, state = {}, phase = 0) {
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const baseY = tileY * TILE_SIZE + TILE_SIZE - 8;

    c.save();
    if (type === 'chest') {
        drawSoftGroundShadow(c, cx, baseY + 2, 16, 6);
        c.translate(cx, baseY);

        // Oak chest base
        const woodGrad = c.createLinearGradient(-13, -18, 13, 0);
        woodGrad.addColorStop(0, '#9c5522');
        woodGrad.addColorStop(1, '#4a240b');
        c.fillStyle = woodGrad;
        c.beginPath();
        c.roundRect(-13, -15, 26, 14, 2);
        c.fill();

        if (state.opened) {
            // Open chest interior overflowing with gold & gems
            c.fillStyle = '#1a0d05';
            c.fillRect(-11, -15, 22, 6);
            c.fillStyle = '#f1c40f';
            c.beginPath();
            c.arc(-4, -12, 4, 0, Math.PI * 2);
            c.arc(3, -12, 4.5, 0, Math.PI * 2);
            c.arc(0, -13, 3.5, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#00ffff';
            c.fillRect(-1, -15, 3, 3);

            // Tilted back lid
            c.fillStyle = '#6e3814';
            c.beginPath();
            c.roundRect(-13, -24, 26, 8, [4, 4, 0, 0]);
            c.fill();
        } else {
            // Domed closed lid
            const lidGrad = c.createLinearGradient(0, -25, 0, -14);
            lidGrad.addColorStop(0, '#b8682c');
            lidGrad.addColorStop(1, '#6e3914');
            c.fillStyle = lidGrad;
            c.beginPath();
            c.roundRect(-13.5, -24, 27, 10, [6, 6, 1, 1]);
            c.fill();
        }

        // Iron reinforcement straps & golden lockplate
        c.fillStyle = '#7f8fa6';
        c.fillRect(-9, -23, 3, 22);
        c.fillRect(6, -23, 3, 22);
        c.strokeStyle = '#2f3640';
        c.lineWidth = 1;
        c.strokeRect(-13, -15, 26, 14);
        c.fillStyle = '#f1c40f';
        c.fillRect(-2.5, -17, 5, 6);
        c.fillStyle = '#1e272e';
        c.fillRect(-0.8, -15, 1.6, 2.8);
    } else if (type === 'loot') {
        const bob = Math.sin(phase * 2 + tileX) * 2;
        drawSoftGroundShadow(c, cx, baseY + 2, 11, 4.5);
        c.translate(cx, baseY + bob);

        const col = state.category === 'equipment'
            ? { main: '#8e44ad', hi: '#d29bfe', beam: 'rgba(197, 108, 240, 0.28)' }
            : (state.category === 'item'
                ? { main: '#27ae60', hi: '#7bed9f', beam: 'rgba(46, 204, 113, 0.25)' }
                : { main: '#d49b1a', hi: '#ffeaa7', beam: 'rgba(241, 196, 15, 0.28)' });

        // Vertical loot rarity light pillar
        const bGrad = c.createLinearGradient(0, -34, 0, 0);
        bGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bGrad.addColorStop(1, col.beam);
        c.fillStyle = bGrad;
        c.fillRect(-7, -34, 14, 34);

        // Tied leather/velvet pouch
        const pGrad = c.createRadialGradient(-2, -10, 1, 0, -8, 10);
        pGrad.addColorStop(0, col.hi);
        pGrad.addColorStop(0.55, col.main);
        pGrad.addColorStop(1, '#1e140c');
        c.fillStyle = pGrad;
        c.beginPath();
        c.arc(0, -8, 8.5, 0, Math.PI * 2);
        c.fill();
        // Pouch tie neck & gold cord
        c.fillStyle = col.main;
        c.beginPath();
        c.moveTo(-4, -15); c.lineTo(-6, -20); c.lineTo(6, -20); c.lineTo(4, -15);
        c.closePath();
        c.fill();
        c.fillStyle = '#f1c40f';
        c.fillRect(-4.5, -16, 9, 2);
    } else if (type === 'merchant') {
        const bob = Math.sin(phase * 1.1) * 1.2;
        drawSoftGroundShadow(c, cx, baseY + 2, 18, 7);
        c.translate(cx, baseY + bob);

        // Woven rug beneath merchant
        c.fillStyle = 'rgba(142, 45, 32, 0.65)';
        c.beginPath(); c.ellipse(0, 1, 18, 6, 0, 0, Math.PI * 2); c.fill();

        // Bulging peddler's pack on back
        c.fillStyle = '#6e411f';
        c.beginPath(); c.arc(-7, -23, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#d4af37';
        c.fillRect(-13, -24, 10, 2);

        // Traveler's emerald-trimmed coat
        const coatGrad = c.createLinearGradient(-10, -30, 10, -2);
        coatGrad.addColorStop(0, '#218c5b');
        coatGrad.addColorStop(1, '#103b28');
        c.fillStyle = coatGrad;
        c.beginPath();
        c.roundRect(-9, -29, 18, 26, 4);
        c.fill();
        c.fillStyle = '#f1c40f';
        c.fillRect(-2, -28, 4, 24);

        // Hood & turban/hat + friendly bearded face
        c.fillStyle = '#f3cfa4';
        c.beginPath(); c.arc(0, -34, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#dfe6e9';
        c.beginPath(); c.arc(0, -31.5, 4, 0, Math.PI); c.fill();
        c.fillStyle = '#1e704a';
        c.beginPath(); c.ellipse(0, -37.5, 8.5, 4.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f1c40f';
        c.beginPath(); c.arc(0, -37, 2, 0, Math.PI * 2); c.fill();

        // Hanging warm brass lantern
        c.strokeStyle = '#5c3818';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(9, -2); c.lineTo(12, -28); c.lineTo(16, -26);
        c.stroke();
        c.fillStyle = '#ffdd59';
        c.shadowColor = '#ffa502';
        c.shadowBlur = 10;
        c.beginPath(); c.arc(16, -22, 3.8, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
    } else if (type === 'shrine') {
        drawSoftGroundShadow(c, cx, baseY + 2, 17, 6.5);
        c.translate(cx, baseY);
        if (state.used) c.globalAlpha = 0.45;

        // Stepped Gothic stone pedestal
        c.fillStyle = '#485460';
        c.fillRect(-13, -6, 26, 6);
        c.fillStyle = '#718093';
        c.fillRect(-10, -11, 20, 5);
        const pillarGrad = c.createLinearGradient(-7, -26, 7, -11);
        pillarGrad.addColorStop(0, '#bdc3c7');
        pillarGrad.addColorStop(1, '#353b48');
        c.fillStyle = pillarGrad;
        c.fillRect(-6.5, -26, 13, 15);
        c.fillStyle = '#95a5a6';
        c.fillRect(-9, -28, 18, 3);

        // Levitating cyan crystal prism
        const floatY = -36 + (state.used ? 0 : Math.sin(phase * 1.8) * 2.5);
        if (!state.used) {
            c.shadowColor = '#00ffff';
            c.shadowBlur = 14;
        }
        const crysGrad = c.createLinearGradient(-5, floatY - 8, 5, floatY + 8);
        crysGrad.addColorStop(0, '#ffffff');
        crysGrad.addColorStop(0.45, '#00ffff');
        crysGrad.addColorStop(1, '#0984e3');
        c.fillStyle = crysGrad;
        c.beginPath();
        c.moveTo(0, floatY - 9);
        c.lineTo(6, floatY);
        c.lineTo(0, floatY + 9);
        c.lineTo(-6, floatY);
        c.closePath();
        c.fill();
        c.shadowBlur = 0;
    } else if (type === 'campfire') {
        drawSoftGroundShadow(c, cx, baseY + 1, 18, 7);
        c.translate(cx, baseY);

        // Ring of river cobblestones
        const stones = [
            [-13, -2], [-9, 2], [-3, 4], [4, 4], [10, 2], [13, -2], [9, -6], [-9, -6]
        ];
        stones.forEach(([sx, sy]) => {
            c.fillStyle = '#576574';
            c.beginPath(); c.ellipse(sx, sy, 3.8, 2.6, 0, 0, Math.PI * 2); c.fill();
        });

        // Crossed charred firewood logs
        c.strokeStyle = '#4a2810';
        c.lineWidth = 4;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-10, 1); c.lineTo(10, -6);
        c.moveTo(-9, -6); c.lineTo(10, 1);
        c.stroke();

        if (!state.used) {
            const sway = Math.sin(phase * 3) * 1.8;
            const hBoost = Math.cos(phase * 2.5) * 2;
            // Glowing ember bed
            c.fillStyle = '#ff4757';
            c.beginPath(); c.ellipse(0, -3, 7, 3, 0, 0, Math.PI * 2); c.fill();

            // Multi-layered dancing campfire flames
            c.shadowColor = '#ff7f50';
            c.shadowBlur = 12;
            c.fillStyle = '#eb2f06';
            c.beginPath();
            c.moveTo(-8, -3);
            c.quadraticCurveTo(-9, -15, sway, -25 - hBoost);
            c.quadraticCurveTo(9, -15, 8, -3);
            c.closePath();
            c.fill();

            c.fillStyle = '#fa983a';
            c.beginPath();
            c.moveTo(-5, -3);
            c.quadraticCurveTo(-5, -12, sway * 0.6, -19 - hBoost * 0.6);
            c.quadraticCurveTo(5, -12, 5, -3);
            c.closePath();
            c.fill();

            c.fillStyle = '#fff2a6';
            c.beginPath();
            c.moveTo(-2.5, -3);
            c.quadraticCurveTo(-2, -9, sway * 0.3, -12);
            c.quadraticCurveTo(2, -9, 2.5, -3);
            c.closePath();
            c.fill();
            c.shadowBlur = 0;
        } else {
            // Smoldering ash
            c.fillStyle = 'rgba(130, 130, 135, 0.55)';
            c.beginPath(); c.ellipse(0, -3, 6, 2.5, 0, 0, Math.PI * 2); c.fill();
        }
    } else if (type === 'trap') {
        const x = tileX * TILE_SIZE;
        const y = tileY * TILE_SIZE;
        c.fillStyle = 'rgba(20, 24, 28, 0.85)';
        c.fillRect(x + 8, y + 10, TILE_SIZE - 16, TILE_SIZE - 20);
        c.strokeStyle = '#576574';
        c.lineWidth = 1.4;
        c.strokeRect(x + 8, y + 10, TILE_SIZE - 16, TILE_SIZE - 20);

        if (state.trapType === 'poison') {
            c.fillStyle = 'rgba(46, 204, 113, 0.45)';
            c.beginPath(); c.arc(cx, y + 24, 9, 0, Math.PI * 2); c.fill();
        } else if (state.trapType === 'teleport') {
            c.strokeStyle = 'rgba(0, 255, 255, 0.65)';
            c.beginPath(); c.arc(cx, y + 24, 10, 0, Math.PI * 2); c.stroke();
        } else {
            // Steel spikes
            c.fillStyle = state.triggered ? '#eb2f06' : '#dfe6e9';
            for (let sx = x + 13; sx <= x + 33; sx += 6.5) {
                for (let sy = y + 17; sy <= y + 31; sy += 9) {
                    c.beginPath();
                    c.moveTo(sx - 2, sy + 3);
                    c.lineTo(sx, sy - 4);
                    c.lineTo(sx + 2, sy + 3);
                    c.closePath();
                    c.fill();
                }
            }
        }
    }
    c.restore();
}

// ============================================================================
// 4. OFFSCREEN DYNAMIC VOLUMETRIC LIGHTING & FEATHERED FOG OF WAR
// ============================================================================
function drawFeatheredFogAndDynamicLighting(c, biomeId, currentLeader, torchPct, phase, dynamicLights) {
    const spec = BIOME_MATERIAL_SPECS[biomeId] || BIOME_MATERIAL_SPECS.crypt;

    // 1. Compose ambient darkness + point light cutouts on offscreen lightCanvas
    lightCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.fillStyle = spec.ambientDark;
    lightCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    lightCtx.globalCompositeOperation = 'destination-out';

    // Party Torch Primary Light Source
    if (currentLeader) {
        const lx = currentLeader.x * TILE_SIZE + TILE_SIZE / 2;
        const ly = currentLeader.y * TILE_SIZE + TILE_SIZE / 2;
        const baseR = torchPct > 50 ? 275 : (torchPct > 15 ? 185 : 108);
        const flick = Math.sin(phase * 1.8) * 7 + Math.cos(phase * 3.1) * 3.5;
        const r = Math.max(82, baseR + flick);

        const pCut = lightCtx.createRadialGradient(lx, ly, 16, lx, ly, r);
        pCut.addColorStop(0, 'rgba(0, 0, 0, 0.96)');
        pCut.addColorStop(0.55, 'rgba(0, 0, 0, 0.65)');
        pCut.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightCtx.fillStyle = pCut;
        lightCtx.beginPath();
        lightCtx.arc(lx, ly, r, 0, Math.PI * 2);
        lightCtx.fill();
    }

    // Secondary Point Lights (Wall Torches, Campfire, Shrine, Stairs, Spells, Lava)
    if (dynamicLights) {
        for (let i = 0; i < dynamicLights.length; i++) {
            const dl = dynamicLights[i];
            const cut = lightCtx.createRadialGradient(dl.x, dl.y, 4, dl.x, dl.y, dl.r);
            cut.addColorStop(0, `rgba(0, 0, 0, ${dl.cutout || 0.65})`);
            cut.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lightCtx.fillStyle = cut;
            lightCtx.beginPath();
            lightCtx.arc(dl.x, dl.y, dl.r, 0, Math.PI * 2);
            lightCtx.fill();
        }
    }

    lightCtx.globalCompositeOperation = 'source-over';
    c.drawImage(lightCanvas, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 2. Additive Warm Color Bloom for Light Sources
    c.save();
    c.globalCompositeOperation = 'screen';
    if (currentLeader && torchPct > 0) {
        const lx = currentLeader.x * TILE_SIZE + TILE_SIZE / 2;
        const ly = currentLeader.y * TILE_SIZE + TILE_SIZE / 2;
        const r = (torchPct > 50 ? 210 : 135) + Math.sin(phase * 2) * 6;
        const warm = c.createRadialGradient(lx, ly, 6, lx, ly, r);
        warm.addColorStop(0, spec.torchTint);
        warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = warm;
        c.beginPath();
        c.arc(lx, ly, r, 0, Math.PI * 2);
        c.fill();
    }
    if (dynamicLights) {
        for (let i = 0; i < dynamicLights.length; i++) {
            const dl = dynamicLights[i];
            if (!dl.color) continue;
            const g = c.createRadialGradient(dl.x, dl.y, 2, dl.x, dl.y, dl.r * 0.85);
            g.addColorStop(0, dl.color);
            g.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(dl.x, dl.y, dl.r * 0.85, 0, Math.PI * 2);
            c.fill();
        }
    }
    c.restore();

    // 3. Soft Feathered Fog-of-War Penumbra at Unrevealed Boundaries
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            if (!revealed[y] || !revealed[y][x]) {
                c.fillStyle = '#040302';
                c.fillRect(px, py - WALL_HEIGHT, TILE_SIZE, TILE_SIZE + WALL_HEIGHT);
            } else {
                // Soft shadow fringe bordering unrevealed tiles
                if (y > 0 && (!revealed[y - 1] || !revealed[y - 1][x])) {
                    const g = c.createLinearGradient(px, py, px, py + 16);
                    g.addColorStop(0, 'rgba(4, 3, 2, 0.9)');
                    g.addColorStop(1, 'rgba(4, 3, 2, 0)');
                    c.fillStyle = g; c.fillRect(px, py, TILE_SIZE, 16);
                }
                if (y < ROWS - 1 && (!revealed[y + 1] || !revealed[y + 1][x])) {
                    const g = c.createLinearGradient(px, py + TILE_SIZE - 16, px, py + TILE_SIZE);
                    g.addColorStop(0, 'rgba(4, 3, 2, 0)');
                    g.addColorStop(1, 'rgba(4, 3, 2, 0.9)');
                    c.fillStyle = g; c.fillRect(px, py + TILE_SIZE - 16, TILE_SIZE, 16);
                }
                if (x > 0 && !revealed[y][x - 1]) {
                    const g = c.createLinearGradient(px, py, px + 16, py);
                    g.addColorStop(0, 'rgba(4, 3, 2, 0.9)');
                    g.addColorStop(1, 'rgba(4, 3, 2, 0)');
                    c.fillStyle = g; c.fillRect(px, py, 16, TILE_SIZE);
                }
                if (x < COLS - 1 && !revealed[y][x + 1]) {
                    const g = c.createLinearGradient(px + TILE_SIZE - 16, py, px + TILE_SIZE, py);
                    g.addColorStop(0, 'rgba(4, 3, 2, 0)');
                    g.addColorStop(1, 'rgba(4, 3, 2, 0.9)');
                    c.fillStyle = g; c.fillRect(px + TILE_SIZE - 16, py, 16, TILE_SIZE);
                }
            }
        }
    }
}

// ============================================================================
// 5. HERO PORTRAIT AVATAR RENDERER (FOR PARTY SIDEBAR & ARMORY)
// ============================================================================
const portraitDataUrlCache = {};

function getHeroPortraitDataURL(role) {
    if (portraitDataUrlCache[role]) return portraitDataUrlCache[role];
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 72;
    pCanvas.height = 72;
    const pc = pCanvas.getContext('2d');

    const bgColors = {
        Warrior: ['#2c1d18', '#0d0907'],
        Ranger:  ['#132920', '#08110d'],
        Cleric:  ['#2b2615', '#0f0d07'],
        Control: ['#231536', '#0b0612']
    }[role] || ['#241c16', '#0d0907'];

    const bg = pc.createRadialGradient(36, 30, 4, 36, 36, 40);
    bg.addColorStop(0, bgColors[0]);
    bg.addColorStop(1, bgColors[1]);
    pc.fillStyle = bg;
    pc.fillRect(0, 0, 72, 72);

    drawHeroFigure(pc, role, 35, 76, 0, 1.38, null);

    pc.strokeStyle = 'rgba(212, 175, 55, 0.65)';
    pc.lineWidth = 2;
    pc.strokeRect(1, 1, 70, 70);

    const url = pCanvas.toDataURL();
    portraitDataUrlCache[role] = url;
    return url;
}
