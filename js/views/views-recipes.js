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

  const planner = g.SL.planner;

  const state = { q: '', diet: null, cuisine: null, useUp: false };

  function pantryMatch(recipe) {
    const nonStaple = recipe.ing.filter((ing) => !(FOODS.byId(ing.f) || {}).staple);
    if (!nonStaple.length) return 1;
    let covered = 0;
    nonStaple.forEach((ing) => { if (inv.usableQty(ing.f) > 0) covered++; });
    return covered / nonStaple.length;
  }

  function matches(r) {
    if (state.useUp && !planner.rescues(r).length) return false;
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
    container.appendChild(ui.header('Library', 'Recipes',
      U.el('button', { class: 'btn small ghost', onclick: () => submitRecipeSheet(container) }, '+ Submit a recipe')));

    const search = U.el('input', {
      class: 'input', type: 'search', placeholder: 'Search recipes or ingredients\u2026',
      value: state.q, 'aria-label': 'Search recipes'
    });
    search.addEventListener('input', U.debounce(() => { state.q = search.value; drawList(); }, 150));
    container.appendChild(search);

    const dietRow = U.el('div', { class: 'chip-row scroll-x' });
    // waste-rescue filter first — only when something is actually expiring
    if (g.SL.inventory.expiringSoon(4).length) {
      dietRow.appendChild(ui.chip('⚡ Use it up', {
        small: true, active: state.useUp,
        onclick: () => { state.useUp = !state.useUp; render(container); }
      }));
    }
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
        .sort((a, b) => {
          // recipes that rescue expiring stock float to the top, most urgent first
          const ra = planner.rescues(a), rb = planner.rescues(b);
          if (!!rb.length !== !!ra.length) return rb.length - ra.length;
          if (ra.length && rb.length && ra[0].days !== rb[0].days) return ra[0].days - rb[0].days;
          return pantryMatch(b) - pantryMatch(a);
        })
        .forEach((r) => {
          const n = nutrition.perServing(r);
          const match = pantryMatch(r);
          const resc = planner.rescues(r);
          const card = U.el('button', { class: 'recipe-card', type: 'button', onclick: () => g.SL.views.plan.openRecipe(r) });
          card.appendChild(U.el('span', { class: 'recipe-emoji', 'aria-hidden': 'true' }, r.emoji));
          card.appendChild(U.el('span', { class: 'recipe-card-body' }, [
            U.el('b', {}, r.name),
            U.el('small', { class: 'muted' }, r.cuisine + ' \u00b7 ' + r.time + ' min'),
            resc.length ? U.el('small', { class: 'rescue-note' }, '\u26a1 uses your ' + FOODS.byId(resc[0].foodId).name.toLowerCase() + ' (' + resc[0].days + 'd left)') : null,
            U.el('span', { class: 'chip-row tight' }, r.diets.slice(0, 3).map((d) => U.el('span', { class: 'chip small static' }, ui.DIET_LABELS[d])))
          ]));
          const rating = g.SL.recipedb ? g.SL.recipedb.starsFor(r.id) : null;
          card.appendChild(U.el('span', { class: 'recipe-card-tags' }, [
            rating ? ui.tag(U.el('b', {}, '\u2605 ' + rating.stars.toFixed(1)), rating.stars >= 4 ? 'fresh' : null) : null,
            ui.tag(U.el('b', {}, n.cal + ' cal')),
            resc.length ? ui.tag(U.el('b', {}, '\u26a1 use it up'), 'soon') : (match > 0 ? ui.tag(U.el('b', {}, Math.round(match * 100) + '% in pantry'), match >= 0.6 ? 'fresh' : null) : null)
          ]));
          listWrap.appendChild(card);
        });
    }
    drawList();
  }

  /* ---------- community submissions ---------- */
  function submitRecipeSheet(container) {
    const doc = { name: '', cuisine: 'American', time: 30, servings: 2, emoji: '🍽️', meal: ['dinner'], diets: [], allergens: [], ing: [], steps: [], tip: '' };
    ui.sheet({
      title: 'Submit a recipe',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'Submissions are reviewed before they appear for everyone. Ingredients come from the catalog so nutrition facts, shopping lists and expiry tracking work automatically.'));

        const nameIn = U.el('input', { class: 'input', type: 'text', placeholder: 'Recipe name' });
        body.appendChild(nameIn);

        const cuisineIn = U.el('input', { class: 'input', type: 'text', placeholder: 'Cuisine (e.g. Italian)', value: doc.cuisine, list: 'cuisine-list' });
        const dl = U.el('datalist', { id: 'cuisine-list' });
        RECIPES.CUISINES.forEach((c) => dl.appendChild(U.el('option', { value: c })));
        body.appendChild(cuisineIn); body.appendChild(dl);

        const rowNums = U.el('div', { class: 'btn-row' }, [
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field-label' }, 'Minutes'), (() => { const i = U.el('input', { class: 'input', type: 'number', min: '5', max: '240', value: '30' }); i.addEventListener('change', () => { doc.time = +i.value || 30; }); return i; })()]),
          U.el('div', { class: 'field' }, [U.el('label', { class: 'field-label' }, 'Servings'), (() => { const i = U.el('input', { class: 'input', type: 'number', min: '1', max: '12', value: '2' }); i.addEventListener('change', () => { doc.servings = +i.value || 2; }); return i; })()])
        ]);
        body.appendChild(rowNums);

        function chipGroup(label, options, selected, labels) {
          const wrap = U.el('div', { class: 'field' });
          wrap.appendChild(U.el('label', { class: 'field-label' }, label));
          const row = U.el('div', { class: 'chip-row' });
          options.forEach((o) => {
            const chip = ui.chip((labels && labels[o]) || U.cap(o), {
              small: true, active: selected.includes(o),
              onclick: () => { const i = selected.indexOf(o); if (i >= 0) selected.splice(i, 1); else selected.push(o); chip.classList.toggle('active'); }
            });
            row.appendChild(chip);
          });
          wrap.appendChild(row);
          return wrap;
        }
        body.appendChild(chipGroup('Meal slots', ['breakfast', 'lunch', 'dinner'], doc.meal));
        body.appendChild(chipGroup('Diets it satisfies', RECIPES.DIETS, doc.diets, ui.DIET_LABELS));
        body.appendChild(chipGroup('Contains allergens', RECIPES.ALLERGENS, doc.allergens, ui.ALLERGEN_LABELS));

        body.appendChild(U.el('label', { class: 'field-label' }, 'Ingredients'));
        const ingList = U.el('div', { class: 'picker-list' });
        function drawIngs() {
          ingList.innerHTML = '';
          doc.ing.forEach((ing, idx) => {
            const food = FOODS.byId(ing.f);
            ingList.appendChild(U.el('div', { class: 'row-between ing-edit' }, [
              U.el('span', {}, [U.el('b', {}, food.name), U.el('small', { class: 'muted' }, ' · ' + U.fmtQty(ing.q, food.unit))]),
              U.el('span', {}, [
                ui.stepper(ing.q, 1, 2000, (v) => { ing.q = v; }),
                U.el('button', { class: 'icon-btn', 'aria-label': 'Remove', onclick: () => { doc.ing.splice(idx, 1); drawIngs(); } }, '✕')
              ])
            ]));
          });
        }
        drawIngs();
        body.appendChild(ingList);
        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: () => ui.pickFood('Add an ingredient', (food) => {
            doc.ing.push({ f: food.id, q: food.unit === 'ct' ? 1 : 100 });
            drawIngs();
          })
        }, '+ Add ingredient (quantities in g / ml / count)'));

        body.appendChild(U.el('label', { class: 'field-label' }, 'Steps — one per line'));
        const stepsIn = U.el('textarea', { class: 'input textarea', rows: '6', placeholder: 'Dice the onion…\nBrown the beef…\nSimmer 20 minutes…' });
        body.appendChild(stepsIn);

        const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        body.appendChild(err);
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: async () => {
              err.textContent = '';
              doc.name = nameIn.value.trim();
              doc.cuisine = cuisineIn.value.trim() || 'American';
              doc.steps = stepsIn.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
              try {
                await g.SL.recipedb.submit(doc);
                close();
                ui.toast('Submitted — it appears for everyone once approved 🎉');
              } catch (e) { err.textContent = e.message; }
            }
          }, 'Submit for review')
        ]));
      }
    });
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.recipes = { render };
})(typeof window !== 'undefined' ? window : globalThis);
