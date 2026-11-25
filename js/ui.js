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

// Mandatory fallback for browsers without native HTMLDialogElement.prototype.closedBy
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

// Reusable Gothic Confirmation Dialog
let pendingConfirmCallback = null;
function openConfirmModal(titleText, htmlMessage, confirmLabel, onConfirm) {
    const dlg = document.getElementById('confirm-modal');
    if (!dlg) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }
    const titleEl = document.getElementById('confirm-modal-title');
    const bodyEl = document.getElementById('confirm-modal-body');
    const okBtn = document.getElementById('confirm-modal-ok');
    if (titleEl) titleEl.innerText = titleText;
    if (bodyEl) bodyEl.innerHTML = htmlMessage;
    if (okBtn) okBtn.innerText = confirmLabel || 'Lanjutkan';
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
        '🔄 Reset Ekspedisi Saat Ini?',
        'Seluruh progres lantai, level party, dan isi tas pada ekspedisi ini akan diulang dari <b>Lantai 1</b>.<br><small style="color:#78e08f;">(Data Hall of Fame, Prestige, dan Bestiary Mastery di Royal Codex tetap aman permanen!)</small>',
        'Reset Ekspedisi',
        () => resetGameRun()
    );
}

function confirmPrestige() {
    if (currentFloor < 10) return;
    const nextPrest = ((typeof getPrestigeLevel === 'function') ? getPrestigeLevel() : 0) + 1;
    openConfirmModal(
        `👑 Aktifkan Prestige Lv.${nextPrest}?`,
        `Ordo Ksatria akan memulai siklus baru dari Lantai 1 dengan berkah abadi <b>+${nextPrest * 5}% Semua Atribut Permanen</b> lintas ekspedisi!`,
        `Aktifkan Prestige Lv.${nextPrest}`,
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
    if (btn) {
        btn.innerText = showMiniMap ? "🗺️ Map [M]" : "🗺️ Off [M]";
        btn.style.opacity = showMiniMap ? "1" : "0.55";
    }
    if (minimapCanvas) minimapCanvas.style.display = showMiniMap ? 'block' : 'none';
    SFX.step();
    drawGame();
}

// =========================================================
// ENGINE VISUAL MASTER 60 FPS: PARTIKEL, VFX, SHATTER & HOVER
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

function canvasToTile(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const imgAspect = WORLD_WIDTH / WORLD_HEIGHT;
    const boxAspect = rect.width / rect.height;
    let renderW, renderH, offX, offY;
    if (boxAspect > imgAspect) {
        renderH = rect.height;
        renderW = renderH * imgAspect;
        offX = (rect.width - renderW) / 2;
        offY = 0;
    } else {
        renderW = rect.width;
        renderH = renderW / imgAspect;
        offX = 0;
        offY = (rect.height - renderH) / 2;
    }
    const mx = (clientX - rect.left - offX) * (WORLD_WIDTH / renderW);
    const my = (clientY - rect.top - offY) * (WORLD_HEIGHT / renderH);
    return {
        x: Math.floor(mx / TILE_SIZE),
        y: Math.floor(my / TILE_SIZE),
        inside: (mx >= 0 && mx < WORLD_WIDTH && my >= 0 && my < WORLD_HEIGHT)
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

    // Spawn metallic / arcane impact sparks
    for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spdVal = 1.4 + Math.random() * 3.4;
        sparkParticles.push({
            x: tx, y: ty,
            vx: Math.cos(ang) * spdVal,
            vy: Math.sin(ang) * spdVal - 0.8,
            color: i % 2 === 0 ? '#fff6d6' : color,
            alpha: 1.0,
            size: 1.5 + Math.random() * 2.0
        });
    }
}

function triggerDeathShatter(tileX, tileY, baseColor = '#ff4757') {
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
            color: i % 3 === 0 ? '#fff5d6' : baseColor,
            alpha: 1.0
        });
    }
}

function triggerUltimateCutIn(actorName, ultTitle, color = '#d4af37') {
    ultimateCutIn = {
        actorName: actorName.toUpperCase(),
        ultTitle: ultTitle.toUpperCase(),
        color: color,
        alpha: 1.0,
        timer: 52
    };
}

function triggerScreenShake(intensity = 6, durationMs = 220) {
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
        color: color === "#ffffff" ? "#ff6b6b" : color,
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
        p.size = 1.2 + Math.random() * 1.8;
        p.vx = (Math.random() - 0.5) * 0.25;
        p.vy = -0.12 - Math.random() * 0.22;
        p.color = Math.random() < 0.72 ? '#f5d77f' : '#78e08f';
        p.alpha = 0.14 + Math.random() * 0.30;
    } else if (biomeId === 'ice') {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : -10;
        p.size = 1.4 + Math.random() * 2.2;
        p.vx = -0.45 - Math.random() * 0.5;
        p.vy = 0.75 + Math.random() * 0.95;
        p.color = Math.random() < 0.7 ? '#ffffff' : '#82ccdd';
        p.alpha = 0.28 + Math.random() * 0.45;
    } else if (biomeId === 'lava') {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : WORLD_HEIGHT + 10;
        p.size = 1.5 + Math.random() * 2.4;
        p.vx = (Math.random() - 0.5) * 0.45;
        p.vy = -0.65 - Math.random() * 1.05;
        p.color = Math.random() < 0.5 ? '#ff5e00' : (Math.random() < 0.5 ? '#ffa502' : '#fff2a6');
        p.alpha = 0.35 + Math.random() * 0.50;
    } else {
        p.y = randomY ? Math.random() * WORLD_HEIGHT : WORLD_HEIGHT + 10;
        p.size = 1.5 + Math.random() * 2.4;
        p.vx = (Math.random() - 0.5) * 0.38;
        p.vy = -0.35 - Math.random() * 0.65;
        p.color = Math.random() < 0.65 ? '#e056fd' : '#00ffff';
        p.alpha = 0.24 + Math.random() * 0.48;
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

        const flickerAlpha = Math.max(0.06, Math.min(0.92, p.alpha + Math.sin(p.phase * 1.5) * 0.14));
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

    // Decay screen shake smoothly
    if (screenShakeMag > 0.08) {
        screenShakeMag *= Math.pow(0.84, dt);
        if (screenShakeMag < 0.12) screenShakeMag = 0;
    }

    // Update unit lunge & hitFlash animations
    const allUnits = [...(typeof party !== 'undefined' ? party : []), ...(typeof enemies !== 'undefined' ? enemies : [])];
    allUnits.forEach(u => {
        if (!u) return;
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

    // Update Attack VFX
    attackVFXList.forEach(v => { v.progress += 0.095 * dt; });
    attackVFXList = attackVFXList.filter(v => v.progress < 1.0);

    // Update Impact Sparks
    sparkParticles.forEach(sp => {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 0.12 * dt;
        sp.alpha -= 0.055 * dt;
    });
    sparkParticles = sparkParticles.filter(sp => sp.alpha > 0);

    // Update Impact Shockwave Rings
    impactRings.forEach(r => {
        r.radius += 1.6 * dt;
        r.alpha -= 0.065 * dt;
    });
    impactRings = impactRings.filter(r => r.alpha > 0);

    // Update Death Shatter Particles
    shatterParticles.forEach(sp => {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 0.14 * dt;
        sp.alpha -= 0.035 * dt;
    });
    shatterParticles = shatterParticles.filter(sp => sp.alpha > 0);

    // Update Floating Damage / Overhead Popups
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

    // Update Ultimate Cut-In Banner
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
    if (logBox) {
        const entry = document.createElement('div');
        entry.innerHTML = `⚜️ ${msg}`;
        logBox.prepend(entry);
        while (logBox.children.length > 60) {
            logBox.removeChild(logBox.lastChild);
        }
    }
}

// =========================================================
// DIALOG 6: ROYAL CODEX — HALL OF FAME, ACHIEVEMENTS & BESTIARY
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
            <div class="slot-row" style="padding:6px 9px; border-color:${done ? '#d4af37' : '#3a2b18'}; opacity:${done ? '1' : '0.52'};">
                <div>
                    <b style="color:${done ? '#f1c40f' : '#a89984'};">${done ? '🏆' : '🔒'} ${a.name}</b>
                    <div style="font-size:11px; color:#b8a68e;">${a.desc}</div>
                </div>
                <span class="item-qty-badge" style="background:${done ? '#2b6e3f' : '#241b13'}; color:${done ? '#fff' : '#887862'};">${done ? 'TERBUKA' : 'Terkunci'}</span>
            </div>
        `;
    }).join('');

    const historyList = (hallOfFame.runHistory || []).slice(0, 5).map((r, i) => `
        <div class="slot-row" style="padding:5px 9px; font-size:11.5px;">
            <span>#${i + 1} • <b>Floor ${r.floor}</b> (Asc.${r.ascension || 0} | Prest.${r.prestige || 0})</span>
            <span style="color:#f1c40f;">💰 ${r.gold || 0}G</span>
        </div>
    `).join('') || `<div style="font-size:11.5px; color:#887862; font-style:italic; padding:4px;">Belum ada riwayat ekspedisi selesai.</div>`;

    hofEl.innerHTML = `
        <div class="slot-row">
            <span>🏰 <b>Lantai Tertinggi Dicapai:</b></span>
            <b style="color:#d4af37; font-size:14px;">Floor ${hallOfFame.highestFloor}</b>
        </div>
        <div class="slot-row">
            <span>🌟 <b>Ascension / Prestige:</b></span>
            <b style="color:#00ffff; font-size:13px;">Asc Lv.${hallOfFame.highestAscension} | Prest Lv.${hallOfFame.prestigeLevel || 0}</b>
        </div>
        <div class="slot-row">
            <span>⚔️ <b>Total Monster & Boss Gugur:</b></span>
            <b style="color:#78e08f;">${hallOfFame.totalKills} Musuh (${hallOfFame.bossKills} Boss)</b>
        </div>
        <div class="slot-row">
            <span>💰 <b>Total Emas Dikumpulkan:</b></span>
            <b style="color:#f1c40f;">${hallOfFame.totalGoldEarned} Gold</b>
        </div>
        <div class="slot-row">
            <span>📦 <b>Peti Dibuka / Titah Tuntas:</b></span>
            <b style="color:#e0c3fc;">${hallOfFame.chestsOpened || 0} Peti / ${hallOfFame.bountiesCompleted || 0} Titah</b>
        </div>
        <div class="slot-row">
            <span>📖 <b>Bestiary Mastery Terbuka:</b></span>
            <b style="color:#00ffff;">${masteredCount} / ${Object.keys(BESTIARY_CATALOG).length} Spesies</b>
        </div>
        <div class="slot-row">
            <span>🧭 <b>Total Ekspedisi:</b></span>
            <span style="color:#a89984;">Run #${hallOfFame.totalRuns || 1} (${hallOfFame.totalWipes || 0}x Wipe)</span>
        </div>
        <h3 style="margin-top:8px;">🏅 Achievements (${unlockedAch.length}/${(typeof ACHIEVEMENTS_CATALOG !== 'undefined' ? ACHIEVEMENTS_CATALOG.length : 0)})</h3>
        ${achRows}
        <h3 style="margin-top:8px;">📜 Riwayat Ekspedisi Terakhir</h3>
        ${historyList}
    `;

    bestiaryEl.innerHTML = Object.values(BESTIARY_CATALOG).map(monster => {
        const kills = hallOfFame.bestiaryKills[monster.id] || 0;
        const isDiscovered = kills > 0;
        const isMastered = kills >= monster.targetKills;
        const progressPct = Math.min(100, Math.floor((kills / monster.targetKills) * 100));

        if (!isDiscovered) {
            return `
            <div class="bag-item-row" style="opacity:0.48;">
                <div>
                    <div>❓ <b>??? (Belum Terungkap)</b> <small style="color:#9c8c74">[${monster.role}]</small></div>
                    <div class="item-buff-text" style="color:#887862;">Kalahkan makhluk ini minimal 1x di dalam dungeon untuk membuka catatan anatominya.</div>
                </div>
                <span class="item-qty-badge">0 / ${monster.targetKills}</span>
            </div>
            `;
        }

        return `
        <div class="bag-item-row" style="border-color:${isMastered ? '#d4af37' : '#473620'};">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>
                        ${monster.icon} <b style="color:${isMastered ? '#f1c40f' : '#e6dcc8'}">${monster.name}</b>
                        <small style="color:#9c8c74">[${monster.role}]</small>
                    </span>
                    <span class="item-qty-badge" style="background:${isMastered ? '#2b6e3f' : '#2e241a'}; color:${isMastered ? '#fff' : '#d4af37'};">
                        ${isMastered ? '★ MASTERED (+10% DMG)' : `Kills: ${kills}/${monster.targetKills}`}
                    </span>
                </div>
                <div style="font-size:11px; color:#c2b29b; margin-top:3px; font-style:italic;">"${monster.lore}"</div>
                <div class="hp-bar-bg" style="height:6px; margin-top:5px;">
                    <div class="hp-bar-fill" style="width:${progressPct}%; background-color:${isMastered ? '#f1c40f' : '#38ada9'};"></div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// =========================================================
// TRANSISI LANTAI DRAMATIS (GOTHIC SOULS-LIKE BANNER)
// =========================================================
const BIOME_LORE = {
    crypt: "Lorong makam kuno yang lembap, tempat tulang-belulang prajurit masa silam bangkit menjaga ruang bawah tanah.",
    ice:   "Rongga es abadi yang membekukan napas; setiap langkah di atas lantai licin mengundang bahaya kelumpuhan.",
    lava:  "Jantung perapian bumi yang membara; hawa panasnya melipatgandakan luka bakar bagi siapa pun yang lengah.",
    void:  "Jurang kehampaan tanpa dasar yang melahap cahaya obor dengan cepat, namun menyimpan pusaka legendaris."
};

function showDeathTransition(titleText = "A HERO HAS FALLEN", subtitleText = "THE PARTY HAS PERISHED") {
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
        biomeEl.innerText = '— THE ENDLESS DUNGEON —';
        biomeEl.style.color = '#ff4757';
    }
    if (loreEl) loreEl.innerText = '"Kegelapan menelan seluruh Ordo. Rekor terukir abadi di Royal Codex."';
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
        biomeEl.innerText = `— ${biome.name} —`;
        biomeEl.style.color = biome.color;
    }
    if (loreEl) loreEl.innerText = `"${BIOME_LORE[biome.id] || BIOME_LORE.crypt}"`;

    if (warnEl) {
        if (floorNum % 10 === 0) {
            warnEl.innerText = `⚠️ PERINGATAN DREAD LORD: ${roster.grand.name.toUpperCase()} MENGUASAI LANTAI INI! ⚠️`;
            warnEl.classList.remove('hidden');
        } else if (floorNum % 5 === 0) {
            warnEl.innerText = `⚠️ PERHATIAN MINI-BOSS: ${roster.mini.name.toUpperCase()} MENJAGA TANGGA! ⚠️`;
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
            .map(s => `<span style="color:#78e08f; font-weight:bold;">▲+${candidateItem.stats[s.key]} ${s.label}</span>`);
        return `<span style="color:#b8a68e; font-style:italic;">Vs Kosong:</span> ${gains.join(' ')}`;
    }

    const diffs = [];
    statMeta.forEach(s => {
        const newVal = candidateItem.stats[s.key] || 0;
        const oldVal = currentEq.stats[s.key] || 0;
        const diff = newVal - oldVal;

        if (diff > 0) {
            diffs.push(`<span style="color:#78e08f; font-weight:bold; background:#1e2d24; border:1px solid #3b7a4c; padding:1px 5px; border-radius:3px;">▲+${diff} ${s.label}</span>`);
        } else if (diff < 0) {
            diffs.push(`<span style="color:#ff6b81; font-weight:bold; background:#2d1a1a; border:1px solid #7a3b3b; padding:1px 5px; border-radius:3px;">▼${diff} ${s.label}</span>`);
        } else if (newVal > 0 && diff === 0) {
            diffs.push(`<span style="color:#9c8c74; background:#1c1612; border:1px solid #473620; padding:1px 5px; border-radius:3px;">=${s.label}</span>`);
        }
    });

    if (diffs.length === 0) {
        return `<span style="color:#9c8c74; font-style:italic;">Vs ${currentEq.name}: Stat Identik</span>`;
    }
    return `<span style="color:#d4af37; font-style:italic;">Vs Pakai (${hero.name}):</span> ${diffs.join(' ')}`;
}

function formatSetAndCurseMetaHtml(item, hero = null) {
    let html = '';
    if (item.setId && typeof EQUIPMENT_SETS !== 'undefined' && EQUIPMENT_SETS[item.setId]) {
        const s = EQUIPMENT_SETS[item.setId];
        const count = hero ? (getHeroActiveSets(hero)[item.setId] || 0) : 0;
        html += `<div style="font-size:10.5px; color:${s.color}; margin-top:2px;">
            ${s.icon} <b>Set ${s.name}</b> ${hero ? `(${count}/4 Aktif)` : ''} — <small>[2-Pc: ${s.bonus2Desc}]</small>
        </div>`;
    }
    if (item.curseId) {
        html += `
            <div style="font-size:11px; color:#ffb142; margin-top:2px; font-weight:bold;">${item.boonDesc}</div>
            <div class="curse-drawback-text">${item.curseDesc}</div>
        `;
    }
    return html;
}

// ==========================================
// DIALOG 5: CAMPFIRE / REST SITE
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
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "⛺ RESTED!", "#2ecc71");
            addLog(`🔥 PERKEMAHAN: Seluruh Ksatria pulih +45% HP/MP & Obor menyala 100%!`);
        } else {
            if (ldr) addOverheadIcon(ldr.x, ldr.y, "🌾 FAMINE!", "#b85d19");
            addLog(`🌾 PERKEMAHAN: Kutukan Famine mencegah pemulihan HP, namun Obor menyala 100%.`);
        }
    }
    else if (actionType === 'sharpen') {
        sharpenedBuff = true;
        party.forEach(p => { if (p.hp > 0) p.overdrive = Math.min(100, (p.overdrive || 0) + 50); });
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "⚔️ +25% DMG & OD!", "#ffcc00");
        addLog(`🔥 BATU ASAH: Bilah pedang & tongkat diberkati! +25% DMG & +50% Overdrive!`);
    }
    else if (actionType === 'scout') {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) revealed[y][x] = true;
        }
        traps.forEach(t => t.detected = true);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🦅 MAP REVEALED!", "#00ffff");
        addLog(`🔥 PENGINTAIAN: Seluruh lorong kastil, musuh, dan jebakan di lantai ini terpetakan!`);
    }
    else if (actionType === 'upgrade_torch') {
        const costOre = 3;
        const costGold = 50;
        if (inventory.ore < costOre || inventory.gold < costGold) {
            addLog(`❌ Butuh ${costOre} Ore & ${costGold} Gold untuk meningkatkan Obor Abadi!`);
            return;
        }
        inventory.ore -= costOre;
        inventory.gold -= costGold;
        torchUpgradeLevel = (torchUpgradeLevel || 0) + 1;
        torchLight = 100;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, '🔥 TORCH UP!', '#f1c40f');
        addLog(`🔥 OBOR ABADI LV.${torchUpgradeLevel}: Konsumsi obor per langkah berkurang & obor terisi penuh!`);
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
                <b>⛺ Rest by the Embers (Peristirahatan Ksatria)</b>
                <div class="item-buff-text">Pulihkan +45% Max HP & MP seluruh Party, sembuhkan racun/debuff, & Obor 100%.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseCampfireAction('rest')">Istirahat</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>🗡️ Whetstone & Prayer (Asah Senjata & Doa Perang)</b>
                <div class="item-buff-text">Berikan +25% Damage pada pertarungan berikutnya & +50% Overdrive semua Ksatria!</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#b85d19;" onclick="chooseCampfireAction('sharpen')">Asah Senjata</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>🦅 Falcon Recon (Intai Lorong Kastil)</b>
                <div class="item-buff-text">Buka seluruh Fog of War di lantai ini & perlihatkan semua lokasi Jebakan (Trap)!</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#225c85;" onclick="chooseCampfireAction('scout')">Intai Map</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>🔥 Brazier Torch Upgrade (Lv.${torchUpgradeLevel || 0} → Lv.${(torchUpgradeLevel || 0) + 1})</b>
                <div class="item-buff-text">Kurangi konsumsi obor per langkah secara permanen & isi penuh Obor. Biaya: 3 Ore + 50 Gold.</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#8c5818;" ${!canUpgradeTorch ? 'disabled' : ''} onclick="chooseCampfireAction('upgrade_torch')">Tempa Obor</button>
        </div>
    `;
}

// ==========================================
// DIALOG 4: MYSTERIOUS SHRINE / ALTAR
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
        if (ldr) { updateFogOfWar(ldr.x, ldr.y); addOverheadIcon(ldr.x, ldr.y, "☀️ BLESSED!", "#f1c40f"); }
        addLog("⛩️ Altar terlalu sempit untuk memanggil penjaga. Berkah Cahaya diberikan sebagai gantinya.");
        return;
    }

    const guardians = [];
    for (let i = 0; i < 2; i++) {
        const pos = free[i];
        const hp = Math.floor((70 + currentFloor * 20) * ascMult);
        const g = {
            name: `⛩️ Altar Guardian ${i + 1} [Lv.${currentFloor}]`,
            x: pos.x, y: pos.y, hp, maxHp: hp,
            atk: Math.floor((11 + currentFloor * 3) * ascMult),
            def: 3 + Math.floor(currentFloor * 0.9),
            spd: 12 + Math.floor(currentFloor / 3) + i,
            color: "#8e44ad", isEnemy: true, isBoss: false, bossTier: 0,
            isElite: true, affix: null,
            statuses: { burn: 0, stun: 0, break: 0 }
        };
        revealed[pos.y][pos.x] = true;
        enemies.push(g);
        guardians.push(g);
        addOverheadIcon(pos.x, pos.y, "⚔️ PENJAGA ALTAR!", "#8e44ad");
    }
    addLog("⛩️ TANTANGAN ALTAR! Dua Altar Guardian (Elite) bangkit! Kalahkan untuk loot Epic dijamin.");
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
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🩸+CURSED RELIC!", "#ff4757");
        addLog(`⛩️ SUMPAH DARAH: Mengorbankan 30% darah Ksatria & memperoleh pusaka [${legGear.name}]!`);
    }
    else if (optionType === 'wisdom') {
        const wisdomCost = 40 + (currentFloor * 10);
        if (inventory.gold < wisdomCost) {
            addLog(`❌ Butuh minimal ${wisdomCost} Gold untuk persembahan Altar Kebijaksanaan!`);
            return;
        }
        inventory.gold -= wisdomCost;
        gainPartyXP(75 + currentFloor * 15, ldr);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "✨+ANCIENT EXP!", "#00ffff");
        addLog(`⛩️ ALTAR KEBIJAKSANAAN: Mempersembahkan ${wisdomCost} Koin Emas untuk pengetahuan kuno!`);
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
            addOverheadIcon(ldr.x, ldr.y, "☀️ BLESSED!", "#f1c40f");
        }
        addLog(`⛩️ BERKAH CAHAYA: Obor 100%, seluruh Ksatria pulih +30 HP, +25 MP & bebas kutukan!`);
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
        addLog('⛩️ SHRINE OF MEMORY: Seluruh Ksatria hidup menerima +1 Stat Point kuno!');
        if (ldr) addOverheadIcon(ldr.x, ldr.y, '📘 +1 STAT PARTY!', '#00ffff');
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
                <b>🩸 Blood Tithe (Korbankan 30% HP Party)</b>
                <div class="item-buff-text">Hadiah: Dijamin 1x Cursed Relic (Pusaka Terkutuk) atau Zirah Epic/Legendary ke Peti Zirah!</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#8f241b;" onclick="chooseShrineBlessing('blood')">Korbankan</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>📘 Tribute of Kings (Bayar ${wisdomCost} Gold)</b>
                <div class="item-buff-text">Hadiah: Seluruh Ksatria menerima limpahan EXP kuno secara instan!</div>
            </div>
            <button type="button" class="btn-small-use" ${inventory.gold < wisdomCost ? 'disabled' : ''} onclick="chooseShrineBlessing('wisdom')">Persembahkan</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>☀️ Grace of the Cathedral (Gratis)</b>
                <div class="item-buff-text">Hadiah: Obor penuh 100%, pulihkan +30 HP, +25 MP & sucikan semua racun/debuff.</div>
            </div>
            <button type="button" class="btn-small-use" onclick="chooseShrineBlessing('radiance')">Berdoa</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>⚔️ Trial of the Altar (Tantang 2 Elite)</b>
                <div class="item-buff-text">Panggil 2 Altar Guardian (Elite). Kalahkan keduanya untuk loot Epic dijamin + Ore!</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#6c3483;" onclick="chooseShrineBlessing('trial')">Tantang</button>
        </div>
        <div class="bag-item-row">
            <div>
                <b>🔮 Shrine of Memory (Ingatan Ksatria Silam)</b>
                <div class="item-buff-text">Seluruh Ksatria yang hidup langsung memperoleh +1 Stat Point bebas alokasi!</div>
            </div>
            <button type="button" class="btn-small-use" style="background:#225c85;" onclick="chooseShrineBlessing('memory')">Kenang</button>
        </div>
    `;
}

// =========================================================================
// DIALOG 3: WANDERING MERCHANT
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
        { id: 'potion', name: "🧪 Herbal Draught", desc: "Memulihkan +35 HP & menyembuhkan status Poison Party.", cost: calcPrice(20, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'energy_potion', name: "⚡ Mana Vial", desc: "Memulihkan +30 Energi (MP) ke seluruh anggota Party.", cost: calcPrice(25, 5), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'torch_oil', name: "🔥 Pitch Torch Oil", desc: "Mengisi ulang cahaya Obor (Torch) +60% agar jarak pandang terang.", cost: calcPrice(15, 4), stock: 2, maxStock: 2, type: 'consumable' },
        { id: 'forge_ore', name: "⚒️ Damascus Iron Ore (x2)", desc: "2x Bijih Besi Tempa untuk menaikkan level (+1, +2) Zirah Ksatria.", cost: calcPrice(30, 6), stock: 2, maxStock: 2, type: 'ore' },
        { id: 'revive', name: "🪶 Phoenix Relic", desc: "Membangkitkan 1 Ksatria yang gugur dengan 50% Max HP.", cost: calcPrice(60, 8), stock: 1, maxStock: 1, type: 'consumable' },
        {
            id: 'specific_gear_1',
            name: `${EQUIP_SLOTS[gear1.slot].icon} ${gear1.name}`,
            rarity: gear1.rarity, slotLabel: EQUIP_SLOTS[gear1.slot].label,
            desc: `Stat Zirah: ${formatItemBuffs(gear1.stats)}`,
            cost: getGearPrice(gear1), stock: 1, maxStock: 1, type: 'specific_gear', gearData: gear1
        },
        {
            id: 'specific_gear_2',
            name: `${EQUIP_SLOTS[gear2.slot].icon} ${gear2.name}`,
            rarity: gear2.rarity, slotLabel: EQUIP_SLOTS[gear2.slot].label,
            desc: `Stat Zirah: ${formatItemBuffs(gear2.stats)}`,
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
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "🛍️+Item", "#2ecc71");
    } else if (item.type === 'ore') {
        inventory.ore += 2;
        if (ldr) addOverheadIcon(ldr.x, ldr.y, "⚒️+2 Ore", "#00d2ff");
        addLog(`🛍️ PEDAGANG: Membeli +2x ⚒️ Damascus Iron Ore seharga ${item.cost} Gold!`);
    } else if (item.type === 'specific_gear' && item.gearData) {
        const g = item.gearData;
        inventory.bag.push(g);
        if (ldr) addOverheadIcon(ldr.x, ldr.y, `${EQUIP_SLOTS[g.slot].icon}+Gear`, "#9b59b6");
        addLog(`🛍️ PEDAGANG: Membeli zirah ${EQUIP_SLOTS[g.slot].icon} [${g.name}] ke Peti Zirah [E]!`);
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
    addLog(`🔄 PEDAGANG: Stok dagangan diperbarui (biaya ${cost} Gold).`);
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
        const slotTag = item.slotLabel ? `<small style="color:#9c8c74">[${item.slotLabel}]</small>` : '';
        const stockBadge = isSoldOut
            ? `<span class="item-qty-badge" style="background:#5c1916; color:#ff7675;">HABIS</span>`
            : `<span class="item-qty-badge">Stok: ${item.stock}/${item.maxStock}</span>`;

        const extraMeta = (item.type === 'specific_gear' && item.gearData)
            ? `${formatSetAndCurseMetaHtml(item.gearData, previewHero)}<div style="font-size:11px; margin-top:2px;">${formatStatDiffHtml(item.gearData, previewHero)}</div>`
            : '';

        return `
        <div class="bag-item-row" style="opacity:${isSoldOut ? '0.45' : '1'};">
            <div>
                <div><b ${titleClass}>${item.name}</b> ${slotTag} ${stockBadge}</div>
                <div class="item-buff-text">${item.desc}</div>
                ${extraMeta}
                <div style="font-size:11px; color:#f1c40f; margin-top:2px;">💰 Harga Lantai ${currentFloor}: <b>${item.cost} Gold</b></div>
            </div>
            <button type="button" class="btn-small-use" ${!canAfford ? 'disabled' : ''} onclick="buyMerchantItem(${idx})">
                ${isSoldOut ? 'Terjual' : 'Beli'}
            </button>
        </div>
        `;
    }).join('');

    const rerollCost = 35 + currentFloor * 8;
    const rerollRow = `
        <div class="bag-item-row" style="border-top:1px solid rgba(212,175,55,0.3); margin-top:8px;">
            <div>
                <b>🔄 Minta Dagangan Baru</b>
                <div class="item-buff-text">${merchant.rerolled ? '<b>Sudah dipakai di pedagang ini.</b>' : `Ganti seluruh stok lantai ini (sekali per pedagang). Biaya: ${rerollCost} Gold.`}</div>
            </div>
            <button type="button" class="btn-small-use" ${(merchant.rerolled || inventory.gold < rerollCost) ? 'disabled' : ''} onclick="rerollMerchantStock()">
                ${merchant.rerolled ? 'Sudah Reroll' : `Reroll (${rerollCost}G)`}
            </button>
        </div>
    `;

    const sellRows = inventory.bag.length === 0
        ? `<div class="bag-item-row"><div class="item-buff-text">Peti zirah kosong — tidak ada yang bisa dijual.</div></div>`
        : inventory.bag.map((item, idx) => {
            const icon = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].icon) ? EQUIP_SLOTS[item.slot].icon : '📦';
            const slotLabel = (EQUIP_SLOTS[item.slot] && EQUIP_SLOTS[item.slot].label) ? EQUIP_SLOTS[item.slot].label : item.slot;
            const up = item.upgradeLevel ? ` +${item.upgradeLevel}` : '';
            return `
            <div class="bag-item-row">
                <div>
                    <b class="rarity-${item.rarity || 'Common'}">${icon} ${item.name}</b> <small style="color:#9c8c74">[${slotLabel}${up}]</small>
                    <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                </div>
                <button type="button" class="btn-small-use" style="background:#7f6a2d;" onclick="sellBagItem(${idx})">Jual +${getItemSellValue(item)}G</button>
            </div>
            `;
        }).join('');

    listEl.innerHTML += `
        ${rerollRow}
        <div class="bag-item-row" style="border-top:1px solid rgba(212,175,55,0.3); margin-top:6px;">
            <div><b>💰 Jual Zirah dari Peti Zirah</b><div class="item-buff-text">Tukarkan equipment cadangan menjadi Koin Emas (≈45% nilai lantai).</div></div>
        </div>
        ${sellRows}
    `;
}

// ==========================================
// DIALOG 1: BACKPACK CONSUMABLES
// ==========================================
function toggleBackpackModal() {
    toggleDialogById('backpack-modal', renderBackpackModal);
}

function renderBackpackModal() {
    const listEl = document.getElementById('backpack-items-list');
    if (!listEl) return;
    const keys = Object.keys(CONSUMABLE_CATALOG).filter(k => (inventory.consumables[k] || 0) > 0);

    if (keys.length === 0) {
        listEl.innerHTML = `<div style="color:#887862; font-style:italic; padding:18px; text-align:center;">Satchel kosong. Kalahkan monster, buka peti harta, atau kunjungi Pedagang Kelana!</div>`;
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
            <button type="button" class="btn-small-use" ${isEnemyTurn ? 'disabled' : ''} onclick="useBackpackItem('${key}')">Gunakan</button>
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
                <span>${p.name} (Lv.${p.level})</span>
            </button>
            `;
        }).join('');
    }

    const pts = hero.statPoints;
    const btnHtml = (stat, label) => pts > 0
        ? `<button type="button" class="btn-small-use" style="padding:2px 6px; font-size:10px; margin-left:3px;" onclick="allocateStatPoint(${selectedHeroIndex}, '${stat}')">+${label}</button>`
        : '';

    const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(hero) : { posNumber: selectedHeroIndex + 1, roleLabel: 'FRONT' };

    document.getElementById('modal-hero-title').innerHTML = `
        Ksatria: ${hero.name} [Pos ${form.posNumber} ${form.roleLabel}] — EXP: ${hero.xp}/${hero.maxXp}
        ${pts > 0 ? `<span style="color:#78e08f; margin-left:6px;">[+${pts} Stat Pt!]</span>` : ''}
    `;

    document.getElementById('modal-hero-stats').innerHTML = `
        <span>❤️HP:<b>${hero.maxHp}</b>${btnHtml('hp','12')}</span>
        <span>⚡MP:<b>${hero.maxMp}</b>${btnHtml('mp','8')}</span>
        <span>🗡️P.ATK:<b>${hero.patk}</b>${btnHtml('patk','2')}</span>
        <span>🔮M.ATK:<b>${hero.matk}</b>${btnHtml('matk','2')}</span>
        <span>🛡️DEF:<b>${hero.def}</b>${btnHtml('def','2')}</span>
        <span>🥾SPD:<b>${hero.spd}</b>${btnHtml('spd','1')}</span>
    `;

    const setCounts = getHeroActiveSets(hero);
    const activeSetBadges = Object.keys(setCounts).map(sKey => {
        const s = EQUIPMENT_SETS[sKey];
        const cnt = setCounts[sKey];
        const b2 = cnt >= 2 ? `<b style="color:#78e08f">[2-Pc Aktif: ${s.bonus2Desc}]</b>` : `<small style="color:#887862">(Butuh 2-Pc)</small>`;
        const b4 = cnt >= 4 ? ` <b style="color:#00ffff">[4-Pc Aktif: ${s.bonus4Desc}]</b>` : '';
        return `<div style="margin-top:2px;"><span style="color:${s.color}">${s.icon} <b>${s.name} (${cnt}/4):</b></span> ${b2}${b4}</div>`;
    }).join('');

    const perkEl = document.getElementById('modal-hero-perks');
    const activePerkNames = (hero.perks || []).map(k => PERK_CATALOG[k] ? PERK_CATALOG[k].name : k).join(', ') || 'Belum ada';
    const perkBtns = Object.values(PERK_CATALOG).map(pk => {
        const owned = hero.perks && hero.perks.includes(pk.id);
        return `<button type="button" class="btn-small-equip" style="background:${owned ? '#2b6e3f' : '#4a235a'}; opacity:${(owned || hero.perkPoints > 0) ? '1' : '0.45'};"
            ${(owned || hero.perkPoints <= 0) ? 'disabled' : ''}
            title="${pk.desc}" onclick="unlockHeroPerk(${selectedHeroIndex}, '${pk.id}')">
            ${owned ? '✔ ' : ''}${pk.name}
        </button>`;
    }).join('');

    const masteryBtns = Object.values(MASTERY_CATALOG).map(m => {
        const owned = hero.mastery && hero.mastery.includes(m.id);
        return `<button type="button" class="btn-small-equip" style="background:${owned ? '#2b6e3f' : '#3a2452'}; opacity:${(owned || hero.perkPoints > 0) ? '1' : '0.45'};"
            ${(owned || (hero.perkPoints || 0) <= 0) ? 'disabled' : ''}
            title="${m.desc}" onclick="unlockMastery(${selectedHeroIndex}, '${m.id}')">
            ${owned ? '✔ ' : ''}${m.name}
        </button>`;
    }).join('');
    const activeMastery = (hero.mastery || []).map(k => MASTERY_CATALOG[k].name).join(', ') || 'Belum ada';

    perkEl.innerHTML = `
        <div>🌟 <b>Knightly Vows (Perks):</b> <span style="color:#f1c40f">${activePerkNames}</span>
        ${hero.perkPoints > 0 ? `<b style="color:#00ffff; margin-left:6px;">(${hero.perkPoints} Perk Point!)</b>` : `<small style="color:#9c8c74">(Tiap Lv. Ganjil)</small>`}</div>
        <div class="perk-btn-row">${perkBtns}</div>
        <div style="margin-top:6px; border-top:1px dashed #523e24; padding-top:4px;">
            🎯 <b>Mastery (Skill Tree):</b> <span style="color:#f1c40f">${activeMastery}</span>
            <div class="perk-btn-row">${masteryBtns}</div>
        </div>
        ${activeSetBadges ? `<div style="border-top:1px dashed #523e24; margin-top:5px; padding-top:4px;">${activeSetBadges}</div>` : ''}
    `;

    const runeEl = document.getElementById('modal-hero-runes');
    if (runeEl) {
        const runes = hero.runes || [];
        const charm = hero.charm;
        let html = charm
            ? `<div>✨ <b>Charm:</b> <span style="color:#d7bde2;">${charm.name}</span> <small style="color:#9c8c74">(${charm.desc})</small></div>`
            : `<div>✨ <b>Charm:</b> <small style="color:#9c8c74">Belum ada (Drop dari Boss).</small></div>`;
        if (runes.length === 0) {
            html += `<div>🔮 <b>Rune:</b> <small style="color:#9c8c74">Belum ada (Drop dari Elite/Boss).</small></div>`;
        } else {
            const list = runes.map(k => {
                const r = (typeof RUNE_CATALOG !== 'undefined') ? RUNE_CATALOG[k] : null;
                return r ? `<span style="color:#d7bde2; margin-right:6px;" title="${r.desc}">🔮 ${r.name}</span>` : k;
            }).join('');
            html += `<div>🔮 <b>Rune (${runes.length}):</b> ${list}</div>`;
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
            <div class="slot-row" style="${eqItem.curseId ? 'border-color:#ff4757;' : ''}">
                <div>
                    <div>
                        ${slotMeta.icon} <b>${slotMeta.label}:</b>
                        <span class="rarity-${eqItem.rarity}">${eqItem.name} ${upgLv > 0 ? `<b style="color:#00ffff">+${upgLv}</b>` : ''}</span>
                    </div>
                    <div class="item-buff-text">${formatItemBuffs(eqItem.stats)}</div>
                    ${formatSetAndCurseMetaHtml(eqItem, hero)}
                </div>
                <div style="display:flex; gap:5px;">
                    <button type="button" class="btn-small-use" style="background:#1e5f8a;" ${!canForge ? 'disabled' : ''}
                        title="Tempa: Butuh ${costOre} Ore & ${costGold} Gold"
                        onclick="upgradeEquippedItem(${selectedHeroIndex}, '${slotKey}')">
                        ⬆️Tempa (${costOre}⚒️ ${costGold}G)
                    </button>
                    <button type="button" class="btn-small-unequip" onclick="unequipItemFromHero(${selectedHeroIndex}, '${slotKey}')">Lepas</button>
                </div>
            </div>
            `;
        }
        return `
        <div class="slot-row" style="opacity:0.58;">
            <div>${slotMeta.icon} <b>${slotMeta.label}:</b> <i>(Kosong)</i></div>
            <span style="color:#666; font-size:11px;">—</span>
        </div>
        `;
    }).join('');

    const bagEl = document.getElementById('bag-items-list');
    if (inventory.bag.length === 0) {
        bagEl.innerHTML = '<div style="color:#887862; font-style:italic; padding:12px;">Peti Zirah kosong.</div>';
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
        bagEl.innerHTML = '<div style="color:#887862; font-style:italic; padding:12px;">Tidak ada item yang cocok dengan filter.</div>';
        return;
    }

    bagEl.innerHTML = indexed.map(o => {
        const item = o.item;
        const bagIdx = o.bagIdx;
        const slotMeta = EQUIP_SLOTS[item.slot];
        const upgLv = item.upgradeLevel || 0;
        const diffHtml = formatStatDiffHtml(item, hero);
        return `
        <div class="bag-item-row" style="${item.curseId ? 'border-color:#ff4757;' : ''}">
            <div>
                <div>${slotMeta.icon} <span class="rarity-${item.rarity}">${item.name}${upgLv > 0 ? ' +' + upgLv : ''}</span> <small style="color:#9c8c74">[${slotMeta.label}]</small></div>
                <div class="item-buff-text">${formatItemBuffs(item.stats)}</div>
                ${formatSetAndCurseMetaHtml(item, hero)}
                <div style="font-size:11px; margin-top:4px; padding:3px 6px; background:#140f0a; border:1px solid #3a2a18; border-radius:4px;">${diffHtml}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-equip" onclick="equipItemToHero(${bagIdx}, ${selectedHeroIndex})">Pasang</button>
                <button type="button" class="btn-small-unequip" title="Lebur jadi Forge Ore & Gold" onclick="dismantleBagItem(${bagIdx})">Lebur</button>
            </div>
        </div>`;
    }).join('');
}

// =========================================================
// HUD & TURN QUEUE RENDERER
// =========================================================
function updateTurnQueueUI() {
    const queueEl = document.getElementById('turn-queue-list');
    const roundLbl = document.getElementById('round-counter-label');
    const movePosLbl = document.getElementById('lbl-move-pos');
    const movePosBtn = document.getElementById('btn-move-pos');
    const skill2Btn  = document.getElementById('btn-skill2');
    const skill2Lbl  = document.getElementById('lbl-skill2');

    if (gameMode !== 'COMBAT' || turnQueue.length === 0) {
        if (roundLbl) roundLbl.innerHTML = `⏳ BATTLE ORDER:`;
        const clearHint = !isFloorCleared()
            ? `⚔️ Tumpas sisa ${enemies.length} makhluk kegelapan untuk membuka Gerbang Tangga! ${sharpenedBuff ? '🔥[+25% DMG Aktif]' : ''}`
            : `🚪 AREA CLEAR! Gerbang tangga kuno telah terbuka — segera turun ke lantai berikutnya!`;
        queueEl.innerHTML = `<span class="queue-empty" style="color:${isFloorCleared() ? '#78e08f' : '#d4af37'}">${clearHint}</span>`;
        document.getElementById('active-actor-name').innerText = '-';
        document.getElementById('lbl-skill').innerText = '✨ Primary Art';
        if (skill2Lbl) skill2Lbl.innerText = '🌟 Mastery Art (Lv.5)';
        if (skill2Btn) skill2Btn.disabled = true;
        document.getElementById('lbl-ult').innerText = '💥 Ultimate Art (100% OD)';
        if (movePosLbl) movePosLbl.innerText = '🔄 Reposition (Tukar Barisan)';
        if (movePosBtn) movePosBtn.disabled = true;
        document.getElementById('btn-ult').disabled = true;
        return;
    }

    if (roundLbl && typeof combatRound !== 'undefined') {
        const isEnrage = combatRound >= 8;
        const comboTxt = (typeof comboCounter !== 'undefined' && comboCounter > 1) ? ` • 🔥x${comboCounter}` : '';
        roundLbl.innerHTML = isEnrage
            ? `<span style="color:#ff4757">😡 RONDE ${combatRound} (ENRAGE!)${comboTxt}:</span>`
            : `⏳ RONDE ${combatRound}/7${comboTxt}:`;
    }

    const activeActor = getCurrentActor();
    if (activeActor) {
        document.getElementById('active-actor-name').innerText = activeActor.isEnemy
            ? `${activeActor.name}`
            : `${activeActor.name} (${activeActor.dmgType})`;

        if (!activeActor.isEnemy) {
            const actualCost = (typeof getEffectiveSkillCost === 'function')
                ? getEffectiveSkillCost(activeActor, activeActor.skillCost)
                : activeActor.skillCost;
            const actualCost2 = (typeof getEffectiveSkillCost === 'function')
                ? getEffectiveSkillCost(activeActor, activeActor.skill2Cost || 15)
                : (activeActor.skill2Cost || 15);

            const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(activeActor) : { isFront: true };
            const moveDirText = form.isFront ? "Mundur ke Backline" : "Maju ke Frontline";

            document.getElementById('lbl-skill').innerText = `✨ ${activeActor.skillName} (${actualCost} MP)`;
            if (skill2Lbl) {
                skill2Lbl.innerText = activeActor.level >= 5
                    ? `🌟 ${activeActor.skill2Name} (${actualCost2} MP)`
                    : `🔒 ${activeActor.skill2Name} (Butuh Lv.5)`;
            }
            if (skill2Btn) skill2Btn.disabled = (activeActor.level < 5);

            document.getElementById('lbl-attack').innerText = `⚔️ Strike (${activeActor.dmgType})`;
            if (movePosLbl) movePosLbl.innerText = `🔄 Reposition (${moveDirText})`;
            document.getElementById('lbl-ult').innerText = `💥 ${activeActor.ultName} (${activeActor.overdrive || 0}% OD)`;
            document.getElementById('btn-ult').disabled = ((activeActor.overdrive || 0) < 100);
        } else {
            document.getElementById('btn-ult').disabled = true;
            if (skill2Btn) skill2Btn.disabled = true;
            if (movePosBtn) movePosBtn.disabled = true;
        }
    }

    queueEl.innerHTML = turnQueue.map((unit, idx) => {
        const isCurrent = (idx === turnIndex);
        const isSelectedTarget = (unit.isEnemy && unit === activeEnemy);
        const badgeClass = `turn-badge ${isCurrent ? 'active-turn' : ''} ${unit.isEnemy ? 'enemy-turn' : ''}`;
        const icon = unit.isEnemy ? (isSelectedTarget ? '🎯' : (unit.isBoss ? '👑' : '💀')) : '⚜️';
        const arrow = idx < turnQueue.length - 1 ? `<span class="turn-arrow">➔</span>` : '';
        const enemyIdx = unit.isEnemy ? activeEnemies.indexOf(unit) : -1;
        const clickAttr = (unit.isEnemy && enemyIdx >= 0)
            ? `style="cursor:pointer; ${isSelectedTarget ? 'border:1.5px solid #00ffff;' : ''}" title="Klik untuk jadikan Target" onclick="cycleCombatTarget(activeEnemies[${enemyIdx}])"`
            : '';

        return `
            <div class="${badgeClass}" ${clickAttr}>
                <span style="color:${unit.color}">${icon}</span>
                <span>${unit.name} <small>(${unit.hp}HP)</small></span>
            </div>
            ${arrow}
        `;
    }).join('');
}

function updateUI() {
    const biome = getCurrentBiome();
    const biomeEl = document.getElementById('biome-badge');
    if (biomeEl) {
        biomeEl.innerText = biome.name;
        biomeEl.style.color = biome.color;
    }

    const roster = (typeof BIOME_BOSS_ROSTER !== 'undefined' && BIOME_BOSS_ROSTER[biome.id])
        ? BIOME_BOSS_ROSTER[biome.id]
        : null;

    let floorSuffix = "";
    if (currentFloor % 10 === 0) {
        floorSuffix = roster ? ` (${roster.grand.name})` : " (🐉 DREAD LORD)";
    } else if (currentFloor % 5 === 0) {
        floorSuffix = roster ? ` (${roster.mini.name})` : " (👹 WARDEN)";
    }

    let modSuffix = "";
    if (typeof floorModifier !== 'undefined' && floorModifier) {
        const modIcons = { blood_moon:'🌑', famine:'🌾', gilded:'💰', darkness:'🕯️', silence:'🤫' };
        modSuffix = ` ${modIcons[floorModifier] || ''}`;
    }
    document.getElementById('current-floor').innerText = currentFloor + floorSuffix + modSuffix;

    const seedBadge = document.getElementById('run-seed-badge');
    if (seedBadge) seedBadge.innerText = (typeof runSeed !== 'undefined' && runSeed) ? runSeed : 'Acak';

    const prestBadge = document.getElementById('prestige-badge');
    if (prestBadge && typeof getPrestigeLevel === 'function') prestBadge.innerText = `Lv.${getPrestigeLevel()}`;

    const speedBtn = document.getElementById('btn-speed-menu');
    if (speedBtn) speedBtn.innerText = '⏩ x' + (typeof gameSpeed !== 'undefined' ? gameSpeed : 1) + ' [V]';
    const autoBtn = document.getElementById('btn-autobattle-menu');
    if (autoBtn) {
        const isAuto = (typeof autoBattle !== 'undefined' && autoBattle);
        autoBtn.style.color = isAuto ? '#78e08f' : '#f39c12';
        autoBtn.style.borderColor = isAuto ? '#2ecc71' : '#e67e22';
    }
    const stratBtn = document.getElementById('btn-strategy-menu');
    if (stratBtn) stratBtn.innerText = '🎯 ' + (typeof autoBattleStrategy !== 'undefined' ? autoBattleStrategy.toUpperCase() : 'BALANCED') + ' [K]';
    const tacticBtn = document.getElementById('btn-tactic-menu');
    if (tacticBtn) tacticBtn.innerText = '⚔️ ' + (typeof formationTactic !== 'undefined' ? formationTactic.toUpperCase() : 'BALANCED') + ' [T]';

    document.getElementById('ascension-badge').innerText = `Lv.${ascensionLevel}`;
    document.getElementById('torch-count').innerText = `${torchLight}%`;
    document.getElementById('torch-count').style.color = torchLight > 25 ? '#ff9f43' : '#ff4757';
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
        if (syn.def) parts.push(`+${syn.def}DEF`);
        if (syn.patk) parts.push(`+${syn.patk}ATK`);
        if (syn.spd) parts.push(`+${syn.spd}SPD`);
        synEl.innerText = parts.length > 0 ? `✨ ${parts.join(' ')}` : '✨ Tiada Sinergi';
    }

    const bountyEl = document.getElementById('bounty-badge');
    if (bountyEl && typeof floorBounty !== 'undefined' && floorBounty) {
        if (floorBounty.completed) {
            bountyEl.innerHTML = `📜 Titah: <span style="color:#78e08f">✔ TUNTAS!</span>`;
        } else if (floorBounty.failed) {
            bountyEl.innerHTML = `📜 Titah: <span style="color:#ff5252">✖ GAGAL</span>`;
        } else {
            bountyEl.innerHTML = `📜 ${floorBounty.desc} (${floorBounty.progress}/${floorBounty.target}) [🎁${floorBounty.rewardGold}G +${floorBounty.rewardOre}⚒️]`;
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

    const list = document.getElementById('party-list');
    list.innerHTML = party.map((p, idx) => {
        const hpPercent = Math.max(0, Math.floor((p.hp / p.maxHp) * 100));
        const mpPercent = Math.max(0, Math.floor((p.mp / p.maxMp) * 100));
        const odPercent = Math.min(100, p.overdrive || 0);
        const barColor = hpPercent > 50 ? '#2ecc71' : (hpPercent > 25 ? '#f1c40f' : '#e74c3c');
        const leaderBadge = (p === currentLeader) ? '👑 ' : '';
        const isMyTurn = (gameMode === 'COMBAT' && activeActor === p);
        const totalPts = (p.statPoints || 0) + (p.perkPoints || 0);
        const pointBadge = totalPts > 0 ? `<span style="color:#78e08f; font-weight:bold;">[+${totalPts}Pt]</span>` : '';
        const avatarUrl = (typeof getHeroPortraitDataURL === 'function') ? getHeroPortraitDataURL(p.role) : '';

        const form = (typeof getHeroFormationInfo === 'function')
            ? getHeroFormationInfo(p)
            : { posNumber: idx + 1, isFront: idx < 2, badgeColor: idx < 2 ? '#e67e22' : '#38ada9' };

        const swapUpBtn = (gameMode === 'EXPLORE' && idx > 0)
            ? `<button type="button" class="btn-small-unequip" style="padding:0px 4px; font-size:9px; margin-right:2px;" title="Maju 1 Barisan" onclick="event.stopPropagation(); swapPartyFormation(${idx}, ${idx - 1})">▲</button>` : '';
        const swapDownBtn = (gameMode === 'EXPLORE' && idx < party.length - 1)
            ? `<button type="button" class="btn-small-unequip" style="padding:0px 4px; font-size:9px; margin-right:4px;" title="Mundur 1 Barisan" onclick="event.stopPropagation(); swapPartyFormation(${idx}, ${idx + 1})">▼</button>` : '';

        const eqIcons = Object.keys(EQUIP_SLOTS).map(slotKey => {
            const item = p.equipment[slotKey];
            const icon = item && item.curseId ? '💀' : EQUIP_SLOTS[slotKey].icon;
            return `<span style="opacity:${item ? '1' : '0.25'}" title="${item ? item.name : 'Kosong'}">${icon}</span>`;
        }).join(' ');

        let statusHtml = '';
        if (p.statuses) {
            if (p.statuses.poison > 0) statusHtml += `<span style="color:#78e08f">🤢${p.statuses.poison}</span>`;
            if (p.statuses.burn > 0)   statusHtml += `<span style="color:#ff5252">🔥${p.statuses.burn}</span>`;
            if (p.statuses.stun > 0)   statusHtml += `<span style="color:#00ffff">❄️Stn</span>`;
        }
        const curseId = getHeroCursedRelicId(p);
        if (curseId) statusHtml += `<span style="color:#ff4757">💀Cursed</span>`;

        const runeHtml = (p.runes && p.runes.length > 0)
            ? `<span style="color:#c56cf0; margin-left:4px;" title="${(p.runes || []).map(k => (typeof RUNE_CATALOG !== 'undefined' && RUNE_CATALOG[k]) ? RUNE_CATALOG[k].name : k).join(', ')}">🔮×${p.runes.length}</span>`
            : '';

        return `
        <div class="member-card ${isMyTurn ? 'active-turn-card' : ''}" onclick="toggleEquipModal(${idx})" style="opacity:${p.hp > 0 ? '1' : '0.42'}">
            <div class="hero-portrait-frame">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${p.role}">` : ''}
            </div>
            <div class="member-details">
                <div class="member-header">
                    <span>
                        <span style="background:${form.badgeColor}; color:#fff; padding:1px 4px; border-radius:3px; font-size:9px; margin-right:3px;">P${form.posNumber}:${form.isFront ? 'FRONT' : 'BACK'}</span>
                        <b>${leaderBadge}${p.name}</b> <small style="color:#d4af37">Lv.${p.level}</small> ${pointBadge}
                    </span>
                    <span>
                        ${swapUpBtn}${swapDownBtn}❤️${p.hp}/${p.maxHp}
                    </span>
                </div>
                <div class="hp-bar-bg">
                    <div class="hp-bar-fill" style="width:${hpPercent}%; background-color:${barColor};"></div>
                </div>
                <div class="hp-bar-bg" style="height:4px; margin-top:2px; border:none;">
                    <div class="hp-bar-fill" style="width:${mpPercent}%; background-color:#2e86de;"></div>
                </div>
                <div class="hp-bar-bg" style="height:3px; margin-top:2px; border:none;">
                    <div class="hp-bar-fill" style="width:${odPercent}%; background-color:#e84118;"></div>
                </div>
                <div style="font-size:10px; color:#b8a68e; margin-top:2px; display:flex; justify-content:space-between;">
                    <span>🗡️${p.patk} 🔮${p.matk} 🛡️${p.def} 🥾${p.spd} | <span style="color:#70a1ff">⚡${p.mp}</span> <span style="color:#ff6b81">💥${odPercent}%</span></span>
                    <span style="color:${isMyTurn ? '#f7d774' : '#887862'}">${isMyTurn ? '▶ GILIRAN!' : (p.hp > 0 ? `EXP:${p.xp}/${p.maxXp}` : '💀 Gugur')}</span>
                </div>
                <div class="mini-equip-icons">
                    <div>${eqIcons} ${runeHtml}</div>
                    <div class="status-tags">${statusHtml}</div>
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
        modeEl.innerText = 'EKSPLORASI';
        modeEl.className = 'mode-explore';
    } else if (gameMode === 'AMBUSH') {
        modeEl.innerText = '⚠️ DISERGAP!';
        modeEl.className = 'mode-combat';
    } else {
        modeEl.innerText = activeEnemy && activeEnemy.isBoss ? '🔥 BOSS COMBAT' : 'COMBAT';
        modeEl.className = 'mode-combat';
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
        document.getElementById('btn-ult').disabled = true;
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
            // Arcane / Hellfire glowing comet
            const g = ctx.createRadialGradient(currX, currY, 1, currX, currY, 13);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, v.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(currX, currY, 13, 0, Math.PI * 2);
            ctx.fill();

            if (dynamicLights) {
                dynamicLights.push({ x: currX, y: currY, r: 95, color: 'rgba(255, 160, 220, 0.22)', cutout: 0.65 });
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
    ctx.strokeStyle = 'rgba(245, 208, 97, 0.78)';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(hx * TILE_SIZE + 2, hy * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    ctx.restore();
}

function drawScreenSpaceOverlays() {
    // Subtle dark cinematic edge vignette
    const edgeVig = ctx.createRadialGradient(
        WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.42,
        WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.62
    );
    edgeVig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeVig.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Low-HP Heartbeat Vignette
    const alive = party.filter(p => p.hp > 0);
    if (alive.length > 0) {
        const avgHpRatio = alive.reduce((sum, p) => sum + (p.hp / p.maxHp), 0) / alive.length;
        if (avgHpRatio < 0.32) {
            const pulse = 0.20 + Math.abs(Math.sin(torchFlickerPhase * 0.9)) * 0.25;
            const redGrad = ctx.createRadialGradient(
                WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.25,
                WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH * 0.65
            );
            redGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            redGrad.addColorStop(1, `rgba(180, 10, 20, ${pulse})`);
            ctx.fillStyle = redGrad;
            ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        }
    }

    // Ultimate Cut-In Banner
    if (ultimateCutIn) {
        ctx.save();
        ctx.globalAlpha = ultimateCutIn.alpha;
        const cy = WORLD_HEIGHT / 2 - 40;

        const bGrad = ctx.createLinearGradient(0, cy, WORLD_WIDTH, cy);
        bGrad.addColorStop(0, 'rgba(8, 5, 4, 0.72)');
        bGrad.addColorStop(0.5, 'rgba(24, 14, 10, 0.95)');
        bGrad.addColorStop(1, 'rgba(8, 5, 4, 0.72)');
        ctx.fillStyle = bGrad;
        ctx.fillRect(0, cy, WORLD_WIDTH, 80);

        ctx.strokeStyle = ultimateCutIn.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(WORLD_WIDTH, cy);
        ctx.moveTo(0, cy + 80); ctx.lineTo(WORLD_WIDTH, cy + 80);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 13px Cinzel, serif';
        ctx.fillText(`⚜️ OVERDRIVE UNLEASHED — ${ultimateCutIn.actorName} ⚜️`, WORLD_WIDTH / 2, cy + 27);

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = ultimateCutIn.color;
        ctx.shadowBlur = 14;
        ctx.font = 'bold 27px Cinzel, serif';
        ctx.fillText(`💥 ${ultimateCutIn.ultTitle} 💥`, WORLD_WIDTH / 2, cy + 58);
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
    const mapW = COLS * cell;
    const mapH = ROWS * cell;
    const boxW = minimapCanvas.width;
    const boxH = minimapCanvas.height;

    const gridOriginX = pad;
    const gridOriginY = headerH;
    const biome = getCurrentBiome();

    minimapCtx.save();
    minimapCtx.fillStyle = 'rgba(10, 8, 6, 0.88)';
    minimapCtx.fillRect(0, 0, boxW, boxH);

    minimapCtx.fillStyle = '#d4af37';
    minimapCtx.font = 'bold 9.5px Cinzel, serif';
    minimapCtx.fillText(`🗺️ F${currentFloor} • ${biome.name}`, pad, 14);

    minimapCtx.textAlign = 'right';
    minimapCtx.fillStyle = isFloorCleared() ? '#2ecc71' : '#ff6b81';
    minimapCtx.fillText(isFloorCleared() ? '🚪OPEN' : `⚔️${enemies.length}`, boxW - pad, 14);
    minimapCtx.textAlign = 'left';

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = gridOriginX + x * cell;
            const py = gridOriginY + y * cell;

            if (!revealed[y] || !revealed[y][x]) {
                minimapCtx.fillStyle = 'rgba(4, 3, 2, 0.95)';
                minimapCtx.fillRect(px, py, cell, cell);
                continue;
            }
            if (map[y][x] === 1) {
                minimapCtx.fillStyle = biome.wallTop || '#4a4a5a';
                minimapCtx.fillRect(px, py, cell, cell);
            } else if (map[y][x] === 2) {
                minimapCtx.fillStyle = '#f39c12';
                minimapCtx.fillRect(px, py, cell, cell);
            } else {
                minimapCtx.fillStyle = 'rgba(48, 40, 32, 0.88)';
                minimapCtx.fillRect(px, py, cell - 0.5, cell - 0.5);
            }
        }
    }

    traps.forEach(t => {
        if (revealed[t.y] && revealed[t.y][t.x] && (t.detected || t.triggered)) {
            minimapCtx.fillStyle = '#eb2f06';
            minimapCtx.fillRect(gridOriginX + t.x * cell + 2, gridOriginY + t.y * cell + 2, cell - 4, cell - 4);
        }
    });

    chests.forEach(c => {
        if (!c.opened && revealed[c.y] && revealed[c.y][c.x]) {
            minimapCtx.fillStyle = '#f1c40f';
            minimapCtx.fillRect(gridOriginX + c.x * cell + 1.5, gridOriginY + c.y * cell + 1.5, cell - 3, cell - 3);
        }
    });

    lootDrops.forEach(d => {
        if (revealed[d.y] && revealed[d.y][d.x]) {
            minimapCtx.fillStyle = '#a55eea';
            minimapCtx.fillRect(gridOriginX + d.x * cell + 1.5, gridOriginY + d.y * cell + 1.5, cell - 3, cell - 3);
        }
    });

    if (merchant && revealed[merchant.y] && revealed[merchant.y][merchant.x]) {
        minimapCtx.fillStyle = '#2ecc71';
        minimapCtx.fillRect(gridOriginX + merchant.x * cell + 1, gridOriginY + merchant.y * cell + 1, cell - 2, cell - 2);
    }
    if (shrine && !shrine.used && revealed[shrine.y] && revealed[shrine.y][shrine.x]) {
        minimapCtx.fillStyle = '#00ffff';
        minimapCtx.fillRect(gridOriginX + shrine.x * cell + 1, gridOriginY + shrine.y * cell + 1, cell - 2, cell - 2);
    }
    if (campfire && !campfire.used && revealed[campfire.y] && revealed[campfire.y][campfire.x]) {
        minimapCtx.fillStyle = '#ffa502';
        minimapCtx.fillRect(gridOriginX + campfire.x * cell + 1, gridOriginY + campfire.y * cell + 1, cell - 2, cell - 2);
    }

    if ((revealed[stairs.y] && revealed[stairs.y][stairs.x]) || isFloorCleared()) {
        minimapCtx.fillStyle = isFloorCleared() ? '#2ecc71' : '#95a5a6';
        minimapCtx.fillRect(gridOriginX + stairs.x * cell, gridOriginY + stairs.y * cell, cell, cell);
        minimapCtx.strokeStyle = '#ffffff';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(gridOriginX + stairs.x * cell, gridOriginY + stairs.y * cell, cell, cell);
    }

    enemies.forEach(e => {
        if (revealed[e.y] && revealed[e.y][e.x]) {
            const ex = gridOriginX + e.x * cell;
            const ey = gridOriginY + e.y * cell;
            minimapCtx.fillStyle = e.isBoss ? (e.color || '#f1c40f') : '#ff4757';
            if (e.isBoss) minimapCtx.fillRect(ex - 0.5, ey - 0.5, cell + 1, cell + 1);
            else minimapCtx.fillRect(ex + 1, ey + 1, cell - 2, cell - 2);

            if (gameMode === 'COMBAT' && e === activeEnemy) {
                minimapCtx.strokeStyle = '#00ffff';
                minimapCtx.lineWidth = 1;
                minimapCtx.strokeRect(ex - 1, ey - 1, cell + 2, cell + 2);
            }
        }
    });

    party.forEach(p => {
        if (p.hp > 0) {
            minimapCtx.fillStyle = '#70a1ff';
            minimapCtx.fillRect(gridOriginX + p.x * cell + 1, gridOriginY + p.y * cell + 1, cell - 2, cell - 2);
        }
    });

    const ldr = getLeader();
    if (ldr) {
        const lx = gridOriginX + ldr.x * cell;
        const ly = gridOriginY + ldr.y * cell;
        minimapCtx.fillStyle = '#fffa65';
        minimapCtx.fillRect(lx, ly, cell, cell);
        minimapCtx.strokeStyle = '#000000';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(lx, ly, cell, cell);
    }

    const legY = gridOriginY + mapH + 13;
    minimapCtx.font = '9px Georgia, serif';
    minimapCtx.fillStyle = '#fffa65'; minimapCtx.fillText('■You', pad, legY);
    minimapCtx.fillStyle = '#ff4757'; minimapCtx.fillText('■Foe', pad + 35, legY);
    minimapCtx.fillStyle = '#f1c40f'; minimapCtx.fillText('■Chest', pad + 68, legY);
    minimapCtx.fillStyle = '#00ffff'; minimapCtx.fillText('■NPC', pad + 109, legY);
    minimapCtx.fillStyle = '#2ecc71'; minimapCtx.fillText('■Exit', pad + 145, legY);

    minimapCtx.restore();
}

function drawGame() {
    if (!ctx || typeof map === 'undefined' || map.length === 0) return;

    ctx.save();
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    if (screenShakeMag > 0.15) {
        const shakeX = (Math.random() - 0.5) * 2 * screenShakeMag;
        const shakeY = (Math.random() - 0.5) * 2 * screenShakeMag;
        ctx.translate(shakeX, shakeY);
    }

    const biome = getCurrentBiome();
    const activeActor = getCurrentActor();
    const currentLeader = getLeader();
    const dynamicLights = [];

    // 1. Realistic Floor Masonry + Cast Ambient Shadows
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!revealed[y] || !revealed[y][x]) {
                ctx.fillStyle = '#040302';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                continue;
            }
            drawRealisticFloor(ctx, x, y, biome.id, dynamicLights);
        }
    }

    // 2. Realistic Blood / Bone / Scorch Decals & Stairs (Sealed or Open!)
    drawRealisticDecals(ctx);

    if (revealed[stairs.y] && revealed[stairs.y][stairs.x]) {
        drawRealisticStairs(ctx, stairs.x, stairs.y, isFloorCleared(), torchFlickerPhase, dynamicLights);
    }

    // 3. Floor Traps
    traps.forEach(t => {
        if (revealed[t.y] && revealed[t.y][t.x] && (t.detected || t.triggered)) {
            drawPropMiniature(ctx, 'trap', t.x, t.y, { trapType: t.type, triggered: t.triggered }, torchFlickerPhase);
        }
    });

    // 4. Y-Sorted Painter's Algorithm for 3D Walls, Props, Monsters & Heroes
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
                        r: 52, color: 'rgba(241, 196, 15, 0.12)', cutout: 0.28
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
            ctx.fillStyle = '#ffeaa7';
            ctx.font = 'bold 9.5px Cinzel, serif';
            ctx.fillText("MERCHANT", merchant.x * TILE_SIZE + 24, merchant.y * TILE_SIZE - 10);
            ctx.restore();
        }

        if (shrine && shrine.y === y && revealed[shrine.y] && revealed[shrine.y][shrine.x]) {
            drawPropMiniature(ctx, 'shrine', shrine.x, shrine.y, { used: shrine.used }, torchFlickerPhase);
            if (!shrine.used) {
                dynamicLights.push({
                    x: shrine.x * TILE_SIZE + 24, y: shrine.y * TILE_SIZE + 16,
                    r: 115, color: 'rgba(0, 255, 255, 0.24)', cutout: 0.68
                });
            }
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = shrine.used ? '#7f8fa6' : '#7ef9ff';
            ctx.font = 'bold 9.5px Cinzel, serif';
            ctx.fillText(shrine.used ? "SHRINE (USED)" : "ANCIENT SHRINE", shrine.x * TILE_SIZE + 24, shrine.y * TILE_SIZE - 12);
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
            ctx.fillStyle = campfire.used ? '#95a5a6' : '#ffb142';
            ctx.font = 'bold 9.5px Cinzel, serif';
            ctx.fillText(campfire.used ? "RESTED" : "CAMPFIRE", campfire.x * TILE_SIZE + 24, campfire.y * TILE_SIZE - 6);
            ctx.restore();
        }

        // Monsters on row y
        enemies.forEach((e, eIdx) => {
            if (e.y !== y || !revealed[e.y] || !revealed[e.y][e.x]) return;
            const inCurrentBattle = (gameMode === 'COMBAT' && typeof activeEnemies !== 'undefined' && activeEnemies.includes(e));
            const cx = e.x * TILE_SIZE + TILE_SIZE / 2 + (e.animOffsetX || 0);
            const baseY = e.y * TILE_SIZE + TILE_SIZE - 6 + (e.animOffsetY || 0);
            const bobY = Math.sin(torchFlickerPhase * 1.3 + eIdx * 1.7) * 1.5;

            drawSoftGroundShadow(ctx, cx, baseY + 1, e.isBoss ? 21 : 15, e.isBoss ? 8 : 6);

            if (e.isBoss || e.affix) {
                ctx.save();
                ctx.strokeStyle = e.color || '#f1c40f';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, e.isBoss ? 21 : 17, e.isBoss ? 8 : 6.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                if (e.isBoss) {
                    dynamicLights.push({ x: cx, y: baseY - 18, r: 95, color: 'rgba(255, 80, 95, 0.18)', cutout: 0.50 });
                }
            }

            if (gameMode === 'COMBAT' && e === activeEnemy) {
                ctx.save();
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2.2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 23, 9, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            if (gameMode === 'COMBAT' && activeActor === e) {
                ctx.save();
                ctx.strokeStyle = '#ff4757';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 19, 7, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            drawEnemyFigure(ctx, e, cx, baseY + bobY, torchFlickerPhase + eIdx, e.hitFlash || null);

            if (e.isBoss || e.affix || e.hp < e.maxHp || inCurrentBattle) {
                const barW = e.isBoss ? 46 : 38;
                const barX = cx - barW / 2;
                const barY = e.y * TILE_SIZE - (e.isBoss ? 22 : 12) + (e.animOffsetY || 0) + bobY;
                const hpPercent = Math.max(0, e.hp / e.maxHp);

                ctx.fillStyle = 'rgba(5, 4, 3, 0.88)';
                ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
                ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
                ctx.lineWidth = 0.8;
                ctx.strokeRect(barX - 1, barY - 1, barW + 2, 7);

                ctx.fillStyle = e.color || (e.isBoss ? '#f1c40f' : '#ff4757');
                ctx.fillRect(barX, barY, Math.max(0, barW * hpPercent), 5);
            }

            if (typeof hasBestiaryMastery === 'function' && hasBestiaryMastery(e)) {
                ctx.save();
                ctx.fillStyle = '#f1c40f';
                ctx.font = 'bold 10px Cinzel, serif';
                ctx.fillText('★', cx + 14, e.y * TILE_SIZE + 6);
                ctx.restore();
            }
        });

        // Party Heroes on row y
        for (let i = party.length - 1; i >= 0; i--) {
            const p = party[i];
            if (p.hp <= 0 || p.y !== y) continue;

            const cx = p.x * TILE_SIZE + TILE_SIZE / 2 + (p.animOffsetX || 0);
            const baseY = p.y * TILE_SIZE + TILE_SIZE - 6 + (p.animOffsetY || 0);
            const bobY = Math.sin(torchFlickerPhase * 1.2 + i * 1.3) * 1.3;

            drawSoftGroundShadow(ctx, cx, baseY + 1, 16, 6);

            if (gameMode === 'COMBAT' && activeActor === p) {
                ctx.save();
                ctx.strokeStyle = '#f7d774';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 20, 7.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            drawHeroFigure(ctx, p.role, cx, baseY + bobY, torchFlickerPhase + i, 1.0, p.hitFlash || null);

            if (p === currentLeader) {
                ctx.save();
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.moveTo(cx, baseY - 49 + bobY);
                ctx.lineTo(cx - 4.5, baseY - 55 + bobY);
                ctx.lineTo(cx + 4.5, baseY - 55 + bobY);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
    }

    // 5. Combat VFX & Ambient Particles
    drawAttackVFX(dynamicLights);
    updateAndDrawAmbientParticles();

    impactRings.forEach(r => {
        const cx = r.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = r.y * TILE_SIZE + TILE_SIZE / 2 - 4;
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });

    // 6. Dynamic Volumetric Multi-Light Darkness + Feathered Fog of War
    drawFeatheredFogAndDynamicLighting(ctx, biome.id, currentLeader, torchLight, torchFlickerPhase, dynamicLights);

    // 7. Crisp Scaled Floating Damage & Status Popups (above darkness so always readable!)
    if (typeof floatingPopups !== 'undefined') {
        floatingPopups.forEach(pop => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, pop.alpha);
            const px = pop.x * TILE_SIZE + TILE_SIZE / 2 + (pop.offsetX || 0);
            const py = pop.y * TILE_SIZE - 10 + (pop.offsetY || 0);
            ctx.translate(px, py);
            const sc = pop.scale || 1.0;
            ctx.scale(sc, sc);

            const popSize = pop.size || 15;
            ctx.font = `800 ${popSize}px Cinzel, serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
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
// SEED MODAL, SAVE SLOTS, HOVER TOOLTIP, PAUSE & SHAKE
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
        addLog('🎲 Mode normal diaktifkan: tata letak lantai acak.');
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
        let info = 'Kosong';
        if (raw) {
            try {
                const s = JSON.parse(raw);
                let partyInfo = '';
                if (s.party && s.party.length) {
                    const avgLv = Math.round(s.party.reduce((a, p) => a + (p.level || 1), 0) / s.party.length);
                    const totalHp = s.party.reduce((a, p) => a + (p.hp || 0), 0);
                    const totalMax = s.party.reduce((a, p) => a + (p.maxHp || 0), 0);
                    partyInfo = ` | Party HP ${totalHp}/${totalMax} | Lv~${avgLv}`;
                }
                info = `Lantai ${s.currentFloor || '?'} | Asc ${s.ascensionLevel || 0}${partyInfo}`;
            } catch (e) { info = 'Data Rusak'; }
        }
        const active = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot === i) ? ' <span style="color:#78e08f;">(Aktif)</span>' : '';
        html += `
        <div class="bag-item-row">
            <div><b>Slot ${i}${active}</b><div class="item-buff-text">${info}</div></div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn-small-use" onclick="saveToSlot(${i})">Simpan</button>
                <button type="button" class="btn-small-use" style="background:#225c85;" onclick="loadFromSlot(${i})">Muat</button>
                <button type="button" class="btn-small-unequip" onclick="deleteSlot(${i})">Hapus</button>
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
    if (!raw) { addLog(`❌ Slot ${n} masih kosong.`); return; }
    if (typeof loadGameProgress === 'function' && loadGameProgress(n)) {
        activeSaveSlot = n;
        addLog(`📂 Berhasil memuat petualangan dari Slot ${n}.`);
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
    addLog(`🗑️ Data pada Slot ${n} telah dihapus.`);
}

function exportSave() {
    const ta = document.getElementById('save-io-text');
    if (!ta) return;
    const key = (typeof activeSaveSlot !== 'undefined' && activeSaveSlot)
        ? ('endless_dungeon_save_v2_slot_' + activeSaveSlot)
        : 'endless_dungeon_save_v2';
    ta.value = localStorage.getItem(key) || '';
    addLog('📤 Data Save berhasil diekspor ke kotak teks JSON.');
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
        addLog('📥 Data Save berhasil diimpor dan langsung dimuat!');
    } catch (e) {
        addLog('❌ Format JSON tidak valid: ' + e.message);
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

    let title = null, sub = null, badgeColor = '#d4af37';
    const en = enemies.find(e => e.x === hx && e.y === hy && e.hp > 0);
    const ch = chests.find(c => c.x === hx && c.y === hy && !c.opened);
    const tr = traps.find(tp => tp.x === hx && tp.y === hy && (tp.detected || tp.triggered));
    const hr = party.find(p => p.x === hx && p.y === hy && p.hp > 0);

    if (en) {
        const mastered = (typeof hasBestiaryMastery === 'function' && hasBestiaryMastery(en)) ? ' ★Mastered (+10% DMG)' : '';
        title = `${en.name}${mastered}`;
        sub = `❤️ HP: ${en.hp}/${en.maxHp} • 🗡️ ATK: ${en.atk} • 🛡️ DEF: ${en.def} • 🥾 SPD: ${en.spd}${en.bossSkillName ? ` • ✨ Art: ${en.bossSkillName}` : ''}`;
        badgeColor = en.color || '#ff4757';
    } else if (merchant && merchant.x === hx && merchant.y === hy) {
        title = '⚖️ Wandering Merchant (Pedagang Kelana)';
        sub = 'Hampiri untuk membeli ramuan, bijih besi Damaskus, dan zirah pilihan.';
        badgeColor = '#f1c40f';
    } else if (shrine && shrine.x === hx && shrine.y === hy) {
        title = '⛩️ Ancient Shrine (Altar Kuno)';
        sub = shrine.used ? 'Altar ini sudah digunakan.' : 'Hampiri untuk memilih berkah katedral, Sumpah Darah, atau Tantangan Elite.';
        badgeColor = '#00ffff';
    } else if (campfire && campfire.x === hx && campfire.y === hy) {
        title = '🔥 Knight Campfire (Perkemahan)';
        sub = campfire.used ? 'Api unggun telah padam.' : 'Hampiri untuk istirahat (+45% HP/MP), asah senjata, intai peta, atau tempa obor.';
        badgeColor = '#ffa502';
    } else if (ch) {
        title = '📦 Treasure Chest (Peti Harta)';
        sub = 'Berisi Zirah, Gold, atau Ore. Waspada: 18% peluang Cursed Mimic!';
        badgeColor = '#f1c40f';
    } else if (map[hy][hx] === 2) {
        title = '🧱 Cracked Castle Wall (Dinding Retak)';
        sub = 'Tabrak dinding retak ini untuk menjebol ruang simpanan rahasia (Secret Vault)!';
        badgeColor = '#f39c12';
    } else if (hx === stairs.x && hy === stairs.y) {
        title = isFloorCleared() ? '🚪 Descending Stairs (Terbuka)' : '🔒 Sealed Dungeon Gate (Terkunci)';
        sub = isFloorCleared()
            ? `Injak untuk menuruni tangga menuju Lantai ${currentFloor + 1}.`
            : `Tumpas sisa ${enemies.length} musuh di lantai ini untuk membuka segel gerbang!`;
        badgeColor = isFloorCleared() ? '#2ecc71' : '#ff6b81';
    } else if (tr) {
        title = `⚠️ Floor Trap (${tr.type.toUpperCase()})`;
        sub = tr.triggered ? 'Jebakan sudah tidak aktif.' : 'Jebakan terdeteksi! Ksatria dengan SPD ≥ 15 dapat menjinakkannya otomatis.';
        badgeColor = '#ff4757';
    } else if (hr) {
        const form = (typeof getHeroFormationInfo === 'function') ? getHeroFormationInfo(hr) : { posNumber: 1, roleLabel: 'FRONT' };
        title = `⚜️ ${hr.name} (Lv.${hr.level} ${hr.role}) — Pos ${form.posNumber}`;
        let extra = '';
        if (typeof getHeroActiveSets === 'function') {
            const sc = getHeroActiveSets(hr);
            const setNames = Object.keys(sc).map(k => (EQUIPMENT_SETS[k] ? `${EQUIPMENT_SETS[k].name} ${sc[k]}pc` : k)).join(', ');
            if (setNames) extra += ` • Set: ${setNames}`;
        }
        const curse = (typeof getHeroCursedRelicId === 'function') ? getHeroCursedRelicId(hr) : null;
        if (curse) extra += ` • Cursed`;
        if (hr.runes && hr.runes.length > 0) extra += ` • Runes: ${hr.runes.length}`;
        sub = `❤️ HP: ${hr.hp}/${hr.maxHp} • ⚡ MP: ${hr.mp}/${hr.maxMp} • 💥 OD: ${hr.overdrive || 0}%${extra}`;
        badgeColor = hr.color;
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
    if (x + 410 > crect.width) x = clientX - crect.left - 410;
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
    if (btn) btn.innerText = `📳 Screen Shake: ${screenShakeIntensity > 0 ? 'ON' : 'OFF'}`;
    addLog(screenShakeIntensity > 0 ? '📳 Efek getaran kamera (Screen Shake) DIAKTIFKAN.' : '📳 Efek getaran kamera (Screen Shake) DINONAKTIFKAN.');
    updateUI();
}
