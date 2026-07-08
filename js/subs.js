/* ShelfLife — subs.js
   Substitution intelligence, two flavors:
   1. veganize(recipe) — can this recipe go vegan with catalog foods? Honest
      answers: swaps with technique notes where they genuinely work, and
      named blockers where they don't (there is no convincing vegan cheddar
      in this catalog, and pretending otherwise wastes groceries).
   2. pinchFor(foodId) — same-role stand-ins for when you're missing an
      ingredient ("no penne, but spaghetti works"), ranked with what's
      already in the pantry first.
   Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const FOODS = g.SL.foods;

  /* ---------- vegan transforms ---------- */
  // non-vegan food → workable catalog swap + the technique note that makes it work
  const VEGAN_SWAPS = {
    butter: { to: 'vegan_butter', note: 'swaps 1:1 everywhere, baking included' },
    milk: { to: 'oat_milk', note: 'the closest body and neutrality of the plant milks' },
    heavy_cream: { to: 'coconut_milk', note: 'the thick top of the can whips and enriches like cream' },
    cream_cheese: { to: 'vegan_ricotta', note: 'softer — chill it and add a pinch of salt' },
    greek_yogurt: { to: 'plant_yogurt', note: 'swap 1:1; strain in a coffee filter for extra thickness' },
    sour_cream: { to: 'plant_yogurt', note: 'add a squeeze of lemon for the missing tang' },
    honey: { to: 'maple_syrup', note: 'swap 1:1' },
    broth: { to: 'vegetable_broth', note: 'swap 1:1' },
    cheddar: { to: 'vegan_cheddar_shreds', note: 'melts best under a lid with a splash of water' },
    mozzarella: { to: 'vegan_mozzarella_shreds', note: 'browns less — finish under the broiler for color' },
    feta: { to: 'vegan_feta', note: 'crumbles and brines convincingly' },
    ricotta: { to: 'vegan_ricotta', note: 'almond-based; swap 1:1' },
    cottage_cheese: { to: 'vegan_ricotta', note: 'closest texture in the plant aisle' },
    goat_cheese: { to: 'vegan_ricotta', note: 'add lemon zest and black pepper to fake the tang' },
    parmesan: { to: 'nutritional_yeast', note: 'the classic — half the amount, same savory finish' },
    eggs: { to: 'flax_seeds', note: 'for binding: 1 tbsp ground flax + 3 tbsp water per egg; for scrambles use crumbled tofu instead' },
    mayonnaise: { to: 'tahini', note: 'whisked with lemon and water — different but excellent' },
    chicken_breast: { to: 'tofu', note: 'pressed firm tofu, seared hard, same seasoning' },
    chicken_thigh: { to: 'tofu', note: 'pressed firm tofu, seared hard, same seasoning' },
    pork_loin: { to: 'tempeh', note: 'sliced and seared — nutty, meaty chew' },
    pork_chops: { to: 'tempeh', note: 'thick slabs, seared and glazed like a chop' },
    ground_beef: { to: 'lentils_dry', note: 'use half the weight, simmered until tender' },
    ground_turkey: { to: 'lentils_dry', note: 'use half the weight, simmered until tender' },
    italian_sausage: { to: 'tempeh', note: 'crumbled and fried with fennel-adjacent italian_seasoning and red_pepper_flakes' },
    bacon: { to: 'tempeh', note: 'thin slices seared with paprika + maple — the classic tempeh bacon' },
    deli_ham: { to: 'tempeh', note: 'thin smoky-seared slices' },
    deli_turkey: { to: 'tofu', note: 'pressed, sliced thin, seasoned' },
    salmon: { to: 'tofu', note: 'texture differs — works in bowls and curries, not as a "fillet"' },
    cod: { to: 'tofu', note: 'texture differs — best battered or in stews' },
    shrimp: { to: 'tofu', note: 'texture differs — best in stir-fries and curries' },
    tuna_canned: { to: 'chickpeas', note: 'roughly smashed — the classic vegan tuna-salad move' }
  };

  // with the vegan aisle in the catalog, very little truly blocks now
  const VEGAN_BLOCKERS = {};

  const ANIMAL_FOODS = new Set([
    ...Object.keys(VEGAN_SWAPS), ...Object.keys(VEGAN_BLOCKERS)
  ]);

  function veganize(recipe) {
    if (recipe.diets && recipe.diets.includes('vegan')) {
      return { alreadyVegan: true, possible: true, swaps: [], blockers: [] };
    }
    const swaps = [], blockers = [];
    (recipe.ing || []).forEach((ing) => {
      if (!ANIMAL_FOODS.has(ing.f)) return;
      if (ing.f in VEGAN_SWAPS) {
        const s = VEGAN_SWAPS[ing.f];
        swaps.push({ from: ing.f, to: s.to, note: s.note });
      } else {
        blockers.push({ foodId: ing.f, why: VEGAN_BLOCKERS[ing.f] });
      }
    });
    return { alreadyVegan: false, possible: blockers.length === 0 && swaps.length > 0, swaps, blockers };
  }

  /* ---------- in-a-pinch swaps ---------- */
  // same-role families; membership is symmetric within a group
  const GROUPS = [
    ['spaghetti', 'penne', 'rice_noodles'],
    ['rice', 'quinoa', 'couscous'],
    ['lime', 'lemon'],
    ['cilantro', 'parsley'], ['basil', 'parsley'],
    ['black_beans', 'chickpeas', 'white_beans'],
    ['spinach', 'kale'],
    ['broccoli', 'cauliflower', 'green_beans', 'asparagus'],
    ['zucchini', 'eggplant'],
    ['walnuts', 'cashews', 'almonds'],
    ['cheddar', 'mozzarella'], ['ricotta', 'cottage_cheese'],
    ['greek_yogurt', 'sour_cream'],
    ['butter', 'olive_oil'], ['honey', 'maple_syrup'],
    ['chicken_breast', 'chicken_thigh', 'pork_loin'],
    ['ground_beef', 'ground_turkey'],
    ['tortillas', 'pita', 'bread'],
    ['crushed_tomatoes', 'salsa'],
    ['onion', 'scallions'],
    ['bell_pepper', 'roasted_red_peppers'],
    ['tomato', 'cherry_tomatoes'],
    ['corn_frozen', 'peas_frozen', 'edamame_frozen'],
    ['paprika', 'chili_powder'], ['curry_powder', 'garam_masala'],
    ['salmon', 'tuna_canned', 'cod'],
    ['potatoes', 'sweet_potatoes', 'butternut_squash'],
    // batch-5 families
    ['basil', 'parsley', 'cilantro', 'dill', 'mint', 'chives'],
    ['thyme', 'rosemary', 'italian_seasoning', 'oregano'],
    ['red_pepper_flakes', 'cayenne', 'hot_sauce', 'jalapeno'],
    ['garlic', 'garlic_powder'], ['onion', 'red_onion', 'shallots', 'onion_powder'],
    ['milk', 'oat_milk', 'almond_milk'],
    ['greek_yogurt', 'plant_yogurt'], ['butter', 'vegan_butter'],
    ['cheddar', 'vegan_cheddar_shreds'], ['mozzarella', 'vegan_mozzarella_shreds'],
    ['ricotta', 'vegan_ricotta', 'cream_cheese', 'goat_cheese'], ['feta', 'vegan_feta', 'goat_cheese'],
    ['parmesan', 'nutritional_yeast'],
    ['tofu', 'tempeh'],
    ['broth', 'vegetable_broth'],
    ['tortillas', 'corn_tortillas'],
    ['rice', 'brown_rice'], ['penne', 'orzo'],
    ['red_wine_vinegar', 'rice_vinegar', 'balsamic_vinegar'],
    ['black_beans', 'kidney_beans', 'pinto_beans'],
    ['crushed_tomatoes', 'diced_tomatoes'],
    ['berries', 'strawberries', 'blueberries'],
    ['broccoli', 'brussels_sprouts'], ['spinach', 'arugula', 'bok_choy'],
    ['green_beans', 'snap_peas'],
    ['peanut_butter', 'tahini'], ['chia_seeds', 'flax_seeds'],
    ['pork_loin', 'pork_chops'], ['deli_ham', 'deli_turkey', 'bacon'],
    ['panko', 'oats'], ['mayonnaise', 'greek_yogurt'],
    ['lemon', 'oranges']
  ];

  const pinchMap = {};
  function link(a, b) {
    if (a === b) return;
    (pinchMap[a] = pinchMap[a] || new Set()).add(b);
  }
  GROUPS.forEach((group) => group.forEach((a) => group.forEach((b) => link(a, b))));
  // the curated per-food subs from the catalog join the pool (both directions)
  FOODS.list.forEach((f) => (f.subs || []).forEach((s) => { link(f.id, s); link(s, f.id); }));

  /* Ranked stand-ins for a food: what's already in the pantry first.
     Returns [{ id, name, inStock }]. */
  function pinchFor(foodId) {
    const set = pinchMap[foodId];
    if (!set) return [];
    const inv = g.SL.inventory;
    return [...set]
      .filter((id) => FOODS.byId(id))
      .map((id) => ({ id, name: FOODS.byId(id).name, inStock: !!(inv && inv.usableQty(id) > 0) }))
      .sort((a, b) => (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0) || a.name.localeCompare(b.name));
  }

  /* For a recipe: which missing ingredients have an in-stock stand-in?
     Returns [{ foodId, sub: {id, name} }]. */
  function inStockAlternatives(recipe, servings) {
    const inv = g.SL.inventory;
    if (!inv) return [];
    const scale = (servings || recipe.servings) / recipe.servings;
    const out = [];
    (recipe.ing || []).forEach((ing) => {
      const food = FOODS.byId(ing.f);
      if (!food || food.staple) return;
      if (inv.usableQty(ing.f) >= ing.q * scale * 0.5) return; // have (enough of) it
      const sub = pinchFor(ing.f).find((s) => s.inStock);
      if (sub) out.push({ foodId: ing.f, sub });
    });
    return out;
  }

  g.SL = g.SL || {};
  g.SL.subs = { veganize, pinchFor, inStockAlternatives, VEGAN_SWAPS, VEGAN_BLOCKERS };
})(typeof window !== 'undefined' ? window : globalThis);
