/* Real-time battle skill keybind compatibility layer. */
(function () {
  "use strict";
  const KEY = "the-last-save.battle-keybinds";
  const ALLOWED = ["1","2","3","4","5","6","7","8","9","0","z","x","c","v","q","e","r","f"];
  const DEFAULTS = { attack: "1", skill1: "2", skill2: "3", skill3: "4", skill4: "5", skill5: "6", skill6: "7", skill7: "8" };
  const load = () => {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; }
    catch (_) { return { ...DEFAULTS }; }
  };
  const save = (b) => { try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (_) {} };
  window.BattleKeybinds = { KEY, ALLOWED, DEFAULTS, load, save };
  window.BattleManualAttack = { arm: () => {}, isArmed: () => true };
})();
