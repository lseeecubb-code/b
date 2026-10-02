// Player stats, inventory, equipment and item info.
function getStats() {
  const s = {
    max_hp: C.BASE_MAX_HP,
    damage: 0,
    guard: 0.0,
    parry: 0,
    crit: 0,
    dodge: 0,
    defense: 0,
  };
  Object.values(equipment).forEach((n) => {
    if (n) for (const k in s) s[k] += ITEMS[n][k] || 0;
  });
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
  const w = equipment.weapon;
  return w ? (ITEMS[w].skills || []).map((n) => SKILLS[n]) : [];
};

function showInventory(arg = "") {
  const held = {};
  for (const n in inventory) if (inventory[n] > 0) held[n] = inventory[n];
  print("\n--- Inventory ---");
  if (!Object.keys(held).length) {
    print("(empty)");
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
  print(`coin: ${held.coin || 0}`);
  delete held.coin;
  const groups = {};
  for (const n in held) (groups[itemCategory(n)] ??= []).push(n);
  let shown = false;
  for (const c of CAT_ORDER) {
    if (!wanted.includes(c) || !groups[c]) continue;
    shown = true;
    print(`\n[${c}]`);
    groups[c]
      .sort()
      .forEach((n) =>
        print(`  ${n}: ${held[n]}${Object.values(equipment).includes(n) ? " (equipped)" : ""}`)
      );
  }
  if (!shown) print("\n(nothing in that category)");
  print("\nTip: 'info <item>' shows an item's stats, recipe, drops and prices.");
}
function showSkills() {
  const s = weaponSkills();
  print("\n--- Weapon Skills ---");
  if (!s.length) {
    print("Your weapon has no skills (or you have no weapon equipped).");
  } else
    s.forEach((k) => {
      print(`- ${title(k.name)} (${k.cost} energy): ${k.desc}`);
      print(`    ${describeSkill(k)}`);
    });
  if (typeof showMagic === "function") showMagic();
  if (typeof PERKS !== "undefined") {
    print("\nPermanent perks (independent of weapon):");
    const ps = PLAYER.perks || [];
    if (!ps.length) print("  (none yet — type 'perks')");
    else ps.forEach((id) => print(`  ✓ ${title(id)} — ${PERKS[id]?.desc || ""}`));
  }
}
function showStats() {
  const s = getStats();
  print("\n--- Player Stats ---");
  print(
    PLAYER.level >= C.MAX_LEVEL
      ? `Level:      ${PLAYER.level} (MAX)`
      : `Level:      ${PLAYER.level}   XP: ${PLAYER.xp}/${xpNeeded(PLAYER.level)}`
  );
  if (PLAYER.ngPlus) print(`Run:        New Game+ ${PLAYER.ngPlus}`);
  print(`Attributes: STR ${PLAYER.str ?? 5}  AGI ${PLAYER.agi ?? 5}  VIT ${PLAYER.vit ?? 5}  FOC ${PLAYER.foc ?? 5}`);
  if (PLAYER.statPoints) print(`Unspent stat points: ${PLAYER.statPoints}  (type 'allocate')`);
  if (PLAYER.skillPoints) print(`Unspent perk points: ${PLAYER.skillPoints}  (type 'perks')`);
  print(`Max HP:     ${s.max_hp}`);
  print(`Damage:     ${C.PLAYER_DAMAGE[0] + s.damage}-${C.PLAYER_DAMAGE[1] + s.damage}`);
  print(`Hit chance: ${C.ATTACK_HIT}%   Crit chance: ${C.CRIT + s.crit}%`);
  print(`Energy:     start ${C.START_ENERGY}, max ${typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY}`);
  print(`Guard:      -${int(guardReduction(s) * 100)}% damage (not vs. piercing/unblockable)`);
  print(`Defense:    -${s.defense} damage per hit (min ${C.MIN_DMG})`);
  print(`Parry:      ${C.PARRY + s.parry}% base`);
  print(`Dodge:      ${C.DODGE + s.dodge}% base`);
  print(`Run:        ${Math.min(C.RUN_MAX, C.RUN + s.dodge)}% chance`);
  if (typeof showAttributeSummary === "function") {
    print("\nSTR → physical damage · AGI → dodge/parry · VIT → max HP · FOC → energy/spells");
  }
  print("\n--- Equipped ---");
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
  const sk = weaponSkills();
  if (sk.length) {
    print("\n--- Weapon Skills ---");
    sk.forEach((k) => print(`- ${title(k.name)} (${k.cost} energy): ${k.desc}`));
  }
}

async function equipItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (!choice) {
    const owned = groupedNames(Object.keys(ITEMS).filter((n) => (inventory[n] || 0) > 0));
    if (!owned.length) {
      print("You don't have anything to equip!");
      return;
    }
    print("\n--- Items You Can Equip ---");
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
  if (ITEMS[choice].description) print(`   "${ITEMS[choice].description}"`);
  if (ITEMS[choice].skills?.length) print("   Skills: " + ITEMS[choice].skills.join(", "));
}
async function unequipItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (!choice) {
    const worn = groupedNames(Object.values(equipment).filter(Boolean));
    if (!worn.length) {
      print("You have nothing equipped.");
      return;
    }
    print("\n--- Items You Can Unequip ---");
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
      print("\n--- Your Items ---");
      printNumbered(owned, (n) => `${n} x${inventory[n]}`);
    } else print("\n(Your inventory is empty.)");
    text = resolveChoice(
      await input("\nLook up which item? (number from the list, or any item name): "),
      owned
    );
    if (!text) return;
  }
  const name = findItem(text);
  if (name === null) return;
  print("\n" + "=".repeat(50));
  print(`${title(name)}  [${itemCategory(name)}]`);
  print("=".repeat(50));
  print(
    `You own: ${inventory[name] || 0}` +
      (Object.values(equipment).includes(name) ? " (equipped)" : "")
  );
  if (ITEMS[name]) {
    const it = ITEMS[name];
    print(`Slot:   ${it.id}`);
    print(`Stats:  ${describeBuffs(name)}`);
    if (it.description) print(`        "${it.description}"`);
    const cur = equipment[it.id];
    if (cur === null) print(`Your ${it.id} slot is empty, so you'd gain all of the above.`);
    else if (cur !== name) print(`Versus your ${cur}: ${compareGear(name, cur)}`);
    if (it.skills?.length) {
      print("Weapon skills:");
      it.skills.forEach((sn) => {
        const s = SKILLS[sn];
        print(`  - ${title(sn)} (${s.cost} energy): ${s.desc}`);
        print(`      ${describeSkill(s)}`);
      });
    }
  }
  if (USABLE_ITEMS[name]) print(`Effect: ${describeUsable(name)}`);
  if (recipes[name]) {
    const r = recipes[name];
    print(
      "Recipe: " +
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
      "Dropped by: " +
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
      ? "Shop:   " +
          [b ? `buy for ${b} coin` : "", s ? `sells for ${s} coin` : ""].filter(Boolean).join(", ")
      : "Shop:   not traded"
  );
}
