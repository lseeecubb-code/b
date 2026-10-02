// Typewriter: prints game text like dialogue instead of dumping it all at once.
//
// Every line the game prints is queued here. During a battle, lines that tell you what happened
// ("The Wolf uses POUNCE!", "You hit the Wolf for 12 damage!") type out quickly and then pause
// for a moment. Reaction lines like "The Wolf dodges your attack!" type slower and pause longer,
// so you have time to take them in. Menus, status bars and other extra info in battle type out
// quickly with a tiny pause; everything outside battle appears instantly.
//
// Enemy intent narration is paced like dialogue. The practical details beneath it (damage,
// defenses, and guard effects) use the quick combat-info pace so they are easy to scan.
//
// Press Enter, Space or Escape (or click the screen) to skip ahead. The "Text" button in the title
// bar switches between Normal, Fast and Instant.

const Typewriter = (() => {
  const SPEED_KEY = "the-last-save.textspeed";

  // msPerChar: time per typed character. pause: wait after the line finishes.
  const TIERS = {
    instant: { msPerChar: 0, pause: 0 },
    event: { msPerChar: 12, pause: 220 }, // something happened
    reaction: { msPerChar: 28, pause: 550 }, // dodges, misses, parries, stuns: let it sink in
    // Enemy intent narration is dramatic; the actionable details beneath it stay quick.
    intent: { msPerChar: 36, pause: 600 },
    // Extra info during battle (HP/energy bars, last move, stance notes, the action menu...):
    // not instant, but much quicker than the intent text, with a tiny pause between lines.
    extra: { msPerChar: 6, pause: 50 },
  };

  // Lines inside the intent block that are plain numbers/checks rather than story text.
  const INTENT_STAT = /^(Damage:|Type:|Element:|Accuracy:|Effect:|Drains:|[✓✗] |.* is guarding — your attacks will deal|\s+(It will|Fast attacks|Your attacks deal))/;
  const INTENT_START = /=== ENEMY INTENT ===/;
  const INTENT_END = /YOUR TURN|=== YOUR ACTION ===|^===== Turn|THE .*'S TURN/;

  // First match wins. Lines that match nothing stay instant.
  const PACING_RULES = [
    {
      tier: "reaction",
      match:
        /dodges your attack|You dodge|You fail to dodge|misses|and miss!|parries your attack|⚔️ PARRY!|PERFECT PARRY|cannot be (blocked|dodged|parried)|pierces your guard|ripostes|is staggered|is stunned|is blinded|You only deal|holds its (guard|parry stance|dodge stance)|^\s*💤|couldn't get away|You escaped|wasn't needed|WARNING!|resistance shrugs/,
    },
    {
      tier: "event",
      match:
        /A wild .* appeared|YOUR TURN|'S TURN|You hit the|You are hit|Counterattack deals|Critical hit|✨ The .* uses|✨ You use|You swing|🧪 You use|It heals|drains|Guard reduces|You raise your guard|ready yourself|get ready to dodge|You try to|deals \d+ damage|wears off|You are (poisoned|burning|bleeding)|You defeated|defeated you|XP from|dropped loot|Unlucky|PHOENIX|LEVEL UP|unlocked!|Recoil|It explodes/,
    },
  ];

  const screen = document.getElementById("screen");

  // ---------- Settings ----------

  const MODES = [
    { name: "Normal", scale: 1 },
    { name: "Fast", scale: 0.4 },
    { name: "Instant", scale: 0 },
  ];
  let mode = 0;
  try {
    mode = Math.max(
      0,
      MODES.findIndex((m) => m.name === localStorage.getItem(SPEED_KEY))
    );
  } catch (e) {}

  function updateButton() {
    const button = document.getElementById("speedToggle");
    if (button) button.textContent = `⌨️ Text: ${MODES[mode].name}`;
  }
  function cycleSpeed() {
    mode = (mode + 1) % MODES.length;
    try {
      localStorage.setItem(SPEED_KEY, MODES[mode].name);
    } catch (e) {}
    updateButton();
  }

  // ---------- Battle flag ----------

  let inBattle = false;
  const setBattle = (on) => (inBattle = on);

  // Decides how a line is paced. Pacing is only used during battle; everything else is instant.
  let inIntent = false; // true while the lines of the ENEMY INTENT block are being queued
  function tierFor(line, plain) {
    if (plain) inIntent = false; // prompts and typed commands end the block
    if (!inBattle) {
      inIntent = false;
      return "instant";
    }
    if (plain || !line.trim()) return "instant";
    if (INTENT_END.test(line)) inIntent = false;
    if (INTENT_START.test(line)) inIntent = true;
    if (inIntent) return INTENT_STAT.test(line) ? "extra" : "intent";
    const rule = PACING_RULES.find((r) => r.match.test(line));
    return rule ? rule.tier : "extra";
  }

  // ---------- Queue ----------

  const queue = [];
  let running = false;
  let fastForward = false; // set by skip(): finish everything queued without delays
  let finishNow = null; // finishes the line currently typing
  let pauseTimer = null;
  let idleWaiters = [];

  const isBusy = () => running || queue.length > 0;

  function print(line, options = {}) {
    queue.push({ line, options, tier: tierFor(line, options.plain) });
    if (!running) next();
  }

  // Resolves when everything queued has finished appearing.
  function idle() {
    return isBusy() ? new Promise((resolve) => idleWaiters.push(resolve)) : Promise.resolve();
  }

  function scrollDown() {
    screen.scrollTop = screen.scrollHeight;
  }

  function textNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  // Shows the next queued line, typing it out if its pacing asks for that.
  function next() {
    const item = queue.shift();
    if (!item) {
      running = false;
      fastForward = false;
      idleWaiters.splice(0).forEach((resolve) => resolve());
      return;
    }
    running = true;

    const { el, trigger } = FX.renderLine(item.line, item.options);
    const tier = TIERS[item.tier];
    const { scale } = MODES[mode];
    const msPerChar = tier.msPerChar * scale;
    const pause = tier.pause * scale;

    const nodes = textNodes(el);
    const fullText = nodes.map((n) => n.data);
    const total = fullText.reduce((sum, t) => sum + t.length, 0);

    screen.appendChild(el);
    trigger();

    const finishLine = () => {
      finishNow = null;
      nodes.forEach((n, i) => (n.data = fullText[i]));
      scrollDown();
      if (fastForward || pause === 0) next();
      else pauseTimer = setTimeout(() => ((pauseTimer = null), next()), pause);
    };

    if (fastForward || msPerChar === 0 || total === 0) {
      finishLine();
      return;
    }

    // Type the line: reveal characters based on how much time has passed.
    nodes.forEach((n) => (n.data = ""));
    const startedAt = performance.now();
    let shown = 0;
    const flat = fullText.join("");
    const blipKind = item.tier === "intent" ? "intent" : item.tier === "reaction" ? "talk" : null;
    finishNow = () => {
      cancelAnimationFrame(frameId);
      finishLine();
    };
    let frameId = 0;
    const frame = (now) => {
      const wanted = Math.min(total, Math.floor((now - startedAt) / msPerChar));
      if (wanted > shown) {
        shown = wanted;
        if (blipKind && /\S/.test(flat[shown - 1] || "")) FX.blip(blipKind);
        let left = shown;
        nodes.forEach((n, i) => {
          const take = Math.max(0, Math.min(fullText[i].length, left));
          n.data = fullText[i].slice(0, take);
          left -= take;
        });
        scrollDown();
      }
      if (shown >= total) finishNow();
      else frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
  }

  // Skips the typing and waiting: everything queued appears right away.
  function skip() {
    if (!isBusy()) return;
    fastForward = true;
    if (finishNow) finishNow();
    else if (pauseTimer) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
      next();
    }
  }

  document.getElementById("speedToggle")?.addEventListener("click", cycleSpeed);
  screen.addEventListener("click", skip);
  updateButton();

  return { print, idle, skip, isBusy, setBattle };
})();
