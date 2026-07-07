/* ShelfLife — inventory.js
   The pantry: what you own, where it's stored, and a *rough estimate* of
   when it will turn. Estimated dates drive the meal planner's use-it-up
   scoring and shrink the shopping list — they are never presented as
   safety guarantees (see DISCLAIMER, shown prominently in the UI). */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;
  const db = g.SL.db;

  const KEY = 'inventory';

  const DISCLAIMER =
    'Expiration dates here are guesstimates based on typical shelf life \u2014 not safety guarantees. ' +
    'Storage conditions vary a lot. Before eating anything, use your own judgment: check smell, taste, ' +
    'color, and texture for signs of spoilage, and when in doubt, throw it out.';

  function items() { return db.get(KEY, []); }
  function save(list) { db.set(KEY, list); }

  function computeExpiry(foodId, storage, purchasedISO) {
    const food = FOODS.byId(foodId);
    // community consensus (label-scan corrections) overrides the catalog
    // baseline once enough observations exist — see expiry.js
    const days = g.SL.expiry ? g.SL.expiry.estimateDays(food, storage) : FOODS.shelfDays(food, storage);
    return U.iso(U.addDays(U.parseISO(purchasedISO), days));
  }

  function add({ foodId, qty, storage, purchasedISO, expiresISO, source, note }) {
    const food = FOODS.byId(foodId);
    if (!food || !(qty > 0)) return null;
    const st = storage || food.storage;
    const bought = purchasedISO || U.iso(U.today());
    const item = {
      id: U.uid(),
      foodId,
      qty,
      storage: st,
      purchasedISO: bought,
      expiresISO: expiresISO || computeExpiry(foodId, st, bought),
      source: source || 'manual',
      note: note || ''
    };
    const list = items();
    list.push(item);
    save(list);
    return item;
  }

  /* lines: [{foodId, packages, storage?, purchasedISO?}] — used by the cart
     "purchased" flow and by confirmed receipt scans. Quantity = packages ×
     package size; a receipt's printed date becomes the purchase date so
     estimates count from the day it was actually bought. */
  function addPurchases(lines, source, purchasedISO) {
    const added = [];
    lines.forEach((line) => {
      const food = FOODS.byId(line.foodId);
      if (!food || !(line.packages > 0)) return;
      added.push(add({
        foodId: line.foodId,
        qty: line.packages * food.pkg.qty,
        storage: line.storage || food.storage,
        purchasedISO: line.purchasedISO || purchasedISO,
        source: source || 'purchase'
      }));
    });
    return added.filter(Boolean);
  }

  function update(id, patch) {
    const list = items();
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const before = item.storage;
    Object.assign(item, patch);
    // Moving storage re-estimates the date from today (e.g. fridge -> freezer).
    if (patch.storage && patch.storage !== before && !patch.expiresISO) {
      const remainingBase = U.iso(U.today());
      item.expiresISO = computeExpiry(item.foodId, patch.storage, remainingBase);
    }
    save(list);
  }

  function remove(id) { save(items().filter((x) => x.id !== id)); }

  function status(item) {
    const days = U.daysLeft(item.expiresISO);
    let level = 'fresh';
    if (days < 0) level = 'past';
    else if (days <= 1) level = 'urgent';
    else if (days <= 4) level = 'soon';
    return { days, level };
  }

  /* Total usable (not past estimated date) quantity of a food, in its unit. */
  function usableQty(foodId) {
    return U.sum(
      items().filter((x) => x.foodId === foodId && U.daysLeft(x.expiresISO) >= 0),
      (x) => x.qty
    );
  }

  /* Soonest days-left among usable stock of a food (Infinity if none). */
  function soonestDays(foodId) {
    const usable = items().filter((x) => x.foodId === foodId && U.daysLeft(x.expiresISO) >= 0);
    if (!usable.length) return Infinity;
    return Math.min(...usable.map((x) => U.daysLeft(x.expiresISO)));
  }

  function expiringSoon(withinDays) {
    const horizon = withinDays == null ? 4 : withinDays;
    return items()
      .map((x) => ({ item: x, ...status(x) }))
      .filter((x) => x.days >= 0 && x.days <= horizon)
      .sort((a, b) => a.days - b.days);
  }

  function pastEstimate() {
    return items()
      .map((x) => ({ item: x, ...status(x) }))
      .filter((x) => x.level === 'past')
      .sort((a, b) => a.days - b.days);
  }

  /* FIFO-consume qty of a food (soonest-expiring first). Returns qty consumed. */
  function consume(foodId, qty) {
    let remaining = qty;
    const list = items()
      .slice()
      .sort((a, b) => (a.expiresISO < b.expiresISO ? -1 : 1));
    for (const item of list) {
      if (remaining <= 0) break;
      if (item.foodId !== foodId) continue;
      if (U.daysLeft(item.expiresISO) < 0) continue;
      const take = Math.min(item.qty, remaining);
      item.qty -= take;
      remaining -= take;
    }
    save(list.filter((x) => x.qty > 0.01));
    return qty - remaining;
  }

  /* Deduct a cooked recipe's ingredients (scaled) from stock. */
  function consumeRecipe(recipe, servings) {
    const scale = (servings || recipe.servings) / recipe.servings;
    const consumed = [];
    recipe.ing.forEach((ing) => {
      const took = consume(ing.f, ing.q * scale);
      if (took > 0) consumed.push({ foodId: ing.f, qty: took });
    });
    return consumed;
  }

  function grouped() {
    const by = { fridge: [], freezer: [], pantry: [] };
    items().forEach((x) => { (by[x.storage] || by.pantry).push(x); });
    Object.values(by).forEach((arr) => arr.sort((a, b) => (a.expiresISO < b.expiresISO ? -1 : 1)));
    return by;
  }

  function loadSample() {
    const today = U.iso(U.today());
    const back = (d) => U.iso(U.addDays(U.today(), -d));
    const demo = [
      { foodId: 'chicken_breast', qty: 900, storage: 'fridge', purchasedISO: back(1) },
      { foodId: 'spinach', qty: 142, storage: 'fridge', purchasedISO: back(3) },
      { foodId: 'eggs', qty: 8, storage: 'fridge', purchasedISO: back(10) },
      { foodId: 'greek_yogurt', qty: 600, storage: 'fridge', purchasedISO: back(6) },
      { foodId: 'bell_pepper', qty: 2, storage: 'fridge', purchasedISO: back(7) },
      { foodId: 'rice', qty: 700, storage: 'pantry', purchasedISO: back(30) },
      { foodId: 'black_beans', qty: 500, storage: 'pantry', purchasedISO: back(60) },
      { foodId: 'crushed_tomatoes', qty: 794, storage: 'pantry', purchasedISO: back(20) },
      { foodId: 'onion', qty: 3, storage: 'pantry', purchasedISO: back(12) },
      { foodId: 'garlic', qty: 8, storage: 'pantry', purchasedISO: back(15) },
      { foodId: 'tortillas', qty: 8, storage: 'pantry', purchasedISO: back(4) },
      { foodId: 'olive_oil', qty: 600, storage: 'pantry', purchasedISO: back(90) },
      { foodId: 'berries', qty: 300, storage: 'fridge', purchasedISO: back(2) },
      { foodId: 'peas_frozen', qty: 454, storage: 'freezer', purchasedISO: back(45) },
      { foodId: 'salt', qty: 700, storage: 'pantry', purchasedISO: back(100) },
      { foodId: 'black_pepper', qty: 50, storage: 'pantry', purchasedISO: back(100) },
      { foodId: 'cumin', qty: 40, storage: 'pantry', purchasedISO: back(80) },
      { foodId: 'oats', qty: 400, storage: 'pantry', purchasedISO: back(25) }
    ];
    demo.forEach((d) => add({ ...d, source: 'sample' }));
    return demo.length;
  }

  g.SL = g.SL || {};
  g.SL.inventory = {
    DISCLAIMER, items, add, addPurchases, update, remove, status,
    usableQty, soonestDays, expiringSoon, pastEstimate,
    consume, consumeRecipe, grouped, computeExpiry, loadSample
  };
})(typeof window !== 'undefined' ? window : globalThis);
