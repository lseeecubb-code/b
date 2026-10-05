// ============================================================================
// calamity_bosses.js: Calamity-style boss data (NEW FILE, loaded after monsters.js)
//
// In index.html add this line right AFTER the monsters.js script tag
// (and keep it before combat.js / any script that starts fights):
//     <script src="calamity_bosses.js"></script>
// monsters.js itself does not need to change.
//
// Format: each boss maps to an ARRAY of forms. Index 0 = phase I, index 1 = phase II.
// Bosses with no phases (mossback guardian etc.) use a single entry.
//   pattern:        looping move order. Steps: "basic", "block", "parry", "dodge", "idle",
//                   or any ability name in lowercase (must match the key in monsters.js).
//   charge:         { "ability name": [damage multiplier, "charge text"] }. The boss spends a
//                   turn charging (stun it or break its poise to cancel), then hits harder.
//   thresholds:     one-shot events at a fraction of that form's HP.
//   enrage_turns:   turns before damage starts ramping (default is 10).
// Heal moves are left out of rotations on purpose: they still appear when a boss goes
// "off-script" (pattern_variance), so bosses recover occasionally but not on a schedule.
// ============================================================================
const CALAMITY_BOSSES = {
  "goblin king": [
    {
      pattern: ["basic", "goblin barrage", "goblin barrage", "block", "royal slash"],
      charge: { "royal slash": [1.5, "raises a jagged blade high for"] },
      thresholds: [
        { at: 0.66, message: "Guards! To me!", damage_mult: 1.05 },
        { at: 0.33, message: "You will NOT take my crown!", damage_mult: 1.1 },
      ],
    },
    {
      pattern: ["bloodied barrage", "basic", "crown cleaver", "bloodied barrage", "dodge", "crown cleaver"],
      charge: { "crown cleaver": [1.5, "lifts its broken crown overhead for"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "BLEED FOR YOUR KING!", damage_mult: 1.1, pause: "howls, blood dripping from the crown" }],
    },
  ],
  "alpha wolf": [
    {
      pattern: ["basic", "double bite", "double bite", "alpha pounce", "block"],
      charge: { "alpha pounce": [1.5, "coils into the shadows for"] },
      thresholds: [{ at: 0.5, message: "The pack will hear this!", damage_mult: 1.08 }],
    },
    {
      pattern: ["rending flurry", "dodge", "lunar pounce", "rending flurry", "basic", "lunar pounce"],
      charge: { "lunar pounce": [1.5, "bays at the moon, gathering for"] },
      enrage_turns: 7,
      thresholds: [
        { at: 0.5, message: "The moon is bright tonight.", damage_mult: 1.1 },
        { at: 0.2, message: "Run.", damage_mult: 1.1, pause: "throws back its head and howls" },
      ],
    },
  ],
  "orc warlord": [
    {
      pattern: ["basic", "warlord smash", "basic", "block", "warlord smash"],
      charge: { "warlord smash": [1.5, "hauls its warhammer back for"] },
      thresholds: [
        { at: 0.66, message: "Stand and be broken!", damage_mult: 1.05 },
        { at: 0.33, message: "My warband will hear of this!", damage_mult: 1.1 },
      ],
    },
    {
      pattern: ["basic", "crushing march", "block", "crushing march", "basic", "basic"],
      charge: { "crushing march": [1.4, "plants its feet and builds momentum for"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "ENOUGH!", damage_mult: 1.12, pause: "tears off its armor and roars" }],
    },
  ],
  "ancient golem": [
    {
      pattern: ["basic", "crystal burst", "basic", "block", "ancient fist"],
      charge: { "ancient fist": [1.5, "winds its stone arm back for"] },
      thresholds: [{ at: 0.5, message: "INTRUDER DETECTED.", damage_mult: 1.08 }],
    },
    {
      pattern: ["faultline", "basic", "molten fist", "block", "faultline", "molten fist"],
      charge: { "molten fist": [1.5, "drags its molten core to its fist for"] },
      enrage_turns: 8,
      thresholds: [
        { at: 0.5, message: "CORE TEMPERATURE CRITICAL.", damage_mult: 1.1 },
        { at: 0.2, message: "LIMITERS FAILING.", damage_mult: 1.1, pause: "vents scalding steam" },
      ],
    },
  ],
  "frost giant king": [
    {
      pattern: ["basic", "blizzard", "block", "king's hammer", "basic"],
      charge: { "king's hammer": [1.5, "raises the frozen hammer for"] },
      thresholds: [{ at: 0.5, message: "The cold has no mercy for you.", damage_mult: 1.08 }],
    },
    {
      pattern: ["whiteout", "basic", "glacier crush", "dodge", "whiteout", "glacier crush"],
      charge: { "glacier crush": [1.6, "calls a glacier down upon you with"] },
      enrage_turns: 8,
      thresholds: [
        { at: 0.6, message: "Be still beneath the winter.", damage_mult: 1.08 },
        { at: 0.25, message: "The deep winter wakes!", damage_mult: 1.12, pause: "exhales a freezing gale" },
      ],
    },
  ],
  "ash demon": [
    {
      pattern: ["basic", "void curse", "basic", "inferno", "block"],
      charge: { inferno: [1.4, "draws the fire from the air for"] },
      thresholds: [{ at: 0.5, message: "Burn until nothing remains!", damage_mult: 1.08 }],
    },
    {
      pattern: ["inferno spiral", "basic", "cinder eruption", "inferno spiral", "dodge", "cinder eruption"],
      charge: { "cinder eruption": [1.4, "cracks the ground and floods it with fire for"] },
      enrage_turns: 8,
      thresholds: [
        { at: 0.5, message: "The cinders were only the beginning!", damage_mult: 1.1 },
        { at: 0.2, message: "FEED THE FLAME!", damage_mult: 1.12, pause: "burns white-hot" },
      ],
    },
  ],
  "the unnamed king": [
    {
      pattern: ["basic", "erase name", "basic", "block", "forgotten decree"],
      charge: { "forgotten decree": [1.5, "opens its mouth to speak a command, readying"] },
      thresholds: [{ at: 0.5, message: "There is no world left to save.", damage_mult: 1.08 }],
    },
    {
      pattern: ["basic", "world fracture", "basic", "dodge", "world fracture"],
      charge: { "world fracture": [1.4, "presses a hand against the sky and strains for"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "The throne remembers its true sovereign.", damage_mult: 1.1, pause: "stares at the empty throne" }],
    },
  ],
  "the leftover": [
    {
      pattern: ["basic", "missing texture", "invalid state", "basic", "invalid state", "out of bounds"],
      charge: { "out of bounds": [1.4, "slips outside the edge of the encounter to prepare"] },
      thresholds: [{ at: 0.5, message: "I was not meant to be forgotten!", damage_mult: 1.08 }],
    },
    {
      pattern: ["discarded memories", "basic", "dodge", "discarded memories", "basic"],
      charge: { "discarded memories": [1.4, "gathers every scrap it was denied for"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "Give me an ending worth keeping!", damage_mult: 1.1 }],
    },
  ],
  "the watcher": [
    {
      pattern: ["observe", "prediction", "parry", "counterfactual", "basic"],
      charge: { counterfactual: [1.4, "stares unblinking, calculating"] },
      thresholds: [{ at: 0.5, message: "I have seen this choice before.", damage_mult: 1.08 }],
    },
    {
      pattern: ["basic", "judgment ray", "dodge", "basic", "judgment ray"],
      charge: { "judgment ray": [1.4, "focuses its gaze to a point, readying"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "Observation is over. Now I intervene.", damage_mult: 1.1, pause: "closes its eye for the first time" }],
    },
  ],
  "the witness": [
    {
      pattern: ["basic", "remember", "forget", "basic", "forget", "fourth wall"],
      charge: { "fourth wall": [1.4, "turns away from you and speaks to the observer, readying"] },
      thresholds: [{ at: 0.5, message: "Every strike becomes testimony.", damage_mult: 1.08 }],
    },
    {
      pattern: ["testimony storm", "basic", "cross-examination", "basic", "testimony storm"],
      charge: { "cross-examination": [1.4, "demands an answer, building toward"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "The testimony is incomplete.", damage_mult: 1.1 }],
    },
  ],
  "the archivist": [
    {
      pattern: ["basic", "cross reference", "overdue notice", "block", "cross reference", "sealed vault"],
      charge: { "sealed vault": [1.4, "begins sealing every shelf, preparing"] },
      thresholds: [{ at: 0.5, message: "Filed under: inevitable.", damage_mult: 1.08 }],
    },
    {
      pattern: ["catalogue of pain", "basic", "block", "catalogue of pain", "basic"],
      charge: { "catalogue of pain": [1.4, "opens the index to the page marked for you, readying"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "A new classification for your failure.", damage_mult: 1.1 }],
    },
  ],
  "the first hero": [
    {
      pattern: ["basic", "familiar strike", "block", "familiar strike", "worn out sword"],
      charge: { "worn out sword": [1.4, "raises a blade you recognise, readying"] },
      thresholds: [{ at: 0.5, message: "Show me the strength that brought you here!", damage_mult: 1.08 }],
    },
    {
      pattern: ["heroic combination", "basic", "block", "heroic combination", "last stand"],
      charge: { "last stand": [1.25, "plants its feet and commits everything to"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "I remember how to use this power.", damage_mult: 1.1, pause: "lowers the sword, then raises it again" }],
    },
  ],
  "the editor": [
    {
      pattern: ["basic", "strikethrough", "redact", "basic", "strikethrough", "delete scene"],
      charge: { "delete scene": [1.3, "draws a red box around the encounter, readying"] },
      thresholds: [{ at: 0.5, message: "That move has been cut.", damage_mult: 1.08 }],
    },
    {
      pattern: ["basic", "dodge", "delete the target", "basic", "delete the target"],
      charge: { "delete the target": [1.25, "draws a line through you, readying"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "Revision complete.", damage_mult: 1.1 }],
    },
  ],
  "the author": [
    {
      pattern: ["basic", "plot twist", "writer's block", "basic", "plot twist", "deus ex machina"],
      charge: { "deus ex machina": [1.3, "writes in a sudden rescue and prepares"] },
      thresholds: [{ at: 0.5, message: "I wrote this moment long ago.", damage_mult: 1.08 }],
    },
    {
      pattern: ["basic", "dodge", "rewrite reality", "basic", "rewrite reality"],
      charge: { "rewrite reality": [1.25, "begins writing the world anew, readying"] },
      enrage_turns: 8,
      thresholds: [{ at: 0.5, message: "Let me write the final version.", damage_mult: 1.1, pause: "pauses, quill hovering" }],
    },
  ],
  "the last save": [
    {
      pattern: ["basic", "autosave", "corrupt", "basic", "corrupt", "overwrite"],
      charge: { overwrite: [1.3, "begins overwriting everything, readying"] },
      thresholds: [{ at: 0.5, message: "Recovery point unavailable.", damage_mult: 1.08 }],
    },
    {
      pattern: ["forced shutdown", "basic", "dodge", "erase the timeline", "forced shutdown", "erase the timeline"],
      charge: { "erase the timeline": [1.25, "starts erasing the timeline, readying"] },
      enrage_turns: 8,
      thresholds: [
        { at: 0.5, message: "There will be no undo.", damage_mult: 1.1 },
        { at: 0.2, message: "SAVE FAILED.", damage_mult: 1.12, pause: "flickers, then reloads" },
      ],
    },
  ],

  // ---- Optional bosses (single form, no phase array) ----
  "mossback guardian": [
    {
      pattern: ["basic", "basic", "root sweep", "block", "basic", "root sweep"],
      charge: { "root sweep": [1.5, "drags its roots back through the road for"] },
      thresholds: [{ at: 0.5, message: "The old road wakes beneath the moss.", damage_mult: 1.1 }],
    },
  ],
  "the bell without a tongue": [
    {
      pattern: ["basic", "echo chamber", "echo chamber", "block", "tongueless toll"],
      charge: { "tongueless toll": [1.5, "swings in utter silence before"] },
      thresholds: [
        { at: 0.66, message: "No tongue. No rope. Still, you heard it.", damage_mult: 1.06 },
        { at: 0.33, message: "The bell cracks. The echo keeps ringing.", damage_mult: 1.1, pause: "rings once, deafeningly" },
      ],
    },
  ],
  "the lost cartographer": [
    {
      pattern: ["basic", "fold the road", "basic", "block", "wrong turn"],
      charge: { "wrong turn": [1.4, "marks a dead end on your map, readying"] },
      thresholds: [
        { at: 0.66, message: "You are walking off the edge of the world.", damage_mult: 1.06 },
        { at: 0.33, message: "I have mapped every ending. This one is mine.", damage_mult: 1.1 },
      ],
    },
  ],
};

// Applies one form's Calamity settings: charge flags go on the ability data itself,
// everything else (pattern, thresholds, enrage_turns, ...) goes on the form.
function applyCalamity(target, cfg) {
  if (!target) return;
  const { charge, ...rest } = cfg;
  Object.assign(target, rest);
  for (const [move, [mult, text]] of Object.entries(charge || {})) {
    const ability = target.abilities?.[move];
    if (!ability) {
      console.warn(`Calamity: "${move}" not found on ${target.name || "form"}`);
      continue;
    }
    ability.charge = true;
    ability.charge_mult = mult;
    ability.charge_text = text;
  }
}
for (const [name, forms] of Object.entries(CALAMITY_BOSSES)) {
  const boss = monsters[name];
  if (!boss) {
    console.warn(`Calamity: unknown boss "${name}"`);
    continue;
  }
  forms.forEach((cfg, i) => {
    if (boss.phases?.[i]) applyCalamity(boss.phases[i], cfg);
    if (i === 0) applyCalamity(boss, cfg); // phase I also lives on the base entry
  });
}
