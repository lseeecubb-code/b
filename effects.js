// Visual and audio effects for the terminal.
//
// The game engine only ever calls print(). This file watches the lines being printed and
// reacts to them: it colors them, shakes or flashes the screen, floats damage numbers and plays
// small synthesized sounds (no audio files, so the game still works offline from file://).
//
// To add a new effect, add one entry to RULES below. To mute everything, use the Sound button.

const FX = (() => {
  const SOUND_KEY = "the-last-save.sound";

  const terminal = document.querySelector(".terminal");
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Sound ----------
  // All sounds are synthesized with the Web Audio API (no audio files, so it works from file://).
  // Building blocks: tone() = an oscillator with an envelope, noise() = filtered noise (swooshes,
  // crunches, booms), bell() = metallic ring (clangs, coins, chimes). Everything runs through a
  // compressor and a little reverb so it sounds fuller than raw beeps.

  let soundOn = true;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  } catch (e) {}

  let audio = null; // created on the first key press or click (browsers block it before that)
  let master = null; // everything is mixed into this
  let reverbIn = null; // send bus for the reverb
  let noiseBuffer = null;
  let base = 0; // start-time offset (seconds) of the sound currently being built
  let cursor = 0; // when the next queued sound may start (keeps bursts of lines from piling up)

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
  ["keydown", "pointerdown"].forEach((evt) => window.addEventListener(evt, unlockAudio));

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
      slash(0.1);
      thump(0.2, 160, 0.03);
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
      thump(0.19, 130);
      tone(170, 0.18, { type: "triangle", slideTo: 75, vol: 0.055, lp: 1400 });
      crunch(0.065);
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
  };

  // How long (seconds) each sound occupies the queue before the next one may start. Short
  // sounds use the default; fanfares reserve more so they don't get trampled.
  const DURATION = {
    levelUp: 0.9, victory: 0.9, defeat: 1.3, chapter: 1.4, questComplete: 1, phoenix: 1.2,
    lootFanfare: 0.55, unlock: 0.5, explosion: 0.5, hurtBig: 0.35, ominous: 0.8, footsteps: 0.8,
    area: 0.8, warning: 0.55, heal: 0.4, glitch: 0.35, encounter: 0.5, craftDone: 0.4,
    hammer: 0.5, intent: 0.4, telegraph: 0.4, crit: 0.3, burn: 0.35, poison: 0.3, run: 0.4,
    skill: 0.3, heavy: 0.2, potion: 0.4,
  };
  const IMPORTANT = new Set([
    "levelUp", "victory", "defeat", "chapter", "questComplete", "phoenix", "unlock", "hurt",
    "hurtBig", "crit", "warning", "encounter", "enter",
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
    }
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
    { match: /ENEMY INTENT — READ THE TELEGRAPH|=== ENEMY INTENT ===/, cls: "fx-intent-head", run: () => play("intent") },
    { match: /WARNING!/, cls: "fx-warning", run: () => play("warning") },
    { match: /^✓ /, cls: "fx-can", run: () => play("yes") },
    { match: /^✗ /, cls: "fx-cant", run: () => play("no") },
    { match: /^(Your options are|No defense works)/, cls: "fx-intent-main", run: () => play("hint") },

    // ----- turns and menus -----
    { match: /🟢 YOUR TURN/, cls: "fx-turn-player", run: () => play("turnPlayer") },
    { match: /🔴 THE .* TURN/, cls: "fx-turn-enemy", run: () => play("turnEnemy") },
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
  const INTENT_START = /=== ENEMY INTENT ===/;
  const INTENT_END = /YOUR TURN|=== YOUR ACTION ===|^===== Turn|THE .*'S TURN/;

  // ---------- Status bars ----------

  // "You:   [#######-----] 70/100" -> colored bar whose color follows how much HP is left.
  const HP_BAR = /^(.*?)\[(#*)(-*)\] (\d+)\/(\d+)\s*$/;
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
    const hp = line.match(HP_BAR);
    if (hp) {
      const ratio = +hp[5] > 0 ? +hp[4] / +hp[5] : 0;
      const level = ratio > 0.5 ? "bar-good" : ratio > 0.25 ? "bar-warn" : "bar-low";
      const wrapper = document.createElement("span");
      wrapper.append(span(hp[1] + "["), span(hp[2], level), span(hp[3], "bar-empty"));
      wrapper.append(span(`] ${hp[4]}/${hp[5]}`));
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
  setSound(soundOn);

  return { renderLine, play, blip };
})();
