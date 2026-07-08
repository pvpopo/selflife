/* ShelfLife — dev/audit-recipes.js
   Quality audit over the full recipe corpus: finds recipes whose NAME
   promises an ingredient their list doesn't deliver ("Lemon Herb Chicken"
   with no herb), so a repair pass can enrich them from the expanded
   catalog. Prints a report and writes dev/audit-flagged.json. */
'use strict';
const fs = require('fs');
const path = require('path');
const mem = {};
globalThis.localStorage = {
  getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
['js/util.js', 'js/data/foods.js', 'js/data/recipes.js'].forEach((f) => eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));

/* name token → any of these ingredient ids satisfies the promise */
const PROMISES = {
  herb: ['basil', 'oregano', 'thyme', 'rosemary', 'italian_seasoning', 'parsley', 'dill', 'mint', 'cilantro', 'chives'],
  herbed: 'herb', herbs: 'herb',
  basil: ['basil'], cilantro: ['cilantro'], parsley: ['parsley'], dill: ['dill'], mint: ['mint'],
  thyme: ['thyme'], rosemary: ['rosemary'],
  lemon: ['lemon'], lemony: 'lemon', lime: ['lime'], orange: ['oranges'],
  garlic: ['garlic', 'garlic_powder'], garlicky: 'garlic',
  ginger: ['ginger'], gingery: 'ginger',
  honey: ['honey'], maple: ['maple_syrup'],
  sesame: ['sesame_oil', 'tahini'],
  peanut: ['peanut_butter'], walnut: ['walnuts'], cashew: ['cashews'], almond: ['almonds', 'almond_milk'],
  bacon: ['bacon'], mushroom: ['mushrooms'], mushrooms: 'mushroom',
  spinach: ['spinach'], kale: ['kale'], arugula: ['arugula'],
  tomato: ['tomato', 'cherry_tomatoes', 'crushed_tomatoes', 'diced_tomatoes', 'tomato_paste', 'salsa'],
  cheese: ['cheddar', 'mozzarella', 'parmesan', 'feta', 'ricotta', 'cottage_cheese', 'goat_cheese', 'cream_cheese', 'vegan_cheddar_shreds', 'vegan_mozzarella_shreds', 'vegan_feta', 'vegan_ricotta'],
  cheesy: 'cheese', feta: ['feta', 'vegan_feta'], ricotta: ['ricotta', 'vegan_ricotta'],
  parmesan: ['parmesan', 'nutritional_yeast'],
  yogurt: ['greek_yogurt', 'plant_yogurt'],
  coconut: ['coconut_milk'],
  curry: ['curry_powder', 'garam_masala'], curried: 'curry',
  cumin: ['cumin'], paprika: ['paprika'], smoky: ['paprika', 'chili_powder', 'bacon'],
  balsamic: ['balsamic_vinegar'],
  avocado: ['avocado'], olive: ['olives'],
  spicy: ['chili_powder', 'red_pepper_flakes', 'cayenne', 'hot_sauce', 'jalapeno', 'salsa', 'curry_powder'],
  chili: ['chili_powder', 'red_pepper_flakes', 'jalapeno', 'cayenne'],
  turmeric: ['turmeric'], tandoori: ['garam_masala', 'turmeric'],
  buttery: ['butter', 'vegan_butter'], butter: ['butter', 'vegan_butter', 'peanut_butter'],
  creamy: ['heavy_cream', 'coconut_milk', 'sour_cream', 'greek_yogurt', 'ricotta', 'cream_cheese', 'milk', 'cottage_cheese', 'plant_yogurt', 'vegan_ricotta', 'butter', 'tahini', 'avocado', 'cashews', 'peanut_butter', 'mayonnaise', 'hummus', 'oat_milk', 'mozzarella', 'cheddar', 'parmesan', 'oats'],
  eggplant: ['eggplant'], zucchini: ['zucchini'], cauliflower: ['cauliflower'],
  edamame: ['edamame_frozen'], artichoke: ['artichoke_hearts'],
  corn: ['corn_frozen', 'corn_tortillas'],
  apple: ['apple'], banana: ['banana'], berry: ['berries', 'strawberries', 'blueberries'],
  cinnamon: ['cinnamon'], oregano: ['oregano', 'italian_seasoning']
};

/* recipe sources: hand-authored seed + generated + built-ins */
const SL = globalThis.SL;
const seedSrc = fs.readFileSync(path.join(__dirname, 'seed-recipes.js'), 'utf8');
const seedDocs = [];
// crude but reliable: reuse the seed file itself by evaluating its SEED array
const seedMatch = seedSrc.indexOf('const SEED = [');
if (seedMatch >= 0) {
  const genPath = path.join(__dirname, 'seed-generated.json');
  const generated = fs.existsSync(genPath) ? JSON.parse(fs.readFileSync(genPath, 'utf8')) : [];
  // evaluate seed-recipes.js in a sandbox that stubs fs writes
  const sandboxSrc = seedSrc
    .slice(0, seedSrc.indexOf('/* =================================================================== */'))
    .replace(/^'use strict';/m, '');
  eval(sandboxSrc + '\nglobalThis.__SEED = SEED;');
  globalThis.__SEED.forEach((r) => seedDocs.push({ src: 'seed', r }));
  generated.forEach((r) => seedDocs.push({ src: 'generated', r }));
}
SL.recipes.list.forEach((r) => seedDocs.push({ src: 'builtin', r }));

const flagged = [];
seedDocs.forEach(({ src, r }) => {
  const nameTokens = String(r.name).toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/);
  const ingSet = new Set((r.ing || []).map((i) => i.f));
  const missing = [];
  nameTokens.forEach((tok, i) => {
    if (tok === 'olive' && nameTokens[i + 1] === 'oil') return; // "olive oil" ≠ olives
    if (tok === 'butter' && nameTokens[i - 1] === 'peanut') return; // "peanut butter" handled by 'peanut'
    let promise = PROMISES[tok];
    if (typeof promise === 'string') promise = PROMISES[promise];
    if (!promise) return;
    if (!promise.some((id) => ingSet.has(id))) missing.push(tok);
  });
  if (missing.length) flagged.push({ src, id: r.id, name: r.name, missing: [...new Set(missing)] });
});

console.log('Audited ' + seedDocs.length + ' recipes — ' + flagged.length + ' name↔ingredient mismatches:');
const bySrc = {};
flagged.forEach((f) => { bySrc[f.src] = (bySrc[f.src] || 0) + 1; });
console.log(JSON.stringify(bySrc));
flagged.slice(0, 20).forEach((f) => console.log('  [' + f.src + '] ' + f.id + ' — name promises: ' + f.missing.join(', ')));
if (flagged.length > 20) console.log('  … +' + (flagged.length - 20) + ' more');
fs.writeFileSync(path.join(__dirname, 'audit-flagged.json'), JSON.stringify(flagged, null, 1));
console.log('written dev/audit-flagged.json');
