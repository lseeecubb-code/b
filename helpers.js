// Core configuration, game state, helpers, item categories and descriptions.

// The version shown in the bottom-right corner of the game. Change this string whenever you like.
const GAME_VERSION = "v2.0 · 2.5D";

const C = {
  BASE_MAX_HP: 100,
  PLAYER_DAMAGE: [8, 14],
  ATTACK_HIT: 70,
  CRIT: 25,
  CRIT_MULT: 1.5,
  MAX_ENERGY: 6,
  START_ENERGY: 4,
  RECOVER: 3,
  ATTACK_GAIN: 1,
  HEAVY_COST: 2,
  HEAVY_MULT: 2.0,
  HEAVY_HIT: 85,
  GUARD_RED: 0.5,
  GUARD_MAX: 0.9,
  PARRY: 60,
  PARRY_MAX: 90,
  PARRY_MOD: { normal: 0, fast: -15, heavy: -30, slow: 15 },
  PARRY_TAKEN: 0.0,
  PERFECT_PARRY: 15,
  PARRY_STAGGER: 25,
  STAGGER_BONUS: 0.5,
  PERFECT_ENERGY: 2,
  PERFECT_COUNTER: 1.0,
  DODGE: 70,
  DODGE_MAX: 99,
  DODGE_MOD: { normal: 0, fast: -30, heavy: 10, slow: 20 },
  WRONG_DEF: 1.25,
  MIN_DMG: 1,
  GUARD_REACT: 15,
  STANCE_REACT: 10,
  COUNTER_MULT: 2,
  WEAK_MULT: 0.5,
  BASIC_MIN: 20,
  ATTACKING: ["attack", "heavy", "skill", "magic"],
  RIPOSTE: 0.6,
  RUN: 60,
  RUN_MAX: 90,
  LVL_HP: 8,
  LVL_DMG: 1,
  MAX_LEVEL: 75,
};
const START_INV = { coin: 100, iron: 5, wood: 5, "iron fist": 1 };
const SLOTS = ["weapon", "offhand", "head", "armor", "feet", "trinket"];
let inventory, equipment, PLAYER, STORY;
function defaultPlayerExtra(p = {}) {
  return {
    str: p.str ?? 5,
    agi: p.agi ?? 5,
    vit: p.vit ?? 5,
    foc: p.foc ?? 5,
    statPoints: p.statPoints ?? 0,
    skillPoints: p.skillPoints ?? 0,
    perks: Array.isArray(p.perks) ? [...p.perks] : [],
    spells: Array.isArray(p.spells) ? [...p.spells] : ["ember spark", "mend"],
    ngPlus: p.ngPlus ?? 0,
    ngPlusEnding: ["remember", "release", "rewrite"].includes(p.ngPlusEnding) ? p.ngPlusEnding : null,
    origin: ["vanguard", "duelist", "scout", "scholar"].includes(p.origin) ? p.origin : null,
  };
}
function defaultWorld() {
  return {
    quests: {},
    upgrades: {},
    rarity: {},
    recipeUnlocks: [],
    recipeMaterialsSeen: [],
    trackedRecipes: [],
    recipesCrafted: [],
    bestiary: {},
    companions: { recruited: [], active: [], hp: {}, affinity: {}, personal: {} },
    dungeonRun: null,
    towerRun: null,
    arenaRun: null,
    raidRun: null,
    challengeRun: null,
    memories: { reloads: 0, quitsMidFight: 0, lastSeenAt: 0 },
    rested: 0,
    eventsDone: 0,
    usedCombatItem: false,
    totalKills: 0,
    hideout: { level: 0, trophies: [] },
    dialogueLog: [],
    weaponMastery: {},
    flags: {},
  };
}
let WORLD = defaultWorld();
// Resets inventory, equipment, level and story progress to a fresh game.
function resetState() {
  inventory = { ...START_INV };
  equipment = { weapon: null, offhand: null, head: null, armor: null, feet: null, trinket: null };
  PLAYER = { level: 1, xp: 0, ...defaultPlayerExtra() };
  STORY = { chapter: 0, fracture: 0, flags: new Set(), seen: new Set(), ending: null, kills: {}, journal: [] };
  WORLD = defaultWorld();
  WORLD.recipeMaterialsSeen = Object.keys(inventory).filter((name) => name !== "coin");
}
resetState();

// ---------- helpers ----------
const percent = (c) => 1 + Math.floor(Math.random() * 100) <= c;
const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const wchoice = (items, ws) => {
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
};
const title = (s) => s.replace(/\b[a-z]/gi, (c, i, t) => c.toUpperCase());
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const sgn = (n) => (n >= 0 ? "+" : "") + n;
const int = Math.trunc,
  isDigit = (s) => /^\d+$/.test(s);
const pad = (s, n) => String(s).padEnd(n),
  rpad = (s, n) => String(s).padStart(n);
const hpBar = (c, m, w = 20) => {
  const f = Math.max(0, Math.round((w * Math.max(0, c)) / m));
  return "[" + "#".repeat(f) + "-".repeat(w - f) + `] ${Math.max(0, c)}/${m}`;
};
const energyBar = (c, m) => {
  m = m ?? (typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY);
  c = Math.max(0, Math.min(c, m));
  return "●".repeat(c) + "○".repeat(m - c) + ` ${c}/${m}`;
};
const makeAttack = (name, data = {}) => {
  const attack = Object.assign({}, DEFAULT_ATTACK, data, { name });
  const rawAccuracy = data.accuracy == null ? DEFAULT_ATTACK.accuracy : Number(data.accuracy);
  attack.accuracy = Number.isFinite(rawAccuracy)
    ? Math.max(0, Math.min(100, Math.floor(rawAccuracy)))
    : DEFAULT_ATTACK.accuracy;
  return attack;
};
// Splits text like 'iron sword 2' into ['iron sword', 2] (amount defaults to 1).
function parseItemAmount(t) {
  const p = t.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let a = 1;
  if (p.length && isDigit(p[p.length - 1])) {
    a = parseInt(p.pop());
  }
  return [p.join(" "), a];
}
// Adds items to the inventory (pass quiet = true to skip the message).
function markRecipeMaterialSeen(name) {
  if (!WORLD || name === "coin") return;
  if (!Array.isArray(WORLD.recipeMaterialsSeen)) WORLD.recipeMaterialsSeen = [];
  if (!WORLD.recipeMaterialsSeen.includes(name)) WORLD.recipeMaterialsSeen.push(name);
}
function addItem(n, a, q = false) {
  inventory[n] = (inventory[n] || 0) + a;
  markRecipeMaterialSeen(n);
  if (typeof ensureRarity === "function") ensureRarity(n);
  if (typeof noteQuestCollect === "function") noteQuestCollect();
  if (typeof checkAchievements === "function") checkAchievements();
  if (!q) {
    if (n === "coin") print(`Earned $${a}`);
    else print(`Obtained <${title(n)}> (${a}x)`);
  }
}
// Removes items from the inventory; returns false if there aren't enough.
function removeItem(n, a, q = false) {
  const c = inventory[n] || 0;
  if (a > c) {
    print(`⚠️ You don't have enough ${n}.`);
    return false;
  }
  inventory[n] = c - a;
  if (inventory[n] === 0) delete inventory[n];
  if (!q) print(`📦 Removed ${a} × ${n} from your inventory.`);
  return true;
}

// ---------- categories ----------
const SLOT_TITLES = {
  weapon: "Weapons",
  armor: "Armor",
  offhand: "Shields / Offhand",
  head: "Headgear",
  feet: "Footwear",
  trinket: "Trinkets",
};
const RAW = new Set([
  "wood",
  "fiber",
  "stone",
  "coal",
  "iron",
  "steel",
  "silver ore",
  "silver",
  "gold ore",
  "gold",
  "obsidian",
  "moon herb",
  "black salt",
  "clockwork spring",
]);
const CRYS = new Set([
  "crystal",
  "frost crystal",
  "ancient crystal",
  "void crystal",
  "ember core",
  "soul shard",
  "demon core",
  "dragon heart",
  "ancient heart",
  "frost king core",
]);
const CAT_ORDER = [
  "Weapons",
  "Armor",
  "Shields / Offhand",
  "Headgear",
  "Footwear",
  "Trinkets",
  "Consumables",
  "Raw Materials",
  "Crystals & Cores",
  "Monster Parts",
];
const CAT_EMOJI = {
  Weapons: "⚔️", Armor: "🛡️", "Shields / Offhand": "🛡️", Headgear: "🪖",
  Footwear: "🥾", Trinkets: "💍", Consumables: "🧪", "Raw Materials": "🪵",
  "Crystals & Cores": "💎", "Monster Parts": "🦴",
};
const GEAR = CAT_ORDER.slice(0, 6),
  MATS = CAT_ORDER.slice(7);
const CAT_ALIAS = {};
CAT_ORDER.forEach((c) => (CAT_ALIAS[c.toLowerCase()] = [c]));
Object.assign(CAT_ALIAS, {
  gear: GEAR,
  equipment: GEAR,
  weapon: ["Weapons"],
  armour: ["Armor"],
  shield: ["Shields / Offhand"],
  shields: ["Shields / Offhand"],
  offhand: ["Shields / Offhand"],
  head: ["Headgear"],
  feet: ["Footwear"],
  trinket: ["Trinkets"],
  consumable: ["Consumables"],
  material: MATS,
  materials: MATS,
  raw: ["Raw Materials"],
  crystals: ["Crystals & Cores"],
  cores: ["Crystals & Cores"],
  parts: ["Monster Parts"],
  drops: ["Monster Parts"],
});
// Which inventory/shop category an item belongs to.
function itemCategory(n) {
  if (ITEMS[n]) return SLOT_TITLES[ITEMS[n].id];
  if (USABLE_ITEMS[n]) return "Consumables";
  if (RAW.has(n)) return "Raw Materials";
  if (CRYS.has(n)) return "Crystals & Cores";
  return "Monster Parts";
}
const categoryFilter = (t) => CAT_ALIAS[t.trim().toLowerCase()] || null;
const groupedNames = (names) =>
  [...names].sort(
    (a, b) =>
      CAT_ORDER.indexOf(itemCategory(a)) - CAT_ORDER.indexOf(itemCategory(b)) ||
      (a < b ? -1 : a > b ? 1 : 0)
  );
// Prints a numbered list grouped by category.
function printNumbered(names, label) {
  let last = null;
  names.forEach((n, i) => {
    const c = itemCategory(n);
    if (c !== last) {
      print(`\n${CAT_EMOJI[c] || "📦"}`);
      last = c;
    }
    print(`  ${rpad(i + 1, 2)}. ${label ? label(n) : n}`);
  });
}
function resolveChoice(raw, names) {
  raw = raw.trim().toLowerCase();
  return isDigit(raw) && +raw >= 1 && +raw <= names.length ? names[+raw - 1] : raw;
}
// Asks the player to pick a category; returns the chosen categories or null.
async function chooseCategory(ttl, counts) {
  const cats = CAT_ORDER.filter((c) => counts[c]);
  if (!cats.length) {
    print("\n(Nothing to show.)");
    return null;
  }
  print("\n🗂️");
  cats.forEach((c, i) => print(`${i + 1}. ${c} (${counts[c]} available)`));
  print(`${cats.length + 1}. 🌟 Everything`);
  print("0. ↩️ Back");
  while (true) {
    const raw = (await input("Pick a category (number or name): ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return null;
    if (["all", "everything", String(cats.length + 1)].includes(raw)) return cats;
    if (isDigit(raw) && +raw >= 1 && +raw <= cats.length) return [cats[+raw - 1]];
    const f = categoryFilter(raw);
    if (f) {
      const ch = f.filter((c) => cats.includes(c));
      if (ch.length) return ch;
    }
    print("Pick a category number or name, or 0 to go back.");
  }
}

// ---------- descriptions ----------
function describeBuffs(n) {
  const d = ITEMS[n],
    p = [];
  if ("damage" in d) p.push(`${sgn(d.damage)} damage`);
  if ("max_hp" in d) p.push(`${sgn(d.max_hp)} max HP`);
  if ("guard" in d) p.push(`+${int(d.guard * 100)}% guard`);
  if ("parry" in d) p.push(`+${d.parry}% parry`);
  if ("crit" in d) p.push(`+${d.crit}% crit`);
  if ("dodge" in d) p.push(`+${d.dodge}% dodge`);
  if ("defense" in d) p.push(`${sgn(d.defense)} defense`);
  return p.join(", ");
}
// One-line summary of what a consumable does.
function describeUsable(n) {
  const d = USABLE_ITEMS[n],
    p = [];
  if ("heal" in d) p.push(d.heal >= 999 ? "fully restores HP" : `heals ${d.heal} HP`);
  if ("energy" in d) p.push(`restores ${d.energy} energy`);
  if (d.cure) p.push("cures poison, burn, bleed and other ailments");
  if ("buff_damage" in d) p.push(`+${d.buff_damage} damage for this fight`);
  if ("buff_defense" in d) p.push(`+${d.buff_defense} defense for this fight`);
  if ("buff_dodge" in d) p.push(`+${d.buff_dodge}% dodge for this fight`);
  if ("buff_crit" in d) p.push(`+${d.buff_crit}% crit for this fight`);
  if ("buff_fire_resistance" in d) p.push(`-${d.buff_fire_resistance}% fire damage for this fight`);
  if ("buff_frost_resistance" in d)
    p.push(`-${d.buff_frost_resistance}% frost damage for this fight`);
  if (d.revive) p.push("can save you from defeat");
  if ("damage" in d) p.push(`deals ${d.damage}${d.element ? ` ${d.element}` : ""} damage to the enemy`);
  if (d.stun) p.push("stuns the enemy so it loses its turn");
  if (d.effect) p.push(`may inflict ${d.effect.type} for ${d.effect.turns} turns`);
  if (d.self) p.push(`grants ${d.self.type} for ${d.self.turns} turns`);
  return p.join(", ");
}
// One-line summary of a weapon skill's numbers.
function describeSkill(s) {
  const p = [],
    h = s.hits || 1,
    m = int((s.damage_mult ?? 1.0) * 100);
  p.push(h > 1 ? `${h}x ${m}% dmg` : `${m}% dmg`);
  if ((s.type || "normal") !== "normal") p.push(s.type);
  if (s.hit_bonus) p.push(`${sgn(s.hit_bonus)}% hit`);
  if (s.crit_bonus) p.push(`${sgn(s.crit_bonus)}% crit`);
  [
    ["ignore_guard", "ignores guard"],
    ["ignore_parry", "can't be parried"],
    ["ignore_dodge", "can't be dodged"],
  ].forEach(([k, l]) => {
    if (s[k]) p.push(l);
  });
  if (s.lifesteal) p.push(`heals ${int(s.lifesteal * 100)}% of damage`);
  if (s.recoil) p.push(`${s.recoil} recoil`);
  if (s.stagger) p.push(`${s.stagger}% stagger`);
  if (s.energy_gain) p.push(`+${s.energy_gain} energy`);
  if (s.effect) p.push(`${s.effect.chance}% ${s.effect.type}`);
  if (s.cooldown) p.push(`${s.cooldown}-turn cooldown`);
  return p.join(", ");
}
