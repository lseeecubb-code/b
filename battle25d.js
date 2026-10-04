/*
 * THE LAST SAVE - real-time 2.5D bullet-dodging battles (Touhou style).
 * The arena exists ONLY while a fight is running: it is created in
 * RealtimeBattle.run(f) and removed when the fight ends.
 *
 * You move and dodge; your shots auto-aim at the nearest enemy.
 * Enemy moves come from monsters.js (monsterChoose) and become bullet patterns;
 * damage, HP, stats, status effects, phases, loot and XP still use the existing RPG code.
 *
 * Controls: WASD / arrows move . Shift focus (slow, tight shots, shows hitbox)
 *           Z potion . X Limit Break (clears bullets) . Esc pause (R = run away)
 *           Touch: drag on the arena.
 */
(function () {
  "use strict";

  // ---- tuning ----
  const RT = {
    FW: 400, FH: 520,        // arena size (logical units)
    SPEED: 190, FOCUS: 80,   // player speed, focused speed
    HIT_R: 3, GRAZE: 13,     // player hitbox radius, graze radius
    SHOT_EVERY: 0.085,       // seconds between volleys
    SHOT_SCALE: 0.07,        // each shot = this * your normal hit damage
    ENEMY_DMG: 0.7,          // each enemy bullet = this * the move's rolled damage
    IFRAMES: 1.4,            // invulnerable seconds after being hit
    MAX_BULLETS: 650,
  };
  const TAU = Math.PI * 2;
  const THEMES = [
    { sky: "#14162a", floor: "#17182b", edge: "#39314f", accent: "#e8c986" },
    { sky: "#0b1d22", floor: "#102628", edge: "#23474a", accent: "#9fe7d1" },
    { sky: "#24101b", floor: "#281522", edge: "#573043", accent: "#ff9aa8" },
    { sky: "#11162a", floor: "#182039", edge: "#354a76", accent: "#9bc6ff" },
  ];
  const ELEM = { fire: "#ff7a45", frost: "#7fd4ff", lightning: "#ffe14d", poison: "#8fe36b", shadow: "#b07cff", holy: "#fff1a8" };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  // ---- bullet patterns (an enemy move picks one by name hash) ----
  // c = { e, q: {n,sp,lo,hi,a,m}, sh(angle, speedMult, x?, y?), aim() }
  const PATS = [
    { iv: .55, fn: (c) => { const n = 3 + Math.min(6, c.q.n * 2); for (let i = 0; i < n; i++) c.sh(c.aim() + (i - (n - 1) / 2) * .2, 1); } },          // aimed fan
    { iv: .8,  fn: (c, k) => { const n = 10 + c.q.n * 4; for (let i = 0; i < n; i++) c.sh(k * .21 + i * TAU / n, .8); } },                          // ring
    { iv: .07, fn: (c, k) => { for (let a = 0; a < 1 + (c.q.n > 2); a++) c.sh(k * .33 + a * Math.PI, .85); } },                                      // spiral
    { iv: .09, fn: (c) => c.sh(Math.PI / 2 + (Math.random() - .5) * .15, .9, Math.random() * RT.FW, -8) },                                          // rain
    { iv: .16, fn: (c, k) => { const m = Math.PI / 2 + Math.sin(k * .18) * .9; for (let i = -1; i <= 1; i++) c.sh(m + i * .14, 1); } },             // sweeping fan
    { iv: .18, fn: (c, k) => { c.sh(c.aim(), 1.25); if (k % 6 === 0) for (let i = 0; i < 8; i++) c.sh(i * TAU / 8 + k * .1, .7); } },               // stream + ring
  ];

  let on = false, cur = null;
  window.Battle25D = { awaiting: false, isActive: () => on, fight: () => cur, onFoeClick: null }; // kept so old scripts don't break

  function run(f) {
    return new Promise((resolve) => {
      const { FW, FH } = RT;
      on = true; cur = f;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

      // ---- overlay (exists only during the fight) ----
      const ov = document.createElement("div");
      ov.id = "rtBattle";
      ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:#05050a;touch-action:none;user-select:none";
      const cv = document.createElement("canvas");
      cv.style.cssText = "width:100%;height:100%;display:block";
      ov.appendChild(cv); document.body.appendChild(ov);
      const g = cv.getContext("2d");
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const th = THEMES[Math.floor(Math.random() * THEMES.length)];
      let W = 0, H = 0, sc = 1, cx = 0, oy = 0;
      function resize() {
        W = window.innerWidth; H = window.innerHeight;
        cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
        sc = Math.min(W * .96 / FW, H * .86 / FH); cx = W / 2; oy = H * .07;
      }
      // 2.5D projection: far (top) is narrower, z lifts things off the floor
      function pr(x, y, z = 0) {
        const d = .72 + .28 * (y / FH);
        return { x: cx + (x - FW / 2) * sc * d, y: oy + y * sc - z * sc * d, s: sc * d };
      }
      resize(); window.addEventListener("resize", resize);

      // ---- state ----
      const pl = { x: FW / 2, y: FH - 70, inv: 0, fire: 0 };
      const keys = new Set(), pb = [], eb = [];
      let t = 0, last = performance.now(), paused = false, done = null, banner = "";
      let acc = 0, potCd = 0, dotT = 0, shake = 0, flash = 0, raf = 0, ended = false;
      const dmgBase = () => (C.PLAYER_DAMAGE[0] + C.PLAYER_DAMAGE[1]) / 2 + f.stats.damage + (f.temporary_damage || 0);
      const alive = () => f.enemies.filter((e) => e.hp > 0);
      const nearest = () => alive().sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      const healItem = () => Object.keys(USABLE_ITEMS).find((n) => USABLE_ITEMS[n].heal && (inventory[n] || 0) > 0);

      f.enemies.forEach((e, i) => {
        e.rx = FW * (i + 1) / (f.enemies.length + 1); e.ry = 70 + (i % 2) * 30;
        e.x = e.rx; e.y = -40; e.flash = 0; e.fade = 1; e.rt = { mode: "rest", until: 1.2 };
      });

      // ---- enemy bullets ----
      function shoot(e, q, ang, mult, x, y) {
        if (eb.length > RT.MAX_BULLETS) return;
        const sp = q.sp * mult;
        const dmg = Math.max(1, Math.round((q.lo + Math.random() * (q.hi - q.lo)) * RT.ENEMY_DMG * q.m));
        eb.push({ x: x ?? e.x, y: y ?? e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 4.5, dmg, a: q.a, o: e, g: 0, col: ELEM[q.a.element] || "#ff6b9e" });
      }
      function pick(e, r, enr) {
        const ch = monsterChoose(e.monster, null);
        r.label = ""; r.labelT = t;
        if (ch.kind === "attack" && ch.attack && ch.attack.damage) {
          const a = ch.attack, n = a.hits || 1, [lo, hi] = a.damage;
          const q = { n, sp: Math.min(170, 80 + (e.monster.level || 1) * 3 + n * 6) * (enr ? 1.1 : 1), lo, hi, a, m: enr ? 1.25 : 1 };
          r.mode = "cast"; r.pat = PATS[hash(a.name) % PATS.length]; r.k = 0;
          r.c = { e, q, sh: (ang, m, x, y) => shoot(e, q, ang, m, x, y), aim: () => Math.atan2(pl.y - e.y, pl.x - e.x) };
          r.start = t + .6; r.next = r.start; r.end = r.start + Math.min(5, 2.4 + n * .5);
          r.label = String(a.name).toUpperCase();
          return;
        }
        r.mode = "rest"; r.until = t + 1.4;
        if (ch.kind === "heal" && ch.attack) { e.hp = Math.min(e.monster.hp, e.hp + randint(...ch.attack.heal)); r.label = "HEAL"; }
        else if (ch.kind === "block") { e.gf = 1 - (e.monster.block_reduction || .5); e.gUntil = t + 2.5; r.label = "GUARD"; r.until = t + 2.5; }
        else if (ch.kind === "parry_stance" || ch.kind === "dodge_stance") { e.gf = .55; e.gUntil = t + 2.2; r.label = ch.kind.replace("_", " ").toUpperCase(); r.until = t + 2.2; }
        else { e.vuln = t + 1.4; }
      }
      function updEnemy(e, i, dt) {
        if (e.hp <= 0) { e.fade = Math.max(0, e.fade - dt * 2); return; }
        e.fade = 1;
        const boss = e.monster.chance <= 0, enr = e.hp <= e.monster.hp * .5;
        e.x = e.rx + Math.sin(t * (boss ? .5 : .8) + i * 2) * (boss ? 90 : 55);
        e.y += (e.ry + Math.sin(t * 1.3 + i) * 10 - e.y) * Math.min(1, dt * 3);
        e.flash = Math.max(0, e.flash - dt);
        const r = e.rt || (e.rt = { mode: "rest", until: t + 1 });
        if (r.mode === "rest") { if (t >= r.until) pick(e, r, enr); }
        else {
          if (t >= r.start && t >= r.next) { r.pat.fn(r.c, r.k++); r.next = t + r.pat.iv / (enr ? 1.25 : 1); }
          if (t >= r.end) { r.mode = "rest"; r.until = t + (enr ? .8 : 1.3); }
        }
      }

      // ---- player ----
      function fire(foc) {
        const tg = nearest(); if (!tg) return;
        f.target = f.enemies.indexOf(tg);
        const weaponName = equipment?.weapon || "iron fist";
        const weapon = ITEMS?.[weaponName] || ITEMS?.["iron fist"];
        const proj = weapon?.projectile || {};
        const style = proj.style || (weaponName === "iron fist" ? "fist" : "weapon");
        const range = Math.max(35, Number(proj.range ?? (weaponName === "iron fist" ? 135 : 300)));
        const speed = Math.max(120, Number(proj.speed ?? (weaponName === "iron fist" ? 250 : 560)));
        const radius = Math.max(3, Number(proj.radius ?? 5));
        const count = Math.max(1, Math.floor(Number(proj.count ?? (foc ? 2 : 3))));
        const spread = Number(proj.spread ?? (weaponName === "iron fist" ? 0 : (foc ? .025 : .14)));
        const homing = Boolean(proj.homing ?? (weaponName === "iron fist" ? false : !foc));
        const baseDamage = Math.max(1, dmgBase() * RT.SHOT_SCALE * (foc ? 1.3 : 1));
        const base = Math.atan2(tg.y - pl.y, tg.x - pl.x);
        for (let i = 0; i < count; i++) {
          const centered = i - (count - 1) / 2;
          const a = base + centered * spread;
          pb.push({
            x: pl.x, y: pl.y - 8,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            d: weaponName === "iron fist" ? Math.max(1, baseDamage * .75) : baseDamage,
            hom: homing ? 1 : 0,
            life: range / speed,
            r: radius,
            style,
            weapon: weaponName,
            color: proj.color || "#bfeaff",
          });
        }
      }
      function hitEnemy(e, d) {
        if (Math.random() < (C.CRIT + f.stats.crit) / 100) d *= C.CRIT_MULT;
        if (e.gUntil > t) d *= e.gf;
        if (e.vuln > t) d *= 1.25;
        e.hp -= d; e.flash = .07; acc += d / 8;
        if (acc >= 1) { chargeLimit(f, Math.floor(acc)); acc %= 1; }
      }
      function hurt(b) {
        let d = reducePlayerDamage(f, b.dmg);
        const r = f.resist[b.a.element] || 0;
        if (r) d = Math.max(0, Math.round(d * (1 - r / 100)));
        f.player_hp -= d; pl.inv = RT.IFRAMES; flash = .25; shake = 7;
        print(`💔 ${String(b.a.name).toUpperCase()} hits you for ${d} damage.`);
        chargeLimit(f, Math.max(1, Math.round(d / 5)));
        if (b.a.special_effect && typeof applySpecialEffect === "function") applySpecialEffect(f, b.a);
      }
      function potion() {
        const n = healItem();
        if (!n || potCd > 0 || f.player_hp >= f.player_max_hp) return;
        useItem(f, n); potCd = 2;
      }
      function limit() {
        if ((f.limitGauge || 0) < 100 || f.limitUsed) return;
        useLimitBreak(f); eb.length = 0; pl.inv = 1.5; flash = .6; shake = 12;
      }

      // ---- update ----
      function update(dt) {
        t += dt; potCd = Math.max(0, potCd - dt); pl.inv = Math.max(0, pl.inv - dt);
        shake *= Math.exp(-dt * 8); flash = Math.max(0, flash - dt);
        let dx = 0, dy = 0;
        if (keys.has("arrowleft") || keys.has("a")) dx--;
        if (keys.has("arrowright") || keys.has("d")) dx++;
        if (keys.has("arrowup") || keys.has("w")) dy--;
        if (keys.has("arrowdown") || keys.has("s")) dy++;
        const foc = keys.has("shift"), spd = foc ? RT.FOCUS : RT.SPEED, l = Math.hypot(dx, dy) || 1;
        pl.x = clamp(pl.x + dx / l * spd * dt, 8, FW - 8); pl.y = clamp(pl.y + dy / l * spd * dt, 8, FH - 8);
        pl.fire -= dt; if (pl.fire <= 0) { pl.fire = RT.SHOT_EVERY; fire(foc); }
        f.enemies.forEach((e, i) => updEnemy(e, i, dt));

        for (const b of pb) {
          if (b.hom) {
            const tg = nearest();
            if (tg) {
              let cur2 = Math.atan2(b.vy, b.vx), diff = Math.atan2(tg.y - b.y, tg.x - b.x) - cur2;
              diff = Math.atan2(Math.sin(diff), Math.cos(diff));
              cur2 += clamp(diff, -6 * dt, 6 * dt); b.vx = Math.cos(cur2) * 420; b.vy = Math.sin(cur2) * 420;
            }
          }
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.life = (b.life ?? Infinity) - dt;
          if (b.life <= 0 || b.x < -40 || b.x > FW + 40 || b.y < -50 || b.y > FH + 50) { b.dead = true; continue; }
          for (const e of f.enemies) {
            if (e.hp <= 0) continue;
            const rr = e.monster.chance <= 0 ? 34 : 24;
            if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) { hitEnemy(e, b.d); b.dead = true; break; }
          }
        }
        for (const b of eb) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < -30 || b.x > FW + 30 || b.y < -30 || b.y > FH + 30 || b.o.hp <= 0) { b.dead = true; continue; }
          const ddx = b.x - pl.x, ddy = b.y - pl.y, d2 = ddx * ddx + ddy * ddy;
          if (pl.inv <= 0 && d2 < (b.r + RT.HIT_R) ** 2) { hurt(b); b.dead = true; }
          else if (!b.g && d2 < (b.r + RT.GRAZE) ** 2) { b.g = 1; acc += .35; }
        }
        for (let i = pb.length - 1; i >= 0; i--) if (pb[i].dead) pb.splice(i, 1);
        for (let i = eb.length - 1; i >= 0; i--) if (eb[i].dead) eb.splice(i, 1);

        // status effects tick every 3 seconds instead of every turn
        dotT += dt;
        if (dotT >= 3) {
          dotT -= 3; resolveEffects(f);
          f.enemies.forEach((e, i) => { if (e.hp > 0) { f.target = i; resolveMonsterEffects(f); } });
        }

        // boss phases, victory, defeat
        if (advanceBossForms(f)) { eb.length = 0; f.enemies.forEach((e) => { e.rt = null; }); }
        const won = typeof foesDown === "function" ? foesDown(f) : f.enemies.every((e) => e.hp <= 0);
        if (won) return finish("win", "VICTORY");
        if (f.player_hp <= 0) {
          if (playerDown(f)) return finish("lose", "DEFEATED");
          eb.length = 0; pl.inv = 2; flash = .5;
        }
      }

      // ---- drawing ----
      function glow(p, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); }
      function bar(x, y, wd, fr, col) {
        g.fillStyle = "#000a"; g.fillRect(x - wd / 2, y, wd, 7);
        g.fillStyle = col; g.fillRect(x - wd / 2, y, wd * clamp(fr, 0, 1), 7);
        g.strokeStyle = "#ffffff30"; g.strokeRect(x - wd / 2 + .5, y + .5, wd - 1, 6);
      }
      function text(s, x, y, col = "#e9e3f2", size = 12, align = "center") {
        g.font = `700 ${size}px ui-monospace,monospace`; g.textAlign = align; g.fillStyle = "#000"; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
      }
      function draw() {
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, th.sky); gr.addColorStop(1, "#05050a");
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.save();
        if (shake > .3) g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        // floor
        const A = pr(0, 0), B = pr(FW, 0), Cc = pr(FW, FH), D = pr(0, FH);
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(Cc.x, Cc.y); g.lineTo(D.x, D.y); g.closePath();
        g.fillStyle = th.floor; g.fill();
        g.save(); g.clip();
        g.strokeStyle = th.edge; g.globalAlpha = .6; g.lineWidth = 1;
        for (let k = 0; k <= 13; k++) { const y = (k * FH / 13 + t * 24) % FH, l = pr(0, y), r = pr(FW, y); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke(); }
        for (let k = 0; k <= 8; k++) { const x = k * FW / 8, l = pr(x, 0), r = pr(x, FH); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke(); }
        g.restore();
        g.globalAlpha = 1; g.strokeStyle = th.accent; g.lineWidth = 2;
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(Cc.x, Cc.y); g.lineTo(D.x, D.y); g.closePath(); g.stroke();

        // enemies
        for (const e of f.enemies) {
          if (e.fade <= 0) continue;
          const boss = e.monster.chance <= 0, p = pr(e.x, e.y, 28), sp = pr(e.x, e.y, 0), size = (boss ? 96 : 62) * p.s;
          g.globalAlpha = .55 * e.fade; g.fillStyle = "#000"; g.beginPath(); g.ellipse(sp.x, sp.y + 4 * sp.s, size * .5, size * .16, 0, 0, TAU); g.fill();
          g.globalAlpha = e.fade;
          if (e.gUntil > t) { g.strokeStyle = "#7a9cff"; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y - size * .1, size * .62, 0, TAU); g.stroke(); }
          const r = e.rt;
          if (r && r.mode === "cast" && t < r.start) { g.strokeStyle = th.accent; g.lineWidth = 2; g.globalAlpha = .8; g.beginPath(); g.arc(p.x, p.y - size * .1, size * (.5 + (r.start - t)), 0, TAU); g.stroke(); g.globalAlpha = e.fade; }
          if (e.flash > 0) g.filter = "brightness(2.4)";
          g.font = `${size}px serif`; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
          g.fillText(e.monster.icon || "👹", p.x, p.y);
          g.filter = "none"; g.globalAlpha = 1;
          if (r && r.label && t - r.labelT < 1.6) text(r.label, p.x, p.y - size * .95, "#ffb347", 11);
        }
        // player
        {
          const sp = pr(pl.x, pl.y, 0), p = pr(pl.x, pl.y, 12), k = p.s * .85, foc = keys.has("shift");
          g.globalAlpha = .55; g.fillStyle = "#000"; g.beginPath(); g.ellipse(sp.x, sp.y + 2, 13 * k, 5 * k, 0, 0, TAU); g.fill();
          g.globalAlpha = pl.inv > 0 && Math.sin(t * 40) > 0 ? .35 : 1;
          g.save(); g.translate(p.x, p.y); g.scale(k, k);
          g.fillStyle = th.accent; g.beginPath(); g.moveTo(-10, 12); g.lineTo(-7, -7); g.quadraticCurveTo(0, -16, 7, -7); g.lineTo(10, 12); g.closePath(); g.fill();
          g.fillStyle = "#f4e9e3"; g.beginPath(); g.arc(0, -12, 7, 0, TAU); g.fill();
          g.fillStyle = "#1a1723"; g.fillRect(-6, -19, 12, 4);
          g.restore(); g.globalAlpha = 1;
          const hp = pr(pl.x, pl.y, 12);
          if (foc) { g.strokeStyle = "#fff8"; g.lineWidth = 1; g.beginPath(); g.arc(hp.x, hp.y, RT.GRAZE * hp.s, 0, TAU); g.stroke(); }
          g.fillStyle = "#ff3d5a"; g.beginPath(); g.arc(hp.x, hp.y, (foc ? 4 : 2.5) * hp.s * .8, 0, TAU); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(hp.x, hp.y, 1.5 * hp.s * .8, 0, TAU); g.fill();
        }
        // bullets
        g.save(); g.globalCompositeOperation = "lighter";
        for (const b of eb) { const p = pr(b.x, b.y, 12); glow(p, b.r * p.s * 2.2, b.col, .28); glow(p, b.r * p.s * 1.2, b.col, .9); }
        g.restore();
        g.globalAlpha = 1; g.lineCap = "round";
        for (const b of eb) { const p = pr(b.x, b.y, 12); glow(p, b.r * p.s * .55, "#fff", 1); }
        g.strokeStyle = "#bfeaff"; g.lineWidth = 2.2;
        for (const b of pb) {
          const p = pr(b.x, b.y, 12), q = pr(b.x - b.vx * .025, b.y - b.vy * .025, 12);
          if (b.style === "fist" || b.weapon === "iron fist") {
            g.save();
            g.fillStyle = b.color || "#f0d0bd";
            g.strokeStyle = "#7b5140";
            g.lineWidth = 1.5;
            g.translate(p.x, p.y);
            g.rotate(Math.atan2(b.vy, b.vx));
            g.beginPath();
            g.arc(0, 0, Math.max(4, b.r || 7), 0, TAU);
            g.fill(); g.stroke();
            g.fillStyle = "#fff8";
            g.fillRect(-1, -2, Math.max(3, (b.r || 7) * .9), 2);
            g.restore();
          } else {
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
          }
        }
        g.restore();
        if (flash > 0) { g.globalAlpha = Math.min(.5, flash); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }

        // HUD
        const bw = Math.min(W * .8, 420), live = f.enemies.filter((e) => e.fade > 0);
        live.forEach((e, i) => {
          const y = 8 + i * 24, label = String(e.displayName || e.name).toUpperCase().slice(0, 26);
          text(label + (e.phases && e.phases.length ? `  [${(e.phase || 0) + 1}/${e.phases.length}]` : ""), W / 2, y + 9, "#e9e3f2", 11);
          bar(W / 2, y + 12, bw, e.hp / e.monster.hp, e.hp <= e.monster.hp * .5 ? "#ff8a47" : "#7a6cff");
        });
        const by = H - 40;
        bar(W / 2, by, Math.min(W * .6, 360), f.player_hp / f.player_max_hp, "#d4364f");
        text(`YOU ${Math.max(0, Math.round(f.player_hp))}/${Math.round(f.player_max_hp)}`, W / 2, by - 4, "#e9e3f2", 11);
        const lg = f.limitUsed ? 0 : (f.limitGauge || 0);
        g.fillStyle = "#000a"; g.fillRect(W / 2 - Math.min(W * .6, 360) / 2, by + 10, Math.min(W * .6, 360), 4);
        g.fillStyle = lg >= 100 ? "#ffe14d" : "#c9a43a"; g.fillRect(W / 2 - Math.min(W * .6, 360) / 2, by + 10, Math.min(W * .6, 360) * lg / 100, 4);
        const it = healItem();
        text(`Z potion${it ? ` (${inventory[it]})` : " (none)"}  ·  X limit break${lg >= 100 ? " READY" : ""}  ·  Shift focus  ·  Esc pause`, W / 2, H - 8, "#8b86a0", 10);
        if (paused) { g.fillStyle = "#000b"; g.fillRect(0, 0, W, H); text("PAUSED", W / 2, H / 2 - 8, "#fff", 28); text("Esc resume  ·  R run away", W / 2, H / 2 + 20, "#bbb", 13); }
        if (banner) { g.fillStyle = "#0008"; g.fillRect(0, H / 2 - 40, W, 80); text(banner, W / 2, H / 2 + 10, th.accent, 34); }
      }

      // ---- input ----
      const GAME = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "shift", "z", "x", "escape", "r", " "]);
      function onKey(e) {
        const k = e.key.toLowerCase();
        if (!GAME.has(k)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.type === "keyup") { keys.delete(k); return; }
        if (e.repeat) return;
        keys.add(k);
        if (done) return;
        if (k === "escape") paused = !paused;
        else if (paused && k === "r") { f.fled = true; paused = false; finish("fled", "ESCAPED"); }
        else if (!paused && k === "z") potion();
        else if (!paused && k === "x") limit();
      }
      const blurKeys = () => keys.clear();
      window.addEventListener("keydown", onKey, true); window.addEventListener("keyup", onKey, true); window.addEventListener("blur", blurKeys);
      let pid = null, px = 0, py = 0;
      cv.onpointerdown = (e) => { pid = e.pointerId; px = e.clientX; py = e.clientY; cv.setPointerCapture(pid); };
      cv.onpointermove = (e) => { if (e.pointerId !== pid || paused || done) return; pl.x = clamp(pl.x + (e.clientX - px) / sc, 8, FW - 8); pl.y = clamp(pl.y + (e.clientY - py) / sc, 8, FH - 8); px = e.clientX; py = e.clientY; };
      cv.onpointerup = () => { pid = null; };

      // ---- lifecycle ----
      function finish(res, text2) {
        if (done) return;
        done = res; banner = text2; eb.length = 0;
        f.enemies.forEach((e) => { if (e.hp > 0) e.hp = Math.max(1, Math.round(e.hp)); else e.hp = Math.min(0, Math.round(e.hp)); });
        setTimeout(cleanup, 1000);
      }
      function cleanup() {
        if (ended) return; ended = true;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("keydown", onKey, true); window.removeEventListener("keyup", onKey, true); window.removeEventListener("blur", blurKeys);
        ov.remove(); on = false; cur = null;
        const cmd = document.getElementById("command"); if (cmd) cmd.focus();
        resolve(done);
      }
      function frame(now) {
        const dt = Math.min(.033, (now - last) / 1000 || .016); last = now;
        if (!paused && !done) update(dt);
        draw();
        if (!ended) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    });
  }

  window.RealtimeBattle = { run };
})();
