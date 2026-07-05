/* ShelfLife — data/stores.js
   Simulated grocery ecosystem.

   HONESTY NOTE ------------------------------------------------------------
   Live scraping of Kroger/Safeway/Instacart from a static GitHub Pages site
   is not possible (browser CORS blocks it) and scraping violates most store
   terms of service. Instead this module simulates a realistic set of nearby
   stores, deterministically seeded by ZIP code, so prices, availability and
   weekly deals are stable and comparable — the optimizer, substitutions and
   cart flows are all fully real on top of it.

   To wire real data later, implement the same three functions against a
   real source (e.g. Kroger's official public API behind a small serverless
   proxy) and swap this file. The rest of the app only ever calls:
     nearbyStores(zip) -> [{id, name, tag, dist, fee, delivery}]
     isAvailable(storeId, foodId, zip) -> bool
     priceFor(storeId, food, zip, date) -> {price, deal|null}
   See README "Wiring real store data" for the full recipe.
   ------------------------------------------------------------------------ */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;

  const CHAINS = [
    { id: 'freshmart', name: 'FreshMart', tag: 'Everyday supermarket', mult: 1.00, avail: 0.95, delivery: false },
    { id: 'valuegrocer', name: 'ValueGrocer', tag: 'Discount grocer', mult: 0.86, avail: 0.80, delivery: false },
    { id: 'greenleaf', name: 'GreenLeaf Co-op', tag: 'Organic & local', mult: 1.22, avail: 0.88, delivery: false, produceLove: true },
    { id: 'superhub', name: 'SuperHub', tag: 'Big-box supercenter', mult: 0.92, avail: 0.97, delivery: false },
    { id: 'cornerfresh', name: 'Corner Fresh Market', tag: 'Neighborhood grocer', mult: 1.12, avail: 0.70, delivery: false },
    { id: 'dashcart', name: 'DashCart', tag: 'Delivery \u00b7 from SuperHub, ~1 hr', mult: 1.03, avail: 0.97, delivery: true, fee: 5.99, base: 'superhub' }
  ];
  const chainById = {};
  CHAINS.forEach((c) => { chainById[c.id] = c; });

  /* Category quirks: which store types are weak/strong in which aisles.
     Multiplies the base availability probability. */
  const CAT_BIAS = {
    valuegrocer: { produce: 0.85, protein: 0.9, spice: 0.8 },
    greenleaf: { canned: 0.85, frozen: 0.8 },
    cornerfresh: { frozen: 0.7, canned: 0.85, spice: 0.75, protein: 0.85 },
    superhub: {},
    freshmart: {},
    dashcart: {}
  };

  /* A handful of items a chain simply never carries, for realism. */
  const NEVER = {
    valuegrocer: ['quinoa', 'basil', 'feta'],
    cornerfresh: ['quinoa', 'curry_powder', 'coconut_milk'],
    greenleaf: []
  };

  function effectiveChain(storeId) {
    const c = chainById[storeId];
    return c.base ? { ...chainById[c.base], id: storeId, fee: c.fee, mult: chainById[c.base].mult * c.mult, delivery: true } : c;
  }

  /* ---- which stores exist near this zip ---- */
  function nearbyStores(zip) {
    const z = String(zip || '00000').trim() || '00000';
    const rng = U.rngFor('stores:' + z);
    const physical = CHAINS.filter((c) => !c.delivery);
    // Pick 4–5 physical stores deterministically, always include the delivery option.
    const shuffled = physical
      .map((c) => ({ c, k: rng() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);
    const count = 4 + Math.floor(rng() * 2); // 4 or 5
    const picked = shuffled.slice(0, count);
    const result = picked.map((c) => ({
      id: c.id, name: c.name, tag: c.tag, delivery: false, fee: 0,
      dist: Math.round((0.4 + rng() * 6.2) * 10) / 10
    })).sort((a, b) => a.dist - b.dist);
    const dc = chainById.dashcart;
    result.push({ id: dc.id, name: dc.name, tag: dc.tag, delivery: true, fee: dc.fee, dist: 0 });
    return result;
  }

  /* ---- is a given food stocked at a given store (stable per zip) ---- */
  function isAvailable(storeId, foodId, zip) {
    const chain = effectiveChain(storeId);
    const baseId = chainById[storeId].base || storeId;
    if ((NEVER[baseId] || []).includes(foodId)) return false;
    const food = FOODS.byId(foodId);
    if (!food) return false;
    let p = chain.avail;
    const bias = (CAT_BIAS[baseId] || {})[food.cat];
    if (bias) p *= bias;
    if (chainById[baseId].produceLove && food.cat === 'produce') p = Math.min(0.99, p + 0.08);
    const r = U.rngFor(['avail', baseId, foodId, String(zip || '')].join(':'))();
    return r < p;
  }

  /* ---- weekly deals: a rotating set of discounted foods per store ---- */
  function dealSet(storeId, zip, date) {
    const baseId = chainById[storeId].base || storeId;
    const week = U.isoWeek(date || new Date()) + ':' + (date || new Date()).getFullYear();
    const rng = U.rngFor(['deals', baseId, String(zip || ''), week].join(':'));
    const chain = chainById[baseId];
    const pool = FOODS.list.filter((f) => {
      if (chain.produceLove) return true;
      return true;
    });
    const deals = {};
    const n = 8 + Math.floor(rng() * 5); // 8–12 deals
    let guard = 0;
    while (Object.keys(deals).length < n && guard++ < 200) {
      const f = pool[Math.floor(rng() * pool.length)];
      if (deals[f.id]) continue;
      if (chain.produceLove && f.cat !== 'produce' && rng() < 0.45) continue; // co-op leans produce
      const pct = 0.10 + rng() * 0.20; // 10–30% off
      deals[f.id] = Math.round(pct * 100) / 100;
    }
    return deals;
  }

  /* charm pricing: 3.47 -> 3.49, 3.51 -> 3.49 */
  function charm(n) {
    const dimes = Math.max(0.19, Math.round(n * 10) / 10);
    return Math.round((dimes - 0.01) * 100) / 100;
  }

  /* ---- price of one package of `food` at `storeId` ---- */
  function priceFor(storeId, food, zip, date) {
    const chain = effectiveChain(storeId);
    const baseId = chainById[storeId].base || storeId;
    const jitter = 0.93 + U.rngFor(['price', baseId, food.id, String(zip || '')].join(':'))() * 0.14; // ±7%
    let price = food.price * chain.mult * jitter;
    const deals = dealSet(storeId, zip, date);
    let deal = null;
    if (deals[food.id]) {
      const pct = deals[food.id];
      const was = charm(price);
      price = price * (1 - pct);
      deal = { pct: Math.round(pct * 100), was };
    }
    return { price: charm(price), deal };
  }

  /* ---- full catalog view for one store (for browsing) ---- */
  function catalog(storeId, zip, date) {
    return FOODS.list
      .filter((f) => isAvailable(storeId, f.id, zip))
      .map((f) => ({ food: f, ...priceFor(storeId, f, zip, date) }));
  }

  g.SL = g.SL || {};
  g.SL.stores = { CHAINS, byId: (id) => chainById[id], nearbyStores, isAvailable, priceFor, catalog, dealSet };
})(typeof window !== 'undefined' ? window : globalThis);
