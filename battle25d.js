/*
 * THE LAST SAVE - real-time 2.5D bullet-dodging battles (Touhou style).
 * The arena exists ONLY while a fight is running: it is created in
 * RealtimeBattle.run(f) and removed when the fight ends.
 *
 * You move and dodge; your default weapon attack auto-fires at the nearest enemy.
 * Skills remain manually triggered by the battle keybinds.
 * Enemy moves come from monsters.js (monsterChoose) and become bullet patterns;
 * damage, HP, stats, status effects, phases, loot and XP still use the existing RPG code.
 *
 * Controls: WASD / arrows move . Shift focus (slow, tight shots, shows hitbox)
 *           Z potion . X Limit Break (clears bullets) . Esc pause (R = run away)
 *           Touch: drag on the arena.
 */
(function () {
  "use strict";

  const RT = {
    FW: 400, FH: 520,
    SPEED: 190, FOCUS: 80,
    HIT_R: 3, GRAZE: 13,
    AUTO_ATTACK: true,
    SHOT_EVERY: 0.085,
    SHOT_SCALE: 0.07,
    ENEMY_DMG: 0.7,
    IFRAMES: 1.4,
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

  const PATS = [
    { iv: .55, fn: (c) => { const n = 3 + Math.min(6, c.q.n * 2); for (let i = 0; i < n; i++) c.sh(c.aim() + (i - (n - 1) / 2) * .2, 1); } },
    { iv: .8, fn: (c, k) => {
      const n = 10 + c.q.n * 4;
      for (let i = 0; i < n; i++) {
        const a = k * .21 + i * TAU / n;
        // Slow homing on alternating orbit shots creates readable curved paths.
        c.sh(a, .8, null, null, i % 2 === 0 ? { hom: true, turn: .95 } : null);
      }
    } },
    { iv: .07, fn: (c, k) => {
      for (let a = 0; a < 1 + (c.q.n > 2); a++) {
        // A few of the needle shots gently bend toward the player.
        c.sh(k * .33 + a * Math.PI, .85, null, null, { hom: true, turn: 1.35 });
      }
    } },
    { iv: .09, fn: (c) => c.sh(Math.PI / 2 + (Math.random() - .5) * .15, .9, Math.random() * RT.FW, -8) },
    { iv: .16, fn: (c, k) => {
      const m = Math.PI / 2 + Math.sin(k * .18) * .9;
      for (let i = -1; i <= 1; i++) {
        // The center ember locks on briefly, while side shots stay straight.
        c.sh(m + i * .14, 1, null, null, i === 0 ? { hom: true, turn: 1.05 } : null);
      }
    } },
    { iv: .18, fn: (c, k) => {
      c.sh(c.aim(), 1.25, null, null, { hom: true, turn: 1.8 });
      if (k % 6 === 0) for (let i = 0; i < 8; i++) c.sh(i * TAU / 8 + k * .1, .7);
    } },
  ];

  let on = false, cur = null;
  window.Battle25D = { awaiting: false, isActive: () => on, fight: () => cur, onFoeClick: null };

  function run(f) {
    return new Promise((resolve) => {
      const { FW, FH } = RT;
      on = true; cur = f;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

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
      function pr(x, y, z = 0) {
        const d = .72 + .28 * (y / FH);
        return { x: cx + (x - FW / 2) * sc * d, y: oy + y * sc - z * sc * d, s: sc * d };
      }
      resize(); window.addEventListener("resize", resize);

      const pl = { x: FW / 2, y: FH - 70, inv: 0, fire: 0 };
      const keys = new Set(), pb = [], eb = [];
      let t = 0, last = performance.now(), paused = false, banner = "";
      let acc = 0, potCd = 0, dotT = 0, shake = 0, flash = 0, raf = 0, ended = false;
      let endKind = null, endT = 0; const fx = [];
      const dmgBase = () => (C.PLAYER_DAMAGE[0] + C.PLAYER_DAMAGE[1]) / 2 + f.stats.damage + (f.temporary_damage || 0);
      const alive = () => f.enemies.filter((e) => e.hp > 0);
      const nearest = () => alive().sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      const healItem = () => Object.keys(USABLE_ITEMS).find((n) => USABLE_ITEMS[n].heal && (inventory[n] || 0) > 0);

      f.enemies.forEach((e, i) => {
        e.rx = FW * (i + 1) / (f.enemies.length + 1); e.ry = 70 + (i % 2) * 30;
        e.x = e.rx; e.y = -40; e.flash = 0; e.fade = 1; e.rt = { mode: "rest", until: 1.2 };
      });

      function shoot(e, q, ang, mult, x, y, homing) {
        if (eb.length > RT.MAX_BULLETS) return;
        const opts = homing || {};
        const sp = q.sp * mult;
        const dmg = Math.max(1, Math.round((q.lo + Math.random() * (q.hi - q.lo)) * RT.ENEMY_DMG * q.m));
        eb.push({
          x: x ?? e.x, y: y ?? e.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: 4.5, dmg, a: q.a, o: e, g: 0,
          col: ELEM[q.a.element] || "#ff6b9e",
          hom: !!opts.hom,
          turn: Number(opts.turn || 1.0),
          speed: sp,
        });
      }
      function pick(e, r, enr) {
        const ch = monsterChoose(e.monster, null);
        r.label = ""; r.labelT = t;
        if (ch.kind === "attack" && ch.attack && ch.attack.damage) {
          const a = ch.attack, n = a.hits || 1, [lo, hi] = a.damage;
          const q = { n, sp: Math.min(170, 80 + (e.monster.level || 1) * 3 + n * 6) * (enr ? 1.1 : 1), lo, hi, a, m: enr ? 1.25 : 1 };
          r.mode = "cast"; r.pat = PATS[hash(a.name) % PATS.length]; r.k = 0;
          r.c = { e, q, sh: (ang, m, x, y, hom) => shoot(e, q, ang, m, x, y, hom), aim: () => Math.atan2(pl.y - e.y, pl.x - e.x) };
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
        // FIX: shots used to expire (range/speed) before reaching enemies at the top of the arena.
        // Make sure every shot can at least reach the target it was aimed at.
        const reach = Math.max(range, Math.hypot(tg.x - pl.x, tg.y - pl.y) + 50);
        // FIX: iron fist color was fully transparent, so its shots were invisible.
        const shotColor = (!proj.color || /,\s*0\s*\)\s*$/.test(proj.color)) ? "#e8f4ff" : proj.color;
        for (let i = 0; i < count; i++) {
          const centered = i - (count - 1) / 2;
          const a = base + centered * spread;
          pb.push({ x: pl.x, y: pl.y - 8, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, d: weaponName === "iron fist" ? Math.max(1, baseDamage * .75) : baseDamage, hom: homing ? 1 : 0, spd: speed, life: reach / speed * (homing ? 1.35 : 1), r: radius, style, weapon: weaponName, color: shotColor });
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

      function spawnDeath(e) {
        e.dead = true;
        const col = e.monster.chance <= 0 ? "#d88cff" : "#ff6b9e";
        for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, v = 40 + Math.random() * 140; fx.push({ k: "p", x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .7, max: .7, col }); }
        fx.push({ k: "r", x: e.x, y: e.y, life: .6, max: .6, col });
        fx.push({ k: "t", x: e.x, y: e.y - 18, life: 1.4, max: 1.4, col: "#fff", s: "DEFEATED" });
        shake = Math.max(shake, 6); flash = Math.max(flash, .15);
        print(`☠️ ${String(e.monster.name || e.name || "Enemy").toUpperCase()} is defeated!`);
      }

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
        if (RT.AUTO_ATTACK && !endKind) { pl.fire -= dt; if (pl.fire <= 0) { pl.fire = RT.SHOT_EVERY; fire(foc); } }
        f.enemies.forEach((e, i) => updEnemy(e, i, dt));
        for (const e of f.enemies) if (e.hp <= 0 && !e.dead) spawnDeath(e);
        for (const q of fx) { q.life -= dt; if (q.k === "p") { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .96; q.vy *= .96; } }
        for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);

        for (const b of pb) {
          if (b.hom) {
            const tg = nearest();
            if (tg) {
              let cur2 = Math.atan2(b.vy, b.vx), diff = Math.atan2(tg.y - b.y, tg.x - b.x) - cur2;
              diff = Math.atan2(Math.sin(diff), Math.cos(diff));
              cur2 += clamp(diff, -6 * dt, 6 * dt); b.vx = Math.cos(cur2) * (b.spd || 420); b.vy = Math.sin(cur2) * (b.spd || 420);
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
          if (b.hom && b.o.hp > 0) {
            let cur2 = Math.atan2(b.vy, b.vx), diff = Math.atan2(pl.y - b.y, pl.x - b.x) - cur2;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            cur2 += clamp(diff, -b.turn * dt, b.turn * dt);
            b.vx = Math.cos(cur2) * b.speed; b.vy = Math.sin(cur2) * b.speed;
          }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < -30 || b.x > FW + 30 || b.y < -30 || b.y > FH + 30 || b.o.hp <= 0) { b.dead = true; continue; }
          const ddx = b.x - pl.x, ddy = b.y - pl.y, d2 = ddx * ddx + ddy * ddy;
          if (pl.inv <= 0 && d2 < (b.r + RT.HIT_R) ** 2) { hurt(b); b.dead = true; }
          else if (!b.g && d2 < (b.r + RT.GRAZE) ** 2) { b.g = 1; acc += .35; }
        }
        for (let i = pb.length - 1; i >= 0; i--) if (pb[i].dead) pb.splice(i, 1);
        for (let i = eb.length - 1; i >= 0; i--) if (eb[i].dead) eb.splice(i, 1);

        dotT += dt;
        if (dotT >= 3) {
          dotT -= 3; resolveEffects(f);
          f.enemies.forEach((e, i) => { if (e.hp > 0) { f.target = i; resolveMonsterEffects(f); } });
        }
        if (!endKind && advanceBossForms(f)) { eb.length = 0; f.enemies.forEach((e) => { e.rt = null; }); }
        const won = typeof foesDown === "function" ? foesDown(f) : f.enemies.every((e) => e.hp <= 0);
        if (won && !endKind) { endKind = "win"; endT = 1.8; eb.length = 0; banner = "VICTORY"; pl.inv = 99; flash = Math.max(flash, .3); }
        if (endKind) { endT -= dt; if (endT <= 0) return finish("win", "VICTORY"); return; }
        if (f.player_hp <= 0) { if (playerDown(f)) return finish("lose", "DEFEATED"); eb.length = 0; pl.inv = 2; flash = .5; }
      }

      function glow(p, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); }
      function bar(x, y, wd, fr, col) { g.fillStyle = "#000a"; g.fillRect(x - wd / 2, y, wd, 7); g.fillStyle = col; g.fillRect(x - wd / 2, y, wd * clamp(fr, 0, 1), 7); g.strokeStyle = "#ffffff30"; g.strokeRect(x - wd / 2 + .5, y + .5, wd - 1, 6); }
      function text(s, x, y, col = "#e9e3f2", size = 12, align = "center") { g.font = `700 ${size}px ui-monospace,monospace`; g.textAlign = align; g.fillStyle = "#000"; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y); }
      function draw() {
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, th.sky); gr.addColorStop(1, "#05050a"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.save(); if (shake > .3) g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        const A = pr(0, 0), B = pr(FW, 0), Cc = pr(FW, FH), D = pr(0, FH);
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(Cc.x, Cc.y); g.lineTo(D.x, D.y); g.closePath(); g.fillStyle = th.floor; g.fill();
        g.save(); g.clip(); g.strokeStyle = th.edge; g.globalAlpha = .6; g.lineWidth = 1;
        for (let k = 0; k <= 13; k++) { const y = (k * FH / 13 + t * 24) % FH, l = pr(0, y), r = pr(FW, y); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke(); }
        for (let k = 0; k <= 8; k++) { const x = k * FW / 8, l = pr(x, 0), r = pr(x, FH); g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke(); }
        g.restore(); g.globalAlpha = 1; g.strokeStyle = th.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(Cc.x, Cc.y); g.lineTo(D.x, D.y); g.closePath(); g.stroke();
        for (const b of eb) { const p = pr(b.x, b.y, 0); glow(p, 10, b.col, .12); glow(p, b.r * p.s, b.col, .95); }
        for (const b of pb) { const p = pr(b.x, b.y, 0); g.save(); g.globalAlpha = .95; g.fillStyle = b.color; if (b.style === "fist") { g.beginPath(); g.arc(p.x, p.y, Math.max(4, b.r * p.s), 0, TAU); g.fill(); g.globalAlpha = .3; g.beginPath(); g.arc(p.x, p.y, Math.max(8, b.r * p.s * 1.8), 0, TAU); g.fill(); } else { g.beginPath(); g.arc(p.x, p.y, Math.max(3, b.r * p.s), 0, TAU); g.fill(); } g.restore(); }
        const pp = pr(pl.x, pl.y, 0); g.globalAlpha = pl.inv > 0 ? .45 + .35 * Math.sin(t * 25) : 1; g.fillStyle = "#f0d0bd"; g.beginPath(); g.arc(pp.x, pp.y, Math.max(6, 9 * pp.s), 0, TAU); g.fill(); g.globalAlpha = 1; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(pp.x, pp.y, Math.max(2, RT.HIT_R * pp.s), 0, TAU); g.fill();
        for (const e of f.enemies) { const p = pr(e.x, e.y, 0); g.globalAlpha = e.fade; g.fillStyle = e.flash > 0 ? "#fff" : (e.monster.chance <= 0 ? "#d88cff" : "#ff6b9e"); g.beginPath(); g.arc(p.x, p.y, Math.max(9, (e.monster.chance <= 0 ? 20 : 15) * p.s), 0, TAU); g.fill(); if (e.hp > 0) bar(p.x, p.y - 25 * p.s, 44 * p.s, e.hp / e.monster.hp, "#ff5f7a"); if (e.rt?.label && t - e.rt.labelT < 1.2) text(e.rt.label, p.x, p.y - 33 * p.s, "#fff", 11); }
        g.globalAlpha = 1;
        for (const q of fx) { const p = pr(q.x, q.y, 0), a = Math.max(0, q.life / q.max); g.globalAlpha = a;
          if (q.k === "p") { g.fillStyle = q.col; g.beginPath(); g.arc(p.x, p.y, Math.max(2, 4 * p.s * a), 0, TAU); g.fill(); }
          else if (q.k === "r") { g.strokeStyle = q.col; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, (1 - a) * 70 * p.s + 8, 0, TAU); g.stroke(); }
          else { text(q.s, p.x, p.y - (1 - a) * 30, q.col, 13); } }
        g.globalAlpha = 1;
        if (endKind) text("VICTORY", W / 2, H * .45, th.accent, Math.max(28, Math.min(56, W * .09)));
        else if (banner) text(banner, W / 2, 40, th.accent, 18); text(RT.AUTO_ATTACK ? "AUTO ATTACK" : "ATTACK PAUSED", 14, H - 18, RT.AUTO_ATTACK ? "#9fe7d1" : "#ff9aa8", 11, "left"); g.restore();
      }

      function finish(kind, label) { if (ended) return; ended = true; on = false; cur = null; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); if (ov.parentNode) ov.remove(); /* combat.js expects "win" / "fled" / "lose" strings, not an object */ resolve(kind === "run" ? "fled" : kind); }
      function keydown(e) { const k = String(e.key || "").toLowerCase(); if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d", "shift", "z", "x", "escape", "r"].includes(k)) e.preventDefault(); keys.add(k); if (k === "z") potion(); if (k === "x") limit(); if (k === "escape") paused = !paused; if (k === "r") finish("run", "ESCAPED"); }
      function keyup(e) { keys.delete(String(e.key || "").toLowerCase()); }
      window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
      ov.addEventListener("pointerdown", (e) => { pl.x = clamp((e.clientX - cx) / sc + FW / 2, 8, FW - 8); pl.y = clamp((e.clientY - oy) / sc, 8, FH - 8); });
      ov.addEventListener("pointermove", (e) => { if (e.buttons) { pl.x = clamp((e.clientX - cx) / sc + FW / 2, 8, FW - 8); pl.y = clamp((e.clientY - oy) / sc, 8, FH - 8); } });
      function loop(now) { if (ended) return; const dt = Math.min(.05, (now - last) / 1000); last = now; if (!paused) update(dt); draw(); raf = requestAnimationFrame(loop); }
      raf = requestAnimationFrame(loop);
    });
  }
  window.RealtimeBattle = { run };
})();
