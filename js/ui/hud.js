function setCombatButtonSvgIcon(elId, svgKey, size = 32) {
    const el = document.getElementById(elId);
    if (!el) return;
    const cacheTag = `${svgKey}:${size}`;
    if (el._svgKey === cacheTag) return;
    el._svgKey = cacheTag;
    if (typeof combatSkillSvg === 'function') {
        el.innerHTML = combatSkillSvg(svgKey, size);
    } else if (typeof icon === 'function') {
        el.innerHTML = icon('sword', size);
    }
}

function syncHeroHotbarSkillIcons(hero) {
    if (typeof getHeroCombatIconSet !== 'function') return;
    const iconSet = getHeroCombatIconSet(hero);
    setCombatButtonSvgIcon('ico-cmd-attack', iconSet.attack, 32);
    setCombatButtonSvgIcon('ico-cmd-skill', iconSet.skill, 32);
    setCombatButtonSvgIcon('ico-cmd-skill2', iconSet.skill2, 32);
    setCombatButtonSvgIcon('ico-cmd-ult', iconSet.ult, 38);
}

function addLog(msg) {
    const logBox = document.getElementById('log-box');
    if (!logBox) return;
    const rawStr = String(msg);
    const combatIcoKey = (typeof resolveChronicleCombatSvgKey === 'function')
        ? resolveChronicleCombatSvgKey(rawStr)
        : null;
    const cleaned = rawStr
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    const bulletHtml = (combatIcoKey && typeof combatSkillSvg === 'function')
        ? `<span class="chronicle-svg-ico" aria-hidden="true">${combatSkillSvg(combatIcoKey, 15)}</span>`
        : `<span class="chronicle-bullet" aria-hidden="true">◆</span>`;
    const entry = document.createElement('div');
    entry.className = 'chronicle-entry';
    entry.innerHTML = `${bulletHtml}${cleaned}`;
    logBox.prepend(entry);
    while (logBox.children.length > 60) {
        logBox.removeChild(logBox.lastChild);
    }
}

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
        'ico-reset': ['reset', 13]
    };
    Object.entries(mapIds).forEach(([id, [name, sz]]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = icon(name, sz);
    });

    const combatMapIds = {
        'ico-cmd-ult': ['ult_default', 38],
        'ico-cmd-attack': ['atk_sword', 32],
        'ico-cmd-skill': ['skill_default', 32],
        'ico-cmd-skill2': ['skill_mastery_default', 32],
        'ico-cmd-defend': ['cmd_guard', 32],
        'ico-cmd-swap': ['cmd_shift', 32],
        'ico-cmd-item': ['cmd_potion', 32],
        'ico-cmd-revive': ['cmd_phoenix', 32],
        'ico-cmd-flee': ['cmd_retreat', 32]
    };
    Object.entries(combatMapIds).forEach(([id, [svgKey, sz]]) => {
        setCombatButtonSvgIcon(id, svgKey, sz);
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
        const exploreHero = (typeof getLeader === 'function' && getLeader()) ? getLeader() : null;
        syncHeroHotbarSkillIcons(exploreHero);
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
            syncHeroHotbarSkillIcons(activeActor);
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
