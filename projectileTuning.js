/* Player projectile tuning for real-time battles. */
(function () {
  "use strict";
  if (typeof ITEMS === "undefined") return;
  Object.keys(ITEMS).forEach((name) => {
    const item = ITEMS[name];
    if (!item || item.id !== "weapon") return;
    item.projectile = { ...(item.projectile || {}), homing: true };
  });
  if (ITEMS["iron fist"]) {
    ITEMS["iron fist"].projectile = {
      ...(ITEMS["iron fist"].projectile || {}),
      style: "slash",
      range: 165,
      speed: 300,
      count: 3,
      spread: 0.16,
      homing: true,
      color: "#f0d0bd"
    };
  }
})();
