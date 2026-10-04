/*
 * THE LAST SAVE — full 2.5D presentation layer.
 * Original procedural art; no third-party game assets required.
 * The existing RPG logic remains authoritative for stats, story, inventory,
 * quests, crafting and combat. This layer turns the presentation into a
 * depth-sorted, isometric-style adventure scene.
 */
(function () {
  "use strict";

  const TILE_W = 54;
  const TILE_H = 54;
  const MAP_W = 17;
  const MAP_H = 13;
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  const BIOMES = [
    { name: "Lantern Fields", sky: [20, 22, 42], ground: "#17182b", edge: "#39314f", accent: "#e8c986" },
    { name: "Moonlit Forest", sky: [10, 27, 32], ground: "#102628", edge: "#23474a", accent: "#9fe7d1" },
    { name: "Crimson Shrine", sky: [35, 16, 27], ground: "#281522", edge: "#573043", accent: "#ff9aa8" },
    { name: "Glass Ruins", sky: [17, 21, 39], ground: "#182039", edge: "#354a76", accent: "#9bc6ff" },
  ];

  let root, canvas, ctx, mini, mctx, logBox;
  let w = 0, h = 0;
  let last = performance.now();
  const keys = new Set();
  const player = { x: 8, y: 7, bob: 0, facing: 1 };
  const camera = { x: 0, y: 0, shake: 0 };
  const particles = [];
  const npcs = [];
  let biomeIndex = 0;
  let commandOpen = false;
  let initialized = false;

  function state() {
    if (typeof WORLD === "undefined") return {};
    WORLD.flags = WORLD.flags || {};
    WORLD.flags.visual25d = WORLD.flags.visual25d || {};
    return WORLD.flags.visual25d;
  }

  function saveVisualState() {
    const s = state();
    s.player = { x: player.x, y: player.y };
    s.biome = biomeIndex;
    try { if (typeof autosave === "function") autosave(); } catch (_) {}
  }

  function loadVisualState() {
    const s = state();
    if (s.player) {
      player.x = Number.isFinite(s.player.x) ? s.player.x : player.x;
      player.y = Number.isFinite(s.player.y) ? s.player.y : player.y;
    }
    biomeIndex = Number.isFinite(s.biome) ? s.biome % BIOMES.length : 0;
  }

  function issueCommand(command) {
    const input = document.getElementById("command");
    if (!input) return;
    input.value = command;
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  function esc(s) {
    return String(s).replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
  }

  function createUI() {
    root = document.createElement("div");
    root.id = "world25d";
    root.innerHTML = `
      <canvas id="world25dCanvas"></canvas>
      <div class="world25d-vignette"></div>
      <header class="world25d-topbar">
        <div>
          <div class="world25d-title">THE LAST SAVE</div>
          <div class="world25d-subtitle" id="world25dBiome">LANTERN FIELDS</div>
        </div>
        <div class="world25d-topstats">
          <span id="world25dLevel">LV 1</span>
          <span id="world25dHp">HP --</span>
          <span id="world25dXp">XP --</span>
          <span id="world25dGold">◈ --</span>
        </div>
      </header>
      <aside class="world25d-panel">
        <div class="world25d-panel-head">ADVENTURER</div>
        <div class="world25d-name" id="world25dName">Wanderer</div>
        <div class="world25d-statgrid">
          <span>STR</span><b id="wstr">--</b><span>DEX</span><b id="wdex">--</b>
          <span>INT</span><b id="wint">--</b><span>VIT</span><b id="wvit">--</b>
        </div>
        <div class="world25d-divider"></div>
        <button data-cmd="status">STATUS</button>
        <button data-cmd="inventory">INVENTORY</button>
        <button data-cmd="quests">QUESTS</button>
        <button data-cmd="map">MAP</button>
        <button data-cmd="help">COMMANDS</button>
      </aside>
      <div class="world25d-prompt" id="world25dPrompt">WASD / ARROWS · ENTER COMMANDS · E INTERACT</div>
      <section class="world25d-log" id="world25dLog" aria-live="polite">
        <div class="world25d-log-head">EVENT LOG</div>
        <div id="world25dLogText">The world waits.</div>
      </section>
      <div class="world25d-command" id="world25dCommand" hidden>
        <div class="world25d-command-card">
          <div class="world25d-command-title">COMMAND</div>
          <input id="world25dCommandInput" autocomplete="off" placeholder="fight, craft, travel, inspect…" />
          <div class="world25d-command-hint">Enter to execute · Escape to close</div>
        </div>
      </div>
      <canvas id="world25dMini" width="150" height="105"></canvas>
    `;
    document.body.appendChild(root);
    canvas = document.getElementById("world25dCanvas");
    ctx = canvas.getContext("2d");
    mini = document.getElementById("world25dMini");
    mctx = mini.getContext("2d");
    logBox = document.getElementById("world25dLogText");

    root.querySelectorAll("button[data-cmd]").forEach(btn => {
      btn.addEventListener("click", () => issueCommand(btn.dataset.cmd));
    });

    const cmd = document.getElementById("world25dCommandInput");
    cmd.addEventListener("keydown", e => {
      if (e.key === "Escape") closeCommand();
      if (e.key === "Enter") {
        const value = cmd.value.trim();
        closeCommand();
        if (value) issueCommand(value);
      }
    });

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
    resize();
  }

  function openCommand() {
    if (commandOpen) return;
    commandOpen = true;
    const box = document.getElementById("world25dCommand");
    box.hidden = false;
    const input = document.getElementById("world25dCommandInput");
    input.value = "";
    input.focus();
  }

  function closeCommand() {
    commandOpen = false;
    document.getElementById("world25dCommand").hidden = true;
    canvas.focus();
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (commandOpen) return;
    if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","e"," "].includes(k)) e.preventDefault();
    if (k === "enter") { openCommand(); return; }
    if (k === "e") { issueCommand("interact"); return; }
    if (k === " ") { issueCommand("inspect"); return; }
    keys.add(k);
  }

  function resize() {
    if (!canvas) return;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function iso(x, y, z = 0) {
    return {
      x: x * TILE_W + w * 0.5 - camera.x,
      y: y * TILE_H + h * 0.5 - z - camera.y,
    };
  }

  function depthOrder(a, b) { return a.y - b.y; }

  function tileNoise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function drawDiamond(p, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + TILE_W, p.y);
    ctx.lineTo(p.x + TILE_W, p.y + TILE_H);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawTile(x, y, biome) {
    const p = iso(x, y);
    const n = tileNoise(x, y);
    const base = biome.ground;
    drawDiamond(p, base, biome.edge);
    if (n > .84) {
      ctx.fillStyle = biome.accent + "55";
      ctx.beginPath();
      ctx.arc(p.x + TILE_W*.5 + (n-.5)*18, p.y + TILE_H*.5, 2, 0, Math.PI*2);
      ctx.fill();
    }
    if ((x * 7 + y * 11) % 29 === 0) drawTree(x, y, biome);
    if ((x * 5 + y * 3) % 47 === 0) drawLantern(x, y, biome);
  }

  function drawTree(x, y, biome) {
    const p = iso(x, y, 7);
    ctx.fillStyle = "#3a2c2c";
    ctx.fillRect(p.x - 3, p.y + 8, 6, 17);
    ctx.fillStyle = biome.accent + "aa";
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = biome.accent + "38";
    ctx.beginPath(); ctx.arc(p.x - 7, p.y - 7, 9, 0, Math.PI*2); ctx.fill();
  }

  function drawLantern(x, y, biome) {
    const p = iso(x, y, 8);
    ctx.fillStyle = "#6d5940";
    ctx.fillRect(p.x - 2, p.y + 3, 4, 14);
    ctx.fillStyle = biome.accent;
    ctx.shadowBlur = 12; ctx.shadowColor = biome.accent;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawNpc(npc) {
    const p = iso(npc.x, npc.y, 14);
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(performance.now()/450 + npc.x)*2);
    ctx.fillStyle = npc.color;
    ctx.beginPath(); ctx.ellipse(0, 13, 9, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(-6, -8, 12, 20);
    ctx.beginPath(); ctx.arc(0, -11, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-3, -12, 2, 2); ctx.fillRect(2, -12, 2, 2);
    ctx.restore();
  }

  function drawPlayer() {
    const p = iso(player.x, player.y, 17 + Math.sin(player.bob)*2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(player.facing, 1);
    ctx.fillStyle = "#0008";
    ctx.beginPath(); ctx.ellipse(0, 17, 13, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = BIOMES[biomeIndex].accent;
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(-7,-7); ctx.quadraticCurveTo(0,-16,7,-7); ctx.lineTo(10,14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4e9e3";
    ctx.beginPath(); ctx.arc(0,-12,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#1a1723";
    ctx.fillRect(-6,-19,12,4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(2,-13,2,2);
    ctx.restore();
  }

  function spawnParticles() {
    if (particles.length > 130) return;
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: player.x + (Math.random()-.5)*.5,
        y: player.y + (Math.random()-.5)*.5,
        z: Math.random()*16,
        life: .7 + Math.random()*1.2,
        max: 1,
        vy: 7 + Math.random()*12,
      });
    }
  }

  function drawParticles(dt) {
    for (const q of particles) {
      q.life -= dt;
      q.z += q.vy*dt;
      const p = iso(q.x,q.y,q.z);
      ctx.globalAlpha = Math.max(0,q.life/q.max)*.55;
      ctx.fillStyle = BIOMES[biomeIndex].accent;
      ctx.fillRect(p.x,p.y,2,2);
    }
    ctx.globalAlpha = 1;
    for (let i=particles.length-1;i>=0;i--) if(particles[i].life<=0) particles.splice(i,1);
  }

  function update(dt) {
    let dx=0,dy=0;
    if(keys.has("arrowleft")||keys.has("a")) { dx--; player.facing=-1; }
    if(keys.has("arrowright")||keys.has("d")) { dx++; player.facing=1; }
    if(keys.has("arrowup")||keys.has("w")) dy--;
    if(keys.has("arrowdown")||keys.has("s")) dy++;
    if(dx||dy){
      const l=Math.hypot(dx,dy)||1;
      player.x=Math.max(.8,Math.min(MAP_W-.8,player.x+dx/l*dt*2.5));
      player.y=Math.max(.8,Math.min(MAP_H-.8,player.y+dy/l*dt*2.5));
      player.bob += dt*12;
      if(Math.random()<dt*4) spawnParticles();
      if(Math.random()<dt*.8) saveVisualState();
    }
    camera.x += ((player.x*TILE_W)-camera.x)*Math.min(1,dt*4);
    camera.y += ((player.y*TILE_H)-camera.y)*Math.min(1,dt*4);
    camera.shake *= Math.max(0,1-dt*5);
  }

  function drawWorld(dt) {
    const b=BIOMES[biomeIndex];
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,`rgb(${b.sky[0]},${b.sky[1]},${b.sky[2]})`);
    grad.addColorStop(1,"#05050a");
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.translate((Math.random()-.5)*camera.shake,(Math.random()-.5)*camera.shake);
    const things=[];
    for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++) things.push({x,y,type:"tile"});
    for(const n of npcs) things.push({...n,type:"npc"});
    things.push({x:player.x,y:player.y,type:"player"});
    things.sort(depthOrder);
    for(const t of things){
      if(t.type==="tile") drawTile(t.x,t.y,b);
      else if(t.type==="npc") drawNpc(t);
      else drawPlayer();
    }
    drawParticles(dt);
    ctx.restore();

    // distant atmospheric moon
    ctx.save();
    ctx.globalAlpha=.16;
    ctx.fillStyle=b.accent;
    ctx.beginPath(); ctx.arc(w*.76, h*.2, 70,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawMini() {
    mctx.clearRect(0,0,150,105);
    mctx.fillStyle="#090a12"; mctx.fillRect(0,0,150,105);
    for(let y=0;y<MAP_H;y++) for(let x=0;x<MAP_W;x++){
      mctx.fillStyle=BIOMES[biomeIndex].ground;
      mctx.fillRect(x*8,y*8,7,7);
    }
    mctx.fillStyle=BIOMES[biomeIndex].accent;
    mctx.beginPath();mctx.arc(player.x/MAP_W*150,player.y/MAP_H*105,3,0,Math.PI*2);mctx.fill();
  }

  function updateHUD() {
    const p=typeof PLAYER!=="undefined"?PLAYER:null;
    if(!p)return;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set("world25dLevel",`LV ${p.level||1}`);
    let hp="--";
    try{hp=`HP ${typeof maxHp==="function"?Math.round(maxHp()):p.hp||"--"}`;}catch(_){hp=`HP ${p.hp||"--"}`;}
    set("world25dHp",hp);
    set("world25dXp",`XP ${p.xp||0}`);
    set("world25dGold",`◈ ${(typeof inventory!=="undefined"&&inventory.coin)||0}`);
    set("world25dName",p.name||"Wanderer");
    set("wstr",p.str||p.atk||"--"); set("wdex",p.dex||"--"); set("wint",p.int||"--"); set("wvit",p.vit||"--");
    set("world25dBiome",BIOMES[biomeIndex].name.toUpperCase());
  }

  function refreshLog(){
    if(typeof WORLD==="undefined"||!logBox)return;
    const lines=Array.isArray(WORLD.dialogueLog)?WORLD.dialogueLog.slice(-6):[];
    if(lines.length) logBox.innerHTML=lines.map(esc).join("<br>");
  }

  function seedNpcs(){
    npcs.length=0;
    npcs.push({x:4.5,y:4.2,color:"#d8b3ff"},{x:11.7,y:3.6,color:"#8fd9cf"},{x:13.2,y:9.8,color:"#ffbd9c"});
  }

  function loop(now){
    const dt=Math.min(.033,(now-last)/1000);last=now;
    update(dt); drawWorld(dt); drawMini(); updateHUD(); refreshLog();
    requestAnimationFrame(loop);
  }

  function boot(){
    if(initialized)return;
    initialized=true;
    loadVisualState();
    createUI(); seedNpcs();
    requestAnimationFrame(loop);
  }

  // Wait until the existing RPG has created WORLD/PLAYER, then take over presentation.
  const start=()=>{
    if(typeof WORLD!=="undefined" && typeof PLAYER!=="undefined") boot();
    else setTimeout(start,50);
  };
  start();
})();
