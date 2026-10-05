/* Adds the terminal command used to open battle keybind settings. */
(function () {
  "use strict";
  if (typeof COMMANDS === "undefined" || typeof openBattleKeybinds !== "function") return;
  COMMANDS.battlekeys = [openBattleKeybinds, "battlekeys", "Set the keys used for Attack, Skills, Dodge and Parry in real-time battles"];

  // Add it to the numbered main menu beside Settings when that menu is available.
  if (typeof MENU !== "undefined" && Array.isArray(MENU)) {
    try {
      const group = MENU.find((entry) => Array.isArray(entry) && Array.isArray(entry[1]) && entry[1].includes("settings"));
      if (group && !group[1].includes("battlekeys")) {
        const at = group[1].indexOf("settings");
        group[1].splice(at < 0 ? group[1].length : at + 1, 0, "battlekeys");
      }
    } catch (_) {}
  }
})();
