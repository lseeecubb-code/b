// Central scene registry for THE LAST SAVE.
//
// All monster openings, opening cinematics, attack triggers, and attack visual recipes live here.
// Monsters stay focused on combat data; this file decides which scene a combat event triggers.

const GAME_SCENES = {
  openings: {
  // ===== Chapter bosses =====
  "goblin king": {
    title: "THE CROWN BREAKS",
    lines: [
      "The goblin court falls silent.",
      "Its king rises, blood bright along the broken crown.",
      "Kneel, and I may remember your name.",
    ],
    scene: "crown", sub: "Every crown is heavier than it looks.",
  },
  "alpha wolf": {
    title: "THE PACK ANSWERS",
    lines: [
      "A howl rolls across the battlefield.",
      "Moonlight gathers in the alpha’s eyes.",
      "The hunt ends with you.",
    ],
    scene: "fang",
  },
  "orc warlord": {
    title: "IRONBLOOD",
    lines: [
      "The war drums stop.",
      "The warlord lifts its scarred axe.",
      "You wanted the strongest. Here I am.",
    ],
    scene: "quake", color: "#e0603c", sub: "Iron, blood and one very loud drum.",
  },
  "ancient golem": {
    title: "CORE UNBOUND",
    lines: [
      "The stone floor splits open.",
      "A molten heart ignites beneath the ancient armor.",
      "THREAT DETECTED. CONTAINMENT FAILED.",
    ],
    effect: "fracture",
    scene: "quake", color: "#ff9a3c", sub: "Containment has failed.",
  },
  "frost giant king": {
    title: "RIMEHEART",
    lines: [
      "The air turns painfully still.",
      "The giant king steps from the blizzard, frost crawling over its crown.",
      "The last warmth leaves this world now.",
    ],
    effect: "glitch",
    scene: "frost", sub: "The last warmth leaves this world.",
  },
  "ash demon": {
    title: "CINDERHEART",
    lines: [
      "Ash falls upward into a burning sky.",
      "The demon unfolds from the fire.",
      "Feed the flame with your fear.",
    ],
    effect: "fracture",
    scene: "ember", color: "#ff5a3c", sub: "Feed the flame with your fear.",
  },
  "the unnamed king": {
    title: "THE EMPTY THRONE",
    lines: [
      "A crown appears above a throne with no kingdom.",
      "A voice speaks from the dark between the stones.",
      "There is no world here to save.",
    ],
    effect: "glitch",
    scene: "crown", color: "#c9a8ff", sub: "A throne without a kingdom.",
  },
  "the leftover": {
    title: "THE UNFINISHED REMNANT",
    lines: [
      "The terminal hesitates, as if a line failed to load.",
      "Something unfinished drags itself into the story.",
      "You cannot leave me as a footnote.",
    ],
    effect: "tear",
    scene: "page", color: "#ff9ad5", sub: "Not everything gets finished.",
  },
  "the watcher": {
    title: "THE UNBLINKING EYE",
    lines: [
      "Every sound cuts out.",
      "A single eye opens across the screen.",
      "I have already seen how you lose.",
    ],
    effect: "glitch",
    scene: "umbra", color: "#ff6b6b", sub: "I have already seen how you lose.",
  },
  "the witness": {
    title: "THE TESTIMONY",
    lines: [
      "A page turns by itself.",
      "The witness steps forward, surrounded by burning script.",
      "This encounter will be entered into evidence.",
    ],
    effect: "fracture",
    scene: "ember", color: "#ffd27a", sub: "This will be entered into evidence.",
  },
  "the archivist": {
    title: "THE LIVING INDEX",
    lines: [
      "The shelves stretch beyond the edge of the terminal.",
      "A figure closes a book and marks your name.",
      "Your ending has already been catalogued.",
    ],
    effect: "tear",
    scene: "page", color: "#e8dcb0", sub: "Filed under: inevitable.",
  },
  "the first hero": {
    title: "THE LAST TRIAL",
    lines: [
      "A familiar silhouette waits beneath a pale light.",
      "The hero raises their weapon in salute.",
      "Show me what you became.",
    ],
    scene: "toll", color: "#ffd45e", sub: "Show me what you became.",
  },
  "the editor": {
    title: "THE REDLINE",
    lines: [
      "The command prompt blinks out of rhythm.",
      "Red marks crawl across the page.",
      "This scene needs a few corrections.",
    ],
    effect: "fracture",
    scene: "redline",
  },
  "the author": {
    title: "THE AUTHOR’S DRAFT",
    lines: [
      "The screen fills with an unfinished sentence.",
      "A figure steps out from between the words.",
      "I decide what happens next.",
    ],
    effect: "tear",
    scene: "map", color: "#bfa8ff", sub: "I decide what happens next.",
  },
  "the last save": {
    // Keeps its full-screen reality cut instead of a scene.
    title: "THE FINAL OVERWRITE",
    terminal_cut: true,
    lines: [
      "The terminal dims. The save icon flickers once.",
      "A final presence reaches through the screen.",
      "No checkpoint. No retry. Let us begin.",
    ],
    effect: "tear",
  },

  // ===== Secret bosses =====
  "mossback guardian": {
    title: "THE ROAD REMEMBERS",
    lines: [
      "The moss along the roadside stops moving.",
      "Roots lift the paving stones one at a time, clearing a path for something heavy.",
      "Wayrest forgot what this road was built to hold back.",
    ],
    scene: "quake", color: "#9fd47a", sub: "Roots remember every footstep.",
  },
  "the lost cartographer": {
    title: "OFF THE EDGE OF THE MAP",
    lines: [
      "Your map redraws itself while you watch.",
      "A figure steps out of the blank space past the border, inking in a road that was never there.",
      "Turn back. The legend only ends one way.",
    ],
    effect: "glitch", scene: "map",
  },
  "the bell without a tongue": {
    title: "THE UNRUNG BELL",
    lines: [
      "A bell hangs in the nave with no clapper and no rope.",
      "It rings anyway. Dust shivers off the pews with every note you cannot hear.",
      "The sound arrives before the bell does.",
    ],
    scene: "toll",
  },
  "the missing page": {
    title: "THE MARGIN'S MISSING LINE",
    lines: [
      "A blank line appears where the terminal should end.",
      "Ink gathers into a figure that was never written.",
      "You found the page that the story removed.",
    ],
    effect: "fracture", scene: "page",
  },
  "the echo of attempts": {
    title: "SAVE ECHO DETECTED",
    lines: [
      "Three old signals collapse into one.",
      "A familiar silhouette loads from the wrong save.",
      "It remembers the last move you made.",
    ],
    effect: "glitch", scene: "echo",
  },

  // ===== Multi-form and late-game bosses =====
  "margin warden": {
    title: "THE FINAL ERRATA",
    lines: [
      "A thin red line draws itself along the edge of the page.",
      "The warden lifts a pen like a blade and begins to correct the room.",
      "Everything beyond this line is a mistake.",
    ],
    effect: "fracture", scene: "redline",
  },
  "archive stalker": {
    title: "THE MISSING CHAPTER",
    lines: [
      "The shelves go quiet one row at a time.",
      "Something cut from every table of contents turns to look at you.",
      "Your name is already in its index.",
    ],
    effect: "glitch", scene: "umbra",
  },
  "ashbound sentinel": {
    title: "THE CINDER BELLGUARD",
    lines: [
      "Ash drifts down from a bell that stopped ringing long ago.",
      "The sentinel rises from the embers, its censer swinging in time with nothing.",
      "The nave is sealed. The oath remains.",
    ],
    scene: "ember",
  },
  "hollow sentinel": {
    title: "THE UNFINISHED GUARD",
    lines: [
      "Armor stands in the throne room, still keeping a watch no one ordered.",
      "It turns slowly, as if the oath had to be remembered first.",
      "The throne is empty. The post is not.",
    ],
    scene: "crown", color: "#cfd8ea", sub: "A vow outlasts the one who swore it.",
  },
  "mire witch": {
    title: "THE DROWNED ORACLE",
    lines: [
      "Mist climbs out of the bog and stops at your knees.",
      "The witch rises with blackwater streaming from her sleeves.",
      "The mire keeps what it takes.",
    ],
    scene: "umbra", color: "#7fb89a", sub: "The water remembers everyone.",
  },
  "index hound": {
    title: "THE HOUND OF PAGES",
    lines: [
      "Loose pages skitter across the floor, all pointing the same way.",
      "They knit into a hound, ink dripping from its jaws.",
      "The catalogue has already chosen its keeper.",
    ],
    scene: "redline", color: "#e8c46b", sub: "Find the line. Lose your place.",
  },
  "glasswing moth": {
    title: "THE STAR-DRINKER",
    lines: [
      "One by one, the stars above the ruin go out.",
      "A moth with wings of cracked glass settles over the dark, glowing with what it swallowed.",
      "The star belongs to the dark now.",
    ],
    scene: "frost", color: "#e8d8ff", sub: "It drinks light. You are next.",
  },

  // ===== Dangerous regular monsters =====
  "ancient dragon": {
    title: "THE FIRST FLAME",
    lines: [
      "The cavern floor glows from below.",
      "Something older than the kingdom unfolds its wings, and the air catches fire.",
      "You are not the first to stand here. You are only the latest.",
    ],
    effect: "fracture", scene: "ember", color: "#ffb347", sub: "Older than the kingdom. Hotter than the sun.",
  },
  werewolf: {
    title: "BENEATH THE FULL MOON",
    lines: [
      "The clouds part. The night turns silver.",
      "A howl starts as a man's voice and ends as something else.",
      "Run if you like. It is faster.",
    ],
    scene: "fang",
  },
  lich: {
    title: "THE LAST ROLL CALL",
    lines: [
      "The torches gutter blue, one by one.",
      "Names are whispered from bones that remember being called.",
      "Yours joins the list.",
    ],
    scene: "umbra", color: "#7fe3b0", sub: "Death is only a long silence.",
  },
  dragon: {
    title: "THE SKY CATCHES FIRE",
    lines: [
      "A shadow passes over the battlefield.",
      "The dragon descends through a storm of sparks.",
      "The sky belongs to me.",
    ],
    scene: "ember", sub: "The sky catches fire.",
  },
  "ancient dragon": {
    title: "AN OLDER FLAME",
    lines: [
      "The cavern answers with a sound like distant thunder.",
      "Something ancient opens one burning eye.",
      "You are standing inside a legend's shadow.",
    ],
    effect: "fracture", scene: "ember", color: "#ffb347", sub: "Older than the kingdom.",
  },
  wyvern: {
    title: "WINGS OVER THE FRONTIER",
    lines: [
      "Dust tears across the road as a wingbeat hits.",
      "A wyvern wheels overhead, then dives.",
      "The next heartbeat belongs to the hunt.",
    ],
    scene: "fang", color: "#ffd27a", sub: "Look up too late.",
  },
  lich: {
    title: "THE DEAD REMEMBER",
    lines: [
      "The torches dim without going out.",
      "A crown of cold blue fire gathers around the lich.",
      "Death has a memory, and it remembers you.",
    ],
    scene: "umbra", color: "#7fe3b0", sub: "Death remembers.",
  },
  "stone golem": {
    title: "THE MOUNTAIN MOVES",
    lines: [
      "The ground becomes strangely quiet.",
      "Stone grinds against stone as a giant figure stands.",
      "The mountain has decided to walk.",
    ],
    scene: "quake", color: "#c9b38b", sub: "The mountain moves.",
  },
  troll: {
    title: "BRIDGE-BREAKER",
    lines: [
      "The road shakes before you see why.",
      "A troll steps from the dust and blocks the crossing.",
      "Pay the toll in courage.",
    ],
    scene: "quake", color: "#d39f72", sub: "Something big is coming.",
  },
  vampire: {
    title: "RED WITHOUT SUNLIGHT",
    lines: [
      "Every shadow turns toward the same doorway.",
      "A pale figure steps into the moonless dark.",
      "Your pulse has already given you away.",
    ],
    scene: "umbra", color: "#ff7c99", sub: "The dark can hear your heartbeat.",
  },
  demon: {
    title: "HELLFIRE OPENS",
    lines: [
      "Heat rolls across the floor without a flame.",
      "A horned silhouette steps through a seam of fire.",
      "The world smells of ash again.",
    ],
    scene: "ember", color: "#ff7048", sub: "Hellfire has found the page.",
  },
  "frost giant": {
    title: "WINTER STANDS UP",
    lines: [
      "The snow ahead of you is not a drift.",
      "It rises, shedding ice like a cloak, each step cracking the frozen lake beneath.",
      "It has waited a long time for someone to wake it.",
    ],
    scene: "frost",
  },
},

  openingVisuals: {
    frost: { color: "#bfe8ff", sub: "The air forgets how to move.", ms: 3100, sound: "openFrost" },
    ember: { color: "#ff8a3c", sub: "Something old is still burning.", ms: 3100, sound: "openEmber" },
    quake: { color: "#d6c1a0", sub: "The ground remembers its weight.", ms: 3100, sound: "openQuake" },
    umbra: { color: "#b48cff", sub: "It was watching before you arrived.", ms: 3300, sound: "openUmbra" },
    crown: { color: "#ffd45e", sub: "Every throne is a promise someone broke.", ms: 3500, sound: "openCrown" },
    redline: { color: "#ff6b6b", sub: "Your story is under revision.", ms: 3500, sound: "openRedline" },
    fang: { color: "#e9edff", sub: "The hunt began before your first step.", ms: 2700, sound: "openFang" },
    echo: { color: "#7fffe0", sub: "You have been here before.", ms: 3500, sound: "openEcho" },
    page: { color: "#ffffff", sub: "Something was removed from this chapter.", ms: 3500, sound: "openPage" },
    toll: { color: "#ffb36b", sub: "Something rang. Nothing struck it.", ms: 3400, sound: "openToll" },
    map: { color: "#8fe3c0", sub: "Every road ends where you stop looking.", ms: 3500, sound: "openMap" },
  },

  // Monster name -> attack name -> attack scene key.
  attacks: {
    "goblin king": {
      "crown cleaver": "crown-shards",
    },
    "alpha wolf": {
      "lunar pounce": "moon-pounce",
    },
    "ancient golem": {
      "molten fist": "core-eruption",
    },
    "frost giant king": {
      whiteout: "whiteout",
    },
    "ash demon": {
      "cinder eruption": "cinder-collapse",
    },
    dragon: {
      "fire breath": "dragon-flame",
      earthquake: "ground-rift",
      "dragon roar": "dragon-roar",
    },
    "ancient dragon": {
      inferno: "dragon-flame",
      cataclysm: "cataclysm",
      "wing storm": "wing-storm",
    },
    wyvern: {
      "fire breath": "dragon-flame",
      "wing strike": "wing-storm",
    },
    lich: {
      "soul bolt": "soul-bolt",
      "death grip": "soul-grip",
      "plague cloud": "plague-cloud",
    },
    "stone golem": {
      "stone fist": "stone-fist",
      "ground shock": "ground-rift",
    },
    troll: {
      "club smash": "ground-rift",
      "ground slam": "earth-shatter",
    },
    vampire: {
      "blood bite": "blood-bite",
      "bat swarm": "bat-swarm",
    },
    demon: {
      hellfire: "hellfire",
      curse: "void-curse",
      "life drain": "soul-drain",
    },
    ogre: {
      "club smash": "ground-rift",
      roar: "ogre-roar",
    },
    berserker: {
      frenzy: "frenzy",
      "reckless swing": "berserker-swing",
    },
    "the unnamed king": {
      "forgotten decree": "royal-decree",
      "erase name": "name-erasure",
      godfall: "godfall",
    },
    "the leftover": {
      "missing texture": "missing-texture",
      "invalid state": "invalid-state",
      "out of bounds": "out-of-bounds",
    },
    "the watcher": {
      observe: "watcher-gaze",
      prediction: "watcher-gaze",
      counterfactual: "counterfactual",
    },
    "the witness": {
      remember: "memory-flash",
      forget: "memory-flash",
      "fourth wall": "fourth-wall",
    },
    "the archivist": {
      "cross reference": "index-beam",
      "overdue notice": "index-beam",
      "sealed vault": "sealed-vault",
    },
    "the first hero": {
      "familiar strike": "hero-slash",
      "worn out sword": "hero-slash",
      "last attempt": "hero-finale",
    },
    "the editor": {
      strikethrough: "redline-slice",
      redact: "redline-slice",
      "delete scene": "page-erasure",
    },
    "the author": {
      "plot twist": "page-storm",
      "writer's block": "ink-storm",
      "deus ex machina": "author-decree",
    },
    "the last save": {
      autosave: "save-pulse",
      corrupt: "corruption-wave",
      overwrite: "logo-fall",
      "erase the timeline": "page-erasure",
      "restore corrupted data": "corruption-wave",
      "forced shutdown": "void-pulse",
    },
    "the missing page": {
      "burn the margins": "redline-slice",
    },
    "the echo of attempts": {
      "repeat the ending": "void-pulse",
      "overwrite the attempt": "logo-fall",
    },
  },

  // Visual recipe for attack scenes. Effects code renders these recipes.
  attackVisuals: {
    "logo-fall": { glyphs: ["THE LAST SAVE", "LAST SAVE", "LS"], count: 18, duration: 2250 },
    "crown-shards": { glyphs: ["♛", "◆", "╱", "✦"], count: 26, duration: 1800 },
    "moon-pounce": { glyphs: ["☾", "╱", "／", "✧"], count: 12, duration: 1450 },
    "core-eruption": { glyphs: ["◆", "▲", "✦", "●"], count: 24, duration: 1900 },
    whiteout: { glyphs: ["❄", "✧", "░", "❅"], count: 30, duration: 1900 },
    "cinder-collapse": { glyphs: ["✦", "•", "▲", "╱"], count: 28, duration: 2100 },
    "page-storm": { glyphs: ["▤", "§", "¶", "▧"], count: 20, duration: 1900 },
    "redline-slice": { glyphs: [""], count: 7, duration: 1350 },
    "void-pulse": { glyphs: ["#", "0", "?", "∅"], count: 26, duration: 1800 },
    "dragon-flame": { glyphs: ["🔥", "◆", "▲", "✦"], count: 30, duration: 2050 },
    "ground-rift": { glyphs: ["╱", "╲", "◆", "▲"], count: 20, duration: 1750 },
    "dragon-roar": { glyphs: ["!!!", "≋", "⚡", "◆"], count: 16, duration: 1650 },
    "wing-storm": { glyphs: ["≋", "／", "╱", "✧"], count: 24, duration: 1650 },
    "cataclysm": { glyphs: ["☄", "◆", "▲", "✦"], count: 34, duration: 2300 },
    "soul-bolt": { glyphs: ["✦", "†", "·", "◆"], count: 22, duration: 1650 },
    "soul-grip": { glyphs: ["☠", "✋", "∅", "·"], count: 18, duration: 1700 },
    "plague-cloud": { glyphs: ["☠", "•", "◌", "·"], count: 32, duration: 1900 },
    "stone-fist": { glyphs: ["■", "◆", "░", "▒"], count: 18, duration: 1600 },
    "earth-shatter": { glyphs: ["▲", "◆", "╲", "╱"], count: 26, duration: 1850 },
    "blood-bite": { glyphs: ["🩸", "◆", "·", "╱"], count: 26, duration: 1700 },
    "bat-swarm": { glyphs: ["◼", "◾", "◆", "·"], count: 34, duration: 1800 },
    hellfire: { glyphs: ["🔥", "▲", "✦", "•"], count: 34, duration: 2100 },
    "void-curse": { glyphs: ["∅", "?", "#", "◇"], count: 28, duration: 1900 },
    "soul-drain": { glyphs: ["◉", "·", "✦", "∅"], count: 24, duration: 1850 },
    "ogre-roar": { glyphs: ["ROAR", "!!!", "≋", "◆"], count: 18, duration: 1550 },
    frenzy: { glyphs: ["╱", "╲", "✦", "!!"], count: 30, duration: 1500 },
    "berserker-swing": { glyphs: ["╱", "╲", "⚔", "✦"], count: 18, duration: 1450 },
    "royal-decree": { glyphs: ["KING", "◆", "♛", "═"], count: 22, duration: 1900 },
    "name-erasure": { glyphs: ["_", " ", "∅", "?"], count: 20, duration: 1750 },
    godfall: { glyphs: ["☄", "⚡", "♛", "✦"], count: 32, duration: 2250 },
    "missing-texture": { glyphs: ["░", "▒", "▓", "□"], count: 28, duration: 1750 },
    "invalid-state": { glyphs: ["ERROR", "NaN", "∅", "??"], count: 24, duration: 1800 },
    "out-of-bounds": { glyphs: ["↗", "↘", "╱", "∅"], count: 26, duration: 1950 },
    "watcher-gaze": { glyphs: ["◉", "●", "○", "?"], count: 18, duration: 1850 },
    counterfactual: { glyphs: ["IF", "THEN", "NOT", "∅"], count: 22, duration: 1950 },
    "memory-flash": { glyphs: ["MEMORY", "SAVE", "PAST", "◆"], count: 20, duration: 1750 },
    "fourth-wall": { glyphs: ["> YOU", "> WATCHER", "> PLAYER", "> HELLO"], count: 16, duration: 1950 },
    "index-beam": { glyphs: ["§", "p.", "#", "→"], count: 24, duration: 1800 },
    "sealed-vault": { glyphs: ["▣", "▥", "▦", "LOCK"], count: 26, duration: 2050 },
    "hero-slash": { glyphs: ["⚔", "✦", "╱", "／"], count: 20, duration: 1450 },
    "hero-finale": { glyphs: ["⚔", "★", "◆", "!!!"], count: 30, duration: 2100 },
    "page-erasure": { glyphs: ["DELETE", "▧", "✕", "∅"], count: 28, duration: 2050 },
    "ink-storm": { glyphs: ["✒", "•", "≈", "▤"], count: 30, duration: 1900 },
    "author-decree": { glyphs: ["WRITE", "GO", "END", "◆"], count: 22, duration: 2100 },
    "save-pulse": { glyphs: ["SAVE", "0%", "50%", "100%"], count: 20, duration: 1750 },
    "corruption-wave": { glyphs: ["ERR", "0x", "#", "∅"], count: 34, duration: 2000 },
  },
};

function normalizeSceneKey(value) {
  return String(value || "").replace(/^elite\s+/i, "").trim().toLowerCase();
}

function getMonsterOpening(monsterName) {
  return GAME_SCENES.openings[normalizeSceneKey(monsterName)] || null;
}

function getAttackScene(monsterName, attackName) {
  const monsterScenes = GAME_SCENES.attacks[normalizeSceneKey(monsterName)];
  if (!monsterScenes) return null;
  return monsterScenes[normalizeSceneKey(attackName)] || null;
}

const MONSTER_OPENINGS = GAME_SCENES.openings;
const BOSS_OPENINGS = MONSTER_OPENINGS;
