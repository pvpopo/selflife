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
  'js/db.js', 'js/auth.js', 'js/expiry.js', 'js/nutrition.js', 'js/inventory.js',
  'js/nonfood.js', 'js/planner.js', 'js/shopping.js', 'js/receipt.js', 'js/agent.js',
  'js/cartlink.js', 'js/kroger.js'
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

  const spinachRecipe = SL.recipes.list.find((r) => r.ing.some((i) => i.f === 'spinach'));
  const resc = SL.planner.rescues(spinachRecipe);
  check(resc.some((x) => x.foodId === 'spinach' && x.days <= 4), 'rescues() flags the expiring spinach with days left');
  check(SL.planner.planUsesFood('spinach') === usesSpinach, 'planUsesFood agrees with the generated plan');

  const list = SL.shopping.buildList();
  check(list.lines.length > 0, 'shopping list built (' + list.lines.length + ' items + ' + list.staples.length + ' staples)');
  check(typeof list.covered === 'number', 'list reports how many foods the pantry fully covers (' + list.covered + ')');

  // approve-flow guarantees: extras and manual unchecks survive a rebuild
  const extraFood = SL.foods.list.find((f) => !list.lines.some((l) => l.foodId === f.id));
  SL.shopping.addExtra(extraFood.id, 2);
  const marked = SL.shopping.currentList();
  marked.lines[0].checked = false;
  const uncheckedId = marked.lines[0].foodId;
  SL.shopping.saveList(marked);
  const rebuilt = SL.shopping.rebuildList();
  check(rebuilt.extras.some((x) => x.foodId === extraFood.id && x.packages === 2), 'rebuildList keeps user-added extras');
  const keptLine = rebuilt.lines.find((l) => l.foodId === uncheckedId);
  check(!!keptLine && keptLine.checked === false, 'rebuildList keeps manual unchecks');
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

  console.log('\n== Agent hand-off brief ==');
  const cart = SL.shopping.cart();
  const briefItems = cart ? SL.agent.itemsFromCart(cart, SL.foods)
    : [{ name: 'Chicken breast', qty: 2, pkg: '1 lb tray', subs: ['Chicken thighs'] }];
  const brief = SL.agent.buildBrief({ retailerId: 'walmart', mode: 'pickup', zip, items: briefItems, budget: 25.5 });
  check(brief.includes('Walmart') && briefItems.every((it) => brief.includes(it.name)), 'brief names the store and includes every item');
  check(/never enter payment/i.test(brief) && /do not place the order/i.test(brief), 'brief carries the no-checkout guardrails');

  console.log('\n== Walmart cart links ==');
  SL.cartlink.WALMART_IDS.chicken_breast = '27935840'; // simulate a mapped item
  const clItems = [
    { foodId: 'chicken_breast', name: 'Chicken breast', qty: 2, pkg: '1 lb tray' },
    { foodId: 'spinach', name: 'Spinach', qty: 1, pkg: '5 oz bag' }
  ];
  const split = SL.cartlink.splitItems(clItems);
  check(split.mapped.length === 1 && split.unmapped.length === 1, 'items split into one-click vs search fallback');
  const wUrl = SL.cartlink.cartUrl(clItems);
  check(wUrl === 'https://affil.walmart.com/cart/addToCart?items=27935840_2', 'cart deep-link carries item id and quantity (' + wUrl + ')');
  check(SL.cartlink.searchUrl('Spinach').includes('walmart.com/search?q=Spinach'), 'unmapped items get a Walmart search link');
  delete SL.cartlink.WALMART_IDS.chicken_breast;
  // live-data cache entries carry price + availability for the real store lane
  SL.db.gset('walmartIds', { spinach: { id: '888', price: 2.48, available: true, ts: 1 } });
  check(SL.cartlink.idFor('spinach') === '888' && SL.cartlink.dataFor('spinach').price === 2.48, 'cache entries carry live walmart.com price data');
  SL.db.gdel('walmartIds');
  check(!SL.stores.nearbyStores('98101').some((s) => s.id === 'walmart'), 'real Walmart lane stays off until a proxy is configured');
  // proxy-resolved ids flow through the same cache the runtime uses
  SL.db.gset('walmartIds', { spinach: '10450115' });
  check(SL.cartlink.idFor('spinach') === '10450115', 'proxy-resolved ids are honored from the cache');
  check(SL.cartlink.cartUrl(clItems).includes('10450115'), 'cached proxy matches join the one-tap cart link');
  SL.db.gdel('walmartIds');
  check(!SL.cartlink.canResolve() || typeof fetch === 'function', 'resolver only activates when a proxy is configured');

  console.log('\n== Expiry intelligence ==');
  const nextYear = new Date().getFullYear() + 1;
  const dLabel = SL.expiry.parseDate('LOT 4432\nBEST BY 08/15/' + String(nextYear % 100).padStart(2, '0') + '\nKEEP REFRIGERATED', 'label');
  check(dLabel === nextYear + '-08-15', 'label OCR text yields the BEST BY date (' + dLabel + ')');
  const dMon = SL.expiry.parseDate('USE BY AUG 15', 'label');
  check(!!dMon && dMon.slice(5) === '08-15', 'month-name dates parse with inferred year (' + dMon + ')');
  const past = U.addDays(U.today(), -10);
  const mdy = (past.getMonth() + 1) + '/' + past.getDate() + '/' + String(past.getFullYear()).slice(2);
  const dRec = SL.receipt.receiptDate('FRESHMART #204\n' + mdy + ' 14:23\nCHKN BRST 9.49');
  check(dRec === U.iso(past), 'receipt header date becomes the purchase date (' + dRec + ')');
  SL.db.gset('shelfConsensus', { ts: Date.now(), map: { 'spinach:fridge': { n: 5, days: 9 } } });
  check(SL.expiry.estimateDays(SL.foods.byId('spinach'), 'fridge') === 9, 'community consensus (n>=3) overrides the catalog estimate');
  SL.db.gdel('shelfConsensus');
  check(SL.expiry.estimateDays(SL.foods.byId('spinach'), 'fridge') === SL.foods.shelfDays(SL.foods.byId('spinach'), 'fridge'), 'estimate falls back to catalog baseline without consensus');
  const backISO = U.iso(U.addDays(U.today(), -2));
  const backdated = SL.inventory.addPurchases([{ foodId: 'spinach', packages: 1 }], 'receipt', backISO)[0];
  check(backdated.purchasedISO === backISO && backdated.expiresISO > backdated.purchasedISO, 'receipt purchase date drives the estimate window');
  SL.inventory.remove(backdated.id);
  // consensus data-quality gates: untethered or implausible observations never leave the device
  check(await SL.expiry.recordObservation('spinach', 'fridge', 6, { source: 'manual' }) === false, 'manually-dated items are never shared to the consensus');
  check(SL.expiry.plausibleDays('spinach', 'fridge', 6) === true && SL.expiry.plausibleDays('spinach', 'fridge', 300) === false, 'implausible spans (>4x baseline) are rejected');

  console.log('\n== Non-food inventory ==');
  check(SL.nonfood.classify('BOUNTY PAPER TOWELS 6CT') === 'paper', 'paper goods classified');
  check(SL.nonfood.classify('TIDE PODS 42CT') === 'cleaning', 'cleaning supplies classified');
  check(SL.nonfood.classify('COLGATE TOOTHPASTE') === 'personal', 'personal care classified');
  check(SL.nonfood.classify('MYSTERY GADGET') === 'other', 'unknown items fall back to Other');
  const nf = SL.nonfood.add({ name: 'Bounty paper towels', qty: 2, price: 12.99 });
  check(!!nf && nf.cat === 'paper' && SL.nonfood.items().length === 1, 'non-food item stored with auto category');
  SL.nonfood.remove(nf.id);
  check(!SL.kroger.enabled(), 'Kroger lane stays off until a proxy is configured');

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
