// Terminal UI: prints game text to the page, turns the input box into the game's input(), and autosaves.
const SAVE_KEY = "the-last-save.autosave.v1";
const termScreen = document.getElementById("screen");
const termInput = document.getElementById("command");
const termStatus = document.getElementById("status");
const AUTOSAVE_INTERVAL_MS = 30_000;
let pendingInput = null,
  cmdHistory = [],
  cmdIndex = 0;
let autosaveDueAt = 0,
  autosaveTicker = null,
  autosaveAvailable = true;

function showLoadingIndicator(message = "Still working…") {
  termStatus.classList.add("is-loading");
  termStatus.textContent = message;
}

function clearLoadingIndicator() {
  termStatus.classList.remove("is-loading");
}

function updateAutosaveCountdown() {
  if (!autosaveAvailable || !pendingInput || termStatus.classList.contains("is-loading")) return;
  const secondsLeft = Math.max(0, Math.ceil((autosaveDueAt - Date.now()) / 1000));
  if (secondsLeft === 0) {
    autosave();
    return;
  }
  termStatus.textContent = `💾 Saved · saving in ${secondsLeft}s`;
}

// Adds text to the screen. Text ending in "\n" becomes a finished line; anything else (like the
// "what do you want to do?" prompt) stays on the same line as what the player types next.
function write(text) {
  const endsLine = text.endsWith("\n");
  Typewriter.print(endsLine ? text.slice(0, -1) : text, { plain: true, newline: endsLine });
}

// The game's print(): every line goes through the typewriter, which paces it (during battle)
// and sends it to the effects system for colors, shakes and sounds.
function print(...args) {
  for (const line of args.join(" ").split("\n")) Typewriter.print(line);
}

function autosave() {
  try {
    localStorage.setItem(SAVE_KEY, saveCode());
    autosaveAvailable = true;
    autosaveDueAt = Date.now() + AUTOSAVE_INTERVAL_MS;
    termStatus.textContent = "💾 Saved · saving in 30s";
    if (autosaveTicker === null) autosaveTicker = setInterval(updateAutosaveCountdown, 1000);
  } catch (e) {
    autosaveAvailable = false;
    termStatus.textContent = "Autosave unavailable in this browser";
  }
}

// The game awaits this wherever the Python version called input().
// It waits for the typewriter to finish showing everything first, so the prompt never appears
// in the middle of a battle line.
async function input(prompt = "") {
  clearLoadingIndicator();
  write(prompt);
  autosave();
  await Typewriter.idle();
  return new Promise((resolve) => {
    pendingInput = resolve;
    termInput.focus();
  });
}

termInput.addEventListener("keydown", (e) => {
  // While text is still typing out, Enter / Space / Escape skip ahead and other keys do nothing.
  if (Typewriter.isBusy()) {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    if (["Enter", " ", "Escape"].includes(e.key)) Typewriter.skip();
    return;
  }
  // Soft typing click for printable keys (and a slightly deeper one for backspace).
  if (e.key.length === 1 || e.key === "Backspace") FX.play("key");
  if (e.key === "Enter") {
    e.preventDefault();
    FX.play("enter");
    const value = termInput.value;
    termInput.value = "";
    if (!pendingInput) return;
    if (value.trim()) {
      cmdHistory.push(value);
      if (cmdHistory.length > 100) cmdHistory.shift();
      cmdIndex = cmdHistory.length;
    }
    write(value + "\n");
    const resolve = pendingInput;
    pendingInput = null;
    showLoadingIndicator();
    requestAnimationFrame(() => setTimeout(() => resolve(value), 0));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (cmdHistory.length) {
      cmdIndex = Math.max(0, cmdIndex - 1);
      termInput.value = cmdHistory[cmdIndex] || "";
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (cmdHistory.length) {
      cmdIndex = Math.min(cmdHistory.length, cmdIndex + 1);
      termInput.value = cmdHistory[cmdIndex] || "";
    }
  }
});

termScreen.addEventListener("click", () => termInput.focus());
document.getElementById("newGame").addEventListener("click", () => {
  if (confirm("Delete the automatic save and start a new game?")) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    location.reload();
  }
});

// Battles are shown like dialogue: wrap fightMonster() so the typewriter knows when one is running.
// (This must come after commands.js and combat.js have been loaded.)
const runFight = fightMonster;
fightMonster = async function (...args) {
  Typewriter.setBattle(true);
  try {
    return await runFight.apply(this, args);
  } finally {
    Typewriter.setBattle(false);
  }
};

let savedCode = "";
try {
  savedCode = localStorage.getItem(SAVE_KEY) || "";
} catch (e) {}
showLoadingIndicator("Starting your game…");
requestAnimationFrame(() =>
  setTimeout(
    () => runGame(savedCode).catch((e) => {
      clearLoadingIndicator();
      write("\n[error] " + ((e && e.stack) || e) + "\n");
    }),
    0
  )
);
