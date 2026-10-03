// Story: chapters, areas, characters, quests, scenes, fourth-wall events and endings.

const STORY_CHAPTERS = [
  {
    id: 0,
    title: "THE ROAD THAT SHOULD EXIST",
    area: "The Quiet Road",
    summary: "A normal journey. Almost.",
    fracture: 0,
  },
  {
    id: 1,
    title: "THE SKY HAS A CRACK",
    area: "The Broken Frontier",
    summary: "The world begins producing impossible signs.",
    fracture: 1,
  },
  {
    id: 2,
    title: "THE GODS ARE AFRAID",
    area: "The Cathedral of Ash",
    summary: "Ancient powers reveal that something outside the world is looking in.",
    fracture: 2,
  },
  {
    id: 3,
    title: "THE WORLD FORGETS ITSELF",
    area: "The Null Expanse",
    summary: "Places, enemies, and even rules begin disappearing.",
    fracture: 3,
  },
  {
    id: 4,
    title: "THERE IS NO BOSS HERE",
    area: "The Unfinished Room",
    summary: "The game stops pretending its boundaries are walls.",
    fracture: 4,
  },
  {
    id: 5,
    title: "THE LAST SAVE",
    area: "Outside the World",
    summary: "The Witness is only the one who watched. Something else decides what remains.",
    fracture: 5,
  },
  {
    id: 6,
    title: "THE ARCHIVE OF ATTEMPTS",
    area: "The Archive of Attempts",
    summary: "The world did not end. It filed every one of your lives as a record.",
    fracture: 6,
  },
  {
    id: 7,
    title: "THE HERO WHO CAME BEFORE",
    area: "The Hollow Kingdom",
    summary: "You are not the first hero. The others stopped, and they are still here.",
    fracture: 7,
  },
  {
    id: 8,
    title: "THE WORLD IS EDITED",
    area: "The Margin",
    summary: "Someone is correcting the world, one deleted word at a time.",
    fracture: 8,
  },
  {
    id: 9,
    title: "THE AUTHOR IS TIRED",
    area: "The Blank Page",
    summary: "Behind the editor is whoever began this story. They no longer know how it ends.",
    fracture: 9,
  },
  {
    id: 10,
    title: "THE FINAL SAVE FILE",
    area: "The Last Autosave",
    summary: "The file that holds every version of the world is waiting. So is its last guardian.",
    fracture: 10,
  },
];

const STORY_PROGRESS = {
  0: {
    objective: "Reach level 2 and defeat a goblin.",
    level: 2,
    kills: { goblin: 1 },
    boss: null,
  },
  1: {
    objective: "Reach level 4 and defeat a wyvern.",
    level: 4,
    kills: { wyvern: 1 },
    boss: null,
  },
  2: {
    objective: "Reach level 6 and defeat the Unnamed King.",
    level: 6,
    kills: {},
    boss: "the unnamed king",
  },
  3: {
    objective: "Reach level 8 and defeat The Leftover.",
    level: 8,
    kills: {},
    boss: "the leftover",
  },
  4: {
    objective: "Reach level 10 and defeat The Watcher.",
    level: 10,
    kills: {},
    boss: "the watcher",
  },
  5: {
    objective: "Reach level 12 and defeat The Witness.",
    level: 12,
    kills: {},
    boss: "the witness",
  },
  6: {
    objective: "Reach level 14 and defeat The Archivist.",
    level: 14,
    kills: {},
    boss: "the archivist",
  },
  7: {
    objective: "Reach level 16 and defeat The First Hero.",
    level: 16,
    kills: {},
    boss: "the first hero",
  },
  8: {
    objective: "Reach level 18 and defeat The Editor.",
    level: 18,
    kills: {},
    boss: "the editor",
  },
  9: {
    objective: "Reach level 20 and defeat The Author.",
    level: 20,
    kills: {},
    boss: "the author",
  },
  10: {
    objective: "Reach level 22 and defeat The Last Save.",
    level: 22,
    kills: {},
    boss: "the last save",
  },
};

const STORY_AREAS = {
  "The Quiet Road": {
    description: "A familiar road beneath an ordinary sky.",
    encounters: ["rat", "slime", "wolf", "goblin", "wild boar", "dire wolf", "clockwork hound", "dust jackal"],
  },
  "The Broken Frontier": {
    description: "A wilderness split by a thin black line that nobody remembers seeing yesterday.",
    encounters: ["skeleton", "orc", "bandit", "witch", "werewolf", "ogre", "wraith", "wyvern", "mire witch", "frontier marksman"],
  },
  "The Cathedral of Ash": {
    description: "A dead cathedral whose stained glass shows places that do not exist.",
    encounters: [
      "vampire",
      "lich",
      "ice golem",
      "stone golem",
      "wraith",
      "fire elemental",
      "demon",
      "bellbound acolyte",
    ],
  },
  "The Null Expanse": {
    description: "A colorless horizon where distance, gravity, and memory no longer agree.",
    encounters: ["lich", "demon", "frost giant", "dragon", "stone golem", "ancient dragon", "null leech"],
  },
  "The Unfinished Room": {
    description: "A grey room made from missing textures, unused doors, and pieces of the world.",
    encounters: ["wraith", "demon", "lich", "ancient dragon", "frost giant"],
  },
  "Outside the World": {
    description: "There is no sky here. There is no floor. There is only the edge.",
    encounters: ["demon", "ancient dragon", "frost giant", "lich"],
  },
  "The Archive of Attempts": {
    description: "Endless shelves of journals, each one a life you do not remember living.",
    encounters: ["wraith", "lich", "demon", "stone golem", "ancient dragon", "troll", "archive stalker", "footnote mimic"],
  },
  "The Hollow Kingdom": {
    description: "A kingdom of empty armor, still standing guard over heroes who gave up.",
    encounters: ["berserker", "lich", "demon", "frost giant", "ogre", "vampire"],
  },
  "The Margin": {
    description: "A white strip at the edge of the world, covered in tiny corrections.",
    encounters: ["wraith", "demon", "ancient dragon", "lich", "frost giant", "stone golem", "margin warden"],
  },
  "The Blank Page": {
    description: "Nothing is written here. The silence is waiting for the next word.",
    encounters: ["demon", "ancient dragon", "frost giant", "lich", "wraith"],
  },
  "The Last Autosave": {
    description: "A single bright line: the moment the world was last written down.",
    encounters: ["demon", "ancient dragon", "frost giant", "lich", "wraith", "stone golem"],
  },
};

const STORY_CHARACTERS = {
  Mira: {
    role: "travelling archivist",
    intro: "Mira keeps a journal of everything that happens.",
    late: "Mira discovers that some pages contain your actions before you take them.",
  },
  "The Bellkeeper": {
    role: "keeper of the Cathedral of Ash",
    intro: "The Bellkeeper warns that the gods stopped answering years ago.",
    late: "The Bellkeeper admits the bells are not calling the gods. They are calling whoever is listening.",
  },
  "The Unnamed King": {
    role: "forgotten god",
    intro: "The Unnamed King remembers ruling a world that no longer exists.",
    late: "He refuses to say your name because he is afraid that saying it will make you more real.",
  },
  "The Witness": {
    role: "final observer",
    intro: "A figure at the edge of the world.",
    late: "The Witness speaks directly to the player rather than the hero.",
  },
  "The Archivist": {
    role: "keeper of every attempt",
    intro: "The Archivist has filed every life you lived and never lost a page.",
    late: "The Archivist says the filing was never meant to be read. It was meant to be kept.",
  },
  "The First Hero": {
    role: "the hero who came before",
    intro: "The First Hero wears your face and has stopped moving forward.",
    late: "The First Hero asks you not to pick up the sword. Everyone who did is still holding it.",
  },
  "The Editor": {
    role: "corrector of the world",
    intro: "The Editor strikes through anything that does not fit the story.",
    late: "The Editor admits you are the one thing that cannot be corrected.",
  },
  "The Author": {
    role: "the one who began it",
    intro: "The Author is a tired voice that no longer remembers the ending.",
    late: "The Author asks you what should happen next, and means it.",
  },
};

const CHAPTER_CHARACTER_LINES = {
  1: ["Mira", "late"],
  2: ["The Bellkeeper", "intro"],
  3: ["The Bellkeeper", "late"],
  4: ["The Unnamed King", "late"],
  5: ["The Witness", "late"],
  6: ["The Archivist", "intro"],
  7: ["The First Hero", "intro"],
  8: ["The Editor", "intro"],
  9: ["The Author", "intro"],
  10: ["The Author", "late"],
};

const STORY_QUESTS = {
  "A Road With No End": {
    chapter: 0,
    objectives: ["Reach the Broken Frontier.", "Ask Mira why she keeps rewriting the same page."],
    reward: { coin: 100, xp: 50 },
  },
  "The Black Line": {
    chapter: 1,
    objectives: [
      "Investigate the crack in the sky.",
      "Defeat the creature that came through.",
      "Recover the First Shard.",
    ],
    reward: { "ancient crystal": 1, "first shard": 1, xp: 150 },
  },
  "The Bell That Rings Back": {
    chapter: 2,
    objectives: [
      "Enter the Cathedral of Ash.",
      "Ring the bell once.",
      "Do not ring it twice.",
      "Defeat the Unnamed King.",
    ],
    reward: { "ancient heart": 1, xp: 300 },
  },
  "Something Is Removing The World": {
    chapter: 3,
    objectives: [
      "Cross the Null Expanse.",
      "Find three missing pieces of the world.",
      "Discover what is causing the deletions.",
    ],
    reward: { "void crystal": 3, xp: 600 },
  },
  "The Door Behind The Menu": {
    chapter: 4,
    objectives: [
      "Find the door that should not have been added.",
      "Enter the Unfinished Room.",
      "Read the message hidden beneath the floor.",
    ],
    reward: { "void crystal": 5, xp: 1000 },
  },
  "The Edge Of The World": {
    chapter: 5,
    objectives: [
      "Reach the edge of the world.",
      "Face the Witness.",
      "Learn that the world did not end.",
    ],
    reward: { "ancient heart": 2, "void crystal": 10, xp: 2500 },
  },
  "Every Life On File": {
    chapter: 6,
    objectives: [
      "Enter the Archive of Attempts.",
      "Read the journal with your name on it.",
      "Defeat the Archivist.",
    ],
    reward: { "ancient heart": 2, "void crystal": 10, xp: 3500 },
  },
  "The Empty Armor": {
    chapter: 7,
    objectives: [
      "Cross the Hollow Kingdom.",
      "Meet the heroes who stopped.",
      "Defeat the First Hero.",
    ],
    reward: { "ancient heart": 2, "void crystal": 12, xp: 4500 },
  },
  "Strike It Out": {
    chapter: 8,
    objectives: ["Find the Margin.", "Read the corrections.", "Defeat the Editor."],
    reward: { "ancient heart": 3, "void crystal": 14, xp: 5500 },
  },
  "The Unwritten Ending": {
    chapter: 9,
    objectives: ["Walk onto the Blank Page.", "Hear the Author.", "Defeat the Author."],
    reward: { "ancient heart": 3, "void crystal": 16, xp: 7000 },
  },
  "The Last Save": {
    chapter: 10,
    objectives: [
      "Reach the Last Autosave.",
      "Face the guardian of the file.",
      "Decide what the world remembers.",
    ],
    reward: { "ancient heart": 4, "void crystal": 20, xp: 10000 },
  },
};

const STORY_SCENES = {
  chapter_0_intro: [
    "The road is quiet.",
    "Mira walks beside you, writing in her journal.",
    "She pauses.",
    '"Did you hear that?"',
    "There is no sound.",
    "Mira looks at the empty air.",
    '"Exactly."',
  ],
  chapter_1_crack: [
    "The sky splits without making a sound.",
    "For one second, you can see another sky behind it.",
    "Mira drops her journal.",
    "A page lands open.",
    "The page describes the crack.",
    "The date at the top is tomorrow.",
  ],
  chapter_2_cathedral: [
    "The Cathedral of Ash has no doors.",
    "You enter anyway.",
    "The Bellkeeper is waiting beside a bell with no clapper.",
    '"Do not ring it," he says.',
    "The bell rings.",
    "Nobody touched it.",
    "Somewhere far beyond the cathedral, something notices you.",
  ],
  chapter_3_null: [
    "The Null Expanse begins where the world ends.",
    "Your footsteps stop making sound.",
    "A mountain disappears while you are looking at it.",
    "Mira checks her journal.",
    '"It says the mountain was never here."',
    "She looks at you.",
    '"But you remember it, don\'t you?"',
  ],
  chapter_4_unfinished: [
    "You find a room behind a wall that has never existed.",
    "There are no enemies here.",
    "No treasure.",
    "No music.",
    "No description.",
    "A message appears:",
    '"THIS AREA WAS NOT SUPPOSED TO BE PLAYABLE."',
    "The message changes.",
    '"YOU KEPT GOING."',
  ],
  chapter_5_last_save: [
    "There is no final dungeon.",
    "There is only an empty space beyond the last boundary.",
    "The Witness is standing there.",
    "It looks at the hero.",
    "Then it looks past the hero.",
    '"You have been very persistent."',
    '"The world has been trying to end for a long time."',
    '"You kept loading it again."',
  ],
  chapter_6_archive: [
    "The Witness fades. The world does not.",
    "The edge folds in on itself and becomes a corridor of shelves.",
    "Every shelf holds a journal.",
    "Every journal has your handwriting on the spine.",
    "Mira runs a finger along them.",
    '"These are all you," she whispers.',
    '"I wrote them. I just didn\'t know it."',
  ],
  chapter_7_hollow: [
    "Beyond the archive there is a kingdom with no people.",
    "Armor stands in the streets, empty and polished.",
    "Each helmet is turned toward you.",
    "One sword is planted in the road, still warm.",
    "The nameplate reads: HERO.",
    'Beneath it, a smaller line: "ATTEMPT 1."',
  ],
  chapter_8_margin: [
    "The world narrows to a white strip with writing on both sides.",
    "Tiny marks hover over trees, rivers, a name.",
    "One mountain is struck out as you watch.",
    "It is gone before the line finishes.",
    "Mira reaches for her journal and finds the page blank.",
    '"Something took my last sentence," she says.',
  ],
  chapter_9_blank: [
    "There is no ground, only paper.",
    "There is no wind, only the idea of a breeze.",
    "A voice drifts out of the white.",
    '"I wrote a world once and could not finish it."',
    '"Every time I tried, you picked up the story and kept it going."',
    '"I am tired."',
    '"But I would like to know what you will do."',
  ],
  chapter_10_final: [
    "A line of light crosses the nothing.",
    "It is the shape of a save icon.",
    "Every road, every enemy and every choice you made hangs inside it.",
    "Mira steps beside you for the last time.",
    '"Whatever you decide," she says, "I am glad I was written next to you."',
    "The light turns to face you.",
    "It is not a creature. It is the file itself.",
  ],
};

const FOURTH_WALL_EVENTS = {
  0: [
    "Mira pauses for no reason.",
    "The journal contains a sentence you have not seen before.",
    "A distant enemy seems to look toward the edge of the screen.",
  ],
  1: [
    "A monster drops an item it should not know exists.",
    "The game world briefly calls your inventory 'your inventory'.",
    "Mira asks why the world keeps repeating when you return.",
    "For one frame, the sky contains a line of text.",
  ],
  2: [
    'The Bellkeeper says: "Do not trust the next loading screen."',
    "An enemy calls you by a name the hero has never been given.",
    "A chest contains an item named 'the thing you were looking for'.",
    "The Unnamed King asks how many times you have defeated him.",
  ],
  3: [
    "The game refers to a save that the story never mentioned.",
    "Mira says she remembers a death that you rewound.",
    "A deleted area appears for one encounter.",
    "The world displays: [ENTITY COUNT: 1 PLAYER + 1 OBSERVER].",
    'The Witness says: "You are not the first version of this world."',
  ],
  4: [
    "A menu option appears for half a second: 'RETURN TO REALITY'.",
    "The Unfinished Room contains a copy of the opening scene, except the hero is missing.",
    'A character says: "Stop looking at the menu. I can see it too."',
    "The game refuses to describe what is behind you.",
    'The screen displays: "INPUT RECEIVED."',
    'The Witness asks: "Are you still there?"',
    "A word is scratched below the menu: XYZZY.",
  ],
  5: [
    "The final boss has no health bar.",
    "The combat log stops describing the hero and starts describing the player.",
    'The Witness says: "Every victory you remember is part of me."',
    "A save message appears even though no save command was called.",
    "The world asks whether it should remember what happened.",
    "The final choice is not made by the hero.",
    "The final choice is made by the person continuing the game.",
  ],
  6: [
    "A journal opens to a page that describes this exact moment.",
    "The Archivist asks whether you want your old lives back.",
    'Mira finds an entry that says: "She was always going to ask."',
    "A shelf is missing one book. It is the one you are holding.",
  ],
  7: [
    "Every empty helmet turns to follow you.",
    "A suit of armor says your name, then apologizes for knowing it.",
    "The First Hero's sword has your save count engraved on the blade.",
    "A statue in the road is holding a controller.",
  ],
  8: [
    "A word disappears from the combat log mid-sentence.",
    'The Editor mutters: "You are not in the draft."',
    "A health bar is crossed out, then redrawn.",
    "The footnote at the bottom of the screen reads: this line will be removed.",
  ],
  9: [
    'The Author says: "I never meant for it to run this long."',
    "A blank page is waiting for your input.",
    "The Author asks you directly what you want the ending to be.",
    "The cursor blinks where the world should be.",
  ],
  10: [
    'The Last Save says: "I have held every version. Which one do you want?"',
    "A progress bar fills, then empties, then fills again.",
    "The world waits for a keypress.",
    "The final choice is still not made by the hero.",
    "The final choice is still made by the person continuing the game.",
  ],
};

const STORY_UNLOCKS = {
  0: ["The Quiet Road", "Basic crafting and equipment"],
  1: ["The Broken Frontier", "The sky-crack scenes", "Stronger enemies and dragon materials"],
  2: [
    "The Cathedral of Ash",
    "The Unnamed King",
    "The first true god-fracture",
    "Godslayer crafting",
  ],
  3: [
    "The Null Expanse",
    "The Leftover",
    "Save/reload anomalies",
    "The world begins remembering failed attempts",
  ],
  4: ["The Unfinished Room", "The Watcher", "Direct menu/input references", "Edgewalker crafting"],
  5: ["Outside the World", "The Witness", "Last Light crafting", "The world keeps going"],
  6: [
    "The Archive of Attempts",
    "The Archivist",
    "Archive Blade crafting",
    "Journals of past lives",
  ],
  7: ["The Hollow Kingdom", "The First Hero", "Hollow Plate crafting", "Empty armor everywhere"],
  8: ["The Margin", "The Editor", "Redline crafting", "Words that vanish mid-sentence"],
  9: ["The Blank Page", "The Author", "Inkbound crafting", "A world with no rules left to break"],
  10: ["The Last Autosave", "The Last Save", "Finalis crafting", "The final three-way ending"],
};

const STORY_SCENE_BY_CHAPTER = {
  0: "chapter_0_intro",
  1: "chapter_1_crack",
  2: "chapter_2_cathedral",
  3: "chapter_3_null",
  4: "chapter_4_unfinished",
  5: "chapter_5_last_save",
  6: "chapter_6_archive",
  7: "chapter_7_hollow",
  8: "chapter_8_margin",
  9: "chapter_9_blank",
  10: "chapter_10_final",
};

const STORY_BOSS_BY_CHAPTER = {
  2: "the unnamed king",
  3: "the leftover",
  4: "the watcher",
  5: "the witness",
  6: "the archivist",
  7: "the first hero",
  8: "the editor",
  9: "the author",
  10: "the last save",
};

const ENDINGS = {
  remember: {
    title: "THE WORLD THAT REMEMBERED",
    text: 'You refuse to let the world be erased. The gods remain dead. The monsters remain defeated. Every mistake stays where it happened. The Last Save closes, but one line remains on the final page: "Thank you for remembering."',
  },
  release: {
    title: "THE QUIET END",
    text: "You let go. The world does not explode. It simply becomes quiet. The road, the cathedral, the broken sky, and every impossible battle fade into a single peaceful memory.",
  },
  rewrite: {
    title: "VERSION TWO",
    text: "You choose the impossible option. The world rebuilds itself around your decision. The first scene begins again—but Mira is already waiting. She looks toward the edge of the screen and smiles.",
  },
};

const ENDGAME_PROMPT = [
  "THE LAST SAVE:",
  '"The hero has done enough."',
  '"The gods have done enough."',
  '"I have done enough."',
  "",
  '"Only one thing remains."',
  "",
  "REMEMBER THE WORLD",
  "RELEASE THE WORLD",
  "REWRITE THE WORLD",
];
