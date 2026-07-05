/* ShelfLife — views/views-plan.js
   The week at a glance. Each slot can be swapped, opened, or marked cooked
   (which deducts ingredients from the pantry). A strip at the top surfaces
   soon-to-expire stock and the recipes that would rescue it. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const ui = g.SL.ui;
  const FOODS = g.SL.foods;
  const RECIPES = g.SL.recipes;
  const planner = g.SL.planner;
  const nutrition = g.SL.nutrition;
  const inv = g.SL.inventory;

  /* ---------- recipe detail sheet (shared with Recipes view) ---------- */
  function openRecipe(recipe, opts) {
    const o = opts || {};
    const p = planner.prefs();
    ui.sheet({
      title: recipe.name,
      tall: true,
      render(body, close) {
        const n = nutrition.perServing(recipe);

        body.appendChild(U.el('div', { class: 'recipe-meta' }, [
          U.el('span', { class: 'recipe-emoji', 'aria-hidden': 'true' }, recipe.emoji),
          U.el('div', {}, [
            U.el('div', { class: 'muted' }, recipe.cuisine + ' \u00b7 ' + recipe.time + ' min \u00b7 makes ' + recipe.servings + ' servings'),
            U.el('div', { class: 'chip-row tight' }, recipe.diets.map((d) => U.el('span', { class: 'chip small static' }, ui.DIET_LABELS[d] || d)))
          ])
        ]));

        body.appendChild(U.el('h3', { class: 'sub' }, 'Per serving'));
        body.appendChild(ui.macros(n));

        if (recipe.allergens.length) {
          body.appendChild(U.el('p', { class: 'allergen-note' },
            'Contains: ' + recipe.allergens.map((a) => ui.ALLERGEN_LABELS[a] || a).join(', ')));
        }

        body.appendChild(U.el('h3', { class: 'sub' }, 'Ingredients \u00b7 for ' + p.servings + ' ' + U.plural(p.servings, 'serving')));
        const scale = p.servings / recipe.servings;
        const ingList = U.el('ul', { class: 'ing-list' });
        recipe.ing.forEach((ing) => {
          const food = FOODS.byId(ing.f);
          const need = ing.q * scale;
          const have = inv.usableQty(ing.f);
          const enough = have >= need;
          const some = have > 0 && !enough;
          ingList.appendChild(U.el('li', { class: 'ing-row' }, [
            U.el('span', { class: 'ing-check ' + (enough ? 'ok' : some ? 'part' : ''), 'aria-hidden': 'true' }, enough ? '\u2713' : some ? '\u25d1' : ''),
            U.el('span', { class: 'ing-name' }, food.name),
            U.el('span', { class: 'ing-qty mono' }, U.fmtQty(need, food.unit))
          ]));
        });
        body.appendChild(ingList);
        body.appendChild(U.el('p', { class: 'legend muted' }, '\u2713 in your pantry \u00b7 \u25d1 partly \u2014 based on estimated-fresh stock'));

        body.appendChild(U.el('h3', { class: 'sub' }, 'Steps'));
        const steps = U.el('ol', { class: 'steps' });
        recipe.steps.forEach((s) => steps.appendChild(U.el('li', {}, s)));
        body.appendChild(steps);

        if (recipe.tip) {
          body.appendChild(U.el('p', { class: 'tip' }, [U.el('b', {}, 'Tip \u00b7 '), recipe.tip]));
        }

        if (o.allowAdd !== false) {
          body.appendChild(U.el('div', { class: 'sheet-actions' }, [
            U.el('button', { class: 'btn primary wide', onclick: () => { close(); addToPlanFlow(recipe); } }, 'Add to this week\u2019s plan')
          ]));
        }
      }
    });
  }

  function addToPlanFlow(recipe) {
    const plan = planner.current();
    if (!plan) { ui.toast('Generate a plan first \u2014 then you can slot recipes in.', 'warn'); return; }
    ui.sheet({
      title: 'Add \u201c' + recipe.name + '\u201d',
      render(body, close) {
        plan.days.forEach((day, di) => {
          const row = U.el('div', { class: 'slot-pick-day' });
          row.appendChild(U.el('div', { class: 'slot-pick-date' }, U.fmtDateLong(day.date)));
          const btns = U.el('div', { class: 'chip-row tight' });
          Object.keys(day.slots).forEach((slot) => {
            if (!recipe.meal.includes(slot)) return;
            btns.appendChild(ui.chip(ui.slotLabel(slot), {
              small: true,
              onclick: () => {
                planner.setSlot(di, slot, recipe.id);
                close();
                ui.toast('Added to ' + U.fmtDate(day.date) + ' \u00b7 ' + slot);
                if (g.SL.router) g.SL.router.rerender(); else render(U.$('#view'));
              }
            }));
          });
          if (btns.children.length) { row.appendChild(btns); body.appendChild(row); }
        });
        if (!body.children.length) body.appendChild(U.el('p', { class: 'muted' }, 'This recipe doesn\u2019t fit the meal slots in your current plan settings.'));
      }
    });
  }

  /* ---------- swap sheet ---------- */
  function openSwap(dayIndex, slot, currentId) {
    const alts = planner.alternatives(slot, currentId, 10);
    ui.sheet({
      title: 'Swap ' + slot,
      tall: true,
      render(body, close) {
        if (currentId) {
          body.appendChild(U.el('button', {
            class: 'btn ghost wide',
            onclick: () => { planner.setSlot(dayIndex, slot, null); close(); render(U.$('#view')); ui.toast('Slot cleared'); }
          }, 'Leave this slot empty'));
        }
        if (!alts.length) {
          body.appendChild(U.el('p', { class: 'muted' }, 'No other recipes match your diet and allergen settings for this slot. Loosen a filter in preferences to see more.'));
          return;
        }
        alts.forEach((r) => {
          const n = nutrition.perServing(r);
          body.appendChild(U.el('button', {
            class: 'swap-row', type: 'button',
            onclick: () => { planner.setSlot(dayIndex, slot, r.id); close(); render(U.$('#view')); ui.toast('Swapped in ' + r.name); }
          }, [
            U.el('span', { class: 'recipe-emoji sm', 'aria-hidden': 'true' }, r.emoji),
            U.el('span', { class: 'swap-name' }, [U.el('b', {}, r.name), U.el('small', { class: 'muted' }, r.cuisine + ' \u00b7 ' + r.time + ' min')]),
            ui.tag(U.el('b', {}, n.cal + ' cal'))
          ]));
        });
      }
    });
  }

  /* ---------- expiring strip ---------- */
  function expiringStrip() {
    const soon = inv.expiringSoon(4);
    if (!soon.length) return null;
    const strip = U.el('div', { class: 'card use-up' });
    strip.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, 'Use these up'),
      U.el('span', { class: 'muted small' }, 'drives this week\u2019s picks')
    ]));
    const row = U.el('div', { class: 'scroll-row' });
    soon.slice(0, 10).forEach(({ item, days }) => {
      const food = FOODS.byId(item.foodId);
      row.appendChild(U.el('button', {
        class: 'use-up-item', type: 'button',
        onclick: () => {
          const suggestions = planner.recipesUsing(item.foodId, 5);
          ui.sheet({
            title: 'Cook the ' + food.name.toLowerCase(),
            render(body) {
              if (!suggestions.length) {
                body.appendChild(U.el('p', { class: 'muted' }, 'No matching recipes under your current filters.'));
                return;
              }
              suggestions.forEach((r) => {
                body.appendChild(U.el('button', {
                  class: 'swap-row', type: 'button',
                  onclick: () => openRecipe(r)
                }, [
                  U.el('span', { class: 'recipe-emoji sm', 'aria-hidden': 'true' }, r.emoji),
                  U.el('span', { class: 'swap-name' }, [U.el('b', {}, r.name), U.el('small', { class: 'muted' }, r.cuisine + ' \u00b7 ' + r.time + ' min')])
                ]));
              });
            }
          });
        }
      }, [
        U.el('span', { class: 'use-up-name' }, food.name),
        ui.expiryTag(days)
      ]));
    });
    strip.appendChild(row);
    return strip;
  }

  /* ---------- main render ---------- */
  function render(container) {
    container.innerHTML = '';
    const plan = planner.current();
    const p = planner.prefs();

    const headerAside = U.el('button', { class: 'btn small ghost', onclick: () => ui.editPrefs(() => render(container)) }, 'Preferences');
    container.appendChild(ui.header('This week', 'Meal plan', headerAside));

    const prefSummary = [];
    if (p.diets.length) prefSummary.push(p.diets.map((d) => ui.DIET_LABELS[d]).join(', '));
    if (p.allergens.length) prefSummary.push('no ' + p.allergens.join(', '));
    if (p.cuisines.length) prefSummary.push('loves ' + p.cuisines.join(', '));
    prefSummary.push(p.servings + ' ' + U.plural(p.servings, 'serving') + '/meal');
    container.appendChild(U.el('p', { class: 'pref-line muted' }, prefSummary.join(' \u00b7 ')));

    const strip = expiringStrip();
    if (strip) container.appendChild(strip);

    if (!plan) {
      container.appendChild(ui.empty({
        emoji: '\u{1F4C5}',
        title: 'No plan yet',
        text: 'Set your diet, allergens and favorite cuisines, then generate a week. Anything already in your pantry \u2014 especially food about to turn \u2014 gets picked first.',
        actionLabel: 'Generate this week',
        onAction: () => { planner.generate(); render(container); ui.toast('Week planned'); }
      }));
      return;
    }

    const bar = U.el('div', { class: 'btn-row' }, [
      U.el('button', { class: 'btn primary', onclick: () => { planner.generate(); render(container); ui.toast('Regenerated with fresh picks'); } }, 'Regenerate'),
      U.el('button', { class: 'btn ghost', onclick: () => { g.location.hash = '#/shop'; } }, 'Shopping list \u2192')
    ]);
    container.appendChild(bar);

    plan.days.forEach((day, di) => {
      const card = U.el('section', { class: 'card day-card' });
      const dayN = planner.dayNutrition(day);
      card.appendChild(U.el('div', { class: 'day-head' }, [
        U.el('h3', {}, U.fmtDateLong(day.date)),
        U.el('span', { class: 'mono muted small' }, dayN.cal + ' cal \u00b7 ' + dayN.p + 'P/' + dayN.c + 'C/' + dayN.f + 'F per person')
      ]));

      Object.entries(day.slots).forEach(([slot, entry]) => {
        const row = U.el('div', { class: 'meal-row' + (entry && entry.cooked ? ' cooked' : '') });
        row.appendChild(U.el('span', { class: 'meal-slot small-caps' }, slot));

        if (!entry) {
          row.appendChild(U.el('button', { class: 'meal-empty', type: 'button', onclick: () => openSwap(di, slot, null) }, '+ pick a recipe'));
          card.appendChild(row);
          return;
        }

        const recipe = RECIPES.byId(entry.recipeId);
        const n = nutrition.perServing(recipe);
        row.appendChild(U.el('button', {
          class: 'meal-main', type: 'button', onclick: () => openRecipe(recipe)
        }, [
          U.el('span', { class: 'recipe-emoji sm', 'aria-hidden': 'true' }, recipe.emoji),
          U.el('span', { class: 'meal-name' }, [
            U.el('b', {}, recipe.name),
            U.el('small', { class: 'muted' }, recipe.time + ' min \u00b7 ' + n.cal + ' cal/serving')
          ])
        ]));

        const actions = U.el('span', { class: 'meal-actions' });
        actions.appendChild(U.el('button', {
          class: 'icon-btn', title: 'Swap recipe', 'aria-label': 'Swap ' + slot,
          onclick: () => openSwap(di, slot, entry.recipeId)
        }, '\u21c4'));
        actions.appendChild(U.el('button', {
          class: 'icon-btn' + (entry.cooked ? ' done' : ''),
          title: entry.cooked ? 'Cooked' : 'Mark cooked (uses pantry stock)',
          'aria-label': 'Mark ' + slot + ' cooked',
          onclick: () => {
            if (entry.cooked) return;
            const consumed = planner.markCooked(di, slot);
            render(container);
            ui.toast(consumed.length ? 'Nice \u2014 pantry updated (' + consumed.length + ' ingredients used)' : 'Marked cooked');
          }
        }, entry.cooked ? '\u2713' : '\u{1F373}'));
        row.appendChild(actions);
        card.appendChild(row);
      });

      container.appendChild(card);
    });
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.plan = { render, openRecipe };
})(typeof window !== 'undefined' ? window : globalThis);
