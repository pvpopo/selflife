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
    butter: { to: 'olive_oil', note: 'equal amount — sautés and roasts identically; skip for baking' },
    milk: { to: 'coconut_milk', note: 'thin 1:1 with water to match milk’s body' },
    greek_yogurt: { to: 'coconut_milk', note: 'in sauces; add a squeeze of lemon for the missing tang' },
    sour_cream: { to: 'avocado', note: 'as a topping — mash with lime and salt' },
    honey: { to: 'maple_syrup', note: 'swap 1:1' },
    broth: { to: null, note: 'use water plus an extra pinch of salt' },
    chicken_breast: { to: 'tofu', note: 'pressed firm tofu, seared hard, same seasoning' },
    chicken_thigh: { to: 'tofu', note: 'pressed firm tofu, seared hard, same seasoning' },
    pork_loin: { to: 'tofu', note: 'or thick-cut mushrooms for a meatier chew' },
    ground_beef: { to: 'lentils_dry', note: 'use half the weight, simmered until tender' },
    ground_turkey: { to: 'lentils_dry', note: 'use half the weight, simmered until tender' },
    bacon: { to: 'mushrooms', note: 'sear crisp with paprika and a drop of maple — smoke and sweet' },
    salmon: { to: 'tofu', note: 'texture differs — works in bowls and curries, not as a "fillet"' },
    shrimp: { to: 'tofu', note: 'texture differs — best in stir-fries and curries' },
    tuna_canned: { to: 'chickpeas', note: 'roughly smashed — the classic vegan tuna-salad move' },
    parmesan: { to: 'walnuts', note: 'toasted, salted and crumbled fine — a parm-ish finishing dust' }
  };

  // foods with no honest vegan stand-in in this catalog
  const VEGAN_BLOCKERS = {
    eggs: 'eggs as the star (scrambles, frittatas) have no clean catalog stand-in',
    cheddar: 'no convincing melt substitute in the catalog',
    mozzarella: 'no convincing melt substitute in the catalog',
    feta: 'no brined-cheese substitute in the catalog',
    ricotta: 'no fresh-cheese substitute in the catalog',
    cottage_cheese: 'no fresh-cheese substitute in the catalog'
  };

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
    ['salmon', 'tuna_canned'],
    ['potatoes', 'sweet_potatoes']
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
