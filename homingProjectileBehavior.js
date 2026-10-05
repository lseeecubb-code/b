/* THE LAST SAVE - game-only homing projectile behavior.
 * Homing shots move quickly while they are far away, then deliberately lose
 * speed as they approach the player so the final approach is readable and dodgeable.
 */
(function () {
  "use strict";
  if (window.__homingProjectileBehaviorInstalled) return;
  window.__homingProjectileBehaviorInstalled = true;

  const FAR_SPEED = 620;
  const NEAR_SPEED = 115;
  const SLOW_RADIUS = 155;
  const MAX_RADIUS = 330;
  const TURN = 7.5;

  function playerOf() {
    const f = window.Battle25D?.fight?.();
    return f?._rtPlayer || null;
  }

  function speedFor(b, p) {
    if (!p) return FAR_SPEED;
    const d = Math.hypot((p.x || 0) - b.x, (p.y || 0) - b.y);
    const q = Math.max(0, Math.min(1, (d - SLOW_RADIUS) / (MAX_RADIUS - SLOW_RADIUS)));
    const eased = q * q * (3 - 2 * q);
    return NEAR_SPEED + (FAR_SPEED - NEAR_SPEED) * eased;
  }

  function decorate(b) {
    if (!b || !b.o || !b.hom || b.__homingProfiled) return;
    b.__homingProfiled = true;
    b.homingSpeedFar = FAR_SPEED;
    b.homingSpeedNear = NEAR_SPEED;
    b.homingSlowRadius = SLOW_RADIUS;

    let vx = Number(b.vx || 0), vy = Number(b.vy || 0);
    Object.defineProperty(b, "vx", {
      configurable: true,
      get: () => vx,
      set: (next) => {
        const n = Number(next) || 0;
        const m = Math.hypot(n, Number(b.vy || 0)) || 1;
        const s = speedFor(b, playerOf());
        vx = n / m * s;
      }
    });
    Object.defineProperty(b, "vy", {
      configurable: true,
      get: () => vy,
      set: (next) => {
        const n = Number(next) || 0;
        const m = Math.hypot(Number(b.vx || 0), n) || 1;
        const s = speedFor(b, playerOf());
        vy = n / m * s;
      }
    });

    const s = speedFor(b, playerOf());
    const m = Math.hypot(vx, vy) || 1;
    vx = vx / m * s;
    vy = vy / m * s;
  }

  const nativePush = Array.prototype.push;
  Array.prototype.push = function (...items) {
    const result = nativePush.apply(this, items);
    if (window.Battle25D?.isActive?.()) {
      for (const item of items) if (item?.hom && item?.o) decorate(item);
    }
    return result;
  };

  window.HomingProjectileBehavior = { speedFor };
})();
