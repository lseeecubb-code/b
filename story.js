// Story engine: chapters, objectives, quests and endings.
const curChapter = () =>
  STORY_CHAPTERS[Math.max(0, Math.min(STORY.chapter, STORY_CHAPTERS.length - 1))];
const scene = (id) => [...(STORY_SCENES[id] || [])];
const killCount = (n) => STORY.kills[n] || 0;
// Picks a random fourth-wall message that fits the current Fracture level.
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
    print(`\n🏅 QUEST COMPLETE: ${qn}`);
    for (const [k, a] of Object.entries(q.reward)) {
      if (k === "xp") {
        print(`   +${a} XP`);
        grantXp(a);
      } else {
        print(`   +${a} ${k}`);
        addItem(k, a, true);
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
    print("\n📜 STORY PROGRESS: The next chapter is close.");
    print(`   Reach level ${p.level} (you are level ${PLAYER.level}).`);
    return;
  }
  chapterRewards(ch);
  STORY.flags.add(`chapter_${ch}_complete`);
  if (ch === STORY_CHAPTERS.length - 1) {
    STORY.flags.add("final_defeated");
    print("\n🌑 THE WORLD HAS REACHED ITS LAST SAVE.");
    print("The final choice is now available: type 'ending'.");
    return;
  }
  STORY.chapter++;
  STORY.fracture = STORY_CHAPTERS[STORY.chapter].fracture;
  const nw = curChapter();
  STORY.flags.add(`chapter_${nw.id}_unlocked`);
  print("\n" + "=".repeat(62));
  print(`📖 CHAPTER ${nw.id} UNLOCKED`);
  print(nw.title);
  print("=".repeat(62));
  print(`\n${nw.summary}`);
  print(`Location: ${nw.area}`);
  const sid = STORY_SCENE_BY_CHAPTER[nw.id];
  if (sid) {
    print();
    scene(sid).forEach((l) => print(l));
    STORY.seen.add(sid);
  }
  const cl = CHAPTER_CHARACTER_LINES[nw.id];
  if (cl) print(`\n[${cl[0]}] ${STORY_CHARACTERS[cl[0]][cl[1]]}`);
  print("\nNew objective:");
  print(STORY_PROGRESS[nw.id].objective);
  print("\nUnlocked:");
  STORY_UNLOCKS[nw.id].forEach((u) => print(`  • ${u}`));
  print(`\n⚠️ FRACTURE LEVEL: ${STORY.fracture}/10`);
}
// Plays the opening scene the first time the game starts.
function storyIntro() {
  if (STORY.seen.has("chapter_0_intro")) return;
  print("\n" + "=".repeat(62));
  print("📖 THE LAST SAVE");
  print("=".repeat(62));
  scene("chapter_0_intro").forEach((l) => print(l));
  STORY.seen.add("chapter_0_intro");
  STORY.flags.add("story_started");
  print("\nYour first objective:");
  print(STORY_PROGRESS[0].objective);
}
// The 'story' command: chapter, objective and progress.
function showStory() {
  const ch = curChapter(),
    id = ch.id,
    p = STORY_PROGRESS[id];
  print("\n" + "=".repeat(62));
  print("📖 STORY / CAMPAIGN");
  print("=".repeat(62));
  print(`Chapter ${id}: ${ch.title}`);
  print(`Area: ${ch.area}`);
  print(`\n${ch.summary}`);
  print(`\nFracture level: ${STORY.fracture}/10`);
  print("\nCurrent objective:");
  print(`  ${p.objective}`);
  print("\nProgress:");
  print(`  Level: ${PLAYER.level}/${p.level}`);
  for (const [e, a] of Object.entries(p.kills))
    print(`  ${title(e)}: ${Math.min(killCount(e), a)}/${a}`);
  if (p.boss)
    print(`  Boss: ${title(p.boss)} (${killCount(p.boss) > 0 ? "defeated" : "not defeated"})`);
  print("\nAvailable here:");
  STORY_UNLOCKS[id].forEach((u) => print(`  • ${u}`));
  print("\nType 'explore' to enter the current story area.");
  const b = STORY_BOSS_BY_CHAPTER[id];
  if (b)
    print(
      `When you reach level ${p.level}, 'explore' lets you challenge ${title(b)} (choose 'boss').`
    );
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
  print("\n" + "=".repeat(62));
  print(`🗺️ ${an.toUpperCase()}`);
  print("=".repeat(62));
  print(area.description || "");
  print(`A hub is nearby: ${typeof TOWNS !== "undefined" ? TOWNS[currentTownId()].name : "town"} (type 'town').`);
  if (p.boss && !objectiveComplete()) {
    if (PLAYER.level >= p.level) {
      print(`\nSomething waits deeper in this area: ${title(p.boss)}.`);
      const c = (await input("Challenge it now, keep exploring, or visit town? [boss/explore/town]: "))
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
    .filter(([e, n]) => killCount(e) < n && monsters[e])
    .map((x) => x[0]);
  if (typeof maybeExploreEvent === "function" && !(needed.length && (ch === 0 || Math.random() < 0.4))) {
    if (await maybeExploreEvent(an)) {
      if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
      return;
    }
  }
  let enemy;
  if (needed.length && (ch === 0 || Math.random() < 0.4)) enemy = needed[0];
  else
    enemy = wchoice(
      enc,
      enc.map((n) => Math.max(1, monsters[n].chance))
    );
  print(`\nYou travel deeper into ${an}...`);
  let fightArg = enemy;
  if (Math.random() < 0.18 && !needed.includes(enemy) && monsters[enemy]?.chance > 0) {
    const pal = enc.find((n) => n !== enemy) || enemy;
    fightArg = enemy + "," + pal;
    print(`A group: ${title(enemy)} and ${title(pal)}.`);
  } else if (Math.random() < 0.1 && monsters[enemy]?.chance > 0) {
    print(`This one looks tougher than the others.`);
    if (typeof makeEnemyState === "function") {
      await fightMonster(enemy);
      return;
    }
  }
  print(`You encounter ${title(enemy)}.`);
  await fightMonster(fightArg);
}
// The 'ending' command: the final three-way choice after The Last Save.
async function showEnding() {
  if (!STORY.flags.has("final_defeated")) {
    print("\nThe final choice is not available yet.");
    print("Defeat The Last Save at the end of Chapter 10.");
    return;
  }
  const play = (c) => {
    const r = ENDINGS[c];
    print("\n" + "=".repeat(62));
    print(r.title);
    print("=".repeat(62));
    print("\n" + r.text);
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
      play(c);
      if (typeof checkAchievements === "function") checkAchievements();
      print("\nYou can begin New Game+ with 'ngplus'. Your completed ending is kept.");
      return;
    }
    print("Choose exactly: remember, release, or rewrite.");
  }
}
