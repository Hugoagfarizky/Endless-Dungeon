const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const PIXEL_SCALE = 4;
const WALL_HEIGHT = 20;

let selectedHeroIndex = 0;
let showMiniMap = true;
let isCanvasVisible = true;

// =========================================================
// MOUNT STATIC SVG ICONS, FILIGREE CRESTS & SPEAR ORNAMENTS
// =========================================================
function mountStaticDungeonIcons() {
    if (typeof icon !== 'function') return;
    const mapIds = {
        'brand-sigil-icon': ['crest', 17],
        'ico-torch': ['torch', 16],
        'ico-coin': ['coin', 16],
        'ico-ingot': ['ingot', 16],
        'ico-satchel': ['satchel', 20],
        'ico-armory': ['armory', 20],
        'ico-codex': ['codex', 20],
        'ico-auto': ['auto', 19],
        'ico-speed': ['speed', 19],
        'ico-map': ['map', 19],
        'ico-cog': ['cog', 19],
        'ico-save': ['save', 13],
        'ico-seed': ['seed', 13],
        'ico-calendar': ['calendar', 13],
        'ico-pause-cog': ['cog', 13],
        'ico-reset': ['reset', 13],
        'ico-cmd-ult': ['overdrive', 24],
        'ico-cmd-attack': ['sword', 21],
        'ico-cmd-skill': ['arcane', 21],
        'ico-cmd-skill2': ['mastery', 21],
        'ico-cmd-defend': ['shield', 21],
        'ico-cmd-swap': ['swap', 21],
        'ico-cmd-item': ['satchel', 21],
        'ico-cmd-revive': ['feather', 21],
        'ico-cmd-flee': ['flee', 21]
    };
    Object.entries(mapIds).forEach(([id, [name, sz]]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = icon(name, sz);
    });

    if (typeof filigreeBannerCrestSvg === 'function') {
        const hTop = document.getElementById('header-crest-top');
        const hBot = document.getElementById('header-crest-bottom');
        const tTop = document.getElementById('trans-crest-top');
        const tBot = document.getElementById('trans-crest-bottom');
        if (hTop) hTop.innerHTML = filigreeBannerCrestSvg(false);
        if (hBot) hBot.innerHTML = filigreeBannerCrestSvg(true);
        if (tTop) tTop.innerHTML = filigreeBannerCrestSvg(false);
        if (tBot) tBot.innerHTML = filigreeBannerCrestSvg(true);
    }

    if (typeof gothicSpearOrnamentSvg === 'function') {
        const spearLeft = document.getElementById('chronicle-spear-left');
        const spearEl = document.getElementById('chronicle-spear-ornament');
        if (spearLeft) spearLeft.innerHTML = gothicSpearOrnamentSvg();
        if (spearEl) spearEl.innerHTML = gothicSpearOrnamentSvg();
    }
}
mountStaticDungeonIcons();

// Feature-detected Popover polyfill & Anchor positioning fallback
if (typeof HTMLElement !== 'undefined' && !Object.hasOwn(HTMLElement.prototype, 'popover')) {
    import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js').catch(() => {});
}

const expPopover = document.getElementById('expedition-popover');
const expTrigger = document.getElementById('btn-expedition-menu');
if (expPopover && expTrigger && typeof expPopover.addEventListener === 'function') {
    expPopover.addEventListener('toggle', ({ newState }) => {
        if (newState !== 'open') return;
        if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('position-area', 'block-end')) return;
        const t = expTrigger.getBoundingClientRect();
        const m = expPopover.getBoundingClientRect();
        const below = t.bottom + m.height + 8 <= window.innerHeight;
        expPopover.style.top = `${below ? t.bottom + 6 : Math.max(8, t.top - m.height - 6)}px`;
        expPopover.style.left = `${Math.max(8, Math.min(t.right - m.width, window.innerWidth - m.width - 8))}px`;
    });
}

// Toolbar Roving Tabindex Fallback where native focusgroup is unsupported
const hudToolbar = document.getElementById('hud-toolbar');
if (hudToolbar && typeof HTMLElement !== 'undefined' && !('focusGroup' in HTMLElement.prototype)) {
    const getItems = () => Array.from(hudToolbar.querySelectorAll('button:not(.hidden)'));
    const initItems = getItems();
    initItems.forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
    hudToolbar.addEventListener('focusin', ({ target }) => {
        const items = getItems();
        if (items.includes(target)) items.forEach(b => { b.tabIndex = b === target ? 0 : -1; });
    });
    hudToolbar.addEventListener('keydown', (e) => {
        const items = getItems();
        const idx = items.indexOf(document.activeElement);
        if (idx < 0) return;
        let nextIdx = -1;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % items.length;
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + items.length) % items.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = items.length - 1;
        if (nextIdx >= 0) {
            e.preventDefault();
            items[nextIdx].focus();
        }
    });
}

// =========================================================
// NATIVE <dialog> MODAL HELPERS + LIGHT-DISMISS FALLBACK
// =========================================================
function isAnyModalOpen() {
    return document.querySelector('dialog.game-dialog[open]') !== null;
}

function closeAllModals() {
    document.querySelectorAll('dialog.game-dialog[open]').forEach(d => d.close());
}

function closeDialogById(id) {
    const dlg = document.getElementById(id);
    if (dlg && dlg.open) dlg.close();
}

function toggleDialogById(id, onOpenRender = null) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    if (dlg.open) {
        dlg.close();
        return;
    }
    closeAllModals();
    dlg.showModal();
    if (typeof onOpenRender === 'function') onOpenRender();
}

if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
        dialog.addEventListener('click', (event) => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            const isDialogContent = (
                rect.top <= event.clientY &&
                event.clientY <= rect.top + rect.height &&
                rect.left <= event.clientX &&
                event.clientX <= rect.left + rect.width
            );
            if (!isDialogContent) dialog.close();
        });
    });
}

let pendingConfirmCallback = null;
function openConfirmModal(titleText, htmlMessage, confirmLabel, onConfirm) {
    const dlg = document.getElementById('confirm-modal');
    if (!dlg) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }
    const cleanTitle = String(titleText).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
    const titleEl = document.getElementById('confirm-modal-title');
    const bodyEl = document.getElementById('confirm-modal-body');
    const okBtn = document.getElementById('confirm-modal-ok');
    if (titleEl) titleEl.innerText = cleanTitle;
    if (bodyEl) bodyEl.innerHTML = htmlMessage;
    if (okBtn) okBtn.innerText = confirmLabel || 'Confirm';
    pendingConfirmCallback = onConfirm;
    closeAllModals();
    dlg.showModal();
}

document.addEventListener('DOMContentLoaded', () => {
    const okBtn = document.getElementById('confirm-modal-ok');
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            const cb = pendingConfirmCallback;
            pendingConfirmCallback = null;
            closeDialogById('confirm-modal');
            if (typeof cb === 'function') cb();
        });
    }
});

function confirmResetRun() {
    openConfirmModal(
        'Abandon Current Expedition',
        'Seluruh progres lantai, level party, dan isi tas pada ekspedisi ini akan diulang dari <b>Lantai 1</b>.<br><small style="color:#78ab8c;">Data Hall of Fame, Prestige, dan Bestiary Mastery di Royal Codex tetap tersimpan permanen.</small>',
        'Abandon & Restart',
        () => resetGameRun()
    );
}

function confirmPrestige() {
    if (currentFloor < 10) return;
    const nextPrest = ((typeof getPrestigeLevel === 'function') ? getPrestigeLevel() : 0) + 1;
    openConfirmModal(
        `Rite of Prestige Lv.${nextPrest}`,
        `Ordo Ksatria akan memulai siklus baru dari Lantai 1 dengan berkah abadi <b>+${nextPrest * 5}% Semua Atribut Permanen</b> lintas ekspedisi.`,
        `Claim Prestige Lv.${nextPrest}`,
        () => triggerPrestige()
    );
}

function openAscensionModal() {
    toggleDialogById('ascension-modal');
}

function confirmAscensionChoice(mod) {
    closeDialogById('ascension-modal');
    triggerAscension(mod);
}

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

    for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spdVal = 1.4 + Math.random() * 3.4;
        sparkParticles.push({
            x: tx, y: ty,
            vx: Math.cos(ang) * spdVal,
            vy: Math.sin(ang) * spdVal - 0.8,
            color: i % 2 === 0 ? '#e8d5ba' : color,
            alpha: 1.0,
            size: 1.5 + Math.random() * 2.0
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
// EFFICIENT BACKGROUND PROCESSING & UNIFIED 60 FPS RAF LOOP
// =========================================================
const canvasContainerEl = document.getElementById('canvas-container');
if (canvasContainerEl) {
    canvasContainerEl.addEventListener('contentvisibilityautostatechange', (event) => {
        isCanvasVisible = !event.skipped;
    });
    if (!('contentVisibility' in document.documentElement.style) && typeof IntersectionObserver !== 'undefined') {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => { isCanvasVisible = entry.isIntersecting; });
        }, { rootMargin: '200px' });
        obs.observe(canvasContainerEl);
    }
}

let lastFrameTime = performance.now();
function masterRenderLoop(now) {
    requestAnimationFrame(masterRenderLoop);
    if (document.hidden || !isCanvasVisible) return;

    const dt = Math.min(2.2, (now - lastFrameTime) / 16.667);
    lastFrameTime = now;

    torchFlickerPhase += 0.085 * dt;

    if (screenShakeMag > 0.08) {
        screenShakeMag *= Math.pow(0.84, dt);
        if (screenShakeMag < 0.12) screenShakeMag = 0;
    }

    const allUnits = [...(typeof party !== 'undefined' ? party : []), ...(typeof enemies !== 'undefined' ? enemies : [])];
    allUnits.forEach(u => {
        if (!u) return;
        // Smooth physical walking stride interpolation + parabolic footstep bounce
        if (u.walkProgress > 0) {
            u.walkProgress = Math.max(0, u.walkProgress - 0.14 * dt);
            const ease = u.walkProgress * u.walkProgress;
            u.stepOffsetX = ((u.walkFromX ?? u.x) - u.x) * TILE_SIZE * ease;
            u.stepOffsetY = ((u.walkFromY ?? u.y) - u.y) * TILE_SIZE * ease;
            u.stepBounceY = -Math.sin(u.walkProgress * Math.PI) * 4.2;
        } else {
            u.stepOffsetX = 0;
            u.stepOffsetY = 0;
            u.stepBounceY = 0;
        }

        if (u.lungeProgress > 0) {
            u.lungeProgress = Math.max(0, u.lungeProgress - 0.11 * dt);
            const curve = Math.sin(u.lungeProgress * Math.PI);
            u.animOffsetX = (u.lungeDirX || 0) * 15 * curve;
            u.animOffsetY = (u.lungeDirY || 0) * 15 * curve;
        } else {
            u.animOffsetX = 0;
            u.animOffsetY = 0;
        }
        if (u.hitFlashTimer > 0) {
            u.hitFlashTimer -= dt;
            if (u.hitFlashTimer <= 0) u.hitFlash = null;
        }
    });

    attackVFXList.forEach(v => { v.progress += 0.095 * dt; });
    attackVFXList = attackVFXList.filter(v => v.progress < 1.0);

    sparkParticles.forEach(sp => {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += (sp.isDust ? -0.01 : 0.12) * dt;
        if (sp.isDust) sp.size += 0.05 * dt;
        sp.alpha -= (sp.isDust ? 0.032 : 0.055) * dt;
    });
    sparkParticles = sparkParticles.filter(sp => sp.alpha > 0);

    impactRings.forEach(r => {
        r.radius += 1.6 * dt;
        r.alpha -= 0.065 * dt;
    });
    impactRings = impactRings.filter(r => r.alpha > 0);

    shatterParticles.forEach(sp => {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 0.14 * dt;
        sp.alpha -= 0.035 * dt;
    });
    shatterParticles = shatterParticles.filter(sp => sp.alpha > 0);

    if (typeof floatingPopups !== 'undefined') {
        floatingPopups.forEach(p => {
            p.life = (p.life || 0) + dt;
            p.offsetY += (p.vy ?? -1.3) * dt;
            p.vy = (p.vy ?? -1.3) * Math.pow(0.95, dt);
            p.scale = Math.max(1.0, (p.scale || 1.0) - 0.025 * dt);
            const maxL = p.maxLife || 44;
            p.alpha = p.life > maxL * 0.55 ? Math.max(0, 1 - (p.life - maxL * 0.55) / (maxL * 0.45)) : 1.0;
        });
        floatingPopups = floatingPopups.filter(p => p.alpha > 0.02);
    }

    if (ultimateCutIn) {
        ultimateCutIn.timer -= dt;
        if (ultimateCutIn.timer < 12) ultimateCutIn.alpha = Math.max(0, ultimateCutIn.timer / 12);
        if (ultimateCutIn.timer <= 0) ultimateCutIn = null;
    }

    if (!isAnyModalOpen() && typeof map !== 'undefined' && map.length > 0) {
        drawGame();
    }
}
requestAnimationFrame(masterRenderLoop);

function addLog(msg) {
    const logBox = document.getElementById('log-box');
    if (!logBox) return;
    const cleaned = String(msg)
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    const entry = document.createElement('div');
    entry.className = 'chronicle-entry';
    entry.innerHTML = `<span class="chronicle-bullet" aria-hidden="true">◆</span>${cleaned}`;
    logBox.prepend(entry);
    while (logBox.children.length > 60) {
        logBox.removeChild(logBox.lastChild);
    }
}

// =========================================================
// DIALOG 6: ROYAL CODEX — ANNALS, HONORS & BESTIARY
// =========================================================
function toggleBestiaryModal() {
    toggleDialogById('bestiary-modal', () => {
        SFX.chest();
        renderBestiaryModal();
    });
}

function renderBestiaryModal() {
    if (typeof saveCodexData === 'function') saveCodexData();

    const hofEl = document.getElementById('hall-of-fame-stats');
    const bestiaryEl = document.getElementById('bestiary-list');
    if (!hofEl || !bestiaryEl || typeof hallOfFame === 'undefined') return;

    const masteredCount = Object.values(BESTIARY_CATALOG).filter(
        m => (hallOfFame.bestiaryKills[m.id] || 0) >= m.targetKills
    ).length;

    const unlockedAch = hallOfFame.achievements || [];
    const achRows = (typeof ACHIEVEMENTS_CATALOG !== 'undefined' ? ACHIEVEMENTS_CATALOG : []).map(a => {
        const done = unlockedAch.includes(a.id);
        return `
            <div class="slot-row" style="opacity:${done ? '1' : '0.45'};">
                <div>
                    <b style="color:${done ? '#e2ceb4' : '#8c7d6e'};">${done ? icon('trophy', 13) : icon('lock', 12)} ${a.name}</b>
                    <div style="font-size:12px; color:#8c7d6e;">${a.desc}</div>
                </div>
                <span class="item-qty-badge" style="color:${done ? '#92c4a4' : '#6e5a49'};">${done ? 'Earned' : 'Locked'}</span>
            </div>
        `;
    }).join('');

    const historyList = (hallOfFame.runHistory || []).slice(0, 5).map((r, i) => `
        <div class="slot-row" style="font-size:12.5px;">
            <span>#${i + 1} · <b>Floor ${r.floor}</b> (Asc.${r.ascension || 0} · Prest.${r.prestige || 0})</span>
            <span class="gold-val">${r.gold || 0} G</span>
        </div>
    `).join('') || `<div style="font-size:13px; color:#8c7d6e; font-style:italic; padding:4px;">Belum ada ekspedisi yang tercatat.</div>`;

    hofEl.innerHTML = `
        <div class="slot-row">
            <span><b>Deepest Descent</b></span>
            <b class="gold-val">Floor ${hallOfFame.highestFloor}</b>
        </div>
        <div class="slot-row">
            <span><b>Ascension &amp; Prestige</b></span>
            <b style="color:#8eb5d9;">Asc Lv.${hallOfFame.highestAscension} · Prest Lv.${hallOfFame.prestigeLevel || 0}</b>
        </div>
        <div class="slot-row">
            <span><b>Adversaries Vanquished</b></span>
            <b style="color:#92c4a4;">${hallOfFame.totalKills} Foes (${hallOfFame.bossKills} Bosses)</b>
        </div>
        <div class="slot-row">
            <span><b>Gold Amassed</b></span>
            <b class="gold-val">${hallOfFame.totalGoldEarned} G</b>
        </div>
        <div class="slot-row">
            <span><b>Coffers &amp; Decrees</b></span>
            <b>${hallOfFame.chestsOpened || 0} Chests · ${hallOfFame.bountiesCompleted || 0} Decrees</b>
        </div>
        <div class="slot-row">
            <span><b>Bestiary Mastery</b></span>
            <b style="color:#c7ae91;">${masteredCount} / ${Object.keys(BESTIARY_CATALOG).length} Species</b>
        </div>
        <div class="slot-row">
            <span><b>Expedition Ledger</b></span>
            <span style="color:#8c7d6e;">Run #${hallOfFame.totalRuns || 1} (${hallOfFame.totalWipes || 0} Fallen)</span>
        </div>
        <h3 style="margin-top:8px;">Honors (${unlockedAch.length}/${(typeof ACHIEVEMENTS_CATALOG !== 'undefined' ? ACHIEVEMENTS_CATALOG.length : 0)})</h3>
        ${achRows}
        <h3 style="margin-top:8px;">Recent Chronicles</h3>
        ${historyList}
    `;

    bestiaryEl.innerHTML = Object.values(BESTIARY_CATALOG).map(monster => {
        const kills = hallOfFame.bestiaryKills[monster.id] || 0;
        const isDiscovered = kills > 0;
        const isMastered = kills >= monster.targetKills;
        const progressPct = Math.min(100, Math.floor((kills / monster.targetKills) * 100));

        if (!isDiscovered) {
            return `
            <div class="bag-item-row" style="opacity:0.45;">
                <div>
                    <div>${icon('lock', 13)} <b>Unknown Specimen</b> <small style="color:#8c7d6e">[${monster.role}]</small></div>
                    <div class="item-buff-text" style="color:#8c7d6e;">Tumpas makhluk ini minimal 1x di dalam dungeon untuk membuka catatan anatominya.</div>
                </div>
                <span class="item-qty-badge">0 / ${monster.targetKills}</span>
            </div>
            `;
        }

        return `
        <div class="bag-item-row">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>
                        ${monster.icon} <b style="color:${isMastered ? '#e2ceb4' : '#dfd0bc'}">${monster.name}</b>
                        <small style="color:#8c7d6e">[${monster.role}]</small>
                    </span>
                    <span class="item-qty-badge" style="color:${isMastered ? '#92c4a4' : '#c7ae91'};">
                        ${isMastered ? 'MASTERED (+10%)' : `${kills} / ${monster.targetKills}`}
                    </span>
                </div>
                <div style="font-family:var(--font-prose); font-size:13px; color:#9e8f7f; margin-top:3px; font-style:italic;">"${monster.lore}"</div>
                <div class="pointed-bar-track" style="inline-size:100%; margin-top:5px;">
                    <div class="pointed-bar-fill ${isMastered ? 'fill-amber' : 'fill-cobalt'}" style="width:${progressPct}%;"></div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// =========================================================
// "MAP FOUND" STYLE FLOOR & DEATH TRANSITION OVERLAY
// =========================================================
const BIOME_LORE = {
    crypt: "Lorong makam kuno yang lembap, tempat tulang-belulang prajurit masa silam bangkit menjaga ruang bawah tanah.",
    ice:   "Rongga es abadi yang membekukan napas; setiap langkah di atas lantai licin mengundang bahaya kelumpuhan.",
    lava:  "Jantung perapian bumi yang membara; hawa panasnya melipatgandakan luka bakar bagi siapa pun yang lengah.",
    void:  "Jurang kehampaan tanpa dasar yang melahap cahaya obor dengan cepat, namun menyimpan pusaka legendaris."
};

function showDeathTransition(titleText = "THE ORDER HAS FALLEN", subtitleText = "EXPEDITION TERMINATED") {
    const overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) return;

    const subEl   = document.getElementById('trans-subtitle');
    const titleEl = document.getElementById('trans-floor-title');
    const biomeEl = document.getElementById('trans-biome-name');
    const loreEl  = document.getElementById('trans-lore-text');
    const warnEl  = document.getElementById('trans-boss-warning');

    if (subEl)   subEl.innerText = subtitleText;
    if (titleEl) titleEl.innerText = titleText;
    if (biomeEl) {
        biomeEl.innerText = 'Endless Dungeon';
        biomeEl.style.color = '#b83a3e';
    }
    if (loreEl) loreEl.innerText = '"Kegelapan menelan seluruh Ordo. Catatan kehormatan tetap terukir di Royal Codex."';
    if (warnEl) warnEl.classList.add('hidden');

    const prevMode = gameMode;
    gameMode = 'TRANSITION';

    overlay.classList.add('death-mode');
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('death-mode');
            if (gameMode === 'TRANSITION') gameMode = prevMode === 'TRANSITION' ? 'EXPLORE' : prevMode;
        }, 450);
    }, 2100);
}

function showFloorTransition(floorNum, customSubtitle = "DESCENDING INTO THE DEPTHS") {
    const overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) return;

    const biome = getCurrentBiome();
    const roster = (typeof BIOME_BOSS_ROSTER !== 'undefined' && BIOME_BOSS_ROSTER[biome.id])
        ? BIOME_BOSS_ROSTER[biome.id]
        : { mini: { name: "Abyssal Warden" }, grand: { name: "Dread Overlord" } };

    const subEl   = document.getElementById('trans-subtitle');
    const titleEl = document.getElementById('trans-floor-title');
    const biomeEl = document.getElementById('trans-biome-name');
    const loreEl  = document.getElementById('trans-lore-text');
    const warnEl  = document.getElementById('trans-boss-warning');

    if (subEl)   subEl.innerText = customSubtitle;
    if (titleEl) titleEl.innerText = `FLOOR ${floorNum}`;
    if (biomeEl) {
        biomeEl.innerText = biome.name;
        biomeEl.style.color = '#c7ae91';
    }
    if (loreEl) loreEl.innerText = `"${BIOME_LORE[biome.id] || BIOME_LORE.crypt}"`;

    if (warnEl) {
        if (floorNum % 10 === 0) {
            warnEl.innerText = `Dread Lord Awaits: ${roster.grand.name}`;
            warnEl.classList.remove('hidden');
        } else if (floorNum % 5 === 0) {
            warnEl.innerText = `Warden of the Threshold: ${roster.mini.name}`;
            warnEl.classList.remove('hidden');
        } else {
            warnEl.classList.add('hidden');
        }
    }

    const prevMode = gameMode;
    gameMode = 'TRANSITION';

    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.classList.add('hidden');
            if (gameMode === 'TRANSITION') gameMode = prevMode === 'TRANSITION' ? 'EXPLORE' : prevMode;
        }, 450);
    }, 1850);
}

// =========================================================
// STAT DIFF PREVIEW & SET / CURSE META HELPERS
// =========================================================
function formatStatDiffHtml(candidateItem, hero) {
    if (!candidateItem || !hero) return '';
    const currentEq = hero.equipment[candidateItem.slot];

    const statMeta = [
        { key: 'hp',   label: 'HP' },
        { key: 'mp',   label: 'MP' },
        { key: 'patk', label: 'P.ATK' },
        { key: 'matk', label: 'M.ATK' },
        { key: 'def',  label: 'DEF' },
        { key: 'spd',  label: 'SPD' }
    ];

    if (!currentEq) {
        const gains = statMeta
            .filter(s => (candidateItem.stats[s.key] || 0) > 0)
            .map(s => `<span style="color:#92c4a4; font-weight:600;">+${candidateItem.stats[s.key]} ${s.label}</span>`);
        return `<span style="color:#8c7d6e;">Empty Slot:</span> ${gains.join(' · ')}`;
    }

    const diffs = [];
    statMeta.forEach(s => {
        const newVal = candidateItem.stats[s.key] || 0;
        const oldVal = currentEq.stats[s.key] || 0;
        const diff = newVal - oldVal;

        if (diff > 0) {
            diffs.push(`<span style="color:#92c4a4; font-weight:600;">+${diff} ${s.label}</span>`);
        } else if (diff < 0) {
            diffs.push(`<span style="color:#cf5b64; font-weight:600;">${diff} ${s.label}</span>`);
        } else if (newVal > 0 && diff === 0) {
            diffs.push(`<span style="color:#8c7d6e;">=${s.label}</span>`);
        }
    });

    if (diffs.length === 0) {
        return `<span style="color:#8c7d6e;">Identical to equipped</span>`;
    }
    return `<span style="color:#9e8f7f;">vs ${hero.name}:</span> ${diffs.join(' · ')}`;
}

function formatSetAndCurseMetaHtml(item, hero = null) {
    let html = '';
    if (item.setId && typeof EQUIPMENT_SETS !== 'undefined' && EQUIPMENT_SETS[item.setId]) {
        const s = EQUIPMENT_SETS[item.setId];
        const count = hero ? (getHeroActiveSets(hero)[item.setId] || 0) : 0;
        html += `<div style="font-size:12px; color:${s.color}; margin-top:2px;">
            ${s.icon} <b>${s.name}</b> ${hero ? `(${count}/4)` : ''} · <small>2pc: ${s.bonus2Desc}</small>
        </div>`;
    }
    if (item.curseId) {
        html += `
            <div style="font-size:12px; color:#d69a56; margin-top:2px; font-weight:600;">${item.boonDesc}</div>
            <div class="curse-drawback-text">${item.curseDesc}</div>
        `;
    }
    return html;
}

// ==========================================
// DIALOG 5: CAMPFIRE / SANCTUARY HEARTH
// ==========================================
function openCampfireModal() {
    SFX.shrine();
    toggleDialogById('campfire-modal', renderCampfireModal);
}

function closeCampfireModal() {
    closeDialogById('campfire-modal');
}

function chooseCampfireAction(actionType) {
    if (!campfire || campfire.used) return;
    const ldr = getLeader();

    if (actionType === 'rest') {
        torchLight = 100;
        const isFamine = (typeof floorModifier !== 'undefined' && floorModifier === 'famine');
        if (!isFamine) {
            party.forEach(p => {
                if (p.hp > 0) {
                    p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.45));
                    p.mp = Math.min(p.maxMp, p.mp + Math.floor(p.maxMp * 0.45));
                    p.statuses = { poison: 0, burn: 0, stun: 0 };
                }
            });
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "RESTORED", "#92c4a4");
            addLog(`PERKEMAHAN: Seluruh Ksatria pulih +45% HP/MP & Obor menyala 100%.`);
        } else {
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "FAMINE", "#c78d44");
            addLog(`PERKEMAHAN: Kutukan Famine mencegah pemulihan raga, namun Obor menyala 100%.`);
        }
    }
    else if (actionType === 'sharpen') {
        sharpenedBuff = true;
        party.forEach(p => { if (p.hp > 0) p.overdrive = Math.min(100, (p.overdrive || 0) + 50); });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+25% DMG", "#e2ceb4");
        addLog(`BATU ASAH: Bilah senjata diberkati (+25% DMG & +50% Overdrive).`);
    }
    else if (actionType === 'scout') {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) revealed[y][x] = true;
        }
        traps.forEach(t => t.detected = true);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "MAP FOUND", "#e2ceb4");
        addLog(`PENGINTAIAN: Seluruh lorong, musuh, dan jebakan di lantai ini terpetakan.`);
    }
    else if (actionType === 'upgrade_torch') {
        const costOre = 3;
        const costGold = 50;
        if (inventory.ore < costOre || inventory.gold < costGold) {
            addLog(`Butuh ${costOre} Ore & ${costGold} Gold untuk menempa Obor Abadi.`);
            return;
        }
        inventory.ore -= costOre;
        inventory.gold -= costGold;
        torchUpgradeLevel = (torchUpgradeLevel || 0) + 1;
        torchLight = 100;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, 'TORCH FORGED', '#e2ceb4');
        addLog(`OBOR ABADI LV.${torchUpgradeLevel}: Konsumsi obor per langkah berkurang & obor terisi penuh.`);
    }

    campfire.used = true;
    SFX.shrine();
    closeCampfireModal();
    updateUI();
    drawGame();
}

function renderCampfireModal() {
    const listEl = document.getElementById('campfire-options-list');
    if (!listEl) return;
    const canUpgradeTorch = (inventory.ore >= 3 && inventory.gold >= 50);
    listEl.innerHTML = `
        <div class="bag-item-row">
            <div>
                <b>${icon('campfire', 14)} Rest by the Embers</b>
                <div class="item-buff-text">Pulihkan +45% Max HP &amp; MP seluruh Party, bersihkan racun/debuff, &amp; Obor 100%.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseCampfireAction('rest')">Rest</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('sword', 14)} Whetstone &amp; War Prayer</b>
                <div class="item-buff-text">Berikan +25% Damage pada pertarungan berikutnya &amp; +50% Overdrive semua Ksatria.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseCampfireAction('sharpen')">Hone Blades</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('map', 14)} Falcon Recon</b>
                <div class="item-buff-text">Buka seluruh Fog of War di lantai ini &amp; ungkap semua lokasi jebakan.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseCampfireAction('scout')">Scout Floor</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('torch', 14)} Temper Iron Brazier (Lv.${torchUpgradeLevel || 0} → Lv.${(torchUpgradeLevel || 0) + 1})</b>
                <div class="item-buff-text">Kurangi konsumsi obor per langkah secara permanen &amp; isi penuh Obor. Biaya: 3 Ore + 50 Gold.</div>
            </div>
            <button type="button" class="btn-small-use" ${!canUpgradeTorch ? 'disabled' : ''} onclick="chooseCampfireAction('upgrade_torch')">Forge Torch</button>
        </div>
    `;
}

// ==========================================
// DIALOG 4: SHRINE OF THE OLD GODS
// ==========================================
function spawnAltarGuardians() {
    const ldr = (typeof getLeader === 'function') ? getLeader() : null;
    if (!ldr) return;

    const ascMult = 1 + (ascensionLevel * 0.35);
    const free = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const x = ldr.x + dx, y = ldr.y + dy;
            if (!map[y] || map[y][x] !== 0) continue;
            if (typeof isTileOccupied === 'function' && isTileOccupied(x, y)) continue;
            free.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
        }
    }
    free.sort((a, b) => a.dist - b.dist);

    if (free.length < 2) {
        torchLight = 100;
        party.forEach(p => {
            if (p.hp > 0) { p.hp = Math.min(p.maxHp, p.hp + 30); p.mp = Math.min(p.maxMp, p.mp + 25); p.statuses = { poison: 0, burn: 0, stun: 0 }; }
        });
        if (ldr) { updateFogOfWar(ldr.x, ldr.y); addOverheadIcon(ldr.x, ldr.y, "BLESSED", "#e2ceb4"); }
        addLog("Altar terlalu sempit untuk memanggil penjaga. Berkah Katedral diberikan sebagai gantinya.");
        return;
    }

    const guardians = [];
    for (let i = 0; i < 2; i++) {
        const pos = free[i];
        const hp = Math.floor((70 + currentFloor * 20) * ascMult);
        const g = {
            name: `Altar Guardian ${i + 1} [Lv.${currentFloor}]`,
            x: pos.x, y: pos.y, hp, maxHp: hp,
            atk: Math.floor((11 + currentFloor * 3) * ascMult),
            def: 3 + Math.floor(currentFloor * 0.9),
            spd: 12 + Math.floor(currentFloor / 3) + i,
            color: "#9d72c4", isEnemy: true, isBoss: false, bossTier: 0,
            isElite: true, affix: null,
            statuses: { burn: 0, stun: 0, break: 0 }
        };
        revealed[pos.y][pos.x] = true;
        enemies.push(g);
        guardians.push(g);
        addOverheadIcon(pos.x, pos.y, "GUARDIAN", "#ad85cc");
    }
    addLog("TANTANGAN ALTAR: Dua Altar Guardian (Elite) bangkit menjaga monolit!");
    startCombat(guardians[0]);
}

function openShrineModal() {
    SFX.shrine();
    toggleDialogById('shrine-modal', renderShrineModal);
}

function closeShrineModal() {
    closeDialogById('shrine-modal');
}

function chooseShrineBlessing(optionType) {
    if (!shrine || shrine.used) return;
    const ldr = getLeader();

    if (optionType === 'blood') {
        party.forEach(p => {
            if (p.hp > 0) p.hp = Math.max(1, Math.floor(p.hp * 0.70));
        });
        const legGear = (rng() < 0.60) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');
        inventory.bag.push(legGear);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "CURSED RELIC", "#cf5b64");
        addLog(`SUMPAH DARAH: Mengorbankan 30% darah Ksatria & memperoleh pusaka [${legGear.name}].`);
    }
    else if (optionType === 'wisdom') {
        const wisdomCost = 40 + (currentFloor * 10);
        if (inventory.gold < wisdomCost) {
            addLog(`Butuh minimal ${wisdomCost} Gold untuk persembahan Altar Kebijaksanaan.`);
            return;
        }
        inventory.gold -= wisdomCost;
        gainPartyXP(75 + currentFloor * 15, ldr);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+ANCIENT EXP", "#8eb5d9");
        addLog(`ALTAR KEBIJAKSANAAN: Mempersembahkan ${wisdomCost} Gold untuk pengetahuan kuno.`);
    }
    else if (optionType === 'radiance') {
        torchLight = 100;
        party.forEach(p => {
            if (p.hp > 0) {
                p.hp = Math.min(p.maxHp, p.hp + 30);
                p.mp = Math.min(p.maxMp, p.mp + 25);
                p.statuses = { poison: 0, burn: 0, stun: 0 };
            }
        });
        if (ldr) {
            updateFogOfWar(ldr.x, ldr.y);
            addOverheadIcon(ldr.x, ldr.y, "SANCTIFIED", "#e2ceb4");
        }
        addLog(`BERKAH KATEDRAL: Obor 100%, seluruh Ksatria pulih +30 HP, +25 MP & bebas kutukan.`);
    }
    else if (optionType === 'trial') {
        if (gameMode !== 'EXPLORE') return;
        shrine.used = true;
        SFX.shrine();
        closeShrineModal();
        spawnAltarGuardians();
        updateUI();
        drawGame();
        return;
    }
    else if (optionType === 'memory') {
        shrine.used = true;
        party.forEach(p => { if (p.hp > 0) p.statPoints = (p.statPoints || 0) + 1; });
        addLog('SHRINE OF MEMORY: Seluruh Ksatria hidup menerima +1 Stat Point kuno.');
        if (ldr) addOverheadIcon(ldr.x, ldr.y, '+1 STAT PT', '#8eb5d9');
        SFX.shrine();
        closeShrineModal();
        updateUI();
        drawGame();
        return;
    }

    shrine.used = true;
    SFX.shrine();
    closeShrineModal();
    updateUI();
    drawGame();
}

function renderShrineModal() {
    const listEl = document.getElementById('shrine-options-list');
    if (!listEl) return;
    const wisdomCost = 40 + (currentFloor * 10);
    listEl.innerHTML = `
        <div class="bag-item-row">
            <div>
                <b class="rarity-Cursed">${icon('skull', 13)} Blood Tithe (Sacrifice 30% HP)</b>
                <div class="item-buff-text">Dijamin 1x Cursed Relic atau Zirah Epic/Legendary masuk ke Reliquary Coffer.</div>
            </div>
            <button type="button" class="btn-small-danger" onclick="chooseShrineBlessing('blood')">Bleed</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Legendary">${icon('coin', 13)} Tribute of Kings (${wisdomCost} G)</b>
                <div class="item-buff-text">Seluruh Ksatria menerima limpahan EXP kuno secara instan.</div>
            </div>
            <button type="button" class="btn-small-equip" ${inventory.gold < wisdomCost ? 'disabled' : ''} onclick="chooseShrineBlessing('wisdom')">Offer Gold</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>${icon('crest', 13)} Grace of the Cathedral</b>
                <div class="item-buff-text">Obor penuh 100%, pulihkan +30 HP, +25 MP &amp; sucikan semua racun/debuff.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseShrineBlessing('radiance')">Pray</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Epic">${icon('sword', 13)} Trial of the Guardians</b>
                <div class="item-buff-text">Panggil 2 Altar Guardian (Elite). Tumpas keduanya untuk jaminan zirah Epic + Ore.</div>
            </div>
            <button type="button" class="btn-small-danger" onclick="chooseShrineBlessing('trial')">Challenge</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b class="rarity-Rare">${icon('arcane', 13)} Shrine of Memory</b>
                <div class="item-buff-text">Seluruh Ksatria hidup langsung memperoleh +1 Stat Point bebas alokasi.</div>
            </div>
            <button type="button" class="btn-small-equip" onclick="chooseShrineBlessing('memory')">Commune</button>
        </div>
    `;
}

// =========================================================================
// DIALOG 3: WANDERING CARAVAN (MERCHANT)
// =========================================================================
function ensureMerchantInventory() {
    if (!merchant) return;
    if (merchant.stock && merchant.stock.length > 0) return;

    const ascFactor = 1 + (ascensionLevel * 0.25);
    const calcPrice = (base, perFloor) => Math.floor((base + (currentFloor - 1) * perFloor) * ascFactor);

    const gear1 = generateRandomEquipment(currentFloor, 'Rare');
    const gear2 = (rng() < 0.35) ? generateCursedRelic(currentFloor) : generateRandomEquipment(currentFloor, 'Epic');

    const getGearPrice = (g) => {
        let rarityBase = 45;
        if (g.rarity === 'Rare') rarityBase = 75;
        else if (g.rarity === 'Epic') rarityBase = 115;
        else if (g.rarity === 'Legendary' || g.rarity === 'Cursed') rarityBase = 155;
        return calcPrice(rarityBase, 10);
    };

    merchant.stock = [
        { id: 'potion', name: `${icon('satchel', 13)} Herbal Draught`, desc: "Memulihkan +35 HP & menyembuhkan status Poison Party.", cost: calcPrice(20, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'energy_potion', name: `${icon('bolt', 13)} Astral Vial`, desc: "Memulihkan +30 Energi (MP) ke seluruh anggota Party.", cost: calcPrice(25, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'torch_oil', name: `${icon('torch', 13)} Pitch Torch Oil`, desc: "Mengisi ulang cahaya Obor (Torch) +60% agar jarak pandang terang.", cost: calcPrice(15, 4), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'forge_ore', name: `${icon('ingot', 13)} Damascus Iron Ore (x2)`, desc: "2x Bijih Besi Tempa untuk menaikkan level (+1, +2) Zirah Ksatria.", cost: calcPrice(30, 6), stock: 2, maxStock: 2, type: 'ore' },
        { id: 'revive', name: `${icon('feather', 13)} Phoenix Pinion`, desc: "Membangkitkan 1 Ksatria yang gugur dengan 50% Max HP.", cost: calcPrice(60, 8), stock: 1, maxStock: 1, type: 'consumable' },
        {
            id: 'specific_gear_1',
            name: `${EQUIP_SLOTS[gear1.slot].icon} ${gear1.name}`,
            rarity: gear1.rarity, slotLabel: EQUIP_SLOTS[gear1.slot].label,
            desc: `Attributes: ${formatItemBuffs(gear1.stats)}`,
            cost: getGearPrice(gear1), stock: 1, maxStock: 1, type: 'specific_gear', gearData: gear1
        },
        {
            id: 'specific_gear_2',
            name: `${EQUIP_SLOTS[gear2.slot].icon} ${gear2.name}`,
            rarity: gear2.rarity, slotLabel: EQUIP_SLOTS[gear2.slot].label,
            desc: `Attributes: ${formatItemBuffs(gear2.stats)}`,
            cost: getGearPrice(gear2), stock: 1, maxStock: 1, type: 'specific_gear', gearData: gear2
        }
    ];
}

function openMerchantModal() {
    ensureMerchantInventory();
    SFX.chest();
    toggleDialogById('merchant-modal', renderMerchantModal);
}

function closeMerchantModal() {
    closeDialogById('merchant-modal');
}

function buyMerchantItem(shopIdx) {
    if (!merchant || !merchant.stock) return;
    const item = merchant.stock[shopIdx];
    if (!item || item.stock <= 0 || inventory.gold < item.cost) return;

    inventory.gold -= item.cost;
    item.stock--;
    SFX.pickup();
    const ldr = getLeader();

    if (item.type === 'consumable') {
        addConsumableToBackpack(item.id, 1);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+SUPPLY", "#92c4a4");
    } else if (item.type === 'ore') {
        inventory.ore += 2;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+2 ORE", "#8eb5d9");
        addLog(`CARAVAN: Membeli +2x Damascus Iron Ore seharga ${item.cost} Gold.`);
    } else if (item.type === 'specific_gear' && item.gearData) {
        const g = item.gearData;
        inventory.bag.push(g);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "+ARMOR", "#e2ceb4");
        addLog(`CARAVAN: Membeli zirah [${g.name}] ke Armory [E].`);
    }

    updateUI();
    renderMerchantModal();
}

function rerollMerchantStock() {
    if (!merchant || merchant.rerolled) return;
    const cost = 35 + currentFloor * 8;
    if (inventory.gold < cost) return;
    inventory.gold -= cost;
    merchant.rerolled = true;
    merchant.stock = [];
    ensureMerchantInventory();
    SFX.pickup();
    addLog(`CARAVAN: Stok dagangan diperbarui (${cost} Gold).`);
    updateUI();
    renderMerchantModal();
}

function renderMerchantModal() {
    ensureMerchantInventory();
    const goldEl = document.getElementById('merchant-gold');
    if (goldEl) goldEl.innerText = inventory.gold;
    const listEl = document.getElementById('merchant-items-list');
    if (!listEl || !merchant || !merchant.stock) return;

    const previewHero = party[selectedHeroIndex] || getLeader() || party[0];

    listEl.innerHTML = merchant.stock.map((item, idx) => {
        const isSoldOut = (item.stock <= 0);
        const canAfford = (inventory.gold >= item.cost && !isSoldOut);
        const titleClass = item.rarity ? `class="rarity-${item.rarity}"` : '';
        const slotTag = item.slotLabel ? `<small style="color:#8c7d6e">[${item.slotLabel}]</small>` : '';
        const stockBadge = isSoldOut
            ? `<span class="item-qty-badge" style="color:#cf5b64;">SOLD</span>`
            : `<span class="item-qty-badge">${item.stock}/${item.maxStock}</span>`;

        const extraMeta = (item.type === 'specific_gear' && item.gearData)
            ? `${formatSetAndCurseMetaHtml(item.gearData, previewHero)}<div style="font-size:12px; margin-top:2px;">${formatStatDiffHtml(item.gearData, previewHero)}</div>`
            : '';

        return `
        <div class="bag-item-row" style="opacity:${isSoldOut ? '0.42' : '1'};">
            <div>
                <div><b ${titleClass}>${item.name}</b> ${slotTag} ${stockBadge}</div>
                <div class="item-buff-text">${item.desc}</div>
                ${extraMeta}
                <div style="font-family:var(--font-gothic); font-size:12.5px; color:#e2ceb4; margin-top:2px;">${item.cost} G</div>
            </div>
            <button type="button" class="btn-small-use" ${!canAfford ? 'disabled' : ''} onclick="buyMerchantItem(${idx})">
                ${isSoldOut ? 'Sold' : 'Acquire'}
            </button>
        </div>
        `;
    }).join('');

    const rerollCost = 35 + currentFloor * 8;
    const rerollRow = `
        <div class="bag-item-row" style="margin-top:6px;">
            <div>
                <b>${icon('reset', 13)} Restock Caravan Wares</b>
                <div class="item-buff-text">${merchant.rerolled ? 'Sudah digunakan pada pedagang lantai ini.' : `Perbarui seluruh stok lantai ini (sekali per pedagang). Biaya: ${rerollCost} G.`}</div>
            </div>
            <button type="button" class="btn-small-equip" ${(merchant.rerolled || inventory.gold < rerollCost) ? 'disabled' : ''} onclick="rerollMerchantStock()">
                ${merchant.rerolled ? 'Used' : `Restock (${rerollCost}G)`}
            </button>
        </div>
    `;

    const sellRows = inventory.bag.length === 0
        ? `<div class="bag-item-row"><div class="item-buff-text" style="color:#8c7d6e;">Reliquary Coffer kosong — tidak ada zirah cadangan untuk dijual.</div></div>`
        : inventory.bag.map((item, idx) => {
            const ico = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].icon) ? EQUIP_SLOTS[item.slot].icon : icon('chest', 13);
            const slotLabel = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].label) ? EQUIP_SLOTS[item.slot].label : item.slot;
            const up = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
            return `
            <div class="bag-item-row">
                <div>
                    <b class="rarity-${item.rarity || 'Common'}">${ico} ${item.name}</b> <small style="color:#8c7d6e">[${slotLabel}${up}]</small>
                    <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                </div>
                <button type="button" class="btn-small-unequip" onclick="sellBagItem(${idx})">Sell +${getItemSellValue(item)}G</button>
            </div>
            `;
        }).join('');

    listEl.innerHTML += `
        ${rerollRow}
        <h3 style="margin-top:10px;">Barter Spare Equipment</h3>
        ${sellRows}
    `;
}

// ==========================================
// DIALOG 1: APOTHECARY SATCHEL
// ==========================================
function toggleBackpackModal() {
    toggleDialogById('backpack-modal', renderBackpackModal);
}

function renderBackpackModal() {
    const listEl = document.getElementById('backpack-items-list');
    if (!listEl) return;
    const keys = Object.keys(CONSUMABLE_CATALOG).filter(k => (inventory.consumables[k] || 0) > 0);

    if (keys.length === 0) {
        listEl.innerHTML = `<div style="color:#8c7d6e; font-style:italic; font-size:14.5px; padding:22px; text-align:center;">Satchel kosong. Tumpas penghuni ruang bawah tanah atau temui Wandering Caravan.</div>`;
        return;
    }

    const activeActor = getCurrentActor();
    const isEnemyTurn = (gameMode === 'COMBAT' && activeActor && activeActor.isEnemy);

    listEl.innerHTML = keys.map(key => {
        const meta = CONSUMABLE_CATALOG[key];
        const qty = inventory.consumables[key];
        return `
        <div class="bag-item-row">
            <div>
                <div>${meta.icon} <b>${meta.name}</b> <span class="item-qty-badge">x${qty}</span></div>
                <div class="item-buff-text">${meta.desc}</div>
            </div>
            <button type="button" class="btn-small-use" ${isEnemyTurn ? 'disabled' : ''} onclick="useBackpackItem('${key}')">Imbibe</button>
        </div>
        `;
    }).join('');
}

// ==========================================
// DIALOG 2: ROYAL ARMORY & BLACKSMITH FORGE
// ==========================================
function toggleEquipModal(forceHeroIdx = null) {
    const equipModal = document.getElementById('equip-modal');
    if (!equipModal) return;

    if (forceHeroIdx !== null) {
        closeAllModals();
        selectedHeroIndex = forceHeroIdx;
        equipModal.showModal();
        renderEquipModal();
        return;
    }
    toggleDialogById('equip-modal', renderEquipModal);
}

function selectHeroTab(idx) {
    selectedHeroIndex = idx;
    renderEquipModal();
}

function renderEquipModal() {
    const hero = party[selectedHeroIndex];
    if (!hero) return;

    const oreEl = document.getElementById('modal-ore-count');
    const goldEl = document.getElementById('modal-gold-count');
    if (oreEl) oreEl.innerText = inventory.ore;
    if (goldEl) goldEl.innerText = inventory.gold;

    const tabsEl = document.getElementById('hero-tabs');
    if (tabsEl) {
        tabsEl.innerHTML = party.map((p, idx) => {
            const avatarUrl = (typeof getHeroPortraitDataURL === 'function') ? getHeroPortraitDataURL(p.role) : '';
            return `
            <button type="button" class="hero-tab-btn ${idx === selectedHeroIndex ? 'active' : ''}" onclick="selectHeroTab(${idx})">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${p.role}">` : ''}
                <span>${p.name} · Lv.${p.level}</span>
            </button>
            `;
        }).join('');
    }

    const pts = hero.statPoints;
    const btnHtml = (stat, label) => pts > 0
        ? `<button type="button" class="btn-small-use" style="padding:1px 5px; font-size:10.5px; margin-left:4px;" onclick="allocateStatPoint(${selectedHeroIndex}, '${stat}')">+${label}</button>`
        : '';

    const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(hero) : { roman: 'I', roleLabel: 'VANGUARD' };

    document.getElementById('modal-hero-title').innerHTML = `
        ${hero.name} (${hero.role}) · Rank ${form.roman} ${form.roleLabel} <small>EXP ${hero.xp}/${hero.maxXp}</small>
        ${pts > 0 ? `<span style="color:#92c4a4; margin-left:6px;">[+${pts} Attr Pt]</span>` : ''}
    `;

    document.getElementById('modal-hero-stats').innerHTML = `
        <span>HP<b>${hero.maxHp}</b>${btnHtml('hp','12')}</span>
        <span>MP<b>${hero.maxMp}</b>${btnHtml('mp','8')}</span>
        <span>P.ATK<b>${hero.patk}</b>${btnHtml('patk','2')}</span>
        <span>M.ATK<b>${hero.matk}</b>${btnHtml('matk','2')}</span>
        <span>DEF<b>${hero.def}</b>${btnHtml('def','2')}</span>
        <span>SPD<b>${hero.spd}</b>${btnHtml('spd','1')}</span>
    `;

    const setCounts = getHeroActiveSets(hero);
    const activeSetBadges = Object.keys(setCounts).map(sKey => {
        const s = EQUIPMENT_SETS[sKey];
        const cnt = setCounts[sKey];
        const b2 = cnt >= 2 ? `<b style="color:#92c4a4">[2pc: ${s.bonus2Desc}]</b>` : `<small style="color:#8c7d6e">(Requires 2pc)</small>`;
        const b4 = cnt >= 4 ? ` <b style="color:#e2ceb4">[4pc: ${s.bonus4Desc}]</b>` : '';
        return `<div style="margin-top:2px;"><span style="color:${s.color}">${s.icon} <b>${s.name} (${cnt}/4):</b></span> ${b2}${b4}</div>`;
    }).join('');

    const perkEl = document.getElementById('modal-hero-perks');
    const activePerkNames = (hero.perks || []).map(k => PERK_CATALOG[k] ? PERK_CATALOG[k].name : k).join(', ') || 'None';
    const perkBtns = Object.values(PERK_CATALOG).map(pk => {
        const owned = hero.perks && hero.perks.includes(pk.id);
        return `<button type="button" class="${owned ? 'btn-small-use' : 'btn-small-unequip'}"
            ${(owned || hero.perkPoints <= 0) ? 'disabled' : ''}
            title="${pk.desc}" onclick="unlockHeroPerk(${selectedHeroIndex}, '${pk.id}')">
            ${owned ? `${icon('check', 11)} ` : ''}${pk.name}
        </button>`;
    }).join('');

    const masteryBtns = Object.values(MASTERY_CATALOG).map(m => {
        const owned = hero.mastery && hero.mastery.includes(m.id);
        return `<button type="button" class="${owned ? 'btn-small-use' : 'btn-small-unequip'}"
            ${(owned || (hero.perkPoints || 0) <= 0) ? 'disabled' : ''}
            title="${m.desc}" onclick="unlockMastery(${selectedHeroIndex}, '${m.id}')">
            ${owned ? `${icon('check', 11)} ` : ''}${m.name}
        </button>`;
    }).join('');
    const activeMastery = (hero.mastery || []).map(k => MASTERY_CATALOG[k].name).join(', ') || 'None';

    perkEl.innerHTML = `
        <div><b>Knightly Vows:</b> <span style="color:#e2ceb4">${activePerkNames}</span>
        ${hero.perkPoints > 0 ? `<b style="color:#92c4a4; margin-left:6px;">(${hero.perkPoints} Vow Pt)</b>` : `<small style="color:#8c7d6e">(Odd Levels)</small>`}</div>
        <div class="perk-btn-row">${perkBtns}</div>
        <div style="margin-top:6px; border-top:1px solid #2e2620; padding-top:5px;">
            <b>Combat Mastery:</b> <span style="color:#e2ceb4">${activeMastery}</span>
            <div class="perk-btn-row">${masteryBtns}</div>
        </div>
        ${activeSetBadges ? `<div style="border-top:1px solid #2e2620; margin-top:5px; padding-top:4px;">${activeSetBadges}</div>` : ''}
    `;

    const runeEl = document.getElementById('modal-hero-runes');
    if (runeEl) {
        const runes = hero.runes || [];
        const charm = hero.charm;
        let html = charm
            ? `<div>${icon('relic', 12)} <b>Charm:</b> <span style="color:#e2ceb4;">${charm.name}</span> <small style="color:#8c7d6e">(${charm.desc})</small></div>`
            : `<div>${icon('relic', 12)} <b>Charm:</b> <small style="color:#8c7d6e">Empty (Dropped by Bosses)</small></div>`;
        if (runes.length === 0) {
            html += `<div style="margin-top:2px;">${icon('arcane', 12)} <b>Runes:</b> <small style="color:#8c7d6e">None inscribed (Dropped by Elites &amp; Bosses)</small></div>`;
        } else {
            const list = runes.map(k => {
                const r = (typeof RUNE_CATALOG !== 'undefined') ? RUNE_CATALOG[k] : null;
                return r ? `<span style="color:#c8addb; margin-right:8px;" title="${r.desc}">${r.name}</span>` : k;
            }).join('');
            html += `<div style="margin-top:2px;">${icon('arcane', 12)} <b>Runes (${runes.length}):</b> ${list}</div>`;
        }
        runeEl.innerHTML = html;
    }

    const slotsEl = document.getElementById('equipped-slots-list');
    slotsEl.innerHTML = Object.keys(EQUIP_SLOTS).map(slotKey => {
        const slotMeta = EQUIP_SLOTS[slotKey];
        const eqItem = hero.equipment[slotKey];

        if (eqItem) {
            const upgLv = eqItem.upgradeLevel || 0;
            const costOre = 1 + upgLv;
            const costGold = 25 + (upgLv * 20);
            const canForge = (inventory.ore >= costOre && inventory.gold >= costGold);

            return `
            <div class="slot-row">
                <div>
                    <div>
                        ${slotMeta.icon} <b>${slotMeta.label}:</b>
                        <span class="rarity-${eqItem.rarity}">${eqItem.name} ${upgLv > 0 ? `<b style="color:#8eb5d9">+${upgLv}</b>` : ''}</span>
                    </div>
                    <div class="item-buff-text">${formatItemBuffs(eqItem.stats)}</div>
                    ${formatSetAndCurseMetaHtml(eqItem, hero)}
                </div>
                <div style="display:flex; gap:5px;">
                    <button type="button" class="btn-small-equip" ${!canForge ? 'disabled' : ''}
                        title="Temper: Requires ${costOre} Ore & ${costGold} Gold"
                        onclick="upgradeEquippedItem(${selectedHeroIndex}, '${slotKey}')">
                        Temper (${costOre} Ore · ${costGold}G)
                    </button>
                    <button type="button" class="btn-small-unequip" onclick="unequipItemFromHero(${selectedHeroIndex}, '${slotKey}')">Unequip</button>
                </div>
            </div>
            `;
        }
        return `
        <div class="slot-row" style="opacity:0.48;">
            <div>${slotMeta.icon} <b>${slotMeta.label}:</b> <i>Empty Slot</i></div>
            <span style="color:#6e5a49;">—</span>
        </div>
        `;
    }).join('');

    const bagEl = document.getElementById('bag-items-list');
    if (inventory.bag.length === 0) {
        bagEl.innerHTML = '<div style="color:#8c7d6e; font-style:italic; font-size:14px; padding:14px;">Reliquary Coffer kosong.</div>';
        return;
    }

    const rarityRank = { 'Common':0, 'Rare':1, 'Epic':2, 'Legendary':3, 'Cursed':3 };
    const sortSel = document.getElementById('bag-sort-select');
    const filterSel = document.getElementById('bag-filter-select');
    const sortMode = sortSel ? sortSel.value : 'rarity';
    const filterMode = filterSel ? filterSel.value : 'all';

    let indexed = inventory.bag.map((item, bagIdx) => ({ item, bagIdx }));
    if (filterMode === 'upgrade') {
        indexed = indexed.filter(o => {
            const cur = hero.equipment[o.item.slot];
            if (!cur) return true;
            return ['hp','mp','patk','matk','def','spd'].some(k => (o.item.stats[k] || 0) > (cur.stats[k] || 0));
        });
    } else if (filterMode !== 'all') {
        indexed = indexed.filter(o => {
            if (filterMode === 'legendary') return o.item.rarity === 'Legendary' || o.item.rarity === 'Cursed';
            const target = filterMode.charAt(0).toUpperCase() + filterMode.slice(1);
            return o.item.rarity === target;
        });
    }
    if (sortMode === 'rarity') {
        indexed.sort((a, b) => (rarityRank[b.item.rarity] || 0) - (rarityRank[a.item.rarity] || 0));
    } else if (sortMode === 'slot') {
        indexed.sort((a, b) => String(a.item.slot).localeCompare(String(b.item.slot)));
    } else if (sortMode === 'name') {
        indexed.sort((a, b) => String(a.item.name).localeCompare(String(b.item.name)));
    }

    if (indexed.length === 0) {
        bagEl.innerHTML = '<div style="color:#8c7d6e; font-style:italic; padding:12px;">Tidak ada zirah yang sesuai filter.</div>';
        return;
    }

    bagEl.innerHTML = indexed.map(o => {
        const item = o.item;
        const bagIdx = o.bagIdx;
        const slotMeta = EQUIP_SLOTS[item.slot];
        const upgLv = item.upgradeLevel || 0;
        const diffHtml = formatStatDiffHtml(item, hero);
        return `
        <div class="bag-item-row">
            <div>
                <div>${slotMeta.icon} <span class="rarity-${item.rarity}">${item.name}${upgLv > 0 ? ' +' + upgLv : ''}</span> <small style="color:#8c7d6e">[${slotMeta.label}]</small></div>
                <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                ${formatSetAndCurseMetaHtml(item, hero)}
                <div style="font-size:12px; margin-top:4px; padding:3px 6px; background:#110f11; border:1px solid #2e2620;">${diffHtml}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-equip" onclick="equipItemToHero(${bagIdx}, ${selectedHeroIndex})">Equip</button>
                <button type="button" class="btn-small-unequip" title="Lebur menjadi Forge Ore & Gold" onclick="dismantleBagItem(${bagIdx})">Smelt</button>
            </div>
        </div>`;
    }).join('');
}

// =========================================================
// INITIATIVE MIST STRIP, COMMAND DECK & HERO WIDGETS
// =========================================================
function updateTurnQueueUI() {
    const queueEl = document.getElementById('turn-queue-list');
    const roundLbl = document.getElementById('round-counter-label');
    const movePosLbl = document.getElementById('lbl-move-pos');
    const subMovePos = document.getElementById('sub-move-pos');
    const movePosBtn = document.getElementById('btn-move-pos');
    const skill2Btn  = document.getElementById('btn-skill2');
    const skill2Lbl  = document.getElementById('lbl-skill2');
    const subSkill2  = document.getElementById('sub-skill2');
    const subSkill   = document.getElementById('sub-skill');
    const subAttack  = document.getElementById('sub-attack');
    const ultBtn     = document.getElementById('btn-ult');
    const subUlt     = document.getElementById('sub-ult');

    if (gameMode !== 'COMBAT' || turnQueue.length === 0) {
        if (roundLbl) roundLbl.innerHTML = `EXPLORATION`;
        const clearHint = !isFloorCleared()
            ? `Vanquish ${enemies.length} remaining adversaries to unseal the stairwell${sharpenedBuff ? ' · Honed Blades (+25% DMG)' : ''}`
            : `Stairwell unsealed — descend to Floor ${currentFloor + 1}`;
        queueEl.innerHTML = `<span class="queue-empty" style="color:${isFloorCleared() ? '#92c4a4' : '#9e8f7f'}">${clearHint}</span>`;
        document.getElementById('active-actor-name').innerText = '—';
        document.getElementById('lbl-attack').innerText = 'Strike';
        if (subAttack) subAttack.innerText = 'Basic Attack';
        document.getElementById('lbl-skill').innerText = 'Primary Art';
        if (subSkill) subSkill.innerText = 'Class Technique';
        if (skill2Lbl) skill2Lbl.innerText = 'Mastery Art';
        if (subSkill2) subSkill2.innerText = 'Unlocks at Lv.5';
        if (skill2Btn) skill2Btn.disabled = true;
        document.getElementById('lbl-ult').innerText = 'Overdrive Art';
        if (subUlt) subUlt.innerText = 'Requires 100% Overdrive';
        if (ultBtn) { ultBtn.disabled = true; ultBtn.style.setProperty('--od-pct', '0%'); }
        if (movePosLbl) movePosLbl.innerText = 'Reposition';
        if (subMovePos) subMovePos.innerText = 'Shift Rank · +4 MP';
        if (movePosBtn) movePosBtn.disabled = true;
        return;
    }

    if (roundLbl && typeof combatRound !== 'undefined') {
        const isEnrage = combatRound >= 8;
        const comboTxt = (typeof comboCounter !== 'undefined' && comboCounter > 1) ? ` · ${comboCounter}x` : '';
        roundLbl.innerHTML = isEnrage
            ? `<span style="color:#cf5b64">ROUND ${combatRound} · ENRAGED${comboTxt}</span>`
            : `ROUND ${combatRound}/7${comboTxt}`;
    }

    const activeActor = getCurrentActor();
    if (activeActor) {
        document.getElementById('active-actor-name').innerText = activeActor.name;

        if (!activeActor.isEnemy) {
            const actualCost = (typeof getEffectiveSkillCost === 'function')
                ? getEffectiveSkillCost(activeActor, activeActor.skillCost)
                : activeActor.skillCost;
            const actualCost2 = (typeof getEffectiveSkillCost === 'function')
                ? getEffectiveSkillCost(activeActor, activeActor.skill2Cost || 15)
                : (activeActor.skill2Cost || 15);

            const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(activeActor) : { isFront: true };
            const moveDirText = form.isFront ? "To Rear" : "To Front";
            const odVal = Math.min(100, activeActor.overdrive || 0);

            document.getElementById('lbl-attack').innerText = 'Strike';
            if (subAttack) subAttack.innerText = `${activeActor.dmgType} +25%OD`;

            document.getElementById('lbl-skill').innerText = activeActor.skillName;
            if (subSkill) subSkill.innerText = `${actualCost} MP`;

            if (skill2Lbl) skill2Lbl.innerText = activeActor.skill2Name;
            if (subSkill2) subSkill2.innerText = activeActor.level >= 5 ? `${actualCost2} MP` : 'Req Lv.5';
            if (skill2Btn) skill2Btn.disabled = (activeActor.level < 5);

            if (movePosLbl) movePosLbl.innerText = 'Shift';
            if (subMovePos) subMovePos.innerText = `${moveDirText} +4MP`;

            document.getElementById('lbl-ult').innerText = activeActor.ultName;
            if (subUlt) subUlt.innerText = odVal >= 100 ? 'UNLEASH READY' : `Charge ${odVal}%`;
            if (ultBtn) {
                ultBtn.disabled = (odVal < 100);
                ultBtn.style.setProperty('--od-pct', `${odVal}%`);
            }
        } else {
            if (ultBtn) { ultBtn.disabled = true; ultBtn.style.setProperty('--od-pct', '0%'); }
            if (skill2Btn) skill2Btn.disabled = true;
            if (movePosBtn) movePosBtn.disabled = true;
        }
    }

    queueEl.innerHTML = turnQueue.map((unit, idx) => {
        const isCurrent = (idx === turnIndex);
        const isSelectedTarget = (unit.isEnemy && unit === activeEnemy);
        const classes = [
            'turn-badge',
            isCurrent ? 'active-turn' : '',
            unit.isEnemy ? 'enemy-turn' : '',
            isSelectedTarget ? 'target-locked' : ''
        ].filter(Boolean).join(' ');

        const sigil = unit.isEnemy
            ? (isSelectedTarget ? icon('target', 11) : (unit.isBoss ? icon('crown', 11) : icon('skull', 11)))
            : icon('crest', 11);
        const arrow = idx < turnQueue.length - 1 ? `<span class="turn-arrow" aria-hidden="true">›</span>` : '';
        const enemyIdx = unit.isEnemy ? activeEnemies.indexOf(unit) : -1;
        const clickAttr = (unit.isEnemy && enemyIdx >= 0)
            ? `style="cursor:pointer;" title="Klik untuk kunci Target" onclick="cycleCombatTarget(activeEnemies[${enemyIdx}])"`
            : '';

        return `
            <div class="${classes}" ${clickAttr}>
                <span style="color:${unit.color || '#c7ae91'}">${sigil}</span>
                <span>${unit.name} <small>${unit.hp}</small></span>
            </div>
            ${arrow}
        `;
    }).join('');
}

function updateUI() {
    const biome = getCurrentBiome();
    const biomeEl = document.getElementById('biome-badge');
    if (biomeEl) biomeEl.innerText = biome.name;

    let modSuffix = "";
    if (typeof floorModifier !== 'undefined' && floorModifier) {
        const modLabels = { blood_moon:' · Blood Moon', famine:' · Famine', gilded:' · Gilded', darkness:' · Pitch Dark', silence:' · Silence' };
        modSuffix = modLabels[floorModifier] || '';
    }
    document.getElementById('current-floor').innerText = currentFloor + modSuffix;

    const seedBadge = document.getElementById('run-seed-badge');
    if (seedBadge) seedBadge.innerText = (typeof runSeed !== 'undefined' && runSeed) ? runSeed : 'Random';

    const prestBadge = document.getElementById('prestige-badge');
    if (prestBadge && typeof getPrestigeLevel === 'function') prestBadge.innerText = `Lv.${getPrestigeLevel()}`;

    const speedValEl = document.getElementById('lbl-speed-val');
    if (speedValEl) speedValEl.innerText = 'x' + (typeof gameSpeed !== 'undefined' ? gameSpeed : 1);

    const autoBtn = document.getElementById('btn-autobattle-menu');
    if (autoBtn) autoBtn.setAttribute('aria-pressed', String(Boolean(typeof autoBattle !== 'undefined' && autoBattle)));

    const stratBtn = document.getElementById('btn-strategy-menu');
    if (stratBtn) {
        const st = (typeof autoBattleStrategy !== 'undefined' ? autoBattleStrategy : 'balanced').slice(0, 3).toUpperCase();
        stratBtn.innerText = `AI:${st} [K]`;
    }
    const tacticBtn = document.getElementById('btn-tactic-menu');
    if (tacticBtn) {
        const tc = (typeof formationTactic !== 'undefined' ? formationTactic : 'balanced').slice(0, 3).toUpperCase();
        tacticBtn.innerText = `${tc} [T]`;
    }

    document.getElementById('ascension-badge').innerText = `Lv.${ascensionLevel}`;

    // Torch Plaque
    document.getElementById('torch-count').innerText = `${torchLight}%`;
    const torchStateEl = document.getElementById('torch-state-label');
    if (torchStateEl) {
        if (torchLight > 50) { torchStateEl.innerText = 'RADIANT'; torchStateEl.style.color = '#c7ae91'; }
        else if (torchLight > 15) { torchStateEl.innerText = 'DIMMING'; torchStateEl.style.color = '#8e7660'; }
        else { torchStateEl.innerText = 'ABYSSAL'; torchStateEl.style.color = '#cf5b64'; }
    }
    const torchBar = document.getElementById('torch-bar-fill');
    if (torchBar) torchBar.style.width = `${Math.max(0, Math.min(100, torchLight))}%`;

    document.getElementById('gold-count').innerText = inventory.gold;
    document.getElementById('ore-count').innerText = inventory.ore;
    document.getElementById('item-bag-count').innerText = getTotalBackpackCount();
    document.getElementById('bag-count').innerText = inventory.bag.length;

    const synEl = document.getElementById('synergy-pill');
    if (synEl && typeof getPartySynergyBonus === 'function') {
        const syn = getPartySynergyBonus();
        const parts = [];
        if (syn.def) parts.push(`+${syn.def} DEF`);
        if (syn.patk) parts.push(`+${syn.patk} ATK`);
        if (syn.spd) parts.push(`+${syn.spd} SPD`);
        synEl.innerText = parts.length > 0 ? parts.join(' · ') : '';
    }

    const bountyEl = document.getElementById('bounty-badge');
    if (bountyEl && typeof floorBounty !== 'undefined' && floorBounty) {
        if (floorBounty.completed) {
            bountyEl.innerHTML = `${icon('scroll', 12)} <span style="color:#92c4a4;">Decree Fulfilled</span>`;
        } else if (floorBounty.failed) {
            bountyEl.innerHTML = `${icon('scroll', 12)} <span style="color:#cf5b64;">Decree Failed</span>`;
        } else {
            bountyEl.innerHTML = `${icon('scroll', 12)} <span>${floorBounty.desc} (${floorBounty.progress}/${floorBounty.target}) · <b style="color:#e2ceb4">+${floorBounty.rewardGold}G</b></span>`;
        }
    }

    const ascBtn = document.getElementById('btn-ascend');
    if (ascBtn) {
        if (currentFloor >= 10 && isFloorCleared()) ascBtn.classList.remove('hidden');
        else ascBtn.classList.add('hidden');
    }
    const prestBtn = document.getElementById('btn-prestige');
    if (prestBtn) {
        if (currentFloor >= 10) prestBtn.classList.remove('hidden');
        else prestBtn.classList.add('hidden');
    }

    const activeActor = getCurrentActor();
    const currentLeader = getLeader();

    // Exact Reference HUD Widget per Hero:
    // 32x32/48x48 Ornate Portrait + Mini Square 8x8 Slot Boxes + 3 Staggered Pointed Bars (Red, Blue, Green)
    const list = document.getElementById('party-list');
    list.innerHTML = party.map((p, idx) => {
        const hpPercent = Math.max(0, Math.floor((p.hp / p.maxHp) * 100));
        const mpPercent = Math.max(0, Math.floor((p.mp / p.maxMp) * 100));
        const odPercent = Math.min(100, p.overdrive || 0);
        const odFillClass = odPercent >= 100 ? 'fill-amber' : 'fill-verdigris';
        const isLeader = (p === currentLeader);
        const isMyTurn = (gameMode === 'COMBAT' && activeActor === p);
        const totalPts = (p.statPoints || 0) + (p.perkPoints || 0);
        const pointBadge = totalPts > 0 ? `<span class="unspent-pt">+${totalPts}</span>` : '';
        const avatarUrl = (typeof getHeroPortraitDataURL === 'function') ? getHeroPortraitDataURL(p.role) : '';

        const form = (typeof getHeroFormationInfo === 'function')
            ? getHeroFormationInfo(p)
            : { roman: ['I', 'II', 'III', 'IV'][idx] || String(idx + 1), isFront: idx < 2 };

        const swapUpBtn = (gameMode === 'EXPLORE' && idx > 0)
            ? `<button type="button" class="btn-rank-step" title="Advance Rank" aria-label="Advance ${p.name}" onclick="event.stopPropagation(); swapPartyFormation(${idx}, ${idx - 1})">▲</button>` : '';
        const swapDownBtn = (gameMode === 'EXPLORE' && idx < party.length - 1)
            ? `<button type="button" class="btn-rank-step" title="Step Back" aria-label="Move ${p.name} Back" onclick="event.stopPropagation(); swapPartyFormation(${idx}, ${idx + 1})">▼</button>` : '';

        const miniBoxes = Object.keys(EQUIP_SLOTS).map(slotKey => {
            const item = p.equipment[slotKey];
            const cls = item ? (item.curseId ? 'micro-slot-box cursed' : 'micro-slot-box') : 'micro-slot-box empty';
            const ico = item && item.curseId ? icon('skull', 9) : EQUIP_SLOTS[slotKey].icon;
            return `<span class="${cls}" title="${item ? item.name : `${EQUIP_SLOTS[slotKey].label}: Empty`}">${ico}</span>`;
        }).join('');

        let statusHtml = '';
        if (p.statuses) {
            if (p.statuses.poison > 0) statusHtml += `<span class="tag-poison">PSN ${p.statuses.poison}</span>`;
            if (p.statuses.burn > 0)   statusHtml += `<span class="tag-burn">BRN ${p.statuses.burn}</span>`;
            if (p.statuses.stun > 0)   statusHtml += `<span class="tag-stun">STUN</span>`;
        }
        if (getHeroCursedRelicId(p)) statusHtml += `<span class="tag-curse">CURSED</span>`;

        return `
        <div class="member-card ${isMyTurn ? 'active-turn-card' : ''}" onclick="toggleEquipModal(${idx})" style="opacity:${p.hp > 0 ? '1' : '0.38'}">
            <div class="hero-portrait-frame">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${p.role}">` : ''}
                <span class="rank-numeral" title="${form.isFront ? 'Vanguard' : 'Rearguard'}">${form.roman}</span>
            </div>
            <div class="member-details">
                <div class="member-top-strip">
                    <span class="hero-id-line">
                        ${isLeader ? `<span style="color:#c7ae91" title="Leader">${icon('crown', 11)}</span>` : ''}
                        <span class="hero-name-title">${p.name}</span>
                        <span class="hero-lv-tag">Lv.${p.level}</span>
                        ${pointBadge}
                    </span>
                    <div class="mini-slot-boxes">${miniBoxes}</div>
                </div>

                <div class="staggered-bars">
                    <div class="pointed-bar-track bar-track-hp" title="HP ${p.hp}/${p.maxHp}">
                        <span class="pointed-bar-fill fill-crimson" style="width:${hpPercent}%;"></span>
                    </div>
                    <div class="pointed-bar-track bar-track-mp" title="MP ${p.mp}/${p.maxMp}">
                        <span class="pointed-bar-fill fill-cobalt" style="width:${mpPercent}%;"></span>
                    </div>
                    <div class="pointed-bar-track bar-track-od" title="Overdrive ${odPercent}%">
                        <span class="pointed-bar-fill ${odFillClass}" style="width:${odPercent}%;"></span>
                    </div>
                </div>

                <div class="member-bottom-meta">
                    <span>HP <b>${p.hp}</b> · MP <b>${p.mp}</b> · OD <b>${odPercent}%</b></span>
                    <span class="status-tags">
                        <span class="rank-swap-controls">${swapUpBtn}${swapDownBtn}</span>
                        ${statusHtml || (isMyTurn ? '<span style="color:#e2ceb4">ACTING</span>' : (p.hp <= 0 ? '<span class="tag-curse">FALLEN</span>' : ''))}
                    </span>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const isEnemyTurn = (gameMode === 'COMBAT' && activeActor && activeActor.isEnemy);
    const hasFallenHero = party.some(p => p.hp <= 0);
    const isAllDead = party.every(p => p.hp <= 0);

    document.getElementById('btn-item').disabled = (getTotalBackpackCount() <= 0 || isEnemyTurn || isAllDead);
    document.getElementById('btn-revive').disabled = ((inventory.consumables.revive || 0) <= 0 || !hasFallenHero || isEnemyTurn || isAllDead);

    updateTurnQueueUI();
    if (gameMode === 'EXPLORE' && typeof saveGameProgress === 'function') {
        saveGameProgress();
    }
}

function updateModeUI() {
    const modeEl = document.getElementById('game-mode');
    if (!modeEl) return;
    if (gameMode === 'EXPLORE' || gameMode === 'TRANSITION') {
        modeEl.innerText = 'EXPLORE';
        modeEl.className = 'mode-tag mode-explore';
    } else if (gameMode === 'AMBUSH') {
        modeEl.innerText = 'AMBUSH';
        modeEl.className = 'mode-tag mode-combat';
    } else {
        modeEl.innerText = activeEnemy && activeEnemy.isBoss ? 'BOSS' : 'COMBAT';
        modeEl.className = 'mode-tag mode-combat';
    }
}

function setCombatButtons(disabled) {
    document.getElementById('btn-attack').disabled = disabled;
    document.getElementById('btn-skill').disabled = disabled;
    document.getElementById('btn-defend').disabled = disabled;
    const fleeBtn = document.getElementById('btn-flee');
    if (fleeBtn) fleeBtn.disabled = disabled;
    const moveBtn = document.getElementById('btn-move-pos');
    const skill2Btn = document.getElementById('btn-skill2');
    if (moveBtn) moveBtn.disabled = disabled;
    if (disabled) {
        const ultBtn = document.getElementById('btn-ult');
        if (ultBtn) ultBtn.disabled = true;
        if (skill2Btn) skill2Btn.disabled = true;
    }
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
            ctx.globalAlpha = Math.max(0, 1 - v.progress * 0.75);
            ctx.shadowColor = v.color;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = v.color;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(v.tx, v.ty, 24, -Math.PI * 0.72 + v.progress * 1.5, Math.PI * 0.22 + v.progress * 1.5);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
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

function drawScreenSpaceOverlays() {
    const vx = cameraView.x;
    const vy = cameraView.y;
    const vw = cameraView.w;
    const vh = cameraView.h;
    const vcx = vx + vw * 0.5;
    const vcy = vy + vh * 0.5;

    const edgeVig = ctx.createRadialGradient(
        vcx, vcy, vh * 0.42,
        vcx, vcy, vw * 0.62
    );
    edgeVig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeVig.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(vx, vy, vw, vh);

    const alive = party.filter(p => p.hp > 0);
    if (alive.length > 0) {
        const avgHpRatio = alive.reduce((sum, p) => sum + (p.hp / p.maxHp), 0) / alive.length;
        if (avgHpRatio < 0.32) {
            const pulse = 0.20 + Math.abs(Math.sin(torchFlickerPhase * 0.9)) * 0.22;
            const redGrad = ctx.createRadialGradient(
                vcx, vcy, vh * 0.25,
                vcx, vcy, vw * 0.65
            );
            redGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            redGrad.addColorStop(1, `rgba(135, 14, 20, ${pulse})`);
            ctx.fillStyle = redGrad;
            ctx.fillRect(vx, vy, vw, vh);
        }
    }

    // "MAP FOUND" Style Faded Mist Ultimate Cut-In Banner
    if (ultimateCutIn) {
        ctx.save();
        ctx.globalAlpha = ultimateCutIn.alpha;
        const cy = vcy - 38;

        const bGrad = ctx.createLinearGradient(vx, cy, vx + vw, cy);
        bGrad.addColorStop(0, 'rgba(18, 16, 18, 0.15)');
        bGrad.addColorStop(0.25, 'rgba(22, 19, 21, 0.95)');
        bGrad.addColorStop(0.75, 'rgba(22, 19, 21, 0.95)');
        bGrad.addColorStop(1, 'rgba(18, 16, 18, 0.15)');
        ctx.fillStyle = bGrad;
        ctx.fillRect(vx, cy, vw, 76);

        const lineGrad = ctx.createLinearGradient(vx, 0, vx + vw, 0);
        lineGrad.addColorStop(0, 'rgba(142, 118, 96, 0)');
        lineGrad.addColorStop(0.5, '#c7ae91');
        lineGrad.addColorStop(1, 'rgba(142, 118, 96, 0)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(vx, cy); ctx.lineTo(vx + vw, cy);
        ctx.moveTo(vx, cy + 76); ctx.lineTo(vx + vw, cy + 76);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#9e8f7f';
        ctx.font = '700 12px Almendra, Cinzel, serif';
        ctx.fillText(`OVERDRIVE UNLEASHED · ${ultimateCutIn.actorName}`, vcx, cy + 25);

        ctx.fillStyle = '#e2ceb4';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.font = '700 28px Almendra, Cinzel, serif';
        ctx.fillText(ultimateCutIn.ultTitle, vcx, cy + 56);
        ctx.textAlign = 'left';
        ctx.restore();
    }
}

function drawMiniMapRadar() {
    if (!minimapCanvas || !minimapCtx) return;
    if (!showMiniMap) { minimapCanvas.style.display = 'none'; return; }
    minimapCanvas.style.display = 'block';
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const cell = 7.5;
    const pad = 10;
    const headerH = 20;
    const mapH = ROWS * cell;
    const boxW = minimapCanvas.width;
    const boxH = minimapCanvas.height;

    const gridOriginX = pad;
    const gridOriginY = headerH;
    const biome = getCurrentBiome();

    minimapCtx.save();
    minimapCtx.fillStyle = 'rgba(10, 9, 12, 0.42)';
    minimapCtx.fillRect(0, 0, boxW, boxH);

    minimapCtx.fillStyle = '#c7ae91';
    minimapCtx.font = '700 10px Almendra, Cinzel, serif';
    minimapCtx.fillText(`F${currentFloor} · ${biome.name}`, pad, 13.5);

    minimapCtx.textAlign = 'right';
    minimapCtx.fillStyle = isFloorCleared() ? '#78ab8c' : '#c95b60';
    minimapCtx.fillText(isFloorCleared() ? 'CLEAR' : `${enemies.length} FOES`, boxW - pad, 13.5);
    minimapCtx.textAlign = 'left';

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = gridOriginX + x * cell;
            const py = gridOriginY + y * cell;

            if (!revealed[y] || !revealed[y][x]) {
                minimapCtx.fillStyle = '#0c0b0c';
                minimapCtx.fillRect(px, py, cell, cell);
                continue;
            }
            if (map[y][x] === 1) {
                minimapCtx.fillStyle = '#38302b';
                minimapCtx.fillRect(px, py, cell, cell);
            } else if (map[y][x] === 2) {
                minimapCtx.fillStyle = '#c7ae91';
                minimapCtx.fillRect(px, py, cell, cell);
            } else {
                minimapCtx.fillStyle = '#1d1a1d';
                minimapCtx.fillRect(px, py, cell - 0.5, cell - 0.5);
            }
        }
    }

    traps.forEach(t => {
        if (revealed[t.y] && revealed[t.y][t.x] && (t.detected || t.triggered)) {
            minimapCtx.fillStyle = '#a8383b';
            minimapCtx.fillRect(gridOriginX + t.x * cell + 2, gridOriginY + t.y * cell + 2, cell - 4, cell - 4);
        }
    });

    chests.forEach(c => {
        if (!c.opened && revealed[c.y] && revealed[c.y][c.x]) {
            minimapCtx.fillStyle = '#d8c2a6';
            minimapCtx.fillRect(gridOriginX + c.x * cell + 1.5, gridOriginY + c.y * cell + 1.5, cell - 3, cell - 3);
        }
    });

    lootDrops.forEach(d => {
        if (revealed[d.y] && revealed[d.y][d.x]) {
            minimapCtx.fillStyle = '#ad85cc';
            minimapCtx.fillRect(gridOriginX + d.x * cell + 1.5, gridOriginY + d.y * cell + 1.5, cell - 3, cell - 3);
        }
    });

    if (merchant && revealed[merchant.y] && revealed[merchant.y][merchant.x]) {
        minimapCtx.fillStyle = '#78ab8c';
        minimapCtx.fillRect(gridOriginX + merchant.x * cell + 1, gridOriginY + merchant.y * cell + 1, cell - 2, cell - 2);
    }
    if (shrine && !shrine.used && revealed[shrine.y] && revealed[shrine.y][shrine.x]) {
        minimapCtx.fillStyle = '#79a6cf';
        minimapCtx.fillRect(gridOriginX + shrine.x * cell + 1, gridOriginY + shrine.y * cell + 1, cell - 2, cell - 2);
    }
    if (campfire && !campfire.used && revealed[campfire.y] && revealed[campfire.y][campfire.x]) {
        minimapCtx.fillStyle = '#c78d44';
        minimapCtx.fillRect(gridOriginX + campfire.x * cell + 1, gridOriginY + campfire.y * cell + 1, cell - 2, cell - 2);
    }

    if ((revealed[stairs.y] && revealed[stairs.y][stairs.x]) || isFloorCleared()) {
        minimapCtx.fillStyle = isFloorCleared() ? '#78ab8c' : '#6e5a49';
        minimapCtx.fillRect(gridOriginX + stairs.x * cell, gridOriginY + stairs.y * cell, cell, cell);
        minimapCtx.strokeStyle = '#dfd0bc';
        minimapCtx.lineWidth = 0.8;
        minimapCtx.strokeRect(gridOriginX + stairs.x * cell, gridOriginY + stairs.y * cell, cell, cell);
    }

    enemies.forEach(e => {
        if (revealed[e.y] && revealed[e.y][e.x]) {
            const ex = gridOriginX + e.x * cell;
            const ey = gridOriginY + e.y * cell;
            minimapCtx.fillStyle = e.isBoss ? '#e2ceb4' : '#a8383b';
            if (e.isBoss) minimapCtx.fillRect(ex - 0.5, ey - 0.5, cell + 1, cell + 1);
            else minimapCtx.fillRect(ex + 1, ey + 1, cell - 2, cell - 2);

            if (gameMode === 'COMBAT' && e === activeEnemy) {
                minimapCtx.strokeStyle = '#79a6cf';
                minimapCtx.lineWidth = 1;
                minimapCtx.strokeRect(ex - 1, ey - 1, cell + 2, cell + 2);
            }
        }
    });

    party.forEach(p => {
        if (p.hp > 0) {
            minimapCtx.fillStyle = '#4376a8';
            minimapCtx.fillRect(gridOriginX + p.x * cell + 1, gridOriginY + p.y * cell + 1, cell - 2, cell - 2);
        }
    });

    const ldr = getLeader();
    if (ldr) {
        const lx = gridOriginX + ldr.x * cell;
        const ly = gridOriginY + ldr.y * cell;
        minimapCtx.fillStyle = '#e2ceb4';
        minimapCtx.fillRect(lx, ly, cell, cell);
        minimapCtx.strokeStyle = '#000000';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(lx, ly, cell, cell);
    }

    if (cameraView.w < WORLD_WIDTH - 2 || cameraView.h < WORLD_HEIGHT - 2) {
        minimapCtx.strokeStyle = 'rgba(230, 212, 188, 0.35)';
        minimapCtx.lineWidth = 0.8;
        minimapCtx.strokeRect(
            gridOriginX + (cameraView.x / TILE_SIZE) * cell,
            gridOriginY + (cameraView.y / TILE_SIZE) * cell,
            (cameraView.w / TILE_SIZE) * cell,
            (cameraView.h / TILE_SIZE) * cell
        );
    }

    const legY = gridOriginY + mapH + 13;
    minimapCtx.font = '9px Crimson Pro, serif';
    minimapCtx.fillStyle = '#e2ceb4'; minimapCtx.fillText('■ Order', pad, legY);
    minimapCtx.fillStyle = '#a8383b'; minimapCtx.fillText('■ Foe', pad + 42, legY);
    minimapCtx.fillStyle = '#d8c2a6'; minimapCtx.fillText('■ Chest', pad + 75, legY);
    minimapCtx.fillStyle = '#79a6cf'; minimapCtx.fillText('■ Site', pad + 116, legY);
    minimapCtx.fillStyle = '#78ab8c'; minimapCtx.fillText('■ Stairs', pad + 148, legY);

    minimapCtx.restore();
}

function drawGame() {
    if (!ctx || typeof map === 'undefined' || map.length === 0) return;

    syncCanvasViewport();
    updateCameraFollow();

    const scaleX = canvas.width / cameraView.w;
    const scaleY = canvas.height / cameraView.h;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, -cameraView.x * scaleX, -cameraView.y * scaleY);
    // Match exact Fog of War darkness (#060504) so outer cavern void is 100% seamless with the dungeon
    ctx.fillStyle = '#060504';
    ctx.fillRect(cameraView.x - 48, cameraView.y - 48, cameraView.w + 96, cameraView.h + 96);

    if (screenShakeMag > 0.15) {
        const shakeX = (Math.random() - 0.5) * 2 * screenShakeMag;
        const shakeY = (Math.random() - 0.5) * 2 * screenShakeMag;
        ctx.translate(shakeX, shakeY);
    }

    const biome = getCurrentBiome();
    const activeActor = getCurrentActor();
    const currentLeader = getLeader();
    const dynamicLights = [];

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!revealed[y] || !revealed[y][x]) {
                ctx.fillStyle = '#070607';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                continue;
            }
            drawRealisticFloor(ctx, x, y, biome.id, dynamicLights);
        }
    }

    drawRealisticDecals(ctx);

    if (revealed[stairs.y] && revealed[stairs.y][stairs.x]) {
        drawRealisticStairs(ctx, stairs.x, stairs.y, isFloorCleared(), torchFlickerPhase, dynamicLights);
    }

    traps.forEach(t => {
        if (revealed[t.y] && revealed[t.y][t.x] && (t.detected || t.triggered)) {
            drawPropMiniature(ctx, 'trap', t.x, t.y, { trapType: t.type, triggered: t.triggered }, torchFlickerPhase);
        }
    });

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (revealed[y] && revealed[y][x] && map[y][x] >= 1) {
                drawRealisticWall(ctx, x, y, map[y][x], biome.id, torchFlickerPhase, dynamicLights);
            }
        }

        chests.forEach(c => {
            if (c.y === y && revealed[c.y] && revealed[c.y][c.x]) {
                drawPropMiniature(ctx, 'chest', c.x, c.y, { opened: c.opened }, torchFlickerPhase);
                if (!c.opened) {
                    dynamicLights.push({
                        x: c.x * TILE_SIZE + 24, y: c.y * TILE_SIZE + 24,
                        r: 52, color: 'rgba(199, 174, 145, 0.12)', cutout: 0.28
                    });
                }
            }
        });

        lootDrops.forEach(d => {
            if (d.y === y && revealed[d.y] && revealed[d.y][d.x]) {
                drawPropMiniature(ctx, 'loot', d.x, d.y, { category: d.category }, torchFlickerPhase);
            }
        });

        if (merchant && merchant.y === y && revealed[merchant.y] && revealed[merchant.y][merchant.x]) {
            drawPropMiniature(ctx, 'merchant', merchant.x, merchant.y, {}, torchFlickerPhase);
            dynamicLights.push({
                x: merchant.x * TILE_SIZE + 34, y: merchant.y * TILE_SIZE + 16,
                r: 105, color: 'rgba(255, 200, 75, 0.22)', cutout: 0.62
            });
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e2ceb4';
            ctx.font = '700 10px Almendra, Cinzel, serif';
            ctx.fillText("CARAVAN", merchant.x * TILE_SIZE + 24, merchant.y * TILE_SIZE - 10);
            ctx.restore();
        }

        if (shrine && shrine.y === y && revealed[shrine.y] && revealed[shrine.y][shrine.x]) {
            drawPropMiniature(ctx, 'shrine', shrine.x, shrine.y, { used: shrine.used }, torchFlickerPhase);
            if (!shrine.used) {
                dynamicLights.push({
                    x: shrine.x * TILE_SIZE + 24, y: shrine.y * TILE_SIZE + 16,
                    r: 115, color: 'rgba(120, 210, 240, 0.22)', cutout: 0.68
                });
            }
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = shrine.used ? '#8c7d6e' : '#9ec8ed';
            ctx.font = '700 10px Almendra, Cinzel, serif';
            ctx.fillText(shrine.used ? "DEPLETED" : "SHRINE", shrine.x * TILE_SIZE + 24, shrine.y * TILE_SIZE - 12);
            ctx.restore();
        }

        if (campfire && campfire.y === y && revealed[campfire.y] && revealed[campfire.y][campfire.x]) {
            drawPropMiniature(ctx, 'campfire', campfire.x, campfire.y, { used: campfire.used }, torchFlickerPhase);
            if (!campfire.used) {
                dynamicLights.push({
                    x: campfire.x * TILE_SIZE + 24, y: campfire.y * TILE_SIZE + 24,
                    r: 135 + Math.sin(torchFlickerPhase * 2.5) * 8,
                    color: 'rgba(255, 145, 38, 0.28)', cutout: 0.78
                });
            }
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = campfire.used ? '#8c7d6e' : '#e2ceb4';
            ctx.font = '700 10px Almendra, Cinzel, serif';
            ctx.fillText(campfire.used ? "ASHES" : "HEARTH", campfire.x * TILE_SIZE + 24, campfire.y * TILE_SIZE - 6);
            ctx.restore();
        }

        enemies.forEach((e, eIdx) => {
            if (e.y !== y || !revealed[e.y] || !revealed[e.y][e.x]) return;
            const inCurrentBattle = (gameMode === 'COMBAT' && typeof activeEnemies !== 'undefined' && activeEnemies.includes(e));
            const cx = e.x * TILE_SIZE + TILE_SIZE / 2 + (e.stepOffsetX || 0) + (e.animOffsetX || 0);
            const baseY = e.y * TILE_SIZE + TILE_SIZE - 6 + (e.stepOffsetY || 0) + (e.animOffsetY || 0);
            const bobY = Math.sin(torchFlickerPhase * 1.3 + eIdx * 1.7) * 1.5 + (e.stepBounceY || 0);
            const eFacing = (currentLeader && e.x > currentLeader.x) ? -1 : 1;

            drawSoftGroundShadow(ctx, cx, baseY + 1, e.isBoss ? 21 : 15, e.isBoss ? 8 : 6);

            if (e.isBoss || e.affix) {
                ctx.save();
                ctx.strokeStyle = e.color || '#c7ae91';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, e.isBoss ? 21 : 17, e.isBoss ? 8 : 6.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                if (e.isBoss) {
                    dynamicLights.push({ x: cx, y: baseY - 18, r: 95, color: 'rgba(215, 75, 85, 0.16)', cutout: 0.50 });
                }
            }

            if (gameMode === 'COMBAT' && e === activeEnemy) {
                ctx.save();
                ctx.strokeStyle = '#79a6cf';
                ctx.lineWidth = 2.0;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 23, 9, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            if (gameMode === 'COMBAT' && activeActor === e) {
                ctx.save();
                ctx.strokeStyle = '#a8383b';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 19, 7, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            drawEnemyFigure(ctx, e, cx, baseY + bobY, torchFlickerPhase + eIdx, e.hitFlash || null, eFacing);

            if (e.isBoss || e.affix || e.hp < e.maxHp || inCurrentBattle) {
                const barW = e.isBoss ? 48 : 36;
                const barX = cx - barW / 2;
                const barY = baseY - (e.isBoss ? 66 : 52) + bobY;
                const hpPercent = Math.max(0, e.hp / e.maxHp);

                // Sleek spear-pointed diegetic enemy health bar
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(barX, barY);
                ctx.lineTo(barX + barW - 3, barY);
                ctx.lineTo(barX + barW, barY + 2);
                ctx.lineTo(barX + barW - 3, barY + 4);
                ctx.lineTo(barX, barY + 4);
                ctx.closePath();
                ctx.fillStyle = 'rgba(10, 8, 10, 0.85)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(199, 174, 145, 0.48)';
                ctx.lineWidth = 0.7;
                ctx.stroke();

                if (hpPercent > 0) {
                    const fw = Math.max(2, (barW - 1) * hpPercent);
                    ctx.fillStyle = e.isBoss ? '#d4af5f' : '#b8373a';
                    ctx.fillRect(barX + 0.5, barY + 0.5, fw, 3);
                }
                ctx.restore();
            }

            if (typeof hasBestiaryMastery === 'function' && hasBestiaryMastery(e)) {
                ctx.save();
                ctx.fillStyle = '#e2ceb4';
                ctx.font = 'bold 9px Almendra, Cinzel, serif';
                ctx.fillText('◆', cx + 14, baseY - 40);
                ctx.restore();
            }
        });

        for (let i = party.length - 1; i >= 0; i--) {
            const p = party[i];
            if (p.hp <= 0 || p.y !== y) continue;

            const cx = p.x * TILE_SIZE + TILE_SIZE / 2 + (p.stepOffsetX || 0) + (p.animOffsetX || 0);
            const baseY = p.y * TILE_SIZE + TILE_SIZE - 6 + (p.stepOffsetY || 0) + (p.animOffsetY || 0);
            const bobY = Math.sin(torchFlickerPhase * 1.2 + i * 1.3) * 1.1 + (p.stepBounceY || 0);
            const hFacing = (gameMode === 'COMBAT' && activeEnemy)
                ? (activeEnemy.x < p.x ? -1 : 1)
                : (p.facing || 1);

            drawSoftGroundShadow(ctx, cx, baseY + 1, 16, 6);

            if (gameMode === 'COMBAT' && activeActor === p) {
                ctx.save();
                ctx.strokeStyle = '#e2ceb4';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 20, 7.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            drawHeroFigure(ctx, p.role, cx, baseY + bobY, torchFlickerPhase + i, 1.0, p.hitFlash || null, hFacing);

            if (p === currentLeader && typeof drawHeldTorch === 'function') {
                drawHeldTorch(ctx, cx, baseY + bobY, hFacing, torchLight, torchFlickerPhase);
            }

            if (p === currentLeader) {
                ctx.save();
                ctx.fillStyle = '#e2ceb4';
                ctx.beginPath();
                ctx.moveTo(cx, baseY - 49 + bobY);
                ctx.lineTo(cx - 3.5, baseY - 53 + bobY);
                ctx.lineTo(cx + 3.5, baseY - 53 + bobY);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
    }

    drawAttackVFX(dynamicLights);
    updateAndDrawAmbientParticles();

    impactRings.forEach(r => {
        const cx = r.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = r.y * TILE_SIZE + TILE_SIZE / 2 - 4;
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });

    drawFeatheredFogAndDynamicLighting(ctx, biome.id, currentLeader, torchLight, torchFlickerPhase, dynamicLights);

    if (typeof floatingPopups !== 'undefined') {
        floatingPopups.forEach(pop => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, pop.alpha);
            const px = pop.x * TILE_SIZE + TILE_SIZE / 2 + (pop.offsetX || 0);
            const py = pop.y * TILE_SIZE - 10 + (pop.offsetY || 0);
            ctx.translate(px, py);
            const sc = pop.scale || 1.0;
            ctx.scale(sc, sc);

            const popSize = pop.size || 16;
            ctx.font = `700 ${popSize}px Almendra, Cinzel, serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.94)';
            ctx.strokeText(pop.text, 0, 0);
            ctx.fillStyle = pop.color;
            ctx.fillText(pop.text, 0, 0);
            ctx.restore();
        });
    }

    drawHoverCursor();
    drawScreenSpaceOverlays();
    ctx.restore();

    drawMiniMapRadar();
}

// =========================================================
// SEED MODAL, SAVE ARCHIVES, HOVER TOOLTIP, PAUSE & SHAKE
// =========================================================
function promptSetSeed() {
    toggleDialogById('seed-modal', () => {
        const inp = document.getElementById('seed-input-field');
        if (inp) inp.value = (typeof runSeed !== 'undefined' && runSeed) ? runSeed : '';
    });
}

function applySeedPreset(mode) {
    if (mode === 'daily') {
        const d = new Date();
        setRunSeed(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    } else {
        setRunSeed(null);
        addLog('Mode normal aktif: tata letak ruang bawah tanah kembali acak.');
    }
    closeDialogById('seed-modal');
    updateUI();
}

function submitSeedModal(e) {
    if (e) e.preventDefault();
    const inp = document.getElementById('seed-input-field');
    const v = inp ? inp.value.trim() : '';
    if (v.toLowerCase() === 'daily') {
        applySeedPreset('daily');
        return;
    }
    if (v === '') {
        applySeedPreset('random');
        return;
    }
    setRunSeed(v);
    closeDialogById('seed-modal');
    updateUI();
}

function toggleSaveSlotModal() {
    toggleDialogById('save-slot-modal', renderSaveSlotModal);
}

function renderSaveSlotModal() {
    const el = document.getElementById('save-slot-list');
    if (!el) return;
    let html = '';
    for (let i = 1; i <= 3; i++) {
        const raw = localStorage.getItem('endless_dungeon_save_v2_slot_' + i);
        let info = 'Empty Archive';
        if (raw) {
            try {
                const s = JSON.parse(raw);
                let partyInfo = '';
                if (s.party && s.party.length) {
                    const avgLv = Math.round(s.party.reduce((a, p) => a + (p.level || 1), 0) / s.party.length);
                    const totalHp = s.party.reduce((a, p) => a + (p.hp || 0), 0);
                    const totalMax = s.party.reduce((a, p) => a + (p.maxHp || 0), 0);
                    partyInfo = ` · HP ${totalHp}/${totalMax} · Lv~${avgLv}`;
                }
                info = `Floor ${s.currentFloor || '?'} · Asc ${s.ascensionLevel || 0}${partyInfo}`;
            } catch (e) { info = 'Corrupted Seal'; }
        }
        const active = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot === i) ? ' <span style="color:#92c4a4;">(Active)</span>' : '';
        html += `
        <div class="bag-item-row">
            <div><b>Archive Slot ${i}${active}</b><div class="item-buff-text">${info}</div></div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-use" onclick="saveToSlot(${i})">Inscribe</button>
                <button type="button" class="btn-small-equip" onclick="loadFromSlot(${i})">Restore</button>
                <button type="button" class="btn-small-unequip" onclick="deleteSlot(${i})">Erase</button>
            </div>
        </div>`;
    }
    el.innerHTML = html;
}

function saveToSlot(n) {
    if (typeof saveGameProgress === 'function') saveGameProgress(n);
    renderSaveSlotModal();
    updateUI();
}

function loadFromSlot(n) {
    const raw = localStorage.getItem('endless_dungeon_save_v2_slot_' + n);
    if (!raw) { addLog(`Archive Slot ${n} masih kosong.`); return; }
    if (typeof loadGameProgress === 'function' && loadGameProgress(n)) {
        activeSaveSlot = n;
        addLog(`Memulihkan ekspedisi dari Archive Slot ${n}.`);
        closeDialogById('save-slot-modal');
        updateModeUI();
        updateUI();
        drawGame();
    }
}

function deleteSlot(n) {
    localStorage.removeItem('endless_dungeon_save_v2_slot_' + n);
    if (activeSaveSlot === n) activeSaveSlot = null;
    renderSaveSlotModal();
    addLog(`Catatan pada Archive Slot ${n} telah dihapus.`);
}

function exportSave() {
    const ta = document.getElementById('save-io-text');
    if (!ta) return;
    const key = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot)
        ? ('endless_dungeon_save_v2_slot_' + activeSaveSlot)
        : 'endless_dungeon_save_v2';
    ta.value = localStorage.getItem(key) || '';
    addLog('Data ekspedisi diekspor ke kotak teks JSON.');
}

function importSave() {
    const ta = document.getElementById('save-io-text');
    if (!ta || !ta.value.trim()) return;
    try {
        const obj = JSON.parse(ta.value.trim());
        const key = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot)
            ? ('endless_dungeon_save_v2_slot_' + activeSaveSlot)
            : 'endless_dungeon_save_v2';
        localStorage.setItem(key, JSON.stringify(obj));
        loadGameProgress(activeSaveSlot);
        closeDialogById('save-slot-modal');
        updateModeUI();
        updateUI();
        drawGame();
        addLog('Data ekspedisi berhasil diimpor dan dimuat.');
    } catch (e) {
        addLog('Format JSON tidak valid: ' + e.message);
    }
}

function updateHoverTooltipHtml(clientX, clientY) {
    const el = document.getElementById('hover-tooltip');
    const container = document.getElementById('canvas-container');
    if (!el || !container) return;

    const t = canvasToTile(clientX, clientY);
    if (!t || !t.inside) {
        el.classList.remove('visible');
        el.innerHTML = '';
        return;
    }

    const hx = Math.max(0, Math.min(COLS - 1, t.x));
    const hy = Math.max(0, Math.min(ROWS - 1, t.y));
    const isRevealed = !!(revealed[hy] && revealed[hy][hx]);
    if (!isRevealed) {
        el.classList.remove('visible');
        el.innerHTML = '';
        return;
    }

    let title = null, sub = null, badgeColor = '#e2ceb4';
    const en = enemies.find(e => e.x === hx && e.y === hy && e.hp > 0);
    const ch = chests.find(c => c.x === hx && c.y === hy && !c.opened);
    const tr = traps.find(tp => tp.x === hx && tp.y === hy && (tp.detected || tp.triggered));
    const hr = party.find(p => p.x === hx && p.y === hy && p.hp > 0);

    if (en) {
        const mastered = (typeof hasBestiaryMastery === 'function' && hasBestiaryMastery(en)) ? ' · Mastered (+10%)' : '';
        title = `${en.name}${mastered}`;
        sub = `HP ${en.hp}/${en.maxHp} · ATK ${en.atk} · DEF ${en.def} · SPD ${en.spd}${en.bossSkillName ? ` · Art: ${en.bossSkillName}` : ''}`;
        badgeColor = en.isBoss ? '#e2ceb4' : '#cf5b64';
    } else if (merchant && merchant.x === hx && merchant.y === hy) {
        title = 'Wandering Caravan';
        sub = 'Hampiri untuk membeli perbekalan, bijih Damaskus, dan zirah tempaan.';
        badgeColor = '#e2ceb4';
    } else if (shrine && shrine.x === hx && shrine.y === hy) {
        title = 'Shrine of the Old Gods';
        sub = shrine.used ? 'Energi monolit ini telah habis.' : 'Hampiri untuk mengucap sumpah persembahan atau tantangan Elite.';
        badgeColor = '#8eb5d9';
    } else if (campfire && campfire.x === hx && campfire.y === hy) {
        title = 'Sanctuary Hearth';
        sub = campfire.used ? 'Bara api unggun telah padam.' : 'Hampiri untuk beristirahat (+45% HP/MP), mengasah bilah, atau menempa obor.';
        badgeColor = '#c78d44';
    } else if (ch) {
        title = 'Ironbound Coffer';
        sub = 'Berisi Zirah, Gold, atau Damascus Ore. Waspadai peluang Cursed Mimic.';
        badgeColor = '#e2ceb4';
    } else if (map[hy][hx] === 2) {
        title = 'Fractured Masonry';
        sub = 'Tabrak dinding retak ini untuk menjebol ruang simpanan rahasia (Secret Vault).';
        badgeColor = '#e2ceb4';
    } else if (hx === stairs.x && hy === stairs.y) {
        title = isFloorCleared() ? 'Descending Stairwell (Unsealed)' : 'Iron Portcullis (Sealed)';
        sub = isFloorCleared()
            ? `Melangkah ke sini untuk turun menuju Lantai ${currentFloor + 1}.`
            : `Tumpas sisa ${enemies.length} musuh di lantai ini untuk membuka segel gerbang.`;
        badgeColor = isFloorCleared() ? '#92c4a4' : '#cf5b64';
    } else if (tr) {
        title = `Floor Mechanism (${tr.type.toUpperCase()})`;
        sub = tr.triggered ? 'Mekanisme jebakan sudah tidak aktif.' : 'Jebakan terdeteksi. Ksatria dengan SPD ≥ 15 dapat menjinakkannya otomatis.';
        badgeColor = '#cf5b64';
    } else if (hr) {
        const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(hr) : { roman: 'I' };
        title = `${hr.name} · Lv.${hr.level} ${hr.role} (Rank ${form.roman})`;
        let extra = '';
        if (typeof getHeroActiveSets === 'function') {
            const sc = getHeroActiveSets(hr);
            const setNames = Object.keys(sc).map(k => (EQUIPMENT_SETS[k] ? `${EQUIPMENT_SETS[k].name} ${sc[k]}pc` : k)).join(', ');
            if (setNames) extra += ` · ${setNames}`;
        }
        sub = `HP ${hr.hp}/${hr.maxHp} · MP ${hr.mp}/${hr.maxMp} · Overdrive ${hr.overdrive || 0}%${extra}`;
        badgeColor = '#e2ceb4';
    }

    if (!title) {
        el.classList.remove('visible');
        el.innerHTML = '';
        return;
    }

    el.innerHTML = `<div class="ht-title" style="color:${badgeColor};">${title}</div><div class="ht-sub">${sub}</div>`;
    el.classList.add('visible');

    const crect = container.getBoundingClientRect();
    let x = clientX - crect.left + 14;
    let y = clientY - crect.top + 14;
    if (x + 370 > crect.width) x = clientX - crect.left - 370;
    if (y + 84 > crect.height) y = clientY - crect.top - 84;
    if (x < 6) x = 6;
    if (y < 6) y = 6;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
}

function togglePauseModal() {
    toggleDialogById('pause-modal');
}

function toggleScreenShake() {
    screenShakeIntensity = (screenShakeIntensity > 0) ? 0 : 1;
    const btn = document.getElementById('btn-shake-toggle');
    if (btn) btn.innerText = `Screen Impact Shake: ${screenShakeIntensity > 0 ? 'ON' : 'OFF'}`;
    addLog(screenShakeIntensity > 0 ? 'Getaran benturan kamera diaktifkan.' : 'Getaran benturan kamera dinonaktifkan.');
    updateUI();
}
