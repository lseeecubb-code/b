// Story engine: chapters, objectives, quests and endings.
const curChapter = () =>
  STORY_CHAPTERS[Math.max(0, Math.min(STORY.chapter, STORY_CHAPTERS.length - 1))];
const scene = (id) => [...(STORY_SCENES[id] || [])];
const killCount = (n) => STORY.kills[n] || 0;

function recordStoryMoment(text, kind = "memory", value = "") {
  if (!STORY) return;
  if (!Array.isArray(STORY.journal)) STORY.journal = [];
  const entry = {
    chapter: STORY.chapter,
    kind: String(kind).slice(0, 24),
    text: String(text).trim().slice(0, 180),
    value: String(value || "").slice(0, 60),
  };
  if (!entry.text) return;
  STORY.journal.push(entry);
  if (STORY.journal.length > 60) STORY.journal.splice(0, STORY.journal.length - 60);
}

function showCampaignChronicle() {
  const chapter = curChapter();
  print("\n📚 CAMPAIGN CHRONICLE");
  print("Current chapter: " + chapter.id + " — " + chapter.title);
  print("Current objective: " + STORY_PROGRESS[chapter.id].objective);
  const entries = (STORY.journal || []).slice(-14);
  if (!entries.length) print("\nNo memories have been recorded yet. The story will save major choices and milestones here.");
  else {
    print("\nRecent memories:");
    entries.forEach((entry) => print("  Ch " + entry.chapter + ": " + entry.text));
  }
  const ending = STORY.ending || (PLAYER.ngPlus ? PLAYER.ngPlusEnding : null);
  if (ending) print("\nThe ending echo carried by this run: " + title(ending) + ".");
  const active = WORLD.companions?.active?.[0];
  const companion = typeof COMPANION_DEFS !== "undefined" ? COMPANION_DEFS[active] : null;
  if (companion) print("Traveling with: " + companion.name + ".");
}

async function showAfterstory() {
  if (!STORY.ending) { print("The postgame chapter unlocks after you choose an ending."); return; }
  const step = Number(WORLD.flags.afterstoryStep) || 0;
  if (step >= 3) {
    print("\n📖 AFTER THE LAST SAVE");
    print(WORLD.flags.afterstoryChoice === "share" ? "Your chronicle was shared. Travelers carry its warning across every road." : "You kept one final page. The quiet places can begin again without being watched.");
    print("This postgame chapter is complete. Its choice is preserved in your chronicle.");
    return;
  }
  if (step === 0) {
    print("\n📖 POSTGAME · THE PAGE THAT REMAINED");
    print("After the world settles, a page from the Archive appears in your pack. It contains the names of people whose stories did not fit inside the ending.");
    print(`Your ${title(STORY.ending)} ending leaves the page ${STORY.ending === "remember" ? "covered in careful notes" : STORY.ending === "release" ? "blank at the edges" : "rewritten in a familiar hand"}.`);
    const answer = (await input("Read the names aloud, or carry the page onward? [read/carry]: ")).trim().toLowerCase();
    if (!["read", "r", "carry", "c", ""].includes(answer)) { print("Choose read or carry."); return; }
    WORLD.flags.afterstoryChoice = ["read", "r"].includes(answer) ? "share" : "keep";
    WORLD.flags.afterstoryStep = 1;
    recordStoryMoment(`In the postgame, you chose to ${WORLD.flags.afterstoryChoice === "share" ? "share" : "keep"} the remaining page.`, "choice", `afterstory:${WORLD.flags.afterstoryChoice}`);
    print(WORLD.flags.afterstoryChoice === "share" ? "You read the names. Somewhere, a traveler answers with one of their own." : "You fold the page carefully. Some memories can be carried without being announced.");
    return;
  }
  if (step === 1) {
    print("\n📖 POSTGAME · A PLACE TO RETURN");
    const friend = WORLD.companions.active?.[0];
    print(friend ? `${COMPANION_DEFS[friend].name} walks with you to the old shelter and asks what should become of it.` : "At the old shelter, you find a note asking what should become of the place now that the danger has passed.");
    print(`The hideout is restored to level ${WORLD.hideout?.level || 0}. Your recovered keepsakes${WORLD.hideout?.trophies?.length ? " are gathered together in one place" : " still travel with you"}.`);
    const answer = (await input("Welcome travelers, or leave the shelter quiet? [welcome/quiet]: ")).trim().toLowerCase();
    if (!["welcome", "w", "quiet", "q", ""].includes(answer)) { print("Choose welcome or quiet."); return; }
    WORLD.flags.afterstoryShelter = ["welcome", "w", ""].includes(answer) ? "welcome" : "quiet";
    WORLD.flags.afterstoryStep = 2;
    recordStoryMoment(`You left the old shelter ${WORLD.flags.afterstoryShelter === "welcome" ? "open to travelers" : "quiet"}.`, "choice", `afterstory:${WORLD.flags.afterstoryShelter}`);
    return;
  }
  print("\n📖 POSTGAME · THE ROAD AHEAD");
  const joined = WORLD.flags.afterstoryChoice === "share";
  const welcome = WORLD.flags.afterstoryShelter === "welcome";
  print(`${joined ? "The names you read begin to travel." : "The page remains safe in your pack."} ${welcome ? "The shelter fills with voices and small, practical plans." : "The shelter stays empty, a place where the quiet is allowed to last."}`);
  if (FACTIONS[WORLD.flags.faction]) print(`The ${FACTIONS[WORLD.flags.faction].name} send a final message: they will keep the roads you chose open.`);
  WORLD.flags.afterstoryStep = 3;
  WORLD.flags.afterstoryComplete = true;
  addItem("star glass", 2);
  addItem("coin", 200);
  recordStoryMoment("The postgame chapter ended with a new road open beyond the old campaign.", "ending", "afterstory_complete");
  print("The postgame chapter is complete. You receive 2 star glass and 200 coin.");
}

async function replayChapter(choice = "") {
  const available = STORY_CHAPTERS.filter((chapter) => {
    const sid = STORY_SCENE_BY_CHAPTER[chapter.id];
    return chapter.id < STORY.chapter || STORY.flags.has("chapter_" + chapter.id + "_complete") ||
      (chapter.id === STORY.chapter && sid && STORY.seen.has(sid)) ||
      (chapter.id === STORY_CHAPTERS.length - 1 && STORY.flags.has("final_defeated"));
  });
  if (!available.length) {
    print("No chapter memories are available yet. Play through a chapter opening first.");
    return;
  }
  if (!choice.trim()) {
    print("\n🕰️ CHAPTER MEMORIES");
    available.forEach((chapter) => print("  " + chapter.id + ". " + chapter.title));
    choice = await input("Replay which chapter? (number or title, blank to cancel): ");
  }
  choice = choice.trim().toLowerCase();
  if (!choice) return;
  let id = /^\d+$/.test(choice) ? Number(choice) : -1;
  if (id < 0) {
    const found = available.find((chapter) => chapter.title.toLowerCase() === choice);
    if (found) id = found.id;
  }
  const chapter = available.find((entry) => entry.id === id);
  if (!chapter) {
    print("That chapter memory is not available yet. Choose one from 'replay'.");
    return;
  }
  print("\n🕰️ MEMORY: CHAPTER " + chapter.id + " — " + chapter.title);
  const sid = STORY_SCENE_BY_CHAPTER[chapter.id];
  if (sid) scene(sid).forEach((line) => print(line));
  const route = (STORY.journal || []).filter((entry) => entry.chapter === chapter.id &&
    entry.kind === "choice" && ["safe", "risky"].includes(entry.value)).slice(-1)[0];
  const companionId = WORLD.companions?.active?.[0];
  const companion = typeof COMPANION_DEFS !== "undefined" ? COMPANION_DEFS[companionId] : null;
  const reflections = typeof COMPANION_REPLAY_LINES !== "undefined" ? COMPANION_REPLAY_LINES[companionId] : null;
  if (companion && reflections) {
    print("\n🤝 " + companion.name + " remembers:");
    print("\"" + reflections[route?.value || "default"] + "\"");
  } else print("\nBring a companion along with 'party' to hear their reflection in this memory.");
  if (chapter.id === STORY_CHAPTERS.length - 1 && STORY.flags.has("final_defeated")) {
    const preview = (await input("\nPreview an ending? [remember/release/rewrite, blank to skip]: ")).trim().toLowerCase();
    if (ENDINGS[preview]) {
      print("\n🔮 WHAT-IF MEMORY — your saved ending will not change.");
      print(ENDINGS[preview].title);
      print(ENDINGS[preview].text);
    }
  }
}
// Picks a random fourth-wall message that fits the current Fracture level.
function showStrangeEvent() {
  print("\n🌀 " + fourthWall());
  if (STORY.chapter < 6 || STORY.flags.has("secret_echo_save_found")) return;
  const signal = [1, 2, 3].find((n) => !STORY.flags.has("secret_echo_signal_" + n));
  if (!signal) return;
  STORY.flags.add("secret_echo_signal_" + signal);
  if (signal < 3) {
    print(`📡 A second message pulses beneath it: ${signal}/3 echoes answered.`);
    return;
  }
  STORY.flags.add("secret_echo_save_found");
  print("📡 Three save echoes align. Something has been copied into the bestiary's fight list.");
  print("Type 'fight the echo of attempts' to face it when you are ready.");
}

function fourthWall() {
  const l = Math.max(0, Math.min(STORY.fracture, 10)),
    e = FOURTH_WALL_EVENTS[l];
  return e[randint(0, e.length - 1)];
}
// After a fight, sometimes shows a fourth-wall message.
function maybeFourthWall() {
  if (STORY.fracture > 0 && Math.random() < 0.2) print("\n⚠️ " + fourthWall());
}
// True when the current chapter's level and kill/boss objective are done.
function objectiveComplete() {
  const p = STORY_PROGRESS[STORY.chapter];
  if (PLAYER.level < p.level) return false;
  if (p.boss) return killCount(p.boss) > 0;
  return Object.entries(p.kills).every(([e, n]) => killCount(e) >= n);
}
// Gives the quest rewards for finishing a chapter.
function chapterRewards(ch) {
  for (const [qn, q] of Object.entries(STORY_QUESTS)) {
    if (q.chapter !== ch) continue;
    print(`\n🎉 QUEST COMPLETE: ${qn}`);
    for (const [k, a] of Object.entries(q.reward)) {
      if (k === "xp") {
        print(`Earned ${a} Exp.`);
        grantXp(a);
      } else {
        addItem(k, a);
      }
    }
    return;
  }
}
// Counts a kill and, if it completes the chapter objective, unlocks the next chapter.
function recordVictory(mn) {
  const name = mn.trim().toLowerCase();
  STORY.kills[name] = (STORY.kills[name] || 0) + 1;
  const ch = STORY.chapter,
    p = STORY_PROGRESS[ch];
  if (STORY.flags.has("final_defeated") && ch === STORY_CHAPTERS.length - 1) return;
  if (p.boss !== null && p.boss !== undefined) {
    if (name !== p.boss) return;
  } else if (Object.entries(p.kills).some(([e, n]) => killCount(e) < n)) return;
  if (PLAYER.level < p.level) {
    print("\n📜");
    print(`   Reach level ${p.level} (you are level ${PLAYER.level}).`);
    return;
  }
  chapterRewards(ch);
  recordStoryMoment("Chapter " + ch + ": " + STORY_CHAPTERS[ch].title + " completed.", "chapter");
  STORY.flags.add(`chapter_${ch}_complete`);
  if (ch === STORY_CHAPTERS.length - 1) {
    STORY.flags.add("final_defeated");
    print("\n🌑 THE WORLD HAS REACHED ITS LAST SAVE.");
    print("The final choice is now available: type 'ending'.");
    return;
  }
  STORY.chapter++;
  if (typeof maybeRecruitFromStory === "function") maybeRecruitFromStory();
  STORY.fracture = STORY_CHAPTERS[STORY.chapter].fracture;
  const nw = curChapter();
  STORY.flags.add(`chapter_${nw.id}_unlocked`);
  recordStoryMoment("Chapter " + nw.id + ": " + nw.title + " opened.", "chapter");
  print("\n" + "=".repeat(62));
  print("📖");
  print(`Chapter ${nw.id}: ${nw.title}`);
  print(nw.title);
  print("=".repeat(62));
  print(`\n${nw.summary}`);
  print(`🗺️ New region: ${nw.area}`);
  const sid = STORY_SCENE_BY_CHAPTER[nw.id];
  if (sid) {
    print();
    scene(sid).forEach((l) => print(l));
    STORY.seen.add(sid);
  }
  const cl = CHAPTER_CHARACTER_LINES[nw.id];
  if (cl) print(`\n💬 ${cl[0]}: ${STORY_CHARACTERS[cl[0]][cl[1]]}`);
  print("\n🎯");
  print(STORY_PROGRESS[nw.id].objective);
  print("\n🔓");
  STORY_UNLOCKS[nw.id].forEach((u) => print(`  • ${u}`));
  print(`\n⚠️ FRACTURE LEVEL: ${STORY.fracture}/10`);
}
// Plays the opening scene the first time the game starts.
function storyIntro() {
  if (STORY.seen.has("chapter_0_intro")) return;
  print("\n" + "=".repeat(62));
  print("📖");
  print("=".repeat(62));
  scene("chapter_0_intro").forEach((l) => print(l));
  STORY.seen.add("chapter_0_intro");
  STORY.flags.add("story_started");
  recordStoryMoment("Mira found you on the quiet road, already writing down its silences.", "scene");
  print("\n🎯");
  print(STORY_PROGRESS[0].objective);
}
// The 'story' command: chapter, objective and progress.
function showStory() {
  const ch = curChapter(),
    id = ch.id,
    p = STORY_PROGRESS[id];
  print("\n" + "=".repeat(62));
  print("📖");
  print("=".repeat(62));
  print(`Chapter ${id} — ${ch.title}`);
  print(`Current region: ${ch.area}`);
  print(`\n${ch.summary}`);
  print(`\nWorld fracture: ${STORY.fracture}/10`);
  print("\n🎯");
  print(`  ${p.objective}`);
  print(`\n📌 Tracked: ${WORLD.flags.trackedQuest || "Main campaign"} · change with 'track'.`);
  print("\n📈");
  print(`  Hero level: ${PLAYER.level}/${p.level}`);
  for (const [e, a] of Object.entries(p.kills))
    print(`  ${title(e)}: ${Math.min(killCount(e), a)}/${a}`);
  if (p.boss)
    print(`  👑 Chapter boss: ${title(p.boss)} (${killCount(p.boss) > 0 ? "defeated" : "still waiting"})`);
  print("\n🔓");
  STORY_UNLOCKS[id].forEach((u) => print(`  • ${u}`));
  print("\n🗺️ Type 'explore' to travel the region, find encounters, and advance the story.");
  const b = STORY_BOSS_BY_CHAPTER[id];
  if (b)
    print(
      `When you reach level ${p.level}, 'explore' lets you challenge ${title(b)} (choose 'boss').`
    );
}
// Gives a save-aware path through the campaign without changing story progress.
function showProgressionGuide() {
  const chapter = curChapter();
  const p = STORY_PROGRESS[chapter.id];
  const finished = STORY.flags.has("final_defeated");
  print("\n🧭 CAMPAIGN GUIDE");
  print("Explore advances the current chapter. Defeat its target after reaching the listed level.");
  print(`\n📍 Chapter ${chapter.id}: ${chapter.title}`);
  print(`Region: ${chapter.area} · Recommended level: ${p.level}`);
  print(`Objective: ${p.objective}`);
  if (finished) {
    if (!STORY.ending) print("\n✅ The campaign's final boss is defeated. Type 'ending' to choose the world's fate.");
    else print("\n✅ Ending complete. Type 'ngplus' when you want to start a tougher replay.");
  } else if (PLAYER.level < p.level) {
    print(`\n📈 You need ${p.level - PLAYER.level} more level${p.level - PLAYER.level === 1 ? "" : "s"} for this chapter's objective.`);
    print(`Explore ${chapter.area}, finish available quests, and improve your gear in town for more XP and safer fights.`);
  } else if (p.boss) {
    if (killCount(p.boss) > 0) print("\n✅ The chapter boss is defeated. Type 'explore' to continue the story.");
    else print(`\n👑 You are ready for ${title(p.boss)}. Type 'explore', then choose 'boss'.`);
  } else {
    const remaining = Object.entries(p.kills || {}).filter(([enemy, count]) => killCount(enemy) < count);
    if (!remaining.length) print("\n✅ The objective is complete. Type 'explore' to continue the story.");
    else {
      print("\n🎯 Still needed:");
      for (const [enemy, count] of remaining)
        print(`• ${title(enemy)}: ${Math.max(0, count - killCount(enemy))} more`);
      print("\nType 'explore' to hunt for the remaining target.");
    }
  }
  print("\n🛠️ Between story fights: 'quests' for optional rewards · 'town' to rest and prepare · 'craft' and 'recipes' for gear · 'stats' and 'perks' to build your character.");
  print("\n🗺️ CAMPAIGN ROUTE");
  for (const ch of STORY_CHAPTERS) {
    const objective = STORY_PROGRESS[ch.id];
    const boss = STORY_BOSS_BY_CHAPTER[ch.id];
    const state = ch.id < STORY.chapter ? "✅" : ch.id === STORY.chapter ? "➡️" : "🔒";
    print(`${state} ${ch.id}. ${ch.title} · Lv ${objective.level}${boss ? " · " + title(boss) : ""}`);
  }
  print("\n🔎 Strange 'event' messages sometimes hide optional routes. Undiscovered secrets stay off this route list.");
}
function openHiddenPassage() {
  if (STORY.chapter < 4) {
    print("\n🪨 The word echoes against a wall that is not here yet.");
    return;
  }
  if (PLAYER.level < 12) {
    print("\n🪨 Something answers from behind the margin, but you are not ready to follow it. Reach level 12.");
    return;
  }
  if (STORY.flags.has("secret_missing_page_found")) {
    print("\n📄 The hidden route is open. Type 'fight the missing page' to challenge what waits there.");
    return;
  }
  STORY.flags.add("secret_missing_page_found");
  recordStoryMoment("You found the hidden passage behind the margin.", "discovery");
  print("\n📄 XYZZY. A line of text tears open in the margin.");
  print("A hidden challenger has been added to your fight list. Type 'fight the missing page' when ready.");
}
function showSudoEasterEgg() {
  print("\n🔐 Permission denied: the roots belong to the story, not the hero.");
}

// The 'explore' command: travel the chapter's area and start a fight (or the boss).
async function exploreStory() {
  const ch = STORY.chapter,
    p = STORY_PROGRESS[ch],
    an = curChapter().area,
    area = STORY_AREAS[an] || {};
  const enc = (area.encounters || []).filter((n) => monsters[n]);
  if (!enc.length) {
    print(`\nThe area '${an}' has no valid encounters yet.`);
    return;
  }
  const availableEnc = enc.filter((name) => PLAYER.level >= enemyRequiredLevel(name));
  if (!availableEnc.length) {
    const nextLevel = Math.min(...enc.map(enemyRequiredLevel));
    print(`\n🛡️ The creatures here are too dangerous for you yet. Reach level ${nextLevel} to face the weakest local enemy.`);
    return;
  }
  print("\n" + "=".repeat(62));
  print(`🗺️ ${an.toUpperCase()}`);
  print("=".repeat(62));
  print(area.description || "");
  print(`🏘️ Nearby safe hub: ${typeof TOWNS !== "undefined" ? TOWNS[currentTownId()].name : "town"} — type 'town' to rest, trade, or prepare.`);
  if (p.boss && !objectiveComplete()) {
    if (PLAYER.level >= p.level) {
      print(`\n👑 A powerful foe blocks the way forward: ${title(p.boss)}.`);
      const c = (await input("Choose: challenge the boss, keep exploring, or return to town? [boss/explore/town]: "))
        .trim()
        .toLowerCase();
      if (c === "boss" || c === "b") {
        await fightMonster(p.boss);
        return;
      }
      if (c === "town" || c === "t") {
        if (typeof townMenu === "function") await townMenu();
        return;
      }
    } else
      print(
        `\nSomething waits deeper in this area... but you are not ready (level ${p.level} needed).`
      );
  }
  const needed = Object.entries(p.kills)
    .filter(([e, n]) => killCount(e) < n && monsters[e] && PLAYER.level >= enemyRequiredLevel(e))
    .map((x) => x[0]);
  let enemy;
  if (needed.length && (ch === 0 || Math.random() < 0.4)) enemy = needed[0];
  else
    enemy = wchoice(
      availableEnc,
      availableEnc.map((n) => Math.max(1, monsters[n].chance))
    );
  print(`\n👣 You press farther into ${an}, watching for movement...`);
  const discovery = typeof rollExploreDiscovery === "function" ? rollExploreDiscovery(availableEnc) : null;
  if (discovery) {
    print(`You spot ${title(enemy)} tracks, and also find something worth investigating.`);
    print(`1. Hunt ${title(enemy)}`);
    print(`2. ${exploreDiscoveryLabel(discovery)}`);
    print("0. Return to the trail without pursuing either lead");
    const choice = (await input("Which lead do you follow? [1/2/0]: ")).trim().toLowerCase();
    if (["0", "back", "leave", "cancel"].includes(choice)) {
      print("You leave both leads for another day.");
      return;
    }
    if (["2", "event", "discovery"].includes(choice)) {
      recordStoryMoment("You followed the discovery: " + exploreDiscoveryLabel(discovery) + ".", "choice", "discovery");
      await maybeExploreEvent(an, discovery, availableEnc);
      if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
      return;
    }
  }
  if (discovery) recordStoryMoment("You followed " + title(enemy) + " tracks instead of investigating the discovery.", "choice", "tracks");
  let fightArg = enemy;
  if (Math.random() < 0.18 && !needed.includes(enemy) && monsters[enemy]?.chance > 0) {
    const pal = availableEnc.find((n) => n !== enemy) || enemy;
    fightArg = enemy + "," + pal;
    print(`⚠️ Two enemies move to surround you: ${title(enemy)} and ${title(pal)}.`);
  } else if (Math.random() < 0.1 && monsters[enemy]?.chance > 0) {
    print(`🌟 The air shifts. An elite ${title(enemy)} steps into your path!`);
    fightArg = enemy;
    var encounterIsElite = true;
  } else {
    var encounterIsElite = false;
  }
  const encounterNames = Array.isArray(fightArg) ? fightArg : String(fightArg).split(",");
  print(`⚠️ ${encounterNames.map((name) => title(name)).join(" and ")} ${encounterNames.length === 1 ? "appears" : "appear"}.`);
  while (true) {
    const choice = (await input("What do you do? [fight/spare] ")).trim().toLowerCase();
    if (["fight", "f", "1", "yes", "y", ""].includes(choice)) break;
    if (["spare", "s", "mercy", "2", "leave"].includes(choice)) {
      WORLD.flags.mercifulEncounters = (WORLD.flags.mercifulEncounters || 0) + 1;
      recordStoryMoment("You spared " + encounterNames.map((name) => title(name)).join(" and ") + ".", "choice", "spare");
      print(`💛 You lower your weapon. ${encounterNames.map((name) => title(name)).join(" and ")} leave peacefully.`);
      print("No XP, loot, or kill progress is earned from a spared encounter.");
      return;
    }
    print("Choose 'fight' or 'spare'.");
  }
  await fightMonster(fightArg, encounterIsElite);
}
// The 'ending' command: the final three-way choice after The Last Save.
async function showEnding() {
  if (!STORY.flags.has("final_defeated")) {
    print("\n🔒 The final choice is still out of reach.");
    print("⚔️ Defeat The Last Save at the end of Chapter 10 to unlock it.");
    return;
  }
  const play = (c) => {
    const r = ENDINGS[c];
    print("\n" + "=".repeat(62));
    print(r.title);
    print("=".repeat(62));
    print("\n" + r.text);
    const routes = WORLD.flags.routeChoices || [];
    const safe = routes.filter((x) => x === "safe").length;
    const risky = routes.filter((x) => x === "risky").length;
    if (safe || risky) print(`\nYour roads left a mark: ${safe} safe passage${safe === 1 ? "" : "s"}, ${risky} dangerous shortcut${risky === 1 ? "" : "s"}. ${safe > risky ? "Travelers remember the shelter you helped preserve." : risky > safe ? "The paths you forced open remain scars and warnings." : "People remember how you balanced caution and courage."}`);
    const bond = WORLD.flags.companionBondChoices || {};
    Object.entries(bond).forEach(([id]) => { if ((WORLD.companions.personal[id]?.moments || []).length >= (COMPANION_BOND_LINES[id]?.length || 3)) print(`${COMPANION_DEFS[id]?.name || title(id)} stands beside you, carrying the stories you shared, including the future you chose together.`); });
    if (FACTIONS[WORLD.flags.faction]) {
      const faction = FACTIONS[WORLD.flags.faction];
      print(`The ${faction.name} remember your pledge and keep your chosen roads supplied.`);
    }
    if ((WORLD.flags.puzzlesSolved || 0) > 0) print(`You solved ${WORLD.flags.puzzlesSolved} regional puzzle${WORLD.flags.puzzlesSolved === 1 ? "" : "s"}; the caches you opened helped the world rebuild.`);
    if ((WORLD.hideout?.level || 0) > 0) print(`Your restored hideout becomes a ${WORLD.flags.afterstoryShelter === "welcome" ? "welcoming refuge" : "quiet waystation"} for whoever needs it next.`);
  };
  if (STORY.ending) {
    play(STORY.ending);
    return;
  }
  print("\n" + "=".repeat(62));
  print("THE LAST SAVE");
  print("=".repeat(62));
  ENDGAME_PROMPT.forEach((l) => print(l));
  while (true) {
    const c = (await input("\nChoose remember / release / rewrite: ")).trim().toLowerCase();
    if (ENDINGS[c]) {
      STORY.ending = c;
      STORY.flags.add("ending_complete");
      recordStoryMoment("You chose the " + ENDINGS[c].title.toLowerCase() + " ending.", "ending", c);
      play(c);
      if (typeof checkAchievements === "function") checkAchievements();
      print("\n🔁 You can begin New Game+ with 'ngplus'. Your completed ending stays safe.");
      return;
    }
    print("Choose exactly: remember, release, or rewrite.");
  }
}

