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
