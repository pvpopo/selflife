/* ShelfLife — nutrition.js
   Per-serving nutrition computed from the food catalog, so recipe cards,
   day totals and the plan summary always agree with the ingredient list.
   Values are estimates based on typical USDA-style per-100g figures. */
(function (g) {
  'use strict';
  const FOODS = g.SL.foods;
  const cache = {};

  function zero() { return { cal: 0, p: 0, c: 0, f: 0, fib: 0, na: 0 }; }

  function addInto(total, nutr, grams) {
    const k = grams / 100;
    total.cal += nutr.cal * k;
    total.p += nutr.p * k;
    total.c += nutr.c * k;
    total.f += nutr.f * k;
    total.fib += nutr.fib * k;
    total.na += nutr.na * k;
  }

  function perServing(recipe) {
    if (cache[recipe.id]) return cache[recipe.id];
    const total = zero();
    recipe.ing.forEach((ing) => {
      const food = FOODS.byId(ing.f);
      if (!food) return;
      addInto(total, food.nutr, FOODS.grams(food, ing.q));
    });
    const s = recipe.servings || 1;
    const out = {
      cal: Math.round(total.cal / s),
      p: Math.round(total.p / s),
      c: Math.round(total.c / s),
      f: Math.round(total.f / s),
      fib: Math.round(total.fib / s),
      na: Math.round(total.na / s)
    };
    cache[recipe.id] = out;
    return out;
  }

  function sumPerServing(recipes) {
    const total = zero();
    recipes.forEach((r) => {
      const n = perServing(r);
      total.cal += n.cal; total.p += n.p; total.c += n.c;
      total.f += n.f; total.fib += n.fib; total.na += n.na;
    });
    Object.keys(total).forEach((k) => { total[k] = Math.round(total[k]); });
    return total;
  }

  g.SL = g.SL || {};
  g.SL.nutrition = { perServing, sumPerServing };
})(typeof window !== 'undefined' ? window : globalThis);
