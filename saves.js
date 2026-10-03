// Save codes: copy / load / autosave format.
const b64enc = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const b64dec = (s) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
function saveCode() {
  const inv = {};
  for (const n in inventory) if (inventory[n] > 0) inv[n] = inventory[n];
  return (
    "RPG2-" +
    b64enc(
      JSON.stringify({
        inventory: inv,
        equipment,
        player: PLAYER,
        story: {
          chapter: STORY.chapter,
          flags: [...STORY.flags].sort(),
          seen_scenes: [...STORY.seen].sort(),
          fracture: STORY.fracture,
          ending: STORY.ending,
          kills: STORY.kills,
        },
        world: typeof WORLD !== "undefined" ? WORLD : undefined,
      })
    )
  );
}
async function parseSave(code) {
  let data;
  try {
    if (code.startsWith("RPG2-"))
      data = JSON.parse(new TextDecoder().decode(b64dec(code.slice(5))));
    else if (code.startsWith("RPG1-")) {
      const ds = new DecompressionStream("deflate"),
        w = ds.writable.getWriter();
      w.write(b64dec(code.slice(5)));
      w.close();
      data = JSON.parse(await new Response(ds.readable).text());
    } else throw 1;
  } catch (e) {
    throw new Error(
      code.startsWith("RPG")
        ? "The save code is damaged or incomplete."
        : "That doesn't look like a save code."
    );
  }
  const { inventory: inv, equipment: eq, player: pl } = data || {};
  if (!inv || !eq || !pl) throw new Error("The save data is missing sections.");
  const cl = {};
  for (const [n, a] of Object.entries(inv)) {
    if (!Number.isInteger(a) || a < 0) throw new Error(`Bad inventory entry: ${n}`);
    if (a > 0) cl[n] = a;
  }
  for (const s of SLOTS) {
    const it = eq[s];
    if (!it) continue;
    if (!ITEMS[it] || ITEMS[it].id !== s) throw new Error(`Bad equipment in slot '${s}'.`);
    if ((cl[it] || 0) < 1) throw new Error(`Equipped ${it} isn't in the inventory.`);
  }
  if (!Number.isInteger(pl.level) || pl.level < 1 || pl.level > C.MAX_LEVEL)
    throw new Error("Bad level in save data.");
  if (!Number.isInteger(pl.xp) || pl.xp < 0) throw new Error("Bad XP in save data.");
  return { inv: cl, eq, pl, st: data.story || {}, world: data.world || null };
}
function applySave({ inv, eq, pl, st, world }) {
  inventory = inv;
  SLOTS.forEach((s) => (equipment[s] = eq[s] || null));
  const extra = defaultPlayerExtra(pl);
  PLAYER = { ...extra, level: pl.level, xp: pl.xp };
  ["str", "agi", "vit", "foc"].forEach((k) => {
    PLAYER[k] = Math.max(1, Math.min(25, parseInt(PLAYER[k]) || 5));
  });
  PLAYER.statPoints = Math.max(0, parseInt(PLAYER.statPoints) || 0);
  PLAYER.skillPoints = Math.max(0, parseInt(PLAYER.skillPoints) || 0);
  PLAYER.perks = (PLAYER.perks || []).filter((id) => typeof PERKS === "undefined" || PERKS[id]);
  PLAYER.spells = (PLAYER.spells || []).filter((n) => typeof SPELLS === "undefined" || SPELLS[n]);
  if (!PLAYER.spells.length) PLAYER.spells = ["ember spark", "mend"];
  const ci = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v) || 0));
  STORY.chapter = ci(st.chapter, 0, STORY_CHAPTERS.length - 1);
  STORY.fracture = ci(st.fracture, 0, 10);
  STORY.flags = new Set((st.flags || []).map(String));
  STORY.seen = new Set((st.seen_scenes || []).map(String));
  STORY.ending = ENDINGS[st.ending] ? st.ending : null;
  STORY.kills = {};
  if (st.kills && typeof st.kills === "object")
    for (const k in st.kills) STORY.kills[k] = ci(st.kills[k], 0, 1e9);
  if (world && typeof WORLD !== "undefined" && typeof defaultWorld === "function") {
    const base = defaultWorld();
    WORLD = {
      ...base,
      ...world,
      companions: {
        ...base.companions,
        ...(world.companions || {}),
        affinity: { ...base.companions.affinity, ...(world.companions?.affinity || {}) },
        personal: { ...base.companions.personal, ...(world.companions?.personal || {}) },
      },
      flags: { ...base.flags, ...(world.flags || {}) },
      quests: world.quests && typeof world.quests === "object" ? world.quests : {},
      upgrades: world.upgrades && typeof world.upgrades === "object" ? world.upgrades : {},
      rarity: world.rarity && typeof world.rarity === "object" ? world.rarity : {},
      bestiary: world.bestiary && typeof world.bestiary === "object"
        ? Object.fromEntries(Object.entries(world.bestiary)
            .filter(([name, row]) => typeof name === "string" && typeof row === "object" && row !== null && (typeof monsters === "undefined" || monsters[name]))
            .map(([name, row]) => [name, {
              encounters: Math.max(0, parseInt(row.encounters) || 0),
              defeats: Math.max(0, parseInt(row.defeats) || 0),
              phases: Array.isArray(row.phases) ? [...new Set(row.phases.filter((value) => typeof value === "string"))] : [],
              moves: Array.isArray(row.moves) ? [...new Set(row.moves.filter((value) => typeof value === "string"))] : [],
            }]))
        : {},
      recipeUnlocks: Array.isArray(world.recipeUnlocks)
        ? world.recipeUnlocks.filter((n) => typeof RECIPE_DISCOVERY !== "undefined" && RECIPE_DISCOVERY[n])
        : [],
      recipeMaterialsSeen: [...new Set([
        ...(Array.isArray(world.recipeMaterialsSeen) ? world.recipeMaterialsSeen.filter((n) => typeof n === "string") : []),
        ...Object.keys(inv).filter((n) => n !== "coin"),
      ])],
      trackedRecipes: Array.isArray(world.trackedRecipes)
        ? [...new Set(world.trackedRecipes.filter((n) => typeof n === "string" && recipes[n]))]
        : [],
      recipesCrafted: Array.isArray(world.recipesCrafted)
        ? [...new Set(world.recipesCrafted.filter((n) => typeof n === "string" && recipes[n]))]
        : [],
    };
  }
  if (typeof WORLD !== "undefined" && WORLD.dungeonRun) {
    const run = WORLD.dungeonRun;
    WORLD.dungeonRun = run && typeof run === "object" && run.active
      ? {
          active: true,
          floor: Math.max(0, Math.min(5, parseInt(run.floor) || 0)),
          hp: Math.max(0, Number.isFinite(run.hp) ? run.hp : 1),
          energy: Math.max(0, Number.isFinite(run.energy) ? run.energy : 0),
          abandoned: !!run.abandoned,
          pending: !!run.pending && typeof run.pendingFoe === "string" && !!monsters[run.pendingFoe],
          pendingFloor: Math.max(1, Math.min(5, parseInt(run.pendingFloor) || (parseInt(run.floor) || 0) + 1)),
          pendingFoe: typeof run.pendingFoe === "string" && monsters[run.pendingFoe] ? run.pendingFoe : null,
          pendingElite: !!run.pendingElite,
        }
      : null;
  }
  if (typeof WORLD !== "undefined" && WORLD.towerRun) {
    const run = WORLD.towerRun;
    WORLD.towerRun = run && typeof run === "object" && run.active
      ? {
          active: true,
          wave: Math.max(0, Number.isFinite(run.wave) ? parseInt(run.wave) || 0 : 0),
          hp: Math.max(0, Number.isFinite(run.hp) ? run.hp : 1),
          energy: Math.max(0, Number.isFinite(run.energy) ? run.energy : 0),
          abandoned: !!run.abandoned,
          pending: !!run.pending && typeof run.pendingFoe === "string" && !!monsters[run.pendingFoe],
          pendingFoe: typeof run.pendingFoe === "string" && monsters[run.pendingFoe] ? run.pendingFoe : null,
          pendingElite: !!run.pendingElite,
        }
      : null;
  }
  if (typeof WORLD !== "undefined" && WORLD.raidRun) {
    const run = WORLD.raidRun;
    WORLD.raidRun = run && typeof run === "object" && run.active
      ? {
          active: true,
          island: Math.max(0, Math.min(5, parseInt(run.island) || 0)),
          hp: Math.max(0, Number.isFinite(run.hp) ? run.hp : 1),
          energy: Math.max(0, Number.isFinite(run.energy) ? run.energy : 0),
          startedAt: Math.max(0, Number.isFinite(run.startedAt) ? run.startedAt : Date.now()),
          abandoned: !!run.abandoned,
        }
      : null;
  }
  if (typeof WORLD !== "undefined") {
    const memories = WORLD.memories && typeof WORLD.memories === "object" ? WORLD.memories : {};
    WORLD.memories = {
      reloads: Math.max(0, parseInt(memories.reloads) || 0),
      quitsMidFight: Math.max(0, parseInt(memories.quitsMidFight) || 0),
      lastSeenAt: Math.max(0, Number.isFinite(memories.lastSeenAt) ? memories.lastSeenAt : 0),
      inCombat: !!memories.inCombat,
    };
    const affinity = WORLD.companions?.affinity || {};
    WORLD.companions.affinity = Object.fromEntries(Object.entries(COMPANION_DEFS)
      .map(([id]) => [id, Math.max(0, Math.min(100, parseInt(affinity[id]) || 0))]));
    const personal = WORLD.companions?.personal || {};
    WORLD.companions.personal = Object.fromEntries(Object.entries(COMPANION_PERSONAL_QUESTS).map(([id, quest]) => {
      const state = personal[id] || {};
      return [id, { progress: Math.max(0, Math.min(quest.need, parseInt(state.progress) || 0)), done: !!state.done }];
    }));
  }
  if (typeof WORLD !== "undefined")
    WORLD.recipeUnlocks = Array.isArray(world?.recipeUnlocks)
      ? world.recipeUnlocks.filter((n) => typeof RECIPE_DISCOVERY !== "undefined" && RECIPE_DISCOVERY[n])
      : [];
  if (typeof WORLD !== "undefined")
    WORLD.recipeMaterialsSeen = [...new Set([
      ...(Array.isArray(world?.recipeMaterialsSeen) ? world.recipeMaterialsSeen.filter((n) => typeof n === "string") : []),
      ...Object.keys(inv).filter((n) => n !== "coin"),
    ])];
  if (typeof WORLD !== "undefined")
    WORLD.trackedRecipes = Array.isArray(world?.trackedRecipes)
      ? [...new Set(world.trackedRecipes.filter((n) => typeof n === "string" && recipes[n]))]
      : [];
  if (typeof WORLD !== "undefined")
    WORLD.recipesCrafted = Array.isArray(world?.recipesCrafted)
      ? [...new Set(world.recipesCrafted.filter((n) => typeof n === "string" && recipes[n]))]
      : [];
  if (typeof unlockSpellsForLevel === "function") unlockSpellsForLevel(true);
  // Old saves ended the game after The Witness. The story now continues to Chapter 10.
  if (STORY.flags.has("witness_defeated")) {
    STORY.flags.delete("witness_defeated");
    STORY.flags.delete("ending_complete");
    STORY.ending = null;
    STORY.flags.add("chapter_5_complete");
    STORY.chapter = Math.max(STORY.chapter, 6);
    STORY.fracture = Math.max(STORY.fracture, 6);
    STORY.flags.add("chapter_6_unlocked");
    print("\n📖 The Witness is gone, but the world did not end. Chapter 6 is now open.");
    print("The final choice has moved to the end of Chapter 10.");
  }
}
function copyData() {
  const c = saveCode();
  print("\n--- Your Save Code ---");
  print(c);
  if (navigator.clipboard)
    navigator.clipboard.writeText(c).then(
      () => print("\n📋 Copied to your clipboard!"),
      () => print("\n(Select and copy the code above.)")
    );
  else print("\n(Select and copy the code above.)");
}
async function loadData() {
  const code = (await input("Paste your save code (blank to cancel): ")).trim();
  if (!code) {
    print("Load cancelled.");
    return;
  }
  let s;
  try {
    s = await parseSave(code);
  } catch (e) {
    print(`❌ ${e.message}`);
    return;
  }
  const c = (await input("This will replace your current progress. Continue? (y/n): "))
    .trim()
    .toLowerCase();
  if (c !== "y" && c !== "yes") {
    print("Load cancelled.");
    return;
  }
  applySave(s);
  print(
    `✅ Save loaded! Level ${PLAYER.level}, ${inventory.coin || 0} coin, Chapter ${STORY.chapter}.`
  );
}

