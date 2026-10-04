/*
 * THE LAST SAVE — 2.5D hard boot.
 * The 2.5D world is the primary presentation, while the original terminal
 * input is retained as a compact command bar at the bottom of the screen.
 */
(function () {
  "use strict";

  const TERMINAL = ".terminal";

  function restoreCommandBar() {
    const terminal = document.querySelector(TERMINAL);
    if (terminal) {
      terminal.style.setProperty("display", "block", "important");
      terminal.removeAttribute("aria-hidden");
      terminal.classList.add("command-bar-25d");
    }
    document.documentElement.classList.add("last-save-25d");
    document.body.classList.add("last-save-25d");
  }

  function ensureState() {
    try {
      if (typeof WORLD !== "undefined" && typeof PLAYER !== "undefined") return true;
      if (typeof resetState === "function") {
        resetState();
        return typeof PLAYER !== "undefined";
      }
    } catch (error) {
      console.error("2.5D state boot failed:", error);
    }
    return false;
  }

  function emergencyRenderer() {
    if (document.getElementById("world25d") || document.getElementById("world25dEmergency")) return;

    const root = document.createElement("div");
    root.id = "world25dEmergency";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#070711;color:#eee;font-family:system-ui,sans-serif;overflow:hidden";
    root.innerHTML = `
      <canvas id="world25dEmergencyCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
      <div style="position:absolute;left:24px;top:20px;font-weight:900;letter-spacing:.18em;font-size:20px;text-shadow:0 2px 10px #000">THE LAST SAVE<div id="emergencyBiome" style="font-size:10px;color:#cbbfe0;letter-spacing:.22em;margin-top:5px">LANTERN FIELDS · 2.5D</div></div>
      <div style="position:absolute;right:24px;top:20px;padding:10px 14px;background:#0b0b16cc;border:1px solid #ffffff22;backdrop-filter:blur(8px)" id="emergencyStats">ADVENTURER · LV 1</div>
      <div style="position:absolute;left:24px;bottom:22px;padding:9px 12px;background:#090912cc;border:1px solid #ffffff1c;color:#aaa0b7;font-size:11px">WASD / ARROWS · ENTER COMMANDS · E INTERACT</div>
    `;
    document.body.appendChild(root);

    const canvas = document.getElementById("world25dEmergencyCanvas");
    const ctx = canvas.getContext("2d");
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let px = 8, py = 7;
    const keys = new Set();
    const tw = 76, th = 38, mw = 17, mh = 13;

    function resize() {
      const w = innerWidth, h = innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function iso(x, y, z = 0) {
      return { x: (x-y)*tw*.5 + innerWidth*.5, y: (x+y)*th*.5 + 100-z };
    }

    function diamond(p, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+tw*.5,p.y+th*.5); ctx.lineTo(p.x,p.y+th); ctx.lineTo(p.x-tw*.5,p.y+th*.5); ctx.closePath();
      ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.stroke();
    }

    function draw() {
      const w=innerWidth,h=innerHeight;
      ctx.clearRect(0,0,w,h);
      const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,"#14152b"); g.addColorStop(1,"#05050a");
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      for(let y=0;y<mh;y++) for(let x=0;x<mw;x++) {
        const p=iso(x,y);
        diamond(p,(x+y)%4===0?"#1b2030":"#17182b","#39314f");
      }
      const p=iso(px,py,18); ctx.fillStyle="#0008"; ctx.beginPath(); ctx.ellipse(p.x,p.y+17,13,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#e8c986"; ctx.beginPath(); ctx.moveTo(p.x-10,p.y+14);ctx.lineTo(p.x-7,p.y-7);ctx.quadraticCurveTo(p.x,p.y-16,p.x+7,p.y-7);ctx.lineTo(p.x+10,p.y+14);ctx.closePath();ctx.fill();
      ctx.fillStyle="#f4e9e3";ctx.beginPath();ctx.arc(p.x,p.y-12,7,0,Math.PI*2);ctx.fill();
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", e => {
      const k=e.key.toLowerCase();
      if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) { e.preventDefault(); keys.add(k); }
      if(k==="enter") {
        const command=prompt("Command");
        if(command && typeof issueCommand === "function") issueCommand(command);
      }
    });
    window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
    setInterval(() => {
      let dx=0,dy=0;
      if(keys.has("a")||keys.has("arrowleft")) dx--;
      if(keys.has("d")||keys.has("arrowright")) dx++;
      if(keys.has("w")||keys.has("arrowup")) dy--;
      if(keys.has("s")||keys.has("arrowdown")) dy++;
      if(dx||dy){px=Math.max(.8,Math.min(mw-.8,px+dx*.18));py=Math.max(.8,Math.min(mh-.8,py+dy*.18));}
    },50);
    resize(); draw();
  }

  restoreCommandBar();
  ensureState();

  setTimeout(() => {
    restoreCommandBar();
    if (!document.getElementById("world25d")) emergencyRenderer();
  }, 1200);
})();
