const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

let selectedHeroIndex = 0;
let showMiniMap = true;
let isCanvasVisible = true;

function toggleMiniMap() {
    showMiniMap = !showMiniMap;
    const btn = document.getElementById('btn-minimap');
    if (btn) btn.setAttribute('aria-pressed', String(showMiniMap));
    if (minimapCanvas) minimapCanvas.style.display = showMiniMap ? 'block' : 'none';
    SFX.step();
    drawGame();
}

// =========================================================
// 60 FPS VISUAL ENGINE: PARTICLES, VFX, SHATTER & HOVER
// =========================================================
const PARTICLE_COUNT = 64;
let ambientParticles = [];
let activeParticleBiome = '';
let torchFlickerPhase = 0;

let attackVFXList = [];
let sparkParticles = [];
let shatterParticles = [];
let ultimateCutIn = null;
let hoverTile = { x: -1, y: -1 };

let screenShakeMag = 0;
let screenShakeIntensity = 1;
let impactRings = [];

// Fullscreen Cover Camera with HUD Safe-Zone Margin (keeps edge rooms clear of floating HUD)
const cameraView = { x: 0, y: 0, w: WORLD_WIDTH, h: WORLD_HEIGHT };
let camSmoothX = null;
let camSmoothY = null;
let camFloorRef = -1;

// Extra world-space margin so corner tiles can pan out from beneath floating HUD widgets
const CAM_MARGIN_LEFT = 148;
const CAM_MARGIN_RIGHT = 112;
const CAM_MARGIN_TOP = 56;
const CAM_MARGIN_BOTTOM = 78;

function syncCanvasViewport() {
    const container = document.getElementById('canvas-container');
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    const cw = (rect && rect.width > 40) ? rect.width : WORLD_WIDTH;
    const ch = (rect && rect.height > 40) ? rect.height : WORLD_HEIGHT;
    const boxAspect = cw / ch;
    const worldAspect = WORLD_WIDTH / WORLD_HEIGHT;

    if (boxAspect >= worldAspect) {
        cameraView.w = WORLD_WIDTH * 0.94;
        cameraView.h = cameraView.w / boxAspect;
    } else {
        cameraView.h = WORLD_HEIGHT * 0.94;
        cameraView.w = cameraView.h * boxAspect;
    }

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const density = Math.max(RENDER_SCALE, Math.min(2.5, dpr * 1.5));
    const targetW = Math.round(cw * density);
    const targetH = Math.round(ch * density);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }
}

function updateCameraFollow() {
    let focusX = WORLD_WIDTH * 0.5;
    let focusY = WORLD_HEIGHT * 0.5;
    const ldr = (typeof getLeader === 'function') ? getLeader() : null;

    if (typeof gameMode !== 'undefined' && gameMode === 'COMBAT' && ldr) {
        const foe = (typeof activeEnemy !== 'undefined' && activeEnemy && activeEnemy.hp > 0) ? activeEnemy : ldr;
        focusX = ((ldr.x + foe.x) * 0.5) * TILE_SIZE + TILE_SIZE * 0.5;
        focusY = ((ldr.y + foe.y) * 0.5) * TILE_SIZE + TILE_SIZE * 0.5;
    } else if (ldr) {
        focusX = ldr.x * TILE_SIZE + TILE_SIZE * 0.5 + (ldr.stepOffsetX || 0);
        focusY = ldr.y * TILE_SIZE + TILE_SIZE * 0.5 + (ldr.stepOffsetY || 0);
    }

    const minCamX = -CAM_MARGIN_LEFT;
    const maxCamX = Math.max(minCamX, WORLD_WIDTH + CAM_MARGIN_RIGHT - cameraView.w);
    const minCamY = -CAM_MARGIN_TOP;
    const maxCamY = Math.max(minCamY, WORLD_HEIGHT + CAM_MARGIN_BOTTOM - cameraView.h);

    const targetX = Math.max(minCamX, Math.min(maxCamX, focusX - cameraView.w * 0.5));
    const targetY = Math.max(minCamY, Math.min(maxCamY, focusY - cameraView.h * 0.5));

    const curFl = (typeof currentFloor !== 'undefined') ? currentFloor : 1;
    if (camSmoothX === null || camSmoothY === null || camFloorRef !== curFl) {
        camSmoothX = targetX;
        camSmoothY = targetY;
        camFloorRef = curFl;
    } else {
        camSmoothX += (targetX - camSmoothX) * 0.18;
        camSmoothY += (targetY - camSmoothY) * 0.18;
        if (Math.abs(targetX - camSmoothX) < 0.2) camSmoothX = targetX;
        if (Math.abs(targetY - camSmoothY) < 0.2) camSmoothY = targetY;
    }

    cameraView.x = Math.max(minCamX, Math.min(maxCamX, camSmoothX));
    cameraView.y = Math.max(minCamY, Math.min(maxCamY, camSmoothY));
}

if (typeof ResizeObserver !== 'undefined') {
    const vpContainer = document.getElementById('canvas-container');
    if (vpContainer) {
        new ResizeObserver(() => {
            syncCanvasViewport();
            if (typeof drawGame === 'function') drawGame();
        }).observe(vpContainer);
    }
}

function canvasToTile(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return { x: -1, y: -1, inside: false };
    }
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    const insideViewport = relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1;
    const mx = cameraView.x + relX * cameraView.w;
    const my = cameraView.y + relY * cameraView.h;
    return {
        x: Math.floor(mx / TILE_SIZE),
        y: Math.floor(my / TILE_SIZE),
        inside: insideViewport && (mx >= 0 && mx < WORLD_WIDTH && my >= 0 && my < WORLD_HEIGHT)
    };
}

canvas.addEventListener('mousemove', (e) => {
    const t = canvasToTile(e.clientX, e.clientY);
    if (t.inside) {
        hoverTile = {
            x: Math.max(0, Math.min(COLS - 1, t.x)),
            y: Math.max(0, Math.min(ROWS - 1, t.y))
        };
    } else {
        hoverTile = { x: -1, y: -1 };
    }
    updateHoverTooltipHtml(e.clientX, e.clientY);
});

canvas.addEventListener('mouseleave', () => {
    hoverTile = { x: -1, y: -1 };
    const el = document.getElementById('hover-tooltip');
    if (el) { el.classList.remove('visible'); el.innerHTML = ''; }
});

function spawnFootstepDust(tileX, tileY, dx = 0, dy = 0) {
    const biomeId = (typeof getCurrentBiome === 'function') ? getCurrentBiome().id : 'crypt';
    const bx = tileX * TILE_SIZE + TILE_SIZE * 0.5;
    const by = tileY * TILE_SIZE + TILE_SIZE - 5;
    const dustColor = biomeId === 'ice' ? '#dff5ff' : (biomeId === 'lava' ? '#ff944d' : (biomeId === 'void' ? '#c58af9' : '#c8bda8'));
    for (let i = 0; i < 6; i++) {
        sparkParticles.push({
            x: bx + (Math.random() - 0.5) * 10,
            y: by + (Math.random() - 0.5) * 4,
            vx: -dx * (0.5 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.8,
            vy: -0.35 - Math.random() * 0.65 - dy * 0.25,
            color: dustColor,
            alpha: 0.52,
            size: 1.4 + Math.random() * 1.6,
            isDust: true
        });
    }
}

function addFloorDecal(tileX, tileY, type = 'blood') {
    if (typeof floorDecals === 'undefined') return;
    if (floorDecals.length > 40) floorDecals.shift();
    floorDecals.push({
        x: tileX, y: tileY, type: type,
        seed: Math.floor(rng() * 100)
    });
}

function triggerAttackVFX(fromX, fromY, toX, toY, style = 'slash', color = '#ffffff') {
    const tx = toX * TILE_SIZE + TILE_SIZE / 2;
    const ty = toY * TILE_SIZE + TILE_SIZE / 2 - 10;
    attackVFXList.push({
        sx: fromX * TILE_SIZE + TILE_SIZE / 2,
        sy: fromY * TILE_SIZE + TILE_SIZE / 2 - 10,
        tx, ty,
        style, color,
        progress: 0
    });

    for (let i = 0; i < 14; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spdVal = 1.5 + Math.random() * 3.8;
        sparkParticles.push({
            x: tx, y: ty,
            vx: Math.cos(ang) * spdVal,
            vy: Math.sin(ang) * spdVal - 1.4,
            floorY: toY * TILE_SIZE + TILE_SIZE - 5 + (Math.random() - 0.5) * 8,
            color: i % 3 === 0 ? '#fff6d6' : (i % 2 === 0 ? '#ffad42' : color),
            alpha: 1.0,
            size: 1.2 + Math.random() * 1.8
        });
    }
}

function triggerDeathShatter(tileX, tileY, baseColor = '#a8383b') {
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2 - 8;
    for (let i = 0; i < 22; i++) {
        const angle = (Math.PI * 2 * i) / 22 + (rng() - 0.5) * 0.45;
        const speed = 1.4 + rng() * 3.6;
        shatterParticles.push({
            x: cx + (rng() - 0.5) * 14,
            y: cy + (rng() - 0.5) * 14,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            size: 2.5 + rng() * 3.5,
            color: i % 3 === 0 ? '#dfd0bc' : baseColor,
            alpha: 1.0
        });
    }
}

function triggerUltimateCutIn(actorName, ultTitle, color = '#c7ae91') {
    const cleanActor = String(actorName).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
    const cleanUlt = String(ultTitle).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
    ultimateCutIn = {
        actorName: cleanActor.toUpperCase(),
        ultTitle: cleanUlt.toUpperCase(),
        color: color,
        alpha: 1.0,
        timer: 52
    };
}

function triggerScreenShake(intensity = 6) {
    const scaled = intensity * screenShakeIntensity;
    if (scaled <= 0) return;
    screenShakeMag = Math.max(screenShakeMag, scaled);
}

function triggerHitFlash(unit, color = "#ffffff") {
    if (!unit) return;
    unit.hitFlash = color;
    unit.hitFlashTimer = 10;
    impactRings.push({
        x: unit.x, y: unit.y,
        radius: 5, maxRadius: 30,
        color: color === "#ffffff" ? "#c95b60" : color,
        alpha: 1.0
    });
}

function triggerLunge(attacker, targetX, targetY) {
    if (!attacker) return;
    const dx = Math.sign(targetX - attacker.x);
    const dy = Math.sign(targetY - attacker.y);
    attacker.lungeDirX = (dx === 0 && dy === 0) ? 1 : dx;
    attacker.lungeDirY = (dx === 0 && dy === 0) ? -1 : dy;
    attacker.lungeProgress = 1.0;
}

function createBiomeParticle(biomeId, randomY = false) {
    const p = {
        x: Math.random() * WORLD_WIDTH,
        y: randomY ? Math.random() * WORLD_HEIGHT : 0,
        size: 2, vx: 0, vy: 0,
        alpha: 0.2 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        color: '#ffffff'
    };

    if (biomeId === 'crypt') {
        p.y = Math.random() * WORLD_HEIGHT;
        p.size = 1.2 + Math.random() * 1.6;
        p.vx = (Math.random() - 0.5) * 0.22;
        p.vy = -0.10 - Math.random() * 0.20;
        p.color = Math.random() < 0.78 ? '#dfd0bc' : '#78ab8c';
        p.alpha = 0.12 + Math.random() * 0.26;
    } else if (biomeId === 'ice') {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : -10;
        p.size = 1.3 + Math.random() * 2.0;
        p.vx = -0.45 - Math.random() * 0.5;
        p.vy = 0.75 + Math.random() * 0.95;
        p.color = Math.random() < 0.7 ? '#e6f2fa' : '#8ab8d9';
        p.alpha = 0.26 + Math.random() * 0.42;
    } else if (biomeId === 'lava') {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : WORLD_HEIGHT + 10;
        p.size = 1.4 + Math.random() * 2.2;
        p.vx = (Math.random() - 0.5) * 0.45;
        p.vy = -0.65 - Math.random() * 1.05;
        p.color = Math.random() < 0.5 ? '#d95b26' : '#e2c18a';
        p.alpha = 0.32 + Math.random() * 0.46;
    } else {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : WORLD_HEIGHT + 10;
        p.size = 1.4 + Math.random() * 2.2;
        p.vx = (Math.random() - 0.5) * 0.38;
        p.vy = -0.35 - Math.random() * 0.65;
        p.color = Math.random() < 0.65 ? '#ad85cc' : '#79a6cf';
        p.alpha = 0.22 + Math.random() * 0.44;
    }
    return p;
}

function ensureAmbientParticles() {
    const biomeId = (typeof getCurrentBiome === 'function') ? getCurrentBiome().id : 'crypt';
    if (ambientParticles.length === 0 || activeParticleBiome !== biomeId) {
        activeParticleBiome = biomeId;
        ambientParticles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            ambientParticles.push(createBiomeParticle(biomeId, true));
        }
    }
}

function updateAndDrawAmbientParticles() {
    ensureAmbientParticles();
    const biomeId = activeParticleBiome;

    ctx.save();
    for (let i = 0; i < ambientParticles.length; i++) {
        const p = ambientParticles[i];
        p.phase += 0.04;
        p.x += p.vx + Math.sin(p.phase) * 0.18;
        p.y += p.vy;

        if (biomeId === 'ice') {
            if (p.y > WORLD_HEIGHT + 10) { p.y = -8; p.x = Math.random() * WORLD_WIDTH; }
            if (p.x < -10) p.x = WORLD_WIDTH + 8;
        } else if (biomeId === 'lava' || biomeId === 'void') {
            if (p.y < -10) { p.y = WORLD_HEIGHT + 8; p.x = Math.random() * WORLD_WIDTH; }
            if (p.x < -10) p.x = WORLD_WIDTH + 8;
            if (p.x > WORLD_WIDTH + 10) p.x = -8;
        } else {
            if (p.y < -10) p.y = WORLD_HEIGHT + 8;
            if (p.y > WORLD_HEIGHT + 10) p.y = -8;
            if (p.x < -10) p.x = WORLD_WIDTH + 8;
            if (p.x > WORLD_WIDTH + 10) p.x = -8;
        }

        const tileX = Math.floor(p.x / TILE_SIZE);
        const tileY = Math.floor(p.y / TILE_SIZE);
        if (tileY < 0 || tileY >= ROWS || tileX < 0 || tileX >= COLS || !revealed[tileY] || !revealed[tileY][tileX]) {
            continue;
        }

        const flickerAlpha = Math.max(0.06, Math.min(0.88, p.alpha + Math.sin(p.phase * 1.5) * 0.12));
        ctx.globalAlpha = flickerAlpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// =========================================================
// REALISTIC COMBAT VFX, OVERLAYS, MINIMAP & WORLD DRAW
// =========================================================
function drawAttackVFX(dynamicLights) {
    attackVFXList.forEach(v => {
        ctx.save();
        const currX = v.sx + (v.tx - v.sx) * v.progress;
        const currY = v.sy + (v.ty - v.sy) * v.progress;

        if (v.style === 'slash') {
            ctx.globalAlpha = Math.max(0, 1 - v.progress * 0.72);
            const startA = -Math.PI * 0.78 + v.progress * 1.55;
            const endA = Math.PI * 0.24 + v.progress * 1.55;
            for (let seg = 0; seg < 6; seg++) {
                const t0 = startA + (endA - startA) * (seg / 6);
                const t1 = startA + (endA - startA) * ((seg + 1) / 6);
                ctx.strokeStyle = v.color;
                ctx.lineWidth = 1.2 + (seg / 6) * 6.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(v.tx, v.ty, 24, t0, t1);
                ctx.stroke();
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(v.tx, v.ty, 24, startA + 0.35, endA);
            ctx.stroke();
        } else if (v.style === 'arrow') {
            const angle = Math.atan2(v.ty - v.sy, v.tx - v.sx);
            ctx.shadowColor = v.color;
            ctx.shadowBlur = 8;
            ctx.strokeStyle = v.color;
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(currX - Math.cos(angle) * 20, currY - Math.sin(angle) * 20);
            ctx.lineTo(currX + Math.cos(angle) * 8, currY + Math.sin(angle) * 8);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(currX + Math.cos(angle) * 8, currY + Math.sin(angle) * 8, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const g = ctx.createRadialGradient(currX, currY, 1, currX, currY, 13);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, v.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(currX, currY, 13, 0, Math.PI * 2);
            ctx.fill();

            if (dynamicLights) {
                dynamicLights.push({ x: currX, y: currY, r: 95, color: 'rgba(220, 160, 230, 0.22)', cutout: 0.65 });
            }
        }
        ctx.restore();
    });

    sparkParticles.forEach(sp => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.alpha);
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    shatterParticles.forEach(sp => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sp.alpha);
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
        ctx.restore();
    });
}

function drawHoverCursor() {
    const hx = hoverTile.x;
    const hy = hoverTile.y;
    if (hx < 0 || hx >= COLS || hy < 0 || hy >= ROWS) return;
    if (!revealed[hy] || !revealed[hy][hx]) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(199, 174, 145, 0.72)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(hx * TILE_SIZE + 2, hy * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.restore();
}

function toggleScreenShake() {
    screenShakeIntensity = (screenShakeIntensity > 0) ? 0 : 1;
    const btn = document.getElementById('btn-shake-toggle');
    if (btn) btn.innerText = `Screen Impact Shake: ${screenShakeIntensity > 0 ? 'ON' : 'OFF'}`;
    addLog(screenShakeIntensity > 0 ? 'Getaran benturan kamera diaktifkan.' : 'Getaran benturan kamera dinonaktifkan.');
    updateUI();
}
