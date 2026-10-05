/* THE LAST SAVE - accessory-gated real-time mobility.
 * Movement is game-only. Dashes are unavailable until an equipped accessory grants one.
 */
(function () {
  "use strict";
  if (window.__battleMobilityInstalled) return;
  window.__battleMobilityInstalled = true;

  const FW = 400, FH = 520;
  const BASE = 190;
  const states = new WeakMap();
  const held = new Set();

  function getState(f) {
    let s = states.get(f);
    if (!s) {
      s = { x: FW / 2, y: FH - 70, dashUntil: 0, dashReady: 0, dashVX: 0, dashVY: 0, ramHit: new Set(), last: performance.now() };
      states.set(f, s);
    }
    return s;
  }
  function active() { return !!window.Battle25D?.isActive?.(); }
  function canvasPoint(x, y) {
    const W = innerWidth, H = innerHeight;
    const sc = Math.min(W * .96 / FW, H * .86 / FH);
    return { x: W / 2 + (x - FW / 2) * sc, y: H * .07 + y * sc };
  }
  function pushPosition(s) {
    const ov = document.getElementById("rtBattle");
    if (!ov) return;
    const p = canvasPoint(s.x, s.y);
    ov.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 1, clientX: p.x, clientY: p.y, pointerId: 7, pointerType: "mouse" }));
  }
  function dash(f) {
    if (!active() || !f?.stats?.dash) return false;
    const s = getState(f), now = performance.now() / 1000;
    if (now < s.dashReady || now < s.dashUntil) return false;
    let dx = 0, dy = 0;
    if (held.has("arrowleft") || held.has("a")) dx--;
    if (held.has("arrowright") || held.has("d")) dx++;
    if (held.has("arrowup") || held.has("w")) dy--;
    if (held.has("arrowdown") || held.has("s")) dy++;
    if (!dx && !dy) dy = -1;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Number(f.stats.dash_distance || 90);
    const cd = Number(f.stats.dash_cooldown || 1.1);
    const duration = Math.max(.12, Math.min(.28, dist / 900));
    s.dashUntil = now + duration;
    s.dashReady = now + cd;
    s.dashVX = dx / len * dist / duration;
    s.dashVY = dy / len * dist / duration;
    s.ramHit.clear();
    const defense = window.BattleDefense;
    if (defense?.state) {
      const ds = defense.state(f), t = performance.now() / 1000;
      ds.dodgeUntil = Math.max(ds.dodgeUntil || 0, t + duration);
      ds.banner = String(f.stats.dash).toUpperCase() + " DASH!";
    }
    return true;
  }

  window.BattleMobility = { dash, getState };

  window.addEventListener("keydown", (e) => {
    if (!active() || e.repeat) return;
    const k = String(e.key || "").toLowerCase();
    held.add(k);
    if (["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d"].includes(k)) e.stopImmediatePropagation();
    const b = window.BattleKeybinds?.load?.() || {};
    if (k === b.dash) {
      const f = window.Battle25D.fight?.();
      if (f?.stats?.dash) { e.preventDefault(); e.stopImmediatePropagation(); dash(f); }
    }
  }, true);
  window.addEventListener("keyup", (e) => held.delete(String(e.key || "").toLowerCase()), true);

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (active()) {
      const f = window.Battle25D.fight?.();
      if (f?.stats) {
        const s = getState(f), t = now / 1000;
        if (t < s.dashUntil) {
          s.x = Math.max(8, Math.min(FW - 8, s.x + s.dashVX * dt));
          s.y = Math.max(8, Math.min(FH - 8, s.y + s.dashVY * dt));
        } else {
          let dx = 0, dy = 0;
          if (held.has("arrowleft") || held.has("a")) dx--;
          if (held.has("arrowright") || held.has("d")) dx++;
          if (held.has("arrowup") || held.has("w")) dy--;
          if (held.has("arrowdown") || held.has("s")) dy++;
          const len = Math.hypot(dx, dy) || 1;
          const speed = BASE * (1 + Number(f.stats.move_speed || 0));
          if (dx || dy) {
            s.x = Math.max(8, Math.min(FW - 8, s.x + dx / len * speed * dt));
            s.y = Math.max(8, Math.min(FH - 8, s.y + dy / len * speed * dt));
          }
        }
        f._rtPlayer = { x: s.x, y: s.y };
        pushPosition(s);

        if (t < s.dashUntil && f.stats.dash === "ram" && Number(f.stats.dash_damage || 0) > 0) {
          for (const e of f.enemies || []) {
            if (e.hp <= 0 || s.ramHit.has(e)) continue;
            const rr = e.monster?.chance <= 0 ? 38 : 28;
            if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 < rr * rr) {
              s.ramHit.add(e);
              e.hp = Math.max(0, e.hp - Number(f.stats.dash_damage) * Math.max(1, f.stats.damage || 1));
              e.flash = .12;
            }
          }
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
