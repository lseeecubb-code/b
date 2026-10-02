// Command router and the main game loop (runGame).
class Quit extends Error {}
const COMMANDS = {
  explore: [exploreStory, "explore", "Travel the story area and fight - THE way to progress"],
  story: [showStory, "story", "Your chapter, objective and progress"],
  ending: [showEnding, "ending", "Make the final choice (after The Witness)"],
  fight: [fightCommand, "fight [enemy]", "Pick an enemy you've already beaten, or a random fight"],
  bestiary: [showBestiary, "bestiary [enemy]", "Enemy moves, drops and unlock status"],
  inventory: [showInventory, "inventory [category]", "Your items, sorted by category"],
  stats: [showStats, "stats", "Your stats and equipped gear"],
  skills: [showSkills, "skills", "Skills of your equipped weapon"],
  info: [showItemInfo, "info [item]", "Stats, recipe, drops and prices of any item"],
  equip: [equipItem, "equip [item]", "Equip a weapon, armor, shield ..."],
  unequip: [unequipItem, "unequip [item]", "Take something off"],
  craft: [
    craftItem,
    "craft [item] [amount]",
    "Craft items ('craft potion 5, shield' does several)",
  ],
  recipes: [showRecipes, "recipes [category]", "Browse recipes by category"],
  shop: [shop, "shop [buy|sell|category]", "Browse the shop by category"],
  buy: [buyItem, "buy [item] [amount]", "Buy from the shop"],
  sell: [sellItem, "sell [item] [amount]", "Sell to the shop ('sell all <item>')"],
  event: [() => print("\n⚠️ " + fourthWall()), "event", "Trigger a fourth-wall event"],
  copy: [copyData, "copy", "Get your save code"],
  load: [loadWithAdmin, "load", "Load a save code"],
  menu: [() => showMainMenu(), "menu", "Show this list"],
  quit: [
    () => {
      throw new Quit();
    },
    "quit",
    "Leave the game",
  ],
};
const MENU = [
  ["PROGRESS", ["explore", "story", "ending"]],
  ["BATTLE", ["fight", "bestiary"]],
  ["CHARACTER", ["inventory", "stats", "skills", "info", "equip", "unequip"]],
  ["CRAFT & TRADE", ["craft", "recipes", "shop", "buy", "sell"]],
  ["OTHER", ["event", "copy", "load", "menu", "quit"]],
];
const ORDER = MENU.flatMap((x) => x[1]),
  cnum = (n) => ORDER.indexOf(n) + 1;
const ALIASES = {
  progress: "story",
  inspect: "info",
  item: "info",
  help: "menu",
  m: "menu",
  "?": "menu",
  exit: "quit",
  q: "quit",
};
function showMainMenu() {
  print("\n=== WHAT DO YOU WANT TO DO? ===");
  for (const [t, names] of MENU) {
    print(`\n${t}`);
    names.forEach((n) =>
      print(`  ${rpad(cnum(n), 2)}. ${pad(COMMANDS[n][1], 26)} ${COMMANDS[n][2]}`)
    );
  }
  print("\nType a number or a command name. Commands that need more details will ask,");
  print("or type it all at once, e.g. 'buy potion 2', 'info iron sword', 'fight goblin'.");
}
function keyHint() {
  const ch = curChapter(),
    p = STORY_PROGRESS[ch.id],
    fin = STORY.flags.has("final_defeated");
  print("\n" + "-".repeat(62));
  print(`📖 Chapter ${ch.id}: ${ch.title}   |   Level ${PLAYER.level}`);
  if (fin) print("🌑 The Last Save is defeated. The final choice is waiting.");
  else {
    print(`🎯 Objective: ${p.objective}`);
    if (p.boss && PLAYER.level >= p.level && !objectiveComplete())
      print("⚔️  The chapter boss is ready: 'explore', then choose 'boss'.");
  }
  print("⭐ Key commands:");
  print(
    `   ${rpad(cnum("explore"), 2)}. explore  - travel and fight; this is how the story moves forward`
  );
  print(`   ${rpad(cnum("story"), 2)}. story    - check your objective and progress`);
  if (fin && !STORY.ending)
    print(`   ${rpad(cnum("ending"), 2)}. ending   - make the final choice`);
  print(`   ${rpad(cnum("menu"), 2)}. menu     - every command (type a number or a name)`);
}
function resolveCommand(w) {
  if (isDigit(w)) {
    const i = +w;
    return i >= 1 && i <= ORDER.length ? ORDER[i - 1] : null;
  }
  w = ALIASES[w] || w;
  return COMMANDS[w] ? w : null;
}
async function doFunction(line) {
  const raw = line.trim();
  // Hidden admin commands (only after unlocking). Handled before lowercasing so that
  // function names given to 'admin call' keep their capitals.
  if (ADMIN.handles(raw)) return ADMIN.run(raw);
  const m = raw.toLowerCase().match(/^(\S+)\s*(.*)$/);
  if (!m) return;
  const n = resolveCommand(m[1]);
  if (!n) {
    print("Invalid command! Type 'menu' to see everything you can do.");
    return;
  }
  await COMMANDS[n][0](m[2]);
}
async function runGame(savedCode) {
  resetState();
  if (savedCode) {
    try {
      applySave(await parseSave(savedCode));
      print("💾 Autosave restored.");
    } catch (e) {
      resetState();
      print(`[autosave warning] ${e.message}`);
    }
  }
  print("\nWelcome to THE LAST SAVE.");
  print("This is a campaign, not just a sandbox. Your victories unlock the story.");
  storyIntro();
  showStory();
  showMainMenu();
  try {
    while (true) {
      await doFunction((await input("\nwhat do you want to do? (menu/20)")).trim());
    }
  } catch (e) {
    if (e instanceof Quit) print("Thanks for playing! (Use New Game or reload to play again.)");
    else throw e;
  }
}

// ======================================================================
// ADMIN (hidden)
//
// Unlock:  type 'load', then type 'admin' at the code prompt  (or 'load admin').
// Use:     admin <command> <arg> <arg> ...      ('admin' alone lists the commands)
//
// It is deliberately NOT in COMMANDS / MENU / ORDER / ALIASES, so it never shows up in the
// menu and the command numbers do not change. Until it is unlocked, typing 'admin' gives the
// normal "Invalid command!" message. Unlocking lasts until you reload the page or 'admin lock'.
// Every change is checked with the game's own parseSave(); one that would make the save
// unloadable is undone, so a typo can't ruin the autosave.
// ======================================================================

// Wraps the 'load' command: "admin" at the code prompt (or "load admin") unlocks admin.
async function loadWithAdmin(args) {
  if (/^admin$/i.test((args || "").trim())) {
    ADMIN.unlock();
    return;
  }
  const realInput = input;
  let unlockedHere = false;
  input = async function (...a) {
    const v = await realInput.apply(this, a);
    if (/^admin$/i.test(String(v).trim())) {
      unlockedHere = true;
      return ""; // blank = the game's own "Load cancelled."
    }
    return v;
  };
  try {
    await loadData(args);
  } finally {
    input = realInput;
  }
  if (unlockedHere) ADMIN.unlock();
}

const ADMIN = (() => {
  let unlocked = false;
  let buf = []; // output of the command being run; printed once the change is accepted

  const say = (t) => buf.push(String(t));
  const isObj = (v) => v !== null && typeof v === "object";
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (v) => (v === undefined || v === "" ? NaN : Number(v));

  // Everything an admin can touch, under short prefixes.
  const root = () => ({ player: PLAYER, inventory, equipment, story: STORY });

  function tokenize(line) {
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const t = [];
    let m;
    while ((m = re.exec(line)))
      t.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return t;
  }

  function parseArg(s) {
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null") return null;
    if (/^[[{]/.test(s)) {
      try {
        return JSON.parse(s);
      } catch (e) {
        /* keep as text */
      }
    }
    return s;
  }

  const getPath = (obj, path) =>
    path.split(".").reduce((o, k) => (isObj(o) ? o[k] : undefined), obj);

  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    let o = obj;
    for (const k of keys) {
      if (!isObj(o[k])) o[k] = {};
      o = o[k];
    }
    o[last] = value;
  }

  // Case-insensitive path: "story.Chapter" finds "story.chapter".
  function resolvePath(obj, path) {
    let o = obj;
    return path
      .split(".")
      .map((k) => {
        if (!isObj(o)) return k;
        const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()) || k;
        o = o[hit];
        return hit;
      })
      .join(".");
  }

  const brief = (v) => {
    if (v instanceof Set) v = [...v];
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s === undefined ? String(v) : s.length > 300 ? s.slice(0, 300) + "..." : s;
  };

  // Item names are the keys of ITEMS; a unique part of a name is enough ("sword").
  function resolveItem(name) {
    const keys = Object.keys(ITEMS);
    const lower = name.toLowerCase();
    const exact = keys.find((k) => k.toLowerCase() === lower);
    if (exact) return { name: exact };
    const part = keys.filter((k) => k.toLowerCase().includes(lower));
    if (part.length === 1) return { name: part[0] };
    return {
      error: part.length
        ? `'${name}' matches several items: ${part.slice(0, 8).join(", ")}`
        : `Unknown item '${name}'. Use the names from 'info' or 'recipes'.`,
    };
  }

  // "iron sword 2" -> { name: "iron sword", count: 2 }
  function nameAndCount(args) {
    const a = args.slice();
    let count = 1;
    if (a.length > 1 && /^\d+$/.test(a[a.length - 1])) count = Number(a.pop());
    return { name: a.join(" "), count };
  }

  // Plain global names only (no dots, no code), looked up the way the game's own code sees them.
  function lookupGlobal(name) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return undefined;
    try {
      return (0, eval)(name);
    } catch (e) {
      return undefined;
    }
  }

  const commands = {
    help() {
      say(
        [
          "admin commands:",
          "  admin show [path]            overview, or one value: player.level, inventory.coin, story.flags",
          "  admin set <path> <value>     set any value   (admin set story.fracture 4)",
          "  admin add <path> <n>         add to a number (negative subtracts)",
          "  admin gold <n>               add coin (n can be negative)",
          "  admin level <n>              set your level",
          "  admin xp <n>                 add xp",
          "  admin give <item> [n]        add items   (admin give iron sword 2)",
          "  admin take <item> [n]        remove items",
          "  admin chapter <n>            jump to a chapter",
          "  admin fracture <n>           set fracture (0-10)",
          "  admin flag <name> [off]      set/clear a story flag (admin flag final_defeated)",
          "  admin flag                   list story flags",
          "  admin call <fn> [args...]    call any global game function",
          "  admin code                   print your save code",
          "  admin lock                   turn admin off",
        ].join("\n")
      );
    },

    show(r, [path]) {
      if (!path) {
        const ch = STORY_CHAPTERS[r.story.chapter];
        say(`player: ${brief(r.player)}`);
        say(`coin: ${r.inventory.coin || 0}`);
        say(`chapter: ${r.story.chapter}${ch && ch.title ? ` (${ch.title})` : ""}`);
        say(`fracture: ${r.story.fracture}   ending: ${r.story.ending}`);
        say(`flags: ${[...r.story.flags].join(", ") || "(none)"}`);
        say(`equipment: ${brief(r.equipment)}`);
        say(`inventory: ${brief(r.inventory)}`);
        return;
      }
      const real = resolvePath(r, path);
      const v = getPath(r, real);
      if (v === undefined)
        return say(`No value at '${path}'. Roots: player, inventory, equipment, story`);
      say(`${real} = ${brief(v)}`);
    },

    set(r, [path, ...rest]) {
      if (!path || !rest.length) return say("Usage: admin set <path> <value>");
      const real = resolvePath(r, path);
      const value = parseArg(rest.join(" "));
      setPath(r, real, value);
      say(`${real} = ${brief(value)}`);
    },

    add(r, [path, n]) {
      if (!path || n === undefined) return say("Usage: admin add <path> <n>");
      const real = resolvePath(r, path);
      const cur = getPath(r, real);
      if (typeof cur !== "number" || Number.isNaN(num(n))) return say(`${real} is not a number`);
      setPath(r, real, cur + num(n));
      say(`${real} = ${cur + num(n)}`);
    },

    gold(r, [n]) {
      if (Number.isNaN(num(n))) return say("Usage: admin gold <n>");
      r.inventory.coin = Math.max(0, (r.inventory.coin || 0) + Math.floor(num(n)));
      say(`coin = ${r.inventory.coin}`);
    },

    level(r, [n]) {
      if (Number.isNaN(num(n))) return say(`Usage: admin level <n>  (1-${C.MAX_LEVEL})`);
      r.player.level = clamp(Math.floor(num(n)), 1, C.MAX_LEVEL);
      say(`level = ${r.player.level}`);
    },

    xp(r, [n]) {
      if (Number.isNaN(num(n))) return say("Usage: admin xp <n>");
      r.player.xp = Math.max(0, (r.player.xp || 0) + Math.floor(num(n)));
      say(`xp = ${r.player.xp}`);
    },

    give(r, args) {
      const { name, count } = nameAndCount(args);
      if (!name) return say("Usage: admin give <item> [n]");
      const it = resolveItem(name);
      if (it.error) return say(it.error);
      r.inventory[it.name] = (r.inventory[it.name] || 0) + count;
      say(`${it.name} x${r.inventory[it.name]}`);
    },

    take(r, args) {
      const { name, count } = nameAndCount(args);
      if (!name) return say("Usage: admin take <item> [n]");
      const it = resolveItem(name);
      if (it.error) return say(it.error);
      const left = Math.max(0, (r.inventory[it.name] || 0) - count);
      if (left > 0) r.inventory[it.name] = left;
      else delete r.inventory[it.name];
      // A save is invalid if something equipped isn't in the inventory, so unequip it.
      if (left < 1)
        for (const slot of Object.keys(r.equipment))
          if (r.equipment[slot] === it.name) {
            r.equipment[slot] = null;
            say(`(unequipped ${it.name})`);
          }
      say(`${it.name} x${left}`);
    },

    chapter(r, [n]) {
      const hi = STORY_CHAPTERS.length - 1;
      if (Number.isNaN(num(n))) return say(`Usage: admin chapter <n>  (0-${hi})`);
      r.story.chapter = clamp(Math.floor(num(n)), 0, hi);
      say(`chapter = ${r.story.chapter}`);
    },

    fracture(r, [n]) {
      if (Number.isNaN(num(n))) return say("Usage: admin fracture <n>  (0-10)");
      r.story.fracture = clamp(Math.floor(num(n)), 0, 10);
      say(`fracture = ${r.story.fracture}`);
    },

    flag(r, [name, mode]) {
      if (!name) return say(`flags: ${[...r.story.flags].join(", ") || "(none)"}`);
      if (mode && mode.toLowerCase() === "off") {
        r.story.flags.delete(name);
        say(`flag cleared: ${name}`);
      } else {
        r.story.flags.add(name);
        say(`flag set: ${name}`);
      }
    },

    async call(r, [fnName, ...args]) {
      if (!fnName) return say("Usage: admin call <fn> [args...]");
      const fn = lookupGlobal(fnName);
      if (typeof fn !== "function") return say(`No global function '${fnName}'`);
      const result = await fn(...args.map(parseArg));
      say(`${fnName}() done${result !== undefined ? " -> " + brief(result) : ""}`);
    },

    code() {
      say(saveCode());
    },
  };

  // These never change anything, so they skip the undo snapshot.
  const READ_ONLY = new Set(["help", "show", "code"]);

  async function run(line) {
    const [, sub = "help", ...args] = tokenize(line);
    const name = sub.toLowerCase();

    if (name === "lock") {
      unlocked = false;
      print("[admin access removed]");
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(commands, name)) {
      print(`Unknown admin command '${sub}'. Type 'admin' to see them.`);
      return;
    }

    const before = READ_ONLY.has(name) ? null : saveCode();
    buf = [];
    let failure = null;
    try {
      await commands[name](root(), args);
    } catch (e) {
      failure = `admin ${name} failed: ${e.message}`;
    }

    if (failure && !before) {
      print(failure);
      return;
    }
    if (before) {
      try {
        if (failure) throw new Error(failure);
        await parseSave(saveCode()); // would this state load again?
      } catch (e) {
        applySave(await parseSave(before)); // undo
        print(`❌ ${e.message}  (change undone)`);
        return;
      }
    }
    print(buf.join("\n"));
  }

  return {
    unlock() {
      unlocked = true;
      print("[admin access granted]  type: admin");
    },
    handles: (raw) => unlocked && /^admin(\s|$)/i.test(raw),
    run,
  };
})();
