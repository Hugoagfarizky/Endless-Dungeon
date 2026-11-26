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
    let n = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041, 1274126177);
    n = (n ^ (n >>> 13)) >>> 0;
    return (n % 10000) / 10000;
}

function smoothNoise2D(x, y, seed = 1) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = seededNoise(ix, iy, seed);
    const b = seededNoise(ix + 1, iy, seed);
    const c = seededNoise(ix, iy + 1, seed);
    const d = seededNoise(ix + 1, iy + 1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmStone(x, y, seed = 1) {
    return smoothNoise2D(x * 0.09, y * 0.09, seed) * 0.55
         + smoothNoise2D(x * 0.23, y * 0.23, seed + 19) * 0.30
         + smoothNoise2D(x * 0.58, y * 0.58, seed + 47) * 0.15;
}

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
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

function smoothStep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function valueNoise2D(x, y, seed = 1) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const n00 = seededNoise(xi, yi, seed);
    const n10 = seededNoise(xi + 1, yi, seed);
    const n01 = seededNoise(xi, yi + 1, seed);
    const n11 = seededNoise(xi + 1, yi + 1, seed);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return nx0 + (nx1 - nx0) * v;
}

function fbm2D(x, y, seed = 1) {
    return valueNoise2D(x, y, seed) * 0.55
         + valueNoise2D(x * 2.07, y * 2.07, seed + 17) * 0.30
         + valueNoise2D(x * 4.23, y * 4.23, seed + 43) * 0.15;
}

// ============================================================================
// 1. PER-PIXEL 3D NORMAL-MAPPED PBR STONE & BIOME TEXTURE ATLAS BAKER
// ============================================================================
const BIOME_MATERIAL_SPECS = {
    crypt: {
        floorA: '#26231f', floorB: '#1f1c19', mortar: '#090807',
        specStr: 0.28, shininess: 22, mossRgb: [48, 86, 46],
        wallTop: '#2c2824', wallFace: '#3e3832', wallDark: '#191613',
        ambientDark: 'rgba(5, 4, 4, 0.88)', torchTint: 'rgba(255, 166, 70, 0.25)'
    },
    ice: {
        floorA: '#1a2d3f', floorB: '#152535', mortar: '#071019',
        specStr: 0.58, shininess: 34, mossRgb: [145, 218, 250],
        wallTop: '#213e58', wallFace: '#31597d', wallDark: '#0f1f2e',
        ambientDark: 'rgba(4, 9, 17, 0.85)', torchTint: 'rgba(188, 226, 255, 0.22)'
    },
    lava: {
        floorA: '#261715', floorB: '#1e1211', mortar: '#0b0403',
        specStr: 0.24, shininess: 18, mossRgb: [235, 82, 22],
        wallTop: '#381a17', wallFace: '#52251f', wallDark: '#1a0907',
        ambientDark: 'rgba(11, 4, 3, 0.84)', torchTint: 'rgba(255, 118, 42, 0.27)'
    },
    void: {
        floorA: '#1c142d', floorB: '#160f24', mortar: '#06030c',
        specStr: 0.42, shininess: 28, mossRgb: [162, 76, 238],
        wallTop: '#291b42', wallFace: '#3d2862', wallDark: '#11091f',
        ambientDark: 'rgba(6, 3, 13, 0.89)', torchTint: 'rgba(212, 138, 255, 0.23)'
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
    const mortarRgb = hexToRgb(spec.mortar);
    const heightMap = new Float32Array(size * size);
    const slabIdMap = new Uint8Array(size * size);

    const splitY = size * (0.46 + (variantIdx % 3) * 0.045);
    const splitX1 = size * (0.43 + ((variantIdx * 7) % 4) * 0.05);
    const splitX2 = size * (0.57 - ((variantIdx * 5) % 3) * 0.055);
    const seedBase = variantIdx * 71 + (biomeId.charCodeAt(0) * 13);

    // 1. Build organic sculpted flagstone heightfield H(px, py)
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const warpX = (fbm2D(px * 0.075, py * 0.075, seedBase + 3) - 0.5) * 6.5;
            const warpY = (fbm2D(px * 0.075, py * 0.075, seedBase + 19) - 0.5) * 6.5;
            const wx = px + warpX;
            const wy = py + warpY;

            const dOuter = Math.min(px, py, size - 1 - px, size - 1 - py);
            const dHoriz = Math.abs(wy - splitY);
            const dVert = wy < splitY ? Math.abs(wx - splitX1) : Math.abs(wx - splitX2);
            const dJoint = Math.min(dOuter * 1.15, dHoriz, dVert);

            const slabId = (wy < splitY ? 0 : 2) + ((wy < splitY ? wx >= splitX1 : wx >= splitX2) ? 1 : 0);
            slabIdMap[py * size + px] = slabId;

            const bevel = smoothStep(1.4, 6.8, dJoint);
            const rockMacro = fbm2D(px * 0.09, py * 0.09, seedBase + slabId * 29);
            const rockMicro = seededNoise(px, py, seedBase + 101) * 0.08;
            const pit = Math.max(0, fbm2D(px * 0.24, py * 0.24, seedBase + 59) - 0.66) * 0.9;

            // Hairline diagonal stone crack carved into heightmap
            let crackDip = 0;
            if ((variantIdx + slabId) % 3 === 0) {
                const crackDist = Math.abs((wx - 22) * 0.68 - (wy - 18) * 0.73 + Math.sin(py * 0.18) * 3.2);
                if (crackDist < 1.8) crackDip = (1 - crackDist / 1.8) * 0.42;
            }

            heightMap[py * size + px] = bevel * (0.72 + rockMacro * 0.26 + rockMicro - pit - crackDip);
        }
    }

    // 2. Shade every pixel with Sobel 3D surface normals (Lambertian + Blinn-Phong specular + crevice AO)
    const img = c.createImageData(size, size);
    const data = img.data;
    const lx = -0.46, ly = -0.60, lz = 0.65; // Top-left dungeon light vector
    const hx = -0.25, hy = -0.35, hz = 0.90; // Halfway specular vector

    for (let py = 0; py < size; py++) {
        const ym = Math.max(0, py - 1), yp = Math.min(size - 1, py + 1);
        for (let px = 0; px < size; px++) {
            const xm = Math.max(0, px - 1), xp = Math.min(size - 1, px + 1);
            const hC = heightMap[py * size + px];
            const dHx = (heightMap[py * size + xp] - heightMap[py * size + xm]) * 2.35;
            const dHy = (heightMap[yp * size + px] - heightMap[ym * size + px]) * 2.35;
            const invLen = 1 / Math.hypot(dHx, dHy, 1);
            const nx = -dHx * invLen;
            const ny = -dHy * invLen;
            const nz = invLen;

            const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
            const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);
            const specGlow = Math.pow(nDotH, spec.shininess) * spec.specStr * smoothStep(0.3, 0.8, hC);

            const slabId = slabIdMap[py * size + px];
            const slabTint = 1 + ((slabId + variantIdx) % 3 - 1) * 0.065;
            const mortarMix = smoothStep(0.08, 0.42, hC);
            const ao = 0.34 + 0.66 * mortarMix;
            const light = (0.48 + nDotL * 0.82) * ao;

            let r = (mortarRgb.r * (1 - mortarMix) + baseRgb.r * slabTint * mortarMix) * light + specGlow * 235;
            let g = (mortarRgb.g * (1 - mortarMix) + baseRgb.g * slabTint * mortarMix) * light + specGlow * 228;
            let b = (mortarRgb.b * (1 - mortarMix) + baseRgb.b * slabTint * mortarMix) * light + specGlow * 215;

            // Organic crevice moss / frost / magma glowing inside stone joints!
            const mossNoise = fbm2D(px * 0.11, py * 0.11, seedBase + 137);
            if (hC < 0.36 && mossNoise > 0.56) {
                const mAmt = Math.min(0.85, (0.36 - hC) * 2.4 * (mossNoise - 0.52) * 3.2);
                const emissive = (biomeId === 'lava' || biomeId === 'void') ? 1.45 : 0.78;
                r = r * (1 - mAmt) + spec.mossRgb[0] * emissive * mAmt;
                g = g * (1 - mAmt) + spec.mossRgb[1] * emissive * mAmt;
                b = b * (1 - mAmt) + spec.mossRgb[2] * emissive * mAmt;
            }

            const idx = (py * size + px) * 4;
            data[idx]     = clampByte(r);
            data[idx + 1] = clampByte(g);
            data[idx + 2] = clampByte(b);
            data[idx + 3] = 255;
        }
    }
    c.putImageData(img, 0, 0);

    // 3. Special realistic environmental details (iron grate, reflective puddle, glowing magma seam)
    if (biomeId === 'crypt' && variantIdx === 2) {
        c.fillStyle = '#060505';
        c.fillRect(28, 28, 36, 36);
        c.strokeStyle = '#3b4046';
        c.lineWidth = 2.4;
        c.strokeRect(28, 28, 36, 36);
        for (let gx = 35; gx <= 57; gx += 7) {
            c.beginPath(); c.moveTo(gx, 29); c.lineTo(gx, 63); c.stroke();
        }
        c.strokeStyle = 'rgba(255, 245, 225, 0.18)';
        c.lineWidth = 1;
        c.strokeRect(27, 27, 38, 38);
    } else if (biomeId === 'crypt' && variantIdx === 5) {
        const pGrad = c.createRadialGradient(50, 54, 2, 54, 56, 24);
        pGrad.addColorStop(0, 'rgba(135, 175, 200, 0.36)');
        pGrad.addColorStop(0.65, 'rgba(18, 28, 38, 0.52)');
        pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = pGrad;
        c.beginPath();
        c.ellipse(54, 56, 23, 15, 0.22, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(235, 248, 255, 0.28)';
        c.lineWidth = 1.1;
        c.beginPath();
        c.arc(47, 51, 9, -Math.PI * 0.82, -Math.PI * 0.22);
        c.stroke();
    } else if (biomeId === 'lava' && variantIdx % 2 === 1) {
        c.save();
        c.shadowColor = '#ff5e00';
        c.shadowBlur = 10;
        c.strokeStyle = 'rgba(255, 120, 28, 0.72)';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(splitX2, splitY);
        c.lineTo(splitX2 - 8, splitY + 18);
        c.lineTo(splitX2 + 4, splitY + 31);
        c.stroke();
        c.strokeStyle = 'rgba(255, 240, 150, 0.78)';
        c.lineWidth = 0.9;
        c.stroke();
        c.restore();
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
    const mortarRgb = hexToRgb(spec.mortar);
    const seedBase = variantIdx * 89 + (biomeId.charCodeAt(0) * 19) + (isCracked ? 311 : 0);

    // 1. Per-pixel 3D Normal-Mapped Wall Cap (0..96) & 3-Course Ashlar Masonry Face (96..136)
    const hMap = new Float32Array(w * totalH);
    const off1 = (variantIdx % 2) * 12;

    for (let py = 0; py < totalH; py++) {
        for (let px = 0; px < w; px++) {
            const warp = (fbm2D(px * 0.09, py * 0.09, seedBase + 7) - 0.5) * 3.8;
            let dJoint;
            if (py < w) {
                // Roof cap stone blocks with cornice lip at py = 92..95
                const dEdge = Math.min(px, py, w - 1 - px, w - 1 - py);
                const dCross = Math.min(Math.abs(px + warp - 48), Math.abs(py + warp - 48));
                dJoint = Math.min(dEdge * 1.2, dCross);
            } else {
                // 3D Vertical Masonry Courses (3 staggered ashlar rows)
                const fy = py - w;
                const dRow = Math.min(fy, Math.abs(fy + warp * 0.45 - 13), Math.abs(fy + warp * 0.45 - 27), wallH - 1 - fy);
                let dCol = 99;
                if (fy < 13) dCol = Math.min(Math.abs(px + warp - (28 + off1)), Math.abs(px + warp - (70 - off1)));
                else if (fy < 27) dCol = Math.min(Math.abs(px + warp - (15 + off1)), Math.abs(px + warp - 54));
                else dCol = Math.min(Math.abs(px + warp - (36 - off1)), Math.abs(px + warp - (78 - off1)));
                dJoint = Math.min(dRow, dCol);
            }
            const bevel = smoothStep(1.1, 5.2, dJoint);
            const rough = fbm2D(px * 0.14, py * 0.14, seedBase + 23) * 0.28 + seededNoise(px, py, seedBase) * 0.07;
            hMap[py * w + px] = bevel * (0.74 + rough);
        }
    }

    const img = c.createImageData(w, totalH);
    const data = img.data;
    for (let py = 0; py < totalH; py++) {
        const ym = Math.max(0, py - 1), yp = Math.min(totalH - 1, py + 1);
        const isCap = py < w;
        const srcRgb = isCap ? topRgb : faceRgb;
        const faceVertShade = isCap
            ? (py > w - 6 ? 1.22 : (0.78 + 0.22 * (1 - py / w)))
            : (1.10 - (py - w) / wallH * 0.46);

        for (let px = 0; px < w; px++) {
            const xm = Math.max(0, px - 1), xp = Math.min(w - 1, px + 1);
            const hC = hMap[py * w + px];
            const dHx = (hMap[py * w + xp] - hMap[py * w + xm]) * 2.4;
            const dHy = (hMap[yp * w + px] - hMap[ym * w + px]) * 2.4;
            const inv = 1 / Math.hypot(dHx, dHy, 1);
            const nDotL = Math.max(0, (-dHx * -0.38 + -dHy * -0.72 + 0.58) * inv);
            const mortarMix = smoothStep(0.08, 0.40, hC);
            const shade = (0.44 + nDotL * 0.88) * (0.35 + 0.65 * mortarMix) * faceVertShade;

            const idx = (py * w + px) * 4;
            data[idx]     = clampByte((mortarRgb.r * (1 - mortarMix) + srcRgb.r * mortarMix) * shade);
            data[idx + 1] = clampByte((mortarRgb.g * (1 - mortarMix) + srcRgb.g * mortarMix) * shade);
            data[idx + 2] = clampByte((mortarRgb.b * (1 - mortarMix) + srcRgb.b * mortarMix) * shade);
            data[idx + 3] = 255;
        }
    }
    c.putImageData(img, 0, 0);

    // Chiseled cornice shadow line between cap and vertical wall face + deep base AO
    c.fillStyle = 'rgba(255, 244, 220, 0.20)';
    c.fillRect(0, w - 3, w, 1.5);
    c.fillStyle = 'rgba(0, 0, 0, 0.68)';
    c.fillRect(0, w - 1, w, 2);

    const baseAo = c.createLinearGradient(0, totalH - 16, 0, totalH);
    baseAo.addColorStop(0, 'rgba(0,0,0,0)');
    baseAo.addColorStop(1, 'rgba(0,0,0,0.80)');
    c.fillStyle = baseAo;
    c.fillRect(0, totalH - 16, w, 16);

    if (!isCracked) {
        if (biomeId === 'crypt' && variantIdx === 1) {
            c.strokeStyle = '#1f2428';
            c.lineWidth = 2.2;
            c.beginPath(); c.arc(48, w + 18, 5.5, 0, Math.PI * 2); c.stroke();
            c.fillStyle = '#111417';
            c.fillRect(46, w + 10, 4, 4);
        } else if (biomeId === 'crypt' && variantIdx === 3) {
            c.fillStyle = 'rgba(44, 92, 48, 0.42)';
            c.beginPath();
            c.ellipse(26, totalH - 5, 12, 4.5, 0, 0, Math.PI * 2);
            c.fill();
        } else if (biomeId === 'ice') {
            c.fillStyle = 'rgba(210, 246, 255, 0.62)';
            [14, 28, 58, 78].forEach((ix, ii) => {
                const ih = 8 + ((variantIdx + ii) % 3) * 5;
                c.beginPath();
                c.moveTo(ix - 3, w - 1);
                c.lineTo(ix, w + ih);
                c.lineTo(ix + 3, w - 1);
                c.closePath();
                c.fill();
            });
        } else if (biomeId === 'lava' && variantIdx % 2 === 0) {
            c.strokeStyle = 'rgba(255, 110, 28, 0.62)';
            c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(20, w + 27); c.lineTo(56, w + 27);
            c.stroke();
        }
    } else {
        c.save();
        c.strokeStyle = '#060403';
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

        c.shadowColor = '#f1c40f';
        c.shadowBlur = 10;
        c.strokeStyle = 'rgba(255, 212, 92, 0.88)';
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

        // Rising volumetric smoke wisps above wall torch
        for (let si = 0; si < 3; si++) {
            const prog = ((phase * 0.55 + si * 0.33 + tileX * 0.17) % 1);
            const sx = tx + Math.sin(phase * 1.4 + si * 2.1) * (2.5 + prog * 4);
            const sy = ty - 11 - prog * 18;
            c.fillStyle = `rgba(28, 26, 26, ${(1 - prog) * 0.28})`;
            c.beginPath();
            c.arc(sx, sy, 2.2 + prog * 3.8, 0, Math.PI * 2);
            c.fill();
        }
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
// 3. REALISTIC ANATOMICAL 2.5D MINIATURES, PROJECTED SHADOWS & RIM-LIGHTING
// ============================================================================
function drawSoftGroundShadow(c, cx, cy, rx = 16, ry = 6.5) {
    c.save();
    const sGrad = c.createRadialGradient(cx, cy, 1, cx, cy, rx);
    sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
    sGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.44)');
    sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = sGrad;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
}

// Dynamic Torch-Projected Silhouette Cast Shadow across Dungeon Floor
function drawProjectedCastShadow(c, cx, cy, lightX, lightY, heightPx = 38, baseRx = 14) {
    const dx = cx - lightX;
    const dy = cy - lightY;
    const dist = Math.hypot(dx, dy);
    if (dist > 6 && dist < 340) {
        const stretch = Math.min(1.65, 0.28 + dist / 185);
        const projLen = heightPx * stretch;
        const ang = Math.atan2(dy, dx);
        const endX = cx + Math.cos(ang) * projLen;
        const endY = cy + Math.sin(ang) * projLen * 0.62;
        const alpha = Math.max(0.12, (1 - dist / 340) * 0.48);

        c.save();
        const g = c.createLinearGradient(cx, cy, endX, endY);
        g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        g.addColorStop(0.65, `rgba(0, 0, 0, ${alpha * 0.45})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = g;

        const px = -Math.sin(ang) * (baseRx * 0.58);
        const py = Math.cos(ang) * (baseRx * 0.32);
        c.beginPath();
        c.moveTo(cx + px, cy + py);
        c.lineTo(endX + px * 1.45, endY + py * 1.45);
        c.arc(endX, endY, baseRx * 0.72, ang + Math.PI * 0.5, ang - Math.PI * 0.5, true);
        c.lineTo(cx - px, cy - py);
        c.closePath();
        c.fill();
        c.restore();
    }
    drawSoftGroundShadow(c, cx, cy + 1, baseRx, baseRx * 0.38);
}

function drawHeroFigure(c, role, cx, baseY, phase = 0, scale = 1.0, flashColor = null, facing = 1, strideAmt = 0) {
    c.save();
    c.translate(cx, baseY);
    const breathY = 1 + Math.sin(phase * 1.6) * 0.016;
    const breathX = 1 - Math.sin(phase * 1.6) * 0.010;
    c.scale(scale * (facing < 0 ? -1 : 1) * breathX, scale * breathY);

    const stride = Math.sin(phase * 5.6) * 4.5 * strideAmt;

    if (flashColor) {
        c.shadowColor = flashColor;
        c.shadowBlur = 14;
    }

    if (role === 'Warrior') {
        // Billowing weathered crimson battle cloak with deep fold creases
        const cloakGrad = c.createLinearGradient(-14, -36, 11, -2);
        cloakGrad.addColorStop(0, '#78171d');
        cloakGrad.addColorStop(0.55, '#4c0d12');
        cloakGrad.addColorStop(1, '#210507');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-9, -33);
        c.quadraticCurveTo(-16, -18, -13 + Math.sin(phase * 1.3) * 1.6 - stride * 0.4, -2);
        c.lineTo(8, -3);
        c.quadraticCurveTo(12, -18, 8, -33);
        c.closePath();
        c.fill();

        // Articulated steel cuisses, poleyns (knee cops), greaves & sabatons
        c.fillStyle = flashColor || '#38414a';
        c.beginPath();
        c.roundRect(-7.5 + stride * 0.5, -15, 5.2, 14, 2);
        c.roundRect(1.8 - stride * 0.5, -15, 5.2, 14, 2);
        c.fill();
        // Specular steel shin ridge & knee plates
        c.fillStyle = flashColor || '#b8c6d1';
        c.fillRect(-6.2 + stride * 0.5, -13, 1.8, 9);
        c.fillRect(3.1 - stride * 0.5, -13, 1.8, 9);
        c.fillStyle = flashColor || '#262d34';
        c.beginPath();
        c.ellipse(-4.8 + stride * 0.5, -1.5, 3.6, 1.8, 0, 0, Math.PI * 2);
        c.ellipse(4.6 - stride * 0.5, -1.5, 3.6, 1.8, 0, 0, Math.PI * 2);
        c.fill();

        // Tapered V-shaped Gothic fluted steel cuirass & tassets
        const plateGrad = c.createLinearGradient(-11, -33, 11, -13);
        plateGrad.addColorStop(0, '#eef2f5');
        plateGrad.addColorStop(0.32, '#8e9eab');
        plateGrad.addColorStop(0.72, '#434d59');
        plateGrad.addColorStop(1, '#1e242b');
        c.fillStyle = flashColor || plateGrad;
        c.beginPath();
        c.moveTo(-10.5, -32);
        c.lineTo(10.5, -32);
        c.lineTo(7.8, -19);
        c.lineTo(9.5, -13);
        c.lineTo(-9.5, -13);
        c.lineTo(-7.8, -19);
        c.closePath();
        c.fill();

        // Weathered crimson heraldic surcoat & tarnished brass cross
        c.fillStyle = flashColor || '#8f1d22';
        c.beginPath();
        c.moveTo(-4.5, -29); c.lineTo(4.5, -29); c.lineTo(5.5, -11); c.lineTo(-5.5, -11);
        c.closePath();
        c.fill();
        c.fillStyle = flashColor || '#d4ae52';
        c.fillRect(-0.9, -27, 1.8, 13);
        c.fillRect(-3.5, -23, 7, 1.6);
        // Leather sword belt & iron buckle
        c.fillStyle = '#2b180c';
        c.fillRect(-8.5, -19, 17, 2.4);
        c.strokeStyle = '#d4ae52';
        c.lineWidth = 1;
        c.strokeRect(-2, -19.2, 4, 2.8);

        // Segmented steel pauldrons with rim highlight
        const pldGrad = c.createRadialGradient(-9, -31, 1, -9, -29, 7);
        pldGrad.addColorStop(0, '#f5f8fa');
        pldGrad.addColorStop(0.5, '#778696');
        pldGrad.addColorStop(1, '#252c34');
        c.fillStyle = flashColor || pldGrad;
        c.beginPath(); c.ellipse(-10.5, -29.5, 5.5, 4.5, -0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(10.5, -29.5, 5.5, 4.5, 0.25, 0, Math.PI * 2); c.fill();

        // Sculpted Crusader Greathelm with beveled crown, breathing vents & visor slit
        const helmGrad = c.createLinearGradient(-7, -45, 7, -31);
        helmGrad.addColorStop(0, '#f5f7fa');
        helmGrad.addColorStop(0.4, '#92a2b0');
        helmGrad.addColorStop(0.82, '#3d4652');
        helmGrad.addColorStop(1, '#1b2026');
        c.fillStyle = flashColor || helmGrad;
        c.beginPath();
        c.moveTo(-6.5, -32);
        c.lineTo(-7, -41);
        c.quadraticCurveTo(0, -46.5, 7, -41);
        c.lineTo(6.5, -32);
        c.quadraticCurveTo(0, -30.5, -6.5, -32);
        c.closePath();
        c.fill();

        // Brass reinforce cross & shadowed ocular slit
        c.fillStyle = flashColor || '#cfa649';
        c.fillRect(-0.9, -43.5, 1.8, 11.5);
        c.fillRect(-6.2, -38.2, 12.4, 1.8);
        c.fillStyle = '#090b0e';
        c.fillRect(-5.2, -38, 10.4, 1.5);
        c.fillStyle = '#9be2ff';
        c.fillRect(-3.8, -37.8, 2.4, 1.1);
        c.fillRect(1.4, -37.8, 2.4, 1.1);

        // Longsword with fuller blood-groove & metallic sheen
        c.save();
        c.translate(12.5, -23);
        c.rotate(0.16 + Math.sin(phase * 0.9) * 0.04);
        const bladeGrad = c.createLinearGradient(-2.5, -26, 2.5, 0);
        bladeGrad.addColorStop(0, '#ffffff');
        bladeGrad.addColorStop(0.45, '#cfd9e2');
        bladeGrad.addColorStop(1, '#536170');
        c.fillStyle = flashColor || bladeGrad;
        c.beginPath();
        c.moveTo(0, -27);
        c.lineTo(2.4, -21);
        c.lineTo(2.1, 0);
        c.lineTo(-2.1, 0);
        c.lineTo(-2.4, -21);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(45, 55, 68, 0.65)';
        c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(0, -19); c.lineTo(0, -2); c.stroke();
        // Curved steel/brass crossguard & leather-wrapped grip
        c.fillStyle = flashColor || '#cfa649';
        c.fillRect(-5.5, -1, 11, 2.2);
        c.fillStyle = '#3b2110';
        c.fillRect(-1.2, 1.2, 2.4, 4);
        c.fillStyle = '#cfa649';
        c.beginPath(); c.arc(0, 6, 1.8, 0, Math.PI * 2); c.fill();
        c.restore();

        // Battle-worn Heater Shield with beveled steel rim
        const shGrad = c.createLinearGradient(-17, -29, -4, -8);
        shGrad.addColorStop(0, '#3a5878');
        shGrad.addColorStop(0.55, '#1d3147');
        shGrad.addColorStop(1, '#0d1724');
        c.fillStyle = flashColor || shGrad;
        c.beginPath();
        c.moveTo(-16.5, -28);
        c.lineTo(-5, -28);
        c.lineTo(-5, -17);
        c.quadraticCurveTo(-10.8, -7.5, -10.8, -7.5);
        c.quadraticCurveTo(-16.5, -17, -16.5, -17);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || '#c9a654';
        c.lineWidth = 1.4;
        c.stroke();
        c.fillStyle = flashColor || '#d9b86c';
        c.beginPath(); c.arc(-10.8, -19, 2.2, 0, Math.PI * 2); c.fill();
    } else if (role === 'Ranger') {
        // Fletched arrows & weathered leather quiver
        c.save();
        c.translate(-7.5, -32);
        c.rotate(-0.26);
        c.fillStyle = flashColor || '#4a2912';
        c.fillRect(-2.5, -8, 5, 15);
        c.strokeStyle = '#d9d2c5';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(-1.5, -8); c.lineTo(-2.2, -14);
        c.moveTo(0.8, -8);  c.lineTo(0.6, -15);
        c.moveTo(2.0, -8);  c.lineTo(2.4, -13);
        c.stroke();
        c.restore();

        // Tattered deep-moss stalker cloak
        const cloakGrad = c.createLinearGradient(-12, -35, 11, -2);
        cloakGrad.addColorStop(0, '#234a38');
        cloakGrad.addColorStop(0.6, '#142e22');
        cloakGrad.addColorStop(1, '#091711');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-8.5, -32);
        c.quadraticCurveTo(-15, -16, -12 + Math.sin(phase * 1.4) * 1.8 - stride * 0.4, -2);
        c.lineTo(-5, -4);
        c.lineTo(0, -2);
        c.lineTo(6, -4);
        c.lineTo(10, -2);
        c.quadraticCurveTo(12, -17, 8.5, -32);
        c.closePath();
        c.fill();

        // Articulated cuffed ranger boots
        c.fillStyle = flashColor || '#382010';
        c.beginPath();
        c.roundRect(-6.5 + stride * 0.55, -14, 4.6, 13, 1.5);
        c.roundRect(1.8 - stride * 0.55, -14, 4.6, 13, 1.5);
        c.fill();
        c.fillStyle = flashColor || '#59351c';
        c.fillRect(-6.8 + stride * 0.55, -10, 5.2, 2.2);
        c.fillRect(1.5 - stride * 0.55, -10, 5.2, 2.2);

        // Tailored studded leather brigandine jerkin & bandolier
        const leatherGrad = c.createLinearGradient(-9, -31, 9, -12);
        leatherGrad.addColorStop(0, '#784824');
        leatherGrad.addColorStop(0.55, '#4d2c14');
        leatherGrad.addColorStop(1, '#291609');
        c.fillStyle = flashColor || leatherGrad;
        c.beginPath();
        c.moveTo(-9, -31); c.lineTo(9, -31); c.lineTo(7, -13); c.lineTo(-7, -13);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || '#a88448';
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(-6.5, -30); c.lineTo(6.5, -14); c.stroke();
        c.fillStyle = '#241409';
        c.fillRect(-7.5, -17, 15, 2.4);

        // Deep pointed cowl casting shadow over sharp eyes
        c.fillStyle = flashColor || '#1e4231';
        c.beginPath();
        c.moveTo(-8, -30);
        c.quadraticCurveTo(-8.5, -40, 0, -45.5);
        c.quadraticCurveTo(8.5, -40, 8, -30);
        c.closePath();
        c.fill();
        c.fillStyle = flashColor || '#0d0b09';
        c.beginPath(); c.ellipse(0, -35.5, 4.8, 4.4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7ef5ce';
        c.fillRect(-3.0, -36.2, 2.0, 1.2);
        c.fillRect(1.0, -36.2, 2.0, 1.2);

        // Ashwood Composite Recurve Bow & Nocked Bodkin Arrow
        c.save();
        c.translate(11.5, -22);
        c.strokeStyle = flashColor || '#9e6632';
        c.lineWidth = 2.3;
        c.beginPath();
        c.moveTo(-1, -14);
        c.quadraticCurveTo(7, -7, 4, 0);
        c.quadraticCurveTo(7, 7, -1, 14);
        c.stroke();
        c.strokeStyle = 'rgba(235, 240, 245, 0.72)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-1, -14); c.lineTo(-4.5, 0); c.lineTo(-1, 14);
        c.stroke();
        c.strokeStyle = flashColor || '#d8dfe5';
        c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(-4.5, 0); c.lineTo(12, 0); c.stroke();
        c.fillStyle = '#b8c6d1';
        c.beginPath(); c.moveTo(14.5, 0); c.lineTo(10.5, -2.2); c.lineTo(10.5, 2.2); c.closePath(); c.fill();
        c.restore();
    } else if (role === 'Cleric') {
        // Faint gilded iron halo behind head
        c.save();
        c.strokeStyle = flashColor || 'rgba(232, 198, 104, 0.68)';
        c.lineWidth = 1.4;
        c.beginPath(); c.arc(0, -37.5, 10, 0, Math.PI * 2); c.stroke();
        c.restore();

        // Pleated ivory-linen chasuble with realistic vertical cloth shadow creases
        const robeGrad = c.createLinearGradient(-12, -32, 12, -1);
        robeGrad.addColorStop(0, '#efeae0');
        robeGrad.addColorStop(0.55, '#c2b8a3');
        robeGrad.addColorStop(1, '#6b6252');
        c.fillStyle = flashColor || robeGrad;
        c.beginPath();
        c.moveTo(-8.5, -31);
        c.lineTo(-12.5 - stride * 0.25, -1.5);
        c.lineTo(12.5 + stride * 0.25, -1.5);
        c.lineTo(8.5, -31);
        c.closePath();
        c.fill();

        // Cloth fold shadow lines
        c.strokeStyle = 'rgba(45, 38, 28, 0.36)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-5, -26); c.lineTo(-7.5, -2);
        c.moveTo(5, -26);  c.lineTo(7.5, -2);
        c.stroke();

        // Embroidered crimson & gold liturgical stole + steel shoulder mantle
        c.fillStyle = flashColor || '#8c2228';
        c.fillRect(-3.4, -30, 6.8, 26);
        c.fillStyle = flashColor || '#d4ae52';
        c.fillRect(-1.2, -28, 2.4, 22);
        c.fillStyle = flashColor || '#b8b09c';
        c.beginPath(); c.ellipse(0, -30, 9.5, 3.4, 0, 0, Math.PI * 2); c.fill();

        // Cowl, shaded face, & gilded circlet
        c.fillStyle = flashColor || '#e8e2d5';
        c.beginPath(); c.arc(0, -36.5, 7.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = flashColor || '#d9b18e';
        c.beginPath(); c.arc(0, -35.5, 4.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#241e1a';
        c.fillRect(-2.5, -36.2, 1.5, 1.3);
        c.fillRect(1.0, -36.2, 1.5, 1.3);
        c.strokeStyle = flashColor || '#d4ae52';
        c.lineWidth = 1.6;
        c.beginPath(); c.arc(0, -37.5, 5.2, Math.PI * 1.08, Math.PI * 1.92); c.stroke();

        // Wrought-Gold Sun Crosier with radiant sanctum crystal
        c.save();
        c.translate(12.5, -19);
        c.fillStyle = flashColor || '#b58d38';
        c.fillRect(-1.2, -19, 2.4, 36);
        c.strokeStyle = flashColor || '#ebd086';
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(0, -22.5, 5.2, 0, Math.PI * 2); c.stroke();
        const gemY = -22.5 + Math.sin(phase * 2) * 1.1;
        c.fillStyle = '#9ef7db';
        c.shadowColor = '#6be8c8';
        c.shadowBlur = 8;
        c.beginPath();
        c.moveTo(0, gemY - 3.6); c.lineTo(2.8, gemY); c.lineTo(0, gemY + 3.6); c.lineTo(-2.8, gemY);
        c.closePath();
        c.fill();
        c.restore();
    } else {
        // Abyssal Battlemage: layered twilight velvet robes with deep folds & gold runes
        const robeGrad = c.createLinearGradient(-13, -32, 13, -1);
        robeGrad.addColorStop(0, '#4c2e85');
        robeGrad.addColorStop(0.55, '#29164d');
        robeGrad.addColorStop(1, '#110824');
        c.fillStyle = flashColor || robeGrad;
        c.beginPath();
        c.moveTo(-8.5, -31);
        c.lineTo(-13.5 - stride * 0.3, -1.5);
        c.lineTo(13.5 + stride * 0.3, -1.5);
        c.lineTo(8.5, -31);
        c.closePath();
        c.fill();

        // Mantle & embroidered gold trim
        c.fillStyle = flashColor || '#381f66';
        c.beginPath(); c.ellipse(0, -29.5, 10, 4, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#cfa649';
        c.lineWidth = 1.3;
        c.beginPath();
        c.moveTo(-3.8, -29); c.lineTo(-6.2, -2);
        c.moveTo(3.8, -29);  c.lineTo(6.2, -2);
        c.stroke();

        // Deeply shadowed face beneath wizard hat brim + glowing arcane eyes
        c.fillStyle = flashColor || '#0d061a';
        c.beginPath(); c.arc(0, -35.5, 5.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7ee8ff';
        c.shadowColor = '#38d9ff';
        c.shadowBlur = 6;
        c.fillRect(-3.0, -36, 2.1, 1.4);
        c.fillRect(0.9, -36, 2.1, 1.4);
        c.shadowBlur = 0;

        // Weathered pointed Archmage Hat with brass buckle & curved brim
        const hatGrad = c.createLinearGradient(-9, -53, 9, -36);
        hatGrad.addColorStop(0, '#623ca8');
        hatGrad.addColorStop(1, '#1d0e38');
        c.fillStyle = flashColor || hatGrad;
        c.beginPath();
        c.ellipse(0, -38, 13, 3.5, -0.06, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(-7.5, -38);
        c.quadraticCurveTo(-2.5, -49, 4.5, -53.5);
        c.quadraticCurveTo(5.2, -45, 7.5, -38);
        c.closePath();
        c.fill();
        c.fillStyle = flashColor || '#cfa649';
        c.fillRect(-6.8, -40, 13.6, 2);

        // Twisted Ironwood Staff & Orbiting Arcane Catalyst
        c.save();
        c.translate(12.5, -19);
        c.strokeStyle = flashColor || '#4d2e14';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(0, 17);
        c.lineTo(0, -15);
        c.arc(-2, -19.5, 4.8, 0.2, Math.PI * 1.65);
        c.stroke();

        const orbY = -21 + Math.cos(phase * 2.2) * 1.4;
        const orbGrad = c.createRadialGradient(-1, orbY, 0.8, -1, orbY, 6.5);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.42, '#d980fa');
        orbGrad.addColorStop(1, 'rgba(142, 68, 173, 0)');
        c.fillStyle = orbGrad;
        c.beginPath(); c.arc(-1, orbY, 6.5, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    // Subtle warm golden torch rim-light along upper contour
    if (!flashColor) {
        c.strokeStyle = 'rgba(255, 214, 150, 0.22)';
        c.lineWidth = 0.9;
        c.beginPath();
        c.arc(0, -36, 7.8, -Math.PI * 0.85, -Math.PI * 0.15);
        c.stroke();
    }

    c.restore();
}

function drawEnemyFigure(c, enemy, cx, baseY, phase = 0, flashColor = null, facing = 1) {
    c.save();
    c.translate(cx, baseY);
    const breathY = 1 + Math.sin(phase * 1.8) * 0.022;
    c.scale((facing < 0 ? -1 : 1), breathY);

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

        // Articulated Dread Sabatons & Sculpted V-Tapered Gothic Dread Cuirass
        [[-7, -15], [2.5, -15]].forEach(([lx, ly]) => {
            c.fillStyle = flashColor || '#15181d';
            c.beginPath(); c.roundRect(lx, ly, 5.2, 14, 1.8); c.fill();
            c.fillStyle = flashColor || palette.armor;
            c.fillRect(lx + 1, ly + 2, 2, 9);
        });
        const torsoGrad = c.createLinearGradient(-13, -39, 13, -10);
        torsoGrad.addColorStop(0, palette.trim);
        torsoGrad.addColorStop(0.28, palette.armor);
        torsoGrad.addColorStop(1, '#08080b');
        c.fillStyle = flashColor || torsoGrad;
        c.beginPath();
        c.moveTo(-13, -37); c.lineTo(13, -37); c.lineTo(9, -13); c.lineTo(0, -10.5); c.lineTo(-9, -13);
        c.closePath();
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
        // TIER 5 MINI-BOSS (Sculpted Ironclad Warden / Executioner)
        const bColor = enemy.color || '#e67e22';
        [[-6, -13], [2, -13]].forEach(([lx, ly]) => {
            c.fillStyle = flashColor || '#1c2026';
            c.beginPath(); c.roundRect(lx, ly, 4.6, 12, 1.5); c.fill();
        });
        const bodyGrad = c.createLinearGradient(-12, -36, 12, -10);
        bodyGrad.addColorStop(0, '#95a5a6');
        bodyGrad.addColorStop(0.5, '#2f3640');
        bodyGrad.addColorStop(1, '#12151a');
        c.fillStyle = flashColor || bodyGrad;
        c.beginPath();
        c.moveTo(-11.5, -34); c.lineTo(11.5, -34); c.lineTo(8.5, -12); c.lineTo(-8.5, -12);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || bColor;
        c.lineWidth = 1.3;
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
        // ANATOMICAL UNDEAD HALBERDIER / SKELETON GUARD
        const accent = enemy.affix ? (enemy.color || '#e84118') : '#e84118';
        // Tattered mail & burial rags
        const ragGrad = c.createLinearGradient(-9, -30, 9, -4);
        ragGrad.addColorStop(0, '#2e333b');
        ragGrad.addColorStop(1, '#14171c');
        c.fillStyle = flashColor || ragGrad;
        c.beginPath();
        c.moveTo(-8, -29); c.lineTo(-11, -5); c.lineTo(-5, -8); c.lineTo(0, -4); c.lineTo(6, -8); c.lineTo(10, -5); c.lineTo(8, -29);
        c.closePath();
        c.fill();

        // Anatomical femur/tibia leg bones, iliac pelvis & curved ribcage
        c.strokeStyle = flashColor || '#d5d0c3';
        c.lineWidth = 1.9;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, -29); c.lineTo(0, -13);
        c.moveTo(-5.5, -26); c.quadraticCurveTo(0, -24, 5.5, -26);
        c.moveTo(-6.2, -22.5); c.quadraticCurveTo(0, -20.5, 6.2, -22.5);
        c.moveTo(-4.8, -19); c.quadraticCurveTo(0, -17.5, 4.8, -19);
        c.moveTo(-4.5, -13.5); c.lineTo(4.5, -13.5);
        c.moveTo(-3.6, -13); c.lineTo(-4.8, -7); c.lineTo(-3.8, -1.5);
        c.moveTo(3.6, -13);  c.lineTo(4.8, -7);  c.lineTo(3.8, -1.5);
        c.stroke();

        // Sculpted cranium, cheekbones, jaw & corroded iron kettle-helm
        c.fillStyle = flashColor || '#e2ddd0';
        c.beginPath(); c.arc(0, -35.5, 5.8, 0, Math.PI * 2); c.fill();
        c.fillRect(-3.2, -31.2, 6.4, 3.2);
        c.fillStyle = '#181412';
        c.beginPath(); c.moveTo(0, -33.5); c.lineTo(-1.1, -31.8); c.lineTo(1.1, -31.8); c.closePath(); c.fill();

        const helmG = c.createLinearGradient(-7, -42, 7, -35);
        helmG.addColorStop(0, '#78828c');
        helmG.addColorStop(1, '#262b30');
        c.fillStyle = flashColor || helmG;
        c.beginPath(); c.arc(0, -36.8, 6.6, Math.PI * 0.96, Math.PI * 2.04); c.fill();

        // Pinpoint burning undead eye sockets
        c.fillStyle = accent;
        c.shadowColor = accent;
        c.shadowBlur = 6;
        c.fillRect(-3.4, -35.6, 2.0, 1.6);
        c.fillRect(1.4, -35.6, 2.0, 1.6);
        c.shadowBlur = 0;

        // Battered Iron Buckler (left arm) & Notched Steel Halberd (right arm)
        c.fillStyle = flashColor || '#3c444d';
        c.beginPath(); c.ellipse(-9.5, -20, 4.2, 6.5, -0.15, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#7f8c8d';
        c.lineWidth = 1.1;
        c.stroke();

        c.save();
        c.translate(10.5, -19);
        c.fillStyle = '#593818';
        c.fillRect(-1, -22, 2.1, 37);
        c.fillStyle = flashColor || '#b8c2cc';
        c.beginPath();
        c.moveTo(0, -27); c.lineTo(7, -17); c.lineTo(5, -11); c.lineTo(1, -13); c.lineTo(0, -23);
        c.closePath();
        c.fill();
        c.restore();
    } else {
        // CAUSTIC TRANSLUCENT PLAGUE OOZE (with wet meniscus puddle, trapped bones & glossy refraction)
        const baseCol = enemy.affix ? (enemy.color || '#d94526') : '#a82c18';
        const squishX = 1 + Math.sin(phase * 2.1) * 0.065;
        const squishY = 1 - Math.sin(phase * 2.1) * 0.065;
        c.scale(squishX, squishY);

        // Wet slimy ground meniscus pool
        c.fillStyle = 'rgba(55, 14, 12, 0.55)';
        c.beginPath(); c.ellipse(0, -1.5, 16.5, 4.8, 0, 0, Math.PI * 2); c.fill();

        // Trapped digested skull & bone shard suspended inside translucent ooze
        c.fillStyle = 'rgba(232, 224, 204, 0.48)';
        c.beginPath(); c.arc(-2.5, -13.5, 4.0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(20, 8, 8, 0.58)';
        c.fillRect(-4.1, -14.4, 1.3, 1.3);
        c.fillRect(-1.8, -14.4, 1.3, 1.3);
        c.strokeStyle = 'rgba(225, 218, 198, 0.42)';
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(3, -9); c.lineTo(8, -14); c.stroke();

        // Organic multi-lobed gelatinous body
        const slimeGrad = c.createRadialGradient(-4, -18, 2, 0, -11, 17);
        slimeGrad.addColorStop(0, 'rgba(255, 168, 140, 0.92)');
        slimeGrad.addColorStop(0.38, baseCol);
        slimeGrad.addColorStop(0.82, 'rgba(58, 9, 10, 0.92)');
        slimeGrad.addColorStop(1, 'rgba(28, 4, 5, 0.95)');
        c.fillStyle = flashColor || slimeGrad;
        c.beginPath();
        c.moveTo(-15, -3);
        c.bezierCurveTo(-16, -15, -11, -25, 0, -25.5);
        c.bezierCurveTo(11, -25, 16, -15, 15, -3);
        c.quadraticCurveTo(7, -0.2, 0, -1.8);
        c.quadraticCurveTo(-7, -0.2, -15, -3);
        c.closePath();
        c.fill();

        // Surface gas blisters & glossy wet refractive highlights
        c.fillStyle = 'rgba(255, 215, 195, 0.32)';
        c.beginPath();
        c.arc(5.5, -17, 2.2, 0, Math.PI * 2);
        c.arc(-7.5, -10, 1.6, 0, Math.PI * 2);
        c.fill();

        c.strokeStyle = 'rgba(255, 255, 255, 0.68)';
        c.lineWidth = 1.8;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(-3.2, -15.5, 7.8, Math.PI * 1.12, Math.PI * 1.50);
        c.stroke();
    }

    c.restore();
}

function drawPropMiniature(c, type, tileX, tileY, state = {}, phase = 0) {
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const baseY = tileY * TILE_SIZE + TILE_SIZE - 8;
    const ldr = (typeof getLeader === 'function') ? getLeader() : null;
    const lx = ldr ? (ldr.x * TILE_SIZE + 24 + (ldr.stepOffsetX || 0)) : cx;
    const ly = ldr ? (ldr.y * TILE_SIZE + 10 + (ldr.stepOffsetY || 0)) : baseY - 24;

    c.save();
    if (type === 'chest') {
        drawProjectedCastShadow(c, cx, baseY + 1, lx, ly, 24, 15);
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
        drawProjectedCastShadow(c, cx, baseY + 1, lx, ly, 38, 17);
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
        drawProjectedCastShadow(c, cx, baseY + 1, lx, ly, 42, 16);
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

            // Rising campfire smoke & glowing embers
            for (let si = 0; si < 4; si++) {
                const prog = ((phase * 0.48 + si * 0.25) % 1);
                const sx = Math.sin(phase * 1.6 + si * 1.9) * (3 + prog * 6);
                const sy = -24 - prog * 26;
                c.fillStyle = `rgba(36, 32, 30, ${(1 - prog) * 0.30})`;
                c.beginPath();
                c.arc(sx, sy, 3 + prog * 5, 0, Math.PI * 2);
                c.fill();
                if (si % 2 === 0) {
                    c.fillStyle = `rgba(255, 190, 75, ${(1 - prog) * 0.85})`;
                    c.beginPath();
                    c.arc(-sx * 0.8, -16 - prog * 22, 1.1, 0, Math.PI * 2);
                    c.fill();
                }
            }
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
// 4. REAL-TIME RAYCAST SHADOW-CASTING, SPECULAR FLOOR GLINT & VOLUMETRIC FOG
// ============================================================================
function drawHeldTorch(c, cx, baseY, facing = 1, torchPct = 100, phase = 0) {
    if (torchPct <= 0) return;
    const dir = facing < 0 ? -1 : 1;
    const tx = cx - dir * 13;
    const ty = baseY - 24;
    const sway = Math.sin(phase * 2.8) * 1.3;
    const scaleFlame = torchPct > 50 ? 1.0 : (torchPct > 15 ? 0.72 : 0.42);

    c.save();
    // Charred wooden torch shaft
    c.strokeStyle = '#4a2b13';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(tx + dir * 3, ty + 8);
    c.lineTo(tx - dir * 2, ty - 3);
    c.stroke();

    const fx = tx - dir * 2;
    const fy = ty - 4;
    const halo = c.createRadialGradient(fx, fy - 2, 1, fx, fy - 2, 12 * scaleFlame);
    halo.addColorStop(0, 'rgba(255, 242, 165, 0.92)');
    halo.addColorStop(0.45, 'rgba(255, 130, 30, 0.62)');
    halo.addColorStop(1, 'rgba(255, 60, 0, 0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(fx, fy - 2, 12 * scaleFlame, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#ff731d';
    c.beginPath();
    c.moveTo(fx - 3 * scaleFlame, fy + 1);
    c.quadraticCurveTo(fx - 3.5 * scaleFlame, fy - 4 * scaleFlame, fx + sway, fy - 9.5 * scaleFlame);
    c.quadraticCurveTo(fx + 3.5 * scaleFlame, fy - 4 * scaleFlame, fx + 3 * scaleFlame, fy + 1);
    c.closePath();
    c.fill();

    c.fillStyle = '#fff7c2';
    c.beginPath();
    c.arc(fx + sway * 0.3, fy - 2.5 * scaleFlame, 1.7 * scaleFlame, 0, Math.PI * 2);
    c.fill();
    c.restore();
}

function traceTorchVisibilityPolygon(ox, oy, maxRadius) {
    const rays = 108;
    const stepSize = 6;
    const pts = [];
    for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        let dist = 12;
        while (dist < maxRadius) {
            const wx = ox + dx * dist;
            const wy = oy + dy * dist;
            const tx = Math.floor(wx / TILE_SIZE);
            const ty = Math.floor(wy / TILE_SIZE);
            if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) {
                break;
            }
            if (typeof map !== 'undefined' && map[ty] && map[ty][tx] >= 1) {
                // Illuminate ~18px onto the 3D stone wall face before casting dark shadow behind it
                dist = Math.min(maxRadius, dist + 18);
                break;
            }
            dist += stepSize;
        }
        pts.push({ x: ox + dx * dist, y: oy + dy * dist });
    }
    return pts;
}

function drawSubterraneanGroundMist(c, biomeId, phase) {
    const mistTint = {
        crypt: 'rgba(165, 185, 195, 0.055)',
        ice:   'rgba(200, 238, 255, 0.075)',
        lava:  'rgba(255, 130, 65, 0.05)',
        void:  'rgba(175, 115, 245, 0.065)'
    }[biomeId] || 'rgba(170, 180, 190, 0.05)';

    c.save();
    for (let i = 0; i < 7; i++) {
        const mx = ((i * 217 + phase * (5.5 + (i % 3) * 2.2)) % (WORLD_WIDTH + 320)) - 160;
        const my = ((i * 139 + Math.sin(phase * 0.25 + i) * 28) % WORLD_HEIGHT + WORLD_HEIGHT) % WORLD_HEIGHT;
        const rx = 135 + (i % 3) * 45;
        const ry = 58 + (i % 2) * 24;
        const mg = c.createRadialGradient(mx, my, 8, mx, my, rx);
        mg.addColorStop(0, mistTint);
        mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = mg;
        c.beginPath();
        c.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
    }
    c.restore();
}

function drawFeatheredFogAndDynamicLighting(c, biomeId, currentLeader, torchPct, phase, dynamicLights) {
    const spec = BIOME_MATERIAL_SPECS[biomeId] || BIOME_MATERIAL_SPECS.crypt;

    // 0. Drifting subterranean ground mist across stone floor
    drawSubterraneanGroundMist(c, biomeId, phase);

    // 1. Compose ambient darkness + raycast wall-occluded torchlight on offscreen lightCanvas
    lightCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.fillStyle = spec.ambientDark;
    lightCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    lightCtx.globalCompositeOperation = 'destination-out';

    let visPoly = null;
    if (currentLeader) {
        const lx = currentLeader.x * TILE_SIZE + TILE_SIZE / 2 + (currentLeader.stepOffsetX || 0);
        const ly = currentLeader.y * TILE_SIZE + TILE_SIZE / 2 + (currentLeader.stepOffsetY || 0);
        const baseR = torchPct > 50 ? 290 : (torchPct > 15 ? 195 : 112);
        const flick = Math.sin(phase * 1.8) * 7 + Math.cos(phase * 3.1) * 3.5;
        const r = Math.max(84, baseR + flick);

        visPoly = traceTorchVisibilityPolygon(lx, ly, r);

        lightCtx.save();
        lightCtx.beginPath();
        visPoly.forEach((pt, idx) => {
            if (idx === 0) lightCtx.moveTo(pt.x, pt.y);
            else lightCtx.lineTo(pt.x, pt.y);
        });
        lightCtx.closePath();
        lightCtx.clip();

        const pCut = lightCtx.createRadialGradient(lx, ly, 14, lx, ly, r);
        pCut.addColorStop(0, 'rgba(0, 0, 0, 0.97)');
        pCut.addColorStop(0.52, 'rgba(0, 0, 0, 0.68)');
        pCut.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightCtx.fillStyle = pCut;
        lightCtx.fillRect(lx - r, ly - r, r * 2, r * 2);
        lightCtx.restore();

        // Soft local bounce light so nearby wall edges retain realistic penumbra
        const softBounce = lightCtx.createRadialGradient(lx, ly, 8, lx, ly, Math.min(104, r * 0.42));
        softBounce.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
        softBounce.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightCtx.fillStyle = softBounce;
        lightCtx.beginPath();
        lightCtx.arc(lx, ly, Math.min(104, r * 0.42), 0, Math.PI * 2);
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

    // 2. Additive Warm Color Bloom + Wet Flagstone Specular Glints
    c.save();
    c.globalCompositeOperation = 'screen';
    if (currentLeader && torchPct > 0) {
        const lx = currentLeader.x * TILE_SIZE + TILE_SIZE / 2 + (currentLeader.stepOffsetX || 0);
        const ly = currentLeader.y * TILE_SIZE + TILE_SIZE / 2 + (currentLeader.stepOffsetY || 0);
        const r = (torchPct > 50 ? 225 : 142) + Math.sin(phase * 2) * 6;

        c.save();
        if (visPoly) {
            c.beginPath();
            visPoly.forEach((pt, idx) => {
                if (idx === 0) c.moveTo(pt.x, pt.y);
                else c.lineTo(pt.x, pt.y);
            });
            c.closePath();
            c.clip();
        }
        const warm = c.createRadialGradient(lx, ly, 6, lx, ly, r);
        warm.addColorStop(0, spec.torchTint);
        warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = warm;
        c.fillRect(lx - r, ly - r, r * 2, r * 2);

        // Specular wet-stone / ice floor reflection hotspot beneath torch
        const specFloor = c.createRadialGradient(lx, ly + 14, 1, lx, ly + 14, 52);
        specFloor.addColorStop(0, biomeId === 'ice' ? 'rgba(210, 245, 255, 0.22)' : 'rgba(255, 212, 145, 0.14)');
        specFloor.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = specFloor;
        c.beginPath();
        c.ellipse(lx, ly + 14, 52, 26, 0, 0, Math.PI * 2);
        c.fill();

        // Subtle volumetric torch god-rays radiating through underground dust
        for (let ri = 0; ri < 5; ri++) {
            const rayAng = ri * 1.256 + Math.sin(phase * 0.35 + ri) * 0.18;
            const rayLen = r * 0.82;
            const rg = c.createLinearGradient(lx, ly, lx + Math.cos(rayAng) * rayLen, ly + Math.sin(rayAng) * rayLen);
            rg.addColorStop(0, 'rgba(255, 200, 120, 0.065)');
            rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
            c.fillStyle = rg;
            c.beginPath();
            c.moveTo(lx, ly);
            c.lineTo(lx + Math.cos(rayAng - 0.09) * rayLen, ly + Math.sin(rayAng - 0.09) * rayLen);
            c.lineTo(lx + Math.cos(rayAng + 0.09) * rayLen, ly + Math.sin(rayAng + 0.09) * rayLen);
            c.closePath();
            c.fill();
        }
        c.restore();
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

    drawHeroFigure(pc, role, 36, 74, 0, 1.32, null, 1, 0);

    const vig = pc.createRadialGradient(36, 36, 20, 36, 36, 36);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    pc.fillStyle = vig;
    pc.fillRect(0, 0, 72, 72);

    const url = pCanvas.toDataURL();
    portraitDataUrlCache[role] = url;
    return url;
}

// Pre-baked subtle 64x64 film-grain dither tile (eliminates dark 8-bit gradient banding)
let filmGrainCanvasCache = null;
function getFilmGrainTile() {
    if (filmGrainCanvasCache) return filmGrainCanvasCache;
    const gc = document.createElement('canvas');
    gc.width = 64;
    gc.height = 64;
    const gctx = gc.getContext('2d');
    const img = gctx.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) {
        const v = (seededNoise(i % 64, Math.floor(i / 64), 911) * 255) | 0;
        img.data[i * 4]     = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 9; // ultra-subtle ~3.5% grain
    }
    gctx.putImageData(img, 0, 0);
    filmGrainCanvasCache = gc;
    return gc;
}

// Pre-baked organic monochrome film-grain texture (prevents 8-bit shadow banding)
let filmGrainCanvas = null;
function drawCinematicFilmGrain(c, vx, vy, vw, vh, phase = 0) {
    if (!filmGrainCanvas) {
        filmGrainCanvas = document.createElement('canvas');
        filmGrainCanvas.width = 160;
        filmGrainCanvas.height = 100;
        const gc = filmGrainCanvas.getContext('2d');
        const img = gc.createImageData(160, 100);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.floor(seededNoise(i, (i >> 3), 777) * 255);
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 16;
        }
        gc.putImageData(img, 0, 0);
    }
    const jx = ((Math.floor(phase * 10) * 13) % 24) - 12;
    const jy = ((Math.floor(phase * 10) * 7) % 16) - 8;
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.drawImage(filmGrainCanvas, vx + jx, vy + jy, vw + 24, vh + 16);
    c.restore();
}
