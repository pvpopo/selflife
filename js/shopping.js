/* ShelfLife — shopping.js
   From plan to cart:
   1) buildList()  — aggregate what the plan needs, subtract usable pantry
                     stock, convert the remainder to store packages.
   2) optimize()   — price the list at every nearby store, allowing listed
                     substitutes when an item is out of stock, and rank the
                     best single store and the best two-store split.
   3) purchase()   — move the chosen cart into the pantry with estimated
                     expiration dates.

   Prices/availability come from stores.js (simulated, zip-seeded — see the
   honesty note there and in the README). */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;
  const RECIPES = g.SL.recipes;
  const STORES = g.SL.stores;
  const inv = g.SL.inventory;
  const planner = g.SL.planner;
  const db = g.SL.db;

  const LIST_KEY = 'shoppingList';
  const HISTORY_KEY = 'purchaseHistory';

  /* ---------- build the list from the current plan ---------- */
  function aggregateNeeds(plan, p) {
    const needs = {}; // foodId -> qty in food units
    if (!plan) return needs;
    plan.days.forEach((day) => {
      Object.values(day.slots).forEach((slotEntry) => {
        if (!slotEntry || slotEntry.cooked) return;
        const recipe = RECIPES.byId(slotEntry.recipeId);
        if (!recipe) return;
        const scale = p.servings / recipe.servings;
        recipe.ing.forEach((ing) => {
          needs[ing.f] = (needs[ing.f] || 0) + ing.q * scale;
        });
      });
    });
    return needs;
  }

  function buildList() {
    const p = planner.prefs();
    const plan = planner.current();
    const needs = aggregateNeeds(plan, p);
    const lines = [];
    const staples = [];

    let covered = 0; // foods the pantry fully takes care of
    Object.entries(needs).forEach(([foodId, needQty]) => {
      const food = FOODS.byId(foodId);
      if (!food) return;
      const haveQty = inv.usableQty(foodId);
      const buyQty = Math.max(0, needQty - haveQty);
      const line = {
        foodId,
        needQty: Math.round(needQty * 10) / 10,
        haveQty: Math.round(Math.min(haveQty, needQty) * 10) / 10,
        buyQty: Math.round(buyQty * 10) / 10,
        packages: buyQty > 0 ? Math.ceil(buyQty / food.pkg.qty - 0.02) : 0,
        checked: true
      };
      if (line.packages <= 0) { if (!food.staple) covered++; return; } // pantry covers it
      if (food.staple) { line.checked = false; staples.push(line); }
      else lines.push(line);
    });

    const sortKey = (l) => FOODS.CAT_ORDER.indexOf(FOODS.byId(l.foodId).cat) * 1000 + FOODS.byId(l.foodId).name.charCodeAt(0);
    lines.sort((a, b) => sortKey(a) - sortKey(b));
    staples.sort((a, b) => sortKey(a) - sortKey(b));

    const list = { generatedISO: new Date().toISOString(), planId: plan ? plan.id : null, lines, staples, extras: [], covered };
    db.set(LIST_KEY, list);
    return list;
  }

  /* Rebuild from the (possibly changed) plan while keeping what the shopper
     already decided: their added extras and their checked/unchecked choices. */
  function rebuildList() {
    const prev = currentList();
    const fresh = buildList();
    if (prev) {
      fresh.extras = prev.extras || [];
      const chosen = {};
      [...(prev.lines || []), ...(prev.staples || [])].forEach((l) => { chosen[l.foodId] = l.checked; });
      [...fresh.lines, ...fresh.staples].forEach((l) => { if (l.foodId in chosen) l.checked = chosen[l.foodId]; });
      saveList(fresh);
    }
    return fresh;
  }

  function currentList() { return db.get(LIST_KEY, null); }
  function saveList(list) { db.set(LIST_KEY, list); }

  function addExtra(foodId, packages) {
    const list = currentList() || buildList();
    const existing = list.extras.find((x) => x.foodId === foodId);
    if (existing) existing.packages += packages;
    else list.extras.push({ foodId, packages, checked: true, extra: true });
    saveList(list);
    return list;
  }

  /* every line the shopper actually intends to buy */
  function activeLines(list) {
    return [...list.lines, ...list.staples, ...list.extras].filter((l) => l.checked && l.packages > 0);
  }

  /* ---------- store optimization ---------- */
  function quoteAt(storeId, line, zip, date) {
    const food = FOODS.byId(line.foodId);
    if (STORES.isAvailable(storeId, food.id, zip)) {
      const q = STORES.priceFor(storeId, food, zip, date);
      return { foodId: food.id, boughtAs: food.id, packages: line.packages, unit: q.price, deal: q.deal, cost: q.price * line.packages, sub: false };
    }
    // try substitutes in listed order
    for (const subId of (food.subs || [])) {
      if (STORES.isAvailable(storeId, subId, zip)) {
        const subFood = FOODS.byId(subId);
        const q = STORES.priceFor(storeId, subFood, zip, date);
        // repackage: same needed quantity, sub's package size
        const pkgs = Math.max(1, Math.ceil((line.packages * food.pkg.qty) / subFood.pkg.qty - 0.02));
        return { foodId: food.id, boughtAs: subId, packages: pkgs, unit: q.price, deal: q.deal, cost: q.price * pkgs, sub: true };
      }
    }
    return null; // not coverable here
  }

  function priceStore(store, lines, zip, date) {
    const quotes = [];
    const missing = [];
    lines.forEach((line) => {
      const q = quoteAt(store.id, line, zip, date);
      if (q) quotes.push({ ...q, storeId: store.id });
      else missing.push(line.foodId);
    });
    const items = U.sum(quotes, (q) => q.cost);
    return {
      stores: [store],
      quotes, missing,
      coverage: lines.length ? quotes.length / lines.length : 1,
      itemsCost: items,
      fee: store.fee || 0,
      total: items + (store.fee || 0)
    };
  }

  function pricePair(a, b, lines, zip, date) {
    const quotes = [];
    const missing = [];
    lines.forEach((line) => {
      const qa = quoteAt(a.id, line, zip, date);
      const qb = quoteAt(b.id, line, zip, date);
      let pick = null;
      if (qa && qb) pick = (qa.sub === qb.sub) ? (qa.cost <= qb.cost ? { ...qa, storeId: a.id } : { ...qb, storeId: b.id })
        : (qa.sub ? { ...qb, storeId: b.id } : { ...qa, storeId: a.id }); // prefer the real item over a sub
      else if (qa) pick = { ...qa, storeId: a.id };
      else if (qb) pick = { ...qb, storeId: b.id };
      if (pick) quotes.push(pick);
      else missing.push(line.foodId);
    });
    // If one store ended up unused, this collapses to a single-store option; skip.
    const usedIds = new Set(quotes.map((q) => q.storeId));
    if (usedIds.size < 2) return null;
    const items = U.sum(quotes, (q) => q.cost);
    const fee = (a.fee || 0) + (b.fee || 0);
    return {
      stores: [a, b], quotes, missing,
      coverage: lines.length ? quotes.length / lines.length : 1,
      itemsCost: items, fee, total: items + fee
    };
  }

  function optimize() {
    const p = planner.prefs();
    const zip = p.zip || '';
    const date = new Date();
    const list = currentList() || buildList();
    const lines = activeLines(list);
    const nearby = STORES.nearbyStores(zip);

    if (!lines.length) return { lines, nearby, singles: [], pairs: [], best: null };

    const singles = nearby.map((s) => priceStore(s, lines, zip, date))
      .sort((x, y) => (y.coverage - x.coverage) || (x.total - y.total));

    const pairs = [];
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        const combo = pricePair(nearby[i], nearby[j], lines, zip, date);
        if (combo) pairs.push(combo);
      }
    }
    pairs.sort((x, y) => (y.coverage - x.coverage) || (x.total - y.total));

    // Best plan overall, honoring the "one or two stores max" idea:
    // a second stop has to be meaningfully worth it.
    const bestSingle = singles[0] || null;
    const bestPair = pairs[0] || null;
    let best = bestSingle;
    if (bestPair && bestSingle) {
      const coversMore = bestPair.coverage > bestSingle.coverage + 0.001;
      const savesEnough = bestSingle.total - bestPair.total >= Math.max(4, bestSingle.total * 0.06);
      if (coversMore || savesEnough) best = bestPair;
    } else if (bestPair && !bestSingle) best = bestPair;

    const avgSingle = singles.length ? U.sum(singles, (s) => s.total) / singles.length : 0;
    return { lines, nearby, singles: singles.slice(0, 5), pairs: pairs.slice(0, 5), best, avgSingle };
  }

  /* ---------- cart & purchase ---------- */
  function setCart(option) {
    db.set('cart', {
      storeIds: option.stores.map((s) => s.id),
      storeNames: option.stores.map((s) => s.name),
      fee: option.fee,
      quotes: option.quotes,
      missing: option.missing,
      total: option.total,
      createdISO: new Date().toISOString()
    });
  }
  function cart() { return db.get('cart', null); }
  function clearCart() { db.del('cart'); }

  /* Mark the cart purchased: quantities land in the pantry with estimated dates. */
  function purchase(storageOverrides) {
    const c = cart();
    if (!c) return [];
    const lines = c.quotes.map((q) => ({
      foodId: q.boughtAs,
      packages: q.packages,
      storage: (storageOverrides && storageOverrides[q.boughtAs]) || undefined
    }));
    const added = inv.addPurchases(lines, 'purchase');
    const history = db.get(HISTORY_KEY, []);
    history.unshift({
      iso: new Date().toISOString(),
      stores: c.storeNames,
      total: c.total,
      items: c.quotes.length
    });
    db.set(HISTORY_KEY, history.slice(0, 30));
    clearCart();
    // Un-check purchased lines on the list so it reflects reality.
    const list = currentList();
    if (list) {
      const bought = new Set(c.quotes.map((q) => q.foodId));
      [...list.lines, ...list.staples, ...list.extras].forEach((l) => { if (bought.has(l.foodId)) l.checked = false; });
      saveList(list);
    }
    return added;
  }

  function history() { return db.get(HISTORY_KEY, []); }

  g.SL = g.SL || {};
  g.SL.shopping = {
    buildList, rebuildList, currentList, saveList, addExtra, activeLines,
    optimize, setCart, cart, clearCart, purchase, history
  };
})(typeof window !== 'undefined' ? window : globalThis);
