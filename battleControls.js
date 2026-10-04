/* Real-time battle keybinds. Keys are limited to 1-0 and Z X C V Q E R F. */
(function () {
  "use strict";
  const KEY = "the-last-save.battle-keybinds";
  const ALLOWED = ["1","2","3","4","5","6","7","8","9","0","z","x","c","v","q","e","r","f"];
  const DEFAULTS = { attack: "z", skill1: "x", skill2: "c", skill3: "v", skill4: "q", skill5: "e", skill6: "r", skill7: "f" };
  const load = () => { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch (_) { return { ...DEFAULTS }; } };
  const save = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (_) {} };
  window.BattleKeybinds = { KEY, ALLOWED, DEFAULTS, load, save };
  window.openBattleKeybinds = async function () {
    const b = load();
    const labels = ["attack", "skill1", "skill2", "skill3", "skill4", "skill5", "skill6", "skill7"];
    print("\n⌨️ BATTLE KEYBINDS");
    print("Available keys: 1-0, Z X C V Q E R F");
    labels.forEach((name, i) => print(`${i + 1}. ${name === "attack" ? "Attack" : `Skill ${i}`} → ${String(b[name]).toUpperCase()}`));
    print("0. Back");
    const raw = (await input("Change which slot? ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > labels.length) { print("Choose a listed slot."); return; }
    const action = labels[n - 1];
    const key = (await input(`Enter the new key for ${action === "attack" ? "Attack" : `Skill ${n - 1}`}: `)).trim().toLowerCase();
    if (!ALLOWED.includes(key)) { print("That key cannot be used for battle actions."); return; }
    const conflict = labels.find((x) => x !== action && b[x] === key);
    if (conflict) { print(`That key is already assigned to ${conflict === "attack" ? "Attack" : conflict}.`); return; }
    b[action] = key; save(b);
    print(`✅ ${action === "attack" ? "Attack" : `Skill ${n - 1}`} is now bound to ${key.toUpperCase()}.`);
  };
})();
