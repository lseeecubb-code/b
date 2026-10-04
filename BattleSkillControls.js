/*
 * THE LAST SAVE - real-time skill keybind menu.
 * Skill bindings are stored separately from save data.
 */
(function () {
  "use strict";

  const STORE = "the-last-save.skill-keybinds";
  const defaults = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];
  let binds = {};

  try { binds = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { binds = {}; }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(binds)); } catch (e) {} }
  function codeLabel(code) {
    if (!code) return "—";
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (code === "Space") return "Space";
    if (/^Arrow/.test(code)) return code.replace("Arrow", "");
    return code;
  }
  function skills() {
    const out = [];
    try { if (typeof weaponSkills === "function") weaponSkills().forEach((s) => out.push({ key: "weapon:" + s.name, name: s.name, kind: "Weapon skill", skill: s })); } catch (e) {}
    try { if (typeof knownSpells === "function") knownSpells().forEach((n) => out.push({ key: "spell:" + n, name: n, kind: "Spell", skill: (typeof SPELLS !== "undefined" ? SPELLS[n] : null), spell: true })); } catch (e) {}
    return out;
  }
  function takenExcept(key) {
    return Object.keys(binds).some((k) => k !== key && binds[k]);
  }
  function openControls() {
    const old = document.getElementById("skillControlsModal"); if (old) old.remove();
    const list = skills();
    const box = document.createElement("div");
    box.id = "skillControlsModal";
    box.style.cssText = "position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit";
    const card = document.createElement("div");
    card.style.cssText = "width:min(680px,96vw);max-height:85vh;overflow:auto;background:#101018;border:1px solid #555;border-radius:12px;padding:20px;box-shadow:0 20px 60px #000";
    card.innerHTML = "<h2 style='margin:0 0 6px'>🎮 Skill Keybinds</h2><p style='opacity:.8'>Choose a skill, then press the key you want to use for it during battle.</p>";
    const rows = document.createElement("div");
    list.forEach((s) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #292933";
      const label = document.createElement("div");
      label.style.cssText = "flex:1";
      label.innerHTML = "<b>" + String(s.name).replace(/[&<>\"]/g, "") + "</b><small style='display:block;opacity:.65'>" + s.kind + "</small>";
      const key = document.createElement("kbd"); key.textContent = codeLabel(binds[s.key]);
      key.style.cssText = "min-width:52px;text-align:center;padding:7px 10px;border:1px solid #666;border-radius:6px;background:#191923";
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "Set key";
      btn.onclick = () => {
        btn.textContent = "Press a key…";
        const onKey = (e) => {
          e.preventDefault(); e.stopImmediatePropagation();
          window.removeEventListener("keydown", onKey, true);
          if (e.code === "Escape") { btn.textContent = "Set key"; return; }
          if (takenExcept(s.key) && Object.keys(binds).some((k) => k !== s.key && binds[k] === e.code)) {
            Object.keys(binds).forEach((k) => { if (k !== s.key && binds[k] === e.code) binds[k] = null; });
          }
          binds[s.key] = e.code; save(); key.textContent = codeLabel(e.code); btn.textContent = "Set key";
        };
        window.addEventListener("keydown", onKey, true);
      };
      const clear = document.createElement("button"); clear.type = "button"; clear.textContent = "Clear";
      clear.onclick = () => { binds[s.key] = null; save(); key.textContent = "—"; };
      row.append(label, key, btn, clear); rows.appendChild(row);
    });
    const foot = document.createElement("div"); foot.style.cssText = "display:flex;gap:8px;margin-top:16px";
    const reset = document.createElement("button"); reset.type = "button"; reset.textContent = "Reset skill keys";
    reset.onclick = () => { binds = {}; list.forEach((s, i) => { binds[s.key] = defaults[i] || null; }); save(); openControls(); };
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Close"; close.onclick = () => box.remove();
    foot.append(reset, close); card.append(rows, foot); box.appendChild(card); document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
  }

  function activateSkill(code) {
    if (!(window.Battle25D && window.Battle25D.isActive && window.Battle25D.isActive())) return false;
    const f = window.Battle25D.fight && window.Battle25D.fight();
    if (!f || typeof useSkill !== "function") return false;
    const s = skills().find((x) => binds[x.key] === code);
    if (!s || !s.skill) return false;
    if (s.skill.cost != null && f.energy < s.skill.cost) return true;
    const cdKey = s.spell ? "spell:" + s.name : s.name;
    if (f.cooldowns && f.cooldowns[cdKey]) return true;
    try { useSkill(f, s.skill); } catch (e) { return false; }
    return true;
  }

  window.openBattleSkillControls = openControls;
  window.BattleSkillControls = { open: openControls, activate: activateSkill };

  document.addEventListener("DOMContentLoaded", () => {
    const footer = document.querySelector(".terminal-footer .footer-meta");
    if (footer && !document.getElementById("skillControlsButton")) {
      const b = document.createElement("button"); b.id = "skillControlsButton"; b.type = "button"; b.textContent = "🎮 Skill Keys";
      b.style.cssText = "margin-right:10px"; b.onclick = openControls; footer.prepend(b);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.getElementById("skillControlsModal")) return;
    if (activateSkill(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
