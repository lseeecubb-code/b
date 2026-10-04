/*
 * THE LAST SAVE — fighting-game style battle controls.
 *
 * While a fight is running there is no typed input: every action is a key press (or a click /
 * tap on the on-stage action bar). Skills and spells get their own keys, and every key can be
 * rebound from the Controls screen (header button, or type `controls` outside a fight).
 *
 * The combat engine itself is untouched. This file only replaces how the player's action is
 * chosen: askAction() waits for a key instead of reading a typed line, and returns exactly the
 * same [action, extra] pairs the engine already expects.
 *
 * Bindings live in localStorage, not in the save code, so existing saves are unaffected.
 */
(function () {
  "use strict";

  const STORE = "the-last-save.keybinds";

  // id matches the action names playerTurn() already understands.
  const ACTIONS = [
    { id: "attack", label: "Attack", icon: "⚔️", def: "KeyJ", group: "main" },
    { id: "heavy", label: "Heavy", icon: "💥", def: "KeyK", group: "main" },
    { id: "guard", label: "Guard", icon: "🛡️", def: "KeyL", group: "defense" },
    { id: "parry", label: "Parry", icon: "🤺", def: "KeyU", group: "defense" },
    { id: "dodge", label: "Dodge", icon: "💨", def: "KeyI", group: "defense" },
    { id: "recover", label: "Focus", icon: "⚡", def: "KeyO", group: "main" },
    { id: "counter", label: "Counter", icon: "🎯", def: "Space", group: "main" },
    { id: "item", label: "Item", icon: "🧪", def: "KeyR", group: "more" },
    { id: "limit", label: "Limit Break", icon: "🌟", def: "KeyB", group: "more" },
    { id: "companion", label: "Ally order", icon: "🗣️", def: "KeyC", group: "more" },
    { id: "run", label: "Run", icon: "🏃", def: "KeyX", group: "more" },
    { id: "target-prev", label: "Prev target", icon: "⬅️", def: "KeyQ", group: "util" },
    { id: "target-next", label: "Next target", icon: "➡️", def: "KeyE", group: "util" },
    { id: "inspect", label: "Inspect", icon: "🔎", def: "KeyF", group: "util" },
    { id: "log", label: "Combat log", icon: "📜", def: "KeyV", group: "util" },
  ];
  const SKILL_DEFAULTS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];
  const RESERVED = /^(Escape|Enter|NumpadEnter|Tab|F\d+|Shift.*|Control.*|Alt.*|Meta.*|CapsLock|ContextMenu|OS.*)$/;

  // ---------- bindings ----------
  let binds = { actions: {}, skills: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null");
    if (raw && typeof raw === "object") binds = { actions: raw.actions || {}, skills: raw.skills || {} };
  } catch (e) {}
  function saveBinds() { try { localStorage.setItem(STORE, JSON.stringify(binds)); } catch (e) {} }

  const actionCode = (a) => (a.id in binds.actions ? binds.actions[a.id] : a.def); // null = unbound

  function skillList() {
    const out = [];
    try { (typeof weaponSkills === "function" ? weaponSkills() : []).forEach((s) => out.push({ kind: "weapon", name: s.name, cost: s.cost, cd: s.name, desc: s.desc })); } catch (e) {}
    try { (typeof knownSpells === "function" ? knownSpells() : []).forEach((n) => out.push({ kind: "spell", name: n, cost: spellCost(SPELLS[n]), cd: `spell:${n}`, desc: SPELLS[n].desc })); } catch (e) {}
    return out;
  }
  const skillKey = (s) => `${s.kind}:${s.name}`;

  // Skills bound explicitly keep their key; the rest fill digits 1-9 in order, skipping taken keys.
  function resolveSkills() {
    const list = skillList();
    const taken = new Set();
    ACTIONS.forEach((a) => { const c = actionCode(a); if (c) taken.add(c); });
    list.forEach((s) => { const c = binds.skills[skillKey(s)]; if (c) taken.add(c); });
    let next = 0;
    list.forEach((s) => {
      const k = skillKey(s);
      if (k in binds.skills) { s.code = binds.skills[k]; return; }
      while (next < SKILL_DEFAULTS.length && taken.has(SKILL_DEFAULTS[next])) next++;
      s.code = next < SKILL_DEFAULTS.length ? SKILL_DEFAULTS[next++] : null;
      if (s.code) taken.add(s.code);
    });
    return list;
  }

  function setBinding(type, id, code) {
    // Take the key away from whatever else held it, so one key never means two things.
    if (code) {
      ACTIONS.forEach((a) => { if (actionCode(a) === code && !(type === "action" && a.id === id)) binds.actions[a.id] = null; });
      resolveSkills().forEach((s) => { if (s.code === code && !(type === "skill" && skillKey(s) === id)) binds.skills[skillKey(s)] = null; });
      Object.keys(binds.skills).forEach((k) => { if (binds.skills[k] === code && !(type === "skill" && k === id)) binds.skills[k] = null; });
    }
    if (type === "action") binds.actions[id] = code; else binds.skills[id] = code;
    saveBinds();
  }
  function resetBinds() { binds = { actions: {}, skills: {} }; saveBinds(); }

  function codeLabel(code) {
    if (!code) return "—";
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad\d$/.test(code)) return "Num" + code.slice(6);
    return ({ Space: "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Backspace: "⌫", Semicolon: ";", Comma: ",", Period: ".", Slash: "/", Quote: "'", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`", Backslash: "\\" })[code] || code;
  }

  // ---------- small DOM helpers ----------
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const stageOn = () => !!(window.Battle25D && window.Battle25D.isActive() && document.getElementById("b25Bar"));

  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    const host = document.getElementById("battle25d");
    if (!host) return;
    if (!toastEl || !toastEl.isConnected) { toastEl = document.createElement("div"); toastEl.className = "b25-toast"; host.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl && toastEl.classList.remove("show"), 1500);
  }

  let modalOpen = false;

  // ---------- on-stage action bar ----------
  let waiting = null; // { f, resolve }
  function btn(id, code, icon, label, sub, state) {
    return `<button type="button" class="b25-btn ${state || ""}" data-b="${esc(id)}"><kbd>${esc(codeLabel(code))}</kbd><span class="b25-ico">${icon}</span><span class="b25-lbl">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
  }
  function renderBar(f) {
    const bar = document.getElementById("b25Bar");
    if (!bar) return;
    const maxE = typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY;
    const pips = Array.from({ length: maxE }, (_, i) => `<i class="${i < f.energy ? "on" : ""}"></i>`).join("");
    const limit = f.limitUsed ? "spent" : `${Math.min(100, Math.floor(f.limitGauge || 0))}%`;
    const exposed = (f.monster_effects || []).some((e) => e.type === "exposed");
    const comboHits = f.combo && f.combo.hits;
    const parts = [];
    parts.push(`<div class="b25-hud"><span class="b25-energy" title="Energy">⚡<span class="b25-pips">${pips}</span></span><span class="b25-limit">🌟 ${limit}</span><span class="b25-combo ${comboHits ? "live" : ""}"><span class="b25-combo-fill" id="b25ComboFill"></span><b>${comboHits ? `COMBO ×${comboHits}` : "NO COMBO"}</b></span><button type="button" class="b25-gear" data-b="__controls" title="Rebind keys">🎮 Keys</button></div>`);
    let row = "";
    ACTIONS.filter((a) => a.group !== "util").forEach((a) => {
      let state = "", sub = "";
      if (a.id === "heavy") { sub = `${C.HEAVY_COST}⚡`; if (f.energy < C.HEAVY_COST) state = "off"; }
      if (a.id === "recover") sub = `+${typeof focusRecovery === "function" ? focusRecovery() : C.RECOVER}⚡`;
      if (a.id === "counter" && !exposed) state = "off";
      if (a.id === "limit") { sub = limit; if (f.limitUsed || (f.limitGauge || 0) < 100) state = "off"; }
      if (a.id === "guard" && f.stats && f.stats.no_guard) state = "off";
      if (a.id === "companion" && !(WORLD.companions && WORLD.companions.active && WORLD.companions.active[0])) state = "off";
      row += btn(a.id, actionCode(a), a.icon, a.label, sub, state);
    });
    parts.push(`<div class="b25-row">${row}</div>`);
    const skills = resolveSkills();
    if (skills.length) {
      let srow = "";
      skills.forEach((s) => {
        const cd = f.cooldowns[s.cd] || 0;
        const state = f.energy < s.cost || cd ? "off" : "";
        srow += btn("skill:" + skillKey(s), s.code, s.kind === "spell" ? "🔮" : "✨", s.name.replace(/\b\w/g, (c) => c.toUpperCase()), cd ? `CD ${cd}` : `${s.cost}⚡`, state);
      });
      parts.push(`<div class="b25-row b25-skills">${srow}</div>`);
    }
    bar.innerHTML = parts.join("");
    bar.classList.toggle("ready", !!waiting);
  }

  // ---------- popup pickers (items, ally orders) ----------
  function pick(title, entries) {
    // entries: [{label, sub}] → resolves with index or null. Keys 1-9, or click; Esc cancels.
    return new Promise((resolve) => {
      const host = document.getElementById("battle25d");
      const box = document.createElement("div");
      box.className = "b25-pop";
      box.innerHTML = `<div class="b25-pop-card"><div class="b25-pop-title">${esc(title)}</div>${entries.map((e, i) => `<button type="button" class="b25-pop-item" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(e.label)}</span><small>${esc(e.sub || "")}</small></button>`).join("")}<div class="b25-pop-hint">press a number · Esc to cancel</div></div>`;
      host.appendChild(box);
      const finish = (v) => { window.removeEventListener("keydown", onKey, true); box.remove(); resolve(v); };
      const onKey = (e) => {
        if (modalOpen) return;
        const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
        if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(null); }
        else if (m && +m[1] >= 1 && +m[1] <= entries.length) { e.preventDefault(); e.stopImmediatePropagation(); finish(+m[1] - 1); }
        else if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopImmediatePropagation(); }
      };
      window.addEventListener("keydown", onKey, true);
      box.addEventListener("click", (e) => {
        const b = e.target.closest(".b25-pop-item");
        if (b) finish(+b.dataset.i); else if (e.target === box) finish(null);
      });
    });
  }

  // ---------- waiting for the player's action ----------
  function lookup(code) {
    const a = ACTIONS.find((x) => actionCode(x) === code);
    if (a) return a.id;
    const s = resolveSkills().find((x) => x.code === code);
    return s ? "skill:" + skillKey(s) : null;
  }

  function waitForChoice(f) {
    return new Promise((resolve) => {
      let timer = 0, tick = 0;
      const c = f.combo;
      const cleanup = () => {
        window.removeEventListener("keydown", onKey, true);
        document.getElementById("b25Bar") && document.getElementById("b25Bar").removeEventListener("click", onClick);
        clearTimeout(timer); clearInterval(tick);
        waiting = null; window.Battle25D.awaiting = false;
        const bar = document.getElementById("b25Bar"); if (bar) bar.classList.remove("ready");
      };
      const choose = (id) => { cleanup(); resolve(id); };
      const onKey = (e) => {
        if (modalOpen || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const id = lookup(e.code);
        if (!id) { if (!RESERVED.test(e.code) && e.code !== "Escape") { e.preventDefault(); e.stopImmediatePropagation(); } return; }
        e.preventDefault(); e.stopImmediatePropagation(); choose(id);
      };
      const onClick = (e) => {
        const b = e.target.closest("[data-b]"); if (!b) return;
        if (b.dataset.b === "__controls") { openControls(); return; }
        if (b.classList.contains("off")) { toast("Can't use that right now"); return; }
        choose(b.dataset.b);
      };
      waiting = { f, resolve: choose };
      window.Battle25D.awaiting = true;
      renderBar(f);
      window.addEventListener("keydown", onKey, true);
      document.getElementById("b25Bar").addEventListener("click", onClick);
      // A live combo gives a timed window, exactly like the typed prompt did.
      if (c && c.hits && typeof COMBO !== "undefined") {
        const ms = c.deadline == null ? COMBO.WINDOW_MS : Math.max(COMBO.REPROMPT_MS, c.deadline - Date.now());
        c.deadline = Date.now() + ms;
        const t0 = Date.now();
        timer = setTimeout(() => {
          if (typeof comboEnd === "function") comboEnd(f, "time");
          clearInterval(tick); renderBar(f);
        }, ms);
        tick = setInterval(() => {
          const fill = document.getElementById("b25ComboFill");
          if (fill) fill.style.width = Math.max(0, 100 - ((Date.now() - t0) / ms) * 100) + "%";
        }, 40);
      }
    });
  }

  async function battleAsk(f) {
    // input() used to do these every prompt: drop the loading indicator and autosave.
    if (typeof clearLoadingIndicator === "function") clearLoadingIndicator();
    await Typewriter.idle();
    try { autosave(); } catch (e) {}
    try { document.getElementById("command").blur(); } catch (e) {}
    while (true) {
      let id = await waitForChoice(f);
      let skill = null;
      if (id.startsWith("skill:")) {
        const key = id.slice(6);
        skill = resolveSkills().find((s) => skillKey(s) === key);
        id = "skill";
      }
      if (f.controlGlitchTurns > 0) {
        if (id === "attack") id = "guard"; else if (id === "guard") id = "attack";
        f.controlGlitchTurns--;
      }
      if (id === "heavy" && f.energy < C.HEAVY_COST) { toast(`Not enough energy — Heavy costs ${C.HEAVY_COST}`); continue; }
      if (id === "counter" && !(f.monster_effects || []).some((e) => e.type === "exposed")) { toast("No enemy opening to counter"); continue; }
      if (id === "limit" && ((f.limitGauge || 0) < 100 || f.limitUsed)) { toast(f.limitUsed ? "Limit Break already used" : "Limit Break not charged"); continue; }
      if (id === "guard" && f.stats.no_guard) { toast("The Glass Edge makes guarding impossible"); continue; }
      if (id === "item") {
        const owned = Object.keys(USABLE_ITEMS).filter((n) => (inventory[n] || 0) > 0).slice(0, 9);
        if (!owned.length) { toast("You have no usable items"); continue; }
        const i = await pick("Use which item?", owned.map((n) => ({ label: `${n} ×${inventory[n]}`, sub: describeUsable(n) })));
        if (i === null) continue;
        return ["item", owned[i]];
      }
      if (id === "skill") {
        if (f.energy < skill.cost) { toast(`${skill.name} needs ${skill.cost} energy`); continue; }
        if (f.cooldowns[skill.cd]) { toast(`${skill.name}: ${f.cooldowns[skill.cd]} turn(s) of cooldown`); continue; }
        return ["skill", { kind: skill.kind, name: skill.name }];
      }
      if (id === "companion") {
        const cid = WORLD.companions.active && WORLD.companions.active[0];
        if (!cid) { toast("No companion is active"); continue; }
        const hp = WORLD.companions.hp[cid] ?? companionMaxHp(cid);
        if (hp <= 0) { toast(`${COMPANION_DEFS[cid].name} is down`); continue; }
        const i = await pick(`${COMPANION_DEFS[cid].name}: give an order`, [{ label: "Attack" }, { label: "Guard" }, { label: "Heal" }]);
        if (i === null) continue;
        forcedAnswer = ["attack", "guard", "heal"][i];
        return ["companion", null];
      }
      if (id === "target-prev" || id === "target-next") {
        const count = f.enemies ? f.enemies.length : 0;
        let idx = f.target;
        const dir = id === "target-next" ? 1 : -1;
        for (let i = 0; i < count; i++) { idx = (idx + dir + count) % count; if (f.enemies[idx].hp > 0) break; }
        if (count > 1 && idx !== f.target && f.enemies[idx].hp > 0) { f.target = idx; toast(`Targeting ${f.enemies[idx].name}`); }
        else toast("No other living targets");
        continue;
      }
      if (id === "inspect") {
        const foe = f.enemies && f.enemies[f.target];
        if (foe) {
          const intent = foe.intent && (foe.intent.attack && foe.intent.attack.name || foe.intent.text || foe.intent.kind) || "no visible move";
          print(`🔎 ${title(foe.displayName || foe.name)} · ${foe.hp}/${foe.monster.hp} HP · next: ${intent}`);
          if (foe.effects && foe.effects.length) print("Effects: " + foe.effects.map((x) => title(x.type)).join(", "));
          await Typewriter.idle();
        }
        continue;
      }
      if (id === "log") { if (typeof showCombatLog === "function") { showCombatLog(f); await Typewriter.idle(); } continue; }
      return [id, null];
    }
  }

  // Clicking an enemy on the stage targets it.
  window.Battle25D.onFoeClick = (i) => {
    const f = waiting && waiting.f;
    if (!f || i < 0 || !f.enemies || f.enemies.length < 2 || !f.enemies[i] || f.enemies[i].hp <= 0) return;
    f.target = i; toast(`Targeting ${f.enemies[i].name}`); renderBar(f);
  };

  // ---------- engine hooks ----------
  let forcedAnswer = null;

  if (typeof askAction === "function") {
    const origAsk = askAction;
    askAction = function (f) { return stageOn() ? battleAsk(f) : origAsk.apply(this, arguments); };
  }
  // The typed action menu is replaced by the action bar while the stage is up.
  if (typeof showCombatMenu === "function") {
    const origMenu = showCombatMenu;
    showCombatMenu = function () { if (stageOn()) return; return origMenu.apply(this, arguments); };
  }
  // Anything else that still needs typing in a fight (story riddles, level-up stats) gets the
  // terminal input back; ally orders are answered from the picker above instead of by typing.
  if (typeof input === "function") {
    const origInput = input;
    input = function (prompt) {
      if (forcedAnswer !== null && /^Order \(/.test(String(prompt))) { const a = forcedAnswer; forcedAnswer = null; return Promise.resolve(a); }
      if (!stageOn()) return origInput.apply(this, arguments);
      document.body.classList.add("battle-typed");
      return Promise.resolve(origInput.apply(this, arguments)).finally(() => document.body.classList.remove("battle-typed"));
    };
  }

  // ---------- Controls screen ----------
  let modal = null, capture = null;
  function buildModal() {
    modal = document.createElement("div");
    modal.id = "controlsModal";
    modal.hidden = true;
    modal.innerHTML = '<div class="cm-card" role="dialog" aria-label="Battle controls"><div class="cm-head"><b>🎮 BATTLE CONTROLS</b><button type="button" id="cmClose">✕</button></div><div class="cm-note">Click a key, then press the new one. Backspace clears it. A key can only do one thing — taking it moves it from the old action.</div><div id="cmBody"></div><div class="cm-foot"><button type="button" id="cmReset">Reset to defaults</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.id === "cmClose") return closeControls();
      if (e.target.id === "cmReset") { resetBinds(); capture = null; renderModal(); return; }
      const b = e.target.closest("[data-bind]");
      if (b) { capture = { type: b.dataset.type, id: b.dataset.bind }; renderModal(); }
    });
  }
  function renderModal() {
    const body = document.getElementById("cmBody");
    const row = (type, id, label, code, desc) => `<div class="cm-row"><span class="cm-name">${label}${desc ? `<small>${esc(desc)}</small>` : ""}</span><button type="button" class="cm-key ${capture && capture.type === type && capture.id === id ? "cap" : ""}" data-type="${type}" data-bind="${esc(id)}">${capture && capture.type === type && capture.id === id ? "press a key…" : esc(codeLabel(code))}</button></div>`;
    const groups = { main: "Moves", defense: "Defense", more: "Other actions", util: "Targeting & info" };
    let html = "";
    Object.keys(groups).forEach((g) => {
      html += `<div class="cm-sec">${groups[g]}</div>` + ACTIONS.filter((a) => a.group === g).map((a) => row("action", a.id, `${a.icon} ${a.label}`, actionCode(a))).join("");
    });
    const sk = resolveSkills();
    html += `<div class="cm-sec">Skills & spells</div>`;
    html += sk.length ? sk.map((s) => row("skill", skillKey(s), `${s.kind === "spell" ? "🔮" : "✨"} ${esc(s.name.replace(/\b\w/g, (c) => c.toUpperCase()))} · ${s.cost}⚡`, s.code, s.desc)).join("") : '<div class="cm-empty">No skills yet — equip skill-bearing gear or learn a spell. Their keys appear here and follow the skill when you swap gear.</div>';
    body.innerHTML = html;
  }
  function openControls() {
    if (!modal) buildModal();
    capture = null; renderModal(); modal.hidden = false; modalOpen = true;
    window.addEventListener("keydown", onModalKey, true);
  }
  function closeControls() {
    if (!modal) return;
    modal.hidden = true; capture = null;
    window.removeEventListener("keydown", onModalKey, true);
    setTimeout(() => { modalOpen = false; if (waiting) renderBar(waiting.f); }, 0);
  }
  function onModalKey(e) {
    if (!modal || modal.hidden) return;
    if (!capture) { if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeControls(); } return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === "Escape") { capture = null; return renderModal(); }
    if (e.code === "Backspace" || e.code === "Delete") { setBinding(capture.type, capture.id, null); capture = null; return renderModal(); }
    if (RESERVED.test(e.code)) return;
    setBinding(capture.type, capture.id, e.code);
    capture = null; renderModal();
  }

  const openBtn = document.getElementById("controlsButton");
  if (openBtn) openBtn.addEventListener("click", openControls);
  if (typeof COMMANDS !== "undefined")
    COMMANDS.controls = [() => { openControls(); print("🎮 Opened the battle Controls screen."); }, "controls", "Rebind the battle keys and skill hotkeys"];

  window.BattleControls = { open: openControls, binds: () => binds };
})();
