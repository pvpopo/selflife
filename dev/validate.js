/* ShelfLife — dev/validate.js
   Run with: node dev/validate.js
   Loads the data + logic modules (no DOM needed) into a shimmed globalThis
   and verifies data integrity plus an end-to-end logic smoke test. */
'use strict';
const fs = require('fs');
const path = require('path');

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  \u2713 ' + msg);
  else { failures++; console.error('  \u2717 ' + msg); }
}

/* ---- shim a browser-ish global ---- */
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
  key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
// node >= 19 has webcrypto on globalThis.crypto already; assert:
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = require('crypto').webcrypto;
}

const root = path.join(__dirname, '..');
const LOGIC_FILES = [
  'js/util.js', 'js/data/foods.js', 'js/data/recipes.js', 'js/data/stores.js',
  'js/db.js', 'js/auth.js', 'js/nutrition.js', 'js/inventory.js',
  'js/planner.js', 'js/shopping.js', 'js/receipt.js'
];
for (const f of LOGIC_FILES) {
  // receipt.js references document only inside functions; safe to load.
  eval(fs.readFileSync(path.join(root, f), 'utf8'));
}
const SL = globalThis.SL;
const U = SL.util;

(async () => {
  console.log('\n== Data integrity ==');
  const foodIds = new Set(SL.foods.list.map((f) => f.id));
  check(SL.foods.list.length >= 60, 'food catalog has ' + SL.foods.list.length + ' items');
  let ok = true;
  for (const f of SL.foods.list) {
    if (!f.nutr || !f.shelf || !f.spoil || !f.pkg || !(f.price > 0)) { ok = false; console.error('    missing fields on', f.id); }
    if (f.unit === 'ct' && !(f.gpu > 0)) { ok = false; console.error('    ct food missing gpu:', f.id); }
    if (!['pantry', 'fridge', 'freezer'].includes(f.storage)) { ok = false; console.error('    bad default storage:', f.id); }
    if (!(SL.foods.shelfDays(f, f.storage) > 0)) { ok = false; console.error('    zero shelf life at default storage:', f.id); }
    for (const s of f.subs || []) if (!foodIds.has(s)) { ok = false; console.error('    unknown substitute', s, 'on', f.id); }
  }
  check(ok, 'every food has nutrition, package, price, shelf life, spoilage text, valid storage & subs');

  ok = true;
  for (const r of SL.recipes.list) {
    if (!r.steps || r.steps.length < 3) { ok = false; console.error('    too few steps:', r.id); }
    for (const ing of r.ing) {
      if (!foodIds.has(ing.f)) { ok = false; console.error('    unknown food', ing.f, 'in', r.id); }
      if (!(ing.q > 0)) { ok = false; console.error('    bad qty in', r.id, ing.f); }
    }
    for (const m of r.meal) if (!['breakfast', 'lunch', 'dinner'].includes(m)) { ok = false; console.error('    bad meal tag in', r.id); }
  }
  check(ok, 'all ' + SL.recipes.list.length + ' recipes reference known foods with valid quantities & meal tags');

  console.log('\n== Nutrition sanity ==');
  ok = true;
  for (const r of SL.recipes.list) {
    const n = SL.nutrition.perServing(r);
    if (!(n.cal >= 120 && n.cal <= 1100)) { ok = false; console.error('    calories out of range:', r.id, n.cal); }
    if (!(n.p >= 2)) { ok = false; console.error('    protein suspicious:', r.id, n.p); }
  }
  check(ok, 'per-serving calories fall in a sane range (120\u20131100) for every recipe');
  const oats = SL.nutrition.perServing(SL.recipes.byId('overnight_oats'));
  console.log('    e.g. overnight oats/serving:', JSON.stringify(oats));

  console.log('\n== Stores & optimizer determinism ==');
  const zip = '98101';
  const near1 = SL.stores.nearbyStores(zip);
  const near2 = SL.stores.nearbyStores(zip);
  check(JSON.stringify(near1) === JSON.stringify(near2), 'nearby stores are stable for the same zip (' + near1.map((s) => s.name).join(', ') + ')');
  check(near1.some((s) => s.delivery), 'a delivery option is always present');
  const chicken = SL.foods.byId('chicken_breast');
  const p1 = SL.stores.priceFor(near1[0].id, chicken, zip, new Date());
  const p2 = SL.stores.priceFor(near1[0].id, chicken, zip, new Date());
  check(p1.price === p2.price, 'prices are deterministic (chicken @ ' + near1[0].name + ' = $' + p1.price + ')');

  console.log('\n== End-to-end flow ==');
  const user = await SL.auth.register('validator', 'password123');
  check(user === 'validator' && SL.auth.current() === 'validator', 'register + session works');
  let threw = false;
  try { await SL.auth.login('validator', 'wrongpass'); } catch (e) { threw = true; }
  check(threw, 'wrong password is rejected');

  const prefs = SL.planner.prefs();
  prefs.diets = ['vegetarian'];
  prefs.allergens = ['nuts'];
  prefs.cuisines = ['Mexican'];
  prefs.zip = zip;
  prefs.servings = 2;
  SL.planner.savePrefs(prefs);

  // seed expiring stock: spinach turning in 2 days should pull spinach recipes up
  SL.inventory.add({ foodId: 'spinach', qty: 142, storage: 'fridge', purchasedISO: U.iso(U.addDays(U.today(), -3)) });
  SL.inventory.add({ foodId: 'eggs', qty: 10, storage: 'fridge' });
  SL.inventory.add({ foodId: 'rice', qty: 900, storage: 'pantry' });

  const plan = SL.planner.generate();
  check(plan.days.length === 7, 'plan spans 7 days');
  const allEntries = plan.days.flatMap((d) => Object.values(d.slots)).filter(Boolean);
  check(allEntries.length > 0, 'slots were filled (' + allEntries.length + ' meals)');
  ok = true;
  for (const e of allEntries) {
    const r = SL.recipes.byId(e.recipeId);
    if (!r.diets.includes('vegetarian')) { ok = false; console.error('    non-vegetarian slipped in:', r.id); }
    if (r.allergens.includes('nuts')) { ok = false; console.error('    nut allergen slipped in:', r.id); }
  }
  check(ok, 'hard constraints hold: every planned meal is vegetarian and nut-free');
  const usesSpinach = allEntries.some((e) => SL.recipes.byId(e.recipeId).ing.some((i) => i.f === 'spinach'));
  check(usesSpinach, 'expiring spinach pulled at least one spinach recipe into the week');

  const list = SL.shopping.buildList();
  check(list.lines.length > 0, 'shopping list built (' + list.lines.length + ' items + ' + list.staples.length + ' staples)');
  const riceLine = list.lines.find((l) => l.foodId === 'rice');
  const riceNeeded = list.lines.concat(list.staples).some((l) => l.foodId === 'rice' && l.packages > 0);
  console.log('    rice: pantry has 900g \u2192 ' + (riceLine ? 'still buying ' + riceLine.packages + ' pkg (plan needs more)' : (riceNeeded ? 'buying' : 'covered by pantry, correctly omitted')));

  const result = SL.shopping.optimize();
  check(!!result.best, 'optimizer produced a recommendation');
  check(result.best.stores.length <= 2, 'recommendation respects the 1\u20132 store cap (' + result.best.stores.map((s) => s.name).join(' + ') + ' \u2014 $' + result.best.total.toFixed(2) + ', ' + Math.round(result.best.coverage * 100) + '% coverage)');
  ok = result.singles.every((s) => s.quotes.every((q) => q.cost > 0));
  check(ok, 'every quote has a positive cost');
  const anySub = [...result.singles, ...result.pairs].some((o) => o.quotes.some((q) => q.sub));
  console.log('    substitutions exercised somewhere in options: ' + anySub);

  const invBefore = SL.inventory.items().length;
  SL.shopping.setCart(result.best);
  const added = SL.shopping.purchase({});
  check(added.length === result.best.quotes.length, 'purchase filed ' + added.length + ' items into the pantry');
  check(SL.inventory.items().length === invBefore + added.length, 'inventory count grew accordingly');
  ok = added.every((it) => U.daysLeft(it.expiresISO) >= 0 && it.expiresISO > it.purchasedISO);
  check(ok, 'every purchased item got a future estimated date');

  // cook the first planned meal and confirm stock is consumed
  const day0 = plan.days[0];
  const slotName = Object.keys(day0.slots).find((s) => day0.slots[s]);
  const recipe = SL.recipes.byId(day0.slots[slotName].recipeId);
  const tracked = recipe.ing.find((i) => SL.inventory.usableQty(i.f) > 0);
  const before = tracked ? SL.inventory.usableQty(tracked.f) : 0;
  const consumed = SL.planner.markCooked(0, slotName);
  check(consumed.length > 0, 'mark-cooked consumed ' + consumed.length + ' ingredients from stock');
  if (tracked) check(SL.inventory.usableQty(tracked.f) < before, 'stock of ' + tracked.f + ' decreased after cooking');

  console.log('\n== Receipt parser ==');
  const sample = [
    'FRESHMART #204', '123 MAIN ST', '', 'CHKN BRST B/S      9.49',
    '2 @ SPINACH 5OZ         6.58', 'GRK YOGURT 32OZ    5.49',
    'TRTLA FLOUR 10CT   3.49', 'XZK99 PLU 4011', 'SUBTOTAL          25.05',
    'TAX                1.90', 'TOTAL             26.95', 'VISA  ****1234'
  ].join('\n');
  const parsed = SL.receipt.parseReceipt(sample);
  const matched = parsed.filter((p) => p.match);
  check(matched.length >= 4, 'matched ' + matched.length + ' of ' + parsed.length + ' candidate lines to catalog foods');
  const gotChicken = matched.some((p) => p.match === 'chicken_breast');
  const gotSpin = matched.some((p) => p.match === 'spinach' && p.qty === 2);
  check(gotChicken, 'abbreviated "CHKN BRST" matched chicken breast');
  check(gotSpin, '"2 @ SPINACH" matched spinach with qty 2');
  const noisy = parsed.some((p) => /subtotal|total|tax|visa/i.test(p.raw));
  check(!noisy, 'totals/tax/payment lines were filtered out');

  console.log('\n== Auth extras ==');
  await SL.auth.changePassword('password123', 'newpassword456');
  let relog = false;
  try { await SL.auth.login('validator', 'newpassword456'); relog = true; } catch (e) {}
  check(relog, 'password change + re-login works');
  const backup = SL.db.exportUser('validator');
  check(Object.keys(backup.data).length >= 4, 'export contains user data (' + Object.keys(backup.data).length + ' keys)');

  console.log('\n' + (failures ? '\u2717 ' + failures + ' check(s) FAILED' : '\u2713 All checks passed'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(1); });
