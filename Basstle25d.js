/*
 * THE LAST SAVE — 2.5D battle stage.
 * The whole game stays in the terminal. Only while a fight is running, a depth-sorted
 * 2.5D arena appears above the terminal text. It is read-only: it watches the fight
 * object (HP, enemies, effects) and animates changes. Combat rules are untouched, and
 * every command is still typed in the terminal.
 */
(function () {
  "use strict";
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const THEMES = [
    { sky: "#14162a", floor: "#17182b", edge: "#39314f", accent: "#e8c986" },
    { sky: "#0b1d22", floor: "#102628", edge: "#23474a", accent: "#9fe7d1" },
    { sky: "#24101b", floor: "#281522", edge: "#573043", accent: "#ff9aa8" },
    { sky: "#11162a", floor: "#182039", edge: "#354a76", accent: "#9bc6ff" },
  ];

  let host, view, canvas, ctx, tag, w = 0, h = 0, raf = 0, last = 0, active = false;
  let fight = null, theme = THEMES[0], t = 0, shake = 0, boss = false;
  const player = { hp: 1, max: 1, shown: 1, lunge: 0, hit: 0, down: 0 };
  let foes = [];
  const floaters = [];
  const sparks = [];

  function build() {
    if (host) return;
    host = document.createElement("section");
    host.id = "battle25d";
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = '<div class="b25-view"><canvas></canvas><div class="b25-tag">BATTLE · 2.5D</div></div><div class="b25-bar" id="b25Bar"></div>';
    view = host.querySelector(".b25-view");
    const screen = document.getElementById("screen");
    screen.parentNode.insertBefore(host, screen);
    canvas = host.querySelector("canvas");
    ctx = canvas.getContext("2d");
    tag = host.querySelector(".b25-tag");
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", (e) => {
      if (window.Battle25D && window.Battle25D.onFoeClick) window.Battle25D.onFoeClick(foeAt(e.clientX, e.clientY));
    });
  }

  function resize() {
    if (!canvas) return;
    w = view.clientWidth; h = view.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * DPR));
    canvas.height = Math.max(1, Math.floor(h * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ---- reading the fight (never writes to it) ----
  function enemyList(f) {
    return f && f.enemies ? f.enemies : f ? [{ name: f.name, displayName: f.name, hp: f.monster_hp, monster: f.monster }] : [];
  }
  function sync() {
    if (!fight) return;
    player.max = Math.max(1, fight.player_max_hp || 1);
    const php = Math.max(0, fight.player_hp ?? player.hp);
    if (php < player.hp) { player.hit = 1; spawn("player", player.hp - php, "#ff6b7d"); shake = Math.max(shake, 6); }
    else if (php > player.hp) spawn("player", php - player.hp, "#7be3a4", "+");
    player.hp = php;
    const list = enemyList(fight);
    list.forEach((e, i) => {
      let s = foes[i];
      if (!s) {
        s = foes[i] = { hp: e.hp, max: Math.max(1, e.monster?.hp || e.hp), shown: e.hp, lunge: 0, hit: 0, dead: 0, icon: e.monster?.icon || "👾" };
      }
      s.max = Math.max(s.max, e.hp, e.monster?.hp || 0);
      s.icon = e.monster?.icon || s.icon;
      s.name = e.displayName || e.name;
      s.stunned = (e.stun_turns || 0) > 0;
      s.staggered = !!e.staggered;
      s.exposed = (e.effects || []).some((x) => x.type === "exposed");
      s.target = fight.enemies && fight.target === i;
      if (e.hp < s.hp) { s.hit = 1; shake = Math.max(shake, 4); spawn(i, s.hp - e.hp, "#ffd36b"); }
      else if (e.hp > s.hp) spawn(i, e.hp - s.hp, "#7be3a4", "+");
      s.hp = e.hp;
    });
  }
  function spawn(who, amount, color, sign = "-") {
    floaters.push({ who, text: sign + Math.round(amount), color, age: 0 });
    for (let i = 0; i < 9; i++) sparks.push({ who, vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 60, age: 0, color });
  }
  // The log lines tell us who is attacking, so we can lunge toward the target.
  function onLine(text) {
    if (!active || !fight) return;
    const s = String(text);
    if (/^\s*(💥|⚔️|🗡️)?\s*You\b|\byou (strike|hit|slash|attack|cast)/i.test(s) && /damage/i.test(s)) player.lunge = 1;
    else if (/damage/i.test(s) && !/^\s*💥?\s*You/i.test(s)) {
      const i = Math.max(0, fight.target || 0);
      if (foes[i]) foes[i].lunge = 1;
    }
  }

  // ---- drawing ----
  const ease = (a, b, k) => a + (b - a) * k;
  function proj(gx, gy, z = 0) {
    // gx: -1..1 across, gy: 0 (far) .. 1 (near). Perspective squeeze gives the 2.5D look.
    const depth = .55 + gy * .45;
    return { x: w * .5 + gx * (w * .46) * depth, y: h * (.34 + gy * .5) - z * depth, s: depth };
  }
  function floorTiles() {
    const rows = 7, cols = 10;
    for (let r = 0; r < rows; r++) {
      const g0 = r / rows, g1 = (r + 1) / rows;
      for (let c = 0; c < cols; c++) {
        const x0 = -1 + (c / cols) * 2, x1 = -1 + ((c + 1) / cols) * 2;
        const a = proj(x0, g0), b = proj(x1, g0), d = proj(x1, g1), e = proj(x0, g1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.closePath();
        ctx.fillStyle = (r + c) % 2 ? theme.floor : shade(theme.floor, 1.25);
        ctx.fill(); ctx.strokeStyle = theme.edge; ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
  function bar(x, y, wd, frac, color, back) {
    ctx.fillStyle = back || "#000a"; ctx.fillRect(x - wd / 2, y, wd, 6);
    ctx.fillStyle = color; ctx.fillRect(x - wd / 2, y, wd * Math.max(0, Math.min(1, frac)), 6);
    ctx.strokeStyle = "#ffffff30"; ctx.strokeRect(x - wd / 2 + .5, y + .5, wd - 1, 5);
  }
  function shadow(p, r) {
    ctx.fillStyle = "#0009"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4 * p.s, r * p.s, r * .38 * p.s, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawPlayer() {
    const gx = -.55 + player.lunge * .35 - player.hit * .03;
    const p = proj(gx, .86, 4 + Math.sin(t * 3) * 2 * (player.hp > 0));
    shadow(p, 30);
    ctx.save(); ctx.translate(p.x, p.y);
    const k = p.s * (Math.min(w, 520) / 520 + .55) * .8;
    ctx.scale(k, k);
    if (player.hp <= 0) ctx.rotate(-1.2);
    ctx.globalAlpha = player.hit > .5 ? .55 + .45 * Math.sin(t * 60) : 1;
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-13, -44); ctx.quadraticCurveTo(0, -62, 13, -44); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4e9e3"; ctx.beginPath(); ctx.arc(0, -56, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1723"; ctx.fillRect(-11, -68, 22, 7);
    ctx.strokeStyle = "#e9edf5"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(14, -30); ctx.lineTo(34 + player.lunge * 14, -52 - player.lunge * 8); ctx.stroke();
    ctx.restore();
    const b = proj(gx, .86, 124);
    bar(b.x, b.y, 84, player.shown / player.max, "#d4364f");
    ctx.fillStyle = "#e9e3f2"; ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center";
    ctx.fillText(`YOU ${Math.max(0, Math.round(player.hp))}/${Math.round(player.max)}`, b.x, b.y - 5);
  }
  function intentLabel(e) {
    try {
      const it = e && e.intent; if (!it) return "";
      const k = it.kind;
      if (k === "stunned" || k === "staggered") return "✦ CAN'T ACT";
      if (k === "idle") return "…";
      if (k === "block") return "▶ GUARDING";
      if (k === "parry_stance") return "▶ PARRY STANCE";
      if (k === "dodge_stance") return "▶ DODGE STANCE";
      const a = it.attack; if (!a) return "";
      if (k === "heal") return "▶ " + String(a.name).toUpperCase() + " (HEAL)";
      const st = fight.stats;
      return `▶ ${String(a.name).toUpperCase()}${a.warning ? " !!" : ""}  P${parryChance(a, st) ? "✓" : "✗"} G${canGuard(a) ? "✓" : "✗"} D${dodgeChance(a, st) ? "✓" : "✗"}`;
    } catch (_) { return ""; }
  }
  function foeAt(cx, cy) {
    if (!canvas) return -1;
    const r = canvas.getBoundingClientRect(); const x = cx - r.left, y = cy - r.top;
    let best = -1, bd = 1e9;
    foes.forEach((s, i) => {
      if (s.hp <= 0) return;
      const p = proj(enemyX(i), enemyY(i), 40); const rad = (boss ? 80 : 56) * p.s;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < rad && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function drawFoe(s, i, n) {
    const slot = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const gx = n === 1 ? .5 : .15 + (slot + 1) * .3;
    const gy = n === 1 ? .38 : .30 + (i % 2) * .16;
    const fade = s.dead ? Math.max(0, 1 - s.dead) : 1;
    const p = proj(gx - s.lunge * .4 + s.hit * .02, gy, 6 + Math.sin(t * 2 + i) * 3);
    shadow(p, boss ? 56 : 38);
    ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y);
    const size = (boss ? 92 : 62) * p.s * (Math.min(w, 560) / 560 + .5);
    if (s.target && n > 1) { ctx.strokeStyle = theme.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 6, size * .62, size * .2, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (s.hit > .4) ctx.filter = "brightness(2.2)";
    ctx.font = `${size}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(s.icon, 0, -size * .1);
    ctx.filter = "none"; ctx.restore();
    if (fade > .05) {
      const b = proj(gx, gy, 6 + (boss ? 144 : 110));
      bar(b.x, b.y, boss ? 150 : 100, s.shown / s.max, s.staggered ? "#ffb347" : "#7a6cff");
      ctx.fillStyle = "#e9e3f2"; ctx.font = "700 10px ui-monospace,monospace"; ctx.textAlign = "center";
      const flag = s.stunned ? " ✦STUN" : s.staggered ? " ✦BREAK" : s.exposed ? " ✦OPEN" : "";
      ctx.fillText(String(s.name || "").toUpperCase().slice(0, 22) + flag, b.x, b.y - 5);
      if (window.Battle25D && window.Battle25D.awaiting && fight && fight.enemies) {
        const lbl = intentLabel(fight.enemies[i]);
        if (lbl) { ctx.fillStyle = "#ffb347"; ctx.font = "700 10px ui-monospace,monospace"; ctx.fillText(lbl, b.x, b.y - 20); }
      }
    }
  }
  function drawFloaters(dt) {
    ctx.font = "800 22px ui-monospace,monospace"; ctx.textAlign = "center";
    for (const f of floaters) {
      f.age += dt;
      const slot = f.who === "player" ? { gx: -.55, gy: .86 } : { gx: enemyX(f.who), gy: enemyY(f.who) };
      const p = proj(slot.gx, slot.gy, 110 + f.age * 60);
      ctx.globalAlpha = Math.max(0, 1 - f.age / 1.1);
      ctx.fillStyle = "#000"; ctx.fillText(f.text, p.x + 1, p.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].age > 1.1) floaters.splice(i, 1);
    for (const s of sparks) {
      s.age += dt;
      const slot = s.who === "player" ? { gx: -.55, gy: .86 } : { gx: enemyX(s.who), gy: enemyY(s.who) };
      const p = proj(slot.gx, slot.gy, 50);
      ctx.globalAlpha = Math.max(0, 1 - s.age / .7);
      ctx.fillStyle = s.color;
      ctx.fillRect(p.x + s.vx * s.age, p.y + s.vy * s.age + 140 * s.age * s.age, 3, 3);
    }
    ctx.globalAlpha = 1;
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].age > .7) sparks.splice(i, 1);
  }
  function enemyX(i) { const n = foes.length; return n === 1 ? .5 : .15 + (((i / (n - 1)) * 2 - 1) + 1) * .3; }
  function enemyY(i) { return foes.length === 1 ? .38 : .30 + (i % 2) * .16; }

  function frame(now) {
    if (!active) return;
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; t += dt;
    sync();
    const q = 1 - Math.exp(-dt * 7);
    player.shown = ease(player.shown, player.hp, q);
    foes.forEach((s) => { s.shown = ease(s.shown, s.hp, q); if (s.hp <= 0) s.dead = Math.min(1, s.dead + dt * 1.4); });
    player.lunge = Math.max(0, player.lunge - dt * 3); player.hit = Math.max(0, player.hit - dt * 3);
    foes.forEach((s) => { s.lunge = Math.max(0, s.lunge - dt * 3); s.hit = Math.max(0, s.hit - dt * 3); });
    shake *= Math.exp(-dt * 8);
    if (w && h) {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, theme.sky); g.addColorStop(1, "#05050a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = .14; ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(w * .8, h * .2, Math.min(w, h) * .16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save();
      if (shake > .3) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      floorTiles();
      // painter's order: far things first
      const order = foes.map((s, i) => ({ y: enemyY(i), draw: () => drawFoe(s, i, foes.length) }));
      order.push({ y: .86, draw: drawPlayer });
      order.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
      drawFloaters(dt);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  }

  window.Battle25D = {
    awaiting: false,
    isActive: () => active,
    fight: () => fight,
    onFoeClick: null,
  };

  // ---- show / hide around a fight ----
  function begin() {
    build();
    active = true; fight = null; foes = []; floaters.length = 0; sparks.length = 0; shake = 0; boss = false;
    player.hp = player.shown = 1; player.max = 1; player.hit = player.lunge = 0;
    theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    document.body.classList.add("battle25d-on");
    resize(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    const sc = document.getElementById("screen"); if (sc) sc.scrollTop = sc.scrollHeight;
  }
  function end() {
    active = false; cancelAnimationFrame(raf); fight = null;
    document.body.classList.remove("battle25d-on");
  }

  // Wrap showStatus (printed every turn) to learn the current fight object.
  if (typeof showStatus === "function") {
    const origStatus = showStatus;
    showStatus = function (f) {
      if (active) {
        if (fight !== f) {
          fight = f; foes = [];
          const list = enemyList(f);
          boss = list.some((e) => e.monster && e.monster.chance <= 0) || list.length === 1 && !!(list[0].phases && list[0].phases.length);
          player.hp = player.shown = Math.max(0, f.player_hp);
        }
        resize();
      }
      return origStatus.apply(this, arguments);
    };
  }
  // Wrap print so lunge animations follow the battle text.
  if (typeof print === "function") {
    const origPrint = print;
    print = function () { try { onLine(arguments[0]); } catch (_) {} return origPrint.apply(this, arguments); };
  }
  // Wrap fightMonster: stage up for the fight, down afterwards (win, loss or flee).
  if (typeof fightMonster === "function") {
    const origFight = fightMonster;
    fightMonster = async function () {
      begin();
      try { return await origFight.apply(this, arguments); }
      finally { setTimeout(end, 900); }
    };
  }
})();
