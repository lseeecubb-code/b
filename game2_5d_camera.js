/* Straight-on 2.5D camera: tiles run vertically, with a slight top-down side perspective. */
(function () {
  "use strict";
  const TILE = 54;
  const COL = { x: 0, y: TILE };
  const ROW = { x: TILE * 0.28, y: TILE * 0.96 };
  const MAP_W = 17, MAP_H = 13;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const BIOMES = [
    { ground: "#17182b", edge: "#39314f", accent: "#e8c986", sky: "#14162a" },
    { ground: "#102628", edge: "#23474a", accent: "#9fe7d1", sky: "#0b1d22" },
    { ground: "#281522", edge: "#573043", accent: "#ff9aa8", sky: "#24101b" },
    { ground: "#182039", edge: "#354a76", accent: "#9bc6ff", sky: "#11162a" },
  ];
  let canvas, ctx, w = 0, h = 0, last = performance.now();
  let player = { x: 8, y: 7, facing: 1, bob: 0 }, camera = { x: 0, y: 0 }, biome = 0;
  const keys = new Set();

  function visualState() {
    if (typeof WORLD === "undefined") return {};
    WORLD.flags = WORLD.flags || {};
    WORLD.flags.visual25d = WORLD.flags.visual25d || {};
    return WORLD.flags.visual25d;
  }
  function loadState() {
    const s = visualState();
    if (s.player) {
      player.x = Number.isFinite(s.player.x) ? s.player.x : player.x;
      player.y = Number.isFinite(s.player.y) ? s.player.y : player.y;
    }
    biome = Number.isFinite(s.biome) ? ((s.biome % BIOMES.length) + BIOMES.length) % BIOMES.length : 0;
  }
  function saveState() {
    const s = visualState();
    s.player = { x: player.x, y: player.y }; s.biome = biome;
    try { if (typeof autosave === "function") autosave(); } catch (_) {}
  }
  function resize() {
    if (!canvas) return;
    w = innerWidth; h = innerHeight;
    canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function project(x, y, z = 0) {
    return {
      x: (x - 8) * ROW.x + (y - 7) * COL.x + w * .5 - camera.x,
      y: (x - 8) * ROW.y + (y - 7) * COL.y + h * .50 - z - camera.y,
    };
  }
  function tile(x, y, b) {
    const p = project(x, y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + ROW.x, p.y + ROW.y);
    ctx.lineTo(p.x + ROW.x + COL.x, p.y + ROW.y + COL.y);
    ctx.lineTo(p.x + COL.x, p.y + COL.y);
    ctx.closePath();
    ctx.fillStyle = b.ground;
    ctx.fill();
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = 1;
    ctx.stroke();
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const r = n - Math.floor(n);
    if (r > .84) {
      const q = project(x + .45, y + .35);
      ctx.fillStyle = b.accent + "55";
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    if ((x * 7 + y * 11) % 29 === 0) tree(x + .5, y + .45, b);
    if ((x * 5 + y * 3) % 47 === 0) lantern(x + .5, y + .45, b);
  }
  function tree(x, y, b) {
    const p = project(x, y, 7);
    ctx.fillStyle = "#3a2c2c"; ctx.fillRect(p.x - 3, p.y + 7, 6, 20);
    ctx.fillStyle = b.accent + "aa"; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.accent + "38"; ctx.beginPath(); ctx.arc(p.x - 6, p.y - 7, 9, 0, Math.PI * 2); ctx.fill();
  }
  function lantern(x, y, b) {
    const p = project(x, y, 9);
    ctx.fillStyle = "#6d5940"; ctx.fillRect(p.x - 2, p.y + 3, 4, 15);
    ctx.fillStyle = b.accent; ctx.shadowBlur = 12; ctx.shadowColor = b.accent;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function npc(x, y, color) {
    const p = project(x, y, 17); ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#0008";
    ctx.beginPath(); ctx.ellipse(0, 17, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color;
    ctx.fillRect(-6, -7, 12, 20); ctx.beginPath(); ctx.arc(0, -10, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(-3, -11, 2, 2); ctx.fillRect(2, -11, 2, 2); ctx.restore();
  }
  function drawPlayer() {
    const p = project(player.x, player.y, 20 + Math.sin(player.bob) * 2), b = BIOMES[biome];
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(player.facing, 1); ctx.fillStyle = "#0008";
    ctx.beginPath(); ctx.ellipse(0, 18, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = b.accent;
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(-7, -7); ctx.quadraticCurveTo(0, -16, 7, -7); ctx.lineTo(10, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4e9e3"; ctx.beginPath(); ctx.arc(0, -12, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1723"; ctx.fillRect(-6, -19, 12, 4); ctx.restore();
  }
  function update(dt) {
    let dx = 0, dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) { dx--; player.facing = -1; }
    if (keys.has("arrowright") || keys.has("d")) { dx++; player.facing = 1; }
    if (keys.has("arrowup") || keys.has("w")) dy--;
    if (keys.has("arrowdown") || keys.has("s")) dy++;
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      player.x = Math.max(.7, Math.min(MAP_W - .7, player.x + dx / len * dt * 2.6));
      player.y = Math.max(.7, Math.min(MAP_H - .7, player.y + dy / len * dt * 2.6));
      player.bob += dt * 12;
      if (Math.random() < dt * .8) saveState();
    }
    camera.x += (((player.x - 8) * ROW.x + (player.y - 7) * COL.x) - camera.x) * Math.min(1, dt * 4);
    camera.y += (((player.x - 8) * ROW.y + (player.y - 7) * COL.y) - camera.y) * Math.min(1, dt * 4);
  }
  function draw() {
    const b = BIOMES[biome];
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = b.sky; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) tile(x, y, b);
    npc(4.5, 4.5, b.accent); npc(11.5, 8.5, "#d7b7ff"); drawPlayer();
    const glow = ctx.createRadialGradient(w * .5, h * .48, 30, w * .5, h * .48, Math.max(w, h) * .55);
    glow.addColorStop(0, b.accent + "12"); glow.addColorStop(1, "#00000000"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    update(dt); draw(); requestAnimationFrame(frame);
  }
  function boot() {
    const root = document.getElementById("world25d"), old = document.getElementById("world25dCanvas");
    if (!root || !old) return setTimeout(boot, 80);
    old.style.display = "none";
    canvas = document.getElementById("world25dTopdownCanvas") || document.createElement("canvas");
    canvas.id = "world25dTopdownCanvas";
    if (!canvas.parentElement) old.parentElement.insertBefore(canvas, old);
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:1";
    ctx = canvas.getContext("2d"); loadState(); resize(); addEventListener("resize", resize);
    addEventListener("keydown", e => {
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(k)) {
        keys.add(k); e.preventDefault();
      }
    }, { passive: false });
    addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
    requestAnimationFrame(frame);
  }
  boot();
})();