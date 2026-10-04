// Touhou-inspired, original danmaku RPG layer.
// Uses the existing RPG's player progression and browser save system.
// No Touhou characters, names, music, or assets are used.

const DANMAKU = {
  width: 760,
  height: 520,
  playerRadius: 6,
  hitRadius: 5,
  focusSpeed: 145,
  normalSpeed: 235,
  grazeRadius: 22,
  bulletSpeed: 75,
  tickMs: 16,
  waveDelayMs: 720,
  startingLives: 3,
};

const DANMAKU_CHARACTERS = {
  shrine_wanderer: {
    name: "Aster",
    subtitle: "Caretaker of the Lantern Road",
    shot: "paper_seal",
    power: 1.0,
    focusBonus: 0,
    colorClass: "dk-a",
  },
  moon_scribe: {
    name: "Lunae",
    subtitle: "Archivist of the Moonlit Margin",
    shot: "moon_note",
    power: 0.92,
    focusBonus: 18,
    colorClass: "dk-b",
  },
};

const DANMAKU_BOSSES = [
  {
    id: "bell_blossom",
    name: "Bellflower Nocturne",
    title: "The Midnight Wayfarer",
    hp: 760,
    speed: 95,
    phaseAt: [0.68, 0.38],
    pattern: 0,
    spellCards: [
      "Petal Sign — Lantern Spiral",
      "Bell Sign — Sevenfold Chime",
      "Night Sign — Crescent Garden",
    ],
  },
  {
    id: "glass_moth",
    name: "Prismwing Moth",
    title: "Keeper of the Unbroken Gleam",
    hp: 980,
    speed: 82,
    phaseAt: [0.72, 0.44],
    pattern: 1,
    spellCards: [
      "Prism Sign — Falling Spectrum",
      "Mirror Sign — Twin Halo",
      "Gleam Sign — Thousand Refractions",
    ],
  },
];

function danmakuClamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function danmakuRand(a, b) { return a + Math.random() * (b - a); }

function danmakuState() {
  if (!WORLD.flags) WORLD.flags = {};
  if (!WORLD.flags.danmaku) {
    WORLD.flags.danmaku = {
      unlocked: true,
      wins: 0,
      bestGraze: 0,
      bestScore: 0,
      selectedCharacter: "shrine_wanderer",
      defeats: {},
    };
  }
  return WORLD.flags.danmaku;
}

function danmakuCharacter(id) {
  return DANMAKU_CHARACTERS[id] || DANMAKU_CHARACTERS.shrine_wanderer;
}

function danmakuSaveProgress() {
  try { autosave(); } catch (_) {}
}

function danmakuAwardBoss(boss, score) {
  const d = danmakuState();
  d.wins = (d.wins || 0) + 1;
  d.bestScore = Math.max(d.bestScore || 0, score);
  d.bestGraze = Math.max(d.bestGraze || 0, score.graze || 0);
  d.defeats[boss.id] = (d.defeats[boss.id] || 0) + 1;

  const xp = 80 + Math.floor(score.graze * 0.35) + boss.hp;
  const coin = 60 + Math.floor(score.graze * 0.12);
  PLAYER.xp += xp;
  inventory.coin = (inventory.coin || 0) + coin;
  if (PLAYER.xp >= 999999) PLAYER.xp = 999999;

  if (typeof checkLevelUp === "function") {
    try { checkLevelUp(); } catch (_) {}
  }

  print("");
  print("✦ INCIDENT CLEARED ✦");
  print(`   ★ ${boss.name} was defeated.`);
  print(`   ✨ XP +${xp}   🪙 Coin +${coin}`);
  print(`   ◇ Graze ${score.graze}   ◇ Score ${score.total}`);
  print("   Your route through the incident has been recorded.");
  danmakuSaveProgress();
}

function danmakuBuildCanvas() {
  let root = document.getElementById("danmakuRoot");
  if (root) return root;
  root = document.createElement("div");
  root.id = "danmakuRoot";
  root.className = "danmaku-root";
  root.innerHTML = `
    <div class="danmaku-hud">
      <div class="danmaku-hud-left">
        <span id="dkBossName"></span>
        <span id="dkCardName"></span>
      </div>
      <div class="danmaku-hud-right">
        <span id="dkScore"></span>
        <span id="dkLives"></span>
        <span id="dkPower"></span>
      </div>
    </div>
    <div class="danmaku-stage">
      <canvas id="danmakuCanvas" width="760" height="520" aria-label="Danmaku battle field"></canvas>
      <div id="dkOverlay" class="danmaku-overlay">
        <div class="danmaku-card">
          <div id="dkOverlayTitle"></div>
          <div id="dkOverlayText"></div>
        </div>
      </div>
    </div>
    <div class="danmaku-controls">Move: WASD / Arrow Keys · Focus: Shift · Bomb: X · Pause: P</div>
  `;
  document.body.appendChild(root);
  return root;
}

function danmakuClearCanvas() {
  const root = document.getElementById("danmakuRoot");
  if (root) root.remove();
}

function danmakuFlash(text, sub = "", ttl = 900) {
  const overlay = document.getElementById("dkOverlay");
  const title = document.getElementById("dkOverlayTitle");
  const body = document.getElementById("dkOverlayText");
  if (!overlay || !title || !body) return;
  title.textContent = text;
  body.textContent = sub;
  overlay.classList.add("is-visible");
  window.setTimeout(() => overlay.classList.remove("is-visible"), ttl);
}

function danmakuSpawnBullet(game, x, y, vx, vy, r = 4, kind = "orb", life = 1200) {
  game.bullets.push({x, y, vx, vy, r, kind, life, age: 0});
}

function danmakuSpawnAimed(game, x, y, targetX, targetY, speed, r = 5, kind = "orb") {
  const dx = targetX - x, dy = targetY - y;
  const len = Math.hypot(dx, dy) || 1;
  danmakuSpawnBullet(game, x, y, (dx / len) * speed, (dy / len) * speed, r, kind);
}

function danmakuRing(game, cx, cy, count, speed, phase = 0, r = 5, kind = "petal") {
  for (let i = 0; i < count; i++) {
    const a = phase + i * Math.PI * 2 / count;
    danmakuSpawnBullet(game, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, kind);
  }
}

function danmakuFan(game, cx, cy, count, spread, baseAngle, speed, r = 5, kind = "orb") {
  if (count <= 1) {
    danmakuSpawnBullet(game, cx, cy, Math.cos(baseAngle) * speed, Math.sin(baseAngle) * speed, r, kind);
    return;
  }
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5;
    const a = baseAngle + t * spread;
    danmakuSpawnBullet(game, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, r, kind);
  }
}

function danmakuPattern(game, boss, dt) {
  game.patternClock += dt;
  if (game.phaseChanged) {
    game.phaseChanged = false;
    game.patternClock = 0;
    game.bossShot = 0;
  }

  game.bossShot += dt;
  const p = game.player;
  const bx = game.boss.x, by = game.boss.y;

  if (boss.pattern === 0) {
    if (game.phase === 0 && game.bossShot > 0.52) {
      game.bossShot = 0;
      danmakuRing(game, bx, by, 11, 98 + game.wave * 7, game.patternClock, 4, "petal");
      danmakuFan(game, bx, by + 16, 5, 0.74, Math.atan2(p.y - by, p.x - bx), 122, 4.5, "seal");
    } else if (game.phase === 1 && game.bossShot > 0.42) {
      game.bossShot = 0;
      danmakuRing(game, bx, by, 16, 112 + game.wave * 5, -game.patternClock * 0.9, 4.5, "bell");
      danmakuSpawnAimed(game, bx, by + 12, p.x, p.y, 155, 5, "orb");
    } else if (game.phase === 2 && game.bossShot > 0.3) {
      game.bossShot = 0;
      const a = game.patternClock * 1.8;
      danmakuRing(game, bx, by, 22, 120, a, 4, "moon");
      danmakuRing(game, bx, by, 9, 166, -a * 0.7, 5.5, "petal");
    }
  } else {
    if (game.phase === 0 && game.bossShot > 0.46) {
      game.bossShot = 0;
      for (let i = 0; i < 3; i++) {
        const a = game.patternClock * 0.55 + i * Math.PI * 2 / 3;
        danmakuFan(game, bx, by, 9, 0.62, a, 132, 4, "prism");
      }
    } else if (game.phase === 1 && game.bossShot > 0.38) {
      game.bossShot = 0;
      const a = game.patternClock * 0.9;
      danmakuRing(game, bx, by, 18, 126, a, 4, "mirror");
      danmakuRing(game, bx, by, 18, 94, -a + Math.PI / 18, 5.5, "beam");
    } else if (game.phase === 2 && game.bossShot > 0.24) {
      game.bossShot = 0;
      for (let i = 0; i < 4; i++) {
        const a = game.patternClock * 0.6 + i * Math.PI / 2;
        danmakuFan(game, bx, by, 13, 1.1, a, 150, 4.5, "prism");
      }
    }
  }

  if (game.patternClock > 7.5) {
    game.patternClock = 0;
    game.wave += 1;
  }
}

function danmakuUpdatePhase(game, boss) {
  const ratio = game.boss.hp / boss.hp;
  const next = ratio <= boss.phaseAt[1] ? 2 : ratio <= boss.phaseAt[0] ? 1 : 0;
  if (next !== game.phase) {
    game.phase = next;
    game.phaseChanged = true;
    game.cardIndex = Math.min(next, boss.spellCards.length - 1);
    danmakuFlash("SPELL CARD", boss.spellCards[game.cardIndex], 1050);
  }
}

function danmakuShootPlayer(game) {
  const c = danmakuCharacter(game.characterId);
  const power = 8.5 * c.power * (1 + (PLAYER.level - 1) * 0.018);
  const count = game.focus ? 1 : 3;
  if (count === 1) {
    game.playerShots.push({x: game.player.x, y: game.player.y - 16, vx: 0, vy: -420, r: 4, damage: power * 1.65});
  } else {
    [-0.11, 0, 0.11].forEach(a => {
      game.playerShots.push({x: game.player.x, y: game.player.y - 14, vx: Math.sin(a) * 420, vy: -420 * Math.cos(a), r: 4, damage: power});
    });
  }
}

function danmakuBomb(game) {
  if (game.bombs <= 0 || game.bombCooldown > 0) return;
  game.bombs -= 1;
  game.bombCooldown = 2.0;
  game.bullets = game.bullets.filter(b => b.age < 220);
  game.score += 1500;
  danmakuFlash("CLEAR!", "A lantern burst erased the nearest bullets.", 650);
}

function danmakuHitPlayer(game, bullet) {
  if (game.invuln > 0 || game.player.hitCooldown > 0) return false;
  game.player.hitCooldown = 0.42;
  game.invuln = 1.25;
  game.lives -= 1;
  game.score = Math.max(0, game.score - 800);
  game.bullets = game.bullets.filter(b => Math.hypot(b.x - game.player.x, b.y - game.player.y) > 70);
  danmakuFlash("GRAZE LOST", "The spell card catches you. Stay moving.", 500);
  return game.lives <= 0;
}

function danmakuUpdate(game, dt) {
  if (game.paused) return;
  const p = game.player;
  const canvas = game.canvas;

  p.hitCooldown = Math.max(0, p.hitCooldown - dt);
  game.invuln = Math.max(0, game.invuln - dt);
  game.bombCooldown = Math.max(0, game.bombCooldown - dt);

  let dx = 0, dy = 0;
  if (game.keys.has("ArrowLeft") || game.keys.has("a")) dx -= 1;
  if (game.keys.has("ArrowRight") || game.keys.has("d")) dx += 1;
  if (game.keys.has("ArrowUp") || game.keys.has("w")) dy -= 1;
  if (game.keys.has("ArrowDown") || game.keys.has("s")) dy += 1;
  const focus = game.keys.has("Shift");
  game.focus = focus;
  const len = Math.hypot(dx, dy) || 1;
  const speed = focus ? DANMAKU.focusSpeed : DANMAKU.normalSpeed;
  p.x = danmakuClamp(p.x + dx / len * speed * dt, 22, canvas.width - 22);
  p.y = danmakuClamp(p.y + dy / len * speed * dt, canvas.height - 22, canvas.height - 70);

  game.fireClock += dt;
  if (game.fireClock > (focus ? 0.075 : 0.105)) {
    game.fireClock = 0;
    danmakuShootPlayer(game);
  }

  for (const shot of game.playerShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  game.playerShots = game.playerShots.filter(s => s.y > -20 && s.x > -30 && s.x < canvas.width + 30);

  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age += dt * 1000;
  }
  game.bullets = game.bullets.filter(b => b.age < b.life && b.x > -50 && b.x < canvas.width + 50 && b.y > -50 && b.y < canvas.height + 50);

  for (const shot of game.playerShots) {
    const bossDist = Math.hypot(shot.x - game.boss.x, shot.y - game.boss.y);
    if (bossDist < game.boss.r + shot.r) {
      game.boss.hp = Math.max(0, game.boss.hp - shot.damage);
      game.score += Math.round(shot.damage * 9);
      shot.y = -999;
    }
  }

  for (const b of game.bullets) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < DANMAKU.grazeRadius + b.r && d > DANMAKU.hitRadius + b.r && !b.grazed) {
      b.grazed = true;
      game.graze += 1;
      game.score += 75;
      if (typeof FX !== "undefined") {
        try { FX.play("key"); } catch (_) {}
      }
    }
    if (d < DANMAKU.hitRadius + b.r) {
      if (danmakuHitPlayer(game, b)) {
        game.failed = true;
        return;
      }
      b.x = -999;
    }
  }

  danmakuUpdatePhase(game, game.bossDef);
  danmakuPattern(game, game.bossDef, dt);

  if (game.boss.hp <= 0) {
    game.won = true;
    return;
  }

  if (game.invuln > 0) {
    game.player.x += Math.sin(game.tick * 1.8) * 0.45;
  }

  game.tick += dt;
}

function danmakuDrawBullet(ctx, b) {
  ctx.save();
  const alpha = danmakuClamp(1 - b.age / b.life, 0.25, 1);
  ctx.globalAlpha = alpha;
  ctx.translate(b.x, b.y);
  if (b.kind === "petal") {
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    ctx.fillText("✦", 0, 0);
  } else if (b.kind === "bell") {
    ctx.fillText("◈", 0, 0);
  } else if (b.kind === "seal") {
    ctx.fillText("◇", 0, 0);
  } else if (b.kind === "moon") {
    ctx.fillText("☽", 0, 0);
  } else if (b.kind === "prism") {
    ctx.fillText("✧", 0, 0);
  } else if (b.kind === "mirror") {
    ctx.fillText("◆", 0, 0);
  } else if (b.kind === "beam") {
    ctx.fillRect(-1, -7, 2, 14);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function danmakuDraw(game) {
  const ctx = game.ctx, c = game.canvas;
  const boss = game.bossDef;
  ctx.clearRect(0, 0, c.width, c.height);

  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, boss.id === "bell_blossom" ? "#17112b" : "#102132");
  grad.addColorStop(1, "#05060d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  for (let x = 0; x <= c.width; x += 38) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 38) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  for (let i = 0; i < 20; i++) {
    const sx = (i * 97 + game.tick * (i % 3 + 1) * 4) % c.width;
    const sy = (i * 43) % c.height;
    ctx.globalAlpha = 0.35 + (i % 3) * 0.16;
    ctx.fillText("·", sx, sy);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(game.boss.x, game.boss.y);
  ctx.beginPath();
  ctx.arc(0, 0, game.boss.r + 8 + Math.sin(game.tick * 2.5) * 3, 0, Math.PI * 2);
  ctx.strokeStyle = game.phase === 2 ? "#ffcf9e" : "#d9c2ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = "28px system-ui";
  ctx.fillText(boss.id === "bell_blossom" ? "✿" : "✦", 0, 10);
  ctx.restore();

  for (const b of game.bullets) {
    ctx.font = (b.kind === "beam" ? "16px" : "19px") + " serif";
    ctx.fillStyle = game.phase === 2 ? "#ffdcb5" : "#d8d2ff";
    danmakuDrawBullet(ctx, b);
  }

  for (const s of game.playerShots) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = "#f6e9b5";
    ctx.shadowBlur = 9;
    ctx.shadowColor = "#fff4bc";
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(game.player.x, game.player.y);
  ctx.fillStyle = game.characterId === "moon_scribe" ? "#cfe4ff" : "#ffd6e9";
  ctx.shadowBlur = 14;
  ctx.shadowColor = ctx.fillStyle;
  ctx.beginPath();
  ctx.arc(0, 0, game.focus ? 7 : 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, -1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (game.focus) {
    ctx.strokeStyle = "#ffffffaa";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "#fff";
  const hpRatio = game.boss.hp / game.bossDef.hp;
  ctx.fillRect(18, 18, (c.width - 36) * hpRatio, 5);
}

async function playDanmakuBoss(raw = "") {
  const state = danmakuState();
  const [bossTerm, charTerm] = String(raw || "").trim().split(/\s*:\s*/);
  const boss = DANMAKU_BOSSES.find(b => !bossTerm || b.id === bossTerm || b.name.toLowerCase() === String(bossTerm).toLowerCase()) || DANMAKU_BOSSES[0];
  const char = DANMAKU_CHARACTERS[charTerm] ? charTerm : state.selectedCharacter;

  if (typeof Typewriter !== "undefined") await Typewriter.idle();
  const root = danmakuBuildCanvas();
  const canvas = root.querySelector("#danmakuCanvas");
  const ctx = canvas.getContext("2d");
  const game = {
    canvas, ctx, bossDef: boss, characterId: char,
    boss: {x: canvas.width / 2, y: 82, r: 23, hp: boss.hp},
    player: {x: canvas.width / 2, y: canvas.height - 55, hitCooldown: 0},
    bullets: [], playerShots: [], keys: new Set(),
    phase: 0, phaseChanged: false, patternClock: 0, bossShot: 0, wave: 0,
    fireClock: 0, bombCooldown: 0, invuln: 0, tick: 0,
    graze: 0, score: 0, lives: DANMAKU.startingLives, bombs: 2,
    paused: false, won: false, failed: false, focus: false,
  };

  const nameNode = document.getElementById("dkBossName");
  const cardNode = document.getElementById("dkCardName");
  const scoreNode = document.getElementById("dkScore");
  const livesNode = document.getElementById("dkLives");
  const powerNode = document.getElementById("dkPower");
  if (nameNode) nameNode.textContent = boss.name;
  if (cardNode) cardNode.textContent = boss.spellCards[0];
  if (scoreNode) scoreNode.textContent = "Score 0 · Graze 0";
  if (livesNode) livesNode.textContent = "♥♥♥";
  if (powerNode) powerNode.textContent = char === "moon_scribe" ? "Power II" : "Power I";

  danmakuFlash("INCIDENT", `${danmakuCharacter(char).name} enters the spell-card duel.`, 1200);

  const onKeyDown = (e) => {
    const allowed = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","w","a","s","d","Shift","x","X","p","P"];
    if (allowed.includes(e.key)) e.preventDefault();
    if (e.key === "p" || e.key === "P") game.paused = !game.paused;
    if (e.key === "x" || e.key === "X") danmakuBomb(game);
    game.keys.add(e.key);
  };
  const onKeyUp = (e) => game.keys.delete(e.key);
  window.addEventListener("keydown", onKeyDown, {passive:false});
  window.addEventListener("keyup", onKeyUp);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
    last = now;
    danmakuUpdate(game, dt);
    danmakuDraw(game);
    const phaseCard = boss.spellCards[game.cardIndex || 0];
    if (cardNode) cardNode.textContent = phaseCard;
    if (scoreNode) scoreNode.textContent = `Score ${Math.floor(game.score)} · Graze ${game.graze}`;
    if (livesNode) livesNode.textContent = "♥".repeat(Math.max(0, game.lives)) + "♡".repeat(Math.max(0, DANMAKU.startingLives - game.lives));
    if (powerNode) powerNode.textContent = game.focus ? "Focus" : "Spread";
    if (!game.won && !game.failed) {
      game.raf = requestAnimationFrame(frame);
      return;
    }

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (game.won) {
      danmakuAwardBoss(boss, {total: Math.floor(game.score), graze: game.graze});
      danmakuFlash("CLEAR", "The incident dissolves into drifting light.", 1300);
    } else {
      print("");
      print("✧ INCIDENT FAILED ✧");
      print("   The spell-card duel overwhelms you. Keep your RPG upgrades and try again.");
      danmakuSaveProgress();
    }
    window.setTimeout(danmakuClearCanvas, 1350);
  }
  requestAnimationFrame(frame);
}

async function danmakuCommand(args = "") {
  const raw = String(args || "").trim();
  if (!danmakuState().unlocked) {
    print("The incident is not available yet.");
    return;
  }
  if (/^help$/i.test(raw)) {
    print("");
    print("✦ INCIDENT MODE — original danmaku RPG");
    print("  incident                 Start the next incident.");
    print("  incident bell_blossom    Face Bellflower Nocturne.");
    print("  incident glass_moth      Face Prismwing Moth.");
    print("  incident bell_blossom : moon_scribe");
    print("                         Choose Lunae for the duel.");
    print("  Move with WASD / arrows. Hold Shift to focus. Press X for a bomb.");
    return;
  }
  if (/^(status|record)$/i.test(raw)) {
    const d = danmakuState();
    print("");
    print("✦ DANMAKU RECORD");
    print(`  Incident clears: ${d.wins || 0}`);
    print(`  Best score: ${d.bestScore || 0}`);
    print(`  Best graze: ${d.bestGraze || 0}`);
    print(`  Aster: ${d.defeats.bell_blossom || 0} Bellflower Nocturne clears`);
    print(`  Lunae unlock profile: ${d.defeats.glass_moth || 0} Prismwing Moth clears`);
    return;
  }
  const id = raw.split(/\s*:\s*/)[0].trim().toLowerCase();
  if (id === "lunae" || id === "moon_scribe") {
    danmakuState().selectedCharacter = "moon_scribe";
    print("Lunae selected.");
    return;
  }
  if (id === "aster" || id === "shrine_wanderer") {
    danmakuState().selectedCharacter = "shrine_wanderer";
    print("Aster selected.");
    return;
  }
  await playDanmakuBoss(raw);
}
