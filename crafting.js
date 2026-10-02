// Crafting recipes and the shop.
function recipeKnown(name) {
  const ingredientsFound = Object.keys(recipes[name] || {}).every((item) =>
    (WORLD.recipeMaterialsSeen || []).includes(item)
  );
  return ingredientsFound && (!RECIPE_DISCOVERY[name] || (WORLD.recipeUnlocks || []).includes(name));
}
function recipeUnlockHint(name) {
  const sources = Object.keys(RECIPE_DISCOVERY[name] || {});
  const missing = Object.keys(recipes[name] || {}).filter((item) => !(WORLD.recipeMaterialsSeen || []).includes(item));
  const hints = [];
  if (missing.length) hints.push(`find ${missing.join(", ")}`);
  if (sources.length && !(WORLD.recipeUnlocks || []).includes(name)) hints.push(`defeat ${sources.map((n) => title(n)).join(", ")}`);
  return hints.length ? `Discover it: ${hints.join(" and ")}.` : "";
}
function discoverRecipeFromEnemy(enemyName) {
  if (!WORLD.recipeUnlocks) WORLD.recipeUnlocks = [];
  for (const [name, sources] of Object.entries(RECIPE_DISCOVERY)) {
    const chance = sources[enemyName];
    if (chance === undefined || WORLD.recipeUnlocks.includes(name) || !percent(chance)) continue;
    WORLD.recipeUnlocks.push(name);
    print(`\n📜 New recipe discovered: ${title(name)}!`);
    print(`Use 'recipes track ${name}' to follow it. Find each ingredient once to reveal the formula: ${Object.entries(recipes[name]).map(([mat, n]) => `${n} ${mat}`).join(", ")}.`);
    return name;
  }
  return null;
}

function craftOne(choice, amount) {
  if (!recipes[choice]) {
    print(`❔ No recipe found for '${choice}'. Browse 'recipes' to see what you can make.`);
    return;
  }
  if (!recipeKnown(choice)) {
    print(`🔒 ${title(choice)} is still a mystery. ${recipeUnlockHint(choice)}`);
    return;
  }
  if (amount < 1) {
    print("⚠️ Choose at least one item to craft.");
    return;
  }
  const need = recipes[choice],
    miss = [];
  for (const [i, per] of Object.entries(need))
    if ((inventory[i] || 0) < per * amount) miss.push([i, per * amount - (inventory[i] || 0)]);
  if (miss.length) {
    print(`🧺 You don't have the materials for ${amount} ${choice} yet:`);
    miss.forEach(([i, s]) => print(`  • ${s} more ${i} needed.`));
    return;
  }
  print(`\n🔨 Crafting ${amount} ${choice}...`);
  for (const [i, per] of Object.entries(need)) removeItem(i, per * amount);
  addItem(choice, amount);
  if (!WORLD.recipesCrafted) WORLD.recipesCrafted = [];
  if (!WORLD.recipesCrafted.includes(choice)) WORLD.recipesCrafted.push(choice);
  if (typeof checkAchievements === "function") checkAchievements();
  print(`✅ Crafted ${amount} ${choice}!`);
  if (ITEMS[choice]) print(`🛡️ Equip it with 'equip ${choice}': ${describeBuffs(choice)}`);
  else if (USABLE_ITEMS[choice]) print(`🧪 Ready for battle: ${describeUsable(choice)}`);
}
async function showRecipes(arg = "") {
  let term = arg.trim().toLowerCase(),
    cats;
  const view = term;
  if (view.startsWith("track ")) {
    const name = view.slice(6).trim();
    if (!recipes[name]) {
      print(`❔ No recipe named '${name}'. Check 'recipes' or 'recipes locked'.`);
      return true;
    }
    if (!WORLD.trackedRecipes) WORLD.trackedRecipes = [];
    if (WORLD.trackedRecipes.includes(name)) print(`📌 ${title(name)} is already in your recipe tracker.`);
    else {
      WORLD.trackedRecipes.push(name);
      print(`📌 Tracking ${title(name)}. Use 'recipes tracking' to review its progress.`);
    }
    return true;
  }
  if (view.startsWith("untrack ")) {
    const name = view.slice(8).trim();
    WORLD.trackedRecipes = (WORLD.trackedRecipes || []).filter((item) => item !== name);
    print(recipes[name] ? `📍 Stopped tracking ${title(name)}.` : `❔ No recipe named '${name}'.`);
    return true;
  }
  if (view === "locked" || view === "tracking") {
    const locked = Object.entries(recipes).filter(([name]) => !recipeKnown(name));
    const rows = view === "locked"
      ? locked
      : (WORLD.trackedRecipes || []).filter((name) => recipes[name]).map((name) => [name, recipes[name]]);
    print(view === "locked" ? "\n🔒" : "\n📌");
    if (!rows.length) print(view === "locked" ? "✨ Every recipe has been discovered!" : "  Nothing tracked yet. Add one with 'recipes track <recipe name>'.");
    rows.forEach(([name, ingredients]) => {
      const found = Object.keys(ingredients).filter((item) => (WORLD.recipeMaterialsSeen || []).includes(item)).length;
      const ready = Object.entries(ingredients).every(([item, count]) => (inventory[item] || 0) >= count);
      const state = recipeKnown(name) ? (ready ? "✅ Ready to craft" : "📜 Formula known") : `🔒 ${found}/${Object.keys(ingredients).length} ingredients found`;
      print(`  ${state} · ${title(name)}`);
      if (view === "tracking" || !recipeKnown(name)) {
        print(`    Materials: ${Object.entries(ingredients).map(([item, count]) => `${(WORLD.recipeMaterialsSeen || []).includes(item) ? "✅ found" : "▫️ undiscovered"} ${item} (${inventory[item] || 0}/${count})`).join(", ")}`);
        if (!recipeKnown(name)) print(`    ${recipeUnlockHint(name)}`);
      }
    });
    if (view === "tracking") print("\n💡 Track or remove recipes with 'recipes track <name>' and 'recipes untrack <name>'.");
    else print("\n💡 Find every ingredient once to reveal material-based formulas; enemy-taught formulas also need their discovery encounter.");
    return true;
  }
  if (!term) {
    const counts = {};
    Object.keys(recipes).forEach((i) => {
      const c = itemCategory(i);
      counts[c] = (counts[c] || 0) + 1;
    });
    cats = await chooseCategory("Recipe Categories", counts);
    if (!cats) return false;
  } else {
    cats = categoryFilter(term);
    if (!cats) cats = CAT_ORDER;
    else term = "";
  }
  print("\n📜");
  let shown = 0;
  for (const c of cats) {
    const rows = Object.entries(recipes).filter(
      ([i, ing]) =>
        itemCategory(i) === c &&
        recipeKnown(i) && (!term || i.includes(term) || Object.keys(ing).some((g) => g.includes(term)))
    );
    if (!rows.length) continue;
    print(`\n${CAT_EMOJI[c] || "🧰"}`);
    rows.forEach(([i, ing]) => {
      print(`  ${Object.entries(ing).every(([k, n]) => (inventory[k] || 0) >= n) ? "✅" : "▫️"} ${i} (${Object.entries(ing).map(([k, a]) => `${a} ${k}`).join(", ")})`);
    });
    shown += rows.length;
  }
  if (!shown) print("🔎 No recipes match that search.");
  print("\n✅ = ready to craft · ▫️ = materials needed · Hidden formulas appear after you find every ingredient once.");
  print(
    "Filter: 'recipes weapons', 'recipes consumables', 'recipes steel'. 'info <item>' shows details."
  );
  return true;
}
async function craftItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (["locked", "tracking"].includes(choice) || choice.startsWith("track ") || choice.startsWith("untrack ")) return showRecipes(choice);
  if (!choice) {
    if (!(await showRecipes())) return;
    choice = (await input("\nWhat do you want to craft? (e.g. 'sword' or 'potion 5'): "))
      .trim()
      .toLowerCase();
    if (!choice) return;
  }
  for (const e of choice.split(",")) {
    const [i, a] = parseItemAmount(e);
    if (i) craftOne(i, a);
  }
}
async function shop(arg = "") {
  let term = arg.trim().toLowerCase(),
    mode = null;
  if (term === "buy" || term === "sell") {
    mode = term;
    term = "";
  }
  const names = (
    mode === "buy"
      ? Object.keys(SHOP_BUY)
      : mode === "sell"
        ? Object.keys(SHOP_SELL)
        : [...new Set([...Object.keys(SHOP_BUY), ...Object.keys(SHOP_SELL)])]
  ).sort();
  let cats;
  if (term) {
    cats = categoryFilter(term);
    if (!cats) {
      print(`🛍️ '${term}' isn't a shop category. Try consumables, materials, crystals, or monster parts.`);
      return false;
    }
  } else {
    const counts = {};
    names.forEach((n) => {
      const c = itemCategory(n);
      counts[c] = (counts[c] || 0) + 1;
    });
    cats = await chooseCategory("Shop Categories", counts);
    if (!cats) return false;
  }
  print("\n🛍️");
  print(`  ${pad("📦", 24)}${rpad("📥", 6)}${rpad("📤", 7)}`);
  let shown = 0;
  for (const c of cats) {
    const rows = names.filter((n) => itemCategory(n) === c);
    if (!rows.length) continue;
    print(`\n[${c}]`);
    rows.forEach((n) =>
      print(`  ${pad(n, 24)}${rpad(SHOP_BUY[n] || "-", 6)}${rpad(SHOP_SELL[n] || "-", 7)}`)
    );
    shown += rows.length;
  }
  if (!shown) print("Nothing is available in this section.");
  print("\n💰 BUY is your cost; SELL is the merchant's offer. A dash means unavailable.");
  print(`🪙 Your purse: ${inventory.coin || 0} coin.`);
  print("Trade with 'buy <item> [amount]', 'sell <item> [amount]', or 'sell all <item>'.");
  return true;
}
async function buyItem(arg = "") {
  if (!arg.trim()) {
    if (!(await shop("buy"))) return;
    arg = await input("\nBuy what? (e.g. 'potion 2'): ");
    if (!arg.trim()) return;
  }
  const [item, amount] = parseItemAmount(arg);
  if (!item || amount < 1) {
    print("Try 'buy potion 2'.");
    return;
  }
  if (!SHOP_BUY[item]) {
    print(`🛍️ The merchant doesn't carry '${item}'.`);
    return;
  }
  const cost = SHOP_BUY[item] * amount;
  if ((inventory.coin || 0) < cost) {
    print(`🪙 Not enough coin: ${amount} ${item} costs ${cost}.`);
    return;
  }
  removeItem("coin", cost);
  addItem(item, amount);
}
async function sellItem(arg = "") {
  let text = arg.trim().toLowerCase();
  if (!text) {
    const names = groupedNames(
      Object.keys(inventory).filter((n) => inventory[n] > 0 && SHOP_SELL[n])
    );
    if (!names.length) {
      print("🎒 You don't have anything this merchant will buy.");
      return;
    }
    print("\n🪙");
    printNumbered(names, (n) => `${n} x${inventory[n]} - ${SHOP_SELL[n]} coin each`);
    const raw = (await input("\nSell what? (number or name [amount], or 'all <item>'): "))
      .trim()
      .toLowerCase();
    if (!raw) return;
    let w = raw.split(/\s+/),
      prefix = "";
    if (w[0] === "all") {
      prefix = "all ";
      w = w.slice(1);
    }
    if (w.length && isDigit(w[0]) && +w[0] >= 1 && +w[0] <= names.length)
      w = [names[+w[0] - 1], ...w.slice(1)];
    text = (prefix + w.join(" ")).trim();
  }
  const all = text.startsWith("all ");
  if (all) text = text.slice(4);
  let [item, amount] = parseItemAmount(text);
  if (!item || amount < 1) {
    print("Try 'sell bone 3' or 'sell all bone'.");
    return;
  }
  if (!SHOP_SELL[item]) {
    print(`🛍️ The merchant isn't buying '${item}'.`);
    return;
  }
  if (all) amount = inventory[item] || 0;
  if (equipment[ITEMS[item] ? ITEMS[item].id : ""] === item) {
    print(`Unequip your ${item} first.`);
    return;
  }
  if (amount < 1 || (inventory[item] || 0) < amount) {
    print(`You don't have ${amount} ${item}.`);
    return;
  }
  removeItem(item, amount);
  addItem("coin", SHOP_SELL[item] * amount);
}
