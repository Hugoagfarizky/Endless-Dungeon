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

function drawCylindricalLimb(c, x1, y1, x2, y2, r1, r2, colLit, colMid, colDark, flashColor = null) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    if (flashColor) {
        c.fillStyle = flashColor;
    } else {
        const g = c.createLinearGradient(x1 - nx * r1, y1 - ny * r1, x1 + nx * r1, y1 + ny * r1);
        g.addColorStop(0, colDark);
        g.addColorStop(0.32, colMid);
        g.addColorStop(0.64, colLit);
        g.addColorStop(1, colDark);
        c.fillStyle = g;
    }

    c.beginPath();
    c.moveTo(x1 - nx * r1, y1 - ny * r1);
    c.lineTo(x2 - nx * r2, y2 - ny * r2);
    c.quadraticCurveTo(x2 + (dx / len) * r2 * 0.7, y2 + (dy / len) * r2 * 0.7, x2 + nx * r2, y2 + ny * r2);
    c.lineTo(x1 + nx * r1, y1 + ny * r1);
    c.quadraticCurveTo(x1 - (dx / len) * r1 * 0.5, y1 - (dy / len) * r1 * 0.5, x1 - nx * r1, y1 - ny * r1);
    c.closePath();
    c.fill();
}

function drawRealisticHumanHead(c, hx, hy, opts = {}, flashColor = null) {
    const skinLit = opts.skinLit || '#f0c8a6';
    const skinMid = opts.skinMid || '#c9926c';
    const skinDark = opts.skinDark || '#6e452f';
    const hairCol = opts.hairCol || '#362318';
    const irisCol = opts.irisCol || '#3b5c76';
    const glowEyes = !!opts.glowEyes;

    // Shaded anatomical neck & sternocleidomastoid crease
    drawCylindricalLimb(c, hx - 0.8, hy + 3.2, hx - 1.1, hy + 7.6, 2.5, 2.9, skinMid, skinDark, '#3b2217', flashColor);

    // 3/4 Sculpted Cranium, Cheekbone & Chiseled Jawline
    const faceGrad = c.createRadialGradient(hx + 1.8, hy - 1.4, 0.8, hx - 0.5, hy, 6.6);
    faceGrad.addColorStop(0, skinLit);
    faceGrad.addColorStop(0.55, skinMid);
    faceGrad.addColorStop(1, skinDark);
    c.fillStyle = flashColor || faceGrad;
    c.beginPath();
    c.moveTo(hx - 4.6, hy - 2.2);
    c.bezierCurveTo(hx - 4.8, hy - 6.5, hx + 3.8, hy - 6.6, hx + 4.6, hy - 2.2);
    c.bezierCurveTo(hx + 5.0, hy + 0.4, hx + 4.3, hy + 3.1, hx + 1.8, hy + 4.8);
    c.quadraticCurveTo(hx + 0.2, hy + 5.3, hx - 1.8, hy + 4.4);
    c.quadraticCurveTo(hx - 4.4, hy + 2.5, hx - 4.6, hy - 2.2);
    c.closePath();
    c.fill();

    if (flashColor) return;

    // Ear & temple hair / sideburn framing rear of head
    c.fillStyle = skinDark;
    c.beginPath(); c.ellipse(hx - 4.1, hy + 0.3, 1.1, 1.9, -0.1, 0, Math.PI * 2); c.fill();
    if (opts.hairLocks !== false) {
        c.fillStyle = hairCol;
        c.beginPath();
        c.moveTo(hx - 5.0, hy - 1.5);
        c.quadraticCurveTo(hx - 5.4, hy - 6.6, hx + 1.2, hy - 6.2);
        c.quadraticCurveTo(hx + 4.4, hy - 5.6, hx + 4.7, hy - 3.0);
        c.quadraticCurveTo(hx + 1.8, hy - 4.4, hx - 2.4, hy - 3.2);
        c.lineTo(hx - 3.4, hy + 2.2);
        c.lineTo(hx - 5.0, hy + 1.2);
        c.closePath();
        c.fill();
    }

    // Recessed eye-socket shadow under brow ridge
    c.fillStyle = 'rgba(42, 22, 15, 0.46)';
    c.beginPath(); c.ellipse(hx - 0.8, hy - 1.1, 1.7, 1.0, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(hx + 2.8, hy - 1.1, 1.5, 1.0, 0, 0, Math.PI * 2); c.fill();

    // Realistic almond sclera, colored iris & corneal catchlight
    if (glowEyes) {
        c.save();
        c.fillStyle = irisCol;
        c.shadowColor = irisCol;
        c.shadowBlur = 5;
        c.beginPath(); c.ellipse(hx - 0.7, hy - 1.0, 1.35, 0.75, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(hx + 2.8, hy - 1.0, 1.25, 0.75, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(hx - 0.9, hy - 1.3, 0.65, 0.55);
        c.fillRect(hx + 2.6, hy - 1.3, 0.65, 0.55);
        c.restore();
    } else {
        c.fillStyle = '#ebe5dc';
        c.beginPath(); c.ellipse(hx - 0.7, hy - 1.0, 1.35, 0.72, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(hx + 2.8, hy - 1.0, 1.2, 0.72, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = irisCol;
        c.beginPath(); c.arc(hx - 0.5, hy - 1.0, 0.68, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(hx + 2.95, hy - 1.0, 0.64, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#120d0a';
        c.fillRect(hx - 0.7, hy - 1.25, 0.45, 0.45);
        c.fillRect(hx + 2.8, hy - 1.25, 0.45, 0.45);
        c.fillStyle = '#ffffff';
        c.fillRect(hx - 0.9, hy - 1.35, 0.35, 0.35);
        c.fillRect(hx + 2.6, hy - 1.35, 0.35, 0.35);
    }

    // Furrowed eyebrows
    c.strokeStyle = opts.browCol || hairCol;
    c.lineWidth = 0.85;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(hx - 2.2, hy - 2.1); c.quadraticCurveTo(hx - 0.7, hy - 2.45, hx + 0.5, hy - 1.95);
    c.moveTo(hx + 1.8, hy - 1.95); c.quadraticCurveTo(hx + 2.9, hy - 2.4, hx + 4.0, hy - 2.0);
    c.stroke();

    // Sculpted nose bridge highlight & nostril shadow
    c.strokeStyle = skinLit;
    c.lineWidth = 0.75;
    c.beginPath(); c.moveTo(hx + 1.2, hy - 1.6); c.lineTo(hx + 1.9, hy + 1.0); c.stroke();
    c.fillStyle = 'rgba(58, 30, 20, 0.55)';
    c.beginPath(); c.moveTo(hx + 0.7, hy + 1.2); c.lineTo(hx + 2.1, hy + 1.2); c.lineTo(hx + 1.3, hy + 1.8); c.closePath(); c.fill();

    // Stubble / Beard / Stern lips
    if (opts.beard) {
        c.fillStyle = opts.beardCol || hairCol;
        c.beginPath();
        c.moveTo(hx - 3.2, hy + 1.2);
        c.quadraticCurveTo(hx - 1.5, hy + 4.8, hx + 1.6, hy + 5.8);
        c.quadraticCurveTo(hx + 4.1, hy + 4.4, hx + 4.2, hy + 1.5);
        c.quadraticCurveTo(hx + 2.5, hy + 2.8, hx + 1.3, hy + 2.3);
        c.quadraticCurveTo(hx - 0.5, hy + 2.8, hx - 3.2, hy + 1.2);
        c.closePath();
        c.fill();
    } else if (opts.stubble) {
        c.fillStyle = 'rgba(40, 28, 22, 0.28)';
        c.beginPath();
        c.moveTo(hx - 2.8, hy + 1.5);
        c.quadraticCurveTo(hx + 1.2, hy + 5.2, hx + 4.1, hy + 1.8);
        c.quadraticCurveTo(hx + 1.4, hy + 4.5, hx - 2.8, hy + 1.5);
        c.fill();
    }
    c.strokeStyle = 'rgba(72, 34, 26, 0.72)';
    c.lineWidth = 0.75;
    c.beginPath(); c.moveTo(hx - 0.3, hy + 2.75); c.quadraticCurveTo(hx + 1.2, hy + 2.55, hx + 2.5, hy + 2.85); c.stroke();

    if (opts.scar) {
        c.strokeStyle = 'rgba(168, 72, 62, 0.62)';
        c.lineWidth = 0.65;
        c.beginPath(); c.moveTo(hx - 1.6, hy - 0.2); c.lineTo(hx - 0.6, hy + 2.3); c.stroke();
    }
}

function drawHeroFigure(c, role, cx, baseY, phase = 0, scale = 1.0, flashColor = null, facing = 1, strideAmt = 0, unitState = null) {
    c.save();
    c.translate(cx, baseY);
    const breath = Math.sin(phase * 1.65);
    const breathY = 1 + breath * 0.014;
    const breathX = 1 - breath * 0.008;
    const dir = facing < 0 ? -1 : 1;
    c.scale(scale * dir * breathX, scale * breathY);

    const stride = Math.sin(phase * 5.8) * 4.8 * strideAmt;
    const kneeLiftL = Math.max(0, stride) * 0.45;
    const kneeLiftR = Math.max(0, -stride) * 0.45;
    const lunge = (unitState && unitState.lunge) ? Math.sin(unitState.lunge * Math.PI) : 0;
    const isDefending = !!(unitState && unitState.defending);
    const lightSide = (unitState && typeof unitState.lightDir === 'number') ? (unitState.lightDir * dir) : 0.6;

    if (flashColor) {
        c.shadowColor = flashColor;
        c.shadowBlur = 14;
    }

    if (role === 'Warrior') {
        // 1. Billowing battle-worn crimson wool cloak with shaded drapery pleats & mud-stained hem
        const cloakSway = Math.sin(phase * 1.35) * 1.5 - stride * 0.45;
        const cloakGrad = c.createLinearGradient(-15, -36, 9, -1);
        cloakGrad.addColorStop(0, '#821920');
        cloakGrad.addColorStop(0.52, '#4f0d12');
        cloakGrad.addColorStop(0.88, '#29070a');
        cloakGrad.addColorStop(1, '#1c1412');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-8.5, -33.5);
        c.bezierCurveTo(-15, -24, -16.5 + cloakSway * 0.5, -11, -14.2 + cloakSway, -2);
        c.lineTo(-9.5 + cloakSway * 0.7, -3.4);
        c.lineTo(-5.2 + cloakSway * 0.4, -1.8);
        c.lineTo(1.5, -3.2);
        c.lineTo(6.8, -2.2);
        c.quadraticCurveTo(10.5, -18, 7.5, -33);
        c.closePath();
        c.fill();
        if (!flashColor) {
            c.strokeStyle = 'rgba(18, 4, 6, 0.58)';
            c.lineWidth = 1.1;
            c.beginPath();
            c.moveTo(-7.2, -30); c.quadraticCurveTo(-11.5, -16, -10 + cloakSway * 0.7, -3);
            c.moveTo(-3.5, -29); c.quadraticCurveTo(-6.2, -15, -5.2 + cloakSway * 0.4, -2.2);
            c.stroke();
        }

        // 2. Articulated Back Leg & Front Leg (Cuisse -> Winged Poleyn Knee -> Fluted Greave -> Laminated Sabaton)
        const drawKnightLeg = (hipX, strideOff, lift, darken) => {
            const kx = hipX + strideOff * 0.55 + 0.6;
            const ky = -9.2 - lift;
            const ax = hipX + strideOff * 0.95;
            const ay = -2.0 - lift * 0.5;
            const lit = darken ? '#aebbc7' : '#eef4fa';
            const mid = darken ? '#566370' : '#7d8d9c';
            const drk = darken ? '#1d232a' : '#2b333d';
            drawCylindricalLimb(c, hipX, -16.5, kx, ky, 2.9, 2.4, lit, mid, drk, flashColor);
            drawCylindricalLimb(c, kx, ky, ax, ay, 2.35, 1.85, lit, mid, drk, flashColor);
            // Winged steel poleyn (knee cop)
            c.fillStyle = flashColor || lit;
            c.beginPath(); c.ellipse(kx + 0.5, ky, 2.7, 1.9, -0.15, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#1a2026'; c.lineWidth = 0.7; c.stroke();
            // Articulated steel sabaton with heel & sole
            c.fillStyle = flashColor || mid;
            c.beginPath();
            c.moveTo(ax - 2.1, ay);
            c.lineTo(ax + 3.8, ay + 0.8);
            c.quadraticCurveTo(ax + 4.8, ay + 2.1, ax + 2.8, ay + 2.2);
            c.lineTo(ax - 2.3, ay + 2.1);
            c.closePath();
            c.fill();
            if (!flashColor) {
                c.fillStyle = '#121010';
                c.fillRect(ax - 2.3, ay + 1.7, 5.6, 0.7);
            }
        };
        drawKnightLeg(-3.8, -stride, kneeLiftR, true);
        drawKnightLeg(3.6, stride, kneeLiftL, false);

        // 3. Chainmail Hauberk Skirt & Scalloped Steel Tassets
        c.fillStyle = flashColor || '#333b44';
        c.beginPath();
        c.moveTo(-8.8, -18); c.lineTo(8.8, -18); c.lineTo(9.6, -12.2); c.lineTo(-9.6, -12.2);
        c.closePath(); c.fill();
        if (!flashColor) {
            c.strokeStyle = '#738291';
            c.lineWidth = 0.75;
            for (let rx = -7.5; rx <= 7.5; rx += 2.5) {
                c.beginPath(); c.arc(rx, -13.6, 1.1, 0, Math.PI); c.stroke();
            }
        }

        // 4. Sculpted V-Tapered Gothic Peascod Breastplate & Weathered Quartered Surcoat
        const plateGrad = c.createLinearGradient(-10.5, -34, 10.5, -15);
        plateGrad.addColorStop(0, '#f5f8fc');
        plateGrad.addColorStop(0.28, '#9aa9b8');
        plateGrad.addColorStop(0.68, '#485461');
        plateGrad.addColorStop(1, '#1e242b');
        c.fillStyle = flashColor || plateGrad;
        c.beginPath();
        c.moveTo(-9.8, -32.8);
        c.lineTo(10.2, -32.8);
        c.lineTo(8.2, -19.5);
        c.lineTo(0.8, -16.2);
        c.lineTo(-8.2, -19.5);
        c.closePath();
        c.fill();

        // Heraldic Crimson Surcoat Tabard, Riveted Belt & Scabbard
        c.fillStyle = flashColor || '#8c1b21';
        c.beginPath();
        c.moveTo(-4.2, -30.5); c.lineTo(4.6, -30.5); c.lineTo(5.2, -10.5); c.lineTo(0.4, -9.2); c.lineTo(-4.8, -10.8);
        c.closePath(); c.fill();
        if (!flashColor) {
            // Central tapul ridge specular & surcoat brass cross
            c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
            c.lineWidth = 0.85;
            c.beginPath(); c.moveTo(0.6, -32.2); c.lineTo(0.6, -18.5); c.stroke();
            c.fillStyle = '#d8b25c';
            c.fillRect(-0.5, -28.5, 1.8, 14);
            c.fillRect(-3.2, -24.5, 7.2, 1.6);
            // Riveted knightly belt, brass buckle & leather pouch
            c.fillStyle = '#2b170c';
            c.fillRect(-8.4, -19.4, 17.0, 2.5);
            c.fillStyle = '#4a2815';
            c.beginPath(); c.roundRect(-7.6, -18.2, 3.6, 4.2, 0.8); c.fill();
            c.strokeStyle = '#dfb860';
            c.lineWidth = 1.0;
            c.strokeRect(-1.2, -19.6, 3.6, 2.9);
        }

        // 5. Armored Steel Gorget & Sculpted Visored Gothic Close-Helm / Barbute
        drawCylindricalLimb(c, 0, -35.8, 0, -31.8, 4.2, 5.4, '#d9e3ec', '#6e7e8d', '#242b33', flashColor);
        const helmGrad = c.createLinearGradient(-7, -47, 7.5, -33);
        helmGrad.addColorStop(0, '#f7faff');
        helmGrad.addColorStop(0.35, '#9fb0bf');
        helmGrad.addColorStop(0.76, '#434e5b');
        helmGrad.addColorStop(1, '#1b2028');
        c.fillStyle = flashColor || helmGrad;
        c.beginPath();
        c.moveTo(-6.4, -34.2);
        c.lineTo(-6.8, -41.5);
        c.bezierCurveTo(-6.5, -47.2, 5.8, -47.5, 6.8, -41.2);
        c.lineTo(7.4, -37.2); // Beveled visor prow
        c.lineTo(5.8, -33.2);
        c.quadraticCurveTo(0.5, -31.8, -6.4, -34.2);
        c.closePath();
        c.fill();
        if (!flashColor) {
            // Raised helmet crest comb, brass cross-guard, visor slit & breathing holes
            c.strokeStyle = '#ffffff';
            c.lineWidth = 0.9;
            c.beginPath(); c.arc(0, -41.2, 5.6, -Math.PI * 0.82, -Math.PI * 0.22); c.stroke();
            c.fillStyle = '#cfa64c';
            c.fillRect(0.2, -44.8, 1.6, 11.4);
            c.fillRect(-4.8, -39.2, 11.6, 1.6);
            c.fillStyle = '#090b0f';
            c.fillRect(-4.2, -39.0, 10.4, 1.35);
            // Gleaming eyes inside visor shadow
            c.fillStyle = '#b8e8ff';
            c.fillRect(-2.4, -38.8, 1.9, 0.95);
            c.fillRect(2.2, -38.8, 1.9, 0.95);
            // Visor hinge rivet & ventilation breaths
            c.fillStyle = '#d8b25c';
            c.beginPath(); c.arc(-4.6, -37.2, 0.9, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#1c222a';
            c.fillRect(2.6, -36.2, 0.8, 0.8);
            c.fillRect(4.1, -36.5, 0.8, 0.8);
            c.fillRect(3.2, -34.8, 0.8, 0.8);
        }

        // 6. Articulated Shield Arm & Battle-Scarred Heraldic Heater Shield
        const shOffX = isDefending ? 3.5 : 0;
        const shOffY = isDefending ? -2.5 : 0;
        drawCylindricalLimb(c, -9.2, -30.5, -12.5 + shOffX * 0.5, -23.5 + shOffY * 0.5, 2.5, 2.2, '#cad6e2', '#647382', '#232a32', flashColor);
        c.save();
        c.translate(-11.5 + shOffX, -20.5 + shOffY + stride * 0.18);
        const shGrad = c.createLinearGradient(-6.5, -10, 6.5, 12);
        shGrad.addColorStop(0, '#44688f');
        shGrad.addColorStop(0.5, '#20364f');
        shGrad.addColorStop(1, '#0d1724');
        c.fillStyle = flashColor || shGrad;
        c.beginPath();
        c.moveTo(-6.2, -9.5);
        c.quadraticCurveTo(0, -10.8, 6.2, -9.0);
        c.lineTo(5.8, 1.5);
        c.quadraticCurveTo(3.2, 8.8, 0, 11.8);
        c.quadraticCurveTo(-3.8, 8.5, -6.2, 1.5);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || '#d1ad5c';
        c.lineWidth = 1.45;
        c.stroke();
        if (!flashColor) {
            // Embossed shield cross, central steel boss & diagonal battle-scar gouges
            c.strokeStyle = 'rgba(225, 196, 125, 0.65)';
            c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(0, -8.2); c.lineTo(0, 9.2); c.moveTo(-4.6, -1.8); c.lineTo(4.6, -1.8); c.stroke();
            c.fillStyle = '#eef4fa';
            c.beginPath(); c.arc(0, -1.8, 2.1, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(12, 16, 22, 0.82)';
            c.lineWidth = 0.85;
            c.beginPath(); c.moveTo(-3.8, -6.5); c.lineTo(2.5, 1.2); c.moveTo(-2.2, 3.2); c.lineTo(3.2, 6.2); c.stroke();
        }
        c.restore();

        // 7. Articulated Sword Arm (Pauldron -> Rerebrace -> Couter -> Vambrace -> Gauntlet Gripping Broadsword!)
        const armSwing = -stride * 0.42 + lunge * 5.5;
        const shX = 8.8, shY = -30.5;
        const elX = 10.6 + armSwing * 0.35, elY = -23.5 + lunge * 1.2;
        const wrX = 13.4 + armSwing * 0.75, wrY = -19.8 - lunge * 2.2;
        drawCylindricalLimb(c, shX, shY, elX, elY, 2.6, 2.2, '#edf3f8', '#7d8d9c', '#262e38', flashColor);
        drawCylindricalLimb(c, elX, elY, wrX, wrY, 2.2, 1.85, '#f5f9fc', '#8696a6', '#2b3440', flashColor);
        // Layered Gothic Pauldron + Haute-piece neck guard
        const pldGrad = c.createRadialGradient(shX - 1, shY - 2, 0.8, shX, shY, 6.2);
        pldGrad.addColorStop(0, '#ffffff');
        pldGrad.addColorStop(0.48, '#8798a8');
        pldGrad.addColorStop(1, '#232a33');
        c.fillStyle = flashColor || pldGrad;
        c.beginPath(); c.ellipse(shX + 0.5, shY + 0.5, 5.2, 4.2, 0.28, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#cfa64c'; c.lineWidth = 0.9; c.stroke();
        c.beginPath(); c.ellipse(-9.2, -30.2, 4.6, 3.8, -0.25, 0, Math.PI * 2); c.fill();
        // Elbow couter
        c.fillStyle = flashColor || '#eef4fa';
        c.beginPath(); c.arc(elX, elY, 2.1, 0, Math.PI * 2); c.fill();

        // Broadsword held directly inside the armored gauntlet at (wrX, wrY)
        c.save();
        c.translate(wrX, wrY);
        c.rotate(0.24 + Math.sin(phase * 0.95) * 0.04 + lunge * 0.85 - stride * 0.04);
        // Two-tone diamond-cross-section forged steel blade
        c.fillStyle = flashColor || '#f4f8fc';
        c.beginPath();
        c.moveTo(0, -29.5); c.lineTo(-2.4, -22.5); c.lineTo(-2.0, -1.5); c.lineTo(0, -1.5);
        c.closePath(); c.fill();
        c.fillStyle = flashColor || '#6c7c8e';
        c.beginPath();
        c.moveTo(0, -29.5); c.lineTo(2.4, -22.5); c.lineTo(2.0, -1.5); c.lineTo(0, -1.5);
        c.closePath(); c.fill();
        if (!flashColor) {
            c.strokeStyle = '#1b222b'; c.lineWidth = 0.7;
            c.beginPath(); c.moveTo(0, -29.5); c.lineTo(2.4, -22.5); c.lineTo(2.0, -1.5); c.lineTo(-2.0, -1.5); c.lineTo(-2.4, -22.5); c.closePath(); c.stroke();
            c.strokeStyle = '#394554'; c.lineWidth = 0.8;
            c.beginPath(); c.moveTo(0, -20.5); c.lineTo(0, -3.2); c.stroke();
        }
        // S-curved bronze quillon crossguard, cord-wrapped grip, wheel pommel & gauntlet knuckles!
        c.fillStyle = flashColor || '#dfb65e';
        c.beginPath();
        c.moveTo(-6.2, -2.2); c.quadraticCurveTo(0, -0.8, 6.2, -2.2);
        c.lineTo(5.8, -0.2); c.quadraticCurveTo(0, 0.8, -5.8, -0.2);
        c.closePath(); c.fill();
        c.fillStyle = '#3d2010';
        c.fillRect(-1.2, 0.2, 2.4, 4.8);
        c.fillStyle = flashColor || '#dfb65e';
        c.beginPath(); c.arc(0, 5.8, 1.9, 0, Math.PI * 2); c.fill();
        // Armored Steel Gauntlet Fingers wrapped around grip
        c.fillStyle = flashColor || '#b8c7d6';
        c.beginPath(); c.roundRect(-2.1, 0.2, 4.2, 3.1, 1.0); c.fill();
        c.strokeStyle = '#252d36'; c.lineWidth = 0.65; c.stroke();
        c.restore();

    } else if (role === 'Ranger') {
        // 1. Oiled-Leather Quiver & Fletched Goose-Feather Arrows
        c.save();
        c.translate(-7.2, -31.5);
        c.rotate(-0.28);
        c.fillStyle = flashColor || '#4d2b14';
        c.beginPath(); c.roundRect(-2.6, -8, 5.2, 16, 1.2); c.fill();
        c.fillStyle = flashColor || '#9e7638';
        c.fillRect(-2.8, -8, 5.6, 1.8);
        if (!flashColor) {
            [[-1.6, -14.5], [0.2, -15.8], [1.9, -13.8]].forEach(([ax, ay]) => {
                c.strokeStyle = '#cdb998'; c.lineWidth = 1.0;
                c.beginPath(); c.moveTo(ax * 0.7, -8); c.lineTo(ax, ay); c.stroke();
                c.fillStyle = '#6ec992';
                c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax - 1.3, ay + 2.8); c.lineTo(ax + 1.2, ay + 2.6); c.closePath(); c.fill();
            });
        }
        c.restore();

        // 2. Asymmetric Tattered Woodland Stalker Cloak
        const sway = Math.sin(phase * 1.45) * 1.7 - stride * 0.45;
        const cloakGrad = c.createLinearGradient(-13, -34, 9, -2);
        cloakGrad.addColorStop(0, '#274f3b');
        cloakGrad.addColorStop(0.58, '#152e22');
        cloakGrad.addColorStop(1, '#09140e');
        c.fillStyle = flashColor || cloakGrad;
        c.beginPath();
        c.moveTo(-8.2, -32.5);
        c.bezierCurveTo(-14.5, -22, -15.5 + sway * 0.5, -10, -12.8 + sway, -2.2);
        c.lineTo(-7.2 + sway * 0.5, -4.5);
        c.lineTo(-2.5, -2.0);
        c.lineTo(4.2, -4.2);
        c.quadraticCurveTo(9.5, -18, 7.2, -32);
        c.closePath();
        c.fill();

        // 3. Articulated Legs in Charcoal Wool Hose & Buckled Cuffed Leather Boots
        const drawRangerLeg = (hipX, strideOff, lift, darken) => {
            const kx = hipX + strideOff * 0.55 + 0.8;
            const ky = -9.4 - lift;
            const ax = hipX + strideOff * 0.95;
            const ay = -1.8 - lift * 0.5;
            drawCylindricalLimb(c, hipX, -16.2, kx, ky, 2.5, 2.0, darken ? '#333b36' : '#4a544e', '#262c29', '#121614', flashColor);
            // Tall cuffed buckskin boot
            drawCylindricalLimb(c, kx, ky, ax, ay, 2.25, 1.75, darken ? '#5c381e' : '#7d4d2a', '#472a15', '#211208', flashColor);
            c.fillStyle = flashColor || (darken ? '#4f2f18' : '#6e4323');
            c.beginPath(); c.roundRect(kx - 2.4, ky - 1.2, 4.8, 2.6, 0.8); c.fill();
            // Foot & heel
            c.fillStyle = flashColor || '#3b2210';
            c.beginPath();
            c.moveTo(ax - 2.0, ay); c.lineTo(ax + 3.8, ay + 0.9);
            c.quadraticCurveTo(ax + 4.5, ay + 2.0, ax + 2.6, ay + 2.0);
            c.lineTo(ax - 2.1, ay + 2.0); c.closePath(); c.fill();
            if (!flashColor) {
                c.fillStyle = '#c9a252';
                c.fillRect(ax - 0.5, ay - 2.2, 1.6, 1.1);
            }
        };
        drawRangerLeg(-3.4, -stride, kneeLiftR, true);
        drawRangerLeg(3.2, stride, kneeLiftL, false);

        // 4. Quilted Gambeson Skirt, Riveted Brigandine Leather Jerkin & Bandolier Pouches
        const jerkinGrad = c.createLinearGradient(-8.5, -32, 8.5, -13);
        jerkinGrad.addColorStop(0, '#8a552c');
        jerkinGrad.addColorStop(0.55, '#543117');
        jerkinGrad.addColorStop(1, '#291609');
        c.fillStyle = flashColor || jerkinGrad;
        c.beginPath();
        c.moveTo(-8.5, -31.5); c.lineTo(8.5, -31.5); c.lineTo(6.8, -19.0);
        c.lineTo(7.8, -13.2); c.lineTo(-7.8, -13.2); c.lineTo(-6.8, -19.0);
        c.closePath(); c.fill();
        if (!flashColor) {
            // Brigandine brass studs, diagonal bandolier, ammo pouches & sheathed hunting knife
            c.fillStyle = '#d4ae5c';
            [[-4.5, -27], [4.5, -27], [-3.8, -22.5], [3.8, -22.5]].forEach(([rx, ry]) => {
                c.fillRect(rx - 0.5, ry - 0.5, 1.0, 1.0);
            });
            c.strokeStyle = '#361d0c'; c.lineWidth = 2.1;
            c.beginPath(); c.moveTo(-6.8, -30.5); c.lineTo(6.2, -15.5); c.stroke();
            c.strokeStyle = '#b58d46'; c.lineWidth = 0.8;
            c.beginPath(); c.moveTo(-6.8, -30.5); c.lineTo(6.2, -15.5); c.stroke();
            c.fillStyle = '#261408';
            c.fillRect(-7.2, -18.0, 14.4, 2.3);
            c.strokeStyle = '#c9a252'; c.lineWidth = 0.9;
            c.strokeRect(-1.2, -18.2, 3.2, 2.7);
            // Sheathed steel hunting dagger at hip
            c.strokeStyle = '#cfd8e0'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(-6.5, -17.5); c.lineTo(-9.2, -11.5); c.stroke();
        }

        // 5. Forward Bow Arm (+X) Gripping Composite Recurve Longbow
        const bowExtend = lunge * 2.5;
        const bElX = 8.6 + bowExtend * 0.4, bElY = -25.2;
        const bWrX = 12.6 + bowExtend, bWrY = -22.5;
        drawCylindricalLimb(c, 6.8, -29.5, bElX, bElY, 2.2, 1.9, '#36694f', '#214231', '#0e2118', flashColor);
        drawCylindricalLimb(c, bElX, bElY, bWrX, bWrY, 1.95, 1.6, '#87542c', '#543218', '#261509', flashColor);

        // 6. Sculpted 3/4 Hooded Marksman Visage (Chiseled jaw, stubble, scar, keen emerald eyes + deep Ranger Cowl)
        c.fillStyle = flashColor || '#163325';
        c.beginPath();
        c.moveTo(-7.8, -31.0);
        c.bezierCurveTo(-9.2, -41.5, -2.5, -46.8, 3.2, -44.8);
        c.quadraticCurveTo(7.8, -41.5, 6.8, -31.5);
        c.closePath();
        c.fill();
        drawRealisticHumanHead(c, 0.5, -36.8, {
            skinLit: '#eac09e', skinMid: '#bf8b67', skinDark: '#69422c',
            hairCol: '#291b12', irisCol: '#42b874', stubble: true, scar: true, hairLocks: false
        }, flashColor);
        // Deep overhanging Ranger hood brim casting shadow over upper brow
        const hoodGrad = c.createLinearGradient(-7, -46, 6, -34);
        hoodGrad.addColorStop(0, '#306149');
        hoodGrad.addColorStop(0.6, '#1b3b2c');
        hoodGrad.addColorStop(1, '#0c1c14');
        c.fillStyle = flashColor || hoodGrad;
        c.beginPath();
        c.moveTo(-7.6, -31.5);
        c.bezierCurveTo(-8.4, -40.5, -2.5, -46.2, 5.6, -42.2);
        c.quadraticCurveTo(6.8, -39.5, 5.8, -37.8);
        c.quadraticCurveTo(1.2, -40.8, -3.2, -37.5);
        c.lineTo(-4.8, -31.2);
        c.closePath();
        c.fill();
        // Woven scarf / gorget around neck
        c.fillStyle = flashColor || '#234735';
        c.beginPath(); c.ellipse(0, -31.2, 6.8, 2.2, 0, 0, Math.PI * 2); c.fill();

        // 7. Composite Horn-and-Yew Recurve Bow, Drawn String, Nocked Arrow & Rear Drawing Hand!
        const pullBack = -2.2 - lunge * 3.8;
        c.save();
        c.translate(bWrX, bWrY);
        // Laminated yew limbs + horn recurve tips
        c.strokeStyle = flashColor || '#9e6734';
        c.lineWidth = 2.3;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-1.2, -14.8);
        c.bezierCurveTo(5.8, -9.5, 2.2, -3.5, 0.2, 0);
        c.bezierCurveTo(2.2, 3.5, 5.8, 9.5, -1.2, 14.8);
        c.stroke();
        if (!flashColor) {
            c.strokeStyle = '#e3d5be'; c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(-1.2, -14.8); c.quadraticCurveTo(-2.8, -16.2, -0.4, -16.8);
            c.moveTo(-1.2, 14.8);  c.quadraticCurveTo(-2.8, 16.2, -0.4, 16.8);
            c.stroke();
            // Taut bowstring pulled to anchor point
            const anchorLocalX = pullBack - bWrX;
            c.strokeStyle = 'rgba(235, 240, 246, 0.78)';
            c.lineWidth = 0.85;
            c.beginPath();
            c.moveTo(-0.8, -15.8);
            c.lineTo(anchorLocalX, -0.5);
            c.lineTo(-0.8, 15.8);
            c.stroke();
            // Nocked ash arrow shaft, emerald fletching & forged steel broadhead
            c.strokeStyle = '#dfd1b8'; c.lineWidth = 1.35;
            c.beginPath(); c.moveTo(anchorLocalX, -0.5); c.lineTo(8.5, -0.2); c.stroke();
            c.fillStyle = '#5ad487';
            c.beginPath(); c.moveTo(anchorLocalX, -0.5); c.lineTo(anchorLocalX - 3.2, -2.2); c.lineTo(anchorLocalX + 1.2, -0.5); c.fill();
            c.fillStyle = '#eef4fa';
            c.beginPath(); c.moveTo(11.8, -0.2); c.lineTo(7.2, -2.2); c.lineTo(8.0, -0.2); c.lineTo(7.2, 1.8); c.closePath(); c.fill();
        }
        // Forward bow-hand fingers wrapped around riser
        c.fillStyle = flashColor || '#d4a380';
        c.beginPath(); c.ellipse(0.4, 0.2, 1.8, 1.5, 0, 0, Math.PI * 2); c.fill();
        c.restore();

        // Rear Drawing Arm (-X) bent at elbow pulling string at chest/cheek
        drawCylindricalLimb(c, -6.5, -29.5, -9.8, -23.8, 2.2, 1.85, '#34664c', '#1f3f2e', '#0d1e15', flashColor);
        drawCylindricalLimb(c, -9.8, -23.8, pullBack, -23.0, 1.8, 1.5, '#7c4c27', '#4c2d15', '#211208', flashColor);
        c.fillStyle = flashColor || '#4a2b14';
        c.beginPath(); c.arc(pullBack, -23.0, 1.65, 0, Math.PI * 2); c.fill();

    } else if (role === 'Cleric') {
        // 1. Delicate Wrought-Gold Filigree Halo Behind Head
        if (!flashColor) {
            c.save();
            c.strokeStyle = 'rgba(232, 198, 108, 0.65)';
            c.lineWidth = 1.25;
            c.beginPath(); c.arc(-0.2, -37.8, 9.8, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = 'rgba(255, 244, 198, 0.28)';
            c.lineWidth = 2.6;
            c.beginPath(); c.arc(-0.2, -37.8, 9.8, 0, Math.PI * 2); c.stroke();
            c.restore();
        }

        // 2. Visible Plated Inquisitor Boots Stepping Beneath Crimson Under-Cassock
        const drawClericBoot = (bx, strideOff, lift) => {
            const fx = bx + strideOff * 0.85;
            const fy = -1.8 - lift * 0.45;
            c.fillStyle = flashColor || '#42161b';
            c.fillRect(fx - 2.2, -8.5, 4.4, 6.8);
            c.fillStyle = flashColor || '#6e7b88';
            c.beginPath();
            c.moveTo(fx - 2.1, fy); c.lineTo(fx + 3.6, fy + 0.8);
            c.quadraticCurveTo(fx + 4.4, fy + 2.0, fx + 2.5, fy + 2.0);
            c.lineTo(fx - 2.2, fy + 2.0); c.closePath(); c.fill();
            if (!flashColor) {
                c.fillStyle = '#d4ae58';
                c.fillRect(fx + 0.8, fy + 0.3, 1.8, 1.1);
            }
        };
        drawClericBoot(-3.6, -stride, kneeLiftR);
        drawClericBoot(3.5, stride, kneeLiftL);

        // 3. Pleated Ivory-Damask Liturgical Chasuble Skirt with Shaded Drapery Creases & Gold Brocade Hem
        const robeGrad = c.createLinearGradient(-11.5, -24, 11.5, -2);
        robeGrad.addColorStop(0, '#f4efe6');
        robeGrad.addColorStop(0.55, '#c9beaa');
        robeGrad.addColorStop(1, '#756b59');
        c.fillStyle = flashColor || robeGrad;
        c.beginPath();
        c.moveTo(-7.8, -21);
        c.quadraticCurveTo(-10.8, -11, -11.4 - stride * 0.22, -2.4);
        c.quadraticCurveTo(0, -1.2, 11.4 + stride * 0.22, -2.4);
        c.quadraticCurveTo(10.8, -11, 7.8, -21);
        c.closePath();
        c.fill();
        if (!flashColor) {
            c.strokeStyle = 'rgba(52, 44, 34, 0.38)';
            c.lineWidth = 0.95;
            c.beginPath();
            c.moveTo(-4.8, -19); c.lineTo(-7.6, -2.6);
            c.moveTo(-1.8, -19); c.lineTo(-2.6, -2.2);
            c.moveTo(4.8, -19);  c.lineTo(7.6, -2.6);
            c.stroke();
            c.strokeStyle = '#d4ae56'; c.lineWidth = 1.25;
            c.beginPath(); c.moveTo(-11.2 - stride * 0.2, -3.1); c.quadraticCurveTo(0, -1.9, 11.2 + stride * 0.2, -3.1); c.stroke();
        }

        // 4. Burnished Steel-and-Gold Cathedral Breastplate, Crimson Stole & Hanging Censer
        const cuirassG = c.createLinearGradient(-9, -32, 9, -18);
        cuirassG.addColorStop(0, '#fcfaf5');
        cuirassG.addColorStop(0.42, '#c2c8ce');
        cuirassG.addColorStop(1, '#58626e');
        c.fillStyle = flashColor || cuirassG;
        c.beginPath();
        c.moveTo(-8.8, -31.8); c.lineTo(8.8, -31.8); c.lineTo(7.2, -19.2); c.lineTo(0, -17.2); c.lineTo(-7.2, -19.2);
        c.closePath(); c.fill();
        // Embroidered crimson & gold liturgical stole hanging down front
        c.fillStyle = flashColor || '#8f1e26';
        c.beginPath();
        c.moveTo(-2.6, -30.5); c.lineTo(2.8, -30.5); c.lineTo(3.4, -4.5); c.lineTo(-3.2, -4.5);
        c.closePath(); c.fill();
        if (!flashColor) {
            c.fillStyle = '#dfb860';
            c.fillRect(-0.7, -28.8, 1.6, 22.5);
            c.fillRect(-2.6, -25.2, 5.4, 1.5);
            c.fillStyle = '#331d10';
            c.fillRect(-7.4, -19.4, 14.8, 2.0);
            // Hanging brass prayer censer at right hip
            c.fillStyle = '#d4ae56';
            c.beginPath(); c.arc(-5.6, -13.5, 1.8, 0, Math.PI * 2); c.fill();
        }

        // 5. Left Arm Cradling Illuminated Leather-and-Gold Scripture Codex
        drawCylindricalLimb(c, -8.2, -29.8, -10.8, -23.5, 2.3, 2.0, '#efe9de', '#b8ad99', '#665d4e', flashColor);
        drawCylindricalLimb(c, -10.8, -23.5, -7.2, -20.2, 1.9, 1.6, '#e5c678', '#9e7c34', '#4d3914', flashColor);
        // Illuminated Holy Tome with gold corner clasps & pages
        c.save();
        c.translate(-6.8, -20.5);
        c.rotate(-0.22);
        c.fillStyle = flashColor || '#5e1920';
        c.beginPath(); c.roundRect(-3.8, -4.5, 7.2, 8.6, 0.9); c.fill();
        if (!flashColor) {
            c.fillStyle = '#f5eedc';
            c.fillRect(2.4, -4.0, 1.1, 7.6);
            c.strokeStyle = '#e3be68'; c.lineWidth = 0.9;
            c.strokeRect(-3.4, -4.1, 5.8, 7.8);
        }
        c.restore();
        c.fillStyle = flashColor || '#e8be9c';
        c.beginPath(); c.arc(-6.5, -19.5, 1.5, 0, Math.PI * 2); c.fill();

        // 6. Sculpted 3/4 Noble Prelate Visage, Flowing Chestnut Hair & Gilded Cathedral Diadem
        c.fillStyle = flashColor || '#d8cfbe';
        c.beginPath(); c.ellipse(0, -30.8, 8.8, 2.8, 0, 0, Math.PI * 2); c.fill();
        drawRealisticHumanHead(c, 0.4, -37.2, {
            skinLit: '#f7d4b6', skinMid: '#d49f7b', skinDark: '#7a4d35',
            hairCol: '#593622', irisCol: '#3e739e', hairLocks: true
        }, flashColor);
        if (!flashColor) {
            // Gilded cathedral circlet + emerald cabochon jewel on brow
            c.strokeStyle = '#ebd07e';
            c.lineWidth = 1.45;
            c.beginPath(); c.arc(0.4, -38.8, 5.1, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
            c.fillStyle = '#5ef2b8';
            c.beginPath(); c.arc(1.5, -43.6, 1.15, 0, Math.PI * 2); c.fill();
        }

        // 7. Right Arm (Pauldron -> Pleated Sleeve -> Brass Vambrace -> Hand Gripping Winged Sun Crosier!)
        const castLift = lunge * 3.8;
        const cElX = 9.8 + lunge * 1.2, cElY = -23.5 - castLift * 0.4;
        const cWrX = 12.6 + lunge * 2.0, cWrY = -20.0 - castLift;
        drawCylindricalLimb(c, 8.0, -29.8, cElX, cElY, 2.4, 2.0, '#f4efe6', '#bfb4a0', '#696050', flashColor);
        drawCylindricalLimb(c, cElX, cElY, cWrX, cWrY, 1.95, 1.65, '#f2d994', '#ad883b', '#4f3b14', flashColor);
        // Steel-and-gold ecclesiastic pauldrons
        c.fillStyle = flashColor || '#e3ddd0';
        c.beginPath(); c.ellipse(8.2, -29.8, 4.4, 3.3, 0.25, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#d4ae56'; c.lineWidth = 0.9; c.stroke();
        c.beginPath(); c.ellipse(-8.2, -29.8, 4.2, 3.2, -0.25, 0, Math.PI * 2); c.fill();

        // Wrought-Gold Winged Sun Crosier gripped in hand at (cWrX, cWrY)
        c.save();
        c.translate(cWrX, cWrY);
        c.rotate(0.06 - lunge * 0.18);
        drawCylindricalLimb(c, 0, -20.5, 0, 18.5, 1.25, 1.15, '#fae4a2', '#b88f39', '#523b12', flashColor);
        // Seraphim golden wings & halo ring at crosier crown
        c.fillStyle = flashColor || '#ebd07e';
        c.beginPath();
        c.moveTo(-1, -19); c.quadraticCurveTo(-7.5, -21.5, -6.5, -26.5); c.quadraticCurveTo(-3.2, -23.5, -1.2, -21.5);
        c.moveTo(1, -19);  c.quadraticCurveTo(7.5, -21.5, 6.5, -26.5);   c.quadraticCurveTo(3.2, -23.5, 1.2, -21.5);
        c.fill();
        c.strokeStyle = flashColor || '#fff2b8';
        c.lineWidth = 1.45;
        c.beginPath(); c.arc(0, -24.2, 4.8, 0, Math.PI * 2); c.stroke();
        const gemY = -24.2 + Math.sin(phase * 2.1) * 0.9;
        if (!flashColor) {
            c.fillStyle = '#a8ffe4';
            c.shadowColor = '#5cf2c8';
            c.shadowBlur = 9;
            c.beginPath();
            c.moveTo(0, gemY - 3.4); c.lineTo(2.5, gemY); c.lineTo(0, gemY + 3.4); c.lineTo(-2.5, gemY);
            c.closePath(); c.fill();
            c.shadowBlur = 0;
        }
        // Sculpted hand gripping crosier shaft
        c.fillStyle = flashColor || '#ecc29f';
        c.beginPath(); c.roundRect(-1.8, -1.4, 3.6, 2.8, 1.0); c.fill();
        c.restore();

    } else {
        // ABYSSAL ARCHMAGE / BATTLE SORCERER
        // 1. Back Coat Tails & Buckled Scholar Boots Visible in Split-Front Greatcoat
        const sway = Math.sin(phase * 1.5) * 1.6 - stride * 0.4;
        c.fillStyle = flashColor || '#140a29';
        c.beginPath();
        c.moveTo(-8.2, -28);
        c.lineTo(-13.2 + sway * 0.6, -2.0);
        c.lineTo(12.2 + stride * 0.25, -2.0);
        c.lineTo(8.2, -28);
        c.closePath();
        c.fill();

        const drawMageBoot = (bx, strideOff, lift) => {
            const fx = bx + strideOff * 0.88;
            const fy = -1.8 - lift * 0.45;
            drawCylindricalLimb(c, bx, -14.5, fx, fy, 2.1, 1.65, '#302447', '#1d142e', '#0d0817', flashColor);
            c.fillStyle = flashColor || '#2b1b14';
            c.beginPath();
            c.moveTo(fx - 1.9, fy); c.lineTo(fx + 3.8, fy + 0.7);
            c.quadraticCurveTo(fx + 4.8, fy + 1.6, fx + 2.6, fy + 2.0);
            c.lineTo(fx - 2.0, fy + 2.0); c.closePath(); c.fill();
        };
        drawMageBoot(-3.3, -stride, kneeLiftR);
        drawMageBoot(3.2, stride, kneeLiftL);

        // 2. Tailored Split-Front Twilight-Velvet Greatcoat, Quilted Vest, Scroll Case & Ruby Vial
        const coatGrad = c.createLinearGradient(-12, -32, 12, -2);
        coatGrad.addColorStop(0, '#59369c');
        coatGrad.addColorStop(0.52, '#301a5c');
        coatGrad.addColorStop(1, '#15092e');
        c.fillStyle = flashColor || coatGrad;
        // Left & right split coat panels revealing quilted dark-crimson inner doublet
        c.fillStyle = flashColor || '#3b1528';
        c.fillRect(-4.2, -30.5, 8.4, 15.5);
        c.fillStyle = flashColor || coatGrad;
        c.beginPath();
        c.moveTo(-8.8, -31.5); c.lineTo(-2.2, -31.5); c.lineTo(-3.8, -2.2); c.lineTo(-12.6 - stride * 0.25, -2.4);
        c.closePath(); c.fill();
        c.beginPath();
        c.moveTo(2.4, -31.5); c.lineTo(8.8, -31.5); c.lineTo(12.6 + stride * 0.25, -2.4); c.lineTo(4.0, -2.2);
        c.closePath(); c.fill();

        if (!flashColor) {
            // Gold geometric rune lapels, leather alchemist belt, parchment scroll tube & ruby vial
            c.strokeStyle = '#d6ae56'; c.lineWidth = 1.15;
            c.beginPath();
            c.moveTo(-2.2, -30.8); c.lineTo(-3.8, -2.4);
            c.moveTo(2.4, -30.8);  c.lineTo(4.0, -2.4);
            c.stroke();
            c.fillStyle = '#26150c';
            c.fillRect(-7.6, -18.6, 15.2, 2.3);
            c.strokeStyle = '#dfb860'; c.lineWidth = 0.9;
            c.strokeRect(-1.3, -18.8, 3.2, 2.7);
            // Rolled parchment scroll case & glowing crimson mana vial at belt
            c.fillStyle = '#d9c79e';
            c.save(); c.translate(-5.8, -15.5); c.rotate(0.35); c.fillRect(-1.1, -2.8, 2.2, 5.6); c.restore();
            c.fillStyle = '#ff4d6d';
            c.beginPath(); c.arc(5.4, -15.6, 1.5, 0, Math.PI * 2); c.fill();
        }

        // 3. Layered High-Collar Velvet Mantle
        c.fillStyle = flashColor || '#412475';
        c.beginPath(); c.ellipse(0, -30.5, 9.8, 3.6, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#cfa64c'; c.lineWidth = 0.95; c.stroke();

        // 4. Left Conjuring Arm + Open Sculpted Hand & Floating Spell Sigil Flame!
        const conjLift = Math.sin(phase * 2.4) * 1.0 + lunge * 3.2;
        drawCylindricalLimb(c, -8.2, -29.5, -11.2, -23.5, 2.3, 2.0, '#623ca8', '#351d63', '#160b2e', flashColor);
        drawCylindricalLimb(c, -11.2, -23.5, -8.5, -20.5 - conjLift * 0.5, 2.0, 1.6, '#523091', '#2b1652', '#120826', flashColor);
        c.fillStyle = flashColor || '#e8be9c';
        c.beginPath(); c.ellipse(-8.2, -20.8 - conjLift * 0.5, 1.8, 1.2, -0.2, 0, Math.PI * 2); c.fill();
        if (!flashColor) {
            const fy = -24.8 - conjLift;
            const fg = c.createRadialGradient(-8.4, fy, 0.5, -8.4, fy, 4.2);
            fg.addColorStop(0, '#ffffff');
            fg.addColorStop(0.45, '#6beeff');
            fg.addColorStop(1, 'rgba(130, 80, 255, 0)');
            c.fillStyle = fg;
            c.beginPath(); c.arc(-8.4, fy, 4.2, 0, Math.PI * 2); c.fill();
        }

        // 5. Realistic Sculpted Archmage Visage (Chiseled cheekbones, silver-streaked beard, luminous arcane eyes)
        drawRealisticHumanHead(c, 0.4, -36.8, {
            skinLit: '#edd0b4', skinMid: '#bfa089', skinDark: '#63493e',
            hairCol: '#c4cad4', browCol: '#b8c0cc', beard: true, beardCol: '#9aa3b0',
            irisCol: '#7ef0ff', glowEyes: true, hairLocks: true
        }, flashColor);

        // 6. Weathered Stitched Leather-and-Velvet Pointed Archmage Hat with Curved Brim
        const hatGrad = c.createLinearGradient(-9, -54, 9, -37);
        hatGrad.addColorStop(0, '#6b43b5');
        hatGrad.addColorStop(0.55, '#341c63');
        hatGrad.addColorStop(1, '#160a2e');
        c.fillStyle = flashColor || hatGrad;
        // Shadow under hat brim
        c.beginPath();
        c.ellipse(0.2, -39.2, 12.6, 3.3, -0.07, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(-7.4, -39.5);
        c.bezierCurveTo(-5.5, -47.5, -0.8, -53.2, 5.4, -54.2);
        c.quadraticCurveTo(3.8, -48.5, 7.4, -39.2);
        c.closePath();
        c.fill();
        if (!flashColor) {
            // Leather hatband & brass buckle
            c.fillStyle = '#2e190d';
            c.fillRect(-6.8, -41.4, 13.6, 2.2);
            c.strokeStyle = '#e0b85c'; c.lineWidth = 1.0;
            c.strokeRect(-0.8, -41.7, 3.2, 2.7);
        }

        // 7. Right Arm + Gloved Hand Gripping Gnarled Dragon-Claw Arcane Staff
        const stElX = 9.8 + lunge * 1.2, stElY = -23.5;
        const stWrX = 12.6 + lunge * 2.4, stWrY = -19.8 - lunge * 2.5;
        drawCylindricalLimb(c, 8.2, -29.5, stElX, stElY, 2.35, 2.0, '#663fb0', '#381e69', '#170b30', flashColor);
        drawCylindricalLimb(c, stElX, stElY, stWrX, stWrY, 2.0, 1.65, '#553396', '#2d1757', '#130926', flashColor);

        c.save();
        c.translate(stWrX, stWrY);
        c.rotate(0.08 + lunge * 0.24);
        // Gnarled ironwood shaft
        drawCylindricalLimb(c, 0, -17.5, 0, 18.2, 1.35, 1.15, '#8a5832', '#4f2f16', '#211207', flashColor);
        // Dragon-claw bronze prongs cradling levitating catalyst orb
        c.strokeStyle = flashColor || '#d6ae56';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(0, -16.5); c.bezierCurveTo(-5.8, -18.5, -5.5, -25.5, -1.2, -27.2);
        c.moveTo(0, -16.5); c.bezierCurveTo(5.2, -18.0, 5.2, -24.5, 1.8, -26.2);
        c.stroke();

        const orbY = -22.2 + Math.cos(phase * 2.3) * 1.2;
        if (!flashColor) {
            const orbGrad = c.createRadialGradient(-0.4, orbY, 0.7, -0.4, orbY, 6.4);
            orbGrad.addColorStop(0, '#ffffff');
            orbGrad.addColorStop(0.38, '#e396ff');
            orbGrad.addColorStop(0.72, 'rgba(155, 72, 235, 0.45)');
            orbGrad.addColorStop(1, 'rgba(110, 40, 190, 0)');
            c.fillStyle = orbGrad;
            c.beginPath(); c.arc(-0.4, orbY, 6.4, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(205, 245, 255, 0.65)';
            c.lineWidth = 0.75;
            c.beginPath(); c.ellipse(-0.4, orbY, 4.8, 1.8, phase * 0.9, 0, Math.PI * 2); c.stroke();
        }
        // Leather-gloved hand gripping staff
        c.fillStyle = flashColor || '#4a2c18';
        c.beginPath(); c.roundRect(-1.8, -1.5, 3.6, 2.9, 1.0); c.fill();
        c.restore();
    }

    // 8. Dynamic Directional Warm Torch Rim-Light & Cool Cavern Shadow Edge
    if (!flashColor) {
        const rimX = lightSide >= 0 ? 1 : -1;
        c.save();
        c.strokeStyle = 'rgba(255, 206, 128, 0.34)';
        c.lineWidth = 1.05;
        c.lineCap = 'round';
        c.beginPath();
        if (rimX > 0) {
            c.arc(0.5, -37.5, 7.2, -Math.PI * 0.45, Math.PI * 0.12);
        } else {
            c.arc(-0.5, -37.5, 7.2, Math.PI * 0.88, Math.PI * 1.45);
        }
        c.stroke();

        // Subtle Protective Guard Aura Ring when Defending
        if (isDefending) {
            c.strokeStyle = 'rgba(135, 220, 255, 0.55)';
            c.lineWidth = 1.3;
            c.beginPath();
            c.ellipse(0, -22, 16.5, 22, 0, -Math.PI * 0.75, Math.PI * 0.45);
            c.stroke();
        }
        c.restore();
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

        // Articulated Dread Arms + Runic Dreadblade / Greatsword
        drawCylindricalLimb(c, 11.5, -34, 14.5, -26.5, 3.0, 2.5, palette.trim, palette.armor, '#090a0d', flashColor);
        drawCylindricalLimb(c, 14.5, -26.5, 16.5, -21.5, 2.5, 2.1, palette.trim, palette.armor, '#090a0d', flashColor);
        drawCylindricalLimb(c, -11.5, -34, -15.5, -24.5, 2.8, 2.2, palette.trim, palette.armor, '#090a0d', flashColor);
        c.save();
        c.translate(16.5, -21.5);
        c.rotate(0.22 + Math.sin(phase * 1.2) * 0.05);
        c.fillStyle = flashColor || palette.glow;
        c.beginPath();
        c.moveTo(0, -28); c.lineTo(4.2, -19); c.lineTo(3, 5); c.lineTo(-3, 5); c.lineTo(-4.2, -19);
        c.closePath();
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(-0.8, -23, 1.6, 24);
        c.fillStyle = palette.trim;
        c.fillRect(-6, 4, 12, 2.8);
        c.fillStyle = flashColor || '#262b33';
        c.beginPath(); c.roundRect(-2.4, 0.5, 4.8, 3.5, 1.0); c.fill();
        c.restore();
    } else if (enemy.isBoss) {
        // TIER 5 MINI-BOSS (Sculpted Ironclad Warden / Executioner)
        const bColor = enemy.color || '#e67e22';
        drawCylindricalLimb(c, -4.5, -15, -4.8, -2, 2.7, 2.1, '#718093', '#2f3640', '#111418', flashColor);
        drawCylindricalLimb(c, 4.5, -15, 4.8, -2, 2.7, 2.1, '#718093', '#2f3640', '#111418', flashColor);
        const bodyGrad = c.createLinearGradient(-12, -36, 12, -10);
        bodyGrad.addColorStop(0, '#b2bec3');
        bodyGrad.addColorStop(0.5, '#2f3640');
        bodyGrad.addColorStop(1, '#12151a');
        c.fillStyle = flashColor || bodyGrad;
        c.beginPath();
        c.moveTo(-11.8, -34.5); c.lineTo(11.8, -34.5); c.lineTo(8.5, -12); c.lineTo(-8.5, -12);
        c.closePath();
        c.fill();
        c.strokeStyle = flashColor || bColor;
        c.lineWidth = 1.2;
        c.stroke();

        // Horns & Riveted Executioner Greathelm
        c.fillStyle = flashColor || '#2f3640';
        c.beginPath(); c.arc(0, -38.5, 7.6, 0, Math.PI * 2); c.fill();
        c.strokeStyle = flashColor || '#dcdde1';
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(-5, -41.5); c.quadraticCurveTo(-11, -46, -12, -50);
        c.moveTo(5, -41.5);  c.quadraticCurveTo(11, -46, 12, -50);
        c.stroke();

        c.fillStyle = bColor;
        c.shadowColor = bColor;
        c.shadowBlur = 7;
        c.fillRect(-4, -39.5, 3, 2);
        c.fillRect(1, -39.5, 3, 2);
        c.shadowBlur = 0;

        // Articulated Muscular Armored Arm Gripping Twin-Bladed Warden Greataxe
        drawCylindricalLimb(c, -9.8, -32, -12.5, -22, 2.5, 2.0, '#7f8fa6', '#353b48', '#14171c', flashColor);
        drawCylindricalLimb(c, 9.8, -32, 12.2, -25, 2.6, 2.1, '#95a5a6', '#353b48', '#14171c', flashColor);
        drawCylindricalLimb(c, 12.2, -25, 14.2, -20.5, 2.2, 1.8, '#b2bec3', '#485460', '#181c22', flashColor);
        c.save();
        c.translate(14.2, -20.5);
        c.rotate(0.12 + Math.sin(phase * 1.3) * 0.05);
        drawCylindricalLimb(c, 0, -19, 0, 14, 1.4, 1.2, '#a66b35', '#6e421c', '#2b1808', flashColor);
        c.fillStyle = flashColor || '#eef3f7';
        c.beginPath();
        c.moveTo(0, -17);
        c.quadraticCurveTo(10.5, -22, 9.5, -8.5);
        c.quadraticCurveTo(4, -5.5, 0, -8.5);
        c.quadraticCurveTo(-4, -5.5, -9.5, -8.5);
        c.quadraticCurveTo(-10.5, -22, 0, -17);
        c.fill();
        c.fillStyle = flashColor || '#57606f';
        c.beginPath(); c.roundRect(-2.1, -1.6, 4.2, 3.2, 0.9); c.fill();
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

        // Articulated Clavicle, Humerus & Ulna Arm Bones + Buckler & Notched Steel Halberd
        c.strokeStyle = flashColor || '#d5d0c3';
        c.lineWidth = 1.7;
        c.beginPath();
        c.moveTo(-6.2, -27.5); c.lineTo(6.2, -27.5);
        c.moveTo(-6.2, -27.5); c.lineTo(-9.2, -22.5); c.lineTo(-8.8, -19.5);
        c.moveTo(6.2, -27.5);  c.lineTo(8.8, -22.5);  c.lineTo(10.6, -19.2);
        c.stroke();

        c.fillStyle = flashColor || '#3c444d';
        c.beginPath(); c.ellipse(-9.5, -20, 4.4, 6.8, -0.15, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#8b98a6';
        c.lineWidth = 1.1;
        c.stroke();
        c.fillStyle = flashColor || '#aeb9c4';
        c.beginPath(); c.arc(-9.5, -20, 1.5, 0, Math.PI * 2); c.fill();

        c.save();
        c.translate(10.6, -19.2);
        c.rotate(0.06 + Math.sin(phase * 1.4) * 0.04);
        drawCylindricalLimb(c, 0, -22, 0, 15, 1.1, 1.0, '#7d5026', '#4f3116', '#241508', flashColor);
        c.fillStyle = flashColor || '#cbd5df';
        c.beginPath();
        c.moveTo(0, -28); c.lineTo(7.4, -17.5); c.lineTo(5.2, -10.8); c.lineTo(1.0, -13.2); c.lineTo(0, -23.5);
        c.closePath();
        c.fill();
        // Bony phalanges gripping halberd shaft
        c.fillStyle = flashColor || '#e2ddd0';
        c.fillRect(-1.5, -1.2, 3.0, 2.2);
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

        // Oak plank seams, beveled iron reinforcement straps, rivets & brass lockplate
        c.strokeStyle = 'rgba(24, 10, 3, 0.55)';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-12.5, -10); c.lineTo(12.5, -10);
        c.moveTo(-12.5, -5.5); c.lineTo(12.5, -5.5);
        c.stroke();

        const ironGrad = c.createLinearGradient(-9, -23, -6, -1);
        ironGrad.addColorStop(0, '#a4b0be');
        ironGrad.addColorStop(0.5, '#57606f');
        ironGrad.addColorStop(1, '#2f3542');
        c.fillStyle = ironGrad;
        c.fillRect(-9, -23, 3, 22);
        c.fillRect(6, -23, 3, 22);
        c.fillStyle = '#dfe4ea';
        [-19, -12, -5].forEach(ry => {
            c.fillRect(-8, ry, 1.1, 1.1);
            c.fillRect(7, ry, 1.1, 1.1);
        });
        c.strokeStyle = '#24150b';
        c.lineWidth = 1;
        c.strokeRect(-13, -15, 26, 14);
        c.fillStyle = '#e1b12c';
        c.fillRect(-2.8, -17, 5.6, 6.4);
        c.fillStyle = '#fff3b0';
        c.fillRect(-2.4, -16.6, 4.8, 1);
        c.fillStyle = '#1e272e';
        c.fillRect(-0.8, -14.8, 1.6, 2.8);
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
// 5. HI-DPI CLOSE-UP BUST PORTRAIT RENDERER (FOR PARTY SIDEBAR & ARMORY)
// ============================================================================
const portraitDataUrlCache = {};

function getHeroPortraitDataURL(role) {
    if (portraitDataUrlCache[role]) return portraitDataUrlCache[role];
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 128;
    pCanvas.height = 128;
    const pc = pCanvas.getContext('2d');

    const bgColors = {
        Warrior: ['#47251d', '#1c1110', '#090708'],
        Ranger:  ['#1d3d2e', '#0f1f18', '#070c09'],
        Cleric:  ['#42351b', '#1c170d', '#090806'],
        Control: ['#382059', '#170d26', '#07040d']
    }[role] || ['#36261b', '#17110d', '#080607'];

    // Moody chiaroscuro torchlit backdrop
    const bg = pc.createRadialGradient(42, 38, 6, 64, 64, 74);
    bg.addColorStop(0, bgColors[0]);
    bg.addColorStop(0.55, bgColors[1]);
    bg.addColorStop(1, bgColors[2]);
    pc.fillStyle = bg;
    pc.fillRect(0, 0, 128, 128);

    // Warm off-camera dungeon torch glow from upper-right
    const torchGlow = pc.createRadialGradient(98, 26, 2, 98, 26, 68);
    torchGlow.addColorStop(0, 'rgba(255, 196, 110, 0.28)');
    torchGlow.addColorStop(1, 'rgba(255, 140, 40, 0)');
    pc.fillStyle = torchGlow;
    pc.fillRect(0, 0, 128, 128);

    // Close-up upper-body heroic bust framing (head, shoulders, chest & weapon)
    drawHeroFigure(pc, role, 62, 146, 0.4, 2.52, null, 1, 0, { lightDir: 1 });

    const vig = pc.createRadialGradient(64, 60, 36, 64, 64, 66);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.62)');
    pc.fillStyle = vig;
    pc.fillRect(0, 0, 128, 128);

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
