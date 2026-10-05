/* THE LAST SAVE - accessory-driven real-time regeneration. */
(function () {
  "use strict";
  if (window.__battleRegenInstalled) return;
  window.__battleRegenInstalled = true;
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (window.Battle25D?.isActive?.()) {
      const f = window.Battle25D.fight?.();
      const regen = Number(f?.stats?.regen || 0);
      if (f && regen > 0 && f.player_hp > 0 && f.player_hp < f.player_max_hp) {
        f.player_hp = Math.min(f.player_max_hp, f.player_hp + regen * dt);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
