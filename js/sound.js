// =========================================================================
// ATMOSPHERIC DUNGEON AUDIO & DYNAMIC MEDIEVAL BGM ENGINE (WEB AUDIO API)
// Features procedural stone cavern reverb, filtered physical noise transients,
// warm low-pass synth filtering, & persistent volume/mute settings.
// =========================================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let masterGain = null;
let dryBus = null;
let wetBus = null;
let reverbNode = null;
let noiseBuffer = null;

let isMuted = localStorage.getItem('ed_audio_muted') === '1';
let masterVolume = parseFloat(localStorage.getItem('ed_audio_vol') ?? '0.8');
if (Number.isNaN(masterVolume)) masterVolume = 0.8;

// BGM Sequencer state
let bgmTimer = null;
let bgmStep = 0;
let isStartingBGM = false;
let currentBgmTheme = 'NONE';

function buildCavernImpulse(ctx, duration = 1.25, decay = 2.8) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        let prev = 0;
        for (let i = 0; i < length; i++) {
            const env = Math.pow(1 - i / length, decay);
            const white = Math.random() * 2 - 1;
            // Dampen high frequencies so echo sounds like damp stone masonry
            prev = prev * 0.72 + white * 0.28;
            data[i] = prev * env * 0.55;
        }
    }
    return impulse;
}

function buildWhiteNoiseBuffer(ctx, duration = 0.6) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioCtx();
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(4, audioCtx.currentTime);

        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime);

        dryBus = audioCtx.createGain();
        dryBus.gain.setValueAtTime(0.82, audioCtx.currentTime);

        wetBus = audioCtx.createGain();
        wetBus.gain.setValueAtTime(0.28, audioCtx.currentTime);

        reverbNode = audioCtx.createConvolver();
        reverbNode.buffer = buildCavernImpulse(audioCtx);
        noiseBuffer = buildWhiteNoiseBuffer(audioCtx);

        dryBus.connect(compressor);
        wetBus.connect(reverbNode);
        reverbNode.connect(compressor);
        compressor.connect(masterGain);
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!bgmTimer && !isMuted) {
        syncDynamicBGM();
    }
}

window.addEventListener('keydown', () => initAudio(), { once: true });
window.addEventListener('pointerdown', () => initAudio(), { once: true });

function syncAudioControlsUI() {
    const btn = document.getElementById('btn-mute');
    if (btn) {
        const ico = (typeof icon === 'function') ? icon(isMuted ? 'soundOff' : 'soundOn', 13) : '';
        btn.innerHTML = `${ico}<span>${isMuted ? 'Muted' : 'Audio'}</span>`;
        btn.setAttribute('aria-pressed', String(!isMuted));
    }
    const slider = document.getElementById('volume-slider');
    if (slider) {
        const pct = Math.round(masterVolume * 100);
        slider.value = String(pct);
        slider.style.setProperty('--progress', `${pct}%`);
    }
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('ed_audio_muted', isMuted ? '1' : '0');
    if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime, 0.03);
    }
    syncAudioControlsUI();
    if (isMuted) {
        stopBGM();
    } else {
        initAudio();
        syncDynamicBGM(true);
    }
}

function setMasterVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('ed_audio_vol', String(masterVolume));
    if (masterGain && audioCtx && !isMuted) {
        masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.02);
    }
    syncAudioControlsUI();
}

// Filtered tone generator with warm lowpass & cavern reverb send
function playTone(freq, type = 'triangle', duration = 0.12, vol = 0.09, slideTo = null, filterCutoff = 2600, reverbSend = 0.35) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx || !dryBus) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dryBus);
    if (reverbSend > 0 && wetBus) {
        const send = audioCtx.createGain();
        send.gain.setValueAtTime(reverbSend, now);
        gain.connect(send);
        send.connect(wetBus);
    }

    osc.start(now);
    osc.stop(now + duration + 0.02);
}

// Physical filtered noise burst for footsteps, sword whooshes, stone crumble & impacts
function playNoiseBurst(duration = 0.08, vol = 0.06, filterType = 'bandpass', freq = 900, q = 1.4, slideFreq = null) {
    if (isMuted) return;
    initAudio();
    if (!audioCtx || !noiseBuffer || !dryBus) return;

    const now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(q, now);
    if (slideFreq) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(60, slideFreq), now + duration);
    }

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dryBus);
    if (wetBus) gain.connect(wetBus);

    src.start(now);
    src.stop(now + duration + 0.01);
}

// =========================================================================
// PROCEDURAL DYNAMIC BGM SEQUENCER (WARM FILTERED INSTRUMENTS)
// =========================================================================
function playBgmNote(freq, type, duration, vol, attack = 0.02, detuneCents = 0, cutoff = 1950) {
    if (isMuted || !audioCtx || !freq || !dryBus) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detuneCents !== 0) osc.detune.setValueAtTime(detuneCents, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dryBus);
    if (wetBus) gain.connect(wetBus);

    osc.start(now);
    osc.stop(now + duration + 0.03);
}

function playPercussionTick(isHeavy = false) {
    if (isMuted || !audioCtx) return;
    if (isHeavy) {
        playTone(98, 'sine', 0.13, 0.055, 34, 400, 0.25);
        playNoiseBurst(0.04, 0.018, 'lowpass', 320, 1.0);
    } else {
        playNoiseBurst(0.025, 0.014, 'highpass', 3200, 1.2);
    }
}

const BGM_PATTERNS = {
    EXPLORE_crypt: {
        stepMs: 360, leadType: 'triangle', leadVol: 0.028, bassType: 'sine', bassVol: 0.036, cutoff: 1800,
        lead: [293.66, 349.23, 440.00, 349.23, 329.63, 293.66, 261.63, 220.00,
               293.66, 349.23, 466.16, 440.00, 392.00, 349.23, 329.63, 0],
        bass: [73.42, 0, 0, 0, 65.41, 0, 0, 0, 58.27, 0, 0, 0, 65.41, 0, 55.00, 0]
    },
    EXPLORE_ice: {
        stepMs: 420, leadType: 'sine', leadVol: 0.026, bassType: 'triangle', bassVol: 0.022, cutoff: 3200,
        lead: [659.25, 0, 783.99, 587.33, 493.88, 0, 523.25, 440.00,
               659.25, 783.99, 987.77, 0, 880.00, 783.99, 659.25, 0],
        bass: [82.41, 0, 0, 0, 98.00, 0, 0, 0, 65.41, 0, 0, 0, 73.42, 0, 0, 0]
    },
    EXPLORE_lava: {
        stepMs: 320, leadType: 'sawtooth', leadVol: 0.016, bassType: 'triangle', bassVol: 0.040, cutoff: 1150,
        lead: [196.00, 0, 207.65, 196.00, 0, 233.08, 207.65, 196.00,
               261.63, 233.08, 207.65, 0, 196.00, 174.61, 196.00, 0],
        bass: [49.00, 49.00, 0, 49.00, 51.91, 0, 49.00, 0,
               49.00, 49.00, 0, 58.27, 51.91, 0, 49.00, 0]
    },
    EXPLORE_void: {
        stepMs: 380, leadType: 'sine', leadVol: 0.024, bassType: 'sawtooth', bassVol: 0.018, detune: 12, cutoff: 1500,
        lead: [329.63, 349.23, 415.30, 349.23, 329.63, 0, 293.66, 261.63,
               349.23, 415.30, 493.88, 415.30, 349.23, 329.63, 246.94, 0],
        bass: [82.41, 0, 87.31, 0, 82.41, 0, 73.42, 0,
               65.41, 0, 73.42, 0, 82.41, 0, 61.74, 0]
    },
    COMBAT: {
        stepMs: 185, leadType: 'sawtooth', leadVol: 0.019, bassType: 'triangle', bassVol: 0.032, percussion: true, cutoff: 1650,
        lead: [293.66, 0, 349.23, 293.66, 440.00, 0, 392.00, 349.23,
               329.63, 0, 392.00, 329.63, 466.16, 440.00, 392.00, 329.63],
        bass: [146.83, 146.83, 146.83, 146.83, 130.81, 130.81, 130.81, 130.81,
               116.54, 116.54, 116.54, 116.54, 110.00, 110.00, 138.59, 146.83]
    },
    BOSS: {
        stepMs: 148, leadType: 'sawtooth', leadVol: 0.023, bassType: 'sawtooth', bassVol: 0.032, percussion: true, detune: 8, cutoff: 1850,
        lead: [440.00, 466.16, 440.00, 392.00, 440.00, 523.25, 466.16, 440.00,
               349.23, 392.00, 349.23, 329.63, 293.66, 329.63, 349.23, 415.30],
        bass: [110.00, 0, 110.00, 116.54, 110.00, 0, 98.00, 103.83,
               87.31, 0, 87.31, 82.41, 73.42, 82.41, 87.31, 103.83]
    }
};

function stopBGM() {
    if (bgmTimer) {
        clearInterval(bgmTimer);
        bgmTimer = null;
    }
    currentBgmTheme = 'NONE';
}

function startBGM(themeKey) {
    if (isMuted || isStartingBGM) return;
    isStartingBGM = true;
    initAudio();
    if (!audioCtx) {
        isStartingBGM = false;
        return;
    }

    const pattern = BGM_PATTERNS[themeKey] || BGM_PATTERNS.EXPLORE_crypt;
    if (currentBgmTheme === themeKey && bgmTimer) {
        isStartingBGM = false;
        return;
    }

    if (bgmTimer) clearInterval(bgmTimer);
    currentBgmTheme = themeKey;
    bgmStep = 0;

    bgmTimer = setInterval(() => {
        if (isMuted || !audioCtx || document.hidden) return;

        const desired = detectDesiredBgmTheme();
        if (desired !== currentBgmTheme) {
            startBGM(desired);
            return;
        }

        const idx = bgmStep % pattern.lead.length;
        const leadFreq = pattern.lead[idx];
        const bassFreq = pattern.bass[idx];
        const noteDur = (pattern.stepMs / 1000) * 1.38;

        if (leadFreq > 0) {
            playBgmNote(leadFreq, pattern.leadType, noteDur, pattern.leadVol, 0.016, pattern.detune || 0, pattern.cutoff || 1900);
        }
        if (bassFreq > 0) {
            playBgmNote(bassFreq, pattern.bassType, noteDur * 1.45, pattern.bassVol, 0.02, 0, 650);
        }

        if (pattern.percussion) {
            if (idx % 4 === 0) playPercussionTick(true);
            else if (idx % 2 === 0) playPercussionTick(false);
        }

        bgmStep++;
    }, pattern.stepMs);

    isStartingBGM = false;
}

function detectDesiredBgmTheme() {
    if (typeof gameMode !== 'undefined' && (gameMode === 'COMBAT' || gameMode === 'AMBUSH')) {
        const hasBoss = (typeof activeEnemies !== 'undefined' && activeEnemies.some(e => e.isBoss && e.hp > 0)) ||
                        (typeof activeEnemy !== 'undefined' && activeEnemy && activeEnemy.isBoss);
        return hasBoss ? 'BOSS' : 'COMBAT';
    }
    const biomeId = (typeof getCurrentBiome === 'function') ? getCurrentBiome().id : 'crypt';
    return `EXPLORE_${biomeId}`;
}

function syncDynamicBGM(forceRestart = false) {
    if (isMuted) return;
    const desired = detectDesiredBgmTheme();
    if (forceRestart || desired !== currentBgmTheme || !bgmTimer) {
        startBGM(desired);
    }
}

// =========================================================================
// REALISTIC SOUND EFFECTS CATALOG (SFX)
// =========================================================================
const SFX = {
    step: () => {
        syncDynamicBGM();
        const jitter = 0.92 + Math.random() * 0.16;
        playNoiseBurst(0.042, 0.032, 'bandpass', 620 * jitter, 1.8);
        playTone(115 * jitter, 'sine', 0.045, 0.035, 58, 450, 0.25);
    },
    bump: () => {
        playTone(82, 'triangle', 0.08, 0.07, 42, 500, 0.2);
        playNoiseBurst(0.05, 0.03, 'lowpass', 340, 1.0);
    },
    crumble: () => {
        playNoiseBurst(0.28, 0.09, 'lowpass', 720, 0.9, 140);
        playTone(105, 'sawtooth', 0.18, 0.08, 36, 650, 0.5);
        setTimeout(() => playNoiseBurst(0.22, 0.07, 'bandpass', 420, 1.1, 110), 90);
    },
    pickup: () => {
        playTone(587.33, 'triangle', 0.09, 0.07, 783.99, 3500, 0.4);
        setTimeout(() => playTone(880, 'sine', 0.14, 0.07, 1174.66, 4000, 0.45), 60);
    },
    chest: () => {
        playNoiseBurst(0.06, 0.04, 'bandpass', 900, 1.5);
        [440, 554.37, 659.25, 880].forEach((f, i) => {
            setTimeout(() => playTone(f, 'triangle', 0.13, 0.075, null, 3200, 0.45), i * 65);
        });
    },
    potion: () => {
        playTone(392, 'sine', 0.11, 0.07, 659, 2800, 0.45);
        setTimeout(() => playTone(659, 'sine', 0.16, 0.08, 987, 3200, 0.5), 85);
    },
    revive: () => {
        [329.63, 440, 554.37, 659.25, 880, 1046.5].forEach((f, i) => {
            setTimeout(() => playTone(f, 'sine', 0.22, 0.075, null, 3800, 0.6), i * 65);
        });
    },
    equip: () => {
        playNoiseBurst(0.045, 0.04, 'highpass', 1800, 1.8);
        playTone(320, 'triangle', 0.07, 0.07, 480, 2500, 0.3);
    },
    forge: () => {
        // Metallic anvil clang
        playNoiseBurst(0.05, 0.065, 'highpass', 2200, 1.5);
        playTone(1318.5, 'triangle', 0.22, 0.085, 1280, 4800, 0.55);
        playTone(1975.5, 'sine', 0.16, 0.055, 1920, 5200, 0.55);
        setTimeout(() => {
            playTone(1568, 'triangle', 0.24, 0.075, null, 4800, 0.55);
        }, 120);
    },
    shrine: () => {
        [440, 554.37, 659.25, 880].forEach((f, i) => {
            setTimeout(() => playTone(f, 'sine', 0.28, 0.065, null, 3400, 0.65), i * 85);
        });
    },
    trap: () => {
        playNoiseBurst(0.14, 0.085, 'bandpass', 1400, 1.2, 320);
        playTone(260, 'sawtooth', 0.14, 0.085, 68, 1600, 0.4);
    },
    encounter: () => {
        startBGM('COMBAT');
        playTone(220, 'sawtooth', 0.12, 0.08, 330, 1900, 0.4);
        setTimeout(() => playTone(330, 'sawtooth', 0.18, 0.08, 165, 1900, 0.45), 90);
    },
    bossEncounter: () => {
        startBGM('BOSS');
        [146.83, 138.59, 123.47, 98.00].forEach((f, i) => {
            setTimeout(() => playTone(f, 'sawtooth', 0.28, 0.11, f * 0.72, 1400, 0.6), i * 130);
        });
    },
    bossRoar: () => {
        playNoiseBurst(0.32, 0.08, 'lowpass', 480, 1.2, 120);
        playTone(135, 'sawtooth', 0.30, 0.10, 48, 950, 0.6);
    },
    attack: () => {
        playNoiseBurst(0.085, 0.065, 'bandpass', 1850, 1.3, 620);
        playTone(310, 'sawtooth', 0.09, 0.075, 115, 2200, 0.3);
    },
    skill: () => {
        playNoiseBurst(0.12, 0.045, 'bandpass', 2400, 1.6, 900);
        playTone(440, 'triangle', 0.09, 0.08, 720, 3200, 0.45);
        setTimeout(() => playTone(720, 'sawtooth', 0.16, 0.075, 260, 2600, 0.5), 75);
    },
    ult: () => {
        playNoiseBurst(0.24, 0.07, 'bandpass', 1500, 1.0, 400);
        [261.63, 392.00, 523.25, 783.99, 1046.50].forEach((f, i) => {
            setTimeout(() => playTone(f, 'sawtooth', 0.18, 0.085, null, 3400, 0.6), i * 48);
        });
    },
    defend: () => {
        playNoiseBurst(0.04, 0.04, 'highpass', 2100, 2.0);
        playTone(250, 'triangle', 0.11, 0.075, 360, 2200, 0.35);
    },
    hit: () => {
        playNoiseBurst(0.075, 0.07, 'lowpass', 950, 1.1, 220);
        playTone(145, 'sawtooth', 0.12, 0.09, 52, 1100, 0.35);
    },
    win: () => {
        syncDynamicBGM();
        [440, 554.37, 659.25, 880].forEach((f, i) => {
            setTimeout(() => playTone(f, 'triangle', 0.18, 0.08, null, 3200, 0.5), i * 80);
        });
    },
    levelup: () => {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            setTimeout(() => playTone(f, 'triangle', 0.16, 0.08, null, 3600, 0.55), i * 75);
        });
    },
    stairsAppear: () => {
        playTone(293.66, 'sine', 0.24, 0.08, 587.33, 2800, 0.6);
    },
    stairs: () => {
        setTimeout(() => syncDynamicBGM(), 200);
        [587.33, 493.88, 392.00, 293.66].forEach((f, i) => {
            setTimeout(() => playTone(f, 'triangle', 0.10, 0.07, null, 2200, 0.45), i * 65);
        });
    },
    gameover: () => {
        stopBGM();
        [293.66, 261.63, 220.00, 164.81].forEach((f, i) => {
            setTimeout(() => playTone(f, 'sawtooth', 0.32, 0.09, null, 1200, 0.65), i * 170);
        });
    }
};

window.addEventListener('DOMContentLoaded', syncAudioControlsUI);
