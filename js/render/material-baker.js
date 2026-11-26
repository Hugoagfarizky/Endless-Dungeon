// ============================================================================
// REALISTIC 2.5D DARK-FANTASY RENDERER & PROCEDURAL MATERIAL ENGINE
// Pre-baked stone/ice/lava/void textures, shaded 2.5D miniatures, dynamic
// multi-source offscreen lighting, feathered Fog of War, & portrait avatars.
// ============================================================================

const WORLD_WIDTH = 1152;
const WORLD_HEIGHT = 672;
const RENDER_SCALE = 2; // Hi-DPI 2x internal resolution (2304 x 1344)

const PIXEL_SCALE = 4;
const WALL_HEIGHT = 20;

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
