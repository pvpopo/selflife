/* ShelfLife — views/views-recipes.js
   Browse and filter the recipe library. Each card shows time, calories and
   how much of it the pantry already covers. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const ui = g.SL.ui;
  const FOODS = g.SL.foods;
  const RECIPES = g.SL.recipes;
  const nutrition = g.SL.nutrition;
  const inv = g.SL.inventory;

  const state = { q: '', diet: null, cuisine: null };

  function pantryMatch(recipe) {
    const nonStaple = recipe.ing.filter((ing) => !(FOODS.byId(ing.f) || {}).staple);
    if (!nonStaple.length) return 1;
    let covered = 0;
    nonStaple.forEach((ing) => { if (inv.usableQty(ing.f) > 0) covered++; });
    return covered / nonStaple.length;
  }

  function matches(r) {
    if (state.diet && !r.diets.includes(state.diet)) return false;
    if (state.cuisine && r.cuisine !== state.cuisine) return false;
    if (state.q) {
      const q = U.normalize(state.q);
      const hay = U.normalize(r.name + ' ' + r.cuisine + ' ' + r.ing.map((i) => (FOODS.byId(i.f) || {}).name).join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function render(container) {
    container.innerHTML = '';
    container.appendChild(ui.header('Library', 'Recipes'));

    const search = U.el('input', {
      class: 'input', type: 'search', placeholder: 'Search recipes or ingredients\u2026',
      value: state.q, 'aria-label': 'Search recipes'
    });
    search.addEventListener('input', U.debounce(() => { state.q = search.value; drawList(); }, 150));
    container.appendChild(search);

    const dietRow = U.el('div', { class: 'chip-row scroll-x' });
    RECIPES.DIETS.forEach((d) => {
      dietRow.appendChild(ui.chip(ui.DIET_LABELS[d], {
        small: true, active: state.diet === d,
        onclick: () => { state.diet = state.diet === d ? null : d; render(container); }
      }));
    });
    container.appendChild(dietRow);

    const cuisineRow = U.el('div', { class: 'chip-row scroll-x' });
    RECIPES.CUISINES.forEach((c) => {
      cuisineRow.appendChild(ui.chip(c, {
        small: true, active: state.cuisine === c,
        onclick: () => { state.cuisine = state.cuisine === c ? null : c; render(container); }
      }));
    });
    container.appendChild(cuisineRow);

    const listWrap = U.el('div', { class: 'recipe-grid', id: 'recipe-grid' });
    container.appendChild(listWrap);

    function drawList() {
      listWrap.innerHTML = '';
      const found = RECIPES.list.filter(matches);
      if (!found.length) {
        listWrap.appendChild(ui.empty({
          emoji: '\u{1F50D}', title: 'Nothing matches',
          text: 'Try a different word, or clear a filter chip above.'
        }));
        return;
      }
      found
        .slice()
        .sort((a, b) => pantryMatch(b) - pantryMatch(a))
        .forEach((r) => {
          const n = nutrition.perServing(r);
          const match = pantryMatch(r);
          const card = U.el('button', { class: 'recipe-card', type: 'button', onclick: () => g.SL.views.plan.openRecipe(r) });
          card.appendChild(U.el('span', { class: 'recipe-emoji', 'aria-hidden': 'true' }, r.emoji));
          card.appendChild(U.el('span', { class: 'recipe-card-body' }, [
            U.el('b', {}, r.name),
            U.el('small', { class: 'muted' }, r.cuisine + ' \u00b7 ' + r.time + ' min'),
            U.el('span', { class: 'chip-row tight' }, r.diets.slice(0, 3).map((d) => U.el('span', { class: 'chip small static' }, ui.DIET_LABELS[d])))
          ]));
          card.appendChild(U.el('span', { class: 'recipe-card-tags' }, [
            ui.tag(U.el('b', {}, n.cal + ' cal')),
            match > 0 ? ui.tag(U.el('b', {}, Math.round(match * 100) + '% in pantry'), match >= 0.6 ? 'fresh' : null) : null
          ]));
          listWrap.appendChild(card);
        });
    }
    drawList();
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.recipes = { render };
})(typeof window !== 'undefined' ? window : globalThis);
