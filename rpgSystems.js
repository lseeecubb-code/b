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
const COMPANION_PERSONAL_QUESTS = {
  mira: { name: "Pages That Stayed", target: "archive stalker", need: 3, reward: 120 },
  kael: { name: "Bells in the Dark", target: "zombie", need: 3, reward: 120 },
  nyx: { name: "A Name for the Shadow", target: "wraith", need: 3, reward: 150 },
};
const COMPANION_BOND_LINES = {
  mira: [
    [20, "Mira admits she writes down the silences because she fears forgetting the people inside them.", "You promise to keep her pages safe", "You ask her to leave one page unwritten"],
    [50, "Mira shares the last letter she never sent home. The ink trembles, but her voice does not.", "You read it together", "You help her burn it"],
    [80, "Mira gives you her first field journal, filled with small victories from your travels.", "Keep it as a record of the road", "Add your own final page"],
  ],
  kael: [
    [20, "Kael confesses he keeps listening for bells from a village that no longer exists.", "Listen with him", "Tell him the silence can be a kind of rest"],
    [50, "Kael removes the cracked bell from his shield and tells you the name of the friend who gave it to him.", "Carry the bell together", "Help him mend it"],
    [80, "Kael says he no longer fights to keep the past standing; he fights so others can have a future.", "Stand with him at the next dawn", "Let him choose his own road"],
  ],
  nyx: [
    [20, "Nyx tells you the Null Expanse erased their first name, and asks what you hear in the quiet.", "A name still waiting to be found", "A silence that belongs to you"],
    [50, "Nyx shows you a scrap of map that survived the Expanse. A single star is marked in the margin.", "Trace the route with them", "Let the star stay a secret"],
    [80, "Nyx speaks a chosen name aloud and asks you to remember it, even if the world forgets again.", "I will remember", "You can always choose another"],
  ],
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
  quiet_road_pests: {
    name: "Green in the Grass", giver: "Innkeeper",
    desc: "Clear three mosslings away from the gardens outside Wayrest.",
    type: "kills", target: "mossling", need: 3,
    reward: { xp: 55, coin: 35, "moon herb": 2 }, chapterMin: 0,
  },
  burrow_under_wayrest: {
    name: "Something Under the Cellar", giver: "Innkeeper",
    desc: "Track the burrow rats tunnelling beneath the old road.",
    type: "kills", target: "burrow rat", need: 3,
    requiresQuests: ["quiet_road_pests"],
    reward: { xp: 75, coin: 55, meat: 2 }, chapterMin: 0,
  },
  lanterns_out: {
    name: "Thieves in the Twilight", giver: "Wayrest Guard",
    desc: "Recover stolen lantern glass from two thieves on the Quiet Road.",
    type: "kills", target: "lantern thief", need: 2,
    requiresQuests: ["burrow_under_wayrest"], minLevel: 2,
    reward: { xp: 105, coin: 75, "lantern glass": 1 }, chapterMin: 0,
  },
  roots_under_wayrest: {
    name: "The Old Road's Heart", giver: "Wayrest Guard",
    desc: "Follow the mossback's trail to its lair and settle the trouble beneath the road.",
    type: "kills", target: "mossback guardian", need: 1,
    requiresQuests: ["quiet_road_pests", "burrow_under_wayrest", "lanterns_out"], minLevel: 3,
    reward: { xp: 155, coin: 120, "guardian bark": 2, "moon herb": 2 }, chapterMin: 0,
  },
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
  unwritten_index: {
    name: "The Unwritten Index", giver: "Archivist",
    desc: "Find the Index Hound carrying the last catalogue strip. Hunt it in the Archive, or follow its trail and spare it.",
    type: "kills", target: "index hound", need: 1,
    reward: { xp: 520, coin: 300, "soul shard": 2, "ancient crystal": 2 }, chapterMin: 6,
  },
  star_glass_survey: {
    name: "A Sky in Pieces", giver: "Nyx",
    desc: "Collect four pieces of star glass from the Glasswing Moths in the Null Expanse.",
    type: "collect", target: "star glass", need: 4,
    reward: { xp: 430, coin: 260, "star glass": 2, "ancient crystal": 1 }, chapterMin: 3,
  },
  ashen_reliquary: {
    name: "The Bell Beneath the Ash", giver: "Bellkeeper",
    desc: "Recover three ashen sigils from the Cathedral's last sentinels.",
    type: "collect", target: "ashen sigil", need: 3,
    reward: { xp: 360, coin: 220, "ember core": 2, "black salt": 2 }, chapterMin: 2,
  },
  hollow_patrol: {
    name: "The Last Patrol", giver: "Hollow Veteran",
    desc: "Defeat three hollow sentinels still marching through the abandoned kingdom.",
    type: "kills", target: "hollow sentinel", need: 3,
    reward: { xp: 780, coin: 460, "oath fragment": 2, "ancient crystal": 2 }, chapterMin: 7,
  },
  far_edges: {
    name: "Where the Map Ends", giver: "Hollow Veteran",
    desc: "Once the Null, Ash, and Hollow surveys are finished, follow the final chart and challenge the Lost Cartographer.",
    type: "kills", target: "the lost cartographer", need: 1,
    requiresQuests: ["star_glass_survey", "ashen_reliquary", "hollow_patrol"], minLevel: 17,
    reward: { xp: 1250, coin: 850, "cartographer's compass": 1 }, chapterMin: 7,
  },
  frontier_dispatch: {
    name: "Cut the Signal Line", giver: "Frontier Scout",
    desc: "Stop three frontier outriders from cutting the camp's signal wires.",
    type: "kills", target: "frontier outrider", need: 3,
    reward: { xp: 220, coin: 150, "clockwork spring": 2, "signal wire": 2 }, chapterMin: 1,
  },
  cathedral_chorus: {
    name: "A Voice in Every Bell", giver: "Bellkeeper",
    desc: "Silence three bellbound cantors before their song wakes the nave.",
    type: "kills", target: "bellbound cantor", need: 3,
    reward: { xp: 320, coin: 240, "resonant bell": 1, "black salt": 2 }, chapterMin: 2,
  },
  silent_bell: {
    name: "The Bell Without a Tongue", giver: "Bellkeeper",
    desc: "After the acolytes, cantors, and reliquary are dealt with, ring the silent bell and face what answers.",
    type: "kills", target: "the bell without a tongue", need: 1,
    requiresQuests: ["bell_silence", "cathedral_chorus", "ashen_reliquary"], minLevel: 8,
    reward: { xp: 700, coin: 500, "bellshard maul": 1 }, chapterMin: 2,
  },
  frontier_signal: {
    name: "A Signal for the Frontier", giver: "Frontier Scout",
    desc: "Find the wounded scout's route map while exploring the Broken Frontier.",
    type: "flag", flag: "frontier_scout_guided",
    reward: { xp: 100, coin: 75, potion: 1, "clockwork spring": 2 }, chapterMin: 1,
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
  three_horizons: { name: "Three Horizons", desc: "Complete the Ash, Null, and Hollow regional surveys." },
  beyond_the_map: { name: "Beyond the Map", desc: "Find and defeat the Lost Cartographer." },
  unanswered: { name: "The Unanswered Bell", desc: "Find and defeat the Bell Without a Tongue." },
  wayrest_regular: { name: "Wayrest's Favorite", desc: "Complete all four jobs on the Quiet Road." },
  mossback_slayer: { name: "Heart of the Old Road", desc: "Find and defeat the Mossback Guardian." },
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
  const gearBonus = typeof getStats === "function" ? (getStats().max_energy || 0) : 0;
  let m = C.MAX_ENERGY + Math.floor(Math.max(0, (PLAYER.foc || 5) - 5) / 4) + gearBonus;
  if (hasPerk("arcane surge")) m += 1;
  return m;
}

function focusRecovery() {
  return C.RECOVER + Math.floor(Math.max(0, (PLAYER.foc || 5) - 5) / 5);
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
  def("eventFlags", "eventFlags");
}

function makeEnemyState(name, elite = false) {
  const canonicalName = String(name).replace(/^elite /, "");
  const m = scaledMonster(canonicalName);
  const towerWave = WORLD.towerRun?.active ? Math.max(1, (WORLD.towerRun.wave || 0) + 1) : 0;
  if (towerWave) {
    const scale = 1 + towerWave * 0.06;
    const tune = (form) => {
      form.hp = Math.max(1, int(form.hp * scale));
      if (form.basic_attack?.damage) form.basic_attack.damage = scaleRange(form.basic_attack.damage, scale);
      for (const move of Object.values(form.abilities || {})) {
        if (move.damage) move.damage = scaleRange(move.damage, scale);
        if (move.heal) move.heal = scaleRange(move.heal, scale);
      }
    };
    tune(m);
    (m.phases || []).forEach(tune);
  }
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
    eventFlags: {},
    elite: !!elite,
    poise: 0,
    role: enemyRole(activeForm),
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
  if (["star_glass_survey", "ashen_reliquary", "hollow_patrol"].every((id) => questState(id).status === "done")) unlockAchievement("three_horizons");
  if (killCount("the lost cartographer") > 0) unlockAchievement("beyond_the_map");
  if (killCount("the bell without a tongue") > 0) unlockAchievement("unanswered");
  if (killCount("mossback guardian") > 0) unlockAchievement("mossback_slayer");
  if (["quiet_road_pests", "burrow_under_wayrest", "lanterns_out", "roots_under_wayrest"].every((id) => questState(id).status === "done"))
    unlockAchievement("wayrest_regular");
  if (["dust jackal", "frontier marksman", "bellbound acolyte", "null leech", "footnote mimic"].every((n) => killCount(n) > 0)) unlockAchievement("field_notes");
  if (["moon herb", "black salt", "clockwork spring"].every((n) => (WORLD.recipeMaterialsSeen || []).includes(n))) unlockAchievement("supply_scout");
  if (["moonlit poultice", "salt ward", "clockwork charge", "sunfire bomb", "trailbreaker bow", "bellguard", "nullweave coat", "archivist's ring", "margin seal", "last line tonic", "field stew", "mosswrap boots", "roadward charm", "lantern charm", "mossback buckler"].every((n) => (WORLD.recipesCrafted || []).includes(n))) unlockAchievement("maker");
}

function recruitCompanion(id, announce = true) {
  const d = COMPANION_DEFS[id];
  if (!d) return;
  if (WORLD.companions.recruited.includes(id)) return;
  WORLD.companions.recruited.push(id);
  if (WORLD.companions.active.length < 1) WORLD.companions.active.push(id);
  WORLD.companions.hp[id] = companionMaxHp(id);
  if (typeof recordStoryMoment === "function") recordStoryMoment(`${d.name} joined your party.`, "companion", id);
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

function questAvailable(id) {
  const q = SIDE_QUESTS[id];
  if (!q || STORY.chapter < q.chapterMin || PLAYER.level < (q.minLevel || 1)) return false;
  return (q.requiresQuests || []).every((required) => questState(required).status === "done");
}

function offerQuest(id) {
  const q = SIDE_QUESTS[id];
  if (!q) return;
  const st = questState(id);
  if (st.status === "done" || st.status === "active") return false;
  if (!questAvailable(id)) return false;
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
  noteCompanionQuestKill(name);
}

function noteCompanionQuestKill(name) {
  for (const id of WORLD.companions.active || []) {
    const quest = COMPANION_PERSONAL_QUESTS[id];
    if (!quest || (WORLD.companions.affinity[id] || 0) < 10) continue;
    const state = WORLD.companions.personal[id] || (WORLD.companions.personal[id] = { progress: 0, done: false });
    if (state.done || (name !== quest.target && name !== `elite ${quest.target}`)) continue;
    state.progress = Math.min(quest.need, (state.progress || 0) + 1);
    print(`   ${COMPANION_DEFS[id].name}'s personal quest: ${state.progress}/${quest.need} ${title(quest.target)} defeated.`);
    if (state.progress >= quest.need) {
      state.done = true;
      addItem("coin", quest.reward);
      print("Earned 80 Exp.");
      grantXp(80);
      print(`🤝 ${COMPANION_DEFS[id].name} personal quest complete: ${quest.name}. Their combo attack is unlocked!`);
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
      print(`Earned ${a} Exp.`);
      grantXp(a);
    } else {
      addItem(k, a);
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

async function allocateStats(argument = "") {
  const statAliases = {
    "1": "str", str: "str", strength: "str",
    "2": "agi", agi: "agi", agility: "agi",
    "3": "vit", vit: "vit", vitality: "vit",
    "4": "foc", foc: "foc", focus: "foc",
  };
  const allocate = (key, requested) => {
    if (!STAT_INFO.some(([id]) => id === key)) return false;
    if (PLAYER[key] >= 25) {
      print("🏁 That attribute has reached its maximum.");
      return true;
    }
    const points = Math.max(0, PLAYER.statPoints || 0);
    if (!points) {
      print("You have no stat points left to spend.");
      return true;
    }
    const count = requested === undefined ? 1 : Number(requested);
    if (!Number.isInteger(count) || count < 1) {
      print("Enter a whole number of points (1 or more).");
      return true;
    }
    const amount = Math.min(count, points, 25 - PLAYER[key]);
    PLAYER[key] += amount;
    PLAYER.statPoints -= amount;
    const label = STAT_INFO.find(([id]) => id === key)[1];
    print(`  ✅ ${label} increased by ${amount} to ${PLAYER[key]}.`);
    if (amount < count) print(`  (Spent ${amount}; points available and the 25-point cap limit this allocation.)`);
    return true;
  };
  const direct = String(argument || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (direct.length) {
    const key = statAliases[direct[0]];
    if (!key) {
      print("Use 'allocate' for the numbered menu, or 'allocate <1-4|stat> [points]'.");
      return;
    }
    allocate(key, direct[1]);
    showAttributeSummary();
    return;
  }
  print("\n📊");
  print("Each point is a permanent bonus. Every attribute caps at 25.");
  while ((PLAYER.statPoints || 0) > 0) {
    print(`\n✨ Points to spend: ${PLAYER.statPoints}`);
    STAT_INFO.forEach(([key, name, desc], index) =>
      print(`  ${index + 1}. ${name} (${key.toUpperCase()}) ${PLAYER[key]}/25 — ${desc}`)
    );
    print("  0. Finish training");
    const raw = (await input("Choose 1-4 or a stat name; add a count like '2 3' to spend three points: ")).trim().toLowerCase();
    if (["0", "done", "back", ""].includes(raw)) break;
    const [choice, amount] = raw.split(/\s+/);
    const key = statAliases[choice] || ({ s: "str", a: "agi", v: "vit", f: "foc" })[choice];
    if (!key) {
      print("Choose 1/STR, 2/AGI, 3/VIT, 4/FOC, or 0 to finish.");
      continue;
    }
    allocate(key, amount);
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
  print("⚡ In battle, choose action 8 (Skills & abilities) to use a spell or equipment skill.");
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
    const elementResistance = (f.monster.resist || {})[s.element] || 0;
    const res = Math.max(0, elementResistance);
    if (res) {
      dmg = Math.max(1, int(dmg * (1 - res / 100)));
      print(`   The ${f.name} resists ${s.element} (${res}%).`);
    }
    const weak = Math.max((f.monster.weak || {})[s.element] || 0, -elementResistance);
    if (weak) {
      dmg = int(dmg * (1 + weak / 100));
      print(`   The ${f.name} is weak to ${s.element}!`);
    }
    dmg = Math.max(1, dmg);
    f.monster_hp -= dmg;
    chargeLimit(f, Math.max(1, int(dmg / 4)));
    addBreak(f, 18 + (weak > 0 ? 42 : 0), weak > 0 ? `to ${title(s.element)}` : "");
    print(`   💥 ${title(name)} deals ${dmg} ${s.element || ""} damage.`);
    clog(f, `${name} hits ${f.name} for ${dmg}`);
    if (s.element === "frost" && f.monster_effects.some((effect) => effect.type === "burn")) {
      print("   ❄️🔥 Frost locks the burning armor into a brittle crack!");
      applyMonsterEffect(f, { type: "exposed", chance: 100, damage: 0, turns: 2 });
      addBreak(f, 35, "from the burn-and-frost reaction");
    }
    if (s.element === "lightning") {
      const poison = f.monster_effects.find((effect) => effect.type === "poison");
      if (poison && f.enemies?.length > 1) {
        const current = f.target;
        let spread = 0;
        f.enemies.forEach((enemy, index) => {
          if (index === current || enemy.hp <= 0) return;
          f.target = index;
          applyMonsterEffect(f, { type: "poison", chance: 100, damage: Math.max(1, Math.floor(poison.damage / 2)), turns: poison.turns });
          spread++;
        });
        f.target = current;
        if (spread) print(`   ⚡☠️ Lightning carries poison to ${spread} nearby foe${spread === 1 ? "" : "s"}!`);
      }
    }
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
    WORLD.companions.affinity[id] = Math.min(100, (WORLD.companions.affinity[id] || 0) + 1);
    if (WORLD.companions.affinity[id] === 10)
      print(`💬 ${d.name} trusts you enough to share a personal request. Check 'party' for details.`);
    print("\n🔵");
    const tgt = livingEnemies(f)[0];
    if (!tgt) return;
    f.target = f.enemies.indexOf(tgt);
    if (d.ai === "healer" && f.player_hp < f.player_max_hp * 0.55) {
      const bond = WORLD.companions.affinity[id] || 0;
      const h = 12 + PLAYER.level + (bond >= 80 ? 8 : bond >= 50 ? 4 : 0);
      const b = f.player_hp;
      f.player_hp = Math.min(f.player_max_hp, f.player_hp + h);
      print(`${d.name} binds a page of light around you. You recover ${f.player_hp - b} HP.`);
      clog(f, `${d.name} heals you`);
    } else if (d.ai === "tank" && Math.random() < ((WORLD.companions.affinity[id] || 0) >= 80 ? 0.5 : 0.35)) {
      f.effects = applyStatus(f.effects, { type: "fortified", chance: 100, turns: 2, damage: 0 }, "You") || f.effects;
      print(`${d.name} raises a battered shield in front of you.`);
      clog(f, `${d.name} fortifies you`);
    } else {
      let dmg = randint(...companionDamage(id));
      if (tgt.staggered) dmg = int(dmg * (1 + C.STAGGER_BONUS));
      tgt.hp -= dmg;
      chargeLimit(f, Math.max(1, int(dmg / 6)));
      print(`${d.name} strikes the ${tgt.name} for ${dmg} damage.`);
      clog(f, `${d.name} hits ${tgt.name} for ${dmg}`);
      const bond = WORLD.companions.affinity[id] || 0;
      if (d.ai === "dps" && percent(bond >= 80 ? 55 : bond >= 50 ? 45 : 35) && tgt.hp > 0) {
        tgt.effects = applyStatus(tgt.effects, { type: "bleed", chance: 100, damage: bond >= 80 ? 4 : bond >= 50 ? 3 : 2, turns: 2 }, `The ${tgt.name}`) || tgt.effects;
      }
    }
    const bondQuest = WORLD.companions.personal[id];
    if (bondQuest?.done && !f.companionComboUsed?.[id] && tgt.hp > 0) {
      if (!f.companionComboUsed) f.companionComboUsed = {};
      f.companionComboUsed[id] = true;
      const combo = Math.max(1, int((randint(...companionDamage(id)) + PLAYER.level) * 1.5));
      tgt.hp -= combo;
      print(`✨ ${d.name} joins your attack in a bonded combo for ${combo} damage!`);
      if (tgt.hp > 0) tgt.effects = applyStatus(tgt.effects, { type: "exposed", chance: 100, damage: 0, turns: 1 }, `The ${tgt.name}`) || tgt.effects;
    }
    WORLD.companions.hp[id] = hp;
  }
}

function hurtCompanions(f, amount) {
  const act = WORLD.companions.active || [];
  if (!act.length || amount <= 0) return amount;
  const tank = act.find((id) => COMPANION_DEFS[id]?.ai === "tank" && (WORLD.companions.hp[id] || 0) > 0);
  if (!tank) return amount;
    const share = Math.max(1, int(amount * ((WORLD.companions.affinity[tank] || 0) >= 80 ? 0.35 : 0.25)));
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
    const affinity = WORLD.companions.affinity[id] || 0;
    const quest = COMPANION_PERSONAL_QUESTS[id];
    const progress = WORLD.companions.personal[id] || { progress: 0, done: false };
    print(`    Bond: ${affinity}/100`);
    if (affinity < 10) print("    Personal request: build trust through battles together.");
    else if (!progress.done) print(`    Personal quest: ${quest.name} · ${progress.progress || 0}/${quest.need} ${title(quest.target)} defeated.`);
    else print("    Bonded combo attack: unlocked (once per fight).");
    const scenes = COMPANION_BOND_LINES[id];
    const unlocked = scenes.filter((scene) => affinity >= scene[0]).length;
    print(`    Bond stories: ${unlocked}/${scenes.length} available · type 'bond ${id}'. Combat perk strengthens at 50 and 80 bond.`);
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
  print(`Tracked objective: ${WORLD.flags.trackedQuest || "Main campaign"} · use 'track [main|quest|none]' to change it.`);
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

function trackQuest(arg = "") {
  const value = String(arg).trim().toLowerCase();
  if (!value) {
    print(`Tracked: ${WORLD.flags.trackedQuest || "Main campaign"}. Choose 'main', an active quest name, or 'none'.`);
    return;
  }
  if (["none", "clear", "off"].includes(value)) {
    WORLD.flags.trackedQuest = "";
    print("Objective tracking cleared.");
    return;
  }
  if (["main", "story", "campaign"].includes(value)) {
    WORLD.flags.trackedQuest = "Main campaign";
    print("Main campaign objective pinned to your map.");
    return;
  }
  const match = Object.entries(WORLD.quests || {}).find(([id, state]) => {
    const q = SIDE_QUESTS[id];
    return state.status === "active" && q && (id.includes(value) || q.name.toLowerCase().includes(value));
  });
  if (!match) { print("No active quest matches that name. Check 'quests' for your open work."); return; }
  WORLD.flags.trackedQuest = SIDE_QUESTS[match[0]].name;
  print(`Pinned ${WORLD.flags.trackedQuest} to your map.`);
}

function showWorldMap() {
  print("\n🗺️ CAMPAIGN MAP");
  STORY_CHAPTERS.forEach((ch) => {
    const status = ch.id < STORY.chapter ? "✓" : ch.id === STORY.chapter ? "▶" : "🔒";
    print(` ${status} ${ch.area} — ${ch.title}`);
  });
  const open = Object.entries(WORLD.quests || {}).filter(([, state]) => state.status === "active");
  print(`\nPinned objective: ${WORLD.flags.trackedQuest || "Main campaign"}`);
  if (open.length) print(`Open side trails: ${open.map(([id]) => SIDE_QUESTS[id]?.name).filter(Boolean).join(" · ")}`);
  const routes = WORLD.flags.routeChoices || [];
  print(`Routes chosen: ${routes.filter((r) => r === "safe").length} safe · ${routes.filter((r) => r === "risky").length} risky`);
  print("Use 'route' to choose this region's road. Discoveries appear as you explore.");
}

async function showBondStory(arg = "") {
  const rec = WORLD.companions.recruited || [];
  if (!rec.length) { print("Your companion stories will begin when someone joins your party."); return; }
  const raw = String(arg).trim().toLowerCase();
  const id = raw ? rec.find((x) => x === raw || COMPANION_DEFS[x].name.toLowerCase() === raw) : WORLD.companions.active?.[0] || rec[0];
  if (!id) { print("That companion is not travelling with you."); return; }
  const scenes = COMPANION_BOND_LINES[id];
  const state = WORLD.companions.personal[id] || (WORLD.companions.personal[id] = { progress: 0, done: false, moments: [] });
  state.moments ||= [];
  const next = scenes.findIndex((scene, i) => (WORLD.companions.affinity[id] || 0) >= scene[0] && !state.moments.includes(i));
  if (next < 0) {
    const pending = scenes.find((scene, i) => !state.moments.includes(i));
    print(pending ? `${COMPANION_DEFS[id].name} needs a bond of ${pending[0]}/100 before sharing another memory.` : `${COMPANION_DEFS[id].name} has shared every story they can for now.`);
    return;
  }
  const scene = scenes[next];
  print(`\n💬 ${COMPANION_DEFS[id].name}: ${scene[1]}`);
  print(`1. ${scene[2]}\n2. ${scene[3]}`);
  const answer = (await input("Your response [1/2]: ")).trim().toLowerCase();
  state.moments.push(next);
  WORLD.companions.affinity[id] = Math.min(100, (WORLD.companions.affinity[id] || 0) + 8);
  const reply = next === 2 && answer === "2" ? scene[3] : scene[2];
  WORLD.flags.companionBondChoices ||= {};
  WORLD.flags.companionBondChoices[id] = reply;
  print(`${COMPANION_DEFS[id].name} nods. Your bond deepens (+8).`);
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
  if (typeof previewGearChange === "function") previewGearChange(n, u + 1);
  const confirm = (await input(`Upgrade ${n} to +${u + 1}? (y/n): `)).trim().toLowerCase();
  if (confirm !== "y" && confirm !== "yes") {
    print("Upgrade cancelled; your materials are untouched.");
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
    return st.status !== "done" && st.status !== "active" && questAvailable(id);
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

async function raidBoard() {
  const upgrades = WORLD.flags.raidUpgrades || {};
  const levels = { vigor: Math.max(0, upgrades.vigor || 0), edge: Math.max(0, upgrades.edge || 0), core: Math.max(0, upgrades.core || 0) };
  const tokens = Math.max(0, WORLD.flags.raidTokens || 0);
  print("\n🚩 REGIONAL RAID BOARD");
  print(`Raid tokens: ${tokens} · Raids cleared: ${WORLD.flags.raidsWon || 0}`);
  const regions = STORY_CHAPTERS.slice(0, STORY.chapter + 1).map((chapter) => {
    const area = STORY_AREAS[chapter.area];
    const encounters = (area?.encounters || []).filter((name) => monsters[name]?.chance > 0 && PLAYER.level >= enemyRequiredLevel(name));
    return { name: chapter.area, encounters };
  }).filter((region) => region.encounters.length >= 2);
  regions.forEach((region, index) => print(`${index + 1}. ${region.name} raid (${region.encounters.length} available foes)`));
  print("s. Raid reward shop");
  print("0. Back");
  const raw = (await input("Choose a raid or shop: ")).trim().toLowerCase();
  if (["0", "back", "", "cancel"].includes(raw)) return;
  if (["s", "shop", "rewards"].includes(raw)) { await raidRewardShop(levels); return; }
  const index = Number(raw) - 1;
  if (!Number.isInteger(index) || !regions[index]) { print("That is not an available raid."); return; }
  if (WORLD.raidRun?.active || WORLD.dungeonRun?.active || WORLD.towerRun?.active) {
    print("Finish your current challenge before starting a raid."); return;
  }
  await maybeExploreEvent(regions[index].name, "raid", regions[index].encounters);
}

async function raidRewardShop(levels = WORLD.flags.raidUpgrades || {}) {
  const offers = [
    { key: "vigor", name: "Vanguard Vitality", cost: 3, max: 5, detail: "+6 maximum HP per rank" },
    { key: "edge", name: "Raidbreaker Edge", cost: 4, max: 5, detail: "+2 damage per rank" },
    { key: "core", name: "Deepwell Core", cost: 5, max: 2, detail: "+1 maximum Energy per rank" },
  ];
  while (true) {
    const tokens = Math.max(0, WORLD.flags.raidTokens || 0);
    print(`\n🏅 RAID REWARD SHOP — ${tokens} token${tokens === 1 ? "" : "s"}`);
    offers.forEach((offer, index) => {
      const rank = Math.max(0, levels[offer.key] || 0);
      print(`${index + 1}. ${offer.name} · ${offer.cost} tokens · rank ${rank}/${offer.max} · ${offer.detail}`);
    });
    print("0. Back");
    const raw = (await input("Buy an upgrade: ")).trim().toLowerCase();
    if (["0", "back", "", "cancel"].includes(raw)) return;
    const offer = offers[Number(raw) - 1];
    if (!offer) { print("Choose one of the listed upgrades."); continue; }
    const rank = Math.max(0, levels[offer.key] || 0);
    if (rank >= offer.max) { print("That upgrade is already at maximum rank."); continue; }
    if (tokens < offer.cost) { print("You need more raid tokens for that upgrade."); continue; }
    WORLD.flags.raidTokens = tokens - offer.cost;
    levels[offer.key] = rank + 1;
    WORLD.flags.raidUpgrades = { ...levels };
    print(`${offer.name} upgraded to rank ${rank + 1}.`);
  }
}
async function maybeExploreEvent(areaName, selectedKind = null, availableEncounters = []) {
  if (!selectedKind && Math.random() > 0.28) return false;
  WORLD.eventsDone = (WORLD.eventsDone || 0) + 1;
  const table = ["chest", "trap", "merchant", "camp", "npc", "riddle", "cache", "scrap", "forage", "shrine", "echo"];
  if (areaName === "The Quiet Road" && STORY.chapter === 0) {
    if (!WORLD.flags.quiet_waystone_resolved) table.push("quiet_waystone");
    if (!WORLD.flags.trapped_messenger_resolved) table.push("trapped_messenger");
    if (questState("roots_under_wayrest").status === "active" && PLAYER.level >= enemyRequiredLevel("mossback guardian"))
      table.push("mossback_lair");
  }
  if (STORY.chapter >= 1) table.push("townhint");
  if ((PLAYER.ngPlus || 0) > 0 && WORLD.flags.ngEchoChapter !== STORY.chapter) table.push("ng_echo", "ng_echo");
  if (availableEncounters.includes("index hound") && questState("unwritten_index").status === "active" && !WORLD.flags.archive_index_resolved) table.push("index_hound");
  if (availableEncounters.includes("glasswing moth") && !WORLD.flags.starfall_cache_opened) table.push("starfall");
  if (availableEncounters.includes("ashbound sentinel") && !WORLD.flags.ash_reliquary_opened) table.push("ash_reliquary");
  if (availableEncounters.includes("hollow sentinel") && questState("far_edges").status === "active" && PLAYER.level >= enemyRequiredLevel("the lost cartographer")) table.push("lost_atlas");
  if (availableEncounters.includes("frontier outrider") && !WORLD.flags.frontier_signal_cache_found) table.push("signal_cache");
  if (availableEncounters.includes("bellbound cantor") && questState("silent_bell").status === "active" && PLAYER.level >= enemyRequiredLevel("the bell without a tongue")) table.push("silent_bell");
  if (availableEncounters.length >= 2) table.push("raid");
  const kind = selectedKind || table[randint(0, table.length - 1)];
  print("\n👣");
  if (kind === "ng_echo") {
    WORLD.flags.ngEchoChapter = STORY.chapter;
    const prior = STORY.ending || PLAYER.ngPlusEnding || "remember";
    print(`A seam in the road opens onto a memory from your ${prior} ending. It recognizes you, though this world should not.`);
    print("1. Carry the memory forward (+100 XP and 50 coin).\n2. Share it with your companion (+6 bond and a potion).\n0. Let the echo pass.");
    const answer = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
    if (["1", "claim", "carry"].includes(answer)) { grantXp(100); addItem("coin", 50); print("The old memory becomes strength for this new road."); }
    else if (["2", "share", "companion"].includes(answer)) {
      const id = WORLD.companions.active?.[0] || WORLD.companions.recruited?.[0];
      if (id) { WORLD.companions.affinity[id] = Math.min(100, (WORLD.companions.affinity[id] || 0) + 6); addItem("potion", 1); print(`${COMPANION_DEFS[id].name} keeps the echo. Your bond deepens (+6).`); }
      else print("You have no companion to share it with, so the echo fades kindly.");
    } else print("The echo fades without asking anything of you.");
    return true;
  }
  if (kind === "raid") {
    const pool = availableEncounters.filter((name) => monsters[name]?.chance > 0);
    if (!pool.length) {
      print("You find signs of a raid, but no safe trail to follow yet.");
      return true;
    }
    if (WORLD.dungeonRun?.active || WORLD.towerRun?.active) {
      print("Finish your current challenge before starting a raid.");
      return true;
    }
    const stats = getStats();
    WORLD.raidRun = {
      active: true,
      island: 0,
      hp: stats.max_hp,
      energy: Math.min(C.START_ENERGY, maxEnergy()),
      abandoned: false,
    };
    const run = WORLD.raidRun;
    const endRaid = (cleared) => {
      WORLD.raidRun = null;
      if (!cleared) {
        print(`Raid ended on Island ${run.island || 1}. You receive no clear cache.`);
        return;
      }
      const reward = 100 + STORY.chapter * 40;
      addItem("coin", reward);
      addItem(wchoice(["crystal", "ancient crystal", "potion", "void crystal"], [40, 20, 30, 10]), 1);
      WORLD.flags.raidsWon = (WORLD.flags.raidsWon || 0) + 1;
      WORLD.flags.raidTokens = (WORLD.flags.raidTokens || 0) + 3;
      print(`🏆 RAID CLEARED! You earn ${reward} bonus coin, a raid cache, and 3 raid tokens.`);
    };
    print("🚩 RAID DISCOVERED — a five-island assault is underway!");
    print("Clear every enemy on each island to open the passage. Island 5 holds the raid boss.");
    print("HP and energy carry between battles. Take the time you need.");
    for (let island = 1; island <= 5; island++) {
      if (run.hp <= 0 || run.abandoned) {
        endRaid(false);
        return true;
      }
      run.island = island;
      print(`\n━━ RAID ISLAND ${island}/5 ━━`);
      let foes, elite = false;
      if (island === 5) {
        const boss = pool.reduce((best, name) => monsters[name].hp > monsters[best].hp ? name : best, pool[0]);
        foes = [boss];
        elite = true;
        print(`👑 RAID BOSS: Elite ${title(boss)} blocks the final passage!`);
      } else {
        const count = [0, 2, 3, 3, 4][island];
        foes = Array.from({ length: count }, () => wchoice(pool, pool.map((name) => Math.max(1, monsters[name].chance))));
        elite = island === 4;
        print(`Clear all ${foes.length} enemies to open the portal to Island ${island + 1}.`);
      }
      const killsBeforeIsland = WORLD.totalKills || 0;
      await fightMonster(foes, elite);
      if ((WORLD.totalKills || 0) < killsBeforeIsland + foes.length) {
        endRaid(false);
        return true;
      }
      if (island < 5) {
        print(`🌌 Island ${island} cleared. A portal opens. HP: ${run.hp}/${stats.max_hp} · Energy: ${run.energy}.`);
        while (true) {
          const choice = (await input("Continue to the next island or leave the raid? [continue/leave] ")).trim().toLowerCase();
          if (["continue", "c", "yes", "y", ""].includes(choice)) break;
          if (["leave", "l", "retire", "quit", "q", "no", "n"].includes(choice)) {
            run.abandoned = true;
            endRaid(false);
            return true;
          }
          print("Choose 'continue' or 'leave'.");
        }
      }
    }
    endRaid(run.hp > 0 && !run.abandoned);
    return true;
  }
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
    const ids = Object.keys(SIDE_QUESTS).filter((id) => !["done", "active"].includes(questState(id).status) && questAvailable(id));
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
      print("The memory settles into your own.");
      print(`Earned ${xp} Exp.`);
      grantXp(xp);
      addItem("coin", 15);
    }
    return true;
  }
  if (kind === "quiet_waystone") {
    if (WORLD.flags.quiet_waystone_resolved) {
      print("The old waystone rests where you left it.");
      return true;
    }
    print("An old waystone has fallen across a fork in the Quiet Road. Fresh moss hides its carvings.");
    print("1. Lift the stone back into place and leave an offering.");
    print("2. Search the cracked base for anything still useful.");
    print("0. Leave it for now.");
    while (true) {
      const choice = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) return true;
      if (["1", "lift", "repair", "offering"].includes(choice)) {
        WORLD.flags.quiet_waystone_resolved = true;
        WORLD.rested = 1;
        addItem("road pin", 1);
        addItem("moon herb", 1);
        print("The road opens again. You feel ready for the next fight.");
        return true;
      }
      if (["2", "search", "base", "pin"].includes(choice)) {
        WORLD.flags.quiet_waystone_resolved = true;
        addItem("road pin", 1);
        addItem("coin", 12);
        print("You find a brass road pin and a few coins wedged under the marker.");
        return true;
      }
      print("Choose 1 to set the waystone upright, 2 to search it, or 0 to leave.");
    }
  }
  if (kind === "trapped_messenger") {
    if (WORLD.flags.trapped_messenger_resolved) return true;
    print("A courier is pinned beneath an overturned handcart. A lantern thief's tracks disappear into the grass.");
    print("1. Spend a potion to treat the courier.");
    print("2. Share your food and help them stand.");
    print("3. Salvage the cart's spare supplies and move on.");
    print("0. Leave the scene for now.");
    while (true) {
      const choice = (await input("How do you help? [1/2/3/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) return true;
      if (["1", "potion", "medicine"].includes(choice)) {
        if ((inventory.potion || 0) < 1) {
          print("You need a potion to treat the courier. Choose another option.");
          continue;
        }
        removeItem("potion", 1, true);
        WORLD.flags.trapped_messenger_resolved = true;
        WORLD.rested = 1;
        addItem("coin", 38);
        print("The courier gets back on their feet and marks a safer trail for you.");
        print("Earned 30 Exp.");
        grantXp(30);
        return true;
      }
      if (["2", "food", "meat", "share"].includes(choice)) {
        if ((inventory.meat || 0) < 1) {
          print("You have no meat to share. Choose another option.");
          continue;
        }
        removeItem("meat", 1, true);
        WORLD.flags.trapped_messenger_resolved = true;
        addItem("moon herb", 2);
        addItem("coin", 15);
        print("The courier shares a bundle of herbs in thanks and limps back toward Wayrest.");
        return true;
      }
      if (["3", "salvage", "supplies", "cart"].includes(choice)) {
        WORLD.flags.trapped_messenger_resolved = true;
        addItem("wood", 3);
        addItem("leather", 1);
        addItem("coin", 8);
        print("You salvage the cart's dry supplies and leave the courier enough room to crawl free.");
        return true;
      }
      print("Choose 1 to use a potion, 2 to share meat, 3 to salvage supplies, or 0 to leave.");
    }
  }
  if (kind === "mossback_lair") {
    if (questState("roots_under_wayrest").status !== "active") return true;
    print("A curtain of roots parts around a hollow under the old road. The Mossback Guardian is curled around a stone heart.");
    print("1. Step inside and challenge the guardian.");
    print("0. Mark the entrance and return later.");
    while (true) {
      const choice = (await input("Do you enter the lair? [1/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back", "later"].includes(choice)) return true;
      if (["1", "enter", "fight", "yes"].includes(choice)) {
        STORY.flags.add("quiet_road_mossback_found");
        print("The roots tighten around the road as the guardian rises.");
        await fightMonster("mossback guardian");
        tryTurnInQuests();
        return true;
      }
      print("Choose 1 to enter the lair or 0 to return to the road.");
    }
  }
  if (kind === "signal_cache") {
    if (WORLD.flags.frontier_signal_cache_found) return true;
    print("A courier's cracked lantern lies under a cairn beside the Broken Frontier road.");
    print("1. Salvage the signal wire and clockwork spring.");
    print("2. Repair the lantern and mark a safer route for the camp.");
    print("0. Leave it under the stones.");
    while (true) {
      const choice = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) return true;
      if (["1", "salvage", "wire", "take"].includes(choice)) {
        WORLD.flags.frontier_signal_cache_found = true;
        addItem("signal wire", 2);
        addItem("clockwork spring", 1);
        print("You take what can still be used before the wind carries the lantern away.");
        return true;
      }
      if (["2", "repair", "route", "camp"].includes(choice)) {
        WORLD.flags.frontier_signal_cache_found = true;
        addItem("signal wire", 1);
        WORLD.rested = 1;
        print("The repaired beacon flashes toward camp. You will start your next battle rested.");
        return true;
      }
      print("Choose 1 to salvage it, 2 to repair it, or 0 to leave.");
    }
  }
  if (kind === "silent_bell") {
    if (questState("silent_bell").status !== "active") return true;
    print("The Cathedral's silent bell begins to move, though no rope is attached.");
    print("1. Strike the cracked rim and face whatever answers.");
    print("0. Let the bell fall silent again.");
    while (true) {
      const choice = (await input("Do you ring it? [1/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back", "later"].includes(choice)) return true;
      if (["1", "ring", "strike", "fight", "yes"].includes(choice)) {
        STORY.flags.add("secret_bell_without_tongue_found");
        print("The sound returns from inside the bell. Something steps out of the echo.");
        await fightMonster("the bell without a tongue");
        tryTurnInQuests();
        return true;
      }
      print("Choose 1 to ring the bell or 0 to leave it alone.");
    }
  }
  if (kind === "starfall") {
    if (WORLD.flags.starfall_cache_opened) {
      print("Only a dark crater remains. You gather a little moon herb from its rim.");
      addItem("moon herb", 1);
      return true;
    }
    print("A fallen star rests in a crater, its glassy shell still humming with the Null Expanse.");
    print("1. Break off two pieces of star glass.");
    print("2. Take one piece carefully and rest in the crater's warmth.");
    print("0. Leave the strange stone untouched.");
    while (true) {
      const choice = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) return true;
      if (["1", "glass", "take", "break"].includes(choice)) {
        WORLD.flags.starfall_cache_opened = true;
        addItem("star glass", 2);
        tryTurnInQuests();
        print("The remaining light fades, but the fragments fit together like part of a map.");
        return true;
      }
      if (["2", "rest", "careful", "warmth"].includes(choice)) {
        WORLD.flags.starfall_cache_opened = true;
        addItem("star glass", 1);
        WORLD.rested = 1;
        tryTurnInQuests();
        print("You leave the rest of the star intact and recover beside its fading warmth.");
        return true;
      }
      print("Choose 1 for more glass, 2 to rest, or 0 to leave.");
    }
  }
  if (kind === "ash_reliquary") {
    if (WORLD.flags.ash_reliquary_opened) return true;
    print("Under the Cathedral's collapsed altar, a reliquary rings once when you approach.");
    print("1. Open it and take the ashen sigils.");
    print("2. Leave an offering and accept the Bellkeeper's blessing.");
    print("0. Leave the altar undisturbed.");
    while (true) {
      const choice = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) return true;
      if (["1", "open", "sigils", "take"].includes(choice)) {
        WORLD.flags.ash_reliquary_opened = true;
        addItem("ashen sigil", 2);
        addItem("ember core", 1);
        tryTurnInQuests();
        print("The bell falls silent. The sigils are warm against your palm.");
        return true;
      }
      if (["2", "offering", "blessing", "rest"].includes(choice)) {
        WORLD.flags.ash_reliquary_opened = true;
        addItem("black salt", 2);
        WORLD.rested = 1;
        print("You leave the treasure where it lies. The bellkeeper's blessing steadies you for the next battle.");
        return true;
      }
      print("Choose 1 to open the reliquary, 2 to leave an offering, or 0 to go.");
    }
  }
  if (kind === "lost_atlas") {
    if (questState("far_edges").status !== "active") return true;
    print("The old atlas opens by itself. A route appears where the Hollow Kingdom ends.");
    print("1. Follow the route and challenge the Lost Cartographer.");
    print("0. Fold the map and return when you are ready.");
    while (true) {
      const choice = (await input("Do you follow the final route? [1/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back", "later"].includes(choice)) return true;
      if (["1", "yes", "fight", "challenge", "follow"].includes(choice)) {
        STORY.flags.add("secret_cartographer_found");
        print("The ink peels away from the page. A figure steps out of the blank space beyond the map.");
        await fightMonster("the lost cartographer");
        tryTurnInQuests();
        return true;
      }
      print("Choose 1 to follow the route or 0 to leave it for later.");
    }
  }
  if (kind === "index_hound") {
    if (questState("unwritten_index").status !== "active" || WORLD.flags.archive_index_resolved) {
      print("Only loose scraps remain where the hound's trail crossed the shelves.");
      return true;
    }
    print("A lean hound made of ink and torn paper guards a strip from the last catalogue.");
    print("1. Fight for the catalogue strip.");
    print("2. Lower your weapon and follow the hound.");
    print("0. Leave it alone for now.");
    while (true) {
      const choice = (await input("What do you do? [fight/follow/leave]: ")).trim().toLowerCase();
      if (["0", "leave", "back", "cancel"].includes(choice)) {
        print("The hound slips between the shelves, carrying the page with it.");
        return true;
      }
      if (["1", "fight", "f", "attack", "yes", "y"].includes(choice)) {
        const killsBefore = WORLD.totalKills || 0;
        await fightMonster("index hound");
        if ((WORLD.totalKills || 0) > killsBefore) WORLD.flags.archive_index_resolved = true;
        return true;
      }
      if (["2", "follow", "spare", "s", "mercy"].includes(choice)) {
        WORLD.flags.archive_index_resolved = true;
        const quest = questState("unwritten_index");
        quest.progress = 1;
        WORLD.quests.unwritten_index = quest;
        print("The hound pauses, then leads you to a reading nook hidden behind the shelves.");
        print("You recover the catalogue strip and an intact brass indexer's lens from its collar.");
        completeQuest("unwritten_index");
        addItem("indexer's lens", 1);
        return true;
      }
      print("Choose fight, follow, or leave.");
    }
  }
  if (kind === "lost_scout") {
    if (WORLD.flags.frontier_scout_guided) {
      print("The trail is quiet now. The scout made it back to camp.");
      return true;
    }
    print("A flare burns low in a ravine. A wounded scout clutches a map with the last safe trail marked on it.");
    print("1. Spend a potion to treat the scout, then guide them back to camp.");
    print("2. Give them your route notes and let them travel while you search their pack.");
    print("0. Leave the ravine for now.");
    while (true) {
      const choice = (await input("What do you do? [1/2/0]: ")).trim().toLowerCase();
      if (["0", "leave", "back"].includes(choice)) {
        print("You mark the ravine on your map and leave the scout's flare burning.");
        return true;
      }
      if (["1", "treat", "potion"].includes(choice)) {
        if ((inventory.potion || 0) < 1) {
          print("You need a potion for that. Choose the route-notes option, or leave for now.");
          continue;
        }
        removeItem("potion", 1);
        WORLD.rested = 1;
        print("The scout steadies. You escort them to camp, and they'll warn travelers about the broken road.");
        print("Your next battle starts rested.");
        break;
      }
      if (["2", "notes", "map", "search"].includes(choice)) {
        addItem("clockwork spring", 1);
        noteQuestCollect();
        print("Your route notes get the scout moving. You salvage a clockwork spring from the damaged signal lantern.");
        break;
      }
      print("Choose 1 to spend a potion, 2 to share your notes, or 0 to leave.");
    }
    WORLD.flags.frontier_scout_guided = true;
    tryTurnInQuests();
    return true;
  }
  return false;
}

function rollExploreDiscovery(availableEncounters) {
  if (Math.random() > 0.38) return null;
  const table = ["chest", "trap", "merchant", "camp", "npc", "riddle", "cache", "scrap", "forage", "shrine", "echo"];
  if ((PLAYER.ngPlus || 0) > 0 && WORLD.flags.ngEchoChapter !== STORY.chapter) table.push("ng_echo", "ng_echo");
  if (STORY.chapter === 0 && availableEncounters.includes("mossling")) {
    if (!WORLD.flags.quiet_waystone_resolved) table.push("quiet_waystone", "quiet_waystone");
    if (!WORLD.flags.trapped_messenger_resolved) table.push("trapped_messenger", "trapped_messenger");
    if (questState("roots_under_wayrest").status === "active" && PLAYER.level >= enemyRequiredLevel("mossback guardian"))
      table.push("mossback_lair", "mossback_lair", "mossback_lair");
  }
  if (STORY.chapter >= 1) table.push("townhint");
  if (STORY.chapter >= 1 && questState("frontier_signal").status === "active" && !WORLD.flags.frontier_scout_guided)
    table.push("lost_scout", "lost_scout");
  if (availableEncounters.includes("index hound") && questState("unwritten_index").status === "active" && !WORLD.flags.archive_index_resolved)
    table.push("index_hound", "index_hound");
  if (availableEncounters.includes("glasswing moth") && !WORLD.flags.starfall_cache_opened) table.push("starfall", "starfall");
  if (availableEncounters.includes("ashbound sentinel") && !WORLD.flags.ash_reliquary_opened) table.push("ash_reliquary", "ash_reliquary");
  if (availableEncounters.includes("hollow sentinel") && questState("far_edges").status === "active" && PLAYER.level >= enemyRequiredLevel("the lost cartographer"))
    table.push("lost_atlas", "lost_atlas");
  if (availableEncounters.includes("frontier outrider") && !WORLD.flags.frontier_signal_cache_found) table.push("signal_cache", "signal_cache");
  if (availableEncounters.includes("bellbound cantor") && questState("silent_bell").status === "active" && PLAYER.level >= enemyRequiredLevel("the bell without a tongue"))
    table.push("silent_bell", "silent_bell");
  if (availableEncounters.length >= 2) table.push("raid");
  return table[randint(0, table.length - 1)];
}

function exploreDiscoveryLabel(kind) {
  return ({
    chest: "open the half-buried chest", ng_echo: "follow a memory from your previous ending", trap: "cross the unstable ground", merchant: "visit the travelling merchant",
    camp: "rest at the abandoned camp", npc: "talk to the traveller", riddle: "solve the roadside riddle",
    cache: "search the strange crate", scrap: "salvage the wreck", forage: "gather roadside supplies",
    shrine: "approach the roadside shrine", echo: "listen to the memory echo", townhint: "follow the smoke toward town",
    raid: "intercept the discovered raiding party",
    lost_scout: "follow the scout's signal flare",
    index_hound: "follow the Index Hound's trail",
    starfall: "investigate the fallen star",
    ash_reliquary: "search beneath the Cathedral altar",
    lost_atlas: "follow the atlas to the edge of the kingdom",
    signal_cache: "search the broken signal lantern",
    silent_bell: "follow the sound of the silent bell",
    quiet_waystone: "investigate the fallen waystone",
    trapped_messenger: "help the courier trapped beneath the handcart",
    mossback_lair: "follow the roots to the Mossback Guardian's lair",
  })[kind] || "investigate the discovery";
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
  PLAYER.ngPlusEnding = STORY.ending;
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
  if (typeof recordStoryMoment === "function") recordStoryMoment(`New Game+ began with an echo of the "${PLAYER.ngPlusEnding}" ending.`, "ending", PLAYER.ngPlusEnding);
  if (PLAYER.ngPlusEnding === "remember") {
    PLAYER.vit = Math.min(25, PLAYER.vit + 2);
    print("🌿 Ending bonus: Remember — +2 Vitality for this New Game+ run.");
  } else if (PLAYER.ngPlusEnding === "release") {
    addItem("coin", 150);
    print("🕊️ Ending bonus: Release — you begin with 150 extra coin.");
  } else if (PLAYER.ngPlusEnding === "rewrite") {
    if (SPELLS["static bind"] && !PLAYER.spells.includes("static bind")) PLAYER.spells.push("static bind");
    print("✒️ Ending bonus: Rewrite — Static Bind is available from the beginning.");
  }
  print(`\n🔁 New Game+ ${PLAYER.ngPlus} begins. This is not your completed file.`);
  print("🗺️ Type 'explore' to begin again. The Quiet Road remembers you.");
  unlockAchievement("ng");
  storyIntro();
}

async function runDungeon() {
  if (WORLD.towerRun?.active) {
    print("Finish or retire from your current tower run before entering the dungeon.");
    return;
  }
  if (WORLD.dungeonRun?.active) {
    print("A dungeon run is already in progress. Type 'dungeon' to continue it.");
  }
  const pool = Object.keys(monsters).filter((name) =>
    monsters[name].chance > 0 && PLAYER.level >= enemyRequiredLevel(name) &&
    (!monsters[name].secret_flag || STORY.flags.has(monsters[name].secret_flag))
  );
  if (!pool.length) {
    print("No dungeon foes are available at your current level.");
    return;
  }
  if (!WORLD.dungeonRun?.active) {
    const stats = getStats();
    WORLD.dungeonRun = {
      active: true,
      floor: 0,
      hp: stats.max_hp,
      energy: Math.min(C.START_ENERGY, maxEnergy()),
    };
    print("\n🏰 THE SUNDERED DEPTHS");
    print("Five floors. Your HP and energy carry forward; supplies remain usable.");
  }
  const run = WORLD.dungeonRun;
  while (run.floor < 5) {
    if (run.hp <= 0 || run.abandoned) {
      WORLD.dungeonRun = null;
      print("The dungeon run ends here. Recover in town and try again when you're ready.");
      return;
    }
    run.floor = Math.max(0, Math.min(5, parseInt(run.floor) || 0));
    const floor = run.pending ? (run.pendingFloor || run.floor + 1) : run.floor + 1;
    const bosses = !run.pending && floor === 5
      ? Object.keys(monsters).filter((name) => monsters[name].chance <= 0 && !BOSS_CH[name] && PLAYER.level >= enemyRequiredLevel(name) && (!monsters[name].secret_flag || STORY.flags.has(monsters[name].secret_flag)))
      : [];
    const foe = run.pending
      ? String(run.pendingFoe || "").split(",").filter(Boolean)
      : [bosses.length
        ? wchoice(bosses, bosses.map(() => 1))
        : wchoice(pool, pool.map((name) => monsters[name].chance))];
    if (!foe.length) foe.push(pool[0]);
    if (!run.pending && run.pushNext) {
      for (let i = 0; i < 2; i++) foe.push(wchoice(pool, pool.map((name) => Math.max(1, monsters[name].chance))));
      run.pushNext = false;
      run.lootBonus = true;
      print("⚠️ Push challenge: two extra enemies join the fight!");
    }
    const elite = run.pending ? !!run.pendingElite : floor === 3 || (floor === 5 && !bosses.length);
    if (!run.pending) {
      run.pending = true;
      run.pendingFloor = floor;
      run.pendingFoe = foe.join(",");
      run.pendingElite = elite;
    }
    print(`\n━━ FLOOR ${floor}/5 ━━`);
    if (floor === 3) print("⚠️ A tougher elite guards the middle floor!");
    if (floor === 5) print(elite ? "👑 The final floor is an elite challenge!" : "👑 A dungeon boss waits below!");
    await fightMonster(foe, elite);
    if (run.lootBonus && !run.abandoned && run.hp > 0) run.lootBonus = false;
    if (run.hp <= 0 || run.abandoned) {
      WORLD.dungeonRun = null;
      print(`The run ended on floor ${floor}.`);
      return;
    }
    run.floor = floor;
    run.pending = false;
    delete run.pendingFloor;
    delete run.pendingFoe;
    delete run.pendingElite;
    if (floor < 5) {
      while (true) {
        const answer = (await input("Between floors: rest to recover 12% HP and 2 energy, push into a group fight for extra loot and coin, or retire? [rest/push/retire] ")).trim().toLowerCase();
        if (["rest", "r"].includes(answer)) {
          const stats = getStats();
          const beforeHp = run.hp;
          const beforeEnergy = run.energy;
          const heal = Math.max(1, Math.floor(stats.max_hp * 0.12));
          run.hp = Math.min(stats.max_hp, run.hp + heal);
          run.energy = Math.min(maxEnergy(), run.energy + 2);
          print(`🛏️ You recover ${run.hp - beforeHp} HP and ${run.energy - beforeEnergy} energy. (${run.hp}/${stats.max_hp} HP)`);
          break;
        }
        if (["push", "p", "continue", ""].includes(answer)) {
          run.pushNext = true;
          print("You press deeper without recovering. The next floor has two extra enemies; each defeated enemy gives bonus loot and level-scaled coin.");
          break;
        }
        if (["retire", "quit", "q"].includes(answer)) {
          WORLD.dungeonRun = null;
          print(`You retire after floor ${floor}. The run ends without the clear reward.`);
          return;
        }
        print("Choose 'rest', 'push', or 'retire'.");
      }
    }
  }
  WORLD.dungeonRun = null;
  const reward = 100 + PLAYER.level * 15;
  addItem("coin", reward);
  print(`🏆 Dungeon cleared! Bonus reward: ${reward} coin.`);
  WORLD.flags.dungeonCleared = (WORLD.flags.dungeonCleared || 0) + 1;
  if (typeof checkAchievements === "function") checkAchievements();
}

async function runTower() {
  if (WORLD.dungeonRun?.active) {
    print("Finish the current dungeon run before entering the tower.");
    return;
  }
  const pool = Object.keys(monsters).filter((name) =>
    monsters[name].chance > 0 && PLAYER.level >= enemyRequiredLevel(name) &&
    (!monsters[name].secret_flag || STORY.flags.has(monsters[name].secret_flag))
  );
  if (!pool.length) {
    print("No arena foes are available at your current level.");
    return;
  }
  if (!WORLD.towerRun?.active) {
    const stats = getStats();
    WORLD.towerRun = { active: true, wave: 0, hp: stats.max_hp, energy: Math.min(C.START_ENERGY, maxEnergy()) };
    print("\n🏟️ THE ENDLESS TOWER");
    print("Waves grow stronger. HP and energy carry between fights. Retire to bank your score.");
  } else print(`Resuming at wave ${WORLD.towerRun.wave + 1}.`);

  const run = WORLD.towerRun;
  const record = (score) => {
    try {
      const key = "the-last-save.tower-leaderboard.v1";
      const board = JSON.parse(localStorage.getItem(key) || "[]");
      const entry = { wave: score, level: PLAYER.level, ending: STORY.ending || "none", date: new Date().toISOString() };
      board.push(entry);
      board.sort((a, b) => b.wave - a.wave);
      const top = board.slice(0, 10);
      localStorage.setItem(key, JSON.stringify(top));
      WORLD.flags.towerBest = Math.max(WORLD.flags.towerBest || 0, score);
      print("\n📜 TOWER LEADERBOARD (this browser)");
      top.forEach((row, i) => print(`${i + 1}. Wave ${row.wave} · Lv ${row.level} · ${row.ending}`));
    } catch (e) {
      WORLD.flags.towerBest = Math.max(WORLD.flags.towerBest || 0, score);
      print(`Personal best: wave ${WORLD.flags.towerBest}. Browser storage is unavailable for the leaderboard.`);
    }
  };
  while (true) {
    if (run.hp <= 0 || run.abandoned) {
      const score = Math.max(0, run.wave - (run.abandoned ? 1 : 0));
      WORLD.towerRun = null;
      print(`The tower run ends at wave ${score}.`);
      record(score);
      return;
    }
    const wave = run.wave + 1;
    const foe = run.pending ? run.pendingFoe : wchoice(pool, pool.map((name) => monsters[name].chance));
    if (!run.pending) {
      run.pending = true;
      run.pendingFoe = foe;
      run.pendingElite = wave % 5 === 0;
    }
    print(`\n━━ WAVE ${wave} ━━`);
    if (wave % 5 === 0) print("👑 Elite wave!");
    await fightMonster(foe, !!run.pendingElite);
    if (run.hp <= 0 || run.abandoned) continue;
    run.wave = wave;
    run.pending = false;
    delete run.pendingFoe;
    delete run.pendingElite;
    if (wave % 5 === 0) {
      const reward = wave * 20;
      const relics = [];
      addItem("coin", reward);
      if (wave >= 5 && !inventory["glass edge"]) {
        addItem("glass edge", 1);
        relics.push("Glass Edge");
      }
      if (wave >= 10 && !inventory["stormglass charm"]) {
        addItem("stormglass charm", 1);
        relics.push("Stormglass Charm");
      }
      print(`🏅 Milestone reward: ${reward} coin${relics.length ? ` and ${relics.join(" + ")}` : ""}.`);
    }
    while (true) {
      const answer = (await input(`Wave ${wave} cleared. Continue or retire? [continue/retire] `)).trim().toLowerCase();
      if (["continue", "c", "yes", "y", ""].includes(answer)) break;
      if (["retire", "r", "stop", "no"].includes(answer)) {
        const reward = wave * 10;
        addItem("coin", reward);
        WORLD.towerRun = null;
        print(`You retire from the tower and bank ${reward} coin.`);
        record(wave);
        return;
      }
      print("Choose 'continue' or 'retire'.");
    }
  }
}

async function chooseRoute() {
  const area = STORY_CHAPTERS[STORY.chapter]?.area || "the Quiet Road";
  if (WORLD.flags.routeVisitedChapter === STORY.chapter) {
    print(`You have already chosen a route through ${area}. The map will open when the next region does.`);
    return;
  }
  print(`\n🗺️ ${area.toUpperCase()}`);
  print("Wayrest ──┬── Safe road ── supplies and a slower passage");
  print("          └── Risky shortcut ── an elite encounter and a faster route");
  while (true) {
    const choice = (await input("Choose safe road or risky shortcut [safe/risky]: ")).trim().toLowerCase();
    if (["safe", "road", "s"].includes(choice)) {
      WORLD.flags.routeChoices = WORLD.flags.routeChoices || [];
      WORLD.flags.routeChoices.push("safe");
      if (WORLD.flags.routeChoices.filter((route) => route === "safe").length === 3) {
        WORLD.flags.safeRoadNetwork = true;
        print("Your third safe road connects a supply network. Future safe routes will offer stronger recovery.");
      }
      const heal = Math.max(1, Math.floor(getStats().max_hp * (WORLD.flags.safeRoadNetwork ? 0.14 : 0.08)));
      WORLD.flags.routeVisitedChapter = STORY.chapter;
      if (typeof recordStoryMoment === "function") recordStoryMoment(`You took the safe road through ${area}.`, "choice", "safe");
      if (WORLD.dungeonRun?.active || WORLD.towerRun?.active) {
        const run = WORLD.dungeonRun?.active ? WORLD.dungeonRun : WORLD.towerRun;
        run.hp = Math.min(getStats().max_hp, run.hp + heal);
        print(`You take the safe road and recover ${heal} HP (${run.hp}/${getStats().max_hp}).`);
      } else {
        addItem("potion", 1);
        print("You take the safe road and find a potion for the next encounter.");
      }
      return;
    }
    if (["risky", "shortcut", "r"].includes(choice)) {
      const pool = Object.keys(monsters).filter((name) => monsters[name].chance > 0 && PLAYER.level >= enemyRequiredLevel(name) && (!monsters[name].secret_flag || STORY.flags.has(monsters[name].secret_flag)));
      if (!pool.length) {
        print("No shortcut encounters are available yet.");
        return;
      }
      const foe = wchoice(pool, pool.map((name) => monsters[name].chance));
      WORLD.flags.routeChoices = WORLD.flags.routeChoices || [];
      WORLD.flags.routeChoices.push("risky");
      if (WORLD.flags.routeChoices.filter((route) => route === "risky").length === 3) {
        WORLD.flags.fractureTrail = true;
        print("Your third shortcut leaves a fracture trail. The map marks these dangerous paths for future journeys.");
      }
      WORLD.flags.routeVisitedChapter = STORY.chapter;
      if (typeof recordStoryMoment === "function") recordStoryMoment(`You took the risky shortcut through ${area}.`, "choice", "risky");
      print(`You cut through the dangerous shortcut. An elite ${title(foe)} blocks the way!`);
      await fightMonster(foe, true);
      return;
    }
    print("Choose 'safe' or 'risky'.");
  }
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


