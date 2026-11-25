document.getElementById('btn-attack').addEventListener('click', () => executeCombatAction('attack'));
document.getElementById('btn-skill').addEventListener('click', () => executeCombatAction('skill'));
document.getElementById('btn-skill2').addEventListener('click', () => executeCombatAction('skill2'));
document.getElementById('btn-defend').addEventListener('click', () => executeCombatAction('defend'));
document.getElementById('btn-move-pos').addEventListener('click', () => executeCombatAction('reposition'));
document.getElementById('btn-ult').addEventListener('click', () => executeCombatAction('ult'));
document.getElementById('btn-item').addEventListener('click', () => executeCombatAction('item'));
document.getElementById('btn-revive').addEventListener('click', () => executeCombatAction('revive'));
document.getElementById('btn-flee').addEventListener('click', () => executeCombatAction('flee'));

// Klik di Canvas: ganti Target saat Combat, atau melangkah ke petak bersebelahan saat Eksplorasi
canvas.addEventListener('click', (e) => {
    const t = (typeof canvasToTile === 'function') ? canvasToTile(e.clientX, e.clientY) : null;
    if (!t || !t.inside) return;

    if (gameMode === 'COMBAT') {
        if (typeof activeEnemies !== 'undefined') {
            const clickedEnemy = activeEnemies.find(en => en.x === t.x && en.y === t.y && en.hp > 0);
            if (clickedEnemy) cycleCombatTarget(clickedEnemy);
        }
        return;
    }

    if (gameMode === 'EXPLORE' && !isAnyModalOpen()) {
        const ldr = getLeader();
        if (!ldr) return;
        const dx = t.x - ldr.x;
        const dy = t.y - ldr.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
            moveParty(dx, dy);
        } else if (dx !== 0 || dy !== 0) {
            // Langkah 1 petak ke arah klik
            if (Math.abs(dx) >= Math.abs(dy)) moveParty(Math.sign(dx), 0);
            else moveParty(0, Math.sign(dy));
        }
    }
});

// Kontrol Keyboard Pintar (Abaikan shortcut saat mengetik di Input / Textarea / Select)
window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const isTypingField = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable));
    if (isTypingField) return;

    if (e.key === 'Escape') {
        if (!isAnyModalOpen() && typeof togglePauseModal === 'function') {
            e.preventDefault();
            togglePauseModal();
        }
        return;
    }

    if (e.key === 'b' || e.key === 'B') { toggleBackpackModal(); return; }
    if (e.key === 'e' || e.key === 'E') { toggleEquipModal(); return; }
    if (e.key === 'c' || e.key === 'C') { toggleBestiaryModal(); return; }
    if (e.key === 'p' || e.key === 'P') { toggleSaveSlotModal(); return; }

    if (isAnyModalOpen()) return;

    if (e.key === 'm' || e.key === 'M') { toggleMiniMap(); return; }
    if (e.key === 'r' || e.key === 'R') { promptSetSeed(); return; }
    if (e.key === 'g' || e.key === 'G') { toggleAutoBattle(); return; }
    if (e.key === 'v' || e.key === 'V') { toggleGameSpeed(); return; }
    if (e.key === 'k' || e.key === 'K') { cycleAutoBattleStrategy(); return; }
    if (e.key === 't' || e.key === 'T') { cycleFormationTactic(); return; }

    if (gameMode === 'EXPLORE') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); moveParty(0, -1); }
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); moveParty(0, 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); moveParty(-1, 0); }
        else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); moveParty(1, 0); }
        else if (e.key === '4') executeCombatAction('item');
        else if (e.key === '5') executeCombatAction('revive');
    } else if (gameMode === 'COMBAT') {
        if (e.key === 'Tab') {
            e.preventDefault();
            cycleCombatTarget();
            return;
        }
        if (e.key === '1') executeCombatAction('attack');
        else if (e.key === '2') executeCombatAction('skill');
        else if (e.key === '3') executeCombatAction('defend');
        else if (e.key === '4') executeCombatAction('item');
        else if (e.key === '5') executeCombatAction('revive');
        else if (e.key === '6') executeCombatAction('ult');
        else if (e.key === '7') executeCombatAction('reposition');
        else if (e.key === '8') executeCombatAction('skill2');
        else if (e.key === '0') executeCombatAction('flee');
    }
});

function initGame() {
    if (typeof syncAudioControlsUI === 'function') syncAudioControlsUI();

    if (loadGameProgress()) {
        addLog(`💾 AUTO-LOAD BERHASIL! Melanjutkan ekspedisi di Lantai ${currentFloor} (${getCurrentBiome().name}).`);
        const leader = getLeader();
        if (leader) updateFogOfWar(leader.x, leader.y);
        updateModeUI();
        updateUI();
        drawGame();
        return;
    }

    inventory.bag.push(generateRandomEquipment(1));
    inventory.bag.push(generateRandomEquipment(1));

    addLog("Selamat datang di Endless Dungeon — pimpin Ordo Ksatriamu menembus kedalaman abadi!");
    addLog("🗺️ Pantau Radar [M] di pojok kanan atas, kelola Zirah di Armory [E], & cek Bestiary di Royal Codex [C].");

    resetPartyPosition();
    generateFloor();
    const leader = getLeader();
    if (leader) updateFogOfWar(leader.x, leader.y);
    saveGameProgress();
    updateUI();
    drawGame();
}

initGame();
