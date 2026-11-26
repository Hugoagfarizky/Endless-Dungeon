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
