/* ShelfLife — cartlink.js
   One-click real-store carts, no AI required. Walmart supports cart
   deep-links: opening
     https://affil.walmart.com/cart/addToCart?items=<itemId>_<qty>,<itemId>...
   in the user's browser puts those products straight into their walmart.com
   cart (their own session — ShelfLife never touches their account or
   payment; they review and check out on Walmart).

   The link needs Walmart item IDs. Three tiers, best available wins:
     1. Automatic: when js/config.js has a walmartProxy URL (the ~80-line
        Cloudflare Worker in proxy/walmart-worker.js), unknown foods are
        matched to Walmart products at runtime and cached — the whole cart
        becomes one tap.
     2. Hand-mapped: entries in WALMART_IDS below (the digits at the end of
        a walmart.com product URL).
     3. Fallback: anything unresolved gets a per-item Walmart search link.
   Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const db = g.SL.db;

  /* foodId → Walmart item ID (the number at the end of a product URL,
     e.g. walmart.com/ip/Chicken-Breast/27935840 → '27935840').
     Hand-mapped entries take precedence over proxy matches. */
  const WALMART_IDS = {
    // chicken_breast: '27935840',
  };

  const CART_BASE = 'https://affil.walmart.com/cart/addToCart?items=';
  const SEARCH_BASE = 'https://www.walmart.com/search?q=';
  const CACHE_KEY = 'walmartIds'; // global cache — product ids aren't personal data

  function proxyUrl() {
    return ((g.SL.config && g.SL.config.walmartProxy) || '').replace(/\/+$/, '');
  }

  /* Full match data for a food: { id, price?, available?, name? }.
     Hand-mapped ids win; cached proxy matches (with live walmart.com price
     and availability) come next. Accepts legacy string entries. */
  function dataFor(foodId) {
    if (WALMART_IDS[foodId]) return { id: WALMART_IDS[foodId] };
    const e = db.gget(CACHE_KEY, {})[foodId];
    if (!e) return null;
    return typeof e === 'string' ? { id: e } : e;
  }

  function idFor(foodId) {
    const e = dataFor(foodId);
    return e && e.id ? e.id : null;
  }

  /* Split the items: which get the one-click cart, which need a search tap. */
  function splitItems(items) {
    const mapped = [], unmapped = [];
    items.forEach((it) => {
      if (idFor(it.foodId)) mapped.push(it);
      else unmapped.push(it);
    });
    return { mapped, unmapped };
  }

  /* One URL that fills the Walmart cart with every resolvable item. */
  function cartUrl(items) {
    const { mapped } = splitItems(items);
    if (!mapped.length) return null;
    return CART_BASE + mapped
      .map((it) => idFor(it.foodId) + (it.qty > 1 ? '_' + it.qty : ''))
      .join(',');
  }

  function searchUrl(name) {
    return SEARCH_BASE + encodeURIComponent(name);
  }

  /* ---- automatic matching via the proxy (see proxy/walmart-worker.js) ---- */
  function canResolve() {
    return !!proxyUrl() && typeof g.fetch === 'function';
  }

  /* Ask the proxy to match unknown (or stale-priced) foods to Walmart
     products. Returns how many matches were learned/refreshed; results
     persist in the cache so the store comparison can read them sync. */
  const FRESH_MS = 6 * 60 * 60 * 1000; // re-check prices after 6h

  async function resolveIds(items) {
    if (!canResolve()) return 0;
    const cached = db.gget(CACHE_KEY, {});
    const missing = items.filter((it) => {
      if (WALMART_IDS[it.foodId]) return false;
      const e = cached[it.foodId];
      if (!e) return true;
      if (typeof e === 'string') return true; // legacy entry: upgrade to live data
      return !e.ts || (Date.now() - e.ts) > FRESH_MS;
    });
    if (!missing.length) return 0;
    const terms = missing.map((it) => it.foodId + ':' + it.name).join('|');
    const res = await g.fetch(proxyUrl() + '/ids?terms=' + encodeURIComponent(terms));
    if (!res.ok) throw new Error('Product matcher unavailable (' + res.status + ') — using search links instead.');
    const found = await res.json();
    let learned = 0;
    Object.entries(found).forEach(([foodId, match]) => {
      if (!match) return;
      cached[foodId] = typeof match === 'string'
        ? { id: match, ts: Date.now() }
        : { ...match, id: String(match.id), ts: Date.now() };
      learned++;
    });
    if (learned) db.gset(CACHE_KEY, cached);
    return learned;
  }

  g.SL = g.SL || {};
  g.SL.cartlink = { WALMART_IDS, splitItems, cartUrl, searchUrl, canResolve, resolveIds, idFor, dataFor };
})(typeof window !== 'undefined' ? window : globalThis);
