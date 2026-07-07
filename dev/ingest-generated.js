/* ShelfLife — dev/ingest-generated.js
   Ingest a workflow-generated recipe batch: extract the JSON payload from a
   workflow task-output file, apply mechanical fix-ups for the mistakes
   LLM authors make (invented food ids, grams-vs-count mixups), drop
   anything unsalvageable, and write dev/seed-generated.json for the main
   seed pipeline to validate and compile.
   Usage: node dev/ingest-generated.js <task-output-file> */
'use strict';
const fs = require('fs');
const path = require('path');

// load the food catalog for id/unit/gpu checks
const mem = {};
globalThis.localStorage = {
  getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
['js/util.js', 'js/data/foods.js', 'js/data/recipes.js'].forEach((f) => eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
const FOODS = globalThis.SL.foods;

// every id already taken: built-ins + hand-authored seed + prior generated batches
const takenIds = new Set(globalThis.SL.recipes.list.map((r) => r.id));
const seedSrc = fs.readFileSync(path.join(__dirname, 'seed-recipes.js'), 'utf8');
[...seedSrc.matchAll(/id: '([a-z0-9_]+)'/g)].forEach((m) => takenIds.add(m[1]));
const genPath = path.join(__dirname, 'seed-generated.json');
const priorGenerated = fs.existsSync(genPath) ? JSON.parse(fs.readFileSync(genPath, 'utf8')) : [];
priorGenerated.forEach((r) => takenIds.add(r.id));

/* invented id → catalog id (null = delete the ingredient) */
const RENAMES = {
  lentils: 'lentils_dry', red_lentils: 'lentils_dry',
  smoked_paprika: 'paprika',
  tomatoes: 'tomato', red_onion: 'onion', yellow_onion: 'onion', onions: 'onion',
  green_onions: 'scallions', green_onion: 'scallions', spring_onions: 'scallions',
  peas: 'peas_frozen', corn: 'corn_frozen', sweet_corn: 'corn_frozen',
  cannellini_beans: 'white_beans', great_northern_beans: 'white_beans', kidney_beans: 'black_beans',
  diced_tomatoes: 'crushed_tomatoes', tomato_sauce: 'crushed_tomatoes', tomato_puree: 'crushed_tomatoes',
  chicken_stock: 'broth', chicken_broth: 'broth', beef_broth: 'broth', stock: 'broth',
  oat_milk: 'coconut_milk', almond_milk: 'coconut_milk', soy_milk: 'coconut_milk',
  vegetable_oil: 'olive_oil', canola_oil: 'olive_oil', cooking_oil: 'olive_oil',
  bell_peppers: 'bell_pepper', red_bell_pepper: 'bell_pepper', zucchinis: 'zucchini',
  limes: 'lime', lemons: 'lemon', bananas: 'banana', apples: 'apple', avocados: 'avocado',
  greek_yoghurt: 'greek_yogurt', yogurt: 'greek_yogurt',
  whole_wheat_bread: 'bread', sandwich_bread: 'bread', tortilla: 'tortillas',
  brown_rice: 'rice', white_rice: 'rice', jasmine_rice: 'rice', basmati_rice: 'rice',
  pasta: 'penne', rotini: 'penne', fusilli: 'penne', macaroni: 'penne', noodles: 'spaghetti',
  chicken_breasts: 'chicken_breast', chicken_thighs: 'chicken_thigh',
  turkey: 'ground_turkey', beef: 'ground_beef',
  tuna: 'tuna_canned', canned_tuna: 'tuna_canned',
  garbanzo_beans: 'chickpeas', chickpea: 'chickpeas',
  frozen_edamame: 'edamame_frozen', edamame: 'edamame_frozen',
  walnut: 'walnuts', cashew: 'cashews', almond: 'almonds', peanuts: 'almonds',
  kalamata_olives: 'olives', black_olives: 'olives', green_olives: 'olives',
  artichokes: 'artichoke_hearts', roasted_peppers: 'roasted_red_peppers',
  lettuce: 'romaine', iceberg: 'romaine', carrot: 'carrots',
  sweet_potato: 'sweet_potatoes', pork_tenderloin: 'pork_loin', pork: 'pork_loin',
  turkey_breast: 'chicken_breast', ham: 'bacon',
  blueberries: 'berries', strawberries: 'berries', raspberries: 'berries', mixed_berries: 'berries',
  red_wine_vinegar: 'balsamic_vinegar', white_vinegar: 'balsamic_vinegar', rice_vinegar: 'balsamic_vinegar',
  // unmappable → delete the ingredient (steps may still mention it; harmless)
  vegetable_broth: null, vegetable_stock: null, tomato_paste: null,
  chia_seeds: null, nutritional_yeast: null, flax_seeds: null, hemp_seeds: null,
  tahini: null, dijon_mustard: null, mustard: null, mayo: null, mayonnaise: null,
  vanilla: null, vanilla_extract: null, baking_powder: null, baking_soda: null,
  red_pepper_flakes: null, cayenne: null, bay_leaf: null, bay_leaves: null, thyme: null,
  rosemary: null, dill: null, mint: null, water: null, ice: null, capers: null,
  cornstarch: null, raisins: null, dried_cranberries: null, coconut_flakes: null, seeds: null
};

const outputFile = process.argv[2];
if (!outputFile) { console.error('usage: node dev/ingest-generated.js <task-output-file>'); process.exit(1); }
const raw = fs.readFileSync(outputFile, 'utf8');
const wrapper = JSON.parse(raw);
let payload = wrapper.result !== undefined ? wrapper.result : wrapper;
if (typeof payload === 'string') payload = JSON.parse(payload);
if (!payload || !Array.isArray(payload.recipes)) { console.error('no recipes array in result'); process.exit(1); }
console.log('extracted ' + payload.recipes.length + ' recipes from workflow output');

const kept = [], dropped = [], renamedIds = [];
payload.recipes.forEach((r) => {
  const fixedIng = [];
  let salvageable = true;
  (r.ing || []).forEach((ing) => {
    let id = ing.f;
    if (!FOODS.byId(id) && id in RENAMES) {
      const to = RENAMES[id];
      if (to === null) return; // delete ingredient
      // unit conversion when a grams-quantity lands on a ct food
      const target = FOODS.byId(to);
      if (target && target.unit === 'ct' && ing.q > 12 && target.gpu) {
        ing.q = Math.max(0.2, Math.round((ing.q / target.gpu) * 10) / 10);
      }
      id = to;
    }
    const food = FOODS.byId(id);
    if (!food) { salvageable = false; dropped.push(r.id + ' (unknown: ' + ing.f + ')'); return; }
    // grams landing on ct foods straight from the author (no rename)
    if (food.unit === 'ct' && ing.q > 12 && food.gpu) {
      ing.q = Math.max(0.2, Math.round((ing.q / food.gpu) * 10) / 10);
    }
    fixedIng.push({ f: id, q: ing.q });
  });
  if (!salvageable) return;
  // merge duplicate ingredient ids created by renames
  const merged = {};
  fixedIng.forEach((ing) => { merged[ing.f] = (merged[ing.f] || 0) + ing.q; });
  r.ing = Object.entries(merged).map(([f, q]) => ({ f, q: Math.round(q * 10) / 10 }));
  // decode HTML entities the authors occasionally emit
  r.name = String(r.name).replace(/&amp;/g, '&').replace(/&#39;/g, '’');
  // id collisions (vs existing catalog or sibling blocks): auto-suffix
  let id = String(r.id).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  let n = 2;
  while (takenIds.has(id)) { id = r.id + '_' + n; n++; }
  takenIds.add(id);
  if (id !== r.id) renamedIds.push(r.id + ' → ' + id);
  r.id = id;
  kept.push(r);
});

// append to (not replace) any prior generated batches
const combined = priorGenerated.concat(kept);
fs.writeFileSync(genPath, JSON.stringify(combined, null, 1));
console.log('kept ' + kept.length + ' (file now ' + combined.length + '), dropped ' + dropped.length + (dropped.length ? ':\n  ' + [...new Set(dropped)].join('\n  ') : ''));
if (renamedIds.length) console.log('auto-renamed ' + renamedIds.length + ' colliding ids');
