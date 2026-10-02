/* admin.js - THE LAST SAVE admin commands
 *
 * Unlock:  type  load  then, at the load prompt, type  admin
 *          (typing  load admin  on one line works too)
 * Use:     admin <command> <arg> <arg> ...      (type  admin)
 *
 * Load AFTER index.js:  <script src="admin.js"></script>
 * Does not modify commands.js, COMMANDS, ORDER or ALIASES.
 */
(function () {
  "use strict";

  // Indirect eval reads global let/const/var, and sees them fresh after applySave().
  const readGlobal = (name) => {
    try { return (0, eval)(name); } catch (e) { return undefined; }
  };
  const isObj = (v) => v !== null && typeof v === "object";

  // Everything an admin can touch, under short prefixes: player.* inventory.* equipment.* story.*
  function root() {
    const player = readGlobal("PLAYER"), inventory = readGlobal("inventory");
    const equipment = readGlobal("equipment"), story = readGlobal("STORY"), world = readGlobal("WORLD");
    if (!isObj(player) || !isObj(inventory) || !isObj(story)) return null;
    return { player, inventory, equipment, story, world };
  }

  // ---------- output ----------
  // Output goes through the game's own write()/print() (index.js) so it flows through the
  // typewriter and the open "what do you want to do? " line stays consistent.
  let sink = null; // while an admin command runs, its output is collected here
  const gameFn = (name) => { const f = readGlobal(name); return typeof f === "function" ? f : null; };

  function rawPrint(text) {
    const print = gameFn("print");
    if (print) return print(text);
    const screen = document.getElementById("screen");
    if (!screen) return;
    String(text).split("\n").forEach((ln) => {
      const div = document.createElement("div");
      div.className = "line";
      div.textContent = ln;
      screen.appendChild(div);
    });
    screen.scrollTop = screen.scrollHeight;
  }

  function out(text) { sink ? sink.push(String(text)) : rawPrint(text); }
  const ok = out;
  const bad = out;

  // True while the game is waiting on its input() promise, i.e. a prompt line is open.
  const atPrompt = () => !!readGlobal("pendingInput");
  function openPromptText() {
    const screen = document.getElementById("screen");
    const el = screen && screen.lastElementChild;
    const t = el ? el.textContent : "";
    return t.length <= 80 ? t : "";
  }

  // Show lines below the open prompt, then put the prompt back so the player's next
  // command echoes exactly as it normally would. `echo` is what the player typed.
  function emit(text, echo) {
    const write = gameFn("write");
    const prompting = write && atPrompt();
    const prompt = prompting ? openPromptText() : "";
    if (prompting) write((echo === undefined ? "" : echo) + "\n"); // closes the prompt line
    rawPrint(text);
    if (prompting && prompt) write(prompt);
  }

  // Save right away, but only if the game could load it again (the game's own validator).
  async function persist() {
    const parse = gameFn("parseSave"), code = gameFn("saveCode"), auto = gameFn("autosave");
    if (!parse || !code || !auto) return null;
    try { await parse(code()); auto(); return null; }
    catch (e) { return "(not autosaved - this state wouldn't load: " + e.message + ")"; }
  }

  // ---------- helpers ----------
  function parseArg(s) {
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null") return null;
    if (/^[\[{]/.test(s)) { try { return JSON.parse(s); } catch (e) { /* keep string */ } }
    return s;
  }

  function tokenize(line) {
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const t = [];
    let m;
    while ((m = re.exec(line))) t.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return t;
  }

  const getPath = (obj, path) => path.split(".").reduce((o, k) => (isObj(o) ? o[k] : undefined), obj);

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

  // Case-insensitive path, so "story.Chapter" finds "story.chapter". Item names keep spaces via quotes.
  function resolvePath(obj, path) {
    let o = obj;
    return path.split(".").map((k) => {
      if (!isObj(o)) return k;
      const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()) || k;
      o = o[hit];
      return hit;
    }).join(".");
  }

  const brief = (v) => {
    if (v instanceof Set) v = [...v];
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s === undefined ? String(v) : s.length > 300 ? s.slice(0, 300) + "..." : s;
  };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // Resolve gear, consumables, materials, crafted items, and items already in a save.
  function resolveItem(name) {
    const tables = ["ITEMS", "USABLE_ITEMS", "recipes", "RAW", "CRYS"]
      .map(readGlobal).filter(isObj);
    const keys = [...new Set([...tables.flatMap(Object.keys), ...Object.keys((readGlobal("inventory") || {}))])];
    if (!keys.length) return { name };
    const lower = name.toLowerCase();
    const exact = keys.find((k) => k.toLowerCase() === lower);
    if (exact) return { name: exact };
    const part = keys.filter((k) => k.toLowerCase().includes(lower));
    if (part.length === 1) return { name: part[0] };
    return {
      error: part.length
        ? "'" + name + "' matches several items: " + part.slice(0, 8).join(", ")
        : "Unknown item '" + name + "'. Try 'admin items' to list valid names.",
    };
  }

  // "iron sword 2" -> { name: "iron sword", count: 2 }
  function nameAndCount(args) {
    const a = args.slice();
    let count = 1;
    if (a.length > 1 && /^\d+$/.test(a[a.length - 1])) count = Number(a.pop());
    return { name: a.join(" "), count };
  }

  // ---------- admin commands ----------
  const commands = {
    help() {
      out(
        [
          "admin commands (type admin on its own to see this list):",
          "  admin show [path]            overview, or one value: player.level, inventory.coin, story.flags",
          "  admin set <path> <value>     set any value   (admin set story.fracture 4)",
          "  admin add <path> <n>         add to a number (negative subtracts)",
          "  admin gold <n>               add coin (n can be negative)",
          "  admin level <n>              set your level",
          "  admin xp <n>                 add xp",
          "  admin give <item> [n]        add items   (admin give iron sword 2)",
          "  admin items [filter]         list valid gear, supplies, and materials",
          "  admin perk <id>              unlock a permanent perk",
          "  admin spell <id>             learn an ability",
          "  admin take <item> [n]        remove items",
          "  admin chapter <n>            jump to a chapter",
          "  admin fracture <n>           set fracture (0-10)",
          "  admin flag <name> [off]      set/clear a story flag (admin flag final_defeated)",
          "  admin flag                   list story flags",
          "  admin call <fn> [args...]    call any global game function",
          "  admin code                   print your save code",
          "  admin save                   autosave now (changes are also saved automatically)",
          "  admin lock                   turn admin off",
        ].join("\n"),
        "fx-loot"
      );
    },

    show(r, [path]) {
      if (!path) {
        const st = r.story, chs = readGlobal("STORY_CHAPTERS");
        const title = Array.isArray(chs) && chs[st.chapter] && (chs[st.chapter].title || "");
        out("player: " + brief(r.player));
        out("coin: " + (r.inventory.coin || 0));
        out("chapter: " + st.chapter + (title ? " (" + title + ")" : ""));
        out("fracture: " + st.fracture + "   ending: " + st.ending);
        out("flags: " + ([...st.flags].join(", ") || "(none)"));
        out("equipment: " + brief(r.equipment));
        out("inventory: " + brief(r.inventory));
        return;
      }
      const real = resolvePath(r, path);
      const v = getPath(r, real);
      if (v === undefined) return bad("No value at '" + path + "'. Roots: player, inventory, equipment, story");
      out(real + " = " + brief(v));
    },

    set(r, [path, ...rest]) {
      if (!path || !rest.length) return bad("Usage: admin set <path> <value>");
      const real = resolvePath(r, path);
      const value = parseArg(rest.join(" "));
      setPath(r, real, value);
      ok(real + " = " + brief(value));
    },

    add(r, [path, n]) {
      if (!path || n === undefined) return bad("Usage: admin add <path> <n>");
      const real = resolvePath(r, path);
      const cur = getPath(r, real);
      const num = Number(n);
      if (typeof cur !== "number" || Number.isNaN(num)) return bad(real + " is not a number");
      setPath(r, real, cur + num);
      ok(real + " = " + (cur + num));
    },

    gold(r, [n]) {
      const num = Number(n);
      if (n === undefined || Number.isNaN(num)) return bad("Usage: admin gold <n>");
      r.inventory.coin = Math.max(0, (r.inventory.coin || 0) + num);
      ok("coin = " + r.inventory.coin);
    },

    level(r, [n]) {
      const max = (readGlobal("C") || {}).MAX_LEVEL || 99;
      const num = Math.floor(Number(n));
      if (n === undefined || Number.isNaN(num)) return bad("Usage: admin level <n>  (1-" + max + ")");
      r.player.level = clamp(num, 1, max);
      ok("level = " + r.player.level);
    },

    xp(r, [n]) {
      const num = Math.floor(Number(n));
      if (n === undefined || Number.isNaN(num)) return bad("Usage: admin xp <n>");
      r.player.xp = Math.max(0, (r.player.xp || 0) + num);
      ok("xp = " + r.player.xp);
    },

    give(r, args) {
      const { name, count } = nameAndCount(args);
      if (!name) return bad("Usage: admin give <item> [n]");
      const it = resolveItem(name);
      if (it.error) return bad(it.error);
      if (!Number.isSafeInteger(count) || count < 1) return bad("Item count must be a positive whole number.");
      const add = gameFn("addItem");
      if (add) add(it.name, count, true);
      else {
        r.inventory[it.name] = (r.inventory[it.name] || 0) + count;
        if (typeof markRecipeMaterialSeen === "function") markRecipeMaterialSeen(it.name);
      }
      ok(it.name + " x" + r.inventory[it.name]);
    },

    items(r, [filter = ""]) {
      const tables = ["ITEMS", "USABLE_ITEMS", "recipes", "RAW", "CRYS"].map(readGlobal).filter(isObj);
      const names = [...new Set([...tables.flatMap(Object.keys), ...Object.keys(r.inventory)])]
        .filter((n) => n.toLowerCase().includes(filter.toLowerCase())).sort();
      out(names.join(", ") || "No matching items.");
    },

    perk(r, [id]) {
      const p = readGlobal("PERKS");
      if (!id) return bad("Usage: admin perk <id>");
      const key = p && Object.keys(p).find((k) => k.toLowerCase() === id.toLowerCase());
      if (!key) return bad("Unknown perk '" + id + "'.");
      r.player.perks = Array.isArray(r.player.perks) ? r.player.perks : [];
      if (!r.player.perks.includes(key)) r.player.perks.push(key);
      out("Perk unlocked: " + key);
    },

    spell(r, [id]) {
      const spells = readGlobal("SPELLS");
      if (!id || !isObj(spells)) return bad("Usage: admin spell <id>");
      const key = Object.keys(spells).find((k) => k.toLowerCase() === id.toLowerCase());
      if (!key) return bad("Unknown ability '" + id + "'.");
      r.player.spells = Array.isArray(r.player.spells) ? r.player.spells : [];
      if (!r.player.spells.includes(key)) r.player.spells.push(key);
      out("Ability learned: " + key);
    },

    take(r, args) {
      const { name, count } = nameAndCount(args);
      if (!name) return bad("Usage: admin take <item> [n]");
      const it = resolveItem(name);
      if (it.error) return bad(it.error);
      const left = Math.max(0, (r.inventory[it.name] || 0) - count);
      if (left > 0) r.inventory[it.name] = left; else delete r.inventory[it.name];
      // A save is invalid if an equipped item isn't in the inventory, so unequip it.
      if (left < 1 && isObj(r.equipment)) {
        for (const slot of Object.keys(r.equipment)) {
          if (r.equipment[slot] === it.name) { r.equipment[slot] = null; out("(unequipped " + it.name + ")"); }
        }
      }
      ok(it.name + " x" + left);
    },

    chapter(r, [n]) {
      const chs = readGlobal("STORY_CHAPTERS");
      const hi = Array.isArray(chs) ? chs.length - 1 : 99;
      const num = Math.floor(Number(n));
      if (n === undefined || Number.isNaN(num)) return bad("Usage: admin chapter <n>  (0-" + hi + ")");
      r.story.chapter = clamp(num, 0, hi);
      ok("chapter = " + r.story.chapter);
    },

    fracture(r, [n]) {
      const num = Math.floor(Number(n));
      if (n === undefined || Number.isNaN(num)) return bad("Usage: admin fracture <n>  (0-10)");
      r.story.fracture = clamp(num, 0, 10);
      ok("fracture = " + r.story.fracture);
    },

    flag(r, [name, mode]) {
      const flags = r.story.flags;
      if (!(flags instanceof Set)) return bad("STORY.flags is not a Set");
      if (!name) return out("flags: " + ([...flags].join(", ") || "(none)"));
      if (mode && mode.toLowerCase() === "off") { flags.delete(name); ok("flag cleared: " + name); }
      else { flags.add(name); ok("flag set: " + name); }
    },

    async call(r, [fnName, ...args]) {
      if (!fnName) return bad("Usage: admin call <fn> [args...]");
      const fn = readGlobal(fnName);
      if (typeof fn !== "function") return bad("No global function '" + fnName + "'");
      const result = await fn(...args.map(parseArg));
      ok(fnName + "() done" + (result !== undefined ? " -> " + brief(result) : ""));
    },

    async save() {
      const problem = await persist();
      return problem || "Autosaved.";
    },

    code() {
      const fn = readGlobal("saveCode");
      if (typeof fn !== "function") return bad("saveCode() not found");
      out(fn(), "fx-loot");
    },
  };

  // Commands that don't need a loaded game, and ones that never change anything.
  const NO_STATE = new Set(["help", "call"]);
  const READ_ONLY = new Set(["help", "show", "code", "save"]);

  async function runAdmin(line) {
    const [, sub = "help", ...args] = tokenize(line);
    const name = sub.toLowerCase();
    sink = [];
    let after = null;

    if (name === "lock") {
      unlocked = false;
      out("[admin access removed]");
    } else if (!Object.prototype.hasOwnProperty.call(commands, name)) {
      out("Unknown admin command '" + sub + "'. Type: admin");
    } else {
      const r = root();
      if (!r && !NO_STATE.has(name)) {
        out("The game state isn't ready yet. Start or load a game first.");
      } else {
        try {
          const result = await commands[name](r, args);
          if (typeof result === "string") out(result);
          if (!READ_ONLY.has(name)) after = persist();
        } catch (e) {
          out("admin " + name + " failed: " + e.message);
        }
      }
    }

    const lines = sink.join("\n");
    sink = null;
    emit(lines, line);
    if (after) { const warn = await after; if (warn) emit(warn); }
  }

  // ---------- unlock via the load command ----------
  let unlocked = false;
  let awaitingLoad = false; // the player typed "load" and the game is asking for a code
  let eatEnter = false;     // swallow the matching keypress/keyup of a handled Enter

  function unlock(echo) {
    awaitingLoad = false;
    unlocked = true;
    emit("[admin access granted]  type: admin", echo);
  }

  // First word of a line as the game would resolve it ("load", "19" ...).
  function commandOf(lower) {
    const first = lower.split(/\s+/)[0];
    try {
      if (typeof resolveCommand === "function") return resolveCommand(first);
    } catch (e) { /* fall through */ }
    return first;
  }

  // Let the up-arrow recall admin commands like any other command.
  function rememberInHistory(line) {
    try { (0, eval)("cmdHistory.push(" + JSON.stringify(line) + "); cmdIndex = cmdHistory.length"); }
    catch (e) { /* history is optional */ }
  }

  const cmd = document.getElementById("command");

  // Listen on document (capture) so we run before ANY handler on the input itself.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.target !== cmd || e.key !== "Enter") return;
      const line = cmd.value.trim();
      const lower = line.toLowerCase();

      const swallow = () => {
        e.preventDefault();
        e.stopImmediatePropagation(); // the game never sees it
        eatEnter = true;
        cmd.value = "";
      };

      // "load admin" typed in one line
      if (/^load\s+admin$/.test(lower)) {
        swallow();
        return unlock(line);
      }

      // "admin" typed at the load prompt. Let an EMPTY line through so the game's
      // load prompt ends instead of waiting forever.
      if (awaitingLoad && lower === "admin") {
        awaitingLoad = false;
        unlocked = true;
        cmd.value = "";
        // Say so only once the game has cancelled the load and is back at a prompt.
        const say = () => emit("[admin access granted]  type: admin");
        const wait = (tries) =>
          atPrompt() || tries <= 0 ? say() : setTimeout(() => wait(tries - 1), 50);
        setTimeout(() => wait(60), 30); // first tick lets the game consume the empty line
        return;
      }

      awaitingLoad = commandOf(lower) === "load" && lower.split(/\s+/).length === 1;

      // "admin <command> ..." once unlocked
      if (unlocked && (lower === "admin" || lower.startsWith("admin "))) {
        swallow();
        rememberInHistory(line);
        const fx = readGlobal("FX");
        if (fx && fx.play) fx.play("enter");
        runAdmin(line);
      }
    },
    true
  );

  ["keypress", "keyup"].forEach((type) =>
    document.addEventListener(
      type,
      (e) => {
        if (e.target !== cmd || e.key !== "Enter" || !eatEnter) return;
        e.stopImmediatePropagation();
        if (type === "keyup") eatEnter = false;
      },
      true
    )
  );

  // If the load command ever uses a browser prompt() box instead of the terminal.
  const nativePrompt = window.prompt;
  window.prompt = function () {
    const answer = nativePrompt.apply(this, arguments);
    if (awaitingLoad && typeof answer === "string" && answer.trim().toLowerCase() === "admin") {
      unlock();
      return null;
    }
    return answer;
  };
})();
