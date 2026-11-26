const lightCanvas = document.createElement('canvas');
lightCanvas.width = WORLD_WIDTH;
lightCanvas.height = WORLD_HEIGHT;
const lightCtx = lightCanvas.getContext('2d');

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
