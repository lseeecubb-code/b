// Terminal UI: prints game text to the page, turns the input box into the game's input(), and autosaves.
const SAVE_KEY = "the-last-save.autosave.v1";
const termScreen = document.getElementById("screen");
const termInput = document.getElementById("command");
const termStatus = document.getElementById("settingsButton");
let pendingInput = null,
  pendingChoices = [],
  pendingChoiceIndex = -1;

function showLoadingIndicator(message = "Still working…") {
  termStatus.classList.add("is-loading");
  termStatus.textContent = message;
}

function clearLoadingIndicator() {
  termStatus.classList.remove("is-loading");
  termStatus.disabled = false;
  termStatus.textContent = "⚙️ Settings";
  termStatus.setAttribute("aria-label", "Open game settings");
}

function reportStartupError(error) {
  const message = error && error.stack ? error.stack : String(error || "Unknown startup error");
  console.error("THE LAST SAVE startup error:", error);
  try {
    clearLoadingIndicator();
    const output = document.createElement("pre");
    output.style.whiteSpace = "pre-wrap";
    output.style.color = "#ff7777";
    output.textContent = "[startup error] " + message;
    termScreen.replaceChildren(output);
  } catch (displayError) {
    termScreen.textContent = "[startup error] " + message;
  }
}

window.addEventListener("error", (event) => {
  if (!termScreen.textContent.trim() || termScreen.textContent.trim() === ">>>")
    reportStartupError(event.error || event.message);
});

// Adds text to the screen. Text ending in "\n" becomes a finished line; anything else (like the
// "what do you want to do?" prompt) stays on the same line as what the player types next.
function write(text) {
  const endsLine = text.endsWith("\n");
  Typewriter.print(endsLine ? text.slice(0, -1) : text, { plain: true, newline: endsLine });
}

// The game's print(): every line goes through the typewriter, which paces it (during battle)
// and sends it to the effects system for colors, shakes and sounds.
function print(...args) {
  const lines = args.join(" ").split("\n");
  if (typeof WORLD !== "undefined") {
    if (!Array.isArray(WORLD.dialogueLog)) WORLD.dialogueLog = [];
    WORLD.dialogueLog.push(...lines.map((line) => String(line).slice(0, 240)));
    if (WORLD.dialogueLog.length > 240) WORLD.dialogueLog.splice(0, WORLD.dialogueLog.length - 240);
  }
  for (const line of lines) Typewriter.print(line);
}

function autosave(manual = false) {
  try {
    if (WORLD?.flags?.practiceMode && !manual) return;
    if (typeof WORLD !== "undefined" && WORLD.memories) WORLD.memories.lastSeenAt = Date.now();
    localStorage.setItem(SAVE_KEY, saveCode());
    termStatus.title = "Your adventure is saved automatically.";
    if (manual) print("💾 Game saved.");
  } catch (e) {
    termStatus.title = "Saving is unavailable in this browser.";
    if (manual) print("❌ Save failed: this browser could not store the save.");
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
    const choiceMatch = String(prompt).match(/\[([^\]]*\/[^\]]*)\]/);
    pendingChoices = choiceMatch
      ? choiceMatch[1].split("/").map((choice) => choice.split(",")[0].trim()).filter(Boolean)
      : [];
    pendingChoiceIndex = -1;
    termInput.placeholder = pendingChoices.length ? "↑/↓ select an option, or type your own..." : "Type a command...";
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
    termInput.placeholder = "Type a command...";
    write(value + "\n");
    const resolve = pendingInput;
    pendingInput = null;
    pendingChoices = [];
    pendingChoiceIndex = -1;
    showLoadingIndicator();
    requestAnimationFrame(() => setTimeout(() => resolve(value), 0));
  } else if (e.key === "ArrowUp") {
    if (!pendingChoices.length || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    pendingChoiceIndex = pendingChoiceIndex <= 0 ? pendingChoices.length - 1 : pendingChoiceIndex - 1;
    termInput.value = pendingChoices[pendingChoiceIndex];
  } else if (e.key === "ArrowDown") {
    if (!pendingChoices.length || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    pendingChoiceIndex = (pendingChoiceIndex + 1) % pendingChoices.length;
    termInput.value = pendingChoices[pendingChoiceIndex];
  }
});

termScreen.addEventListener("click", () => termInput.focus());
termStatus.addEventListener("click", () => {
  if (!pendingInput || termStatus.disabled || Typewriter.isBusy()) return;
  termInput.value = "settings";
  termInput.focus();
  termInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
});
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
      reportStartupError(e);
    }),
    0
  )
);
