/* THE LAST SAVE - original accessory progression for bullet-hell battles.
 * These are fictional game items inspired by action-RPG accessory loadouts.
 */
(function () {
  "use strict";
  if (typeof ITEMS === "undefined") return;

  const ACCESSORIES = {
    "swiftstep emblem": {
      id: "trinket", move_speed: 0.16, dodge: 5,
      description: "+16% battle movement speed and +5% dodge."
    },
    "vital bloom": {
      id: "trinket", max_hp: 35, regen: 1.5,
      description: "+35 max HP and steady health regeneration during real-time fights."
    },
    "warding heart": {
      id: "trinket", max_hp: 20, defense: 2, regen: 0.8,
      description: "+20 max HP, +2 defense and health regeneration."
    },
    "aether dash core": {
      id: "trinket", move_speed: 0.10, dash: "aether", dash_distance: 92, dash_cooldown: 1.05,
      description: "Unlocks a short invulnerable air-dash."
    },
    "ram drive": {
      id: "trinket", max_hp: 18, move_speed: 0.08, dash: "ram", dash_distance: 112, dash_cooldown: 1.25, dash_damage: 2.4,
      description: "Unlocks Ram Dash: burst forward with brief invulnerability and a contact strike."
    },
    "momentum coil": {
      id: "trinket", move_speed: 0.22, dash: "momentum", dash_distance: 105, dash_cooldown: 0.85,
      description: "+22% movement speed and a fast momentum dash."
    },
    "regen prism": {
      id: "trinket", regen: 2.4, max_hp: 12,
      description: "Strong real-time health regeneration."
    },
    "parry sigil": {
      id: "trinket", parry: 10, dash: "aether", dash_distance: 78, dash_cooldown: 1.2,
      description: "+10% parry and unlocks a defensive dash."
    },
    "celestial core": {
      id: "trinket", max_hp: 45, damage: 5, move_speed: 0.12, regen: 1.2,
      dash: "aether", dash_distance: 120, dash_cooldown: 0.9,
      description: "Late-game accessory: mobility, survivability and an aether dash."
    },
  };

  Object.assign(ITEMS, ACCESSORIES);
  window.CalamityAccessories = ACCESSORIES;

  if (typeof getStats === "function" && !window.__calamityStatsWrapped) {
    window.__calamityStatsWrapped = true;
    const baseGetStats = getStats;
    window.getStats = function () {
      const s = baseGetStats();
      s.move_speed = Number(s.move_speed || 0);
      s.regen = Number(s.regen || 0);
      s.dash_distance = 0;
      s.dash_cooldown = Infinity;
      s.dash_damage = 0;
      s.dash = null;
      Object.values(typeof equipment === "object" ? equipment : {}).forEach((name) => {
        const item = name && ITEMS[name];
        if (!item) return;
        s.move_speed += Number(item.move_speed || 0);
        s.regen += Number(item.regen || 0);
        if (item.dash) {
          const cd = Number(item.dash_cooldown || 1.1);
          if (!s.dash || cd < s.dash_cooldown) {
            s.dash = item.dash;
            s.dash_distance = Number(item.dash_distance || 90);
            s.dash_cooldown = cd;
          }
          s.dash_damage = Math.max(s.dash_damage, Number(item.dash_damage || 0));
        }
      });
      s.move_speed = Math.max(0, Math.min(0.5, s.move_speed));
      return s;
    };
    window.CalamityStats = {
      get: () => window.getStats(),
      moveSpeed: (f, base) => Math.max(70, base * (1 + Number(f?.stats?.move_speed || 0))),
      hasDash: (f) => !!f?.stats?.dash,
    };
  }
})();
