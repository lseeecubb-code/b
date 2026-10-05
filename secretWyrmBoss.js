/* THE LAST SAVE - original secret worm boss.
 * Inspired by the broad idea of multi-phase bullet-hell wyrms, but all names,
 * attacks and behavior here are original to this game.
 */
(function () {
  "use strict";
  if (typeof monsters === "undefined" || monsters["abyssal starwyrm"]) return;

  monsters["abyssal starwyrm"] = {
    icon: "🐉",
    boss: true,
    isBoss: true,
    level: 50,
    hp: 2400,
    chance: 0,
    block_chance: 8,
    block_reduction: 0.35,
    basic_attack: { damage: [24, 34], type: "heavy", element: "shadow" },
    abilities: {
      "void coil": { chance: 28, damage: [20, 28], hits: 3, element: "shadow", parryable: false, telegraph: "winds its body into a void coil and unleashes" },
      "stellar needle": { chance: 24, damage: [18, 26], hits: 5, element: "holy", parryable: false, telegraph: "marks the arena with stars before firing" },
      "gravity crossfire": { chance: 18, damage: [22, 31], hits: 4, element: "lightning", blockable: false, telegraph: "bends space into" },
      "ember spiral": { chance: 16, damage: [19, 27], hits: 6, element: "fire", telegraph: "charges a rotating" },
      "starfall reversal": { chance: 14, damage: [28, 38], hits: 2, element: "holy", warning: true, telegraph: "pauses, then reverses the falling stars with" },
    },
    drops: {
      "star shard": { chance: 100, min_drop: 8, max_drop: 16 },
      "void crystal": { chance: 100, min_drop: 3, max_drop: 7 },
      coin: { chance: 100, min_drop: 500, max_drop: 900 },
    },
    parry_chance: 5,
    dodge_chance: 18,
    parry_rate: 35,
    dodge_rate: 65,
    resist: { shadow: 25, fire: 15, holy: -10 },
    phases: [
      {
        name: "Abyssal Starwyrm — Coiled Cosmos",
        hp: 2400,
        basic_attack: { damage: [24, 34], type: "heavy", element: "shadow" },
        abilities: {
          "void coil": { chance: 32, damage: [20, 28], hits: 3, element: "shadow", parryable: false, telegraph: "winds its body into a void coil and unleashes" },
          "stellar needle": { chance: 25, damage: [18, 26], hits: 5, element: "holy", parryable: false, telegraph: "marks the arena with stars before firing" },
          "gravity crossfire": { chance: 18, damage: [22, 31], hits: 4, element: "lightning", blockable: false, telegraph: "bends space into" },
        },
      },
      {
        name: "Abyssal Starwyrm — Fractured Orbit",
        hp: 2800,
        basic_attack: { damage: [30, 42], type: "heavy", element: "lightning" },
        abilities: {
          "orbiting void": { chance: 28, damage: [22, 31], hits: 5, element: "shadow", parryable: false, telegraph: "splits its orbit into" },
          "ember spiral": { chance: 25, damage: [19, 27], hits: 6, element: "fire", telegraph: "charges a rotating" },
          "gravity crossfire": { chance: 22, damage: [24, 34], hits: 5, element: "lightning", blockable: false, telegraph: "folds the arena into" },
          "starfall reversal": { chance: 15, damage: [28, 38], hits: 2, element: "holy", warning: true, telegraph: "pauses, then reverses the falling stars with" },
        },
      },
      {
        name: "Abyssal Starwyrm — Last Constellation",
        hp: 3400,
        basic_attack: { damage: [36, 50], type: "heavy", element: "shadow" },
        abilities: {
          "void coil": { chance: 22, damage: [26, 36], hits: 5, element: "shadow", parryable: false, telegraph: "whips through the arena with" },
          "stellar needle": { chance: 24, damage: [21, 30], hits: 8, element: "holy", parryable: false, telegraph: "locks every nearby star into" },
          "ember spiral": { chance: 20, damage: [22, 31], hits: 8, element: "fire", telegraph: "ignites a widening" },
          "gravity crossfire": { chance: 18, damage: [27, 39], hits: 6, element: "lightning", blockable: false, telegraph: "crushes the arena into" },
          "starfall reversal": { chance: 16, damage: [32, 44], hits: 3, element: "holy", warning: true, telegraph: "marks a final constellation before" },
        },
      },
    ],
  };

  if (typeof COMMANDS !== "undefined" && typeof fightMonster === "function" && typeof ORDER !== "undefined") {
    COMMANDS.starwyrm = [
      async () => {
        print("\n✦ A hidden signal answers from beyond the map...");
        print("🐉 Something enormous is moving between the stars.");
        print("⚠️ SECRET BOSS: ABYSSAL STARWYRM — a three-phase bullet-hell fight.");
        await fightMonster("abyssal starwyrm");
      },
      "starwyrm",
      "Challenge the hidden Abyssal Starwyrm",
    ];
    ORDER.push("starwyrm");
    if (Array.isArray(MENU) && MENU[1]?.[1]) MENU[1][1].push("starwyrm");
  }
})();
