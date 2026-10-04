// Visual and audio effects for the terminal.
//
// The game engine only ever calls print(). This file watches the lines being printed and
// reacts to them: it colors them, shakes or flashes the screen, floats damage numbers and plays
// small synthesized sounds (no audio files, so the game still works offline from file://).
//
// To add a new effect, add one entry to RULES below. To mute everything, use the Sound button.

const FX = (() => {
  const SOUND_KEY = "the-last-save.sound";
  const MUSIC_VOLUME_KEY = "the-last-save.music-volume";

  const terminal = document.querySelector(".terminal");
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Sound ----------
  // All sounds are synthesized with the Web Audio API (no audio files, so it works from file://).
  // Building blocks: tone() = an oscillator with an envelope, noise() = filtered noise (swooshes,
  // crunches, booms), bell() = metallic ring (clangs, coins, chimes). Everything runs through a
  // compressor and a little reverb so it sounds fuller than raw beeps.

  let soundOn = true;
  let musicVolume = 55;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== "off";
    const savedMusicVolume = localStorage.getItem(MUSIC_VOLUME_KEY);
    if (savedMusicVolume !== null && Number.isFinite(Number(savedMusicVolume))) {
      musicVolume = Math.max(0, Math.min(100, Math.round(Number(savedMusicVolume))));
    }
  } catch (e) {}

  let audio = null; // created on the first key press or click (browsers block it before that)
  let master = null; // everything is mixed into this
  let musicBus = null;
  let reverbIn = null; // send bus for the reverb
  let noiseBuffer = null;
  let base = 0; // start-time offset (seconds) of the sound currently being built
  let cursor = 0; // when the next queued sound may start (keeps bursts of lines from piling up)
  let battleMusicTimer = null;
  let activeBattleMusic = null;
  let battleAudio = null;
  let battleAudioUrl = null;
  let battleAudioFallbackTimer = null;
  let battleMusicGeneration = 0;
  let corruptionTimer = null;
  let musicDistortionTimer = null;

  function buildGraph() {
    const rate = audio.sampleRate;
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master = audio.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(audio.destination);
    musicBus = audio.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(comp);

    // Reverb: noise that fades out, used as an impulse response.
    const len = Math.floor(rate * 1.3);
    const impulse = audio.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const convolver = audio.createConvolver();
    convolver.buffer = impulse;
    const wetOut = audio.createGain();
    wetOut.gain.value = 0.6;
    reverbIn = audio.createGain();
    reverbIn.connect(convolver).connect(wetOut).connect(master);

    noiseBuffer = audio.createBuffer(1, rate, rate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < rate; i++) nd[i] = Math.random() * 2 - 1;
  }

  function unlockAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audio && AudioCtx) {
      audio = new AudioCtx();
      buildGraph();
    }
    if (audio && audio.state === "suspended") audio.resume();
  }
  ["keydown", "pointerdown"].forEach((evt) =>
    window.addEventListener(evt, () => {
      unlockAudio();
      if (!activeBattleMusic) startAmbientMusic();
    })
  );

  // Sends a node to the speakers, plus `wet` (0-1) of it to the reverb.
  function route(node, wet) {
    node.connect(master);
    if (wet > 0) {
      const send = audio.createGain();
      send.gain.value = wet;
      node.connect(send).connect(reverbIn);
    }
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  // One note. `slideTo` bends the pitch, `delay` chains notes, `lp` adds a low-pass filter.
  function tone(freq, dur, o = {}) {
    const { type = "sine", vol = 0.1, slideTo = null, delay = 0, attack = 0.004 } = o;
    const { wet = 0.12, detune = 0, lp = 0 } = o;
    const t = audio.currentTime + base + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur / 2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = osc;
    if (lp) {
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lp;
      osc.connect(filter);
      last = filter;
    }
    last.connect(gain);
    route(gain, wet);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of filtered noise. `f0` -> `f1` sweeps the filter (a whoosh); `type` picks the filter.
  function noise(dur, o = {}) {
    const { vol = 0.1, delay = 0, type = "bandpass", f0 = 1500, f1 = null, q = 1 } = o;
    const { attack = 0.005, wet = 0.1 } = o;
    const t = audio.currentTime + base + delay;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    if (f1) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur / 2));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain);
    route(gain, wet);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // A metallic ring: sine partials at inharmonic ratios, like a bell or struck metal.
  function bell(freq, dur, o = {}) {
    const { vol = 0.08, delay = 0, wet = 0.3 } = o;
    [
      [1, 1, 1],
      [2.76, 0.55, 0.7],
      [5.4, 0.3, 0.5],
      [8.93, 0.18, 0.35],
    ].forEach(([ratio, v, d]) => tone(freq * ratio, dur * d, { vol: vol * v, delay, wet }));
  }

  // Short melody helper: each note starts a little after the previous one.
  function melody(notes, { step = 0.1, length = 0.16, type = "square", vol = 0.05, wet = 0.2 } = {}) {
    notes.forEach((freq, i) => tone(freq, length, { type, vol, delay: i * step, wet }));
  }

  // Reusable pieces
  const thump = (vol = 0.22, f = 150, delay = 0) =>
    tone(f, 0.16, { slideTo: 45, vol, delay, wet: 0.05 });
  const slash = (vol = 0.1, delay = 0) =>
    noise(0.13, { vol, delay, f0: 4200, f1: 900, q: 0.9, wet: 0.08 });
  const whoosh = (vol = 0.08, up = true, dur = 0.22, delay = 0) =>
    noise(dur, { vol, delay, f0: up ? 400 : 2400, f1: up ? 3200 : 350, q: 1.2, attack: dur * 0.4 });
  const crunch = (vol = 0.1, delay = 0) =>
    noise(0.12, { vol, delay, type: "lowpass", f0: 1800, f1: 200, wet: 0.05 });
  const sparkle = (n = 4, from = 1200, delay = 0, vol = 0.04) => {
    for (let i = 0; i < n; i++) {
      tone(from * Math.pow(1.26, i), 0.14, { vol, delay: delay + i * 0.06, wet: 0.4 });
    }
  };

  const SOUNDS = {
    // --- typing and interface ---
    key: () => tone(rand(1500, 2100), 0.02, { type: "square", vol: 0.012, wet: 0 }),
    enter: () => {
      tone(520, 0.05, { type: "triangle", vol: 0.05, wet: 0.05 });
      tone(780, 0.08, { type: "triangle", vol: 0.04, delay: 0.04, wet: 0.05 });
    },
    menuOpen: () => {
      tone(660, 0.06, { type: "triangle", vol: 0.04 });
      tone(990, 0.09, { type: "triangle", vol: 0.03, delay: 0.05 });
    },
    page: () => {
      noise(0.18, { vol: 0.05, f0: 800, f1: 3000, q: 0.7 });
      tone(330, 0.2, { type: "triangle", vol: 0.04, delay: 0.08, wet: 0.3 });
    },
    yes: () => {
      tone(880, 0.05, { type: "triangle", vol: 0.035 });
      tone(1320, 0.08, { type: "triangle", vol: 0.03, delay: 0.04 });
    },
    no: () => {
      tone(300, 0.07, { type: "triangle", vol: 0.045, wet: 0.05 });
      tone(220, 0.1, { type: "triangle", vol: 0.04, delay: 0.06, wet: 0.05 });
    },
    error: () => {
      tone(180, 0.09, { type: "square", vol: 0.04, wet: 0.03, lp: 900 });
      tone(150, 0.14, { type: "square", vol: 0.04, delay: 0.09, wet: 0.03, lp: 900 });
    },
    save: () => {
      tone(784, 0.07, { type: "triangle", vol: 0.04 });
      tone(1175, 0.14, { type: "triangle", vol: 0.04, delay: 0.07, wet: 0.3 });
    },
    bye: () => melody([523, 392, 262], { step: 0.16, length: 0.3, type: "triangle", vol: 0.05 }),

    // --- player attacks ---
    hit: () => {
      // Crisp arcade-style click over a compact impact, synthesized at runtime.
      tone(1850, 0.025, { type: "square", slideTo: 820, vol: 0.035, lp: 4200, wet: 0 });
      noise(0.035, { vol: 0.035, f0: 2600, f1: 900, q: 1.2, wet: 0.02 });
      slash(0.075);
      thump(0.15, 175, 0.035);
    },
    heavy: () => {
      slash(0.14);
      thump(0.32, 120, 0.04);
      crunch(0.12, 0.04);
    },
    skill: () => {
      tone(1000, 0.22, { type: "sawtooth", slideTo: 200, vol: 0.06, lp: 3000 });
      slash(0.1, 0.04);
      thump(0.2, 140, 0.08);
      sparkle(3, 1500, 0.1, 0.025);
    },
    crit: () => {
      slash(0.13);
      thump(0.26, 140, 0.03);
      bell(1320, 0.4, { vol: 0.07, delay: 0.05 });
      sparkle(3, 1600, 0.1, 0.03);
    },
    guardHit: () => {
      thump(0.2, 100);
      bell(520, 0.25, { vol: 0.05, delay: 0.02 });
    },
    counter: () => {
      bell(900, 0.3, { vol: 0.07 });
      slash(0.12, 0.05);
      thump(0.22, 150, 0.07);
    },
    bonusTurn: () => melody([784, 1175], { step: 0.07, length: 0.14, type: "triangle", vol: 0.05 }),
    miss: () => whoosh(0.07, false, 0.2),

    // --- defence ---
    parry: () => {
      bell(1500, 0.28, { vol: 0.08 });
      noise(0.04, { vol: 0.08, f0: 5000, q: 0.5 });
    },
    perfectParry: () => {
      bell(1700, 0.45, { vol: 0.09 });
      bell(2300, 0.35, { vol: 0.05, delay: 0.06 });
      sparkle(4, 1400, 0.1, 0.035);
    },
    guard: () => {
      thump(0.24, 110);
      bell(380, 0.3, { vol: 0.05, delay: 0.01 });
    },
    guardUp: () => {
      tone(180, 0.12, { type: "triangle", vol: 0.08, slideTo: 260, wet: 0.1 });
      bell(480, 0.22, { vol: 0.04, delay: 0.06 });
    },
    ready: () => {
      tone(440, 0.07, { type: "triangle", vol: 0.04 });
      tone(660, 0.1, { type: "triangle", vol: 0.04, delay: 0.06 });
    },
    brace: () => tone(300, 0.15, { type: "triangle", vol: 0.04, slideTo: 450 }),
    dodge: () => whoosh(0.1, true, 0.2),
    stumble: () => {
      whoosh(0.05, true, 0.12);
      thump(0.15, 120, 0.1);
      tone(240, 0.16, { type: "triangle", vol: 0.04, slideTo: 150, delay: 0.1 });
    },
    denied: () => {
      tone(200, 0.12, { type: "sawtooth", vol: 0.05, lp: 700, wet: 0.05 });
      noise(0.1, { vol: 0.04, f0: 600, q: 2, delay: 0.02 });
    },
    run: () => {
      for (let i = 0; i < 5; i++) noise(0.04, { vol: 0.07, delay: i * 0.075, f0: 900, q: 1.5, wet: 0.02 });
    },

    // --- damage taken ---
    hurt: () => {
      tone(980, 0.035, { type: "square", slideTo: 360, vol: 0.04, lp: 2200, wet: 0 });
      thump(0.16, 118, 0.03);
      tone(170, 0.15, { type: "triangle", slideTo: 75, vol: 0.05, lp: 1200 });
      crunch(0.05);
    },
    hurtBig: () => {
      thump(0.4, 100);
      tone(120, 0.4, { type: "sawtooth", slideTo: 35, vol: 0.12, lp: 1000 });
      crunch(0.18);
      noise(0.5, { vol: 0.08, type: "lowpass", f0: 700, f1: 80, delay: 0.03 });
    },
    absorb: () => bell(700, 0.12, { vol: 0.03 }),
    drain: () => {
      tone(500, 0.3, { type: "sawtooth", slideTo: 160, vol: 0.05, lp: 1800 });
      tone(504, 0.3, { type: "sawtooth", slideTo: 162, vol: 0.04, lp: 1800 });
    },
    explosion: () => {
      noise(0.34, { vol: 0.13, type: "lowpass", f0: 1900, f1: 180, q: 0.7, wet: 0.14 });
      tone(105, 0.32, { vol: 0.16, slideTo: 48, wet: 0.06 });
      noise(0.12, { vol: 0.035, f0: 3800, f1: 1200, delay: 0.025, wet: 0.04 });
    },

    // --- enemy ---
    intent: () => {
      tone(98, 0.5, { type: "sawtooth", vol: 0.05, slideTo: 82, lp: 600, attack: 0.15, wet: 0.3 });
      bell(330, 0.5, { vol: 0.03, delay: 0.1 });
    },
    telegraph: () => {
      tone(165, 0.5, { type: "sawtooth", slideTo: 220, vol: 0.05, lp: 900, attack: 0.2, wet: 0.3 });
      tone(247, 0.45, { type: "triangle", slideTo: 330, vol: 0.04, delay: 0.1, attack: 0.15 });
    },
    stance: () => {
      bell(600, 0.3, { vol: 0.05 });
      tone(300, 0.2, { type: "triangle", vol: 0.04, delay: 0.05 });
    },
    enemyAttack: () => {
      tone(130, 0.3, { type: "sawtooth", vol: 0.09, slideTo: 70, lp: 1200 });
      noise(0.3, { vol: 0.07, f0: 300, f1: 1800, q: 0.8, attack: 0.1 });
    },
    skillCast: () => {
      tone(500, 0.25, { type: "sawtooth", slideTo: 1400, vol: 0.05, lp: 3500, wet: 0.25 });
      noise(0.25, { vol: 0.05, f0: 800, f1: 5000, q: 1, attack: 0.12 });
    },
    strike: () => noise(0.08, { vol: 0.07, f0: 3000, f1: 1000, q: 1 }),
    idle: () => {
      tone(200, 0.2, { type: "triangle", vol: 0.04, slideTo: 150, wet: 0.2 });
      tone(180, 0.25, { type: "triangle", vol: 0.03, slideTo: 130, delay: 0.18, wet: 0.2 });
    },
    stun: () => {
      for (let i = 0; i < 4; i++) {
        tone(i % 2 ? 700 : 520, 0.08, { type: "triangle", vol: 0.045, delay: i * 0.07, wet: 0.2 });
      }
      bell(1100, 0.2, { vol: 0.03 });
    },
    fizzle: () => noise(0.18, { vol: 0.035, type: "lowpass", f0: 1200, f1: 200, wet: 0.05 }),

    // --- status effects ---
    poison: () => {
      tone(220, 0.35, { type: "sine", vol: 0.07, slideTo: 150, wet: 0.2 });
      for (let i = 0; i < 3; i++) tone(300 + i * 90, 0.07, { vol: 0.035, delay: 0.05 + i * 0.09 });
    },
    burn: () => {
      noise(0.4, { vol: 0.12, f0: 3000, f1: 800, q: 0.6, attack: 0.05 });
      for (let i = 0; i < 4; i++) noise(0.03, { vol: 0.1, f0: rand(2000, 5000), delay: i * 0.08 + 0.02, q: 3 });
    },
    bleed: () => {
      tone(500, 0.07, { vol: 0.06, slideTo: 250 });
      tone(420, 0.09, { vol: 0.05, slideTo: 200, delay: 0.14 });
      thump(0.1, 90, 0.02);
    },
    tick: () => tone(260, 0.1, { type: "triangle", vol: 0.07, slideTo: 130, wet: 0.05 }),
    cure: () => {
      sparkle(4, 900, 0, 0.04);
      tone(660, 0.3, { type: "sine", vol: 0.04, delay: 0.1, wet: 0.4 });
    },
    status: () => {
      tone(560, 0.12, { type: "triangle", vol: 0.035, wet: 0.12 });
      tone(760, 0.16, { type: "sine", vol: 0.025, delay: 0.055, wet: 0.16 });
    },

    // --- items, healing, buffs ---
    potion: () => {
      for (let i = 0; i < 3; i++) tone(300 + i * 70, 0.06, { vol: 0.07, slideTo: 450 + i * 70, delay: i * 0.08, wet: 0.05 });
      bell(1200, 0.25, { vol: 0.03, delay: 0.26 });
    },
    heal: () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.28, { vol: 0.05, delay: i * 0.07, wet: 0.4 })
      );
    },
    energy: () => {
      tone(600, 0.12, { type: "square", vol: 0.03, slideTo: 1500, lp: 4000 });
      tone(1500, 0.1, { type: "triangle", vol: 0.04, delay: 0.1 });
    },
    buff: () => {
      melody([392, 523, 659], { step: 0.07, length: 0.14, type: "triangle", vol: 0.05, wet: 0.3 });
      noise(0.25, { vol: 0.03, f0: 1000, f1: 4000, q: 1, delay: 0.05 });
    },
    phoenix: () => {
      noise(0.9, { vol: 0.1, f0: 300, f1: 3500, q: 0.6, attack: 0.5, wet: 0.3 });
      [262, 330, 392, 523].forEach((f, i) =>
        tone(f, 0.9, { type: "triangle", vol: 0.05, delay: 0.1 + i * 0.12, attack: 0.1, wet: 0.5 })
      );
      sparkle(5, 1000, 0.5, 0.035);
    },

    // --- gear, crafting, trading ---
    equip: () => {
      bell(800, 0.18, { vol: 0.05 });
      noise(0.06, { vol: 0.06, f0: 4000, q: 1, delay: 0.01 });
      thump(0.08, 200, 0.05);
    },
    unequip: () => {
      noise(0.1, { vol: 0.05, f0: 2500, f1: 700, q: 1 });
      tone(400, 0.1, { type: "triangle", vol: 0.04, slideTo: 280, delay: 0.04 });
    },
    hammer: () => {
      for (let i = 0; i < 3; i++) {
        bell(1100 + i * 70, 0.2, { vol: 0.06, delay: i * 0.17, wet: 0.15 });
        thump(0.1, 220, i * 0.17);
      }
    },
    craftDone: () => {
      bell(1000, 0.45, { vol: 0.07 });
      sparkle(4, 1300, 0.1, 0.035);
    },
    coin: () => {
      bell(1976, 0.22, { vol: 0.045, wet: 0.2 });
      bell(2637, 0.3, { vol: 0.045, delay: 0.06, wet: 0.2 });
    },
    spend: () => {
      bell(2200, 0.15, { vol: 0.035 });
      bell(1650, 0.15, { vol: 0.035, delay: 0.06 });
      bell(1100, 0.2, { vol: 0.03, delay: 0.12 });
    },
    pickup: () => {
      tone(700, 0.06, { type: "triangle", vol: 0.05 });
      tone(1050, 0.09, { type: "triangle", vol: 0.045, delay: 0.05 });
    },
    drop: () => tone(350, 0.1, { type: "triangle", vol: 0.035, slideTo: 260 }),
    xp: () => melody([1047, 1319], { step: 0.06, length: 0.1, type: "triangle", vol: 0.03, wet: 0.3 }),
    lootFanfare: () => {
      melody([659, 784, 988, 1319], { step: 0.07, length: 0.14, type: "triangle", vol: 0.045, wet: 0.35 });
      bell(1568, 0.4, { vol: 0.04, delay: 0.3 });
    },
    sad: () => melody([330, 262], { step: 0.18, length: 0.3, type: "triangle", vol: 0.045, wet: 0.3 }),
    unlock: () => {
      bell(880, 0.3, { vol: 0.05 });
      bell(1175, 0.3, { vol: 0.05, delay: 0.1 });
      bell(1760, 0.5, { vol: 0.05, delay: 0.2 });
    },

    // --- turns, encounters, story ---
    turnPlayer: () => {
      tone(523, 0.1, { type: "triangle", vol: 0.05, wet: 0.25 });
      tone(784, 0.18, { type: "triangle", vol: 0.05, delay: 0.09, wet: 0.25 });
    },
    turnEnemy: () => {
      thump(0.25, 90);
      tone(110, 0.25, { type: "sawtooth", vol: 0.04, lp: 500, slideTo: 80, delay: 0.05 });
    },
    turnTick: () => tone(1400, 0.025, { type: "square", vol: 0.015, wet: 0 }),
    hint: () => tone(740, 0.12, { type: "sine", vol: 0.035, wet: 0.3 }),
    footsteps: () => {
      for (let i = 0; i < 6; i++) {
        noise(0.05, { vol: 0.06, delay: i * 0.17, type: "lowpass", f0: 700, f1: 250, wet: 0.1 });
        thump(0.05, 100, i * 0.17);
      }
    },
    ominous: () => {
      tone(65, 0.9, { type: "sawtooth", vol: 0.07, slideTo: 55, lp: 400, attack: 0.3, wet: 0.4 });
      tone(69, 0.9, { type: "sawtooth", vol: 0.05, lp: 400, attack: 0.3, wet: 0.4 });
    },
    area: () => {
      melody([294, 440, 587], { step: 0.18, length: 0.5, type: "triangle", vol: 0.04, wet: 0.5 });
    },
    questPing: () => {
      bell(988, 0.3, { vol: 0.05 });
      bell(1319, 0.4, { vol: 0.05, delay: 0.12 });
    },
    questComplete: () => {
      melody([523, 659, 784, 1047, 1319], { step: 0.08, length: 0.22, type: "triangle", vol: 0.05, wet: 0.4 });
      bell(1568, 0.6, { vol: 0.05, delay: 0.42 });
    },
    talk: () => tone(rand(280, 340), 0.045, { type: "square", vol: 0.018, lp: 1600, wet: 0.05 }),
    encounter: () => {
      tone(125, 0.32, { type: "triangle", slideTo: 72, vol: 0.065, lp: 900, wet: 0.16 });
      noise(0.24, { vol: 0.04, f0: 250, f1: 1100, q: 0.8, attack: 0.12 });
      thump(0.14, 90, 0.16);
    },
    warning: () => {
      for (let i = 0; i < 3; i++) {
        tone(880, 0.1, { type: "square", vol: 0.045, delay: i * 0.17, lp: 3000, wet: 0.1 });
        tone(660, 0.1, { type: "square", vol: 0.045, delay: i * 0.17 + 0.085, lp: 3000, wet: 0.1 });
      }
    },
    levelUp: () => {
      melody([523, 659, 784, 1047, 1319], { step: 0.085, length: 0.22, type: "triangle", vol: 0.06, wet: 0.4 });
      bell(1568, 0.7, { vol: 0.05, delay: 0.42 });
    },
    victory: () => {
      melody([392, 523, 659, 784], { step: 0.11, length: 0.28, type: "triangle", vol: 0.06, wet: 0.4 });
      tone(262, 0.7, { type: "triangle", vol: 0.04, delay: 0.1, wet: 0.4 });
      tone(784, 0.6, { type: "triangle", vol: 0.05, delay: 0.44, wet: 0.4 });
    },
    defeat: () => {
      melody([330, 262, 196, 147], { step: 0.2, length: 0.4, type: "sawtooth", vol: 0.05, wet: 0.4 });
      noise(0.9, { vol: 0.06, type: "lowpass", f0: 800, f1: 60, delay: 0.1, wet: 0.3 });
    },
    chapter: () => {
      melody([196, 247, 294, 392, 494], { step: 0.16, length: 0.45, type: "triangle", vol: 0.055, wet: 0.5 });
      bell(784, 0.9, { vol: 0.04, delay: 0.7 });
    },
    glitch: () => {
      for (let i = 0; i < 6; i++) {
        tone(rand(100, 1400), 0.045, { type: i % 2 ? "square" : "sawtooth", vol: 0.03, delay: i * 0.045, wet: 0.05 });
      }
      noise(0.25, { vol: 0.05, f0: 6000, f1: 500, q: 0.4, wet: 0.05 });
    },

    // --- enemy opening scenes ---
    openFrost: () => {
      noise(1.7, { vol: 0.07, f0: 400, f1: 2800, q: 0.7, attack: 0.9, wet: 0.3 });
      tone(880, 1.2, { type: "sine", vol: 0.03, delay: 0.2, attack: 0.6, wet: 0.5 });
      noise(0.07, { vol: 0.13, f0: 6500, f1: 2200, q: 0.5, delay: 1.0, wet: 0.2 });
      noise(0.07, { vol: 0.1, f0: 7000, f1: 2500, q: 0.5, delay: 1.25, wet: 0.2 });
      bell(2093, 0.9, { vol: 0.04, delay: 1.9 });
      sparkle(5, 1800, 1.5, 0.03);
    },
    openEmber: () => {
      noise(1.9, { vol: 0.1, type: "lowpass", f0: 200, f1: 2000, attack: 1.2, wet: 0.2 });
      tone(55, 1.9, { type: "sawtooth", vol: 0.07, slideTo: 90, lp: 320, attack: 0.9, wet: 0.2 });
      for (let i = 0; i < 9; i++) noise(0.03, { vol: 0.07, f0: rand(2500, 6000), q: 3, delay: 0.2 + i * 0.17, wet: 0.05 });
      noise(0.5, { vol: 0.12, f0: 3000, f1: 400, delay: 1.9, wet: 0.2 });
      thump(0.25, 90, 1.9);
    },
    openQuake: () => {
      noise(2.2, { vol: 0.08, type: "lowpass", f0: 160, f1: 60, attack: 0.3, wet: 0.2 });
      [0.3, 0.9, 1.5].forEach((t, i) => {
        thump(0.3 + i * 0.1, 85 - i * 10, t);
        crunch(0.12, t);
      });
    },
    openUmbra: () => {
      tone(58, 2.4, { type: "sawtooth", vol: 0.06, lp: 300, attack: 0.9, wet: 0.5 });
      tone(61, 2.4, { type: "sawtooth", vol: 0.045, lp: 300, attack: 0.9, wet: 0.5 });
      noise(1.6, { vol: 0.04, f0: 1400, f1: 900, q: 6, attack: 0.8, wet: 0.5 });
      bell(311, 1.4, { vol: 0.035, delay: 1.5, wet: 0.5 });
    },
    openCrown: () => {
      tone(98, 1.6, { type: "sawtooth", vol: 0.05, lp: 500, attack: 0.5, wet: 0.4 });
      noise(1.2, { vol: 0.05, f0: 600, f1: 4000, q: 1, attack: 0.9, wet: 0.3 });
      [392, 494, 587, 784].forEach((f, i) =>
        tone(f, 0.9, { type: "triangle", vol: 0.05, delay: 1.5 + i * 0.12, attack: 0.05, wet: 0.5 })
      );
      bell(1568, 1.1, { vol: 0.05, delay: 1.6 });
    },
    openRedline: () => {
      for (let i = 0; i < 4; i++) {
        slash(0.1, 0.5 + i * 0.45);
        for (let j = 0; j < 5; j++)
          tone(rand(900, 1400), 0.02, { type: "square", vol: 0.014, delay: 0.85 + i * 0.45 + j * 0.05, wet: 0 });
      }
      bell(660, 0.8, { vol: 0.03, delay: 2.3 });
    },
    openFang: () => {
      whoosh(0.09, true, 0.5);
      [0.55, 0.68, 0.81].forEach((t) => slash(0.15, t));
      thump(0.32, 110, 0.8);
      tone(210, 1.0, { type: "sawtooth", slideTo: 80, vol: 0.05, lp: 700, delay: 0.85, attack: 0.1, wet: 0.2 });
    },
    openEcho: () => {
      for (let i = 0; i < 6; i++)
        tone(660 - i * 70, 0.22, { type: "square", vol: 0.035, delay: i * 0.2, wet: 0.5, detune: i * 8, lp: 2400 });
      tone(60, 1.8, { type: "sawtooth", vol: 0.04, lp: 250, delay: 1, attack: 0.5, wet: 0.4 });
      noise(0.5, { vol: 0.05, f0: 6000, f1: 500, q: 0.4, delay: 1.2, wet: 0.1 });
    },
    openPage: () => {
      noise(0.5, { vol: 0.06, f0: 800, f1: 3500, q: 0.7, delay: 0.3 });
      tone(330, 1.6, { type: "triangle", vol: 0.04, delay: 0.6, attack: 0.5, wet: 0.6 });
      bell(1320, 1.2, { vol: 0.04, delay: 1.5 });
      noise(1.0, { vol: 0.05, type: "lowpass", f0: 2000, f1: 100, delay: 1.6, wet: 0.3 });
    },

    openToll: () => {
      [[0.5, 196], [1.05, 175], [1.6, 156], [2.15, 131]].forEach(([t, f]) => {
        bell(f, 1.6, { vol: 0.09, delay: t, wet: 0.5 });
        thump(0.18, 80, t);
      });
      tone(65, 2.6, { type: "sine", vol: 0.04, attack: 1.2, wet: 0.5 });
    },
    openMap: () => {
      for (let i = 0; i < 9; i++) noise(0.1, { vol: 0.04, f0: rand(2500, 4500), q: 2, delay: i * 0.12, wet: 0.05 });
      tone(440, 2.2, { type: "triangle", slideTo: 880, vol: 0.03, delay: 0.3, attack: 0.5, wet: 0.5 });
      sparkle(4, 1400, 1.0, 0.025);
      tone(330, 0.9, { type: "sawtooth", slideTo: 70, vol: 0.05, lp: 700, delay: 2.4, wet: 0.4 });
    },
  };

  // How long (seconds) each sound occupies the queue before the next one may start. Short
  // sounds use the default; fanfares reserve more so they don't get trampled.
  const DURATION = {
    levelUp: 0.9, victory: 0.9, defeat: 1.3, chapter: 1.4, questComplete: 1, phoenix: 1.2,
    lootFanfare: 0.55, unlock: 0.5, explosion: 0.5, hurtBig: 0.35, ominous: 0.8, footsteps: 0.8,
    area: 0.8, warning: 0.55, heal: 0.4, glitch: 0.35, encounter: 0.5, craftDone: 0.4,
    hammer: 0.5, intent: 0.4, telegraph: 0.4, crit: 0.3, burn: 0.35, poison: 0.3, run: 0.4,
    skill: 0.3, heavy: 0.2, potion: 0.4,
    openFrost: 2.5, openEmber: 2.5, openQuake: 2.5, openUmbra: 2.5, openCrown: 2.5, openRedline: 2.5, openFang: 2.5, openEcho: 2.5, openPage: 2.5, openToll: 2.5, openMap: 2.5,
  };
  const IMPORTANT = new Set([
    "levelUp", "victory", "defeat", "chapter", "questComplete", "phoenix", "unlock", "hurt",
    "hurtBig", "crit", "warning", "encounter", "enter",
    "openFrost", "openEmber", "openQuake", "openUmbra", "openCrown", "openRedline", "openFang", "openEcho", "openPage", "openToll", "openMap",
  ]);

  // Plays a named sound. Sounds triggered in the same instant are lined up one after another
  // (a burst of lines becomes a short sequence instead of one smeared noise).
  function play(name) {
    if (!soundOn || !audio || audio.state !== "running" || !SOUNDS[name]) return;
    const now = audio.currentTime;
    const start = Math.max(now, cursor);
    if (start - now > 0.8 && !IMPORTANT.has(name)) return; // too far behind: drop the small stuff
    base = start - now;
    try {
      SOUNDS[name]();
    } catch (e) {}
    base = 0;
    cursor = start + (DURATION[name] || 0.11);
  }

  // Typewriter "dialogue" blip: a tiny pitched click per letter, used for slow, spoken-style text.
  let lastBlip = 0;
  function blip(kind = "talk") {
    if (!soundOn || !audio || audio.state !== "running") return;
    const now = performance.now();
    if (now - lastBlip < 48) return;
    lastBlip = now;
    base = 0;
    const pitch = kind === "intent" ? rand(150, 190) : rand(260, 340);
    tone(pitch, 0.05, { type: "square", vol: 0.016, lp: 1400, wet: 0.05 });
  }

  function setSound(on, announce = false) {
    soundOn = on;
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch (e) {}
    const button = document.getElementById("soundToggle");
    if (button) button.textContent = on ? "🔊 Sound on" : "🔇 Sound off";
    if (on && announce) {
      unlockAudio();
      if (audio) play("yes");
      if (!activeBattleMusic) startAmbientMusic();
    }
    // This setting controls sound effects only. Music has its own volume slider.
  }

  function setMusicVolume(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const previousVolume = musicVolume;
    musicVolume = Math.max(0, Math.min(100, Math.round(parsed)));
    try {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume));
    } catch (e) {}
    const slider = document.getElementById("musicVolume");
    const output = document.getElementById("musicVolumeValue");
    if (slider) slider.value = String(musicVolume);
    if (output) output.textContent = `${musicVolume}%`;
    if (battleAudio) battleAudio.volume = musicVolume / 100;
    if (musicVolume === 0) {
      pauseBattleMusic();
      if (musicBus && audio) musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.12);
    } else if (musicBus && audio && activeBattleMusic && (!activeBattleMusic.musicFile || activeBattleMusic.fileFailed)) {
      musicBus.gain.setTargetAtTime(musicVolume / 100, audio.currentTime, 0.12);
    }
    if (previousVolume === 0 && musicVolume > 0 && activeBattleMusic) resumeBattleMusic();
  }

  // Original procedural battle themes. Enemy families share a musical palette, while a stable
  // name-based seed changes the melody so repeated encounters aren't all identical.
  function battleTheme(enemyNames, boss, musicProfile = null) {
    const label = (Array.isArray(enemyNames) ? enemyNames : [enemyNames]).join(" ").toLowerCase();
    let theme;
    if (boss) theme = { root: 110, scale: [0, 3, 5, 7, 10], wave: "sawtooth", tempo: 104 };
    else if (/frost|ice|snow|winter|glacier/.test(label)) theme = { root: 146.83, scale: [0, 2, 5, 7, 9], wave: "triangle", tempo: 92 };
    else if (/fire|ash|demon|lava|dragon/.test(label)) theme = { root: 130.81, scale: [0, 3, 4, 7, 10], wave: "sawtooth", tempo: 108 };
    else if (/stone|golem|earth|rock|orc/.test(label)) theme = { root: 98, scale: [0, 2, 4, 7, 9], wave: "triangle", tempo: 86 };
    else if (/shadow|wraith|undead|king|watcher|archivist|editor|author/.test(label)) theme = { root: 116.54, scale: [0, 3, 5, 8, 10], wave: "sine", tempo: 96 };
    else theme = { root: 130.81, scale: [0, 2, 4, 7, 9], wave: "triangle", tempo: 100 };
    let seed = 0;
    for (let i = 0; i < label.length; i++) seed = (seed * 31 + label.charCodeAt(i)) >>> 0;
    if (musicProfile && typeof musicProfile === "object") theme = { ...theme, ...musicProfile };
    else if (typeof musicProfile === "string") {
      for (let i = 0; i < musicProfile.length; i++) seed = (seed * 31 + musicProfile.charCodeAt(i)) >>> 0;
    }
    return { ...theme, seed };
  }

  function musicNote(frequency, start, length, volume, wave) {
    if (!audio || !musicBus) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(musicBus);
    osc.start(start);
    osc.stop(start + length + 0.03);
  }

  function pauseBattleMusic() {
    if (battleMusicTimer !== null) clearInterval(battleMusicTimer);
    battleMusicTimer = null;
    if (battleAudioFallbackTimer !== null) clearTimeout(battleAudioFallbackTimer);
    battleAudioFallbackTimer = null;
    if (battleAudio) battleAudio.pause();
  }

  function fallbackToSynthesizedMusic(generation, track) {
    if (generation !== battleMusicGeneration || !activeBattleMusic || activeBattleMusic !== track) return;
    if (battleAudioFallbackTimer !== null) clearTimeout(battleAudioFallbackTimer);
    battleAudioFallbackTimer = null;
    if (battleAudio) {
      battleAudio.onerror = null;
      battleAudio.pause();
    }
    battleAudio = null;
    battleAudioUrl = null;
    track.musicFile = null;
    track.fileFailed = true;
    resumeBattleMusic();
  }

  function playEnemyMusicFile(track) {
    const generation = battleMusicGeneration;
    if (!track?.musicFile || musicVolume <= 0 || !activeBattleMusic) return;
    if (typeof Audio === "undefined") {
      fallbackToSynthesizedMusic(generation, track);
      return;
    }
    const url = track.distorted && track.distortionFile ? track.distortionFile : track.musicFile;
    if (!battleAudio || battleAudioUrl !== url) {
      if (battleAudio) {
        battleAudio.onerror = null;
        battleAudio.pause();
      }
      battleAudio = new Audio(url);
      battleAudioUrl = url;
      battleAudio.loop = true;
      battleAudio.preload = "auto";
      battleAudio.volume = musicVolume / 100;
      battleAudio.onerror = () => fallbackToSynthesizedMusic(generation, track);
    }
    const player = battleAudio;
    if (musicBus && audio) musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.18);
    const onTrackStarted = () => {
      if (generation !== battleMusicGeneration || activeBattleMusic !== track) {
        player.pause();
        return;
      }
      if (battleAudioFallbackTimer !== null) clearTimeout(battleAudioFallbackTimer);
      battleAudioFallbackTimer = null;
      if (musicBus && audio) musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.18);
    };
    player.onplaying = onTrackStarted;
    if (battleAudioFallbackTimer !== null) clearTimeout(battleAudioFallbackTimer);
    battleAudioFallbackTimer = setTimeout(() => fallbackToSynthesizedMusic(generation, track), 6000);
    let attempt;
    try {
      attempt = player.play();
    } catch (error) {
      fallbackToSynthesizedMusic(generation, track);
      return;
    }
    if (attempt && typeof attempt.then === "function") {
      attempt.then(onTrackStarted).catch(() => fallbackToSynthesizedMusic(generation, track));
    }
  }

  function resumeBattleMusic() {
    if (!activeBattleMusic || musicVolume <= 0) return;
    if (activeBattleMusic.musicFile && !activeBattleMusic.fileFailed) {
      playEnemyMusicFile(activeBattleMusic);
      return;
    }
    unlockAudio();
    if (!audio) return;
    const begin = () => {
      if (!activeBattleMusic || musicVolume <= 0 || audio.state !== "running" || battleMusicTimer !== null) return;
      musicBus.gain.setTargetAtTime(musicVolume / 100, audio.currentTime, 0.25);
      const theme = activeBattleMusic.theme;
      const beat = 60 / theme.tempo;
      const barLength = beat * 4;
      const melody = [0, 2, 4, 2, 5, 4, 2, 1];
      const playBar = () => {
        if (!activeBattleMusic || musicVolume <= 0 || !audio || audio.state !== "running") return;
        const now = audio.currentTime + 0.04;
        const bar = activeBattleMusic.bar++;
        const scale = theme.scale;
        const chordRoot = (bar % 4 === 2 ? 3 : bar % 4 === 3 ? 4 : 0);
        [0, 2, 4].forEach((interval, i) => {
          const semitone = scale[(chordRoot + interval) % scale.length] + (i === 0 ? -12 : 0);
          musicNote(theme.root * Math.pow(2, semitone / 12), now, barLength * 0.82, 0.025, "triangle");
        });
        [0, 2].forEach((beatIndex) => {
          const bassStep = scale[(chordRoot + beatIndex * 2) % scale.length] - 24;
          musicNote(theme.root * Math.pow(2, bassStep / 12), now + beat * beatIndex, beat * 1.3, 0.045, "sine");
        });
        for (let i = 0; i < 8; i++) {
          const step = (melody[(i + (theme.seed % melody.length) + bar) % melody.length] + (bar % 2 ? 1 : 0)) % scale.length;
          const octave = i === 3 || i === 7 ? 2 : 1;
          if ((i + theme.seed) % 5 !== 0) {
            musicNote(theme.root * Math.pow(2, (scale[step] + 12 * octave) / 12), now + i * beat / 2, beat * 0.34, activeBattleMusic.boss ? 0.035 : 0.025, theme.wave);
          }
        }
      };
      playBar();
      battleMusicTimer = setInterval(playBar, barLength * 1000);
    };
    if (audio.state === "suspended") audio.resume().then(begin).catch(() => {});
    else begin();
  }

  function startBattleMusic(enemyNames, boss = false, musicProfile = null, musicFile = null) {
    clearMusicDistortion();
    pauseBattleMusic();
    battleMusicGeneration++;
    const cleanFile = typeof musicFile === "string" ? musicFile.trim() : null;
    activeBattleMusic = {
      theme: battleTheme(enemyNames, boss, musicProfile),
      boss: Boolean(boss),
      bar: 0,
      musicFile: cleanFile,
      distortionFile: cleanFile?.replace("audio/remastered/", "audio/distorted/") || null,
      distorted: false,
      fileFailed: false,
    };
    resumeBattleMusic();
  }

  function clearMusicDistortion() {
    if (musicDistortionTimer !== null) clearTimeout(musicDistortionTimer);
    musicDistortionTimer = null;
  }

  function setMusicDistortion(enabled, duration = 0) {
    const track = activeBattleMusic;
    if (!track?.distortionFile) return;
    clearMusicDistortion();
    const next = Boolean(enabled);
    if (track.distorted !== next) {
      track.distorted = next;
      pauseBattleMusic();
      battleMusicGeneration++;
      resumeBattleMusic();
    }
    if (next && duration > 0) {
      musicDistortionTimer = setTimeout(() => {
        musicDistortionTimer = null;
        if (activeBattleMusic === track) setMusicDistortion(false);
      }, duration);
    }
  }

  let lastAmbientMusicIndex = -1;
  const ambientMusicFiles = [
    "the-quiet-road",
    "the-ruined-sanctuary",
    "the-starlit-archive",
    "the-ashen-wilds",
  ];

  function startAmbientMusic() {
    if (activeBattleMusic?.ambient) {
      resumeBattleMusic();
      return;
    }
    clearMusicDistortion();
    pauseBattleMusic();
    battleMusicGeneration++;
    if (battleAudio) {
      battleAudio.onerror = null;
      battleAudio.pause();
    }
    battleAudio = null;
    battleAudioUrl = null;
    const offset = 1 + Math.floor(Math.random() * (ambientMusicFiles.length - 1));
    lastAmbientMusicIndex = (lastAmbientMusicIndex + offset) % ambientMusicFiles.length;
    const cleanFile = `audio/remastered/ambient/${ambientMusicFiles[lastAmbientMusicIndex]}.wav`;
    activeBattleMusic = {
      theme: battleTheme("the quiet road", false, { root: 110, scale: [0, 2, 4, 7, 9], wave: "sine", tempo: 76 }),
      boss: false,
      bar: 0,
      musicFile: cleanFile,
      distortionFile: cleanFile.replace("audio/remastered/", "audio/distorted/"),
      distorted: false,
      fileFailed: false,
      ambient: true,
    };
    resumeBattleMusic();
  }

  function stopBattleMusic() {
    clearMusicDistortion();
    pauseBattleMusic();
    battleMusicGeneration++;
    if (battleAudio) {
      battleAudio.onerror = null;
      battleAudio.pause();
    }
    battleAudio = null;
    battleAudioUrl = null;
    activeBattleMusic = null;
    if (musicBus && audio) musicBus.gain.setTargetAtTime(0, audio.currentTime, 0.16);
    startAmbientMusic();
  }

    // ---------- Screen effects ----------

  const flashLayer = document.createElement("div");
  flashLayer.className = "fx-flash";
  terminal.appendChild(flashLayer);

  // Restarts a CSS animation by removing the class, forcing a reflow, then adding it back.
  function restartClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function flash(color) {
    if (reduceMotion) return;
    flashLayer.style.background = color;
    restartClass(flashLayer, "on");
  }

  function shake(strong = false) {
    if (reduceMotion) return;
    terminal.classList.remove("shake", "shake-strong");
    void terminal.offsetWidth;
    terminal.classList.add(strong ? "shake-strong" : "shake");
  }

  // Brief screen distortions let endgame bosses rupture the terminal without trapping the UI.
  function corrupt(kind = "glitch", duration = 1700) {
    const mode = ["glitch", "fracture", "tear"].includes(kind) ? kind : "glitch";
    if (!terminal) return;
    let overlay = terminal.querySelector(".terminal-corruption");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "terminal-corruption";
      overlay.setAttribute("aria-hidden", "true");
      terminal.prepend(overlay);
    }
    terminal.classList.remove("terminal-corrupted", "corrupt-glitch", "corrupt-fracture", "corrupt-tear");
    void terminal.offsetWidth;
    terminal.classList.add("terminal-corrupted", "corrupt-" + mode);
    if (mode === "fracture") shake(true);
    flash(mode === "tear" ? "rgba(190, 45, 255, 0.2)" : "rgba(130, 115, 255, 0.18)");
    play(mode === "fracture" ? "hurtBig" : "warning");
    const life = Math.max(700, Math.min(4000, Number(duration) || 1700));
    setMusicDistortion(true, life);
    if (corruptionTimer !== null) clearTimeout(corruptionTimer);
    corruptionTimer = setTimeout(() => {
      terminal.classList.remove("terminal-corrupted", "corrupt-glitch", "corrupt-fracture", "corrupt-tear");
      corruptionTimer = null;
    }, life);
  }

  // A short split-screen cut with a central void and a mostly-hash glyph burst.
  function realityCut(duration = 2600) {
    if (!terminal) return;
    const previous = terminal.querySelector(".last-save-cut");
    if (previous) previous.remove();
    const overlay = document.createElement("div");
    overlay.className = "last-save-cut";
    overlay.setAttribute("aria-hidden", "true");
    const left = document.createElement("div");
    left.className = "cut-half cut-half-left";
    const right = document.createElement("div");
    right.className = "cut-half cut-half-right";
    const seam = document.createElement("div");
    seam.className = "cut-seam";
    const voidBox = document.createElement("div");
    voidBox.className = "cut-void";
    const field = document.createElement("div");
    field.className = "cut-hash-field";
    for (let i = 0; i < 96; i++) {
      const glyph = document.createElement("span");
      glyph.className = "cut-glyph";
      glyph.textContent = Math.random() < 0.84
        ? "#"
        : ["@", "%", "&", "/", "!", "?", "0", "1"][Math.floor(Math.random() * 8)];
      glyph.style.left = (Math.random() * 98) + "%";
      glyph.style.top = (Math.random() * 96) + "%";
      glyph.style.setProperty("--glyph-delay", Math.floor(Math.random() * 520) + "ms");
      glyph.style.setProperty("--glyph-drift", (Math.random() * 36 - 18) + "px");
      field.appendChild(glyph);
    }
    overlay.append(left, right, seam, voidBox, field);
    terminal.appendChild(overlay);
    play("warning");
    const life = reduceMotion ? 900 : Math.max(1800, Math.min(4000, Number(duration) || 2600));
    setMusicDistortion(true, life);
    setTimeout(() => overlay.remove(), life + 80);
  }

  function attackCutscene(kind) {
    const styles = {
      "logo-fall": { glyphs: ["THE LAST SAVE", "LAST SAVE", "LS"], count: 18, duration: 2250 },
      "crown-shards": { glyphs: ["♛", "◆", "╱", "✦"], count: 26, duration: 1800 },
      "moon-pounce": { glyphs: ["☾", "╱", "／", "✧"], count: 12, duration: 1450 },
      "core-eruption": { glyphs: ["◆", "▲", "✦", "●"], count: 24, duration: 1900 },
      "whiteout": { glyphs: ["❄", "✧", "░", "❅"], count: 30, duration: 1900 },
      "cinder-collapse": { glyphs: ["✦", "•", "▲", "╱"], count: 28, duration: 2100 },
      "page-storm": { glyphs: ["▤", "§", "¶", "▧"], count: 20, duration: 1900 },
      "redline-slice": { glyphs: [""], count: 7, duration: 1350 },
      "void-pulse": { glyphs: ["#", "0", "?", "∅"], count: 26, duration: 1800 },
    };
    const style = styles[kind];
    if (!terminal || !style) return Promise.resolve();
    const scene = document.createElement("div");
    scene.className = "boss-attack-scene attack-" + kind;
    scene.setAttribute("aria-hidden", "true");
    for (let i = 0; i < style.count; i++) {
      const mark = document.createElement("span");
      mark.className = "boss-attack-mark";
      mark.textContent = style.glyphs[Math.floor(Math.random() * style.glyphs.length)];
      mark.style.left = (kind === "redline-slice" ? 0 : Math.random() * 88) + "%";
      mark.style.top = (kind === "redline-slice" ? (i + 1) * 12 : Math.random() * 88) + "%";
      mark.style.setProperty("--attack-delay", Math.floor(Math.random() * 240) + "ms");
      mark.style.setProperty("--attack-drift", Math.floor(Math.random() * 150 - 75) + "px");
      mark.style.setProperty("--attack-tilt", Math.floor(Math.random() * 36 - 18) + "deg");
      scene.appendChild(mark);
    }
    terminal.appendChild(scene);
    play("warning");
    return new Promise((resolve) => setTimeout(() => {
      scene.remove();
      resolve();
    }, reduceMotion ? 360 : style.duration));
  }

  // ---------- Enemy opening scenes ----------
  // A short cinematic that plays before a fight starts: letterbox bars, a themed effect, then the
  // enemy's name card. Each scene builds its own DOM, injects its own CSS the first time it is
  // used (no stylesheet changes needed) and has its own synthesized sound (see SOUNDS.open*).
  //
  // Enemies opt in with a `scene` on their opening in monsters.js, e.g.
  //   opening: { title, lines, effect, scene: "frost", color: "#bfe8ff", sub: "…" }
  // (color and sub are optional overrides). Preview any scene from the browser console with
  //   FX.openingScene("frost", { name: "Frost Giant" })
  // Enter / Space / Escape / a click skips it.
  const OPENINGS = {
    frost: { color: "#bfe8ff", sub: "The air forgets how to move.", ms: 3100, sound: "openFrost" },
    ember: { color: "#ff8a3c", sub: "Something old is still burning.", ms: 3100, sound: "openEmber" },
    quake: { color: "#d6c1a0", sub: "The ground remembers its weight.", ms: 3100, sound: "openQuake" },
    umbra: { color: "#b48cff", sub: "It was watching before you arrived.", ms: 3300, sound: "openUmbra" },
    crown: { color: "#ffd45e", sub: "Every throne is a promise someone broke.", ms: 3500, sound: "openCrown" },
    redline: { color: "#ff6b6b", sub: "Your story is under revision.", ms: 3500, sound: "openRedline" },
    fang: { color: "#e9edff", sub: "The hunt began before your first step.", ms: 2700, sound: "openFang" },
    echo: { color: "#7fffe0", sub: "You have been here before.", ms: 3500, sound: "openEcho" },
    page: { color: "#ffffff", sub: "Something was removed from this chapter.", ms: 3500, sound: "openPage" },
    toll: { color: "#ffb36b", sub: "Something rang. Nothing struck it.", ms: 3400, sound: "openToll" },
    map: { color: "#8fe3c0", sub: "Every road ends where you stop looking.", ms: 3500, sound: "openMap" },
  };
  // mk("class", "text", { "--css-var": "value" }) -> <div>
  function mk(cls, text = "", vars = {}) {
    const el = document.createElement("div");
    el.className = cls;
    if (text) el.textContent = text;
    for (const key in vars) el.style.setProperty(key, vars[key]);
    return el;
  }

  // Jagged lines that draw themselves outward from a point (ice cracks, ground fissures).
  function crackSvg(count, color, cx = 50, cy = 32) {
    let paths = "";
    for (let b = 0; b < count; b++) {
      let a = (b / count) * Math.PI * 2 + rand(-0.3, 0.3);
      let x = cx;
      let y = cy;
      const pts = [`${x},${y}`];
      for (let s = 0; s < 6; s++) {
        a += rand(-0.55, 0.55);
        const len = rand(5, 11);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len * 0.62;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      paths += `<polyline points="${pts.join(" ")}" pathLength="1" style="animation-delay:${(0.9 + b * 0.05).toFixed(2)}s"/>`;
    }
    const wrap = mk("fo-cracks");
    wrap.innerHTML = `<svg viewBox="0 0 100 64" preserveAspectRatio="none" style="--cc:${color}">${paths}</svg>`;
    return wrap;
  }

  const pct = (a, b) => rand(a, b).toFixed(1) + "%";
  const secs = (a, b) => rand(a, b).toFixed(2) + "s";

  // One builder per scene. `o` is the overlay, `ctx.later(fn, ms)` schedules a timed effect that is
  // cancelled automatically if the scene is skipped.
  const BUILDERS = {
    frost(o) {
      o.append(mk("fo-frost-ring"), crackSvg(9, "#eaf8ff"));
      for (let i = 0; i < 28; i++)
        o.append(mk("fo-fall", ["❄", "✧", "❅"][i % 3], { "--x": pct(0, 100), "--d": secs(0, 1.6), "--t": secs(1.6, 2.8), "--s": rand(12, 26).toFixed(0) + "px" }));
      o.append(mk("fo-pulse", "", { "--pc": "#eefaff", "--pd": "1.95s" }));
    },
    ember(o) {
      o.append(mk("fo-ember-glow"));
      for (let i = 0; i < 36; i++)
        o.append(mk("fo-rise", ["•", "✦", "·", "▲"][i % 4], { "--x": pct(2, 98), "--d": secs(0, 1.8), "--t": secs(1.4, 2.5), "--s": rand(10, 24).toFixed(0) + "px", "--dx": rand(-60, 60).toFixed(0) + "px" }));
      o.append(mk("fo-pulse", "", { "--pc": "#ffb066", "--pd": "1.9s" }));
    },
    quake(o, ctx) {
      o.append(mk("fo-dust-veil"), crackSvg(8, "#ffb25c", 50, 58));
      for (let i = 0; i < 24; i++)
        o.append(mk("fo-fall rock", ["▲", "◆", "░", "▒"][i % 4], { "--x": pct(0, 100), "--d": secs(0.2, 2), "--t": secs(0.9, 1.7), "--s": rand(10, 24).toFixed(0) + "px" }));
      [300, 900, 1500].forEach((ms) =>
        ctx.later(() => {
          shake(true);
          flash("rgba(255, 200, 120, 0.16)");
        }, ms)
      );
    },
    umbra(o) {
      o.append(mk("fo-iris"));
      const eyes = mk("fo-eyes");
      eyes.append(mk("fo-eye"), mk("fo-eye"));
      o.append(eyes);
      for (let i = 0; i < 12; i++)
        o.append(mk("fo-whisper", ["…", "?", "∅", "…"][i % 4], { "--x": pct(5, 92), "--y": pct(15, 75), "--d": secs(0.4, 2) }));
    },
    crown(o, ctx) {
      for (let i = 0; i < 30; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(55, 95);
        o.append(mk("fo-shard", ["◆", "╱", "✦", "▲"][i % 4], { "--sx": (Math.cos(a) * r).toFixed(0) + "vmin", "--sy": (Math.sin(a) * r * 0.8).toFixed(0) + "vmin", "--r": rand(-360, 360).toFixed(0) + "deg", "--d": secs(0, 0.9) }));
      }
      o.append(mk("fo-crown", "♛"), mk("fo-pulse", "", { "--pc": "#ffe9a0", "--pd": "1.5s", "--po": "0.3" }));
      ctx.later(() => shake(false), 1550);
    },
    redline(o) {
      const rows = [
        ["> the hero arrives on the quiet road.", "> the hero was never here."],
        ["> the hero is brave.", "> the hero is a placeholder."],
        ["> the ending is yours to choose.", "> the ending was chosen for you."],
        ["> you are the author.", "> you are a character."],
      ];
      const paper = mk("fo-paper");
      rows.forEach(([oldText, newText], i) => {
        const row = mk("fo-row", "", { "--d": (0.55 + i * 0.45).toFixed(2) + "s" });
        row.append(mk("fo-old", oldText), mk("fo-strike"), mk("fo-new", newText));
        paper.append(row);
      });
      o.append(paper);
    },
    fang(o, ctx) {
      o.append(mk("fo-moon", "☾"));
      [0, 1, 2].forEach((i) => o.append(mk("fo-claw", "", { "--top": 16 + i * 8 + "%", "--d": (0.55 + i * 0.13).toFixed(2) + "s" })));
      ctx.later(() => {
        shake(true);
        flash("rgba(255, 255, 255, 0.26)");
      }, 780);
    },
    echo(o) {
      o.append(mk("fo-scan"));
      const list = mk("fo-attempts");
      const verdict = ["FAILED", "FAILED", "SAVED", "FAILED", "LOST"];
      for (let i = 0; i < 14; i++)
        list.append(mk("fo-attempt", `ATTEMPT ${String(i + 1).padStart(2, "0")} · ${verdict[i % 5]}`, { "--d": (i * 0.11).toFixed(2) + "s" }));
      o.append(list);
    },
    page(o) {
      const sheet = mk("fo-sheet");
      sheet.append(mk("fo-sheet-head", "p. ▒▒"));
      for (let i = 0; i < 9; i++) sheet.append(mk("fo-sheet-line", "", { "--w": rand(55, 100).toFixed(0) + "%" }));
      sheet.append(mk("fo-hole"));
      o.append(sheet);
    },
  };

  BUILDERS.toll = (o, ctx) => {
    o.append(mk("fo-bell", "🔔"));
    [0.5, 1.05, 1.6, 2.15].forEach((t) => {
      o.append(mk("fo-ring", "", { "--d": t + "s" }));
      ctx.later(() => {
        shake(false);
        flash("rgba(255, 170, 90, 0.12)");
      }, t * 1000);
    });
  };

  BUILDERS.map = (o) => {
    let svg = "";
    for (let i = 1; i < 10; i++) svg += `<polyline class="g" points="${i * 10},0 ${i * 10},64" pathLength="1" style="--gd:${(i * 0.06).toFixed(2)}s"/>`;
    for (let i = 1; i < 6; i++) svg += `<polyline class="g" points="0,${i * 10.6} 100,${i * 10.6}" pathLength="1" style="--gd:${(i * 0.08).toFixed(2)}s"/>`;
    svg += '<polyline class="r" points="6,54 18,46 30,50 42,36 55,40 68,24 80,28 93,12 104,3" pathLength="1"/>';
    const wrap = mk("fo-map");
    wrap.innerHTML = `<svg viewBox="0 0 100 64" preserveAspectRatio="none">${svg}</svg>`;
    o.append(wrap, mk("fo-compass", "🧭"), mk("fo-pulse", "", { "--pc": "#8fe3c0", "--pd": "2.2s" }));
  };

  const OPENING_CSS = `
.fx-open{position:absolute;inset:0;z-index:60;overflow:hidden;pointer-events:none;background:rgba(0,0,4,.82);animation:fo-fade-in .4s ease-out both}
.fx-open.out{animation:fo-fade-out .45s ease-in forwards}
@keyframes fo-fade-in{from{opacity:0}}
@keyframes fo-fade-out{to{opacity:0}}
.fx-open.calm *{animation:none!important}
.fo-bar{position:absolute;left:0;right:0;height:14%;background:#000;z-index:5}
.fo-bar.top{top:0;animation:fo-bar-t .55s cubic-bezier(.2,.8,.2,1) both}
.fo-bar.bot{bottom:0;animation:fo-bar-b .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes fo-bar-t{from{transform:translateY(-100%)}}
@keyframes fo-bar-b{from{transform:translateY(100%)}}
.fo-title{position:absolute;left:0;right:0;bottom:19%;z-index:6;text-align:center;text-transform:uppercase;font-weight:700;letter-spacing:.32em;font-size:clamp(18px,4vw,38px);color:#fff;white-space:nowrap;text-shadow:0 0 3px #000,0 2px 10px #000,0 0 14px var(--oc),0 0 34px var(--oc);animation:fo-title-in 1.1s .75s cubic-bezier(.2,.8,.2,1) both}
@keyframes fo-title-in{from{opacity:0;letter-spacing:.6em;filter:blur(8px)}}
.fo-title.long{font-size:clamp(14px,3vw,28px);letter-spacing:.2em}
.fo-sub{position:absolute;left:0;right:0;bottom:15.2%;z-index:6;text-align:center;font-size:clamp(10px,1.6vw,14px);letter-spacing:.22em;text-transform:uppercase;color:var(--oc);text-shadow:0 1px 6px #000,0 0 3px #000;opacity:.85;animation:fo-sub-in .8s 1.5s ease-out both}
@keyframes fo-sub-in{from{opacity:0;transform:translateY(6px)}}
.fo-fall,.fo-rise,.fo-whisper,.fo-shard{position:absolute}
.fo-pulse{position:absolute;inset:0;background:var(--pc);opacity:0;animation:fo-pulse .6s var(--pd) ease-out both}
@keyframes fo-pulse{0%{opacity:0}20%{opacity:var(--po,.7)}100%{opacity:0}}
.fo-cracks{position:absolute;inset:0}
.fo-cracks svg{width:100%;height:100%}
.fo-cracks polyline{fill:none;stroke:var(--cc);stroke-width:2;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;animation:fo-draw .35s ease-out forwards;filter:drop-shadow(0 0 4px var(--cc))}
@keyframes fo-draw{to{stroke-dashoffset:0}}
/* frost */
.fo-frost-ring{position:absolute;inset:0;animation:fo-frost-grow 1.7s ease-out both}
@keyframes fo-frost-grow{from{box-shadow:inset 0 0 0 0 rgba(200,235,255,0)}to{box-shadow:inset 0 0 150px 60px rgba(200,235,255,.8),inset 0 0 36px 8px #fff}}
.fo-fall{left:var(--x);top:-8%;font-size:var(--s);color:#e8f6ff;opacity:0;animation:fo-fall var(--t) var(--d) linear infinite}
.fo-fall.rock{color:#b8a58a;text-shadow:0 0 6px rgba(0,0,0,.6)}
@keyframes fo-fall{0%{top:-8%;opacity:0;transform:rotate(0)}10%{opacity:.9}100%{top:108%;opacity:.3;transform:rotate(260deg)}}
/* ember */
.fo-ember-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 120%,rgba(255,110,30,.75),rgba(180,30,0,.25) 45%,transparent 70%);animation:fo-glow 1.1s ease-in-out infinite alternate}
@keyframes fo-glow{from{opacity:.55;transform:scale(1)}to{opacity:1;transform:scale(1.08)}}
.fo-rise{left:var(--x);top:105%;font-size:var(--s);color:#ffb347;text-shadow:0 0 8px #ff6a00;opacity:0;animation:fo-rise var(--t) var(--d) ease-out infinite}
@keyframes fo-rise{0%{top:105%;opacity:0;transform:translateX(0)}15%{opacity:1}100%{top:-8%;opacity:0;transform:translateX(var(--dx))}}
/* quake */
.fo-dust-veil{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(130,110,85,0),rgba(130,110,85,.38));animation:fo-fade-in 1.2s ease-out both}
.fx-open-quake .fo-title{animation:fo-slam .5s .8s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes fo-slam{from{opacity:0;transform:scale(2.4)}}
/* umbra */
.fo-iris{position:absolute;left:50%;top:44%;width:70vmin;height:70vmin;margin:-35vmin 0 0 -35vmin;border-radius:50%;box-shadow:0 0 0 200vmax #000;animation:fo-iris 1.5s cubic-bezier(.5,0,.2,1) both}
@keyframes fo-iris{from{transform:scale(3.2)}to{transform:scale(.3)}}
.fo-eyes{position:absolute;left:50%;top:44%;display:flex;gap:7vmin;transform:translate(-50%,-50%)}
.fo-eye{width:9vmin;height:2.4vmin;border-radius:50%;background:radial-gradient(ellipse,#fff 0,var(--oc) 40%,transparent 72%);box-shadow:0 0 22px var(--oc);transform:scaleY(0);animation:fo-eye .5s 1.5s ease-out forwards,fo-blink 2.4s 2.2s infinite}
@keyframes fo-eye{to{transform:scaleY(1)}}
@keyframes fo-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.05)}}
.fo-whisper{left:var(--x);top:var(--y);color:var(--oc);font-size:18px;opacity:0;animation:fo-whisper 2.2s var(--d) ease-in-out both}
@keyframes fo-whisper{0%{opacity:0}40%{opacity:.5}100%{opacity:0;transform:translateY(-14px)}}
/* crown */
.fo-shard{left:50%;top:34%;color:#ffd45e;font-size:20px;text-shadow:0 0 10px #ffb800;opacity:0;animation:fo-shard 1.1s var(--d) cubic-bezier(.5,0,.3,1) both}
@keyframes fo-shard{0%{opacity:0;transform:translate(var(--sx),var(--sy)) rotate(var(--r)) scale(1.4)}20%,85%{opacity:1}100%{opacity:0;transform:translate(0,0) rotate(0) scale(.4)}}
.fo-crown{position:absolute;left:0;right:0;top:20%;text-align:center;font-size:clamp(60px,16vmin,130px);color:#ffd45e;text-shadow:0 0 24px #ffb800,0 0 70px #ff9d00;animation:fo-crown 1s 1.5s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes fo-crown{from{opacity:0;transform:translateY(-30px) scale(.4)}}
/* redline */
.fo-paper{position:absolute;left:50%;top:20%;transform:translateX(-50%);width:min(80%,520px);display:flex;flex-direction:column;gap:2.4vmin;font-size:clamp(11px,2vmin,16px);color:#d8d8d8}
.fo-row{position:relative;padding:.2em 0}
.fo-old{display:block;animation:fo-old-dim .4s calc(var(--d) + .3s) forwards}
@keyframes fo-old-dim{to{opacity:.3}}
.fo-strike{position:absolute;left:-2%;top:.7em;width:104%;height:2px;background:#ff3b3b;box-shadow:0 0 8px #ff3b3b;transform-origin:left;transform:scaleX(0);animation:fo-strike .3s var(--d) ease-out forwards}
@keyframes fo-strike{to{transform:scaleX(1)}}
.fo-new{display:block;color:#ff6b6b;opacity:0;margin-top:.15em;animation:fo-new-in .4s calc(var(--d) + .35s) forwards}
@keyframes fo-new-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
/* fang */
.fo-moon{position:absolute;right:12%;top:16%;font-size:clamp(50px,14vmin,110px);color:#eef2ff;text-shadow:0 0 30px #aab8ff,0 0 80px #6f7fff;animation:fo-moon 1.2s ease-out both}
@keyframes fo-moon{from{opacity:0;transform:scale(.6)}}
.fo-claw{position:absolute;left:-10%;top:var(--top);width:125%;height:5px;transform-origin:left center;background:linear-gradient(90deg,transparent,#fff 18%,#fff 72%,rgba(255,50,50,.9));box-shadow:0 0 14px #fff;opacity:0;animation:fo-claw .5s var(--d) ease-out both}
@keyframes fo-claw{0%{opacity:1;transform:rotate(22deg) scaleX(0)}35%{opacity:1;transform:rotate(22deg) scaleX(1)}100%{opacity:.4;transform:rotate(22deg) scaleX(1)}}
/* echo */
.fo-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);animation:fo-scan 6s linear infinite}
@keyframes fo-scan{to{background-position:0 60px}}
.fo-attempts{position:absolute;left:5%;top:20%;display:flex;flex-direction:column;gap:.5em;font-size:clamp(9px,1.6vmin,13px);color:var(--oc)}
.fo-attempt{opacity:0;animation:fo-attempt .5s var(--d) steps(3) both}
@keyframes fo-attempt{0%{opacity:0}50%{opacity:.9;transform:translateX(6px)}100%{opacity:.5}}
.fx-open-echo .fo-title{animation:fo-title-in 1.1s .75s both,fo-echo .9s 1.9s steps(2) infinite}
@keyframes fo-echo{0%,100%{text-shadow:3px 0 #ff2d6f,-3px 0 #00e5ff,0 0 14px var(--oc)}50%{text-shadow:-5px 0 #ff2d6f,5px 0 #00e5ff,0 0 24px var(--oc)}}
/* missing page */
.fo-sheet{position:absolute;left:50%;top:14%;width:min(32%,230px);height:58%;padding:6% 7%;box-sizing:border-box;background:#f4f1e8;color:#777;box-shadow:0 0 40px rgba(255,255,255,.55);clip-path:polygon(0 0,100% 0,100% 94%,88% 100%,74% 95%,60% 100%,46% 94%,32% 100%,18% 95%,6% 100%,0 96%);transform:translateX(-50%) rotate(-3deg);animation:fo-sheet 1.4s .3s cubic-bezier(.2,.8,.2,1) both}
@keyframes fo-sheet{from{opacity:0;transform:translate(-50%,120%) rotate(8deg)}}
.fo-sheet-head{font-size:clamp(9px,1.6vmin,13px);margin-bottom:8%}
.fo-sheet-line{height:2.2%;margin:5% 0;width:var(--w);background:#b9b5a8}
.fo-hole{position:absolute;left:55%;top:42%;width:10%;aspect-ratio:1;border-radius:50%;background:#05050a;transform:translate(-50%,-50%) scale(0);animation:fo-hole 1.1s 1.5s ease-in both}
@keyframes fo-hole{to{transform:translate(-50%,-50%) scale(9)}}
/* toll */
.fo-bell{position:absolute;left:50%;top:18%;font-size:clamp(50px,13vmin,100px);transform-origin:50% 0;transform:translateX(-50%);filter:drop-shadow(0 0 16px var(--oc));animation:fo-swing 2.6s ease-out both}
@keyframes fo-swing{0%{transform:translateX(-50%) rotate(-26deg)}18%{transform:translateX(-50%) rotate(22deg)}36%{transform:translateX(-50%) rotate(-15deg)}54%{transform:translateX(-50%) rotate(9deg)}72%{transform:translateX(-50%) rotate(-5deg)}100%{transform:translateX(-50%) rotate(0)}}
.fo-ring{position:absolute;left:50%;top:38%;width:10vmin;height:10vmin;margin:-5vmin 0 0 -5vmin;border:2px solid var(--oc);border-radius:50%;opacity:0;animation:fo-ring 1.6s var(--d) ease-out both}
@keyframes fo-ring{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(14)}}
/* map */
.fo-map{position:absolute;inset:0}
.fo-map svg{width:100%;height:100%}
.fo-map polyline{fill:none;vector-effect:non-scaling-stroke;stroke:var(--oc);stroke-dasharray:1;stroke-dashoffset:1}
.fo-map .g{stroke-width:1;opacity:.28;animation:fo-draw .6s var(--gd) ease-out forwards}
.fo-map .r{stroke-width:2.4;filter:drop-shadow(0 0 5px var(--oc));animation:fo-draw 1.5s 1s ease-in-out forwards}
.fo-compass{position:absolute;left:50%;top:22%;margin-left:-.6em;font-size:clamp(34px,9vmin,70px);filter:drop-shadow(0 0 12px var(--oc));animation:fo-spin 2.8s cubic-bezier(.3,0,.2,1) both}
@keyframes fo-spin{from{opacity:0;transform:rotate(0) scale(.4)}20%{opacity:1}to{opacity:1;transform:rotate(1130deg) scale(1)}}
`;

  function injectOpeningStyles() {
    if (document.getElementById("fx-open-styles")) return;
    const style = document.createElement("style");
    style.id = "fx-open-styles";
    style.textContent = OPENING_CSS;
    document.head.appendChild(style);
  }

  // Plays a scene by kind ("frost", "ember", …). Resolves when it finishes or is skipped.
  // Options: { name: text for the name card, color, sub: overrides for the defaults }.
  function openingScene(kind, { name = "", color = "", sub = "" } = {}) {
    if (!terminal || !OPENINGS[kind]) return Promise.resolve();
    const hit = { kind, name: String(name || kind) };

    injectOpeningStyles();
    const old = terminal.querySelector(".fx-open");
    if (old) old.remove();

    const cfg = OPENINGS[hit.kind];
    const overlay = mk(`fx-open fx-open-${hit.kind}${reduceMotion ? " calm" : ""}`);
    overlay.style.setProperty("--oc", color || cfg.color);
    overlay.setAttribute("aria-hidden", "true");

    const timers = [];
    const ctx = { later: (fn, ms) => timers.push(setTimeout(fn, ms)) };
    if (!reduceMotion) BUILDERS[hit.kind](overlay, ctx);
    overlay.append(
      mk("fo-bar top"),
      mk("fo-bar bot"),
      mk(hit.name.length > 18 ? "fo-title long" : "fo-title", hit.name.replace(/\b\w/g, (c) => c.toUpperCase())),
      mk("fo-sub", sub || cfg.sub)
    );
    terminal.appendChild(overlay);
    play(cfg.sound);

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        window.removeEventListener("keydown", onKey, true);
        window.removeEventListener("pointerdown", finish, true);
        overlay.classList.add("out");
        setTimeout(() => overlay.remove(), 450);
        resolve();
      };
      const onKey = (e) => {
        if (!["Enter", " ", "Escape"].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        finish();
      };
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("pointerdown", finish, true);
      timers.push(setTimeout(finish, reduceMotion ? 900 : cfg.ms));
    });
  }

  // Damage number that drifts up from the player (left) or the enemy (right).
  function floatNumber(text, side, kind) {
    if (reduceMotion) return;
    const el = document.createElement("div");
    el.className = `fx-float ${kind}`;
    el.textContent = text;
    el.style.left = side === "player" ? "22%" : "68%";
    el.style.top = `${28 + Math.random() * 12}%`;
    el.style.marginLeft = `${Math.random() * 50 - 25}px`;
    terminal.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // ---------- Line rules ----------
  // Each rule: `match` is tested against a printed line, `cls` colors it (optional), and `run`
  // (optional) triggers effects. The first rule that matches wins. `m` is the regex match.
  // Order matters: put specific rules above general ones.

  const hitFx = (sound, m, kind = "hit") => {
    floatNumber(m[1], "enemy", kind);
    if (kind === "crit") flash("rgba(255, 210, 80, 0.25)");
    play(sound);
  };

  const RULES = [
    // ----- combos (same feed style as Exp / coin / item lines; kept first so nothing else claims them) -----
    { match: /^Combo (started|\d+ hits|bonus)/, cls: "fx-reward-feed", run: () => play("xp") },
    { match: /^Combo ended/, cls: "fx-reward-feed", run: () => play("hint") },
    { match: /^Basic attack repeated/, cls: "fx-reward-feed", run: () => play("hint") },

    // ----- damage you take -----
    {
      match: /^\s*💔 You are hit for (\d+)/,
      cls: "fx-hurt",
      run: (m) => {
        shake(+m[1] >= 30);
        flash("rgba(220, 40, 40, 0.35)");
        floatNumber(`-${m[1]}`, "player", "hurt");
        play(+m[1] >= 30 ? "hurtBig" : "hurt");
      },
    },
    {
      match: /ripostes! You take (\d+) damage/,
      cls: "fx-hurt",
      run: (m) => {
        shake(false);
        floatNumber(`-${m[1]}`, "player", "hurt");
        play("hurt");
      },
    },
    { match: /💢 Recoil/, cls: "fx-hurt", run: () => play("hurt") },
    { match: /🪖 Your defense absorbs/, run: () => play("absorb") },
    { match: /🧯 Your resistance shrugs/, run: () => play("guard") },
    { match: /🧛 The .* drains/, cls: "fx-hurt", run: () => play("drain") },

    // ----- your attacks -----
    {
      match: /Counterattack deals (\d+) damage/,
      cls: "fx-crit",
      run: (m) => hitFx("counter", m, "crit"),
    },
    {
      match: /CRITICAL HIT!.*?(\d+) damage/,
      cls: "fx-crit",
      run: (m) => hitFx("crit", m, "crit"),
    },
    {
      match: /You only deal (\d+) damage/,
      cls: "fx-hit",
      run: (m) => hitFx("guardHit", m),
    },
    { match: /HEAVY HIT!.*?(\d+) damage/, cls: "fx-hit", run: (m) => hitFx("heavy", m) },
    {
      match: /^💥 (?!HIT!|HEAVY HIT!|CRITICAL HIT!).*?for (\d+) damage/,
      cls: "fx-hit",
      run: (m) => hitFx("skill", m),
    },
    { match: /💣 It hits! The .* takes (\d+)/, cls: "fx-hit", run: (m) => hitFx("explosion", m) },
    { match: /You hit the .* for (\d+) damage/, cls: "fx-hit", run: (m) => hitFx("hit", m) },
    {
      match: /Critical hit! It's your turn again/,
      cls: "fx-crit",
      run: () => {
        flash("rgba(255, 210, 80, 0.2)");
        play("bonusTurn");
      },
    },
    {
      match: /PERFECT PARRY/,
      cls: "fx-crit",
      run: () => {
        flash("rgba(255, 210, 80, 0.25)");
        play("perfectParry");
      },
    },
    { match: /^\s*✨ You use [A-Z]/, run: () => play("skillCast") },
    { match: /^\s*Strike \d+\/\d+:/, run: () => play("strike") },
    { match: /Total damage: \d+/, run: () => play("hint") },
    { match: /\(Your attack cuts through its guard!\)|\(It can't (dodge|parry) this attack!\)/, run: () => play("hint") },

    // ----- misses and enemy defence -----
    {
      match: /❌ (You (swing|swing heavily)|Your .* misses)|misses you completely/,
      cls: "fx-dim",
      run: () => play("miss"),
    },
    { match: /The .* dodges your attack/, cls: "fx-dodge", run: () => play("dodge") },
    { match: /tries to dodge, but you catch it|^\s+The .*'s parry fails!$/, run: () => play("yes") },
    { match: /The .* parries your attack/, cls: "fx-parry", run: () => play("parry") },

    // ----- your defence -----
    {
      match: /⚔️ PARRY!/,
      cls: "fx-parry",
      run: () => {
        flash("rgba(120, 200, 255, 0.2)");
        play("parry");
      },
    },
    { match: /Your timing is off - the parry fails/, run: () => play("no") },
    { match: /🛡️ Guard reduces damage/, cls: "fx-parry", run: () => play("guard") },
    {
      match: /You attempt to parry|You try to dodge|You raise your guard against/,
      run: () => play("brace"),
    },
    { match: /^\s*🛡️ You raise your guard!/, run: () => play("guardUp") },
    { match: /You ready yourself to parry|You get ready to dodge/, run: () => play("ready") },
    { match: /You dodge the attack|You escaped/, cls: "fx-dodge", run: () => play("dodge") },
    { match: /😵 You fail to dodge/, cls: "fx-hurt", run: () => play("stumble") },
    { match: /cannot be (blocked|dodged|parried)|pierces your guard/, run: () => play("denied") },
    { match: /🏃 You try to run away/, run: () => play("run") },
    { match: /❌ You couldn't get away/, run: () => play("no") },
    { match: /wasn't needed this turn/, cls: "fx-dim", run: () => play("fizzle") },

    // ----- items, healing, buffs -----
    { match: /🧪 You use/, cls: "fx-heal", run: () => play("potion") },
    {
      match: /You drain \d+ HP|💚 It heals|^\s*You recover \d+ HP/,
      cls: "fx-heal",
      run: () => {
        flash("rgba(60, 200, 110, 0.2)");
        play("heal");
      },
    },
    { match: /⚡ You (recover|restore|gain) \d+ energy/, run: () => play("energy") },
    {
      match: /(Damage|Defense|Dodge|Crit chance) increased by|You resist .* damage by|Phoenix protection is active/,
      cls: "fx-heal",
      run: () => play("buff"),
    },
    { match: /Your ailments are cured/, cls: "fx-heal", run: () => play("cure") },
    { match: /You had nothing to cure/, run: () => play("no") },
    { match: /It explodes!/, cls: "fx-crit", run: () => (shake(true), flash("rgba(255,160,40,0.4)"), play("explosion")) },
    { match: /🔥 THE PHOENIX RISES/, cls: "fx-levelup", run: () => (flash("rgba(255,170,60,0.4)"), play("phoenix")) },

    // ----- stuns, stagger, status effects -----
    { match: /is (stunned|staggered|blinded)( and can't|!)|STAGGERED/, cls: "fx-status", run: () => play("stun") },
    {
      match: /(☠️|🔥|🩸) (You are|The .* is) (poisoned|burning|bleeding)/,
      cls: "fx-status",
      run: (m) => play({ "☠️": "poison", "🔥": "burn", "🩸": "bleed" }[m[1]]),
    },
    { match: /^(☠️|🔥|🩸) (Poison|Burn|Bleed|The .* takes)/, cls: "fx-status", run: () => play("tick") },
    { match: /wears off/, cls: "fx-dim", run: () => play("hint") },
    { match: /You gain .* status for|The .* is .* for \d+ turns/, cls: "fx-status", run: () => play("status") },

    // ----- fight flow -----
    { match: /^Earned \$[\d,]+/, cls: "fx-reward-feed", run: () => play("coin") },
    { match: /^Earned [\d,]+ Exp\./, cls: "fx-reward-feed", run: () => play("xp") },
    { match: /^Obtained <.+> \(\d+x\)$/, cls: "fx-reward-feed", run: () => play("pickup") },
    {
      match: /🏆 You defeated/,
      cls: "fx-win",
      run: () => {
        flash("rgba(90, 220, 130, 0.25)");
        play("victory");
      },
    },
    {
      match: /💀 The .* defeated you/,
      cls: "fx-lose",
      run: () => {
        shake(true);
        flash("rgba(160, 0, 0, 0.5)");
        play("defeat");
      },
    },
    {
      match: /LEVEL UP/,
      cls: "fx-levelup",
      run: () => {
        flash("rgba(255, 215, 90, 0.35)");
        play("levelUp");
      },
    },
    { match: /✨ You gain \d+ XP|^\s+\+\d+ XP/, cls: "fx-loot", run: () => play("xp") },
    { match: /🎉 The monster dropped loot/, cls: "fx-loot", run: () => play("lootFanfare") },
    { match: /💨 Unlucky|nothing useful/, cls: "fx-dim", run: () => play("sad") },
    { match: /🔓 .* unlocked/, cls: "fx-levelup", run: () => play("unlock") },
    { match: /You drop half your coins/, cls: "fx-hurt", run: () => play("spend") },
    {
      match: /A wild .* appeared!/,
      cls: "fx-encounter",
      run: () => {
        shake(false);
        play("encounter");
      },
    },
    { match: /^🧰 Equipped: /, cls: "fx-dim" },
    { match: /\(No XP or loot from a fight you ran from\.\)/, cls: "fx-dim" },

    // ----- the enemy's turn -----
    { match: /^\s*✨ The .* uses/, cls: "fx-encounter", run: () => play("enemyAttack") },
    { match: /💤 The /, cls: "fx-dim", run: () => play("idle") },
    { match: /holds its (guard|parry stance|dodge stance)|is raising its guard/, run: () => play("stance") },
    { match: /takes a (PARRY|DODGE) STANCE/, run: () => play("stance") },
    { match: /🚫 The .* can't attack/, run: () => play("error") },

    // ----- enemy intent (the slow, dialogue-style section) -----
    { match: /ENEMY INTENT/, cls: "fx-intent-head", run: () => play("intent") },
    { match: /WARNING!/, cls: "fx-warning", run: () => play("warning") },
    { match: /^✓ /, cls: "fx-can", run: () => play("yes") },
    { match: /^✗ /, cls: "fx-cant", run: () => play("no") },
    { match: /^(Your options are|No defense works)/, cls: "fx-intent-main", run: () => play("hint") },

    // ----- turns and menus -----
    { match: /🟢 YOUR TURN/, cls: "fx-turn-player", run: () => play("turnPlayer") },
    { match: /🔴 (THE .*|ENEMY) TURN/, cls: "fx-turn-enemy", run: () => play("turnEnemy") },
    { match: /^===== Turn \d+ =====$/, cls: "fx-dim", run: () => play("turnTick") },
    { match: /^\s*--- .+ ---$|^📋 CHOOSE YOUR ACTION$|^🧭 YOUR ADVENTURE/, run: () => play("menuOpen") },

    // ----- gear, crafting, trading -----
    { match: /^🧰 Equipped [^:]/, run: () => play("equip") },
    { match: /^Swapping your /, run: () => play("unequip") },
    { match: /^🎒 Unequipped/, run: () => play("unequip") },
    { match: /^(🔨 )?Crafting \d+/, run: () => play("hammer") },
    { match: /^(✅ Crafted|Successfully crafted)/, cls: "fx-heal", run: () => play("craftDone") },
    { match: /^(🎒 Added \d+ × coin|added \d+ of coin)/, cls: "fx-loot", run: () => play("coin") },
    { match: /^(🎒 Added \d+ × |added \d+ of )/, cls: "fx-loot", run: () => play("pickup") },
    { match: /^(📦 Removed \d+ × coin|removed \d+ of coin)/, cls: "fx-dim", run: () => play("spend") },
    { match: /^(📦 Removed \d+ × |removed \d+ of )/, cls: "fx-dim", run: () => play("drop") },

    // ----- story and exploring -----
    {
      match: /CHAPTER \d+ UNLOCKED|REACHED ITS LAST SAVE/,
      cls: "fx-chapter",
      run: () => {
        flash("rgba(190, 150, 255, 0.35)");
        play("chapter");
      },
    },
    { match: /QUEST COMPLETE/, cls: "fx-levelup", run: () => play("questComplete") },
    { match: /📜 STORY PROGRESS/, run: () => play("questPing") },
    { match: /^📖 (STORY|THE LAST SAVE)/, run: () => play("page") },
    { match: /^🗺️ /, cls: "fx-chapter", run: () => play("area") },
    { match: /^You travel deeper into/, run: () => play("footsteps") },
    { match: /^You encounter /, cls: "fx-encounter", run: () => play("ominous") },
    { match: /^Something waits deeper/, cls: "fx-encounter", run: () => play("ominous") },
    { match: /^\[[A-Z][^\]]*\] /, run: () => play("hint") },
    {
      match: /^\s*⚠️/, // fourth-wall events glitch the screen
      cls: "fx-glitch",
      run: () => {
        shake(false);
        flash("rgba(0, 255, 200, 0.15)");
        play("glitch");
      },
    },

    // ----- saving and loading -----
    { match: /💾 Autosave restored|📋 Copied/, run: () => play("save") },
    { match: /^Thanks for playing/, run: () => play("bye") },

    // ----- mistakes and refusals (kept near the end so specific rules win first) -----
    {
      match: /^(Invalid command|Not enough|You can't|You don't have|The shop doesn't|The shopkeeper doesn't|Unequip your|Pick |Try '|No item|No shop|Can't craft|Amount must|Your weapon has no|Choose exactly|Load cancelled|You have nothing|Type a fuller|The final choice is not|\(Select and copy)|is not a recipe|is not reachable|^❌|\[autosave warning\]/,
      cls: "fx-dim",
      run: () => play("error"),
    },

    // ----- plain coloring -----
    { match: /☠️|🔥 You are burning|🩸/, cls: "fx-status" },
    { match: /^[=\-]{10,}$/, cls: "fx-dim" },
  ];

  // The slow "enemy intent" block: everything between the header and the player's turn gets a
  // dialogue-style look, and the first description line gets its own rising "telegraph" sound.
  let inIntent = false;
  let intentOpening = false;
  const INTENT_START = /ENEMY INTENT/;
  const INTENT_END = /YOUR TURN|=== YOUR ACTION ===|^===== Turn|THE .*'S TURN/;

  // ---------- Status bars ----------

  // "You:   [#######-----] 70/100" -> colored bar whose color follows how much HP is left.
  const HP_BAR = /^(.*?)\[(#*)(-*)\] (\d+)\/(\d+)(\s*<)?\s*$/;
  // "Energy:   ●●●○○○ 3/6" -> colored dots.
  const ENERGY_BAR = /^(\s*Energy:\s+)(●*)(○*)(.*)$/;

  function span(text, className) {
    const el = document.createElement("span");
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // Builds the content of one printed line, adding colored bars where they apply.
  function buildContent(line) {
    const coinReward = line.match(/^Earned (\$[\d,]+)(.*)$/);
    if (coinReward) {
      const wrapper = document.createElement("span");
      wrapper.append(span("Earned "), span(coinReward[1], "reward-coin"), span(coinReward[2]));
      return wrapper;
    }
    const xpReward = line.match(/^Earned ([\d,]+)( Exp\..*)$/);
    if (xpReward) {
      const wrapper = document.createElement("span");
      wrapper.append(span("Earned "), span(xpReward[1], "reward-xp"), span(xpReward[2]));
      return wrapper;
    }
    const itemReward = line.match(/^Obtained <(.+)> \((\d+x)\)$/);
    if (itemReward) {
      const wrapper = document.createElement("span");
      wrapper.append(span("Obtained "), span(`<${itemReward[1]}>`, "reward-item"), span(` (${itemReward[2]})`));
      return wrapper;
    }
    // Combo lines: highlight the key numbers (hit count, multiplier, bonus damage) like the Exp amount.
    if (/^(Combo |Basic attack repeated)/.test(line)) {
      const wrapper = document.createElement("span");
      line.split(/(\d+ hits?|x\d+(?:\.\d+)?|[+-]\d+(?: damage|%))/).forEach((part, i) => {
        if (part) wrapper.append(span(part, i % 2 ? "reward-combo" : ""));
      });
      return wrapper;
    }
    const hp = line.match(HP_BAR);
    if (hp) {
      const ratio = +hp[5] > 0 ? +hp[4] / +hp[5] : 0;
      const level = ratio > 0.5 ? "bar-good" : ratio > 0.25 ? "bar-warn" : "bar-low";
      const wrapper = document.createElement("span");
      wrapper.append(span(hp[1] + "["), span(hp[2], level), span(hp[3], "bar-empty"));
      wrapper.append(span(`] ${hp[4]}/${hp[5]}${hp[6] || ""}`));
      return wrapper;
    }
    const energy = line.match(ENERGY_BAR);
    if (energy) {
      const wrapper = document.createElement("span");
      wrapper.append(span(energy[1]), span(energy[2], "bar-energy"), span(energy[3], "bar-empty"));
      wrapper.append(span(energy[4]));
      return wrapper;
    }
    return document.createTextNode(line);
  }

  // ---------- Public API ----------

  // Turns one line of game text into a DOM element. Returns { el, trigger }: the typewriter adds
  // `el` to the screen and calls `trigger()` when the line starts appearing, which fires the
  // line's flash / shake / sound.
  function renderLine(line, { plain = false, newline = true } = {}) {
    const el = document.createElement("span");
    el.className = "line";
    el.append(buildContent(line), newline ? "\n" : "");

    let trigger = () => {};
    if (plain) {
      inIntent = false; // prompts and typed commands always end the intent block
      return { el, trigger };
    }

    if (INTENT_END.test(line)) inIntent = false;
    if (INTENT_START.test(line)) {
      inIntent = true;
      intentOpening = true;
    }

    const rule = RULES.find((r) => r.match.test(line));
    if (rule) {
      if (rule.cls) el.classList.add(rule.cls);
      if (rule.run) {
        const m = line.match(rule.match);
        trigger = () => rule.run(m);
      }
      if (inIntent && !INTENT_START.test(line) && !/WARNING!/.test(line)) intentOpening = false;
    } else if (inIntent && line.trim() && intentOpening) {
      // First description line of the enemy's move: "The Wolf lowers its head and charges POUNCE!"
      intentOpening = false;
      el.classList.add("fx-intent-main");
      trigger = () => play("telegraph");
    }
    return { el, trigger };
  }

  document.getElementById("soundToggle")?.addEventListener("click", () => setSound(!soundOn, true));
  document.getElementById("musicVolume")?.addEventListener("input", (event) => setMusicVolume(event.target.value));
  setMusicVolume(musicVolume);
  setSound(soundOn);

  return { renderLine, play, blip, startBattleMusic, stopBattleMusic, corrupt, realityCut, attackCutscene, openingScene, openingKinds: () => Object.keys(OPENINGS) };
})();
