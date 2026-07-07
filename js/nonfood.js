/* ShelfLife — nonfood.js
   Not everything on a grocery receipt is food. Unmatched lines that look
   like household goods get classified into a lightweight non-food inventory
   (no expiry pressure, no meal planning — just "what do we have and when
   did we buy it"). Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const db = g.SL.db;

  const KEY = 'nonfood';

  const CATEGORIES = [
    { id: 'cleaning', label: 'Cleaning', emoji: '\u{1F9F9}', kw: ['detergent', 'bleach', 'cleaner', 'clorox', 'lysol', 'dish soap', 'dishsoap', 'sponge', 'wipes', 'disinfect', 'febreze', 'swiffer', 'mop', 'laundry', 'softener', 'dryer sheet', 'tide', 'dawn', 'windex'] },
    { id: 'paper', label: 'Paper & wraps', emoji: '\u{1F9FB}', kw: ['paper towel', 'paper twl', 'towel', 'twl', 'toilet paper', 'bath tissue', 'tissue', 'napkin', 'bounty', 'charmin', 'kleenex', 'scott', 'foil', 'plastic wrap', 'cling', 'parchment', 'ziploc', 'zipper bag', 'trash bag', 'garbage bag', 'paper plate', 'cup pk', 'straw'] },
    { id: 'personal', label: 'Personal care', emoji: '\u{1FA92}', kw: ['shampoo', 'conditioner', 'soap', 'body wash', 'deodorant', 'toothpaste', 'toothbrush', 'floss', 'mouthwash', 'razor', 'shave', 'lotion', 'sunscreen', 'makeup', 'cotton', 'feminine', 'tampon', 'pad ct'] },
    { id: 'health', label: 'Health', emoji: '\u{1F48A}', kw: ['tylenol', 'advil', 'ibuprofen', 'acetaminophen', 'aspirin', 'vitamin', 'supplement', 'medicine', 'cough', 'cold relief', 'allergy', 'antacid', 'band aid', 'bandage', 'first aid', 'thermometer'] },
    { id: 'pet', label: 'Pet', emoji: '\u{1F436}', kw: ['dog', 'cat', 'puppy', 'kitten', 'litter', 'pet food', 'kibble', 'treats pet', 'chew', 'flea'] },
    { id: 'baby', label: 'Baby', emoji: '\u{1F476}', kw: ['diaper', 'baby wipe', 'formula', 'baby food', 'pacifier', 'onesie'] },
    { id: 'kitchen', label: 'Kitchen & home', emoji: '\u{1F3E0}', kw: ['battery', 'batteries', 'bulb', 'light bulb', 'candle', 'matches', 'lighter', 'filter', 'pan', 'utensil', 'container', 'storage', 'hanger', 'tape', 'glue', 'charcoal', 'propane'] },
    { id: 'other', label: 'Other', emoji: '\u{1F4E6}', kw: [] }
  ];
  const catById = {};
  CATEGORIES.forEach((c) => { catById[c.id] = c; });

  /* Guess a category for a receipt line / item name. Returns a category id —
     'other' when nothing matches (every non-food item belongs somewhere). */
  function classify(text) {
    const t = ' ' + U.normalize(text) + ' ';
    let best = 'other', bestHits = 0;
    CATEGORIES.forEach((c) => {
      let hits = 0;
      c.kw.forEach((k) => { if (t.includes(' ' + k + ' ') || t.includes(k)) hits += k.length; });
      if (hits > bestHits) { bestHits = hits; best = c.id; }
    });
    return best;
  }

  /* ---------- the non-food inventory ---------- */
  function items() { return db.get(KEY, []); }
  function save(list) { db.set(KEY, list); }

  function add({ name, cat, qty, purchasedISO, price }) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const item = {
      id: U.uid(),
      name: clean.length > 48 ? clean.slice(0, 48) : clean,
      cat: catById[cat] ? cat : classify(clean),
      qty: qty > 0 ? qty : 1,
      purchasedISO: purchasedISO || U.iso(U.today()),
      price: typeof price === 'number' ? price : null
    };
    const list = items();
    list.push(item);
    save(list);
    return item;
  }

  function update(id, patch) {
    const list = items();
    const item = list.find((x) => x.id === id);
    if (!item) return;
    Object.assign(item, patch);
    save(list);
  }

  function remove(id) { save(items().filter((x) => x.id !== id)); }

  function grouped() {
    const out = {};
    items().forEach((it) => { (out[it.cat] = out[it.cat] || []).push(it); });
    return out;
  }

  g.SL = g.SL || {};
  g.SL.nonfood = { CATEGORIES, byCat: (id) => catById[id] || catById.other, classify, items, add, update, remove, grouped };
})(typeof window !== 'undefined' ? window : globalThis);
