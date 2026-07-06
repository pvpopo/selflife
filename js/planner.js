/* ShelfLife — planner.js
   Generates the week. The scoring deliberately favors recipes that use up
   what's already in the pantry — weighted by how soon it expires — which is
   what ties meal planning to waste reduction.

   Hard constraints (never violated): selected diets, excluded allergens.
   Soft signals (scored): cuisine preferences, expiring inventory, pantry
   coverage, variety across the week. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const RECIPES = g.SL.recipes;
  const FOODS = g.SL.foods;
  const inv = g.SL.inventory;
  const db = g.SL.db;

  const PREFS_KEY = 'prefs';
  const PLAN_KEY = 'plan';

  const DEFAULT_PREFS = {
    diets: [],
    allergens: [],
    cuisines: [],
    servings: 2,
    slots: { breakfast: true, lunch: true, dinner: true },
    zip: '',
    maxStores: 2
  };

  function prefs() { return { ...DEFAULT_PREFS, ...db.get(PREFS_KEY, {}), slots: { ...DEFAULT_PREFS.slots, ...(db.get(PREFS_KEY, {}).slots || {}) } }; }
  function savePrefs(p) { db.set(PREFS_KEY, p); }

  /* ---------- eligibility ---------- */
  function eligible(recipe, p) {
    for (const d of p.diets) if (!recipe.diets.includes(d)) return false;
    for (const a of p.allergens) if (recipe.allergens.includes(a)) return false;
    return true;
  }

  function pool(p, slot) {
    return RECIPES.list.filter((r) => r.meal.includes(slot) && eligible(r, p));
  }

  /* ---------- scoring ---------- */
  function expiringBoost(recipe, p) {
    // Reward using stock that will turn soon. Urgency ramps over a 14-day window.
    let boost = 0;
    const scale = p.servings / recipe.servings;
    recipe.ing.forEach((ing) => {
      const food = FOODS.byId(ing.f);
      if (!food || food.staple) return;
      const have = inv.usableQty(ing.f);
      if (have <= 0) return;
      const need = ing.q * scale;
      const coverage = Math.min(1, have / need);
      const days = inv.soonestDays(ing.f);
      if (!isFinite(days)) return;
      const urgency = U.clamp((14 - days) / 14, 0, 1);
      boost += urgency * coverage * 4;
    });
    return Math.min(boost, 12);
  }

  function coverageScore(recipe, p) {
    const scale = p.servings / recipe.servings;
    const nonStaple = recipe.ing.filter((ing) => !(FOODS.byId(ing.f) || {}).staple);
    if (!nonStaple.length) return 0;
    let covered = 0;
    nonStaple.forEach((ing) => {
      if (inv.usableQty(ing.f) >= ing.q * scale * 0.5) covered++;
    });
    return (covered / nonStaple.length) * 3;
  }

  function score(recipe, p, used, rng) {
    let s = 10;
    if (p.cuisines.length) s += p.cuisines.includes(recipe.cuisine) ? 6 : 0;
    s += expiringBoost(recipe, p);
    s += coverageScore(recipe, p);
    s -= (used[recipe.id] || 0) * 8;      // variety
    s += rng() * 2.5;                     // gentle shuffle between generations
    return s;
  }

  /* ---------- generation ---------- */
  function slotList(p) {
    return ['breakfast', 'lunch', 'dinner'].filter((s) => p.slots[s]);
  }

  function generate(startISO) {
    const p = prefs();
    const rng = U.mulberry32((Date.now() & 0xffffffff) >>> 0);
    const used = {};
    const start = startISO || U.iso(U.today());
    const repeatCap = { breakfast: 4, lunch: 2, dinner: 2 };

    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = U.iso(U.addDays(U.parseISO(start), d));
      const slots = {};
      slotList(p).forEach((slot) => {
        const candidates = pool(p, slot)
          .filter((r) => (used[r.id] || 0) < (repeatCap[slot] || 2))
          .map((r) => ({ r, s: score(r, p, used, rng) }))
          .sort((a, b) => b.s - a.s);
        if (candidates.length) {
          const pick = candidates[0].r;
          slots[slot] = { recipeId: pick.id, cooked: false };
          used[pick.id] = (used[pick.id] || 0) + 1;
        } else {
          slots[slot] = null; // filters too tight for this slot
        }
      });
      days.push({ date, slots });
    }

    const plan = { id: U.uid(), start, createdISO: new Date().toISOString(), days };
    db.set(PLAN_KEY, plan);
    return plan;
  }

  function current() { return db.get(PLAN_KEY, null); }
  function save(plan) { db.set(PLAN_KEY, plan); }

  /* Ranked alternatives for a slot (for the swap sheet). */
  function alternatives(slot, excludeId, limit) {
    const p = prefs();
    const plan = current();
    const used = {};
    if (plan) {
      plan.days.forEach((day) => Object.values(day.slots).forEach((s) => {
        if (s && s.recipeId) used[s.recipeId] = (used[s.recipeId] || 0) + 1;
      }));
    }
    const rng = U.mulberry32(42);
    return pool(p, slot)
      .filter((r) => r.id !== excludeId)
      .map((r) => ({ recipe: r, s: score(r, p, used, rng) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit || 8)
      .map((x) => x.recipe);
  }

  function setSlot(dayIndex, slot, recipeId) {
    const plan = current();
    if (!plan || !plan.days[dayIndex]) return;
    plan.days[dayIndex].slots[slot] = recipeId ? { recipeId, cooked: false } : null;
    save(plan);
  }

  function markCooked(dayIndex, slot) {
    const plan = current();
    if (!plan) return [];
    const entry = plan.days[dayIndex] && plan.days[dayIndex].slots[slot];
    if (!entry || entry.cooked) return [];
    const recipe = RECIPES.byId(entry.recipeId);
    const consumed = inv.consumeRecipe(recipe, prefs().servings);
    entry.cooked = true;
    save(plan);
    return consumed;
  }

  function dayNutrition(day) {
    const list = Object.values(day.slots)
      .filter(Boolean)
      .map((s) => RECIPES.byId(s.recipeId))
      .filter(Boolean);
    return g.SL.nutrition.sumPerServing(list);
  }

  /* Which planned meals a given inventory food shows up in (for "use it up"). */
  function recipesUsing(foodId, limit) {
    const p = prefs();
    return RECIPES.list
      .filter((r) => eligible(r, p) && r.ing.some((ing) => ing.f === foodId))
      .slice(0, limit || 3);
  }

  /* Expiring stock (≤ horizon days) this recipe would use — the "cook this
     and nothing goes to waste" signal surfaced across plan/recipes/sheets. */
  function rescues(recipe, horizonDays) {
    const horizon = horizonDays == null ? 4 : horizonDays;
    const out = [];
    recipe.ing.forEach((ing) => {
      const food = FOODS.byId(ing.f);
      if (!food || food.staple) return;
      if (inv.usableQty(ing.f) <= 0) return;
      const days = inv.soonestDays(ing.f);
      if (isFinite(days) && days <= horizon) out.push({ foodId: ing.f, days });
    });
    return out.sort((a, b) => a.days - b.days);
  }

  /* Does any uncooked meal in the current plan use this food? Lets the
     expiring strip flag stock that still needs a rescue. */
  function planUsesFood(foodId) {
    const plan = current();
    if (!plan) return false;
    return plan.days.some((day) => Object.values(day.slots).some((s) => {
      if (!s || s.cooked) return false;
      const r = RECIPES.byId(s.recipeId);
      return !!r && r.ing.some((ing) => ing.f === foodId);
    }));
  }

  g.SL = g.SL || {};
  g.SL.planner = {
    prefs, savePrefs, DEFAULT_PREFS,
    generate, current, save, alternatives, setSlot, markCooked,
    dayNutrition, eligible, recipesUsing, slotList, rescues, planUsesFood
  };
})(typeof window !== 'undefined' ? window : globalThis);
