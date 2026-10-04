/* Stronger player projectile homing for real-time battles. */
(function () {
  "use strict";
  if (typeof ITEMS === "undefined") return;
  Object.keys(ITEMS).forEach((name) => {
    const item = ITEMS[name];
    if (!item || item.id !== "weapon") return;
    item.projectile = { ...(item.projectile || {}), homing: true };
  });
})();
