/* Adds the terminal command used to open battle keybind settings. */
(function () {
  "use strict";
  if (typeof COMMANDS === "undefined" || typeof openBattleKeybinds !== "function") return;
  COMMANDS.battlekeys = [openBattleKeybinds, "battlekeys", "Set the keys used for Attack and Skills in real-time battles"];
})();
