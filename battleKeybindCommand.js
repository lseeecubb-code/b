/* Adds the terminal command used to open battle keybind settings. */
(function () {
  "use strict";
  if (typeof COMMANDS === "undefined" || typeof openBattleKeybinds !== "function") return;
  COMMANDS.battlekeys = [openBattleKeybinds, "battlekeys", "Set the keys used for Attack and Skills in real-time battles"];

  // Add it to the numbered main menu beside the other settings.
  if (Array.isArray(window.MENU) === false && typeof MENU !== "undefined") {
    try { MENU[4][1].splice(MENU[4][1].indexOf("settings") + 1, 0, "battlekeys"); } catch (_) {}
  }
})();
