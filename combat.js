// Combat: enemy AI, combat UI, player actions, fights and the bestiary.
function enemyWeights(m, last = null) {
  const reacting = C.ATTACKING.includes(last),
    o = [];
  let block = m.block_chance || 0;
  if (block > 0 && reacting) block += C.GUARD_REACT;
  o.push([block, "block", null]);
  for (const st of ["parry", "dodge"]) {
    let w = m[st + "_chance"] || 0;
    if (w > 0 && reacting) w += C.STANCE_REACT;
    o.push([w, st + "_stance", null]);
  }
  for (const [name, data] of Object.entries(m.abilities)) {
    const a = makeAttack(name, data);
    let w = a.chance || 0;
    if ("damage" in a) {
      if (last === "parry") w *= !a.parryable ? C.COUNTER_MULT : C.WEAK_MULT;
      else if (last === "guard") w *= !canGuard(a) ? C.COUNTER_MULT : C.WEAK_MULT;
      else if (last === "dodge") w *= !a.dodgeable ? C.COUNTER_MULT : C.WEAK_MULT;
      o.push([w, "attack", a]);
    } else o.push([w, "heal", a]);
  }
  const others = o.reduce((s, x) => s + x[0], 0);
  o.push([
    Math.max(C.BASIC_MIN, 100 - others),
    "attack",
    makeAttack("basic attack", m.basic_attack),
  ]);
  o.push([m.idle_chance || 0, "idle", null]);
  return o.filter((x) => x[0] > 0);
}
// Picks one move at random from enemyWeights(), using the weights.
function monsterChoose(m, last) {
  const o = enemyWeights(m, last),
    p = wchoice(
      o,
      o.map((x) => x[0])
    );
  return { kind: p[1], attack: p[2] };
}
// Chance (%) that the enemy's parry or dodge stance works against an attack of this type.
function stanceRate(m, st, type) {
  const base = m[st + "_rate"] || 0;
  if (base <= 0) return 0;
  return Math.max(
    5,
    Math.min(95, base + ((st === "parry" ? C.PARRY_MOD : C.DODGE_MOD)[type] || 0))
  );
}
const ACTION_ALIASES = {
  1: "attack",
  attack: "attack",
  a: "attack",
  2: "heavy",
  heavy: "heavy",
  "heavy attack": "heavy",
  3: "guard",
  guard: "guard",
  block: "guard",
  4: "parry",
  parry: "parry",
  5: "dodge",
  dodge: "dodge",
  6: "recover",
  recover: "recover",
  "recover energy": "recover",
  rest: "recover",
  7: "item",
  item: "item",
  "use item": "item",
  use: "item",
  8: "skill",
  skill: "skill",
  skills: "skill",
  s: "skill",
  9: "magic",
  magic: "magic",
  spell: "magic",
  spells: "magic",
  cast: "magic",
  0: "run",
  run: "run",
  flee: "run",
  escape: "run",
  mercy: "run",
  target: "target",
  t: "target",
  log: "log",
};

// ---------- combat: UI ----------
function effLine(e) {
  const [i, w] = EFFECT_STYLE[e.type] || ["✨", e.type];
  const dots = typeof DOT_TYPES !== "undefined" ? DOT_TYPES : new Set(["poison", "burn", "bleed"]);
  if (dots.has(e.type) && e.damage)
    print(`   ${i} ${w} (${e.damage} dmg/turn, ${e.turns} turns left)`);
  else if (e.type === "shield")
    print(`   ${i} ${w} (absorbs ${e.absorb || e.damage || 0}, ${e.turns} turns left)`);
  else print(`   ${i} ${w} (${e.turns} turns left)`);
}
// Prints both health bars and the player's energy bar.
function showStatus(f) {
  print(`❤️ You:        ${hpBar(f.player_hp, f.player_max_hp)}`);
  print(`⚡ Energy:     ${energyBar(f.energy, typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY)}`);
  f.effects.forEach(effLine);
  if (typeof WORLD !== "undefined") {
    (WORLD.companions.active || []).forEach((id) => {
      const d = COMPANION_DEFS[id];
      const max = companionMaxHp(id);
      const hp = WORLD.companions.hp[id] ?? max;
      print(`${pad(d.name, 13)} ${hpBar(hp, max)}`);
    });
  }
  (f.enemies || [{ name: f.name, hp: f.monster_hp, monster: f.monster, effects: f.monster_effects }]).forEach((e, i) => {
    const mark = f.enemies && i === f.target ? " <" : "";
    print(`${pad(cap(e.name), 13)} ${hpBar(e.hp, e.monster.hp)}${mark}`);
    (e.effects || []).forEach(effLine);
  });
  if (f.last_move) print(`   📝 Last move: ${f.last_move}`);
  if (f.guarding) print(`   🛡️ ${cap(f.name)} is guarding — your attacks deal ${int((f.monster.block_reduction || 0) * 100)}% less damage this turn.`);
  if (f.stance === "parry") print("   🤺 PARRY STANCE - it may turn your attack against you!");
  if (f.stance === "dodge") print("   💨 DODGE STANCE - it may slip your attack!");
  if (f.staggered) print(`   💫 STAGGERED - takes +${int(C.STAGGER_BONUS * 100)}% damage!`);
}
// Shows what the enemy is about to do (its telegraphed move).
function showIntent(f) {
  const it = f.intent,
    k = it.kind,
    name = cap(f.name),
    icon = f.monster.icon || "👹";
  print("\n👁️");
  if (k === "stunned") {
    print(`${icon} The ${name} is stunned and can't act this turn!`);
    if (f.stun_turns > 0)
      print(`   💫 Still stunned for ${f.stun_turns} more turn${f.stun_turns > 1 ? "s" : ""} after this.`);
    return;
  }
  if (k === "staggered") {
    print(`${icon} The ${name} is staggered and can't act this turn!`);
    return;
  }
  if (k === "idle") {
    print(`${icon} The ${name} ${it.text}`);
    return;
  }
  if (k === "block") {
    const reduction = int((f.monster.block_reduction || 0) * 100);
    print(`${icon} The ${name} is guarding — your attacks will deal ${reduction}% less damage this turn.`);
    return;
  }
  if (k === "parry_stance" || k === "dodge_stance") {
    const st = k.split("_")[0];
    print(`${icon} The ${name} takes a ${st.toUpperCase()} STANCE!`);
    print(
      `   It will try to ${st === "parry" ? "parry and counter" : "dodge"} your next attack (${stanceRate(f.monster, st, "normal")}% chance).`
    );
    return;
  }
  const a = it.attack,
    an = a.name.toUpperCase();
  if (k === "heal") {
    print(`${icon} The ${name} is preparing ${an}!`);
    print(`   It will heal ${a.heal[0]}-${a.heal[1]} HP.`);
    return;
  }
  if (a.warning) {
    print("🔥 WARNING!");
    print(`The ${name} ${a.telegraph} ${an}!`);
  } else print(`${icon} The ${name} ${a.telegraph} ${an}!`);
  print(
    a.hits > 1
      ? `Damage: ${a.damage[0]}-${a.damage[1]} x${a.hits} hits`
      : `Damage: ${a.damage[0]}-${a.damage[1]}`
  );
  if (a.type !== "normal") print(`Type: ${cap(a.type)}`);
  if (a.element) print(`Element: ${cap(a.element)}`);
  if (a.accuracy < 100) print(`Accuracy: ${a.accuracy}%`);
  const s = f.stats,
    p = parryChance(a, s),
    d = dodgeChance(a, s);
  print(p ? `✓ Can Parry (${p}%)` : "✗ Can't Parry");
  print(
    canGuard(a)
      ? `✓ Can Guard (-${int(guardReduction(s) * 100)}%)`
      : "✗ Can't Guard" + (a.pierces_guard ? " (pierces guard)" : "")
  );
  print(d ? `✓ Can Dodge (${d}%)` : "✗ Can't Dodge");
  if ("heal" in a) print(`Drains: heals itself ${a.heal[0]}-${a.heal[1]} HP if it hits`);
  if (a.special_effect)
    print(`Effect: ${a.special_effect.type} (${a.special_effect.chance}% chance)`);
  if (a.warning) {
    const o = [];
    if (a.parryable) o.push("Parry");
    if (canGuard(a)) o.push("Guard");
    if (a.dodgeable) o.push("Dodge");
    print(
      o.length
        ? "Your options are " + o.join(" or ") + "."
        : "No defense works on this! Attack, recover energy, use an item or run."
    );
  }
}
// Prints the numbered list of player actions.
function showCombatMenu(f) {
  let cn = `${C.HEAVY_COST} energy`;
  if (f.energy < C.HEAVY_COST) cn += ", not enough energy";
  const run = Math.min(C.RUN_MAX, C.RUN + f.stats.dodge),
    sk = weaponSkills();
  const sn = sk.length
    ? `${sk.filter((s) => f.energy >= s.cost && !(f.cooldowns[s.name] || 0)).length}/${sk.length} ready`
    : "equip a weapon with skills";
  print("\n📋");
  print("1. ⚔️ Attack — deal physical damage.");
  print(`2. 💥 Heavy attack — deal increased damage; costs ${cn}.`);
  print("3. 🛡️ Guard — reduce damage from the next attack.");
  print("4. 🤺 Parry — deflect a parryable attack and counter.");
  print("5. 💨 Dodge — avoid a dodgeable attack.");
  print(`6. ⚡ Focus — restore ${C.RECOVER} energy.`);
  print("7. 🧪 Item — use a potion, bomb, or combat aid.");
  print(`8. 🏃 Escape — attempt to flee (${run}% chance).`);
  print(`9. ✨ Weapon skill — use a learned technique (${sn}).`);
  const mag = typeof knownSpells === "function" ? knownSpells().length : 0;
  print(`10. 🔮 Ability — cast a learned spell (${mag ? `${mag} available` : "learn spells in town"}).`);
  if (f.enemies && f.enemies.length > 1) print("Switch targets with 'target'; review recent events with 'log'.");
}
async function chooseItem() {
  const owned = Object.keys(USABLE_ITEMS).filter((n) => (inventory[n] || 0) > 0);
  if (!owned.length) {
    print("You have no usable items!");
    return null;
  }
  print("\n🧪");
  owned.forEach((n, i) => print(`${i + 1}. ${n} x${inventory[n]} (${describeUsable(n)})`));
  print("0. Back");
  while (true) {
    const raw = (await input("Use which item? ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return null;
    if (isDigit(raw) && +raw >= 1 && +raw <= owned.length) return owned[+raw - 1];
    if (owned.includes(raw)) return raw;
    print("Pick an item number or name, or 0 to go back.");
  }
}
async function chooseSkill(f) {
  const sk = weaponSkills();
  if (!sk.length) {
    print("Your weapon has no skills! (Equip a weapon - 'skills' shows what each teaches.)");
    return null;
  }
  const prob = (s) => {
    if (f.energy < s.cost) return `needs ${s.cost} energy`;
    const w = f.cooldowns[s.name] || 0;
    return w ? `cooldown: ${w} more turn(s)` : null;
  };
  print("\n⚔️");
  sk.forEach((s, i) => {
    const y = prob(s);
    print(`${i + 1}. ${title(s.name)} (${s.cost} energy) - ${s.desc}`);
    print(`     ${describeSkill(s)}` + (y ? `   [${y}]` : ""));
  });
  print("0. Back");
  while (true) {
    const raw = (await input("Use which skill? ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return null;
    const ch =
      isDigit(raw) && +raw >= 1 && +raw <= sk.length
        ? sk[+raw - 1]
        : sk.find((s) => s.name === raw);
    if (!ch) {
      print("Pick a skill number or name, or 0 to go back.");
      continue;
    }
    const y = prob(ch);
    if (y) {
      print(`You can't use ${ch.name} right now (${y}).`);
      continue;
    }
    return ch;
  }
}
// Asks the player for an action and returns it (numbers or names are accepted).
async function askAction(f) {
  while (true) {
    const raw = (await input("Choose an action (1-10, or name): ")).trim().toLowerCase(),
      a = ACTION_ALIASES[raw];
    if (!a) {
      print("Pick 1-10, or type an action like 'parry', 'magic', 'log'.");
      continue;
    }
    if (a === "heavy" && f.energy < C.HEAVY_COST) {
      print(`Not enough energy! Heavy Attack costs ${C.HEAVY_COST}.`);
      continue;
    }
    if (a === "item") {
      const n = await chooseItem();
      if (n === null) continue;
      return [a, n];
    }
    if (a === "skill") {
      const s = await chooseSkill(f);
      if (!s) continue;
      return [a, s.name];
    }
    if (a === "magic") {
      const s = typeof chooseSpell === "function" ? await chooseSpell(f) : null;
      if (!s) continue;
      return [a, s];
    }
    if (a === "target") {
      if (!f.enemies || f.enemies.length < 2) {
        print("There is only one enemy.");
        continue;
      }
      print("Living enemies:");
      f.enemies.forEach((e, i) => {
        if (e.hp > 0) print(`  ${i + 1}. ${e.name} (${e.hp} HP)${i === f.target ? " <" : ""}`);
      });
      const rawT = (await input("Target which? ")).trim();
      const idx = parseInt(rawT, 10) - 1;
      if (f.enemies[idx] && f.enemies[idx].hp > 0) {
        f.target = idx;
        print(`Targeting the ${f.enemies[idx].name}.`);
      }
      continue;
    }
    if (a === "log") {
      if (typeof showCombatLog === "function") showCombatLog(f);
      continue;
    }
    return [a, null];
  }
}

// ---------- combat: actions ----------
// Stuns the enemy for its coming turn: cancels its chosen move and any guard/stance.
// Every stun source (items, skills) goes through here so they all behave the same.
// Stun balance. Tweak these numbers to taste.
const STUN = {
  MAX_TURNS: 3, // longest stun any normal enemy can be put under
  BOSS_MAX_TURNS: 2, // bosses (chance <= 0 in monsters.js) are capped lower
  IMMUNE_TURNS: 1, // after a stun ends the enemy shrugs off new stuns for this many of its turns
  PERFECT_TURNS: 2, // perfect parry (overridden by C.PERFECT_STUN_TURNS if you define it)
  LONG_COST_MULT: 1.5, // skills costing >= HEAVY_COST * this auto-stun for 2 turns instead of 1
};
// Default stun length for a skill with no explicit `stun_turns`: big skills stun longer.
function skillStunTurns(s) {
  if (s.stun_turns) return s.stun_turns;
  return s.cost >= C.HEAVY_COST * STUN.LONG_COST_MULT ? 2 : 1;
}
// `turns` = how many enemy turns are lost in total. Stuns don't stack; the longer one wins.
// immediate=true: the enemy's coming turn is cancelled now (items, skills), so that counts as turn 1.
// immediate=false: the enemy already acted this turn (perfect parry), so all `turns` are future turns.
function stunEnemy(f, turns = 1, msg = "", immediate = true) {
  const boss = f.monster.chance <= 0;
  if (f.stun_immune > 0) {
    print(`   🛡️ The ${f.name} shrugs it off - it's still recovering from being stunned!`);
    return false;
  }
  turns = Math.min(boss ? STUN.BOSS_MAX_TURNS : STUN.MAX_TURNS, Math.max(1, int(turns)));
  if (immediate) {
    f.intent = { kind: "stunned", attack: null };
    f.guarding = false;
    f.stance = null;
    f.stun_turns = Math.max(f.stun_turns, turns - 1);
  } else f.stun_turns = Math.max(f.stun_turns, turns);
  if (msg) print(msg);
  if (turns > 1) print(`   💫 It will be stunned for ${turns} turns!`);
  return true;
}
function useItem(f, name) {
  if (typeof WORLD !== "undefined") WORLD.usedCombatItem = true;
  const d = USABLE_ITEMS[name],
    s = f.stats;
  removeItem(name, 1);
  print(`🧪 You use your ${name}.`);
  if ("heal" in d) {
    const b = f.player_hp;
    f.player_hp = d.heal >= 999 ? f.player_max_hp : Math.min(f.player_max_hp, f.player_hp + d.heal);
    print(`   You recover ${f.player_hp - b} HP.`);
  }
  if ("energy" in d) {
    const g = Math.min(d.energy, (typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY) - f.energy);
    f.energy += g;
    print(`   ⚡ You recover ${g} energy.`);
  }
  if (d.cure) {
    const ailments = typeof AILMENTS !== "undefined" ? AILMENTS : new Set(["poison", "burn", "bleed"]);
    const before = f.effects.length;
    f.effects = f.effects.filter((e) => !ailments.has(e.type));
    if (f.effects.length < before) {
      print("   ✨ Your ailments are cured!");
      if (typeof clog === "function") clog(f, "cured ailments");
    } else print("   You had nothing to cure.");
  }
  if ("buff_damage" in d) {
    f.temporary_damage += d.buff_damage;
    print(`   ⚔️ Damage increased by ${d.buff_damage} for this fight!`);
  }
  if ("buff_defense" in d) {
    s.defense += d.buff_defense;
    print(`   🛡️ Defense increased by ${d.buff_defense} for this fight!`);
  }
  if ("buff_dodge" in d) {
    s.dodge += d.buff_dodge;
    print(`   💨 Dodge increased by ${d.buff_dodge}% for this fight!`);
  }
  if ("buff_crit" in d) {
    s.crit += d.buff_crit;
    print(`   🎯 Crit chance increased by ${d.buff_crit}% for this fight!`);
  }
  [
    ["buff_fire_resistance", "fire"],
    ["buff_frost_resistance", "frost"],
  ].forEach(([k, e]) => {
    if (k in d) {
      f.resist[e] = Math.max(f.resist[e], d[k]);
      print(`   🧯 You resist ${e} damage by ${d[k]}% for this fight!`);
    }
  });
  if ("damage" in d) {
    const resist = d.element ? (f.resist[d.element] || 0) : 0;
    const damage = Math.max(1, Math.floor(d.damage * (1 - resist / 100)));
    f.monster_hp -= damage;
    print(`   💣 It hits! The ${f.name} takes ${damage}${d.element ? ` ${d.element}` : ""} damage${resist ? ` (${resist}% resisted)` : ""}.`);
    if (typeof clog === "function") clog(f, `${name} deals ${damage} damage`);
  }
  if (d.effect) applyMonsterEffect(f, d.effect);
  if (d.self && typeof applyStatus === "function") {
    f.effects = applyStatus(f.effects, { ...d.self, chance: 100 }, "You");
    if (typeof clog === "function") clog(f, `you gain ${d.self.type}`);
  }
  if (d.stun)
    stunEnemy(
      f,
      d.stun_turns ?? (typeof d.stun === "number" ? d.stun : 1),
      `   💨 The ${f.name} is blinded and can't act!`
    );
  if (d.revive) {
    f.phoenix_available = true;
    print("   🔥 Phoenix protection is active! If you would be defeated, it will restore you.");
  }
}
function applyMonsterEffect(f, e) {
  if (typeof applyStatus === "function") {
    f.monster_effects = applyStatus(f.monster_effects, e, `The ${f.name}`);
    if (typeof clog === "function") clog(f, `${f.name} ${e.type}`);
    return;
  }
  if (!percent(e.chance ?? 100)) return;
  const [i, w] = EFFECT_STYLE[e.type] || ["✨", e.type];
  f.monster_effects = f.monster_effects.filter((x) => x.type !== e.type);
  f.monster_effects.push({ type: e.type, damage: e.damage, turns: e.turns });
  print(`   ${i} The ${f.name} is ${w}! (${e.damage} damage for ${e.turns} turns)`);
}
function resolveMonsterEffects(f) {
  for (const e of [...f.monster_effects]) {
    if (typeof DOT_TYPES !== "undefined" && !DOT_TYPES.has(e.type)) continue;
    if (!e.damage) continue;
    const [i] = EFFECT_STYLE[e.type] || ["✨"];
    f.monster_hp -= e.damage;
    e.turns--;
    print(`${i} The ${f.name} takes ${e.damage} ${e.type} damage.`);
    if (typeof clog === "function") clog(f, `${f.name} ${e.type} ${e.damage}`);
    if (e.turns <= 0) {
      f.monster_effects.splice(f.monster_effects.indexOf(e), 1);
      print(`   The ${f.name}'s ${e.type} wears off.`);
    }
    if (f.monster_hp <= 0) return;
  }
  if (typeof tickNonDot === "function") tickNonDot(f.monster_effects, `The ${f.name}`);
}
function reducePlayerDamage(f, amt) {
  const mods = typeof effectMods === "function" ? effectMods(f.effects) : { taken: 1, absorb: 0 };
  if (mods.absorb > 0 && amt > 0) {
    const use = Math.min(mods.absorb, amt);
    amt -= use;
    const sh = f.effects.find((e) => e.type === "shield");
    if (sh) {
      sh.absorb = (sh.absorb || sh.damage || 0) - use;
      if (sh.absorb <= 0) f.effects = f.effects.filter((e) => e.type !== "shield");
    }
    print(`🔰 Your shield absorbs ${use} damage.`);
  }
  amt = int(amt * (mods.taken || 1));
  if (typeof hurtCompanions === "function") amt = hurtCompanions(f, amt);
  const d = f.stats.defense;
  if (d > 0 && amt > 0) {
    const r = Math.max(C.MIN_DMG, amt - d);
    if (amt - r > 0) print(`🪖 Your defense absorbs ${amt - r} damage.`);
    return r;
  }
  return amt;
}
function enemyRiposte(f) {
  const [lo, hi] = f.monster.basic_attack.damage;
  let d = Math.max(1, int(randint(lo, hi) * C.RIPOSTE));
  d = reducePlayerDamage(f, d);
  f.player_hp -= d;
  print(`⚔️ The ${f.name} ripostes! You take ${d} damage.`);
}
// Resolves one player strike: hit chance, crits, enemy guard/parry/dodge and the damage dealt.
function strike(f, o) {
  const name = f.name;
  let hc = Math.max(5, Math.min(100, o.hit_chance));
  if (typeof effectMods === "function") hc = Math.max(5, Math.min(100, hc + effectMods(f.effects).accuracy));
  const mult = o.mult ?? 1,
    atk = o.atk_type || "normal";
  if (!percent(hc)) {
    print(
      o.skill_name
        ? `❌ Your ${o.skill_name} misses the ${name}!`
        : `❌ You ${o.heavy ? "swing heavily at" : "swing at"} the ${name} and miss!`
    );
    if (typeof clog === "function") clog(f, `miss vs ${name}`);
    return { result: "miss", damage: 0, landed: false };
  }
  if (f.stance === "dodge") {
    if (o.ignore_dodge) print("   (It can't dodge this attack!)");
    else {
      let rate = stanceRate(f.monster, "dodge", atk);
      if (typeof effectMods === "function")
        rate = Math.max(5, Math.min(95, rate + effectMods(f.monster_effects).dodge));
      if (percent(rate)) {
        print(`💨 The ${name} dodges your attack!`);
        if (typeof clog === "function") clog(f, `${name} dodges`);
        return { result: "dodged", damage: 0, landed: false };
      } else print(`   The ${name} tries to dodge, but you catch it!`);
    }
  } else if (f.stance === "parry") {
    if (o.ignore_parry) print("   (It can't parry this attack!)");
    else if (percent(stanceRate(f.monster, "parry", atk))) {
      print(`🤺 The ${name} parries your attack!`);
      if (typeof clog === "function") clog(f, `${name} parries`);
      enemyRiposte(f);
      return { result: "parried", damage: 0, landed: false };
    } else print(`   The ${name}'s parry fails!`);
  }
  let dmg = randint(...C.PLAYER_DAMAGE) + f.stats.damage + f.temporary_damage;
  dmg = int(dmg * mult);
  const pmod = typeof effectMods === "function" ? effectMods(f.effects) : { damage: 1 };
  dmg = int(dmg * pmod.damage);
  const emod = typeof effectMods === "function" ? effectMods(f.monster_effects) : { taken: 1 };
  dmg = int(dmg * emod.taken);
  const crit = percent(C.CRIT + f.stats.crit + (o.crit_bonus || 0));
  if (crit) dmg = int(dmg * C.CRIT_MULT);
  if (f.staggered) dmg = int(dmg * (1 + C.STAGGER_BONUS));
  const guarded = f.guarding && !o.ignore_guard;
  if (guarded) dmg = int(dmg * (1 - f.monster.block_reduction));
  else if (f.guarding) print("   (Your attack cuts through its guard!)");
  dmg = Math.max(1, dmg);
  const ht = guarded
    ? `The ${name} guards! You only deal ${dmg} damage.`
    : `You hit the ${name} for ${dmg} damage!`;
  const label = crit
    ? "💥 CRITICAL HIT!"
    : o.skill_name
      ? `💥 ${o.skill_name.toUpperCase()}!`
      : o.heavy
        ? "💥 HEAVY HIT!"
        : "💥 HIT!";
  print(`${label} ${ht}`);
  if (typeof clog === "function") clog(f, `${crit ? "CRIT " : ""}${dmg} to ${name}`);
  f.monster_hp -= dmg;
  return { result: crit ? "crit" : "hit", damage: dmg, landed: true };
}
// Handles the player's attack and heavy attack actions.
function playerAttack(f, heavy = false) {
  const r = strike(f, {
    hit_chance: heavy ? C.HEAVY_HIT : C.ATTACK_HIT,
    mult: heavy ? C.HEAVY_MULT : 1,
    atk_type: heavy ? "heavy" : "normal",
    heavy,
  });
  if (r.landed && !heavy) f.energy = Math.min(typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY, f.energy + C.ATTACK_GAIN);
  return r.result;
}
// Uses one of the equipped weapon's skills.
function useSkill(f, s) {
  const name = s.name;
  f.energy -= s.cost;
  if (s.cooldown) f.cooldowns[name] = s.cooldown + 1;
  print(`✨ You use ${name.toUpperCase()}! ${s.desc}`);
  if (s.recoil) {
    f.player_hp = Math.max(1, f.player_hp - s.recoil);
    print(`   💢 Recoil! You lose ${s.recoil} HP.`);
  }
  const hits = s.hits || 1;
  let total = 0,
    landed = false;
  for (let n = 0; n < hits; n++) {
    if (hits > 1) print(`   Strike ${n + 1}/${hits}:`);
    const o = strike(f, {
      hit_chance: C.ATTACK_HIT + (s.hit_bonus || 0),
      mult: s.damage_mult ?? 1,
      crit_bonus: s.crit_bonus || 0,
      atk_type: s.type || "normal",
      ignore_guard: s.ignore_guard,
      ignore_parry: s.ignore_parry,
      ignore_dodge: s.ignore_dodge,
      skill_name: name,
    });
    total += o.damage;
    landed = landed || o.landed;
    if (f.monster_hp <= 0 || f.player_hp <= 0) break;
  }
  if (hits > 1 && total) print(`   Total damage: ${total}`);
  if (total > 0 && s.lifesteal) {
    const h = Math.max(1, int(total * s.lifesteal)),
      b = f.player_hp;
    f.player_hp = Math.min(f.player_max_hp, f.player_hp + h);
    print(`   💚 You drain ${f.player_hp - b} HP.`);
  }
  if (landed && s.energy_gain) {
    const g = Math.min(s.energy_gain, (typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY) - f.energy);
    f.energy += g;
    if (g) print(`   ⚡ You gain ${g} energy.`);
  }
  if (landed && f.monster_hp > 0) {
    if (s.effect) applyMonsterEffect(f, s.effect);
    // `stun` (true or a % chance) or the older `stagger` (% chance); `stun_turns` sets the duration.
    const stunChance = s.stun ? (s.stun === true ? 100 : s.stun) : s.stagger || 0;
    if (stunChance && percent(stunChance))
      stunEnemy(f, skillStunTurns(s), `   💫 The ${f.name} is stunned and loses its turn!`);
  }
}
// Runs the player's turn: asks for an action and carries it out.
async function playerTurn(f) {
  f.owner = "player";
  print("\n🟢");
  let action;
  while (true) {
    showCombatMenu(f);
    let extra;
    [action, extra] = await askAction(f);
    print();
    if (action === "attack" || action === "heavy") {
      if (action === "heavy") f.energy -= C.HEAVY_COST;
      const r = playerAttack(f, action === "heavy");
      if (f.monster_hp <= 0) break;
      if (r === "crit") {
        print("⚡ Critical hit! It's your turn again!");
        print();
        showStatus(f);
        showIntent(f);
        continue;
      }
    } else if (action === "skill") useSkill(f, SKILLS[extra]);
    else if (action === "magic") useSpell(f, extra);
    else if (action === "guard") {
      print("🛡️ You raise your guard!");
      if (typeof clog === "function") clog(f, "you guard");
    } else if (action === "parry") {
      print("⚔️ You ready yourself to parry!");
      if (typeof clog === "function") clog(f, "you prepare parry");
    } else if (action === "dodge") {
      print("💨 You get ready to dodge!");
      if (typeof clog === "function") clog(f, "you prepare dodge");
    }
    else if (action === "recover") {
      const g = Math.min(C.RECOVER, (typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY) - f.energy);
      f.energy += g;
      print(`⚡ You recover ${g} energy.`);
    } else if (action === "run") {
      const ch = Math.min(C.RUN_MAX, C.RUN + f.stats.dodge);
      print("🏃 You try to run away...");
      if (percent(ch)) {
        f.fled = true;
        print(`💨 You escaped from the ${f.name}!`);
      } else print("❌ You couldn't get away!");
    } else if (action === "item") useItem(f, extra);
    break;
  }
  f.choice = action;
}

// ---------- combat: defense & enemy turn ----------
function resolveDefense(f, a, inc) {
  const ch = f.choice,
    an = a.name.toUpperCase(),
    s = f.stats,
    exp = int(inc * C.WRONG_DEF);
  if (ch === "parry") {
    print(`You attempt to parry ${an}!`);
    if (!a.parryable) {
      print(`❌ ${an} cannot be parried!`);
      return exp;
    }
    if (!percent(parryChance(a, s) + (typeof effectMods === "function" ? effectMods(f.effects).parry : 0))) {
      print("Your timing is off - the parry fails!");
      return inc;
    }
    if (percent(C.PERFECT_PARRY)) {
      print("⚡ PERFECT PARRY!");
      print("You perfectly time your defense!");
      stunEnemy(f, C.PERFECT_STUN_TURNS ?? STUN.PERFECT_TURNS, `The ${f.name} is stunned!`, false);
      f.energy = Math.min(typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY, f.energy + C.PERFECT_ENERGY);
      print(`⚡ You restore ${C.PERFECT_ENERGY} energy.`);
      const c = Math.max(
        1,
        int((randint(...C.PLAYER_DAMAGE) + s.damage + f.temporary_damage) * C.PERFECT_COUNTER)
      );
      f.monster_hp -= c;
      print(`⚔️ Counterattack deals ${c} damage!`);
      if (typeof clog === "function") clog(f, `perfect parry counter ${c}`);
      // Fully nullified: no damage, no status effect, no drain heal for the enemy.
      return 0;
    } else {
      print("⚔️ PARRY!");
      print("You deflect the attack!");
      if (typeof clog === "function") clog(f, "parry");
      if (typeof hasPerk === "function" && hasPerk("iron counter") && f.monster_hp > 0) {
        const cc = Math.max(1, int((randint(...C.PLAYER_DAMAGE) + s.damage) * 0.35));
        f.monster_hp -= cc;
        print(`⚔️ Iron Counter deals ${cc} damage!`);
      }
      if (percent(C.PARRY_STAGGER)) {
        f.staggered = true;
        print(`💫 The ${f.name} is staggered!`);
      }
    }
    return int(inc * C.PARRY_TAKEN);
  }
  if (ch === "guard") {
    if (canGuard(a)) {
      const r = guardReduction(s);
      print(`🛡️ Guard reduces damage by ${int(r * 100)}%!`);
      return int(inc * (1 - r));
    }
    print(`You raise your guard against ${an}...`);
    print(a.pierces_guard ? `🔥 ${an} pierces your guard!` : `❌ ${an} cannot be blocked!`);
    return exp;
  }
  if (ch === "dodge") {
    print(`You try to dodge ${an}!`);
    if (!a.dodgeable) {
      print(`❌ ${an} cannot be dodged!`);
      return exp;
    }
    if (percent(dodgeChance(a, s) + (typeof effectMods === "function" ? effectMods(f.effects).dodge : 0))) {
      print("💨 You dodge the attack!");
      if (typeof clog === "function") clog(f, "you dodge");
      return 0;
    }
    print("😵 You fail to dodge!");
    return inc;
  }
  return inc;
}
// Maybe puts poison, burn or bleed on the player after an enemy hit.
function applySpecialEffect(f, a) {
  const e = a.special_effect;
  if (!e) return;
  if (typeof applyStatus === "function") {
    f.effects = applyStatus(f.effects, { ...e, element: e.element || a.element }, "You");
    if (typeof clog === "function") clog(f, `status ${e.type}`);
    return;
  }
  if (!percent(e.chance ?? 100)) return;
  const [i, w] = EFFECT_STYLE[e.type] || ["✨", e.type];
  f.effects = f.effects.filter((x) => x.type !== e.type);
  f.effects.push({ type: e.type, damage: e.damage || 0, turns: e.turns, element: a.element, absorb: e.absorb || 0 });
  print(`${i} You are ${w}!` + (e.damage ? ` (${e.damage} damage for ${e.turns} turns)` : ` (${e.turns} turns)`));
  if (typeof clog === "function") clog(f, `status ${e.type}`);
}
// Deals this turn's damage from poison, burn and bleed on the player.
function resolveEffects(f) {
  for (const e of [...f.effects]) {
    if (typeof DOT_TYPES !== "undefined" && !DOT_TYPES.has(e.type)) continue;
    if (!e.damage) continue;
    const [i] = EFFECT_STYLE[e.type] || ["✨"];
    let d = e.damage;
    const r = f.resist[e.element] || 0;
    if (r) d = Math.max(1, int(d * (1 - r / 100)));
    f.player_hp -= d;
    e.turns--;
    print(`${i} ${cap(e.type)} deals ${d} damage.`);
    if (typeof clog === "function") clog(f, `${e.type} ticks ${d}`);
    if (e.turns <= 0) {
      f.effects.splice(f.effects.indexOf(e), 1);
      print(`   The ${e.type} wears off.`);
    }
  }
  if (typeof tickNonDot === "function") tickNonDot(f.effects, "Your");
}
// Applies one enemy hit to the player (defense, resistances, damage reduction).
function monsterDealDamage(f, a, inc) {
  if (f.owner !== "monster") {
    print(`🚫 The ${f.name} can't attack - it isn't its turn!`);
    return 0;
  }
  let t = resolveDefense(f, a, inc);
  if (f.monster_hp <= 0 || t <= 0) return 0;
  const r = (f.resist[a.element] || 0) + (typeof effectMods === "function" ? effectMods(f.effects).elemResist : 0);
  if (r) {
    t = int(t * (1 - r / 100));
    print(`🧯 Your resistance shrugs off ${r}% of the ${a.element} damage.`);
    if (t <= 0) return 0;
  }
  t = reducePlayerDamage(f, t);
  print(`💔 You are hit for ${t} damage.`);
  if (typeof clog === "function") clog(f, `you take ${t}`);
  f.player_hp -= t;
  applySpecialEffect(f, a);
  return t;
}
// Decides what the enemy will do on the coming turn.
function rollIntent(f) {
  let it;
  if (f.stun_turns > 0) {
    f.stun_turns--;
    it = { kind: "stunned", attack: null };
  } else if (f.staggered) it = { kind: "staggered", attack: null };
  else {
    it = monsterChoose(f.monster, f.choice);
    if (it.kind === "idle") it.text = IDLE_LINES[randint(0, IDLE_LINES.length - 1)];
  }
  f.intent = it;
  f.guarding = it.kind === "block";
  f.stance = { parry_stance: "parry", dodge_stance: "dodge" }[it.kind] || null;
}
// Plays out the enemy's turn.
function monsterTurn(f) {
  f.owner = "monster";
  const name = f.name;
  const it = f.intent,
    k = it.kind;
  print("\n🔴");
  f.staggered = false;
  let attacked = false;
  if (k === "stunned") {
    print(`😵 The ${name} is stunned and can't act!`);
    f.last_move = "was stunned and lost its turn";
    // Last stunned turn: it recovers, then resists further stuns briefly.
    if (f.stun_turns <= 0) f.stun_immune = STUN.IMMUNE_TURNS;
  } else if (k === "staggered") {
    print(`💫 The ${name} is staggered and can't act!`);
    f.last_move = "was staggered and lost its turn";
  } else if (k === "idle") {
    print(`💤 The ${name} ${it.text}`);
    f.last_move = "did nothing";
  } else if (k === "block") {
    print(`🛡️ The ${name} holds its guard.`);
    f.last_move = "guarded";
  } else if (k === "parry_stance" || k === "dodge_stance") {
    const st = k.split("_")[0];
    print(
      st === "parry"
        ? `🤺 The ${name} holds its parry stance.`
        : `💨 The ${name} holds its dodge stance.`
    );
    f.last_move = `${st} stance`;
  } else if (k === "heal") {
    const a = it.attack,
      h = randint(...a.heal);
    f.monster_hp = Math.min(f.monster.hp, f.monster_hp + h);
    print(`✨ The ${name} uses ${a.name.toUpperCase()}!`);
    print(`💚 It heals ${h} HP.`);
    f.last_move = a.name.toUpperCase();
  } else {
    const a = it.attack;
    print(`✨ The ${name} uses ${a.name.toUpperCase()}!`);
    f.last_move = a.name.toUpperCase();
    for (let n = 0; n < a.hits; n++) {
      // stun_turns can only become > 0 mid-attack via a perfect parry: stop the rest of the combo.
      if (f.monster_hp <= 0 || f.player_hp <= 0 || f.stun_turns > 0) break;
      if (a.hits > 1) print(`   Strike ${n + 1}/${a.hits}:`);
      if (!percent(a.accuracy)) {
        print(`💨 ${a.name.toUpperCase()} misses you completely!`);
        continue;
      }
      attacked = true;
      const dealt = monsterDealDamage(f, a, randint(...a.damage));
      if (dealt > 0 && "heal" in a && f.monster_hp > 0) {
        const h = randint(...a.heal),
          b = f.monster_hp;
        f.monster_hp = Math.min(f.monster.hp, f.monster_hp + h);
        print(`🧛 The ${name} drains ${f.monster_hp - b} HP from you!`);
      }
    }
  }
  if (!attacked && ["guard", "parry", "dodge"].includes(f.choice))
    print(`(${cap(f.choice)} wasn't needed this turn.)`);
  if (k !== "stunned" && f.stun_immune > 0) f.stun_immune--;
  f.guarding = false;
  f.stance = null;
  if (f.monster_hp <= 0) return;
  resolveMonsterEffects(f);
  if (f.monster_hp <= 0) return;
  resolveEffects(f);
}

// ---------- fights ----------
const BOSS_CH = {
  "the unnamed king": 2,
  "the leftover": 3,
  "the watcher": 4,
  "the witness": 5,
  "the archivist": 6,
  "the first hero": 7,
  "the editor": 8,
  "the author": 9,
  "the last save": 10,
};
const BOSS_UNLOCKS = {
  "goblin king": "goblin",
  "alpha wolf": "wolf",
  "orc warlord": "orc",
  "ancient golem": "stone golem",
  "frost giant king": "frost giant",
  "ash demon": "demon",
};
// Creates the state object that tracks one fight (HP, energy, effects, cooldowns...).
function newFight(n, extras = []) {
  const names = Array.isArray(n) ? n : [n, ...extras];
  const s = getStats();
  const f = {
    enemies: names.map((nm) =>
      typeof makeEnemyState === "function" ? makeEnemyState(nm) : { name: nm, monster: monsters[nm], hp: monsters[nm].hp, effects: [], guarding: false, stance: null, stun_turns: 0, stun_immune: 0, staggered: false, last_move: null, intent: null }
    ),
    target: 0,
    stats: s,
    player_hp: s.max_hp,
    player_max_hp: s.max_hp,
    energy: Math.min(C.START_ENERGY, typeof maxEnergy === "function" ? maxEnergy() : C.MAX_ENERGY),
    effects: [],
    last_move: null,
    choice: null,
    owner: "player",
    cooldowns: {},
    temporary_damage: 0,
    resist: { fire: 0, frost: 0 },
    phoenix_available: false,
    fled: false,
    log: [],
  };
  if (typeof attachEnemyAccessors === "function") attachEnemyAccessors(f);
  else {
    f.name = names[0];
    f.monster = monsters[names[0]];
    f.monster_hp = f.monster.hp;
    f.monster_effects = [];
    f.guarding = false;
    f.stance = null;
    f.stun_turns = 0;
    f.stun_immune = 0;
    f.staggered = false;
    f.intent = null;
  }
  return f;
}
function tickCooldowns(f) {
  for (const k of Object.keys(f.cooldowns)) {
    f.cooldowns[k]--;
    if (f.cooldowns[k] <= 0) delete f.cooldowns[k];
  }
}
// True if the player has lost the fight, unless a phoenix potion saves them.
function playerDown(f) {
  if (f.player_hp > 0) return false;
  if (f.phoenix_available) {
    f.phoenix_available = false;
    f.player_hp = Math.max(1, Math.floor(f.player_max_hp / 2));
    print("\n🔥 THE PHOENIX RISES!");
    print("The phoenix potion saves you and restores half your HP!");
    return false;
  }
  return true;
}
// Rolls the defeated enemy's drops and adds them to the inventory.
function rollLoot(m) {
  const boss = m.chance <= 0;
  if (!boss && !percent(m.chance)) {
    print("💨 Unlucky! The monster dropped nothing.");
    return;
  }
  print("🎉 The monster dropped loot!");
  let any = false;
  for (const [n, d] of Object.entries(m.drops))
    if (percent(d.chance)) {
      addItem(n, randint(d.min_drop, d.max_drop));
      any = true;
    }
  if (!any) print("...but it turned out to be nothing useful.");
}
// Victory: grants XP and loot, records the kill for the story.
function winFight(f) {
  const fallen = (f.enemies || [{ name: f.name, monster: f.monster }]).filter((e) => e.hp <= 0);
  const names = fallen.length ? fallen : [{ name: f.name, monster: f.monster }];
  print(`\n🏆 You defeated ${names.map((e) => "the " + e.name).join(" and ")}!`);
  if (typeof clog === "function") names.forEach((e) => clog(f, `defeated ${e.name}`));
  let xp = 0;
  names.forEach((e) => {
    const m = e.monster || f.monster;
    xp += Math.floor(m.hp / 2) + 5;
  });
  const xm = names[0]?.monster?._xpMult || 1;
  xp = Math.floor(xp * xm);
  print(`✨ You gain ${xp} XP.`);
  grantXp(xp);
  names.forEach((e) => rollLoot(e.monster || f.monster));
  names.forEach((e) => {
    const nm = (e.name || "").replace(/^elite /, "");
    if (typeof discoverRecipeFromEnemy === "function") discoverRecipeFromEnemy(nm);
    const first = killCount(nm) === 0;
    recordVictory(nm);
    if (typeof WORLD !== "undefined") WORLD.totalKills = (WORLD.totalKills || 0) + 1;
    if (typeof noteQuestKill === "function") noteQuestKill(nm);
    if (first) print(`\n🔓 ${title(nm)} unlocked! You can now pick it with 'fight'.`);
  });
  if (typeof checkAchievements === "function") checkAchievements();
  maybeFourthWall();
}
// Defeat: the player drops half their coins.
function loseFight(f) {
  print(`\n💀 The ${f.name} defeated you!`);
  const l = Math.floor((inventory.coin || 0) / 2);
  if (l > 0) {
    print("You drop half your coins as you flee...");
    removeItem("coin", l);
  }
}
// Blocks story bosses until the right chapter and level are reached.
function checkGate(req) {
  const ch = BOSS_CH[req];
  if (ch === undefined) return true;
  if (STORY.chapter < ch) {
    print(`\n🔒 ${title(req)} is not reachable yet.`);
    print(`You must progress to Chapter ${ch} first.`);
    return false;
  }
  const need = STORY_PROGRESS[ch].level;
  if (PLAYER.level < need) {
    print(`\n🔒 ${title(req)} refuses to appear.`);
    print(`Reach level ${need} first (you are level ${PLAYER.level}).`);
    return false;
  }
  return true;
}
// Runs a whole fight, turn by turn, until someone wins or the player runs away.
async function fightMonster(arg = "", elite = false) {
  const req = arg.trim().toLowerCase();
  if (!checkGate(req)) return;
  let name;
    if (monsters[req]) name = req;
    else if (req.includes(",") && req.split(",").every((x) => monsters[x.trim()]))
      name = req.split(",").map((x) => x.trim());
  else {
    const pool = Object.keys(monsters).filter((n) => monsters[n].chance > 0);
    name = wchoice(
      pool,
      pool.map((n) => monsters[n].chance)
    );
  }
  const f = newFight(name);
  if (elite && f.enemies) f.enemies = f.enemies.map((e) => makeEnemyState(e.name, true));
  print(`\n⚔️ A wild ${Array.isArray(name) ? name.map((n) => n.toUpperCase()).join(" & ") : name.toUpperCase()} appeared!`);
  const eq = Object.values(equipment).filter(Boolean);
  if (eq.length) print("🧰 Equipped: " + eq.join(", "));
  if (typeof applyRested === "function") applyRested(f);
  if (typeof SETTINGS !== "undefined" && SETTINGS.difficulty !== "normal")
    print(`⚙️ Difficulty: ${SETTINGS.difficulty}${PLAYER.ngPlus ? ` · NG+${PLAYER.ngPlus}` : ""}`);
  let turn = 0;
  const down = () => (typeof foesDown === "function" ? foesDown(f) : f.monster_hp <= 0);
  while (true) {
    turn++;
    tickCooldowns(f);
    print(`\n===== Turn ${turn} =====`);
    if (f.enemies) {
      f.enemies.forEach((e, i) => {
        if (e.hp <= 0) return;
        f.target = i;
        rollIntent(f);
      });
      const live = f.enemies.findIndex((e) => e.hp > 0);
      if (live >= 0) f.target = live;
    } else rollIntent(f);
    showStatus(f);
    if (f.enemies && f.enemies.length > 1) {
      f.enemies.forEach((e, i) => {
        if (e.hp <= 0) return;
        f.target = i;
        showIntent(f);
      });
      const live = f.enemies.findIndex((e) => e.hp > 0);
      if (live >= 0) f.target = live;
    } else showIntent(f);
    if (typeof remindHeal === "function") remindHeal(f);
    await playerTurn(f);
    if (f.fled) {
      print("(No XP or loot from a fight you ran from.)");
      return;
    }
    if (down()) {
      winFight(f);
      if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
      return;
    }
    if (playerDown(f)) {
      loseFight(f);
      return;
    }
    if (typeof companionTurns === "function") await companionTurns(f);
    if (down()) {
      winFight(f);
      if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
      return;
    }
    if (f.enemies) {
      for (let i = 0; i < f.enemies.length; i++) {
        if (f.enemies[i].hp <= 0) continue;
        f.target = i;
        monsterTurn(f);
        if (down()) {
          winFight(f);
          if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
          return;
        }
        if (playerDown(f)) {
          loseFight(f);
          return;
        }
      }
    } else {
      monsterTurn(f);
      if (down()) {
        winFight(f);
        if (typeof maybePromptLevelUp === "function") await maybePromptLevelUp();
        return;
      }
      if (playerDown(f)) {
        loseFight(f);
        return;
      }
    }
  }
}
const fightUnlocked = (n) =>
  killCount(n) > 0 || (BOSS_UNLOCKS[n] && killCount(BOSS_UNLOCKS[n]) > 0);
function lockReason(n) {
  if (BOSS_CH[n])
    return "it's a story boss: 'explore' once you reach its level and challenge it there";
  return BOSS_UNLOCKS[n]
    ? `defeat a ${title(BOSS_UNLOCKS[n])} first`
    : "defeat one once, via 'explore' or a random 'fight', to unlock it";
}
// Menu for choosing which unlocked enemy to fight.
async function pickEnemy() {
  const names = Object.keys(monsters).filter(fightUnlocked);
  print("\n⚔️");
  print(" R. Random encounter");
  if (names.length)
    names.forEach((n, i) => {
      const m = monsters[n];
      print(
        `${rpad(i + 1, 2)}. ${m.icon || "👹"} ${title(n)}${m.chance <= 0 ? "  [boss]" : ""}  (${m.hp} HP, beaten ${killCount(n)}x)`
      );
    });
  else print("(No enemies unlocked yet - defeat an enemy once to be able to pick it.)");
  print(" 0. Back");
  while (true) {
    const raw = (await input("Fight which enemy? (number or name): ")).trim().toLowerCase();
    if (["0", "back", ""].includes(raw)) return null;
    if (["r", "random"].includes(raw)) return "";
    if (isDigit(raw) && +raw >= 1 && +raw <= names.length) return names[+raw - 1];
    if (names.includes(raw)) return raw;
    if (monsters[raw]) print(`🔒 Locked - ${lockReason(raw)}.`);
    else print("Pick an enemy number or name, 'r' for random, or 0 to go back.");
  }
}
// The 'fight' command.
async function fightCommand(arg = "") {
  let r = arg.trim().toLowerCase();
  if (!r) {
    r = await pickEnemy();
    if (r === null) return;
  } else if (r === "random" || r === "r") r = "";
  else if (!monsters[r]) {
    print(`No monster called '${r}'. Type 'fight' to see the ones you can pick.`);
    return;
  } else if (!fightUnlocked(r)) {
    print(`\n🔒 ${title(r)} is locked - ${lockReason(r)}.`);
    print("Type 'fight' to see the enemies you have unlocked.");
    return;
  }
  await fightMonster(r);
}
// The 'bestiary' command: moves, drops and unlock status of enemies.
function showBestiary(arg = "") {
  const term = arg.trim().toLowerCase(),
    names = term ? Object.keys(monsters).filter((n) => n.includes(term)) : Object.keys(monsters);
  if (!names.length) {
    print(`No enemy matches '${term}'.`);
    return;
  }
  const tc = Object.values(monsters).reduce((s, m) => s + m.chance, 0);
  print("\n📖");
  for (const n of names) {
    const m = monsters[n],
      w = enemyWeights(m),
      t = w.reduce((s, x) => s + x[0], 0);
    const lab = (k, a) =>
      k === "block"
        ? "guard"
        : k === "parry_stance" || k === "dodge_stance"
          ? k.replace("_", " ")
          : k === "idle"
            ? "idle"
            : a.name;
    print(`\n${m.icon || "👹"} ${title(n)}  ·  ❤️ ${m.hp} HP`);
    print(
      "   🎯 Tactics (chance each turn): " +
        w.map(([x, k, a]) => `${lab(k, a)} ${Math.round((100 * x) / t)}%`).join(", ")
    );
    print(
      "   🎁 Drops: " +
        Object.entries(m.drops)
        .map(([i, d]) => `${title(i)} x${d.min_drop}-${d.max_drop} (${d.chance}%)`)
          .join(", ")
    );
    const resists = Object.entries(m.resist || {}).filter(([, v]) => v > 0);
    if (resists.length) print(`   Resists: ${resists.map(([e, v]) => `${title(e)} ${v}%`).join(", ")}`);
    const special = Object.entries(m.abilities || {});
    if (special.length) {
      print("   Signature moves:");
      special.forEach(([move, a]) => {
        const parts = [];
        if (a.damage) parts.push(`${a.damage[0]}-${a.damage[1]} damage`);
        if (a.heal) parts.push(`heals ${a.heal[0]}-${a.heal[1]} HP`);
        if (a.element) parts.push(`${a.element} element`);
        if (a.special_effect) parts.push(`${a.special_effect.type} effect`);
        print(`     ${title(move)}: ${parts.join(", ") || "special action"}`);
      });
    }
    print(
      m.chance > 0
        ? `   🍃 Encounter chance: ${((100 * m.chance) / tc).toFixed(1)}%   ·   Loot chance: ${m.chance}%`
        : "   👑 Boss or set encounter — appears through the story and guards its loot"
    );
    const st = [];
    if (m.parry_chance) st.push(`parries ${m.parry_rate}%`);
    if (m.dodge_chance) st.push(`dodges ${m.dodge_rate}%`);
    if (st.length) print(`   🛡️ Defence: ${st.join(", ")}`);
    print(
      fightUnlocked(n)
        ? "   'fight' command: unlocked ✓"
        : `   'fight' command: locked 🔒 (${lockReason(n)})`
    );
  }
}
