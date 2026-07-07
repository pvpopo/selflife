/* ShelfLife — dev/usda-nutrition.js
   Audits the food catalog's nutrition data against USDA FoodData Central —
   the U.S. government's authoritative, public-domain nutrient database.
   This is how the catalog stays *correct* as it grows: every food's
   per-100g values get checked against lab-analyzed USDA records.

   Usage:
     node dev/usda-nutrition.js                  # audit all foods (DEMO_KEY: ~30/hr rate limit)
     node dev/usda-nutrition.js --food spinach   # audit one food
     USDA_KEY=xxxx node dev/usda-nutrition.js    # your own free key: https://fdc.nal.usda.gov/api-key-signup

   Output: a per-food comparison (catalog vs USDA per-100g) with drift
   flags. Nothing is auto-written — nutrition changes deserve review; apply
   agreed corrections to js/data/foods.js and re-run node dev/validate.js. */
'use strict';
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.USDA_KEY || 'DEMO_KEY';
const BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// FDC nutrient ids → our catalog keys (all per 100 g)
const NUTRIENTS = { 1008: 'cal', 1003: 'p', 1005: 'c', 1004: 'f', 1079: 'fib', 1093: 'na' };
const TOLERANCE = { cal: 0.25, p: 0.30, c: 0.30, f: 0.30, fib: 0.50, na: 0.50 }; // relative drift that triggers a flag

/* load the catalog exactly the way validate.js does */
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
const root = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(root, 'js/util.js'), 'utf8'));
eval(fs.readFileSync(path.join(root, 'js/data/foods.js'), 'utf8'));
const FOODS = globalThis.SL.foods;

async function usdaLookup(query) {
  const url = BASE + '?api_key=' + API_KEY
    + '&query=' + encodeURIComponent(query)
    + '&dataType=' + encodeURIComponent('Foundation,SR Legacy')
    + '&pageSize=3';
  const res = await fetch(url);
  if (res.status === 429) throw new Error('rate-limited — get a free key at fdc.nal.usda.gov/api-key-signup and set USDA_KEY');
  if (!res.ok) throw new Error('USDA ' + res.status);
  const data = await res.json();
  const hit = (data.foods || [])[0];
  if (!hit) return null;
  const out = { fdcId: hit.fdcId, desc: hit.description };
  (hit.foodNutrients || []).forEach((n) => {
    const key = NUTRIENTS[n.nutrientId];
    if (key && typeof n.value === 'number') out[key] = n.value;
  });
  return out;
}

(async () => {
  const only = process.argv.includes('--food') ? process.argv[process.argv.indexOf('--food') + 1] : null;
  const foods = FOODS.list.filter((f) => !only || f.id === only);
  if (!foods.length) { console.error('no such food:', only); process.exit(1); }

  let flagged = 0, checked = 0;
  for (const food of foods) {
    const query = food.usdaQuery || food.name;
    let usda;
    try { usda = await usdaLookup(query); }
    catch (e) { console.error('  ! ' + food.id + ': ' + e.message); if (/rate-limited/.test(e.message)) break; continue; }
    if (!usda) { console.log('  ? ' + food.id + ': no USDA match for "' + query + '"'); continue; }
    checked++;

    const drifts = [];
    Object.entries(NUTRIENTS).forEach(([, key]) => {
      const ours = food.nutr[key];
      const theirs = usda[key];
      if (typeof ours !== 'number' || typeof theirs !== 'number') return;
      const denom = Math.max(Math.abs(theirs), key === 'na' ? 20 : 2); // ignore drift on trace amounts
      const rel = Math.abs(ours - theirs) / denom;
      if (rel > TOLERANCE[key]) drifts.push(key + ': catalog ' + ours + ' vs USDA ' + Math.round(theirs * 10) / 10);
    });

    if (drifts.length) {
      flagged++;
      console.log('⚠ ' + food.id + '  (USDA: "' + usda.desc + '", fdcId ' + usda.fdcId + ')');
      drifts.forEach((d) => console.log('    ' + d));
    } else {
      console.log('✓ ' + food.id + '  matches USDA within tolerance ("' + usda.desc + '")');
    }
    await new Promise((r) => setTimeout(r, 400)); // stay friendly to the API
  }
  console.log('\n' + checked + ' foods checked, ' + flagged + ' flagged for review.');
  console.log('Tip: add usdaQuery: "..." to a food in foods.js when the default name matches the wrong USDA record.');
})();
