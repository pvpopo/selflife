/* ShelfLife — expiry.js
   Smarter use-by estimates, three layers deep:
   1. Catalog baseline: FoodKeeper-style shelf life per storage (foods.js).
   2. Community consensus: when users correct dates (label scans, manual
      edits), the correction is shared as an anonymous observation
      (food + storage + days lasted — no user data) via Supabase. Once 3+
      observations exist, the median replaces the catalog guess for
      everyone — "Walmart milk really lasts X days" learned over time.
   3. The label itself: parseDate() reads a photographed best-by date
      (OCR text in, ISO date out) — always the most authoritative source.
   Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;
  const db = g.SL.db;

  const CONSENSUS_KEY = 'shelfConsensus';
  const CONSENSUS_TTL = 24 * 60 * 60 * 1000;
  const MIN_OBSERVATIONS = 3;

  /* ---------- estimates ---------- */
  function estimateDays(food, storage) {
    const c = db.gget(CONSENSUS_KEY, null);
    if (c && c.map) {
      const e = c.map[food.id + ':' + storage];
      if (e && e.n >= MIN_OBSERVATIONS && e.days > 0) return e.days;
    }
    return FOODS.shelfDays(food, storage);
  }

  /* which layer produced the estimate — shown in the UI for honesty */
  function estimateSource(food, storage) {
    const c = db.gget(CONSENSUS_KEY, null);
    if (c && c.map) {
      const e = c.map[food.id + ':' + storage];
      if (e && e.n >= MIN_OBSERVATIONS && e.days > 0) return { kind: 'community', n: e.n };
    }
    return { kind: 'catalog' };
  }

  /* ---------- community consensus sync (needs cloud sign-in) ---------- */
  async function refreshConsensus() {
    const auth = g.SL.auth;
    if (!auth || !auth.supabaseClient) return;
    const cached = db.gget(CONSENSUS_KEY, null);
    if (cached && cached.ts && (Date.now() - cached.ts) < CONSENSUS_TTL) return;
    try {
      const client = await auth.supabaseClient();
      if (!client) return;
      const { data, error } = await client.from('shelf_consensus').select('food_id, storage, n, days');
      if (error || !data) return;
      const map = {};
      data.forEach((r) => { map[r.food_id + ':' + r.storage] = { n: r.n, days: r.days }; });
      db.gset(CONSENSUS_KEY, { ts: Date.now(), map });
    } catch (e) { /* offline or table not created yet — baseline still works */ }
  }

  /* Share one anonymous observation: this food, stored this way, was good
     for N days after purchase. Fires when a user corrects a date. */
  async function recordObservation(foodId, storage, days) {
    if (!(days >= 0 && days <= 365)) return false;
    const auth = g.SL.auth;
    if (!auth || !auth.supabaseClient || !auth.cloudUserId || !auth.cloudUserId()) return false;
    try {
      const client = await auth.supabaseClient();
      if (!client) return false;
      const { error } = await client.from('shelf_observations').insert({
        food_id: foodId, storage, days: Math.round(days), user_id: auth.cloudUserId()
      });
      return !error;
    } catch (e) { return false; }
  }

  /* ---------- date parsing (label photos & receipt headers) ---------- */
  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };
  const DATE_HINT = /\b(best|use|sell|exp|expires?|enjoy|freshest|bb|by)\b/i;

  function makeISO(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const date = new Date(y, m - 1, d);
    if (date.getMonth() !== m - 1 || date.getDate() !== d) return null; // e.g. Feb 30
    return U.iso(date);
  }

  function fixYear(y, m, d, minISO, maxISO) {
    // no year on the label ("BEST BY 08/15"): pick the year that lands in window
    for (const year of [new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() - 1]) {
      const iso = makeISO(year, m, d);
      if (iso && iso >= minISO && iso <= maxISO) return iso;
    }
    return null;
  }

  function expandYear(y) {
    if (y >= 100) return y;
    return y + (y < 70 ? 2000 : 1900);
  }

  /* Find the most plausible date in OCR text.
     mode 'label'   → best-by dates: window today−60d .. today+3y
     mode 'receipt' → purchase dates: window today−120d .. today */
  function parseDate(text, mode) {
    const today = U.today();
    const minISO = U.iso(U.addDays(today, mode === 'receipt' ? -120 : -60));
    const maxISO = mode === 'receipt' ? U.iso(today) : U.iso(U.addDays(today, 365 * 3));

    const candidates = [];
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach((line) => {
      const hint = DATE_HINT.test(line) ? 2 : 0;
      let m;

      // 2026-08-15 / 2026/8/15
      const reYMD = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g;
      while ((m = reYMD.exec(line))) {
        const iso = makeISO(+m[1], +m[2], +m[3]);
        if (iso) candidates.push({ iso, score: 3 + hint });
      }
      // 08/15/26, 8-15-2026 (US month-first)
      const reMDY = /(?<![\d/.-])(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?![\d/.-])/g;
      while ((m = reMDY.exec(line))) {
        const iso = makeISO(expandYear(+m[3]), +m[1], +m[2]);
        if (iso) candidates.push({ iso, score: 2 + hint });
      }
      // AUG 15 2026 / AUG 15 / SEP. 3, 26
      const reMonDay = /([A-Za-z]{3,9})\s*\.?\s*(\d{1,2})(?:\s*[,.]?\s*(\d{2,4}))?/g;
      while ((m = reMonDay.exec(line))) {
        const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()];
        if (!mon) continue;
        const iso = m[3] ? makeISO(expandYear(+m[3]), mon, +m[2]) : fixYear(null, mon, +m[2], minISO, maxISO);
        if (iso) candidates.push({ iso, score: 2 + hint });
      }
      // 15 AUG 2026 / 15AUG26
      const reDayMon = /(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{2,4})?/g;
      while ((m = reDayMon.exec(line))) {
        const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()];
        if (!mon) continue;
        const iso = m[3] ? makeISO(expandYear(+m[3]), mon, +m[1]) : fixYear(null, mon, +m[1], minISO, maxISO);
        if (iso) candidates.push({ iso, score: 2 + hint });
      }
    });

    const inWindow = candidates.filter((c) => c.iso >= minISO && c.iso <= maxISO);
    if (!inWindow.length) return null;
    inWindow.sort((a, b) => (b.score - a.score)
      || (mode === 'receipt' ? (b.iso < a.iso ? -1 : 1) : (a.iso < b.iso ? -1 : 1)));
    return inWindow[0].iso;
  }

  g.SL = g.SL || {};
  g.SL.expiry = { estimateDays, estimateSource, refreshConsensus, recordObservation, parseDate, MIN_OBSERVATIONS };
})(typeof window !== 'undefined' ? window : globalThis);
