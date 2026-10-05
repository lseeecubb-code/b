/* THE LAST SAVE - active real-time battle defense.
 * Dodge = short invulnerability window. Parry = very short perfect-defense window
 * that rewards precise timing with limit energy. These are game-only mechanics.
 */
(function () {
  "use strict";
  if (window.__battleDefenseInstalled) return;
  window.__battleDefenseInstalled = true;

  const DUR = { dodge: 0.42, parry: 0.16 };
  const CD = { dodge: 1.05, parry: 0.72 };
  const states = new WeakMap();

  function state(f) {
    let s = states.get(f);
    if (!s) {
      s = { dodgeUntil: 0, parryUntil: 0, dodgeReady: 0, parryReady: 0, parryHits: 0, banner: "" };
      states.set(f, s);
      f._rtDefense = s;
    }
    return s;
  }

  function now() { return performance.now() / 1000; }
  function active() { return !!window.Battle25D?.isActive?.(); }

  function use(kind) {
    if (!active()) return false;
    const f = window.Battle25D.fight();
    if (!f) return false;
    const s = state(f), t = now(), ready = kind === "dodge" ? s.dodgeReady : s.parryReady;
    if (t < ready) return false;
    if (kind === "dodge") {
      s.dodgeUntil = t + DUR.dodge;
      s.dodgeReady = t + CD.dodge;
      s.banner = "DODGE!";
    } else {
      s.parryUntil = t + DUR.parry;
      s.parryReady = t + CD.parry;
      s.parryHits = 0;
      s.banner = "PARRY!";
    }
    return true;
  }

  // battle25d routes incoming bullet damage through this function. During an
  // active defense window, turn that hit into a clean evade/parry instead.
  const originalReduce = window.reducePlayerDamage;
  if (typeof originalReduce === "function") {
    window.reducePlayerDamage = function (f, d) {
      if (active() && f) {
        const s = state(f), t = now();
        if (t < s.parryUntil) {
          s.parryHits++;
          f.limitGauge = Math.min(100, Number(f.limitGauge || 0) + 7);
          s.banner = "PERFECT PARRY!";
          return 0;
        }
        if (t < s.dodgeUntil) {
          s.banner = "DODGE!";
          return 0;
        }
      }
      return originalReduce(f, d);
    };
  }

  window.BattleDefense = { use, state, DUR, CD };

  window.addEventListener("keydown", (e) => {
    if (!active() || e.repeat) return;
    const k = String(e.key || "").toLowerCase();
    const b = window.BattleKeybinds?.load?.() || {};
    if (k === b.dodge) { e.preventDefault(); use("dodge"); }
    else if (k === b.parry) { e.preventDefault(); use("parry"); }
  }, true);

  function tick() {
    if (active()) {
      const f = window.Battle25D.fight();
      if (f?._rtDefense) {
        const s = f._rtDefense, t = now();
        if (s.banner && t > Math.max(s.dodgeUntil, s.parryUntil) + 0.28) s.banner = "";
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
