/* ShelfLife — kroger.js
   Client for the Kroger lane (proxy/kroger-worker.js). Kroger's public API
   gives true per-store availability and prices, so this is the app's second
   real store — and the first with location-level stock. Locations for the
   user's ZIP and product matches for the nearest store are fetched during
   the compare warm-up and cached so the synchronous optimizer can read them.
   Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const db = g.SL.db;

  const STORES_TTL = 24 * 60 * 60 * 1000; // locations per zip: 24h
  const MATCH_TTL = 6 * 60 * 60 * 1000;   // product matches: 6h

  function proxyUrl() {
    return ((g.SL.config && g.SL.config.krogerProxy) || '').replace(/\/+$/, '');
  }

  function enabled() {
    return !!proxyUrl() && typeof g.fetch === 'function';
  }

  /* nearest cached location for a zip (null until warmed) */
  function locationFor(zip) {
    if (!zip) return null;
    const c = db.gget('krogerStores:' + zip, null);
    return c && c.stores && c.stores.length ? c.stores[0] : null;
  }

  function matchesFor(locationId) {
    const c = db.gget('krogerMatches:' + locationId, null);
    return c && c.matches ? c.matches : {};
  }

  function dataFor(zip, foodId) {
    const loc = locationFor(zip);
    if (!loc) return null;
    return matchesFor(loc.id)[foodId] || null;
  }

  /* Warm locations + product matches for the active list; called before the
     store comparison so isAvailable/priceFor can answer synchronously. */
  async function warm(zip, items) {
    if (!enabled() || !zip) return 0;

    let cached = db.gget('krogerStores:' + zip, null);
    if (!cached || !cached.ts || (Date.now() - cached.ts) > STORES_TTL) {
      const res = await g.fetch(proxyUrl() + '/stores?zip=' + encodeURIComponent(zip));
      if (!res.ok) throw new Error('Kroger locations unavailable (' + res.status + ')');
      cached = { ts: Date.now(), stores: await res.json() };
      db.gset('krogerStores:' + zip, cached);
    }
    const loc = cached.stores && cached.stores[0];
    if (!loc) return 0;

    const store = db.gget('krogerMatches:' + loc.id, { ts: 0, matches: {} });
    const missing = (items || []).filter((it) => {
      const m = store.matches[it.foodId];
      return !m || !m.ts || (Date.now() - m.ts) > MATCH_TTL;
    });
    if (!missing.length) return 0;

    const terms = missing.map((it) => it.foodId + ':' + it.name).join('|');
    const res = await g.fetch(proxyUrl() + '/match?locationId=' + encodeURIComponent(loc.id) + '&terms=' + encodeURIComponent(terms));
    if (!res.ok) throw new Error('Kroger matcher unavailable (' + res.status + ')');
    const found = await res.json();
    let learned = 0;
    Object.entries(found).forEach(([foodId, match]) => {
      if (!match) return;
      store.matches[foodId] = { ...match, ts: Date.now() };
      learned++;
    });
    store.ts = Date.now();
    db.gset('krogerMatches:' + loc.id, store);
    return learned;
  }

  g.SL = g.SL || {};
  g.SL.kroger = { enabled, warm, locationFor, dataFor };
})(typeof window !== 'undefined' ? window : globalThis);
