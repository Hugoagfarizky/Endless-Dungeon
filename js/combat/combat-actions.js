function applyCombatModifiers(rawDmg, dmgType, targetEnemy, actorHero = null) {
    let finalDmg = rawDmg;
    if (sharpenedBuff) finalDmg = Math.floor(finalDmg * 1.25);
    if (actorHero && typeof formationTactic !== 'undefined') {
        if (formationTactic === 'aggressive') finalDmg = Math.floor(finalDmg * 1.15);
        else if (formationTactic === 'defensive') finalDmg = Math.max(1, Math.floor(finalDmg * 0.90));
        else finalDmg = Math.floor(finalDmg * 1.05);
    }
    if (actorHero && partySynergy) {
        finalDmg += (partySynergy.patk || 0) + (partySynergy.matk || 0);
    }
    if (actorHero && comboCounter > 0) {
        finalDmg = Math.floor(finalDmg * Math.min(1.5, 1 + comboCounter * 0.05));
    }

    if (actorHero && actorHero.runes && actorHero.runes.includes('rune_crit') && rng() < 0.08) {
        finalDmg = Math.floor(finalDmg * 1.5);
        if (targetEnemy && typeof addOverheadIcon === 'function') addOverheadIcon(targetEnemy.x, targetEnemy.y, "💥CRIT!", "#f1c40f", 20);
    }
    const charmId = (typeof getHeroCharmId === "function") ? getHeroCharmId(actorHero) : null;
    if (charmId === "charm_crit" && rng() < 0.05) {
        finalDmg = Math.floor(finalDmg * 1.5);
        if (targetEnemy && typeof addOverheadIcon === "function") addOverheadIcon(targetEnemy.x, targetEnemy.y, "✨CRIT!", "#9b59b6", 20);
    }

    if (actorHero) {
        const form = getHeroFormationInfo(actorHero);
        if (form.isFront && dmgType === 'Physical') {
            finalDmg = Math.floor(finalDmg * 1.15);
        } else if (!form.isFront && actorHero.role === 'Warrior') {
            finalDmg = Math.max(2, Math.floor(finalDmg * 0.70));
        }

        if (dmgType === 'Physical' && typeof hasHeroSetBonus === 'function' && hasHeroSetBonus(actorHero, 'shadowstalker', 4)) {
            if (rng() < 0.25) {
                finalDmg = Math.floor(finalDmg * 1.60);
                if (targetEnemy) {
                    addOverheadIcon(targetEnemy.x, targetEnemy.y, "🦅 LETHAL CRIT!", "#2ecc71");
                    if (typeof addFloorDecal === 'function') addFloorDecal(targetEnemy.x, targetEnemy.y, 'blood');
                }
            }
        }
    }

    if (targetEnemy && typeof hasBestiaryMastery === 'function' && hasBestiaryMastery(targetEnemy)) {
        finalDmg = Math.floor(finalDmg * 1.10);
    }

    if (targetEnemy && targetEnemy.affix === 'armored' && dmgType === 'Physical') {
        finalDmg = Math.max(2, Math.floor(finalDmg * 0.55));
    } else if (targetEnemy && targetEnemy.affix === 'arcane' && dmgType === 'Magic') {
        finalDmg = Math.max(2, Math.floor(finalDmg * 0.55));
    }
    return finalDmg;
}

function executeCombatAction(type) {
    if (type === 'flee') { executeFlee(); return; }
    if (type === 'item') { toggleBackpackModal(); return; }
    if (gameMode === 'EXPLORE') { if (type === 'revive') useBackpackItem('revive'); return; }

    ensureValidTarget();
    const actor = getCurrentActor();
    if (gameMode !== 'COMBAT' || !activeEnemy || !actor || actor.isEnemy) return;

    const getEffDef = (en) => (en.statuses && en.statuses.break > 0) ? Math.floor((en.def || 0) * 0.4) : (en.def || 0);
    const biome = getCurrentBiome();
    const form = getHeroFormationInfo(actor);

    if (type !== 'defend') { actor.defendStreak = 0; }

    if (type === 'attack') {
        SFX.attack();
        actor.combatContrib = (actor.combatContrib || 0) + 1;
        actor.overdrive = Math.min(100, (actor.overdrive || 0) + 25);

        const baseStat = (actor.dmgType === 'Magic') ? actor.matk * 0.85 : actor.patk;
        let dmg = Math.max(2, Math.floor(baseStat * (0.85 + rng() * 0.3) - getEffDef(activeEnemy) * 0.4));
        dmg = applyCombatModifiers(dmg, actor.dmgType, activeEnemy, actor);
        activeEnemy.hp -= dmg;
        actor.combatDamageDealt = (actor.combatDamageDealt || 0) + dmg;

        if (typeof triggerAttackVFX === 'function') {
            const vfxStyle = actor.role === 'Ranger' ? 'arrow' : (actor.dmgType === 'Magic' ? 'spell' : 'slash');
            triggerAttackVFX(actor.x, actor.y, activeEnemy.x, activeEnemy.y, vfxStyle, actor.color);
        }

        triggerLunge(actor, activeEnemy.x, activeEnemy.y);
        triggerHitFlash(activeEnemy, "#ffffff");
        triggerScreenShake(4, 160);
        addOverheadIcon(activeEnemy.x, activeEnemy.y, `-${dmg}`, "#ff4757");

        const boonMsg = applyPostAttackBoons(actor, dmg);
        const posNote = (form.isFront && actor.dmgType === 'Physical') ? ' [Front +15%]' : (!form.isFront && actor.role === 'Warrior' ? ' [Back -30%]' : '');
        addLog(`🗡️ [${actor.name}] Strike${posNote} ke 🎯${activeEnemy.name}: ${dmg} DMG!${boonMsg}`);
    } 
    else if (type === 'skill') {
        const actualCost = getEffectiveSkillCost(actor, actor.skillCost);
        if (actor.mp < actualCost) {
            addLog(`❌ Energi [${actor.name}] kurang! Butuh ${actualCost} MP. Gunakan Mana Vial di Satchel [B]!`);
            return;
        }

        actor.mp -= actualCost;
        actor.combatContrib = (actor.combatContrib || 0) + 2;
        actor.overdrive = Math.min(100, (actor.overdrive || 0) + 35);
        SFX.skill();
        triggerVoidCrownBacklash(actor);

        if (actor.role === 'Warrior') {
            actor.defending = true; isTaunted = true;
            let bashDmg = Math.max(4, Math.floor(actor.patk * 1.15 + actor.def - getEffDef(activeEnemy) * 0.3));
            bashDmg = applyCombatModifiers(bashDmg, 'Physical', activeEnemy, actor);
            activeEnemy.hp -= bashDmg;
            actor.combatDamageDealt = (actor.combatDamageDealt || 0) + bashDmg;

            if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, activeEnemy.x, activeEnemy.y, 'slash', '#00ffff');
            triggerLunge(actor, activeEnemy.x, activeEnemy.y);
            triggerHitFlash(activeEnemy, "#00ffff");
            triggerScreenShake(7, 240);

            const stunChance = (biome.id === 'ice') ? 0.75 : 0.60;
            if (rng() < stunChance) {
                activeEnemy.statuses.stun = 1;
                addOverheadIcon(activeEnemy.x, activeEnemy.y, "❄️ STUNNED!", "#00ffff");
            } else {
                addOverheadIcon(activeEnemy.x, activeEnemy.y, `-${bashDmg}`, "#ff4757");
            }
            const boonMsg = applyPostAttackBoons(actor, bashDmg);
            addLog(`🛡️ [${actor.name}] Shield Bash ke 🎯${activeEnemy.name} (${bashDmg} DMG, Taunt & Stun)!${boonMsg}`);
        } 
        else if (actor.role === 'Ranger') {
            let critDmg = Math.max(6, Math.floor(actor.patk * 1.9 - getEffDef(activeEnemy) * 0.2));
            critDmg = applyCombatModifiers(critDmg, 'Physical', activeEnemy, actor);
            activeEnemy.hp -= critDmg;
            actor.combatDamageDealt = (actor.combatDamageDealt || 0) + critDmg;
            activeEnemy.statuses.break = 3;

            if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, activeEnemy.x, activeEnemy.y, 'arrow', '#f1c40f');
            if (typeof addFloorDecal === 'function') addFloorDecal(activeEnemy.x, activeEnemy.y, 'blood');
            triggerLunge(actor, activeEnemy.x, activeEnemy.y);
            triggerHitFlash(activeEnemy, "#f1c40f");
            triggerScreenShake(7, 220);
            addOverheadIcon(activeEnemy.x, activeEnemy.y, `🛡️-${critDmg}!`, "#f39c12");
            const boonMsg = applyPostAttackBoons(actor, critDmg);
            addLog(`🏹 [${actor.name}] Armor Piercer ke 🎯${activeEnemy.name}: ${critDmg} Crit DMG & DEF Hancur!${boonMsg}`);
        } 
        else if (actor.role === 'Cleric') {
            const healAmount = 18 + Math.floor(actor.matk * 0.85);
            party.forEach(p => {
                if (p.hp > 0) {
                    p.hp = Math.min(p.maxHp, p.hp + healAmount);
                    p.statuses = { poison: 0, burn: 0, stun: 0 };
                    triggerHitFlash(p, "#78e08f");
                }
            });
            addOverheadIcon(actor.x, actor.y, `✨+${healAmount} HP`, "#2ecc71");
            addLog(`✨ [${actor.name}] Holy Purify! Pulihkan +${healAmount} HP & bersihkan debuff Party!`);
        } 
        else if (actor.role === 'Control') {
            let hitCount = 0, totalAoE = 0;
            triggerLunge(actor, activeEnemy.x, activeEnemy.y);
            triggerScreenShake(8, 260);
            activeEnemies.forEach(en => {
                if (en.hp > 0) {
                    let aoeDmg = Math.max(5, Math.floor(actor.matk * 1.45 - getEffDef(en) * 0.25));
                    aoeDmg = applyCombatModifiers(aoeDmg, 'Magic', en, actor);
                    en.hp -= aoeDmg; totalAoE += aoeDmg;
                actor.combatDamageDealt = (actor.combatDamageDealt || 0) + aoeDmg;
                    en.statuses.burn = 3; en.spd = Math.max(5, en.spd - 1);
                    hitCount++;
                    if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, en.x, en.y, 'spell', '#ff4757');
                    if (typeof addFloorDecal === 'function') addFloorDecal(en.x, en.y, 'scorch');
                    triggerHitFlash(en, "#ff4757");
                    addOverheadIcon(en.x, en.y, `🔥-${aoeDmg}`, "#ff4757");
                }
            });
            const boonMsg = applyPostAttackBoons(actor, totalAoE);
            addLog(`🔮 [${actor.name}] Hellfire Blast (AoE)! Membakar ${hitCount} musuh + Burn 3 turn!${boonMsg}`);
        }
    } 
    else if (type === 'skill2') {
        if (actor.level < 5) {
            addLog(`🔒 Mastery Art [${actor.skill2Name}] baru terbuka saat ${actor.name} mencapai Level 5!`);
            return;
        }
        const actualCost2 = getEffectiveSkillCost(actor, actor.skill2Cost || 15);
        if (actor.mp < actualCost2) {
            addLog(`❌ Energi [${actor.name}] kurang! Butuh ${actualCost2} MP untuk ${actor.skill2Name}.`);
            return;
        }

        actor.mp -= actualCost2;
        actor.combatContrib = (actor.combatContrib || 0) + 2;
        actor.overdrive = Math.min(100, (actor.overdrive || 0) + 35);
        SFX.skill();
        triggerVoidCrownBacklash(actor);
        triggerLunge(actor, activeEnemy.x, activeEnemy.y);
        triggerScreenShake(8, 260);

        if (actor.role === 'Warrior') {
            let totalDealt = 0;
            activeEnemies.forEach(en => {
                if (en.hp > 0) {
                    let cleaveDmg = Math.max(5, Math.floor(actor.patk * 1.35 - getEffDef(en) * 0.25));
                    cleaveDmg = applyCombatModifiers(cleaveDmg, 'Physical', en, actor);
                    en.hp -= cleaveDmg; totalDealt += cleaveDmg;
                actor.combatDamageDealt = (actor.combatDamageDealt || 0) + cleaveDmg;
                    if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, en.x, en.y, 'slash', '#3498db');
                    triggerHitFlash(en, "#3498db");
                    addOverheadIcon(en.x, en.y, `🌪️-${cleaveDmg}`, "#3498db");
                }
            });
            const selfHeal = Math.max(4, Math.floor(totalDealt * 0.20));
            actor.hp = Math.min(actor.maxHp, actor.hp + selfHeal);
            const boonMsg = applyPostAttackBoons(actor, totalDealt);
            addLog(`🌟 [${actor.name}] Whirlwind Cleave (AoE)! Menebas seluruh musuh (${totalDealt} DMG) & pulih +${selfHeal} HP!${boonMsg}`);
        }
        else if (actor.role === 'Ranger') {
            let mainDmg = Math.max(8, Math.floor(actor.patk * 2.1 - getEffDef(activeEnemy) * 0.15));
            mainDmg = applyCombatModifiers(mainDmg, 'Physical', activeEnemy, actor);
            activeEnemy.hp -= mainDmg;
            actor.combatDamageDealt = (actor.combatDamageDealt || 0) + mainDmg;
            if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, activeEnemy.x, activeEnemy.y, 'arrow', '#2ecc71');
            triggerHitFlash(activeEnemy, "#2ecc71");
            addOverheadIcon(activeEnemy.x, activeEnemy.y, `🐍-${mainDmg}!`, "#2ecc71");

            activeEnemies.forEach(en => { if (en.hp > 0) en.statuses.poison = Math.max(en.statuses.poison || 0, 3); });
            const boonMsg = applyPostAttackBoons(actor, mainDmg);
            addLog(`🌟 [${actor.name}] Viper Volley! ${mainDmg} DMG ke 🎯${activeEnemy.name} & meracuni seluruh musuh (Poison 3t)!${boonMsg}`);
        }
        else if (actor.role === 'Cleric') {
            party.forEach(p => {
                if (p.hp > 0) {
                    p.defending = true; p.mp = Math.min(p.maxMp, p.mp + 10);
                    p.overdrive = Math.min(100, (p.overdrive || 0) + 20);
                    triggerHitFlash(p, "#f1c40f");
                }
            });
            addOverheadIcon(actor.x, actor.y, `🛡️ AEGIS!`, "#f1c40f");
            addLog(`🌟 [${actor.name}] Divine Aegis! Seluruh Party mendapat Shield Guard (-60% DMG), +10 MP, & +20% OD!`);
        }
        else if (actor.role === 'Control') {
            const freezeChance = (biome.id === 'ice') ? 0.85 : 0.65;
            let stunnedCount = 0, totalIce = 0;
            activeEnemies.forEach(en => {
                if (en.hp > 0) {
                    let iceDmg = Math.max(5, Math.floor(actor.matk * 1.25 - getEffDef(en) * 0.2));
                    iceDmg = applyCombatModifiers(iceDmg, 'Magic', en, actor);
                    en.hp -= iceDmg; totalIce += iceDmg;
                actor.combatDamageDealt = (actor.combatDamageDealt || 0) + iceDmg;
                    if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, en.x, en.y, 'spell', '#00ffff');
                    triggerHitFlash(en, "#00ffff");
                    if (rng() < freezeChance) {
                        en.statuses.stun = 1; stunnedCount++;
                        addOverheadIcon(en.x, en.y, `❄️-${iceDmg} STUN!`, "#00ffff");
                    } else {
                        addOverheadIcon(en.x, en.y, `❄️-${iceDmg}`, "#70a1ff");
                    }
                }
            });
            const boonMsg = applyPostAttackBoons(actor, totalIce);
            addLog(`🌟 [${actor.name}] Frost Nova (AoE)! Menghantam es & membekukan ${stunnedCount} target!${boonMsg}`);
        }
    }
    else if (type === 'reposition') {
        const currIdx = party.indexOf(actor);
        const targetIdx = (currIdx >= 2) ? currIdx - 1 : Math.min(party.length - 1, currIdx + 1);
        const partner = party[targetIdx];

        swapPartyFormation(currIdx, targetIdx, false);
        actor.mp = Math.min(actor.maxMp, actor.mp + 4);
        actor.combatContrib = (actor.combatContrib || 0) + 1;

        const newForm = getHeroFormationInfo(actor);
        addOverheadIcon(actor.x, actor.y, `🔄 POS ${newForm.posNumber}`, "#00ffff");
        addLog(`🔄 REPOSITION: [${actor.name}] bertukar posisi dengan [${partner.name}] menuju Pos ${newForm.posNumber} & pulih +4 MP!`);
    }
    else if (type === 'ult') {
        if ((actor.overdrive || 0) < 100) {
            addLog(`❌ Overdrive [${actor.name}] belum 100%!`);
            return;
        }
        actor.overdrive = 0;
        actor.combatContrib = (actor.combatContrib || 0) + 3;
        SFX.ult();
        triggerVoidCrownBacklash(actor);

        if (typeof triggerUltimateCutIn === 'function') {
            triggerUltimateCutIn(actor.name, actor.ultName, actor.color);
        }

        triggerLunge(actor, activeEnemy.x, activeEnemy.y);
        triggerScreenShake(12, 380);
        addOverheadIcon(actor.x, actor.y, `💥 ${actor.ultName}!`, "#ffcc00");

        if (actor.role === 'Warrior') {
            actor.defending = true; isTaunted = true;
            const ultDmg = applyCombatModifiers(Math.floor(actor.patk * 2.2 + actor.def * 2), 'Physical', activeEnemy, actor);
            activeEnemy.hp -= ultDmg; activeEnemy.statuses.stun = 1;
        actor.combatDamageDealt = (actor.combatDamageDealt || 0) + ultDmg;
            if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, activeEnemy.x, activeEnemy.y, 'slash', '#f1c40f');
            triggerHitFlash(activeEnemy, "#f1c40f");
            party.forEach(p => { if (p.hp > 0) p.defending = true; });
            addLog(`💥 ULTIMATE [${actor.name}] — IMMORTAL BASTION! ${ultDmg} DMG ke 🎯${activeEnemy.name}, Stun, & Party Guard!`);
        }
        else if (actor.role === 'Ranger') {
            activeEnemies.forEach(en => {
                if (en.hp > 0) {
                    const arrowDmg = applyCombatModifiers(Math.floor(actor.patk * 2.5), 'Physical', en, actor);
                    en.hp -= arrowDmg; en.statuses.break = 4;
                    actor.combatDamageDealt = (actor.combatDamageDealt || 0) + arrowDmg;
                    if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, en.x, en.y, 'arrow', '#f1c40f');
                    triggerHitFlash(en, "#f1c40f");
                    addOverheadIcon(en.x, en.y, `🏹-${arrowDmg}!`, "#ffcc00");
                }
            });
            addLog(`💥 ULTIMATE [${actor.name}] — RAIN OF ARROWS (AoE)! Menghujani seluruh musuh dengan panah kritikal!`);
        }
        else if (actor.role === 'Cleric') {
            party.forEach(p => {
                if (p.hp <= 0) {
                    const reviveHp = Math.floor(p.maxHp * 0.5);
                    p.hp = reviveHp;
                    actor.combatHealGiven = (actor.combatHealGiven || 0) + reviveHp;
                    if (!turnQueue.includes(p)) turnQueue.push(p);
                } else {
                    const healAmt = Math.floor(p.maxHp * 0.65);
                    const applied = Math.min(healAmt, p.maxHp - p.hp);
                    p.hp = Math.min(p.maxHp, p.hp + healAmt);
                    actor.combatHealGiven = (actor.combatHealGiven || 0) + applied;
                }
                p.mp = Math.min(p.maxMp, p.mp + 25);
                p.statuses = { poison: 0, burn: 0, stun: 0 };
                triggerHitFlash(p, "#00ffff");
            });
            addLog(`💥 ULTIMATE [${actor.name}] — DIVINE MIRACLE! Bangkitkan teman gugur + pulihkan 65% HP & +25 MP!`);
        }
        else if (actor.role === 'Control') {
            activeEnemies.forEach(en => {
                if (en.hp > 0) {
                    const meteorDmg = applyCombatModifiers(Math.floor(actor.matk * 2.7), 'Magic', en, actor);
                    en.hp -= meteorDmg; en.statuses.burn = 4; en.statuses.stun = 1;
                    actor.combatDamageDealt = (actor.combatDamageDealt || 0) + meteorDmg;
                    if (typeof triggerAttackVFX === 'function') triggerAttackVFX(actor.x, actor.y, en.x, en.y, 'spell', '#ff0044');
                    if (typeof addFloorDecal === 'function') addFloorDecal(en.x, en.y, 'scorch');
                    triggerHitFlash(en, "#ff0044");
                    addOverheadIcon(en.x, en.y, `☄️-${meteorDmg}!`, "#ff0044");
                }
            });
            addLog(`💥 ULTIMATE [${actor.name}] — METEOR APOCALYPSE (AoE)! Menghancurkan seluruh grup musuh + Stun & Burn!`);
        }
    }
    else if (type === 'defend') {
        if (typeof getHeroCursedRelicId === 'function' && getHeroCursedRelicId(actor) === 'berserker_ring') {
            addLog(`💀 [BLOODRING CURSE] ${actor.name} dikuasai amarah Berserker dan TIDAK BISA menggunakan Defend!`);
            return;
        }

        SFX.defend();
        actor.defending = true;
        actor.defendStreak = (actor.defendStreak || 0) + 1;

        if (actor.defendStreak === 1) {
            actor.mp = Math.min(actor.maxMp, actor.mp + 5);
            actor.overdrive = Math.min(100, (actor.overdrive || 0) + 15);
            actor.combatContrib = (actor.combatContrib || 0) + 1;
            addLog(`🛡️ [${actor.name}] Raise Guard (-60% DMG, +5 MP, +15% OD)!`);
        } else {
            actor.mp = Math.min(actor.maxMp, actor.mp + 1);
            addOverheadIcon(actor.x, actor.y, "⚠️ GUARD FATIGUE", "#f39c12");
            addLog(`⚠️ [GUARD FATIGUE] ${actor.name} bertahan beruntun! Efek melemah (-30% DMG, +1 MP).`);
        }
    } 
    else if (type === 'revive') {
        useBackpackItem('revive');
        return;
    }

    const deadList = activeEnemies.filter(e => e.hp <= 0);
    deadList.forEach(deadEn => handleSingleEnemyDeath(deadEn, actor));

    if (activeEnemies.length === 0) {
        winCombat(actor);
        return;
    }

    // Counter-attack: jika musuh selamat dan SPD lebih tinggi, 20% serang balik
    if (type === 'attack' && activeEnemy && activeEnemy.hp > 0 && activeEnemy.spd > (actor.spd || 0) && rng() < 0.20) {
        const target = party.filter(p => p.hp > 0)[Math.floor(rng() * party.filter(p => p.hp > 0).length)];
        if (target) {
            const cntDmg = Math.max(1, Math.floor((activeEnemy.atk || 5) * 0.5));
            target.hp = Math.max(0, target.hp - cntDmg);
            target.combatDamageTaken = (target.combatDamageTaken || 0) + cntDmg;
            addLog(`⚔️ [COUNTER] ${activeEnemy.name} menyerang balik ${target.name}: ${cntDmg} DMG!`);
            addOverheadIcon(target.x, target.y, `-${cntDmg}`, '#ff4757');
            if (handlePartyWipe()) return;
        }
    }

    if (type !== 'defend' && type !== 'item' && type !== 'revive' && type !== 'flee' && type !== 'reposition') {
        comboCounter++;
        if (comboCounter > 1) addLog(`🔥 COMBO x${comboCounter}! (+${Math.min(50, comboCounter * 5)}% DMG)`);
    }
    if (checkEnemyStatusReactions(actor)) return;

    nextTurn();
}

function executeEnemyTurn(actingEnemy) {
    const enemy = actingEnemy || activeEnemy;
    comboCounter = 0;
    if (gameMode !== 'COMBAT' || !enemy || enemy.hp <= 0) {
        nextTurn();
        return;
    }

    if (enemy.isBoss) {
        bossTurnCount++;
        if (bossTurnCount >= 5 && bossTurnCount % 3 === 0 && activeEnemies.length < 4) {
            const ascMult = 1 + (ascensionLevel * 0.35);
            const minionHp = Math.floor((28 + currentFloor * 12) * ascMult);
            const minionAtk = Math.floor((7 + currentFloor * 2.4) * ascMult);
            const minion = {
                name: `Royal Guard (Enrage)`,
                x: enemy.x, y: enemy.y, hp: minionHp, maxHp: minionHp,
                atk: minionAtk, def: 1 + Math.floor(currentFloor * 0.6), spd: 10 + Math.floor(currentFloor / 3),
                color: '#ff6b81', isEnemy: true, isBoss: false, bossTier: 0, affix: null,
                isSummonedMinion: true, statuses: { burn: 0, stun: 0, break: 0 }
            };
            // find adjacent free tile
            const slots = (typeof getAdjacentBattleSlots === 'function') ? getAdjacentBattleSlots(enemy, 1) : [];
            if (slots.length > 0) { minion.x = slots[0].x; minion.y = slots[0].y; }
            revealed[minion.y][minion.x] = true;
            enemies.push(minion);
            activeEnemies.push(minion);
            addLog(`😡 [${enemy.name}] memanggil bala bantuan! Royal Guard muncul!`);
            addOverheadIcon(minion.x, minion.y, '⚔️ REINFORCE!', '#ff4757');
        }
    }

    // Boss Phase 2: aktif saat HP <= 40%
    if (enemy.isBoss && !enemy.phase2 && enemy.hp > 0 && enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.4) {
        enemy.phase2 = true;
        enemy.atk = Math.floor(enemy.atk * 1.3);
        enemy.spd += 3;
        if (typeof SFX !== 'undefined' && SFX.bossRoar) SFX.bossRoar();
        if (typeof triggerScreenShake === 'function') triggerScreenShake(8, 260);
        addLog(`🔥 [PHASE 2] ${enemy.name} memasuki wujud amuk! (+30% ATK, +3 SPD, jurus puncak lebih sering!)`);
        if (typeof addOverheadIcon === 'function') addOverheadIcon(enemy.x, enemy.y, "🔥 PHASE 2!", "#ff0044");
        if (typeof triggerHitFlash === 'function') triggerHitFlash(enemy, "#ff0044");
    }

    const darkMultiplier = (torchLight <= 0) ? 1.25 : 1.0;
    const berserkMultiplier = (enemy.affix === 'berserk' && enemy.hp < enemy.maxHp * 0.5) ? 1.35 : 1.0;
    const enemyAtk = Math.floor(enemy.atk * darkMultiplier * berserkMultiplier * (floorModifier === 'blood_moon' ? 1.25 : 1));
    const bZone = enemy.bossBiome || getCurrentBiome().id;

    const aliveHeroes = party.filter(p => p.hp > 0);
    if (aliveHeroes.length > 0) {
        if (enemy.isBoss && enemy.bossTier === 10 && rng() < (enemy.phase2 ? 0.70 : 0.45) && !isTaunted) {
            addLog(`⚠️ ${enemy.name} menyiapkan jurus puncak!`);
            SFX.bossRoar();
            if (typeof triggerUltimateCutIn === 'function') {
                triggerUltimateCutIn(enemy.name, enemy.bossSkillName || "DREAD APOCALYPSE", enemy.color || "#ff4757");
            }
            triggerLunge(enemy, aliveHeroes[0].x, aliveHeroes[0].y);
            triggerScreenShake(12, 360);

            let totalDrained = 0;
            aliveHeroes.forEach(hero => {
                const form = getHeroFormationInfo(hero);
                const mult = (bZone === 'lava') ? 0.90 : 0.75;
                let aoeDmg = Math.max(4, Math.floor(enemyAtk * mult) - Math.floor(hero.def * 0.6));
                if (!form.isFront) aoeDmg = Math.max(2, Math.floor(aoeDmg * 0.75));
                if (typeof getHeroCursedRelicId === 'function' && getHeroCursedRelicId(hero) === 'greed_idol') {
                    aoeDmg = Math.floor(aoeDmg * 1.25);
                }
                if (hero.defending) {
                    const guardMult = (hero.defendStreak > 1) ? 0.70 : 0.40;
                    aoeDmg = Math.max(2, Math.floor(aoeDmg * guardMult));
                }
                hero.hp = Math.max(0, hero.hp - aoeDmg);
                hero.combatDamageTaken = (hero.combatDamageTaken || 0) + aoeDmg;
                hero.overdrive = Math.min(100, (hero.overdrive || 0) + 20);
                totalDrained += aoeDmg;

                if (typeof triggerAttackVFX === 'function') triggerAttackVFX(enemy.x, enemy.y, hero.x, hero.y, 'spell', enemy.color || '#ff4757');

                if (bZone === 'crypt') {
                    hero.statuses.poison = 3; triggerHitFlash(hero, "#2ecc71");
                } else if (bZone === 'ice') {
                    hero.spd = Math.max(5, hero.spd - 2);
                    if (rng() < 0.40) hero.statuses.stun = 1;
                    triggerHitFlash(hero, "#00ffff");
                } else if (bZone === 'lava') {
                    hero.statuses.burn = 4;
                    if (typeof addFloorDecal === 'function') addFloorDecal(hero.x, hero.y, 'scorch');
                    triggerHitFlash(hero, "#ff4757");
                } else if (bZone === 'void') {
                    hero.mp = Math.max(0, hero.mp - 15);
                    hero.overdrive = Math.max(0, (hero.overdrive || 0) - 25);
                    triggerHitFlash(hero, "#e056fd");
                }
            });

            if (bZone === 'crypt') {
                const bossHeal = Math.max(10, Math.floor(totalDrained * 0.35));
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + bossHeal);
                addOverheadIcon(enemy.x, enemy.y, `💀+${bossHeal}HP`, "#2ecc71");
                addLog(`🐉 [NECROLORD MALAKOR] melepaskan *Plague of the Undead*! Menghisap +${bossHeal} HP!`);
            } else if (bZone === 'ice') {
                addLog(`🐉 [GLACIAL WYRM KING] menghembuskan *Absolute Zero Blizzard* (-2 SPD & Freeze)!`);
            } else if (bZone === 'lava') {
                addLog(`🐉 [IGNIS BALROG LORD] memicu *Cataclysmic Eruption* (Burn 4 turn)!`);
            } else {
                torchLight = Math.max(0, torchLight - 25);
                addLog(`🐉 [XAL'KORATH VOID EMPEROR] membuka *Singularity Collapse* (-15 MP & Obor -25%)!`);
            }
        }
        else if (enemy.isBoss && enemy.bossTier === 5 && rng() < (enemy.phase2 ? 0.65 : 0.40) && aliveHeroes.length >= 2 && !isTaunted) {
            addLog(`⚠️ ${enemy.name} menyiapkan serangan menyapu!`);
            SFX.bossRoar();
            triggerLunge(enemy, aliveHeroes[0].x, aliveHeroes[0].y);
            triggerScreenShake(8, 260);
            const targets = aliveHeroes.slice(0, 2);

            targets.forEach(hero => {
                let cleaveDmg = Math.max(3, Math.floor(enemyAtk * 0.85) - Math.floor(hero.def * 0.6));
                if (typeof getHeroCursedRelicId === 'function' && getHeroCursedRelicId(hero) === 'greed_idol') {
                    cleaveDmg = Math.floor(cleaveDmg * 1.25);
                }
                if (hero.defending) {
                    const guardMult = (hero.defendStreak > 1) ? 0.70 : 0.40;
                    cleaveDmg = Math.max(1, Math.floor(cleaveDmg * guardMult));
                }
                hero.hp = Math.max(0, hero.hp - cleaveDmg);
                hero.combatDamageTaken = (hero.combatDamageTaken || 0) + cleaveDmg;
                hero.overdrive = Math.min(100, (hero.overdrive || 0) + 20);
                if (typeof triggerAttackVFX === 'function') triggerAttackVFX(enemy.x, enemy.y, hero.x, hero.y, 'slash', enemy.color || '#e67e22');

                if (bZone === 'crypt') { hero.statuses.poison = 3; triggerHitFlash(hero, "#2ecc71"); }
                else if (bZone === 'ice') { if (rng() < 0.50) hero.statuses.stun = 1; triggerHitFlash(hero, "#00ffff"); }
                else if (bZone === 'lava') { hero.statuses.burn = 3; triggerHitFlash(hero, "#ff7f50"); }
                else if (bZone === 'void') { hero.mp = Math.max(0, hero.mp - 12); triggerHitFlash(hero, "#c56cf0"); }
            });

            if (bZone === 'crypt') addLog(`👹 [${enemy.name}] melancarkan *Tombstone Cleave* (+Poison 3 turn)!`);
            else if (bZone === 'ice') addLog(`👹 [${enemy.name}] menghantamkan *Glacial Smash* (Freeze/Stun)!`);
            else if (bZone === 'lava') addLog(`👹 [${enemy.name}] mengayunkan *Molten Cleave* (Burn)!`);
            else { swapPartyFormation(0, aliveHeroes.length - 1, false); addLog(`👹 [${enemy.name}] menebaskan *Dimensional Rift Slash* (-12 MP & Acak Formasi)!`); }
        }
        else {
            const frontHeroes = aliveHeroes.filter(h => getHeroFormationInfo(h).isFront);
            const backHeroes  = aliveHeroes.filter(h => !getHeroFormationInfo(h).isFront);
            let target = aliveHeroes[0];

            if (isTaunted && party.some(p => p.role === 'Warrior' && p.hp > 0)) {
                target = party.find(p => p.role === 'Warrior' && p.hp > 0);
                if (rng() < 0.5) isTaunted = false;
            } else if (frontHeroes.length > 0 && (backHeroes.length === 0 || rng() < 0.75)) {
                target = frontHeroes[Math.floor(rng() * frontHeroes.length)];
            } else if (backHeroes.length > 0) {
                target = backHeroes[Math.floor(rng() * backHeroes.length)];
            }

            triggerLunge(enemy, target.x, target.y);
            if (typeof triggerAttackVFX === 'function') triggerAttackVFX(enemy.x, enemy.y, target.x, target.y, 'slash', '#ff4757');

            const targetCurse = (typeof getHeroCursedRelicId === 'function') ? getHeroCursedRelicId(target) : null;
            const canDodge = (targetCurse !== 'titan_shackles') && target.perks && target.perks.includes('quick_reflexes');

            if (canDodge && rng() < 0.22) {
                addOverheadIcon(target.x, target.y, "🍃 DODGE!", "#2ecc71");
                addLog(`🍃 [QUICK REFLEXES] ${target.name} menghindari serangan ${enemy.name}!`);
            } else {
                const targetForm = getHeroFormationInfo(target);
                let rawDmg = Math.max(2, enemyAtk - Math.floor(target.def * 0.7));
                if (typeof formationTactic !== 'undefined') {
                    if (formationTactic === 'defensive') rawDmg = Math.max(1, Math.floor(rawDmg * 0.82));
                    else if (formationTactic === 'aggressive') rawDmg = Math.floor(rawDmg * 1.12);
                    else rawDmg = Math.max(1, Math.floor(rawDmg * 0.96));
                }

                if (!targetForm.isFront) rawDmg = Math.max(1, Math.floor(rawDmg * 0.75));
                if (targetCurse === 'greed_idol') rawDmg = Math.floor(rawDmg * 1.25);
                if (target.defending) {
                    const guardMult = (target.defendStreak > 1) ? 0.70 : 0.40;
                    rawDmg = Math.max(1, Math.floor(rawDmg * guardMult));
                }

                target.hp = Math.max(0, target.hp - rawDmg);
                target.combatDamageTaken = (target.combatDamageTaken || 0) + rawDmg;
                target.overdrive = Math.min(100, (target.overdrive || 0) + 20);
                SFX.hit();
                triggerHitFlash(target, "#ffffff");
                triggerScreenShake(5, 180);
                addOverheadIcon(target.x, target.y, `-${rawDmg}`, "#ff4757");

                let extraEffectLog = "";
                if (enemy.affix === 'vampiric') {
                    const drain = Math.max(2, Math.floor(rawDmg * 0.35));
                    enemy.hp = Math.min(enemy.maxHp, enemy.hp + drain);
                    extraEffectLog += ` (🧛Serap +${drain} HP!)`;
                }

                if (target.hp > 0 && party.filter(p => p.hp > 0).length >= 2 && rng() < 0.28) {
                    const tIdx = party.indexOf(target);
                    if (tIdx <= 1 && party[3] && party[3].hp > 0) {
                        const swappedHero = party[3];
                        swapPartyFormation(tIdx, 3, false);
                        addOverheadIcon(target.x, target.y, "🌪️ KNOCKBACK!", "#f39c12");
                        extraEffectLog += ` 🌪️[KNOCKBACK!]`;
                    } else if (tIdx >= 2 && party[0] && party[0].hp > 0) {
                        const swappedHero = party[0];
                        swapPartyFormation(tIdx, 0, false);
                        addOverheadIcon(target.x, target.y, "🪝 PULLED FRONT!", "#e84118");
                        extraEffectLog += ` 🪝[PULLED!]`;
                    }
                }

                const mitigationNote = !targetForm.isFront ? ' (Backline -25%)' : '';
                addLog(`💥 [${enemy.name}] menyerang ${target.name}${mitigationNote}: ${rawDmg} DMG!${extraEffectLog}`);
            }
        }
    }

    aliveHeroes.filter(h => h.hp > 0).forEach(h => { tryStatusReaction(h, enemy); });

    if (handlePartyWipe()) return;

    nextTurn();
}
