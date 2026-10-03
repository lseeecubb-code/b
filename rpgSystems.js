// New RPG systems: stats, perks, magic, companions, quests, towns, events,
// gear upgrades/rarity, achievements, New Game+, settings, and combat helpers.
// Loaded after combat/story/saves so it can extend them without replacing them.

const SETTINGS_KEY = "the-last-save.settings";
const ACHIEVE_KEY = "the-last-save.achievements";
const SLOT_KEY = (n) => `the-last-save.slot.${n}`;
const COMPLETED_KEY = "the-last-save.completed";
const SAVE_SLOTS = 3;

const STAT_INFO = [
  ["str", "Strength", "Physical damage"],
  ["agi", "Agility", "Dodge chance and parry timing"],
  ["vit", "Vitality", "Maximum HP"],
  ["foc", "Focus", "Maximum energy and spell power"],
];

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_BONUS = {
  common: { damage: 0, max_hp: 0, crit: 0, dodge: 0 },
  uncommon: { damage: 1, max_hp: 4, crit: 0, dodge: 0 },
  rare: { damage: 2, max_hp: 8, crit: 2, dodge: 0 },
  epic: { damage: 3, max_hp: 12, crit: 3, dodge: 2 },
  legendary: { damage: 5, max_hp: 20, crit: 5, dodge: 4 },
};

const PERKS = {
  "iron thews": {
    tree: "Warrior",
    req: [],
    desc: "+10% physical damage.",
  },
  "iron wall": {
    tree: "Warrior",
    req: ["iron thews"],
    desc: "Guard blocks 8% more damage.",
  },
  "iron blood": {
    tree: "Warrior",
    req: ["iron wall"],
    desc: "+18 maximum HP.",
  },
  "iron counter": {
    tree: "Warrior",
    req: ["iron blood"],
    desc: "Successful parries deal a small counter. Perfect parries hit harder.",
  },
  "shade step": {
    tree: "Rogue",
    req: [],
    desc: "+8% dodge.",
  },
  "killing edge": {
    tree: "Rogue",
    req: ["shade step"],
    desc: "+8% critical chance.",
  },
  "blade work": {
    tree: "Rogue",
    req: ["killing edge"],
    desc: "+8% parry chance.",
  },
  venomous: {
    tree: "Rogue",
    req: ["blade work"],
    desc: "Bleed and poison hit harder and apply more often.",
  },
  "elemental attunement": {
    tree: "Mage",
    req: [],
    desc: "+12% elemental (spell) damage.",
  },
  "efficient mind": {
    tree: "Mage",
    req: ["elemental attunement"],
    desc: "Spells cost 1 less energy (minimum 1).",
  },
  "arcane surge": {
    tree: "Mage",
    req: ["efficient mind"],
    desc: "+15% elemental damage and +1 maximum energy.",
  },
  "lingering hex": {
    tree: "Mage",
    req: ["arcane surge"],
    desc: "Status effects from you apply more often and last +1 turn.",
  },
};

const SPELLS = {
  "ember spark": {
    desc: "A small fire bolt. May burn.",
    cost: 2,
    cooldown: 0,
    element: "fire",
    damage: [10, 16],
    effect: { type: "burn", chance: 45, damage: 3, turns: 3 },
  },
  frostbite: {
    desc: "A shard of cold. May slow.",
    cost: 2,
    cooldown: 1,
    element: "frost",
    damage: [9, 15],
    effect: { type: "slow", chance: 55, damage: 0, turns: 2 },
  },
  mend: {
    desc: "Restore your HP using energy.",
    cost: 3,
    cooldown: 1,
    heal: [18, 28],
  },
  ward: {
    desc: "A brief shield that absorbs incoming hits.",
    cost: 2,
    cooldown: 2,
    self: { type: "shield", absorb: 18, turns: 3 },
  },
  "storm lash": {
    desc: "A heavier elemental strike. May weaken.",
    cost: 4,
    cooldown: 2,
    element: "fire",
    damage: [18, 28],
    effect: { type: "weakened", chance: 40, damage: 0, turns: 2 },
  },
  restore: {
    desc: "Cleanse poison, burn and bleed.",
    cost: 2,
    cooldown: 2,
    cure: true,
  },
  "sun lance": {
    desc: "A focused fire ray that can leave its target burning.",
    cost: 3,
    cooldown: 1,
    element: "fire",
    damage: [17, 25],
    effect: { type: "burn", chance: 55, damage: 4, turns: 2 },
  },
  "rime barrier": {
    desc: "Wrap yourself in frost-hard protection for several turns.",
    cost: 3,
    cooldown: 2,
    self: { type: "fortified", turns: 3 },
  },
  "verdant pulse": {
    desc: "Restore health and clear poison from your body.",
    cost: 4,
    cooldown: 2,
    heal: [34, 46],
    cure: true,
  },
  "static bind": {
    desc: "A crackling bolt that may weaken and slow the enemy.",
    cost: 4,
    cooldown: 2,
    element: "lightning",
    damage: [20, 29],
    effect: { type: "weakened", chance: 50, damage: 0, turns: 2 },
  },
  "last stand": {
    desc: "Brace for danger and sharpen your next attacks.",
    cost: 3,
    cooldown: 3,
    self: { type: "empowered", turns: 2 },
  },
};

const COMPANION_DEFS = {
  mira: {
    name: "Mira",
    role: "support",
    personality: "She writes while she fights, and never looks surprised.",
    joinChapter: 0,
    joinText:
      'Mira closes her journal. "If the road is going to keep changing, I should walk it with you."',
    leaveText: "Mira stays behind to copy a page that will not sit still.",
    baseHp: 55,
    damage: [5, 9],
    ai: "healer",
  },
  kael: {
    name: "Kael",
    role: "tank",
    personality: "A quiet bell-warden who would rather be hit than let you be hit.",
    joinChapter: 2,
    joinText:
      'Kael rests his shield. "The bells called something. Until they stop, I stand with you."',
    leaveText: "Kael remains at the cathedral door.",
    baseHp: 80,
    damage: [6, 10],
    ai: "tank",
  },
  nyx: {
    name: "Nyx",
    role: "striker",
    personality: "A Null Expanse scout who treats silence as a weapon.",
    joinChapter: 3,
    joinText: 'Nyx appears from a missing patch of road. "You notice deletions. So do I."',
    leaveText: "Nyx slips back into a blank space.",
    baseHp: 48,
    damage: [8, 13],
    ai: "dps",
  },
};

const SIDE_QUESTS = {
  vermin: {
    name: "Vermin on the Road",
    giver: "Innkeeper",
    desc: "Clear rats from the cellars of Wayrest.",
    type: "kills",
    target: "rat",
    need: 5,
    reward: { xp: 40, coin: 40, potion: 2 },
    chapterMin: 0,
  },
  scrap: {
    name: "Scrap for the Forge",
    giver: "Blacksmith",
    desc: "Bring 8 iron to the Wayrest forge.",
    type: "collect",
    target: "iron",
    need: 8,
    reward: { xp: 50, coin: 30, steel: 1 },
    chapterMin: 0,
  },
  parcel: {
    name: "Mira's Parcel",
    giver: "Mira",
    desc: "Deliver Mira's spare journal to the Frontier Camp merchant.",
    type: "deliver",
    item: "mira's parcel",
    reward: { xp: 60, coin: 50, crystal: 1 },
    chapterMin: 1,
  },
  warlord: {
    name: "The Warlord's Shadow",
    giver: "Bellkeeper",
    desc: "Defeat the Orc Warlord if you can find him.",
    type: "kills",
    target: "orc warlord",
    need: 1,
    reward: { xp: 200, coin: 120, "orc armor": 1 },
    chapterMin: 2,
  },
  cache: {
    name: "The Hidden Line",
    giver: "Travelling merchant",
    desc: "Find a cache the world forgot to render.",
    type: "flag",
    flag: "found_hidden_cache",
    reward: { xp: 80, coin: 70, "void crystal": 1 },
    chapterMin: 1,
  },
  trial: {
    name: "Ash Trial",
    giver: "Trainer",
    desc: "Win the trainer's trial bout (a special challenge fight).",
    type: "flag",
    flag: "ash_trial",
    reward: { xp: 100, coin: 80, "energy potion": 1 },
    chapterMin: 2,
  },
};
Object.assign(SIDE_QUESTS, {
  jackal_pelts: {
    name: "Tracks in the Dust", giver: "Innkeeper",
    desc: "Thin the dust jackals prowling the Quiet Road.", type: "kills", target: "dust jackal", need: 3,
    reward: { xp: 55, coin: 45, "moon herb": 2 }, chapterMin: 0,
  },
  quiet_arrows: {
    name: "No Safe Pass", giver: "Frontier scout",
    desc: "Drive the frontier marksmen from the broken road.", type: "kills", target: "frontier marksman", need: 2,
    reward: { xp: 105, coin: 85, "clockwork spring": 2 }, chapterMin: 1,
  },
  bell_silence: {
    name: "Silence the Second Bell", giver: "Bellkeeper",
    desc: "Defeat three bellbound acolytes before their rites spread.", type: "kills", target: "bellbound acolyte", need: 3,
    reward: { xp: 180, coin: 120, "black salt": 3 }, chapterMin: 2,
  },
  missing_energy: {
    name: "A Hunger in the Null", giver: "Nyx",
    desc: "Hunt the null leeches feeding on the Expanse's energy.", type: "kills", target: "null leech", need: 2,
    reward: { xp: 260, coin: 160, "void crystal": 2 }, chapterMin: 3,
  },
  overdue_books: {
    name: "Overdue by Several Lifetimes", giver: "Archivist",
    desc: "Recover one soul shard from a footnote mimic in the Archive.", type: "collect", target: "soul shard", need: 1,
    reward: { xp: 420, coin: 240, "ancient crystal": 2 }, chapterMin: 6,
  },
});

const TOWNS = {
  wayrest: {
    name: "Wayrest",
    chapter: 0,
    blurb: "A small inn and forge at the start of the Quiet Road.",
    npcs: ["innkeeper", "blacksmith", "merchant", "quest", "trainer"],
  },
  frontier: {
    name: "Frontier Camp",
    chapter: 1,
    blurb: "Canvas and coal smoke under a cracked sky.",
    npcs: ["innkeeper", "merchant", "quest"],
  },
  ashmarket: {
    name: "Ashmarket",
    chapter: 2,
    blurb: "Stalls in the cathedral courtyard. The bells still work. Nobody knows for whom.",
    npcs: ["innkeeper", "blacksmith", "merchant", "quest", "trainer"],
  },
  annex: {
    name: "Archive Annex",
    chapter: 6,
    blurb: "A reading room that sells things other lives left behind.",
    npcs: ["innkeeper", "merchant", "blacksmith", "quest"],
  },
};

const ACHIEVEMENTS = {
  first_blood: { name: "First Blood", desc: "Defeat your first enemy." },
  unnamed: { name: "A King Without a Name", desc: "Defeat the Unnamed King." },
  hunter: { name: "Hundredfold", desc: "Defeat 100 enemies in one save." },
  witness: { name: "Seen", desc: "Defeat The Witness (finish Chapter 5)." },
  last_save: { name: "The File Closes", desc: "Defeat The Last Save." },
  remember: { name: "Archivist's Ending", desc: "Choose Remember." },
  release: { name: "Quiet Ending", desc: "Choose Release." },
  rewrite: { name: "Version Two", desc: "Choose Rewrite." },
  empty_pockets: { name: "Empty Pockets", desc: "Finish the game without using a combat item." },
  hidden: { name: "Unrendered", desc: "Find the hidden cache." },
  party: { name: "Not Alone", desc: "Recruit every companion." },
  dedicated: { name: "Specialist", desc: "Unlock a full perk tree." },
  wealthy: { name: "Heavy Purse", desc: "Hold 1000 coin at once." },
  ng: { name: "Again", desc: "Start New Game+." },
  field_notes: { name: "Field Notes", desc: "Defeat all five newly discovered regional creatures." },
  supply_scout: { name: "Supply Scout", desc: "Find moon herb, black salt, and a clockwork spring." },
  maker: { name: "Made by Hand", desc: "Craft every new formula added in this content update." },
};

const DOT_TYPES = new Set(["poison", "burn", "bleed"]);
const AILMENTS = new Set(["poison", "burn", "bleed", "slow", "weakened"]);

const SPELL_UNLOCKS = [
  [1, ["ember spark", "mend"]],
  [3, ["frostbite"]],
  [4, ["restore"]],
  [5, ["ward"]],
  [7, ["storm lash"]],
  [2, ["sun lance"]],
  [6, ["rime barrier"]],
  [9, ["verdant pulse"]],
  [11, ["static bind", "last stand"]],
];

function defaultSettings() {
  return {
    difficulty: "normal",
    combatLog: true,
    textColor: "default",
    sound: true,
  };
}

let SETTINGS = defaultSettings();
let META = { achievements: {} };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) SETTINGS = { ...defaultSettings(), ...JSON.parse(raw) };
  } catch (e) {}
  applyTextColor();
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
  } catch (e) {}
  applyTextColor();
}

function loadMetaAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVE_KEY);
    if (raw) META.achievements = { ...META.achievements, ...JSON.parse(raw) };
  } catch (e) {}
}

function saveMetaAchievements() {
  try {
    localStorage.setItem(ACHIEVE_KEY, JSON.stringify(META.achievements || {}));
  } catch (e) {}
}

function applyTextColor() {
  if (typeof document === "undefined" || !document.body) return;
  const map = { default: "", amber: "theme-amber", green: "theme-green", high: "theme-high" };
  document.body.classList.remove("theme-amber", "theme-green", "theme-high");
  const c = map[SETTINGS.textColor];
  if (c) document.body.classList.add(c);
}

function hasPerk(id) {
  return !!(PLAYER && PLAYER.perks && PLAYER.perks.includes(id));
}

function unlockSpellsForLevel(quiet = false) {
  PLAYER.spells = Array.isArray(PLAYER.spells) ? PLAYER.spells : ["ember spark", "mend"];
  for (const [lv, names] of SPELL_UNLOCKS) {
    if (PLAYER.level < lv) continue;
    for (const n of names) {
      if (PLAYER.spells.includes(n) || !SPELLS[n]) continue;
      PLAYER.spells.push(n);
      if (!quiet) print(`🔓 You learned ${title(n)} (${SPELLS[n].desc})`);
    }
  }
}

function maxEnergy() {
  let m = C.MAX_ENERGY + Math.floor(Math.max(0, (PLAYER.foc || 5) - 5) / 4);
  if (hasPerk("arcane surge")) m += 1;
  return m;
}

function spellCost(sp) {
  let c = sp.cost;
  if (hasPerk("efficient mind")) c = Math.max(1, c - 1);
  return c;
}

function spellPower() {
  let p = 1 + Math.max(0, (PLAYER.foc || 5) - 5) * 0.03;
  if (hasPerk("elemental attunement")) p += 0.12;
  if (hasPerk("arcane surge")) p += 0.15;
  return p;
}

function difficultyMods() {
  const d = SETTINGS.difficulty || "normal";
  const table = {
    easy: { hp: 0.88, dmg: 0.88, xp: 0.9, loot: 1 },
    normal: { hp: 1, dmg: 1, xp: 1, loot: 1 },
    hard: { hp: 1.16, dmg: 1.14, xp: 1.08, loot: 1.05 },
  };
  const m = { ...(table[d] || table.normal) };
  const ng = PLAYER.ngPlus || 0;
  if (ng > 0) {
    m.hp *= 1 + 0.12 * ng;
    m.dmg *= 1 + 0.1 * ng;
    m.xp *= 1 + 0.05 * ng;
  }
  return m;
}

function scaleRange(arr, mult) {
  if (!arr || arr.length < 2) return arr;
  return [Math.max(1, int(arr[0] * mult)), Math.max(1, int(arr[1] * mult))];
}

function scaledMonster(name) {
  const src = monsters[name];
  const m = JSON.parse(JSON.stringify(src));
  const d = difficultyMods();
  m.hp = Math.max(1, int(m.hp * d.hp));
  if (m.basic_attack?.damage) m.basic_attack.damage = scaleRange(m.basic_attack.damage, d.dmg);
  for (const a of Object.values(m.abilities || {})) {
    if (a.damage) a.damage = scaleRange(a.damage, d.dmg);
    if (a.heal) a.heal = scaleRange(a.heal, d.dmg);
  }
  for (const form of m.phases || []) {
    form.hp = Math.max(1, int(form.hp * d.hp));
    if (form.basic_attack?.damage) form.basic_attack.damage = scaleRange(form.basic_attack.damage, d.dmg);
    for (const a of Object.values(form.abilities || {})) {
      if (a.damage) a.damage = scaleRange(a.damage, d.dmg);
      if (a.heal) a.heal = scaleRange(a.heal, d.dmg);
    }
  }
  m._xpMult = d.xp;
  return m;
}

function rollRarity(bonus = 0) {
  const r = Math.random() * 100 - bonus;
  if (r < 1) return "legendary";
  if (r < 5) return "epic";
  if (r < 15) return "rare";
  if (r < 40) return "uncommon";
  return "common";
}

function ensureRarity(item, bonus = 0) {
  if (!ITEMS[item]) return;
  if (!WORLD.rarity[item]) WORLD.rarity[item] = rollRarity(bonus);
}

function gearUpgrade(item) {
  return WORLD.upgrades[item] || 0;
}

function clog(f, msg) {
  if (typeof SETTINGS !== "undefined" && SETTINGS.combatLog === false) return;
  if (!f || !msg) return;
  if (!f.log) f.log = [];
  f.log.push(msg);
  if (f.log.length > 80) f.log.shift();
}

function showCombatLog(f) {
  print("\n📜");
  const lines = (f.log || []).slice(-16);
  if (!lines.length) print("No combat events have been recorded yet.");
  else lines.forEach((l) => print("  " + l));
}

function livingEnemies(f) {
  return (f.enemies || []).filter((e) => e.hp > 0);
}

function foesDown(f) {
  return !livingEnemies(f).length;
}

function attachEnemyAccessors(f) {
  const cur = () => {
    if (!f.enemies[f.target] || f.enemies[f.target].hp <= 0) {
      const i = f.enemies.findIndex((e) => e.hp > 0);
      if (i >= 0) f.target = i;
    }
    return f.enemies[f.target] || f.enemies[0];
  };
  const def = (key, field) =>
    Object.defineProperty(f, key, {
      configurable: true,
      enumerable: true,
      get() {
        return cur()[field];
      },
      set(v) {
        cur()[field] = v;
      },
    });
  def("name", "displayName");
  def("monster", "monster");
  def("monster_hp", "hp");
  def("monster_effects", "effects");
  def("guarding", "guarding");
  def("stance", "stance");
  def("stun_turns", "stun_turns");
  def("stun_immune", "stun_immune");
  def("staggered", "staggered");
  def("last_move", "last_move");
  def("intent", "intent");
  def("phase", "phase");
}

function makeEnemyState(name, elite = false) {
  const canonicalName = String(name).replace(/^elite /, "");
  const m = scaledMonster(canonicalName);
  if (elite) {
    m.hp = int(m.hp * 1.35);
    m.icon = m.icon || "👹";
    if (m.basic_attack?.damage) m.basic_attack.damage = scaleRange(m.basic_attack.damage, 1.15);
  }
  const forms = Array.isArray(m.phases) ? m.phases : [];
  const activeForm = forms.length ? { ...m, ...forms[0], phases: undefined } : m;
  const totalBossHp = forms.length ? forms.reduce((sum, form) => sum + form.hp, 0) : m.hp;
  return {
    name: elite ? `elite ${canonicalName}` : canonicalName,
    displayName: activeForm.name || (elite ? `elite ${canonicalName}` : canonicalName),
    monster: activeForm,
    phases: forms,
    totalBossHp,
    hp: activeForm.hp,
    effects: [],
    guarding: false,
    stance: null,
    stun_turns: 0,
    stun_immune: 0,
    staggered: false,
    last_move: null,
    intent: null,
    phase: 0,
    elite: !!elite,
  };
}

function effectMods(list) {
  const m = {
    damage: 1,
    taken: 1,
    dodge: 0,
    parry: 0,
    accuracy: 0,
    absorb: 0,
    elemResist: 0,
  };
  for (const e of list || []) {
    if (e.type === "weakened") m.damage -= 0.2;
    if (e.type === "empowered") m.damage += 0.2;
    if (e.type === "slow") {
      m.dodge -= 12;
      m.parry -= 8;
      m.accuracy -= 10;
    }
    if (e.type === "fortified") m.taken -= 0.15;
    if (e.type === "shield") m.absorb += e.absorb || e.damage || 12;
    if (e.type === "warded") m.elemResist += 25;
    if (e.type === "exposed") m.taken += 0.35;
  }
  m.damage = Math.max(0.5, m.damage);
  m.taken = Math.max(0.5, Math.min(2, m.taken));
  return m;
}

function tickNonDot(list, ownerLabel) {
  for (const e of [...(list || [])]) {
    if (DOT_TYPES.has(e.type)) continue;
    e.turns--;
    if (e.turns <= 0) {
      list.splice(list.indexOf(e), 1);
      print(`   ${ownerLabel}'s ${e.type} fades.`);
    }
  }
}

function unlockAchievement(id, quiet = false) {
  if (!ACHIEVEMENTS[id]) return;
  if (META.achievements[id]) return;
  META.achievements[id] = { at: Date.now() };
  saveMetaAchievements();
  if (!quiet) {
    print(`\n🏆 Achievement unlocked: ${ACHIEVEMENTS[id].name}`);
    print(`   ${ACHIEVEMENTS[id].desc}`);
  }
}

function checkAchievements() {
  const kills = WORLD.totalKills || 0;
  if (kills >= 1) unlockAchievement("first_blood");
  if (kills >= 100) unlockAchievement("hunter");
  if (killCount("the unnamed king") > 0) unlockAchievement("unnamed");
  if (killCount("the witness") > 0) unlockAchievement("witness");
  if (killCount("the last save") > 0) unlockAchievement("last_save");
  if (STORY.ending === "remember") unlockAchievement("remember");
  if (STORY.ending === "release") unlockAchievement("release");
  if (STORY.ending === "rewrite") unlockAchievement("rewrite");
  if (STORY.flags.has("ending_complete") && !WORLD.usedCombatItem)
    unlockAchievement("empty_pockets");
  if (WORLD.flags.found_hidden_cache) unlockAchievement("hidden");
  if ((WORLD.companions.recruited || []).length >= 3) unlockAchievement("party");
  const trees = {};
  (PLAYER.perks || []).forEach((p) => {
    const t = PERKS[p]?.tree;
    if (t) trees[t] = (trees[t] || 0) + 1;
  });
  if (Object.values(trees).some((n) => n >= 4)) unlockAchievement("dedicated");
  if ((inventory.coin || 0) >= 1000) unlockAchievement("wealthy");
  if ((PLAYER.ngPlus || 0) > 0) unlockAchievement("ng");
  if (["dust jackal", "frontier marksman", "bellbound acolyte", "null leech", "footnote mimic"].every((n) => killCount(n) > 0)) unlockAchievement("field_notes");
  if (["moon herb", "black salt", "clockwork spring"].every((n) => (WORLD.recipeMaterialsSeen || []).includes(n))) unlockAchievement("supply_scout");
  if (["moonlit poultice", "salt ward", "clockwork charge", "sunfire bomb", "trailbreaker bow", "bellguard", "nullweave coat", "archivist's ring", "margin seal", "last line tonic"].every((n) => (WORLD.recipesCrafted || []).includes(n))) unlockAchievement("maker");
}

function recruitCompanion(id, announce = true) {
  const d = COMPANION_DEFS[id];
  if (!d) return;
  if (WORLD.companions.recruited.includes(id)) return;
  WORLD.companions.recruited.push(id);
  if (WORLD.companions.active.length < 1) WORLD.companions.active.push(id);
  WORLD.companions.hp[id] = companionMaxHp(id);
  if (announce) {
    print(`\n🤝 ${d.name} joins you. (${d.role})`);
    print(`   ${d.joinText}`);
  }
  checkAchievements();
}

function companionMaxHp(id) {
  const d = COMPANION_DEFS[id];
  return d.baseHp + (PLAYER.level - 1) * 4;
}

function companionDamage(id) {
  const d = COMPANION_DEFS[id];
  const b = Math.floor((PLAYER.level - 1) / 3);
  return [d.damage[0] + b, d.damage[1] + b];
}

function maybeRecruitFromStory() {
  const recruited = WORLD.companions.recruited || [];
  if (STORY.chapter >= 0 && STORY.seen.has("chapter_0_intro") && !recruited.includes("mira")) recruitCompanion("mira");
  if (STORY.chapter >= 2 && !recruited.includes("kael")) recruitCompanion("kael");
  if (STORY.chapter >= 3 && !recruited.includes("nyx")) recruitCompanion("nyx");
}

function questState(id) {
  return WORLD.quests[id] || { status: "locked", progress: 0 };
}

function offerQuest(id) {
  const q = SIDE_QUESTS[id];
  if (!q) return;
  const st = questState(id);
  if (st.status === "done" || st.status === "active") return false;
  if (STORY.chapter < q.chapterMin) return false;
  WORLD.quests[id] = { status: "active", progress: 0 };
  if (q.type === "deliver" && q.item) addItem(q.item, 1, true);
  print(`\n📜 QUEST ACCEPTED: ${q.name}`);
  print(`   ${q.desc}`);
  return true;
}

function noteQuestKill(name) {
  for (const [id, q] of Object.entries(SIDE_QUESTS)) {
    const st = questState(id);
    if (st.status !== "active" || q.type !== "kills") continue;
    if (name === q.target || name === `elite ${q.target}`) {
      st.progress = (st.progress || 0) + 1;
      WORLD.quests[id] = st;
      print(`   Quest progress (${q.name}): ${Math.min(st.progress, q.need)}/${q.need}`);
    }
  }
}

function noteQuestCollect() {
  for (const [id, q] of Object.entries(SIDE_QUESTS)) {
    const st = questState(id);
    if (st.status !== "active" || q.type !== "collect") continue;
    st.progress = inventory[q.target] || 0;
    WORLD.quests[id] = st;
  }
}

function completeQuest(id) {
  const q = SIDE_QUESTS[id];
  const st = questState(id);
  if (!q || st.status === "done") return;
  WORLD.quests[id] = { status: "done", progress: q.need || 1 };
  print(`\n🎉 SIDE QUEST COMPLETE: ${q.name}`);
  for (const [k, a] of Object.entries(q.reward)) {
    if (k === "xp") {
      print(`   +${a} XP`);
      grantXp(a);
    } else {
      print(`   +${a} ${k}`);
      addItem(k, a, true);
      if (ITEMS[k]) ensureRarity(k, 10);
    }
  }
}

function tryTurnInQuests() {
  for (const [id, q] of Object.entries(SIDE_QUESTS)) {
    const st = questState(id);
    if (st.status !== "active") continue;
    if (q.type === "kills" && (st.progress || 0) >= q.need) completeQuest(id);
    if (q.type === "collect" && (inventory[q.target] || 0) >= q.need) {
      removeItem(q.target, q.need, true);
      completeQuest(id);
    }
    if (q.type === "deliver" && (inventory[q.item] || 0) > 0) {
      removeItem(q.item, 1, true);
      completeQuest(id);
    }
    if (q.type === "flag" && WORLD.flags[q.flag]) completeQuest(id);
  }
}

function currentTownId() {
  const ch = STORY.chapter;
  if (ch >= 6) return "annex";
  if (ch >= 2) return "ashmarket";
  if (ch >= 1) return "frontier";
  return "wayrest";
}

async function allocateStats() {
  print("\n📊");
  print("Each point is a permanent bonus. Every attribute caps at 25.");
  while ((PLAYER.statPoints || 0) > 0) {
    print(`\n✨ Points to spend: ${PLAYER.statPoints}`);
    for (const [k, n, d] of STAT_INFO) print(`  ${n} ${PLAYER[k]}/25 — ${d}`);
    print("  0. Finish training");
    const raw = (await input("Choose Strength, Agility, Vitality, Focus, or 0: ")).trim().toLowerCase();
    if (["0", "done", "back", ""].includes(raw)) break;
    const key = { strength: "str", agility: "agi", vitality: "vit", focus: "foc", s: "str", a: "agi", v: "vit", f: "foc" }[raw] || raw;
    if (!["str", "agi", "vit", "foc"].includes(key)) {
      print("Choose STR, AGI, VIT, FOC, or 0 to finish.");
      continue;
    }
    if (PLAYER[key] >= 25) {
      print("🏁 That attribute has reached its maximum.");
      continue;
    }
    PLAYER[key]++;
    PLAYER.statPoints--;
    print(`  ✅ ${STAT_INFO.find(([id]) => id === key)[1]} increased to ${PLAYER[key]}.`);
  }
  showAttributeSummary();
}

function showAttributeSummary() {
  const s = getStats();
  print("\n📈");
  print(`  Strength ${PLAYER.str}  →  +${Math.floor(Math.max(0, PLAYER.str - 5) / 2)} physical damage`);
  print(`  Agility  ${PLAYER.agi}  →  +${Math.floor(Math.max(0, PLAYER.agi - 5) / 2)}% dodge/parry`);
  print(`  Vitality ${PLAYER.vit}  →  +${Math.max(0, PLAYER.vit - 5) * 3} max HP`);
  print(`  Focus    ${PLAYER.foc}  →  max energy ${maxEnergy()}, spell power ${int(spellPower() * 100)}%`);
  print(`  ❤️ Maximum HP: ${s.max_hp}  ·  ⚔️ Physical damage bonus: ${s.damage}`);
}

async function maybePromptLevelUp() {
  if ((PLAYER.statPoints || 0) > 0) {
    print(`\n⭐ You have ${PLAYER.statPoints} unspent stat point(s).`);
    const c = (await input("Allocate them now? (y/n): ")).trim().toLowerCase();
    if (c === "y" || c === "yes") await allocateStats();
    else print("Type 'allocate' later. Type 'perks' if you have skill points.");
  }
  if ((PLAYER.skillPoints || 0) > 0) {
    print(`⭐ You have ${PLAYER.skillPoints} unspent perk point(s). Type 'perks' to spend them.`);
  }
}

function perkReady(id) {
  const p = PERKS[id];
  return p.req.every((r) => hasPerk(r));
}

async function showPerks() {
  print("\n🌿");
  print(`✨ Perk points available: ${PLAYER.skillPoints || 0}`);
  const trees = ["Warrior", "Rogue", "Mage"];
  for (const t of trees) {
    print(`\n${({ Warrior: "⚔️", Rogue: "🗡️", Mage: "🔮" })[t]}`);
    Object.entries(PERKS)
      .filter(([, p]) => p.tree === t)
      .forEach(([id, p]) => {
        const got = hasPerk(id) ? "✓" : perkReady(id) ? "·" : "🔒";
        print(`  ${got} ${title(id)} — ${p.desc}${p.req.length ? ` (needs ${p.req.join(", ")})` : ""}`);
      });
  }
  if (!(PLAYER.skillPoints > 0)) return;
  const raw = (await input("\nWhich available perk will you learn? (name, or blank to leave): ")).trim().toLowerCase();
  if (!raw) return;
  const id = Object.keys(PERKS).find((k) => k === raw || k.includes(raw));
  if (!id) {
    print("🔎 No perk matches that name.");
    return;
  }
  if (hasPerk(id)) {
    print("✅ You have already learned that perk.");
    return;
  }
  if (!perkReady(id)) {
    print(`🔒 Prerequisite needed: ${PERKS[id].req.filter((r) => !hasPerk(r)).join(", ")}`);
    return;
  }
  if ((PLAYER.skillPoints || 0) < 1) {
    print("✨ You need a perk point before you can learn this.");
    return;
  }
  PLAYER.perks.push(id);
  PLAYER.skillPoints--;
  print(`🌟 Perk learned: ${title(id)}.`);
  checkAchievements();
}

function knownSpells() {
  return (PLAYER.spells || []).filter((n) => SPELLS[n]);
}

function showMagic() {
  print("\n🔮");
  const ks = knownSpells();
  if (!ks.length) {
    print("Your spellbook is empty. Visit a town trainer to learn a spell.");
    return;
  }
  ks.forEach((n) => {
    const s = SPELLS[n];
    print(`- ${title(n)} (${spellCost(s)} energy${s.cooldown ? `, ${s.cooldown} cd` : ""}): ${s.desc}`);
  });
  print("⚡ In battle, choose action 10 to cast a spell.");
}

async function chooseSpell(f) {
  const ks = knownSpells();
  if (!ks.length) {
    print("You know no spells. A trainer in town can teach you.");
    return null;
  }
  print("\n✨");
  ks.forEach((n, i) => {
    const s = SPELLS[n];
    const cd = f.cooldowns["spell:" + n] || 0;
    const need = spellCost(s);
    const wait = f.energy < need ? `needs ${need} energy` : cd ? `cooldown ${cd}` : null;
    print(`${i + 1}. ${title(n)} (${need} energy) - ${s.desc}` + (wait ? `  [${wait}]` : ""));
  });
  print("0. Back");
  while (true) {
    const raw = (await input("Cast which spell? ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return null;
    const n =
      isDigit(raw) && +raw >= 1 && +raw <= ks.length
        ? ks[+raw - 1]
        : ks.find((x) => x === raw || x.includes(raw));
    if (!n) {
      print("Choose a spell by number or name.");
      continue;
    }
    const s = SPELLS[n];
    if (f.energy < spellCost(s)) {
      print("⚡ You don't have enough energy for that spell.");
      continue;
    }
    if (f.cooldowns["spell:" + n]) {
      print("⏳ That spell needs another turn before you can cast it again.");
      continue;
    }
    return n;
  }
}

function applyStatus(list, e, label) {
  if (!e || !e.type) return list;
  list = list || [];
  let chance = e.chance ?? 100;
  if (e.type !== "exposed" && hasPerk("lingering hex") && label !== "You") chance += 15;
  if (hasPerk("venomous") && (e.type === "bleed" || e.type === "poison")) chance += 15;
  if (!percent(chance)) return list;
  const turns = e.type === "exposed" ? 1 : (e.turns || 2) + (hasPerk("lingering hex") && label !== "You" ? 1 : 0);
  let dmg = e.damage || 0;
  if (DOT_TYPES.has(e.type) && hasPerk("venomous") && (e.type === "bleed" || e.type === "poison"))
    dmg = int(dmg * 1.25);
  list = list.filter((x) => x.type !== e.type);
  const row = { type: e.type, damage: dmg, turns, absorb: e.absorb || 0, element: e.element };
  list.push(row);
  const [i, w] = EFFECT_STYLE[e.type] || ["✨", e.type];
  print(label === "You"
    ? `   ${i} You are ${w} for ${turns} turns.`
    : `   ${i} ${label} is ${w} for ${turns} turns.`);
  return list;
}

function useSpell(f, name) {
  const s = SPELLS[name];
  const cost = spellCost(s);
  f.energy -= cost;
  if (s.cooldown) f.cooldowns["spell:" + name] = s.cooldown + 1;
  print(`✨ You cast ${name.toUpperCase()}! ${s.desc}`);
  clog(f, `You cast ${name}`);
  if (s.heal) {
    const h = int(randint(...s.heal) * spellPower());
    const b = f.player_hp;
    f.player_hp = Math.min(f.player_max_hp, f.player_hp + h);
    print(`   💚 You recover ${f.player_hp - b} HP.`);
    clog(f, `Mend heals ${f.player_hp - b}`);
  }
  if (s.cure) {
    const before = f.effects.length;
    f.effects = f.effects.filter((e) => !AILMENTS.has(e.type));
    const gone = before - f.effects.length;
    print(gone ? "   ✨ Ailments fade." : "   Nothing to cleanse.");
    if (gone) clog(f, "cleansed ailments");
  }
  if (s.self) {
    f.effects = applyStatus(f.effects, { ...s.self, chance: 100 }, "You");
  }
  if (s.damage) {
    let dmg = int(randint(...s.damage) * spellPower());
    const res = (f.monster.resist || {})[s.element] || 0;
    if (res) {
      dmg = Math.max(1, int(dmg * (1 - res / 100)));
      print(`   The ${f.name} resists ${s.element} (${res}%).`);
    }
    const weak = (f.monster.weak || {})[s.element] || 0;
    if (weak) {
      dmg = int(dmg * (1 + weak / 100));
      print(`   The ${f.name} is weak to ${s.element}!`);
    }
    dmg = Math.max(1, dmg);
    f.monster_hp -= dmg;
    print(`   💥 ${title(name)} deals ${dmg} ${s.element || ""} damage.`);
    clog(f, `${name} hits ${f.name} for ${dmg}`);
    if (s.effect && f.monster_hp > 0) {
      f.monster_effects = applyStatus(f.monster_effects, s.effect, `The ${f.name}`);
    }
  }
}

async function companionTurns(f) {
  for (const id of WORLD.companions.active || []) {
    if (foesDown(f) || f.player_hp <= 0) return;
    const d = COMPANION_DEFS[id];
    let hp = WORLD.companions.hp[id];
    if (hp == null) hp = companionMaxHp(id);
    if (hp <= 0) {
      print(`\n⚪ ${d.name} is down and cannot act.`);
      continue;
    }
    print("\n🔵");
    const tgt = livingEnemies(f)[0];
    if (!tgt) return;
    f.target = f.enemies.indexOf(tgt);
    if (d.ai === "healer" && f.player_hp < f.player_max_hp * 0.55) {
      const h = 12 + PLAYER.level;
      const b = f.player_hp;
      f.player_hp = Math.min(f.player_max_hp, f.player_hp + h);
      print(`${d.name} binds a page of light around you. You recover ${f.player_hp - b} HP.`);
      clog(f, `${d.name} heals you`);
    } else if (d.ai === "tank" && Math.random() < 0.35) {
      f.effects = applyStatus(f.effects, { type: "fortified", chance: 100, turns: 2, damage: 0 }, "You") || f.effects;
      print(`${d.name} raises a battered shield in front of you.`);
      clog(f, `${d.name} fortifies you`);
    } else {
      let dmg = randint(...companionDamage(id));
      if (tgt.staggered) dmg = int(dmg * (1 + C.STAGGER_BONUS));
      tgt.hp -= dmg;
      print(`${d.name} strikes the ${tgt.name} for ${dmg} damage.`);
      clog(f, `${d.name} hits ${tgt.name} for ${dmg}`);
      if (d.ai === "dps" && percent(35) && tgt.hp > 0) {
        tgt.effects = applyStatus(tgt.effects, { type: "bleed", chance: 100, damage: 2, turns: 2 }, `The ${tgt.name}`) || tgt.effects;
      }
    }
    WORLD.companions.hp[id] = hp;
  }
}

function hurtCompanions(f, amount) {
  const act = WORLD.companions.active || [];
  if (!act.length || amount <= 0) return amount;
  const tank = act.find((id) => COMPANION_DEFS[id]?.ai === "tank" && (WORLD.companions.hp[id] || 0) > 0);
  if (!tank) return amount;
  const share = Math.max(1, int(amount * 0.25));
  WORLD.companions.hp[tank] = Math.max(0, (WORLD.companions.hp[tank] || 0) - share);
  print(`   ${COMPANION_DEFS[tank].name} intercepts ${share} damage.`);
  if (WORLD.companions.hp[tank] <= 0) print(`   ${COMPANION_DEFS[tank].name} falls! (An inn can revive them.)`);
  return amount - share;
}

async function showParty() {
  print("\n🤝");
  const rec = WORLD.companions.recruited || [];
  if (!rec.length) {
    print("You travel alone for now. Story companions will join when the time is right.");
    return;
  }
  rec.forEach((id) => {
    const d = COMPANION_DEFS[id];
    const on = WORLD.companions.active.includes(id) ? " [active]" : "";
    const hp = WORLD.companions.hp[id] ?? companionMaxHp(id);
    print(`- ${d.name}${on} (${d.role})  HP ${Math.max(0, hp)}/${companionMaxHp(id)}`);
    print(`    ${d.personality}`);
  });
  print("\nUp to 1 companion fights beside you (keeps turns readable).");
  const raw = (await input("Set active companion (name, 'none', or blank): ")).trim().toLowerCase();
  if (!raw) return;
  if (raw === "none") {
    WORLD.companions.active = [];
    print("You will fight alone.");
    return;
  }
  const id = rec.find((x) => x === raw || COMPANION_DEFS[x].name.toLowerCase() === raw);
  if (!id) {
    print("They are not in your party.");
    return;
  }
  WORLD.companions.active = [id];
  print(`${COMPANION_DEFS[id].name} will fight beside you.`);
}

function showQuestLog() {
  print("\n📜");
  print("Main campaign objective: type 'story'.");
  const active = Object.entries(WORLD.quests || {}).filter(([, s]) => s.status === "active");
  const done = Object.entries(WORLD.quests || {}).filter(([, s]) => s.status === "done");
  print("\n🟡");
  if (!active.length) print("  No side quests active. Visit a town quest board to find work.");
  active.forEach(([id, s]) => {
    const q = SIDE_QUESTS[id];
    print(`  • ${q.name}`);
    print(`    ${q.desc}`);
    if (q.type === "kills" || q.type === "collect")
      print(`    Progress: ${Math.min(s.progress || 0, q.need)}/${q.need}`);
    print(`    Reward: ${Object.entries(q.reward).map(([k, a]) => `${a} ${k}`).join(", ")}`);
  });
  print("\n✅");
  if (!done.length) print("  No completed side quests yet.");
  done.forEach(([id]) => print(`  ✓ ${SIDE_QUESTS[id].name}`));
}

function showAchievements() {
  print("\n🏆");
  loadMetaAchievements();
  Object.entries(ACHIEVEMENTS).forEach(([id, a]) => {
    const got = META.achievements[id];
    print(`${got ? "✓" : "·"} ${a.name} — ${a.desc}`);
  });
}

async function showSettingsMenu() {
  loadSettings();
  print("\n⚙️");
  print(`1. 🎚️ Difficulty: ${SETTINGS.difficulty}`);
  print(`2. 📜 Combat log: ${SETTINGS.combatLog ? "on" : "off"}`);
  print(`3. 🎨 Text colour: ${SETTINGS.textColor}`);
  print("4. Sound: use the Sound button in the title bar");
  print("5. Text speed: use the Text button in the title bar");
  print("0. Back");
  const raw = (await input("Change which setting? ")).trim().toLowerCase();
  if (["0", "back", ""].includes(raw)) return;
  if (raw === "1" || raw === "difficulty") {
    const d = (await input("easy / normal / hard: ")).trim().toLowerCase();
    if (["easy", "normal", "hard"].includes(d)) {
      SETTINGS.difficulty = d;
      saveSettings();
      print(`Difficulty set to ${d}. Applies to new fights.`);
    } else print("Unchanged.");
  } else if (raw === "2" || raw === "log") {
    SETTINGS.combatLog = !SETTINGS.combatLog;
    saveSettings();
    print(`Combat log ${SETTINGS.combatLog ? "on" : "off"}.`);
  } else if (raw === "3" || raw === "color" || raw === "colour") {
    const d = (await input("default / amber / green / high: ")).trim().toLowerCase();
    if (["default", "amber", "green", "high"].includes(d)) {
      SETTINGS.textColor = d;
      saveSettings();
      print("Colour updated.");
    }
  }
}

async function townMenu() {
  const id = currentTownId();
  const t = TOWNS[id];
  print("\n" + "=".repeat(62));
  print(`🏘️  ${t.name.toUpperCase()}`);
  print("=".repeat(62));
  print(t.blurb);
  print("\n🛏️ 1. Innkeeper — rest and recover");
  print("🛍️ 2. Merchant — buy and sell supplies");
  print("🔨 3. Blacksmith — upgrade equipment");
  print("📜 4. Quest board — take optional work");
  print("🔮 5. Trainer — learn spells and review perks");
  print("🚪 0. Leave town");
  while (true) {
    const raw = (await input("Visit whom? ")).trim().toLowerCase();
    if (["0", "leave", "back", ""].includes(raw)) return;
    if (raw === "1" || raw === "inn" || raw === "innkeeper") await innKeep();
    else if (raw === "2" || raw === "merchant" || raw === "shop") await shop();
    else if (raw === "3" || raw === "blacksmith" || raw === "upgrade") await blacksmith();
    else if (raw === "4" || raw === "quest") await questGiver();
    else if (raw === "5" || raw === "trainer") await trainerNpc();
    else print("Pick 1-5 or 0 to leave.");
  }
}

async function innKeep() {
  const cost = 15 + STORY.chapter * 4;
  print(`\nThe innkeeper nods. "A bed is ${cost} coin. You'll start the next fight rested."`);
  print("Companions are fully healed here.");
  const c = (await input("Rest? (y/n): ")).trim().toLowerCase();
  if (c !== "y" && c !== "yes") return;
  if ((inventory.coin || 0) < cost) {
    print("Not enough coin.");
    return;
  }
  removeItem("coin", cost);
  WORLD.rested = 1;
  for (const id of WORLD.companions.recruited || []) WORLD.companions.hp[id] = companionMaxHp(id);
  print("You sleep. Companions recover. Next fight: +1 starting energy and a small ward.");
}

async function blacksmith() {
  const owned = Object.keys(ITEMS).filter((n) => (inventory[n] || 0) > 0);
  if (!owned.length) {
    print("Bring gear to upgrade.");
    return;
  }
  print("\n🔨");
  print("Upgrades use iron/steel and coin. Max +5. Higher rarity also helps.");
  owned.forEach((n, i) => {
    const u = gearUpgrade(n);
    const r = WORLD.rarity[n] || "common";
    print(`${i + 1}. ${n}  [${r}]  +${u}/5`);
  });
  print("0. Back");
  const raw = (await input("Upgrade which item? ")).trim().toLowerCase();
  if (["0", "back", ""].includes(raw)) return;
  const n = isDigit(raw) && +raw >= 1 && +raw <= owned.length ? owned[+raw - 1] : owned.find((x) => x === raw);
  if (!n) {
    print("Unknown item.");
    return;
  }
  const u = gearUpgrade(n);
  if (u >= 5) {
    print("That piece cannot be pushed further.");
    return;
  }
  const ironNeed = 3 + u * 2;
  const coinNeed = 25 + u * 20;
  print(`Next upgrade: ${ironNeed} iron, ${coinNeed} coin.`);
  if ((inventory.iron || 0) < ironNeed || (inventory.coin || 0) < coinNeed) {
    print("You lack materials or coin.");
    return;
  }
  removeItem("iron", ironNeed);
  removeItem("coin", coinNeed);
  WORLD.upgrades[n] = u + 1;
  print(`🔧 ${n} is now +${u + 1}.`);
}

async function questGiver() {
  print("\nA notice board. Some tasks are optional.");
  tryTurnInQuests();
  const available = Object.keys(SIDE_QUESTS).filter((id) => {
    const st = questState(id);
    return st.status !== "done" && st.status !== "active" && STORY.chapter >= SIDE_QUESTS[id].chapterMin;
  });
  if (!available.length) {
    print("No new work right now. Check 'quests' for progress.");
    return;
  }
  available.forEach((id, i) => print(`${i + 1}. ${SIDE_QUESTS[id].name} — ${SIDE_QUESTS[id].desc}`));
  print("0. Back");
  const raw = (await input("Accept which? ")).trim().toLowerCase();
  if (["0", "back", ""].includes(raw)) return;
  const id = isDigit(raw) && +raw >= 1 && +raw <= available.length ? available[+raw - 1] : available.find((x) => SIDE_QUESTS[x].name.toLowerCase() === raw);
  if (id) offerQuest(id);
}

async function trainerNpc() {
  const cost = 40;
  print("\nThe trainer taps your shoulder. \"I can teach a spell for " + cost + " coin, or you can spend perk points yourself ('perks').\"");
  const locked = Object.keys(SPELLS).filter((n) => !(PLAYER.spells || []).includes(n));
  if (!locked.length) {
    print("You already know every spell I teach.");
    await showPerks();
    return;
  }
  locked.forEach((n, i) => print(`${i + 1}. ${title(n)} — ${SPELLS[n].desc}`));
  print("p. Open perk trees");
  print("0. Back");
  const raw = (await input("Learn? ")).trim().toLowerCase();
  if (raw === "p" || raw === "perks") {
    await showPerks();
    return;
  }
  if (["0", "back", ""].includes(raw)) return;
  const n = isDigit(raw) && +raw >= 1 && +raw <= locked.length ? locked[+raw - 1] : locked.find((x) => x === raw);
  if (!n) return;
  if ((inventory.coin || 0) < cost) {
    print("Not enough coin.");
    return;
  }
  removeItem("coin", cost);
  PLAYER.spells.push(n);
  print(`You learn ${title(n)}.`);
}

async function maybeExploreEvent(areaName) {
  if (Math.random() > 0.28) return false;
  WORLD.eventsDone = (WORLD.eventsDone || 0) + 1;
  const table = ["chest", "trap", "merchant", "camp", "npc", "riddle", "cache", "scrap", "forage", "shrine", "echo"];
  if (STORY.chapter >= 1) table.push("townhint");
  const kind = table[randint(0, table.length - 1)];
  print("\n👣");
  if (kind === "chest") {
    print("A half-buried chest. The lock is already tired.");
    const loot = wchoice(["coin", "iron", "potion", "crystal"], [40, 30, 20, 10]);
    const amt = loot === "coin" ? randint(12, 30) : randint(1, 3);
    addItem(loot, amt);
    clog({ log: [] }, "chest");
    return true;
  }
  if (kind === "trap") {
    print("The ground gives. You catch yourself, but it costs you.");
    const loss = Math.min(inventory.coin || 0, randint(4, 12));
    if (loss) removeItem("coin", loss);
    else print("You have no coin to spill. Luck, of a kind.");
    return true;
  }
  if (kind === "merchant") {
    print("A travelling merchant has stopped in the dust.");
    const c = (await input("Browse their pack? (y/n): ")).trim().toLowerCase();
    if (c === "y" || c === "yes") await shop("buy");
    return true;
  }
  if (kind === "camp") {
    print("An abandoned camp still has embers. You rest a moment.");
    WORLD.rested = 1;
    print("You'll start the next fight slightly better off.");
    return true;
  }
  if (kind === "npc") {
    print("Someone on the road: they have a job if you want one.");
    const ids = Object.keys(SIDE_QUESTS).filter((id) => questState(id).status !== "done" && STORY.chapter >= SIDE_QUESTS[id].chapterMin);
    if (ids.length) offerQuest(ids[randint(0, ids.length - 1)]);
    else print("They were hoping you were someone else.");
    return true;
  }
  if (kind === "riddle") {
    print('A scratched post asks: "I am spent to swing, recovered to wait. What am I?"');
    const a = (await input("Answer: ")).trim().toLowerCase();
    if (["energy", "stamina", "your energy"].some((x) => a.includes(x))) {
      print("The post flakes into coin.");
      addItem("coin", 25);
    } else print("The post stays silent. (The answer was energy.)");
    return true;
  }
  if (kind === "cache") {
    print("A textureless crate. Inside: something the renderer forgot.");
    WORLD.flags.found_hidden_cache = true;
    addItem("void crystal", 1);
    ensureRarity("charm", 20);
    if ((inventory.charm || 0) < 1) addItem("charm", 1);
    unlockAchievement("hidden");
    tryTurnInQuests();
    return true;
  }
  if (kind === "scrap") {
    print("You pick through a wreck: usable scrap.");
    addItem("iron", randint(1, 3));
    addItem("wood", randint(1, 4));
    noteQuestCollect();
    return true;
  }
  if (kind === "townhint") {
    print(`Smoke on the horizon. ${TOWNS[currentTownId()].name} is not far. Type 'town' when you want it.`);
    return true;
  }
  if (kind === "forage") {
    const found = wchoice(["moon herb", "black salt", "clockwork spring"], [STORY.chapter < 2 ? 55 : 35, STORY.chapter >= 2 ? 40 : 20, STORY.chapter >= 1 ? 35 : 10]);
    const count = found === "clockwork spring" ? 1 : randint(1, 3);
    print(`You search the roadside and find ${count} ${found}.`);
    addItem(found, count);
    return true;
  }
  if (kind === "shrine") {
    const key = `roadside_shrine_${areaName.toLowerCase()}`;
    if (WORLD.flags[key]) {
      print("The old roadside shrine is quiet now. A few offerings remain.");
      addItem(wchoice(["moon herb", "black salt", "coin"], [45, 30, 25]), 1);
    } else {
      WORLD.flags[key] = true;
      WORLD.rested = 1;
      print("A small shrine glows beneath the dust. You leave an offering and feel steadier.");
      print("Your next battle begins rested: a little healing, extra energy, and a protective ward.");
    }
    return true;
  }
  if (kind === "echo") {
    const key = `memory_echo_${areaName.toLowerCase()}`;
    print("A voice from another attempt tells you one thing it wishes it had known.");
    if (WORLD.flags[key]) {
      print("You recognize this memory. It fades without repeating its reward.");
    } else {
      WORLD.flags[key] = true;
      const xp = 35 + STORY.chapter * 12;
      print(`The memory settles into your own. You gain ${xp} XP and 15 coin.`);
      grantXp(xp);
      addItem("coin", 15);
    }
    return true;
  }
  return false;
}

async function saveSlotsMenu() {
  print("\n💾");
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    let info = "(empty)";
    try {
      const c = localStorage.getItem(SLOT_KEY(i));
      if (c) {
        const s = await parseSave(c);
        info = `Lv ${s.pl.level}  Ch ${s.st?.chapter ?? "?"}  ${s.pl.ngPlus ? "NG+" + s.pl.ngPlus : "NG"}  ${s.inv.coin || 0} coin`;
      }
    } catch (e) {
      info = "(unreadable)";
    }
    print(`  ${i}. ${info}`);
  }
  print("  s. 💾 Save your current progress");
  print("  l. 📂 Load a saved adventure");
  print("  c. 🔁 Restore your latest completed run");
  print("  0. ↩️ Back");
  const raw = (await input("Slots: ")).trim().toLowerCase();
  if (["0", "back", ""].includes(raw)) return;
  if (raw === "s" || raw === "save") {
    const n = parseInt(await input(`Save into slot 1-${SAVE_SLOTS}: `), 10);
    if (n >= 1 && n <= SAVE_SLOTS) {
      let existing = false;
      try {
        existing = !!localStorage.getItem(SLOT_KEY(n));
      } catch (e) {}
      if (existing) {
        const y = (await input(`Slot ${n} already has a save. Overwrite? (y/n): `)).trim().toLowerCase();
        if (y !== "y" && y !== "yes") {
          print("Save cancelled.");
          return;
        }
      }
      try {
        localStorage.setItem(SLOT_KEY(n), saveCode());
        print(`💾 Saved into slot ${n}.`);
      } catch (e) {
        print("Could not write that slot.");
      }
    }
  } else if (raw === "l" || raw === "load") {
    const n = parseInt(await input(`Load slot 1-${SAVE_SLOTS}: `), 10);
    if (n >= 1 && n <= SAVE_SLOTS) {
      let code = "";
      try {
        code = localStorage.getItem(SLOT_KEY(n)) || "";
      } catch (e) {}
      if (!code) {
        print("That slot is empty.");
        return;
      }
      const y = (await input("This replaces your current progress. Continue? (y/n): ")).trim().toLowerCase();
      if (y !== "y" && y !== "yes") return;
      try {
        applySave(await parseSave(code));
        print(`✅ Loaded slot ${n}. Level ${PLAYER.level}, Chapter ${STORY.chapter}.`);
      } catch (e) {
        print(`❌ ${e.message}`);
      }
    }
  } else if (raw === "c" || raw === "completed") {
    await loadCompletedRun();
  }
}

async function loadCompletedRun() {
  let code = "";
  try {
    code = localStorage.getItem(COMPLETED_KEY) || "";
  } catch (e) {}
  if (!code) {
    print("There is no completed run saved yet. Finish an ending first.");
    return;
  }
  let data;
  try {
    data = await parseSave(code);
  } catch (e) {
    print(`❌ The completed run cannot be loaded: ${e.message}`);
    return;
  }
  const answer = (await input("Replace your current progress with the completed run? (y/n): ")).trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") return;
  applySave(data);
  print(`✅ Completed run restored. Level ${PLAYER.level}, Chapter ${STORY.chapter}, ending: ${STORY.ending || "none"}.`);
}

async function startNewGamePlus() {
  if (!STORY.ending) {
    print("New Game+ unlocks after you make the final choice ('ending').");
    return;
  }
  print("\n🔁");
  print("Carry your level, attributes, perks, spells, gear, coin, and companions into a fresh run.");
  print("The campaign begins again, and enemies are more dangerous.");
  print("Your completed run remains saved separately.");
  const y = (await input("Begin New Game+? (y/n): ")).trim().toLowerCase();
  if (y !== "y" && y !== "yes") return;
  try {
    localStorage.setItem(COMPLETED_KEY, saveCode());
  } catch (e) {}
  PLAYER.ngPlus = (PLAYER.ngPlus || 0) + 1;
  PLAYER.xp = 0;
  const keep = { ...PLAYER };
  const inv = { ...inventory };
  const eq = { ...equipment };
  const worldKeep = {
    upgrades: WORLD.upgrades,
    rarity: WORLD.rarity,
    companions: WORLD.companions,
  };
  resetState();
  Object.assign(PLAYER, keep);
  inventory = inv;
  equipment = eq;
  WORLD.upgrades = worldKeep.upgrades;
  WORLD.rarity = worldKeep.rarity;
  WORLD.companions = worldKeep.companions;
  WORLD.usedCombatItem = false;
  print(`\n🔁 New Game+ ${PLAYER.ngPlus} begins. This is not your completed file.`);
  print("🗺️ Type 'explore' to begin again. The Quiet Road remembers you.");
  unlockAchievement("ng");
  storyIntro();
}

function applyRested(f) {
  if (WORLD.rested) {
    f.energy = Math.min(maxEnergy(), f.energy + 1);
    f.effects.push({ type: "warded", damage: 0, turns: 3 });
    f.player_hp = Math.min(f.player_max_hp, f.player_hp + 8);
    WORLD.rested = 0;
    print("😌 Well-rested: +1 energy, a ward, and a little extra health.");
  }
}

function remindHeal(f) {
  const low = f.player_hp <= f.player_max_hp * 0.35;
  const dots = (f.effects || []).some((e) => DOT_TYPES.has(e.type));
  if ((low || dots) && !f._reminded) {
    f._reminded = true;
    const has = Object.keys(USABLE_ITEMS).some((n) => (inventory[n] || 0) > 0 && (USABLE_ITEMS[n].heal || USABLE_ITEMS[n].cure));
    if (has) print("💡 You look rough. An item (action 7) or 'mend' might help.");
  }
}

if (typeof document !== "undefined") {
  loadSettings();
  loadMetaAchievements();
}

