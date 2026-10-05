/* Visible slash/swing effect for the fictional 2.5D iron-fist projectile. */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  let lastSwing = 0;

  function arenaPoint(x, y) {
    const cv = document.querySelector("#rtBattle canvas");
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const FW = 400, FH = 520;
    const sc = Math.min(r.width * .96 / FW, r.height * .86 / FH);
    const cx = r.left + r.width / 2;
    const oy = r.top + r.height * .07;
    const d = .72 + .28 * (y / FH);
    return { x: cx + (x - FW / 2) * sc * d, y: oy + y * sc };
  }

  function makeSlash(x, y, angle) {
    const p = arenaPoint(x, y);
    if (!p) return;
    const size = Math.max(54, Math.min(110, window.innerWidth * .12));
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px;pointer-events:none;z-index:10001;transform:rotate(${angle}rad);opacity:0;filter:drop-shadow(0 0 7px #fff);`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.overflow = "visible";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 18 78 A 55 55 0 0 1 82 18");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#f7fbff");
    path.setAttribute("stroke-width", "9");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    el.appendChild(svg);
    document.getElementById("rtBattle")?.appendChild(el);

    const start = performance.now();
    const duration = 155;
    function tick(now) {
      const q = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - q, 3);
      el.style.opacity = q < .18 ? String(q / .18) : String(1 - Math.max(0, q - .45) / .55);
      el.style.transform = `rotate(${angle + (-.55 + eased * 1.1)}rad) scale(${.7 + eased * .45})`;
      if (q < 1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  const nativePush = Array.prototype.push;
  if (window.__swingVisualPushInstalled) return;
  window.__swingVisualPushInstalled = true;
  Array.prototype.push = function (...items) {
    const result = nativePush.apply(this, items);
    if (window.Battle25D?.isActive?.()) {
      for (const item of items) {
        if (!item || item.weapon !== "iron fist") continue;
        const now = performance.now();
        if (now - lastSwing < 110) break;
        lastSwing = now;
        makeSlash(item.x, item.y, Math.atan2(item.vy, item.vx));
        break;
      }
    }
    return result;
  };
})();
