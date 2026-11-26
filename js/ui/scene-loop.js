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
        sp.vy += (sp.isDust ? -0.01 : 0.16) * dt;
        if (!sp.isDust && sp.floorY && sp.y > sp.floorY) {
            sp.y = sp.floorY;
            sp.vy *= -0.42;
            sp.vx *= 0.72;
        }
        if (sp.isDust) sp.size += 0.05 * dt;
        sp.alpha -= (sp.isDust ? 0.032 : 0.048) * dt;
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

function drawScreenSpaceOverlays() {
    const vx = cameraView.x;
    const vy = cameraView.y;
    const vw = cameraView.w;
    const vh = cameraView.h;
    const vcx = vx + vw * 0.5;
    const vcy = vy + vh * 0.5;

    const edgeVig = ctx.createRadialGradient(
        vcx, vcy, vh * 0.40,
        vcx, vcy, vw * 0.64
    );
    edgeVig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeVig.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
    ctx.fillStyle = edgeVig;
    ctx.fillRect(vx, vy, vw, vh);

    // Subtle film-grain dither pattern (single GPU fillRect pass) to eliminate 8-bit gradient banding
    if (typeof getFilmGrainTile === 'function') {
        const grain = getFilmGrainTile();
        if (!ctx._filmGrainPattern && typeof ctx.createPattern === 'function') {
            ctx._filmGrainPattern = ctx.createPattern(grain, 'repeat');
        }
        if (ctx._filmGrainPattern) {
            const ox = ((Math.floor(torchFlickerPhase * 17) % 64) + 64) % 64;
            const oy = ((Math.floor(torchFlickerPhase * 11) % 64) + 64) % 64;
            ctx.save();
            ctx.translate(vx - ox, vy - oy);
            ctx.fillStyle = ctx._filmGrainPattern;
            ctx.fillRect(0, 0, vw + 64, vh + 64);
            ctx.restore();
        }
    }

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

        const lightOriginX = currentLeader
            ? (currentLeader.x * TILE_SIZE + TILE_SIZE / 2 + (currentLeader.stepOffsetX || 0))
            : WORLD_WIDTH / 2;
        const lightOriginY = currentLeader
            ? (currentLeader.y * TILE_SIZE + TILE_SIZE / 2 - 14 + (currentLeader.stepOffsetY || 0))
            : WORLD_HEIGHT / 2;

        enemies.forEach((e, eIdx) => {
            if (e.y !== y || !revealed[e.y] || !revealed[e.y][e.x]) return;
            const inCurrentBattle = (gameMode === 'COMBAT' && typeof activeEnemies !== 'undefined' && activeEnemies.includes(e));
            const cx = e.x * TILE_SIZE + TILE_SIZE / 2 + (e.stepOffsetX || 0) + (e.animOffsetX || 0);
            const baseY = e.y * TILE_SIZE + TILE_SIZE - 6 + (e.stepOffsetY || 0) + (e.animOffsetY || 0);
            const bobY = Math.sin(torchFlickerPhase * 1.3 + eIdx * 1.7) * 1.2 + (e.stepBounceY || 0);
            const eFacing = (currentLeader && e.x > currentLeader.x) ? -1 : 1;

            if (typeof drawProjectedCastShadow === 'function') {
                drawProjectedCastShadow(ctx, cx, baseY, lightOriginX, lightOriginY, e.isBoss ? 52 : 34, e.isBoss ? 20 : 14);
            } else {
                drawSoftGroundShadow(ctx, cx, baseY + 1, e.isBoss ? 21 : 15, e.isBoss ? 8 : 6);
            }

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

            const strideAmt = (p.walkProgress && p.walkProgress > 0) ? Math.sin(p.walkProgress * Math.PI) : 0;
            if (typeof drawProjectedCastShadow === 'function' && p !== currentLeader) {
                drawProjectedCastShadow(ctx, cx, baseY, lightOriginX, lightOriginY, 38, 14);
            } else {
                drawSoftGroundShadow(ctx, cx, baseY + 1, 15, 5.8);
            }

            if (gameMode === 'COMBAT' && activeActor === p) {
                ctx.save();
                ctx.strokeStyle = 'rgba(230, 212, 188, 0.78)';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.ellipse(cx, baseY, 19, 7, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            const lightDirForHero = (p === currentLeader)
                ? -hFacing
                : (lightOriginX >= cx ? 1 : -1);
            drawHeroFigure(ctx, p.role, cx, baseY + bobY, torchFlickerPhase + i, 1.0, p.hitFlash || null, hFacing, strideAmt, {
                lunge: p.lungeProgress || 0,
                defending: !!p.defending,
                lightDir: lightDirForHero
            });

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
            const iconImg = (pop.svgKey && typeof getCombatSvgCanvasImage === 'function')
                ? getCombatSvgCanvasImage(pop.svgKey)
                : null;
            if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
                const icoSz = Math.round(popSize * 1.25);
                const approxW = (typeof ctx.measureText === 'function')
                    ? ctx.measureText(pop.text).width
                    : pop.text.length * popSize * 0.52;
                ctx.drawImage(iconImg, -approxW * 0.5 - icoSz - 3, -icoSz * 0.82, icoSz, icoSz);
            }
            ctx.strokeText(pop.text, 0, 0);
            ctx.fillStyle = pop.color;
            ctx.fillText(pop.text, 0, 0);
            ctx.restore();
        });
    }

    drawHoverCursor();
    drawScreenSpaceOverlays();
    if (typeof drawCinematicFilmGrain === 'function') {
        drawCinematicFilmGrain(ctx, cameraView.x, cameraView.y, cameraView.w, cameraView.h, torchFlickerPhase);
    }
    ctx.restore();

    drawMiniMapRadar();
}
