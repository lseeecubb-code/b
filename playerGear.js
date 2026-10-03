// Player stats, inventory, equipment and item info.
const EQUIPMENT_SETS = {
  dragon: {
    pieces: ["dragon armor", "dragonscale armor", "dragon shield", "dragon boots", "dragon slayer", "dragon spear", "dragon bow"],
    bonuses: [
      { pieces: 2, stats: { max_hp: 18, defense: 1 }, text: "+18 max HP, +1 defense" },
      { pieces: 3, stats: { damage: 3, parry: 5 }, text: "+3 damage, +5 parry" },
    ],
  },
  flame: {
    pieces: ["flame armor", "ember blade", "flameblade", "fire sword", "infernal axe"],
    bonuses: [
      { pieces: 2, stats: { damage: 3, crit: 4 }, text: "+3 damage, +4% critical chance" },
      { pieces: 3, stats: { guard: 0.04 }, text: "+4% guard" },
    ],
  },
  frost: {
    pieces: ["frost armor", "frost sword", "frostfang"],
    bonuses: [
      { pieces: 2, stats: { parry: 5, dodge: 4 }, text: "+5% parry, +4% dodge" },
      { pieces: 3, stats: { max_hp: 20, defense: 2 }, text: "+20 max HP, +2 defense" },
    ],
  },
  shadow: {
    pieces: ["shadow armor", "shadow cloak", "shadow blade"],
    bonuses: [{ pieces: 2, stats: { dodge: 5, crit: 5 }, text: "+5% dodge, +5% critical chance" }],
  },
  berserker: {
    pieces: ["berserker armor", "berserker axe"],
    bonuses: [{ pieces: 2, stats: { damage: 4, crit: 6 }, text: "+4 damage, +6% critical chance" }],
  },
  archive: {
    pieces: ["archive blade", "hollow plate", "archivist's ring"],
    bonuses: [
      { pieces: 2, stats: { max_hp: 25, defense: 2 }, text: "+25 max HP, +2 defense" },
      { pieces: 3, stats: { damage: 4, crit: 5 }, text: "+4 damage, +5% critical chance" },
    ],
  },
};

function equipmentSetProgress() {
  const worn = Object.values(equipment).filter(Boolean);
  return Object.entries(EQUIPMENT_SETS).map(([name, set]) => {
    const actualCount = worn.filter((item) => set.pieces.includes(item)).length;
    const target = Math.max(...set.bonuses.map((bonus) => bonus.pieces));
    return {
      name,
      count: Math.min(actualCount, target),
      target,
      active: set.bonuses.filter((bonus) => actualCount >= bonus.pieces),
      next: set.bonuses.find((bonus) => actualCount < bonus.pieces) || null,
    };
  });
}

function equipmentSetFor(item) {
  return Object.entries(EQUIPMENT_SETS).find(([, set]) => set.pieces.includes(item)) || null;
}

function getStats() {
  const s = {
    max_hp: C.BASE_MAX_HP,
    damage: 0,
    damage_mult: 1,
    no_guard: 0,
    guard: 0.0,
    max_energy: 0,
    parry: 0,
    crit: 0,
    dodge: 0,
    defense: 0,
  };
  Object.values(equipment).forEach((n) => {
    if (n) for (const k in s) s[k] += ITEMS[n][k] || 0;
  });
  for (const status of equipmentSetProgress()) {
    const set = EQUIPMENT_SETS[status.name];
    for (const bonus of status.active)
      for (const [stat, amount] of Object.entries(bonus.stats)) s[stat] += amount;
  }
  s.max_hp += (PLAYER.level - 1) * C.LVL_HP;
  s.damage += (PLAYER.level - 1) * C.LVL_DMG;
  const str = PLAYER.str ?? 5,
    agi = PLAYER.agi ?? 5,
    vit = PLAYER.vit ?? 5;
  s.damage += Math.floor(Math.max(0, str - 5) / 2);
  s.max_hp += Math.max(0, vit - 5) * 3;
  const agiB = Math.floor(Math.max(0, agi - 5) / 2);
  s.dodge += agiB;
  s.parry += agiB;
  if (typeof hasPerk === "function") {
    if (hasPerk("iron thews")) s.damage = int(s.damage * 1.1);
    if (hasPerk("iron blood")) s.max_hp += 18;
    if (hasPerk("shade step")) s.dodge += 8;
    if (hasPerk("killing edge")) s.crit += 8;
    if (hasPerk("blade work")) s.parry += 8;
    if (hasPerk("iron wall")) s.guard += 0.08;
  }
  if (typeof WORLD !== "undefined") {
    Object.values(equipment).forEach((n) => {
      if (!n) return;
      const u = (WORLD.upgrades && WORLD.upgrades[n]) || 0;
      s.damage += u;
      s.max_hp += u * 3;
      const r = (WORLD.rarity && WORLD.rarity[n]) || "common";
      const b = typeof RARITY_BONUS !== "undefined" ? RARITY_BONUS[r] : null;
      if (b) {
        s.damage += b.damage || 0;
        s.max_hp += b.max_hp || 0;
        s.crit += b.crit || 0;
        s.dodge += b.dodge || 0;
      }
    });
  }
  const raidUpgrades = typeof WORLD !== "undefined" ? (WORLD.flags?.raidUpgrades || {}) : {};
  s.max_hp += Math.max(0, raidUpgrades.vigor || 0) * 6;
  s.damage += Math.max(0, raidUpgrades.edge || 0) * 2;
  s.max_energy += Math.max(0, raidUpgrades.core || 0);
  s.max_hp = Math.max(1, s.max_hp);
  return s;
}
const xpNeeded = (l) => 40 + l * 20;
function grantXp(a) {
  if (PLAYER.level >= C.MAX_LEVEL) return;
  PLAYER.xp += a;
  while (PLAYER.level < C.MAX_LEVEL && PLAYER.xp >= xpNeeded(PLAYER.level)) {
    PLAYER.xp -= xpNeeded(PLAYER.level);
    PLAYER.level++;
    PLAYER.statPoints = (PLAYER.statPoints || 0) + 2;
    if (PLAYER.level % 2 === 0) PLAYER.skillPoints = (PLAYER.skillPoints || 0) + 1;
    print(`🎊 LEVEL UP! You are now level ${PLAYER.level}!`);
    print(`   +${C.LVL_HP} max HP, +${C.LVL_DMG} damage, +2 stat points`);
    if (PLAYER.level % 2 === 0) print("   +1 perk point");
    if (typeof unlockSpellsForLevel === "function") unlockSpellsForLevel();
  }
}
const guardReduction = (s) => Math.min(C.GUARD_MAX, C.GUARD_RED + s.guard);
const canGuard = (a) => a.blockable && !a.pierces_guard;
const parryChance = (a, s) =>
  a.parryable
    ? Math.max(5, Math.min(C.PARRY_MAX, C.PARRY + (C.PARRY_MOD[a.type] || 0) + s.parry))
    : 0;
const dodgeChance = (a, s) =>
  a.dodgeable
    ? Math.max(5, Math.min(C.DODGE_MAX, C.DODGE + (C.DODGE_MOD[a.type] || 0) + s.dodge))
    : 0;
const weaponSkills = () => {
  const learned = new Set(Object.values(equipment).filter(Boolean).flatMap((item) => ITEMS[item]?.skills || []));
  return [...learned].map((name) => SKILLS[name]).filter(Boolean);
};

function showInventory(arg = "") {
  const held = {};
  for (const n in inventory) if (inventory[n] > 0) held[n] = inventory[n];
  print("\n🎒");
  if (!Object.keys(held).length) {
    print("Your pack is empty. Explore, trade, or craft to gather supplies.");
    return;
  }
  let wanted = CAT_ORDER;
  if (arg.trim()) {
    wanted = categoryFilter(arg);
    if (!wanted) {
      print(
        `No category called '${arg.trim()}'. Try: gear, weapons, armor, consumables, materials.`
      );
      return;
    }
  }
  print(`🪙 Coin: ${held.coin || 0}`);
  delete held.coin;
  const groups = {};
  for (const n in held) (groups[itemCategory(n)] ??= []).push(n);
  let shown = false;
  for (const c of CAT_ORDER) {
    if (!wanted.includes(c) || !groups[c]) continue;
    shown = true;
    print(`\n📦 ${c.toUpperCase()}`);
    groups[c]
      .sort()
      .forEach((n) =>
        print(`  ${n}: ${held[n]}${Object.values(equipment).includes(n) ? " (equipped)" : ""}`)
      );
  }
  if (!shown) print("\nNothing in this category yet.");
  print("\n🔍 Use 'info <item>' to inspect its stats, recipe, source, and value.");
}
function showSkills() {
  const s = weaponSkills();
  print("\n⚔️");
  if (!s.length) {
    print("No weapon techniques available. Equip a weapon to learn its moves.");
  } else
    s.forEach((k) => {
      print(`- ${title(k.name)} (${k.cost} energy): ${k.desc}`);
      print(`    ${describeSkill(k)}`);
    });
  if (typeof showMagic === "function") showMagic();
  if (typeof PERKS !== "undefined") {
    print("\n✨");
    const ps = PLAYER.perks || [];
    if (!ps.length) print("  (none yet — type 'perks')");
    else ps.forEach((id) => print(`  ✓ ${title(id)} — ${PERKS[id]?.desc || ""}`));
  }
}
function showStats() {
  const s = getStats();
  print("\n📊");
  print(
    PLAYER.level >= C.MAX_LEVEL
      ? `🏅 Level: ${PLAYER.level} (MAX)`
      : `🏅 Level: ${PLAYER.level}   ·   ✨ XP: ${PLAYER.xp}/${xpNeeded(PLAYER.level)}`
  );
  if (PLAYER.ngPlus) print(`🔁 Run: New Game+ ${PLAYER.ngPlus}`);
  print(`💪 Attributes: STR ${PLAYER.str ?? 5}  AGI ${PLAYER.agi ?? 5}  VIT ${PLAYER.vit ?? 5}  FOC ${PLAYER.foc ?? 5}`);
  if (PLAYER.statPoints) {
    print(`✨ Stat points to spend: ${PLAYER.statPoints} — type 'allocate' for the menu`);
    print("📌 Allocate by number or name (add a count to spend more than one point):");
    print("  1 / str / strength  →  Strength (physical damage)");
    print("  2 / agi / agility   →  Agility (dodge and parry)");
    print("  3 / vit / vitality  →  Vitality (maximum HP)");
    print("  4 / foc / focus     →  Focus (energy and spell power)");
    print("  Examples: allocate 2 3   ·   allocate vitality 2");
  }
  if (PLAYER.skillPoints) print(`🌿 Perk points to spend: ${PLAYER.skillPoints} — type 'perks'`);
  print(`❤️ Maximum HP: ${s.max_hp}`);
  print(`⚔️ Damage range: ${C.PLAYER_DAMAGE[0] + s.damage}–${C.PLAYER_DAMAGE[1] + s.damage}`);
  print(`🎯 Hit chance: ${C.ATTACK_HIT}%   ·   Critical chance: ${C.CRIT + s.crit}%`);
  print(`⚡ Energy: ${C.START_ENERGY} starting, ${typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY} maximum · Focus restores ${typeof focusRecovery === "function" ? focusRecovery() : C.RECOVER}`);
  print(`🛡️ Guard: reduces damage by ${int(guardReduction(s) * 100)}% (piercing attacks bypass it)`);
  print(`🧱 Defence: blocks ${s.defense} damage per hit (minimum ${C.MIN_DMG})`);
  print(`🤺 Parry chance: ${C.PARRY + s.parry}% base`);
  print(`💨 Dodge chance: ${C.DODGE + s.dodge}% base`);
  print(`🏃 Escape chance: ${Math.min(C.RUN_MAX, C.RUN + s.dodge)}%`);
  if (typeof showAttributeSummary === "function") {
    print("STR → physical damage · AGI → dodge/parry · VIT → max HP · FOC → energy/spells");
  }
  print("\n🧰");
  for (const slot in equipment) {
    const n = equipment[slot];
    if (!n) {
      print(`[${slot}] (empty)`);
      continue;
    }
    const r = WORLD?.rarity?.[n] || "common";
    const u = WORLD?.upgrades?.[n] || 0;
    print(`[${slot}] ${n} [${r}${u ? ` +${u}` : ""}] (${describeBuffs(n)})`);
  }
  const setProgress = equipmentSetProgress().filter((set) => set.count > 0);
  if (setProgress.length) {
    print("\n🧩 Equipment sets:");
    setProgress.forEach((set) => {
      const active = set.active.map((bonus) => bonus.text).join("; ");
      const next = set.next ? `Next at ${set.next.pieces}: ${set.next.text}` : "All set bonuses active";
      print(`- ${title(set.name)} ${set.count}/${set.target} · ${active || "No bonus active"} · ${next}`);
    });
  }
  const sk = weaponSkills();
  if (sk.length) {
    print("\n✨ Skills from equipped gear:");
    sk.forEach((k) => print(`- ${title(k.name)} (${k.cost} energy): ${k.desc}`));
  }
}

async function equipItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (!choice) {
    const owned = groupedNames(Object.keys(ITEMS).filter((n) => (inventory[n] || 0) > 0));
    if (!owned.length) {
      print("🎒 No usable gear in your pack yet. Find equipment through exploration, crafting, or trade.");
      return;
    }
    print("\n🧰");
    printNumbered(
      owned,
      (n) => `${n} (${describeBuffs(n)})` + (equipment[ITEMS[n].id] === n ? " (equipped)" : "")
    );
    choice = resolveChoice(await input("\nWhat do you want to equip? (number or name): "), owned);
    if (!choice) return;
  }
  if (!ITEMS[choice]) {
    print(`You can't equip '${choice}'.`);
    return;
  }
  if ((inventory[choice] || 0) < 1) {
    print(`You don't have any ${choice}!`);
    return;
  }
  const slot = ITEMS[choice].id,
    cur = equipment[slot];
  if (cur === choice) {
    print(`Your ${choice} is already equipped.`);
    return;
  }
  if (cur) print(`Swapping your ${cur} for the ${choice}.`);
  equipment[slot] = choice;
  print(`🧰 Equipped ${choice}: ${describeBuffs(choice)}`);
  const setEntry = equipmentSetFor(choice);
  if (setEntry) {
    const [setName, set] = setEntry;
    const progress = equipmentSetProgress().find((entry) => entry.name === setName);
    const active = progress.active.map((bonus) => bonus.text).join("; ");
    print(`🧩 ${title(setName)} set: ${progress.count}/${progress.target} pieces${active ? ` · ${active}` : ` · ${progress.next?.text} at ${progress.next?.pieces} pieces`}.`);
  }
  if (ITEMS[choice].description) print(`   "${ITEMS[choice].description}"`);
  if (ITEMS[choice].skills?.length) print("   Skills: " + ITEMS[choice].skills.join(", "));
}
async function unequipItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (!choice) {
    const worn = groupedNames(Object.values(equipment).filter(Boolean));
    if (!worn.length) {
      print("🧥 You aren't wearing any equipment.");
      return;
    }
    print("\n🧥");
    printNumbered(worn, (n) => `${n} (${describeBuffs(n)})`);
    choice = resolveChoice(await input("\nWhat do you want to unequip? (number or name): "), worn);
    if (!choice) return;
  }
  if (!ITEMS[choice] || equipment[ITEMS[choice].id] !== choice) {
    print(`Your ${choice} isn't equipped.`);
    return;
  }
  equipment[ITEMS[choice].id] = null;
  print(`🎒 Unequipped ${choice}.`);
  const setEntry = equipmentSetFor(choice);
  if (setEntry) {
    const [setName] = setEntry;
    const progress = equipmentSetProgress().find((entry) => entry.name === setName);
    const active = progress.active.map((bonus) => bonus.text).join("; ");
    print(`🧩 ${title(setName)} set: ${progress.count}/${progress.target} pieces${active ? ` · ${active}` : " · no set bonus active"}.`);
  }
}

const STAT_LABELS = [
  ["damage", "damage"],
  ["max_hp", "max HP"],
  ["guard", "guard"],
  ["parry", "parry"],
  ["crit", "crit"],
  ["dodge", "dodge"],
  ["defense", "defense"],
];
function compareGear(n, cur) {
  const p = [];
  for (const [k, l] of STAT_LABELS) {
    const d = (ITEMS[n][k] || 0) - (ITEMS[cur][k] || 0);
    if (!d) continue;
    p.push(
      k === "guard"
        ? `${sgn(Math.round(d * 100))}% guard`
        : ["parry", "crit", "dodge"].includes(k)
          ? `${sgn(d)}% ${l}`
          : `${sgn(d)} ${l}`
    );
  }
  return p.join(", ") || "no difference";
}
function allItemNames() {
  const s = new Set([
    ...Object.keys(ITEMS),
    ...Object.keys(USABLE_ITEMS),
    ...Object.keys(recipes),
    ...Object.keys(SHOP_BUY),
    ...Object.keys(SHOP_SELL),
  ]);
  Object.values(recipes).forEach((r) => Object.keys(r).forEach((k) => s.add(k)));
  Object.values(monsters).forEach((m) => Object.keys(m.drops).forEach((k) => s.add(k)));
  s.delete("coin");
  return [...s].sort();
}
function findItem(t) {
  const names = allItemNames();
  if (names.includes(t)) return t;
  const m = names.filter((n) => n.includes(t));
  if (m.length === 1) return m[0];
  if (m.length) {
    print(
      `'${t}' matches several items: ` + m.slice(0, 12).join(", ") + (m.length > 12 ? " ..." : "")
    );
    print("Type a fuller name.");
    return null;
  }
  print(`No item called '${t}'.`);
  return null;
}
async function showItemInfo(arg = "") {
  let text = arg.trim().toLowerCase();
  if (!text) {
    const owned = groupedNames(
      Object.keys(inventory).filter((n) => inventory[n] > 0 && n !== "coin")
    );
    if (owned.length) {
      print("\n🎒");
      printNumbered(owned, (n) => `${n} x${inventory[n]}`);
    } else print("\n(Your inventory is empty.)");
    text = resolveChoice(
      await input("\nLook up which item? (number from the list, or any item name): "),
      owned
    );
    if (!text) return;
  }
  // Exact enemy names (and unique partial matches) open an enemy dossier.
  const enemyNames = Object.keys(monsters);
  const enemy = enemyNames.find((n) => n.toLowerCase() === text) ||
    (enemyNames.filter((n) => n.toLowerCase().includes(text)).length === 1
      ? enemyNames.find((n) => n.toLowerCase().includes(text)) : null);
  if (enemy) {
    showEnemyInfo(enemy);
    return;
  }
  const name = findItem(text);
  if (name === null) return;
  print("\n" + "=".repeat(50));
  print(`🔎 ${title(name)}  ·  ${itemCategory(name)}`);
  print("=".repeat(50));
  print(
    `🎒 In your pack: ${inventory[name] || 0}` +
      (Object.values(equipment).includes(name) ? " (equipped)" : "")
  );
  if (ITEMS[name]) {
    const it = ITEMS[name];
    print(`🧩 Slot: ${it.id}`);
    print(`📊 Bonuses: ${describeBuffs(name)}`);
    const setEntry = equipmentSetFor(name);
    if (setEntry) {
      const [setName, set] = setEntry;
      const next = set.bonuses[0];
      print(`🧩 ${title(setName)} set piece · first bonus at ${next.pieces} pieces: ${next.text}.`);
    }
    if (it.description) print(`        "${it.description}"`);
    const cur = equipment[it.id];
    if (cur === null) print(`Your ${it.id} slot is empty, so you'd gain all of the above.`);
    else if (cur !== name) print(`Versus your ${cur}: ${compareGear(name, cur)}`);
    if (it.skills?.length) {
      print("Skills granted while equipped:");
      it.skills.forEach((sn) => {
        const s = SKILLS[sn];
        print(`  - ${title(sn)} (${s.cost} energy): ${s.desc}`);
        print(`      ${describeSkill(s)}`);
      });
    }
  }
  if (USABLE_ITEMS[name]) print(`✨ Effect: ${describeUsable(name)}`);
  if (recipes[name]) {
    const r = recipes[name];
    if (typeof recipeKnown === "function" && !recipeKnown(name)) {
      print(`🔒 Recipe undiscovered. ${recipeUnlockHint(name)}`);
    } else print(
      "📜 Recipe: " +
        Object.entries(r)
          .map(([i, a]) => `${a} ${i}`)
          .join(", ") +
        (Object.entries(r).every(([i, n]) => (inventory[i] || 0) >= n)
          ? "   (you can craft this now)"
          : "")
    );
  }
  const used = Object.keys(recipes).filter((r) => name in recipes[r]);
  if (used.length)
    print(
      `Used to craft (${used.length}): ` +
        used.slice(0, 12).join(", ") +
        (used.length > 12 ? `, +${used.length - 12} more` : "")
    );
  const dr = Object.entries(monsters)
    .filter(([, m]) => name in m.drops)
    .map(([n, m]) => [n, m.drops[name].chance]);
  if (dr.length)
    print(
      "🐾 Dropped by: " +
        dr
          .slice(0, 10)
          .map(([n, c]) => `${n} ${c}%`)
          .join(", ") +
        (dr.length > 10 ? `, +${dr.length - 10} more` : "")
    );
  const b = SHOP_BUY[name],
    s = SHOP_SELL[name];
  print(
    b || s
      ? "🛍️ Shop: " +
          [b ? `buy for ${b} coin` : "", s ? `sells for ${s} coin` : ""].filter(Boolean).join(", ")
      : "🛍️ Shop: not traded"
  );
}

function showEnemyInfo(name) {
  const m = monsters[name];
  const areas = typeof STORY_AREAS !== "undefined"
    ? Object.entries(STORY_AREAS).filter(([, a]) => a.encounters.includes(name)).map(([a]) => a)
    : [];
  print("\n" + "=".repeat(50));
  print(`${m.icon || "👹"}`);
  print("=".repeat(50));
  print(`Enemy: ${title(name)}`);
  print(`❤️ Health: ${m.hp} HP  |  ${m.chance > 0 ? "Field encounter" : "Set encounter / boss"}`);
  const defense = [`${m.block_chance || 0}% chance to guard`];
  if (m.parry_chance) defense.push(`${m.parry_chance}% chance to parry (${m.parry_rate}% strength)`);
  if (m.dodge_chance) defense.push(`${m.dodge_chance}% chance to dodge (${m.dodge_rate}% strength)`);
  print(`🛡️ Defences: ${defense.join("; ")}`);
  const resists = Object.entries(m.resist || {}).filter(([, value]) => value > 0);
  print(resists.length ? `🧯 Resistances: ${resists.map(([e, v]) => `${title(e)} ${v}%`).join(", ")}` : "🧯 Resistances: none known");
  print("\n⚔️");
  const basicAttack = makeAttack("basic attack", m.basic_attack);
  print(`  Basic attack: ${m.basic_attack?.damage ? `${m.basic_attack.damage[0]}–${m.basic_attack.damage[1]} damage` : "standard strike"} (${basicAttack.accuracy}% accuracy)`);
  const abilities = Object.entries(m.abilities || {});
  if (!abilities.length) print("  No special abilities recorded.");
  abilities.forEach(([ability, a]) => {
    const details = [];
    if (a.damage) {
      details.push(`${a.damage[0]}–${a.damage[1]} damage`);
      details.push(`${makeAttack(ability, a).accuracy}% accuracy`);
    }
    if (a.heal) details.push(`heals ${a.heal[0]}–${a.heal[1]} HP`);
    if (a.element) details.push(`${a.element} damage`);
    if (a.special_effect) details.push(`may inflict ${a.special_effect.type}`);
    print(`  ${title(ability)} — ${details.join("; ") || "special move"} (about ${a.chance}% chance)`);
  });
  print("\n🎁");
  Object.entries(m.drops || {}).forEach(([item, d]) => print(`  ${title(item)} — ${d.min_drop}–${d.max_drop} (${d.chance}% chance)`));
  if (areas.length) print(`\nFound in: ${areas.join(", ")}`);
  print(`📖 Status: ${fightUnlocked(name) ? "discovered — you can challenge it with 'fight'" : `undiscovered — ${lockReason(name)}`}`);
  print("Use 'bestiary <enemy>' to review its move pattern and encounter odds.");
}


