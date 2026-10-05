/* THE LAST SAVE - fictional real-time boss attack director.
 * Game-only behavior: adds denser projectile patterns for higher difficulty
 * and later bosses while keeping the existing RPG attack data as the source.
 */
(function () {
  "use strict";

  const original = window.monsterChoose;
  if (typeof original !== "function" || window.__touhouAttackPatternsInstalled) return;
  window.__touhouAttackPatternsInstalled = true;

  const DIFF = {
    easy:      { speed: .86, damage: .86, density: .72 },
    normal:    { speed: 1.00, damage: 1.00, density: 1.00 },
    hard:      { speed: 1.14, damage: 1.12, density: 1.28 },
    nightmare: { speed: 1.28, damage: 1.24, density: 1.58 },
    brutal:    { speed: 1.38, damage: 1.32, density: 1.82 },
    inferno:   { speed: 1.48, damage: 1.40, density: 2.05 },
  };

  // These names intentionally select the existing renderer's six distinct
  // pattern families through its deterministic name hash.
  const PATTERN_NAMES = {
    ring: "ring burst",
    rain: "spiral barrage",
    needle: "needle stream",
    wave: "wave",
    fan: "meteor fan",
    cross: "crossfire",
  };

  function difficulty() {
    const key = String(window.SETTINGS?.difficulty || "normal").toLowerCase();
    return DIFF[key] || DIFF.normal;
  }

  function isBoss(m) {
    return !!m && (m.chance <= 0 || m.boss === true || m.isBoss === true);
  }

  function laterBoss(m) {
    return isBoss(m) && Number(m.level || 1) >= 10;
  }

  function patternFor(name, element, boss, late, diff) {
    const s = `${name || ""} ${element || ""}`.toLowerCase();
    if (/storm|lightning|thunder|static|bolt/.test(s)) return PATTERN_NAMES.cross;
    if (/poison|venom|toxin|needle|pierc/.test(s)) return PATTERN_NAMES.needle;
    if (/fire|flame|inferno|meteor|burn/.test(s)) return PATTERN_NAMES.fan;
    if (/frost|ice|rime|freeze/.test(s)) return PATTERN_NAMES.wave;
    if (/shadow|void|soul|dark/.test(s)) return PATTERN_NAMES.rain;
    if (/holy|light|radiant|sun/.test(s)) return PATTERN_NAMES.ring;
    if (late || diff.density >= 1.5) return PATTERN_NAMES.rain;
    if (boss) return PATTERN_NAMES.ring;
    return PATTERN_NAMES.wave;
  }

  window.monsterChoose = function (m, last) {
    const out = original(m, last);
    if (!out || out.kind !== "attack" || !out.attack || !out.attack.damage) return out;

    const a = { ...out.attack };
    const d = difficulty();
    const boss = isBoss(m);
    const late = laterBoss(m);
    const scale = d.damage * (late ? 1.10 : boss ? 1.04 : 1);
    const density = d.density * (late ? 1.22 : boss ? 1.08 : 1);

    a.damage = a.damage.map((v) => Math.max(1, Math.round(v * scale)));
    a.hits = Math.max(1, Math.min(8, Math.round((a.hits || 1) * Math.min(1.9, density))));
    a.name = patternFor(a.name, a.element || a.type, boss, late, d);
    a.telegraph = late ? "unleashes a dense pattern:" : boss ? "unleashes a patterned attack:" : (a.telegraph || "uses");
    return { ...out, attack: a };
  };
})();
