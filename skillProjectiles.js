/* Skill-specific projectile visuals for real-time 2.5D battles. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const FW = 400, FH = 520;
  const META = {
    "twin slash":       { kind: "slashes", color: "#ffffff", count: 2, size: 46, speed: 460 },
    "guard breaker":    { kind: "hammer", color: "#ffd166", count: 1, size: 26, speed: 300 },
    cleave:              { kind: "arc", color: "#f2f2f2", count: 1, size: 62, speed: 330 },
    "reckless chop":    { kind: "arc", color: "#ff5c5c", count: 1, size: 68, speed: 280 },
    backstab:            { kind: "shadow", color: "#a879ff", count: 1, size: 20, speed: 650 },
    "poison cut":       { kind: "slash", color: "#8fe36b", count: 1, size: 42, speed: 520 },
    "skull crusher":    { kind: "hammer", color: "#e6b3ff", count: 1, size: 34, speed: 250 },
    shatter:             { kind: "shockwave", color: "#9bc6ff", count: 1, size: 76, speed: 360 },
    "piercing thrust":  { kind: "lance", color: "#dcefff", count: 1, size: 28, speed: 720 },
    "quick jab":        { kind: "jab", color: "#ffffff", count: 1, size: 18, speed: 760 },
    "aimed shot":       { kind: "arrow", color: "#e6d6a8", count: 1, size: 20, speed: 720 },
    volley:              { kind: "arrow", color: "#e6d6a8", count: 3, size: 18, speed: 680, spread: .08 },
    "executioner swing":{ kind: "arc", color: "#fff1d0", count: 1, size: 92, speed: 230 },
    whirlwind:           { kind: "ring", color: "#cfd8ff", count: 2, size: 64, speed: 300 },
    "arcane bolt":      { kind: "bolt", color: "#b07cff", count: 1, size: 24, speed: 620 },
    "mana siphon":      { kind: "siphon", color: "#b86cff", count: 1, size: 24, speed: 390 },
    "precision cut":    { kind: "slash", color: "#e9f7ff", count: 1, size: 36, speed: 620 },
    "rending slash":    { kind: "slash", color: "#ff5b69", count: 1, size: 52, speed: 470 },
    "flame slash":      { kind: "arc", color: "#ff7a45", count: 1, size: 58, speed: 430 },
    "inferno strike":   { kind: "fireball", color: "#ff7a45", count: 1, size: 34, speed: 360 },
    "soul reap":        { kind: "soul", color: "#b07cff", count: 1, size: 30, speed: 410 },
    "grim embrace":     { kind: "arc", color: "#6f4fa8", count: 1, size: 84, speed: 240 },
  };

  function point(x, y) {
    const cv = document.querySelector("#rtBattle canvas");
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    const sc = Math.min(r.width * .96 / FW, r.height * .86 / FH);
    const cx = r.left + r.width / 2;
    const oy = r.top + r.height * .07;
    const d = .72 + .28 * (y / FH);
    return { x: cx + (x - FW / 2) * sc * d, y: oy + y * sc };
  }

  function spawn(name, fight) {
    if (!fight || !document.getElementById("rtBattle")) return;
    const target = fight.enemies?.[fight.target] || fight.enemies?.find((e) => e.hp > 0);
    if (!target) return;
    const meta = META[name] || { kind: "bolt", color: "#fff", count: 1, size: 24, speed: 520 };
    const from = { x: FW / 2, y: FH - 72 };
    const to = { x: target.x, y: target.y };
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = Math.max(120, Math.min(650, dist / meta.speed * 1000));

    for (let i = 0; i < meta.count; i++) {
      const off = (i - (meta.count - 1) / 2) * (meta.spread || 0);
      makeProjectile(meta, from, to, a + off, duration, i);
    }
  }

  function makeProjectile(meta, from, to, angle, duration, index) {
    const start = performance.now();
    const el = document.createElement("div");
    const size = Math.max(18, Math.min(110, meta.size));
    el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;pointer-events:none;z-index:10002;transform-origin:50% 50%;filter:drop-shadow(0 0 8px ${meta.color});`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%"); svg.style.overflow = "visible";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    if (["arc", "slash", "slashes"].includes(meta.kind)) {
      path.setAttribute("d", meta.kind === "arc" ? "M 12 82 A 62 62 0 0 1 88 18" : "M 18 78 L 82 22");
      path.setAttribute("fill", "none"); path.setAttribute("stroke", meta.color); path.setAttribute("stroke-width", meta.kind === "arc" ? "10" : "8"); path.setAttribute("stroke-linecap", "round");
    } else if (meta.kind === "shockwave" || meta.kind === "ring") {
      circle.setAttribute("cx", "50"); circle.setAttribute("cy", "50"); circle.setAttribute("r", meta.kind === "ring" ? "34" : "25"); circle.setAttribute("fill", "none"); circle.setAttribute("stroke", meta.color); circle.setAttribute("stroke-width", "7");
    } else if (meta.kind === "arrow") {
      line.setAttribute("x1", "8"); line.setAttribute("y1", "50"); line.setAttribute("x2", "78"); line.setAttribute("y2", "50"); line.setAttribute("stroke", meta.color); line.setAttribute("stroke-width", "7");
      path.setAttribute("d", "M 68 35 L 92 50 L 68 65 Z"); path.setAttribute("fill", meta.color);
    } else if (meta.kind === "lance" || meta.kind === "jab") {
      line.setAttribute("x1", "5"); line.setAttribute("y1", "50"); line.setAttribute("x2", "95"); line.setAttribute("y2", "50"); line.setAttribute("stroke", meta.color); line.setAttribute("stroke-width", meta.kind === "lance" ? "12" : "8"); line.setAttribute("stroke-linecap", "round");
    } else {
      circle.setAttribute("cx", "50"); circle.setAttribute("cy", "50"); circle.setAttribute("r", meta.kind === "hammer" ? "32" : "25"); circle.setAttribute("fill", meta.color); circle.setAttribute("fill-opacity", ".9");
      if (meta.kind === "fireball" || meta.kind === "soul" || meta.kind === "bolt" || meta.kind === "siphon" || meta.kind === "shadow") circle.setAttribute("stroke", "#fff");
    }
    [path, circle, line].forEach((n) => { if (n.hasAttribute("d") || n.hasAttribute("cx") || n.hasAttribute("x1")) svg.appendChild(n); });
    el.appendChild(svg); document.getElementById("rtBattle")?.appendChild(el);

    function tick(now) {
      const q = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - q, 3);
      const x = from.x + (to.x - from.x) * eased;
      const y = from.y + (to.y - from.y) * eased;
      const p = point(x, y);
      if (!p) { el.remove(); return; }
      const s = q < .2 ? .55 + q * 2.25 : 1;
      const spin = meta.kind === "ring" || meta.kind === "whirlwind" ? q * Math.PI * 2 : 0;
      el.style.left = `${p.x - size / 2}px`;
      el.style.top = `${p.y - size / 2}px`;
      el.style.opacity = String(q < .15 ? q / .15 : 1 - Math.max(0, q - .7) / .3);
      el.style.transform = `rotate(${angle + spin}rad) scale(${s})`;
      if (q < 1) requestAnimationFrame(tick);
      else {
        if (["shockwave", "ring", "arc", "slash", "slashes", "fireball", "soul", "siphon"].includes(meta.kind)) burst(p, meta);
        el.remove();
      }
    }
    requestAnimationFrame(tick);
  }

  function burst(p, meta) {
    const el = document.createElement("div");
    const size = Math.max(30, meta.size * 1.5);
    el.style.cssText = `position:fixed;left:${p.x - size / 2}px;top:${p.y - size / 2}px;width:${size}px;height:${size}px;border:3px solid ${meta.color};border-radius:50%;pointer-events:none;z-index:10002;filter:drop-shadow(0 0 9px ${meta.color});`;
    document.getElementById("rtBattle")?.appendChild(el);
    const start = performance.now();
    function tick(now) {
      const q = Math.min(1, (now - start) / 180);
      el.style.opacity = String(1 - q); el.style.transform = `scale(${.55 + q * 1.3})`;
      if (q < 1) requestAnimationFrame(tick); else el.remove();
    }
    requestAnimationFrame(tick);
  }

  window.SkillProjectiles = { spawn };
})();
