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
