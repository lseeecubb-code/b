// Headless smoke test for every enemy fight and AI turn plus key combat mechanics.
// Run with: node test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sandbox = {
  assert,
  console,
  scaleRange: (arr, mult) => (!arr || arr.length < 2 ? arr : [Math.max(1, Math.trunc(arr[0] * mult)), Math.max(1, Math.trunc(arr[1] * mult))]),
  Math: Object.create(Math),
  C: {
    ATTACKING: ["attack", "heavy", "skill", "magic"],
    GUARD_REACT: 15, STANCE_REACT: 10, COUNTER_MULT: 2, WEAK_MULT: 0.5,
    BASIC_MIN: 20, PARRY_MOD: {}, DODGE_MOD: {}, MIN_DMG: 1,
    PLAYER_DAMAGE: [8, 14], CRIT: 0, CRIT_MULT: 1.5, STAGGER_BONUS: 0.5,
    MAX_ENERGY: 6,
    START_ENERGY: 4, HEAVY_COST: 2, RECOVER: 3, ATTACK_GAIN: 1,
    ATTACK_HIT: 100, HEAVY_HIT: 85, HEAVY_MULT: 2, RUN: 60, RUN_MAX: 90,
    WRONG_DEF: 1.25, PERFECT_PARRY: 0, PERFECT_ENERGY: 2, PERFECT_COUNTER: 1,
    PARRY_STAGGER: 0, PARRY_TAKEN: 0, GUARD_MAX: 0.9,
  },
  PLAYER: { level: 25, ngPlus: 0 },
  STORY: { chapter: 10, flags: new Set(), seen: new Set(), ending: "remember", kills: {} },
  STORY_PROGRESS: Array.from({ length: 11 }, () => ({ level: 1 })),
  WORLD: { dungeonRun: null, towerRun: null, memories: {}, companions: { active: [] }, flags: {}, usedCombatItem: false },
  SETTINGS: { difficulty: "normal" },
  equipment: {}, inventory: { coin: 0 },
  getStats: () => ({ max_hp: 1000000, damage: 1000000, defense: 0, dodge: 0, crit: 0, parry: 0 }),
  maxEnergy: () => 6,
  weaponSkills: () => [],
  knownSpells: () => [],
  spellCost: () => 1,
  focusRecovery: () => 3,
  enemyRequiredLevel: () => 1,
  hpBar: (hp) => String(hp),
  energyBar: (energy) => String(energy),
  input: async () => "1",
  applyRested() {},
  remindHeal() {},
  grantXp() {},
  recordVictory() {},
  killCount: () => 1,
  noteQuestKill() {},
  addItem() {},
  checkAchievements() {},
  maybeFourthWall() {},
  noteBestiaryEncounter() {},
  maybePromptLevelUp: async () => {},
  print() {},
  clog() {},
  percent: () => true,
  randint: (min) => min,
  int: Math.trunc,
  cap: (s) => s,
  title: (s) => s,
  pad: (s, n) => String(s).padEnd(n),
  wchoice: (items) => items[0],
  makeAttack: (name, data) => Object.assign({}, sandbox.DEFAULT_ATTACK || {}, data, { name }),
  canGuard: () => true,
  guardReduction: () => 0.5,
  resolveMonsterEffects() {},
  resolveEffects() {},
  applySpecialEffect() {},
  speakEnemy() {},
  effectMods: () => ({ damage: 1, taken: 1, dodge: 0 }),
  parryChance: () => 0,
  dodgeChance: () => 0,
  reducePlayerDamage: (_f, damage) => damage,
  applyMonsterEffect() {},
  noteBestiaryMove() {},
  FX: { startBattleMusic() {}, stopBattleMusic() {} },
  STUN: { IMMUNE_TURNS: 1 },
  IDLE_LINES: ["waits."],
  EFFECT_STYLE: {},
  percent: () => true,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("scenes.js", "utf8"), sandbox, { filename: "scenes.js" });
vm.runInContext(fs.readFileSync("monsters.js", "utf8"), sandbox, { filename: "monsters.js" });
vm.runInContext(fs.readFileSync("combat.js", "utf8"), sandbox, { filename: "combat.js" });
vm.runInContext("globalThis.__monsters = monsters; globalThis.DEFAULT_ATTACK = DEFAULT_ATTACK; globalThis.__scenes = GAME_SCENES; globalThis.__smoke = { monsterTurn, limitEnemyAttacks, addBreak, chargeLimit, useLimitBreak, fightMonster, getAttackScene, getMonsterOpening };", sandbox);
vm.runInContext("assert.ok(getAttackScene('goblin king', 'crown cleaver') === 'crown-shards'); assert.ok(getAttackScene('the last save', 'forced shutdown') === 'void-pulse'); assert.ok(!monsters['goblin king'].phases[1].abilities['crown cleaver'].cutscene); assert.ok(getMonsterOpening('goblin king')?.title === 'THE CROWN BREAKS'); GAME_SCENES.openings = {}; for (const enemy of Object.values(monsters)) { enemy.opening = null; enemy.event_flags = null; for (const phase of enemy.phases || []) phase.event_flags = null; if (enemy.secret_flag) STORY.flags.add(enemy.secret_flag); } globalThis.winFight = () => {}; globalThis.loseFight = () => {};", sandbox);

(async () => {
  let enemiesChecked = 0;
  for (const [name, monster] of Object.entries(sandbox.__monsters)) {
    const enemy = {
      name,
      displayName: monster.name || name,
      monster,
      hp: monster.hp,
      effects: [],
      guarding: false,
      stance: null,
      stun_turns: 0,
      stun_immune: 0,
      staggered: false,
      intent: null,
      phase: 0,
      phases: [],
      eventFlags: {},
    };
    const fight = {
      enemies: [enemy], target: 0,
      stats: { defense: 0, dodge: 0, parry: 0, max_hp: 100, crit: 0 },
      player_hp: 100, player_max_hp: 100, effects: [], resist: {},
      energy: 3, choice: null, owner: "player", cooldowns: {}, temporary_damage: 0,
      get name() { return enemy.displayName; },
      get monster() { return enemy.monster; },
      get monster_hp() { return enemy.hp; }, set monster_hp(v) { enemy.hp = v; },
      get monster_effects() { return enemy.effects; }, set monster_effects(v) { enemy.effects = v; },
      get guarding() { return enemy.guarding; }, set guarding(v) { enemy.guarding = v; },
      get stance() { return enemy.stance; }, set stance(v) { enemy.stance = v; },
      get stun_turns() { return enemy.stun_turns; }, set stun_turns(v) { enemy.stun_turns = v; },
      get stun_immune() { return enemy.stun_immune; }, set stun_immune(v) { enemy.stun_immune = v; },
      get staggered() { return enemy.staggered; }, set staggered(v) { enemy.staggered = v; },
      get intent() { return enemy.intent; }, set intent(v) { enemy.intent = v; },
    };
    await sandbox.__smoke.monsterTurn(fight);
    assert.ok(Number.isFinite(fight.player_hp), `${name} produced invalid player HP`);
    assert.ok(Number.isFinite(enemy.hp), `${name} produced invalid enemy HP`);
    enemiesChecked++;
  }

  const group = {
    enemies: [
      { hp: 10, intent: { kind: "attack" } },
      { hp: 10, intent: { kind: "attack" } },
      { hp: 0, intent: { kind: "attack" } },
      { hp: 10, intent: { kind: "heal" } },
      { hp: 10, intent: { kind: "attack" } },
    ],
  };
  sandbox.__smoke.limitEnemyAttacks(group);
  assert.equal(group.enemies.filter((enemy) => enemy.hp > 0 && enemy.intent.kind === "attack").length, 1);
  assert.equal(group.enemies[1].intent.kind, "idle");
  assert.equal(group.enemies[4].intent.kind, "idle");
  assert.equal(group.enemies[3].intent.kind, "heal");
  const poiseEnemy = { hp: 50, poise: 0, intent: { kind: "attack" } };
  const poiseFight = {
    enemies: [poiseEnemy], target: 0, staggered: false,
    get name() { return "test enemy"; },
    get intent() { return poiseEnemy.intent; }, set intent(value) { poiseEnemy.intent = value; },
  };
  sandbox.__smoke.addBreak(poiseFight, 45);
  sandbox.__smoke.addBreak(poiseFight, 45);
  assert.equal(poiseEnemy.intent.kind, "attack", "poise should not break before 100");
  sandbox.__smoke.addBreak(poiseFight, 10);
  assert.equal(poiseEnemy.intent.kind, "staggered", "full poise break should cancel the enemy action");
  assert.equal(poiseEnemy.poise, 0, "poise resets after breaking");
  const limitEnemy = { hp: 80, monster: { hp: 80 }, elite: false, effects: [] };
  const limitFight = {
    enemies: [limitEnemy], target: 0, limitGauge: 0, limitUsed: false,
    stats: { damage: 4 },
    get name() { return "test enemy"; },
    get monster_hp() { return limitEnemy.hp; }, set monster_hp(value) { limitEnemy.hp = value; },
    get monster_effects() { return limitEnemy.effects; }, set monster_effects(value) { limitEnemy.effects = value; },
  };
  sandbox.__smoke.chargeLimit(limitFight, 100);
  assert.equal(limitFight.limitGauge, 100, "damage should fully charge the limit break");
  sandbox.__smoke.useLimitBreak(limitFight);
  assert.equal(limitFight.limitUsed, true, "limit break can be used once per fight");
  assert.ok(limitEnemy.hp < 80, "limit break should damage the enemy");
  let fightsChecked = 0;
  for (const name of Object.keys(sandbox.__monsters)) {
    await sandbox.__smoke.fightMonster(name);
    fightsChecked++;
  }
  process.stdout.write(`Smoke test passed: ${fightsChecked} one-hit fights, ${enemiesChecked} AI turns, group limit, poise break, and Limit Break.\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
