/* ShelfLife — views/views-shop.js
   List -> compare -> cart -> pantry.
   The optimizer prices the whole basket at every nearby store (substituting
   where allowed) and recommends one store — or a two-store split when the
   second stop genuinely earns its trip. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const ui = g.SL.ui;
  const FOODS = g.SL.foods;
  const STORES = g.SL.stores;
  const shopping = g.SL.shopping;
  const planner = g.SL.planner;
  const inv = g.SL.inventory;

  let lastOptions = null; // ephemeral optimizer results for this visit

  /* ---------- list section ---------- */
  function lineRow(list, line, container) {
    const food = FOODS.byId(line.foodId);
    const row = U.el('div', { class: 'list-row' + (line.checked ? '' : ' unchecked') });

    const check = U.el('button', {
      class: 'check ' + (line.checked ? 'on' : ''), type: 'button',
      'aria-label': (line.checked ? 'Skip ' : 'Include ') + food.name,
      onclick: () => { line.checked = !line.checked; shopping.saveList(list); lastOptions = null; render(container); }
    }, line.checked ? '\u2713' : '');
    row.appendChild(check);

    const info = U.el('div', { class: 'list-info' });
    info.appendChild(U.el('b', {}, food.name));
    const bits = [];
    if (line.needQty) bits.push('need ' + U.fmtQty(line.needQty, food.unit));
    if (line.haveQty > 0) bits.push('have ' + U.fmtQty(line.haveQty, food.unit));
    bits.push(food.pkg.label);
    info.appendChild(U.el('small', { class: 'muted' }, bits.join(' \u00b7 ')));
    row.appendChild(info);

    row.appendChild(ui.stepper(line.packages, 1, 12, (v) => {
      line.packages = v; shopping.saveList(list); lastOptions = null;
      const cartExists = shopping.cart();
      if (cartExists) { shopping.clearCart(); render(container); }
    }));
    return row;
  }

  function listCard(container) {
    const card = U.el('section', { class: 'card' });
    const list = shopping.currentList();
    const plan = planner.current();

    card.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, 'Shopping list'),
      U.el('button', {
        class: 'btn small ghost',
        onclick: () => {
          if (!plan) { ui.toast('Generate a meal plan first.', 'warn'); return; }
          shopping.buildList(); shopping.clearCart(); lastOptions = null; render(container);
          ui.toast('List rebuilt from your plan & pantry');
        }
      }, list ? 'Rebuild from plan' : 'Build from plan')
    ]));

    if (!list) {
      card.appendChild(U.el('p', { class: 'muted' },
        plan
          ? 'Build the list and it will only include what your plan needs beyond what\u2019s already fresh in the pantry.'
          : 'No plan yet. Generate one on the Plan tab, then build your list here.'));
      return card;
    }

    card.appendChild(U.el('p', { class: 'muted small' },
      'Built ' + U.fmtDate(list.generatedISO.slice(0, 10)) + ' \u00b7 pantry stock already subtracted. Uncheck anything you\u2019ll skip.'));

    if (!list.lines.length && !list.extras.length && !list.staples.length) {
      card.appendChild(U.el('p', {}, 'Your pantry covers the whole plan. Zero shopping needed this week \u{1F389}'));
    }

    let currentCat = null;
    list.lines.forEach((line) => {
      const food = FOODS.byId(line.foodId);
      if (food.cat !== currentCat) {
        currentCat = food.cat;
        card.appendChild(U.el('div', { class: 'aisle-label small-caps' }, FOODS.catLabel(currentCat)));
      }
      card.appendChild(lineRow(list, line, container));
    });

    if (list.extras.length) {
      card.appendChild(U.el('div', { class: 'aisle-label small-caps' }, 'Added by you'));
      list.extras.forEach((line) => card.appendChild(lineRow(list, line, container)));
    }

    if (list.staples.length) {
      const det = U.el('details', { class: 'staples' });
      det.appendChild(U.el('summary', {}, 'Staples check (' + list.staples.length + ') \u2014 you probably have these'));
      list.staples.forEach((line) => det.appendChild(lineRow(list, line, container)));
      card.appendChild(det);
    }

    card.appendChild(U.el('button', {
      class: 'btn ghost wide',
      onclick: () => ui.pickFood('Add to shopping list', (food) => {
        shopping.addExtra(food.id, 1); lastOptions = null; render(container);
        ui.toast(food.name + ' added');
      })
    }, '+ Add an item'));

    return card;
  }

  /* ---------- optimizer section ---------- */
  function optionCard(opt, container, isBest) {
    const names = opt.stores.map((s) => s.name).join(' + ');
    const dealCount = opt.quotes.filter((q) => q.deal).length;
    const subCount = opt.quotes.filter((q) => q.sub).length;

    const box = U.el('div', { class: 'option' + (isBest ? ' best' : '') });
    box.appendChild(U.el('div', { class: 'option-head' }, [
      U.el('div', {}, [
        U.el('b', {}, names),
        U.el('small', { class: 'muted' }, opt.stores.map((s) => s.delivery ? 'delivery' : s.dist + ' mi').join(' \u00b7 '))
      ]),
      ui.tag(U.el('b', {}, U.money(opt.total)), isBest ? 'deal' : null)
    ]));

    const facts = [];
    facts.push(Math.round(opt.coverage * 100) + '% of list');
    if (opt.fee) facts.push('incl. ' + U.money(opt.fee) + ' delivery fee');
    if (dealCount) facts.push(dealCount + ' ' + U.plural(dealCount, 'deal'));
    if (subCount) facts.push(subCount + ' ' + U.plural(subCount, 'substitute'));
    if (opt.missing.length) facts.push(opt.missing.length + ' unavailable');
    box.appendChild(U.el('p', { class: 'muted small' }, facts.join(' \u00b7 ')));

    box.appendChild(U.el('button', {
      class: 'btn ' + (isBest ? 'primary' : 'ghost') + ' wide',
      onclick: () => { shopping.setCart(opt); lastOptions = null; render(container); ui.toast('Cart built \u2014 review below'); }
    }, 'Shop this plan'));
    return box;
  }

  function optimizerCard(container) {
    const card = U.el('section', { class: 'card' });
    const p = planner.prefs();
    card.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, 'Compare stores'),
      U.el('button', { class: 'btn small ghost', onclick: () => ui.editPrefs(() => { lastOptions = null; render(container); }) },
        p.zip ? 'ZIP ' + p.zip : 'Set ZIP')
    ]));

    card.appendChild(U.el('p', { class: 'muted small' },
      'Simulated stores & prices, seeded by your ZIP \u2014 the comparison, deals and substitutions are real logic on demo data. See About for wiring real store APIs.'));

    const list = shopping.currentList();
    const active = list ? shopping.activeLines(list) : [];
    if (!active.length) {
      card.appendChild(U.el('p', { class: 'muted' }, 'Check at least one item on the list to compare stores.'));
      return card;
    }

    if (!p.zip) {
      card.appendChild(U.el('button', { class: 'btn primary wide', onclick: () => ui.editPrefs(() => { lastOptions = null; render(container); }) }, 'Add your ZIP to find stores'));
      return card;
    }

    if (!lastOptions) {
      card.appendChild(U.el('button', {
        class: 'btn primary wide',
        onclick: () => { lastOptions = shopping.optimize(); render(container); }
      }, 'Compare ' + STORES.nearbyStores(p.zip).length + ' nearby stores'));
      return card;
    }

    const o = lastOptions;
    if (o.best) {
      const isPair = o.best.stores.length === 2;
      card.appendChild(U.el('div', { class: 'best-label small-caps' }, isPair ? 'Best plan \u00b7 two stops' : 'Best plan \u00b7 one stop'));
      card.appendChild(optionCard(o.best, container, true));
      if (o.avgSingle > o.best.total + 0.5) {
        card.appendChild(U.el('p', { class: 'save-note mono' }, 'saves ' + U.money(o.avgSingle - o.best.total) + ' vs the average single store'));
      }
    }

    const others = [...o.singles, ...o.pairs]
      .filter((x) => x !== o.best)
      .sort((a, b) => (b.coverage - a.coverage) || (a.total - b.total))
      .slice(0, 4);
    if (others.length) {
      const det = U.el('details');
      det.appendChild(U.el('summary', {}, 'Other options (' + others.length + ')'));
      others.forEach((opt) => det.appendChild(optionCard(opt, container, false)));
      card.appendChild(det);
    }
    return card;
  }

  /* ---------- cart section ---------- */
  function cartCard(container) {
    const c = shopping.cart();
    if (!c) return null;
    const card = U.el('section', { class: 'card cart' });
    card.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, 'Cart'),
      U.el('button', { class: 'btn small ghost', onclick: () => { shopping.clearCart(); render(container); } }, 'Clear')
    ]));

    c.storeIds.forEach((storeId, idx) => {
      const quotes = c.quotes.filter((q) => q.storeId === storeId);
      if (!quotes.length) return;
      card.appendChild(U.el('div', { class: 'aisle-label small-caps' }, c.storeNames[idx]));
      quotes.forEach((q) => {
        const food = FOODS.byId(q.boughtAs);
        const orig = FOODS.byId(q.foodId);
        const row = U.el('div', { class: 'cart-row' });
        row.appendChild(U.el('div', { class: 'list-info' }, [
          U.el('b', {}, food.name + (q.packages > 1 ? ' \u00d7' + q.packages : '')),
          U.el('small', { class: 'muted' }, food.pkg.label + (q.sub ? ' \u00b7 substitute for ' + orig.name : ''))
        ]));
        const tags = U.el('span', { class: 'cart-tags' });
        if (q.sub) tags.appendChild(ui.tag('sub', 'soon'));
        tags.appendChild(ui.priceTag(q.cost, q.deal ? { ...q.deal, was: q.deal.was * q.packages } : null));
        row.appendChild(tags);
        card.appendChild(row);
      });
    });

    if (c.missing.length) {
      card.appendChild(U.el('p', { class: 'muted small' },
        'Not available on this run: ' + c.missing.map((id) => FOODS.byId(id).name).join(', ') + '. They stay on your list.'));
    }

    const totals = U.el('div', { class: 'cart-total' });
    if (c.fee) totals.appendChild(U.el('div', { class: 'cart-total-row muted' }, [U.el('span', {}, 'Delivery fee'), U.el('span', { class: 'mono' }, U.money(c.fee))]));
    totals.appendChild(U.el('div', { class: 'cart-total-row grand' }, [U.el('span', {}, 'Estimated total'), U.el('span', { class: 'mono' }, U.money(c.total))]));
    card.appendChild(totals);

    card.appendChild(U.el('button', {
      class: 'btn primary wide',
      onclick: () => confirmPurchase(container)
    }, 'Mark purchased \u2192 pantry'));
    card.appendChild(U.el('p', { class: 'muted small center' }, 'ShelfLife doesn\u2019t take payment \u2014 this files the haul into your pantry with estimated dates.'));
    return card;
  }

  function confirmPurchase(container) {
    const c = shopping.cart();
    if (!c) return;
    const overrides = {};
    ui.sheet({
      title: 'Where is it going?',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'Each item gets an estimated use-by date based on where you store it. You can adjust anything later in the pantry.'));
        c.quotes.forEach((q) => {
          const food = FOODS.byId(q.boughtAs);
          const row = U.el('div', { class: 'store-pick-row' });
          row.appendChild(U.el('span', { class: 'list-info' }, [
            U.el('b', {}, food.name + (q.packages > 1 ? ' \u00d7' + q.packages : ''))
          ]));
          const sel = U.el('select', { class: 'select', 'aria-label': 'Storage for ' + food.name });
          ['pantry', 'fridge', 'freezer'].forEach((st) => {
            const opt = U.el('option', { value: st }, FOODS.STORAGE_LABELS[st]);
            if (st === food.storage) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.addEventListener('change', () => { overrides[q.boughtAs] = sel.value; });
          row.appendChild(sel);
          body.appendChild(row);
        });
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Back'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => {
              const added = shopping.purchase(overrides);
              close();
              render(container);
              ui.toast(added.length + ' items filed into your pantry');
            }
          }, 'Confirm purchase')
        ]));
      }
    });
  }

  function historyCard() {
    const h = shopping.history();
    if (!h.length) return null;
    const card = U.el('section', { class: 'card' });
    card.appendChild(U.el('h3', { class: 'card-title' }, 'Past shops'));
    h.slice(0, 5).forEach((entry) => {
      card.appendChild(U.el('div', { class: 'history-row' }, [
        U.el('span', {}, [U.el('b', {}, entry.stores.join(' + ')), U.el('small', { class: 'muted' }, ' \u00b7 ' + entry.items + ' items')]),
        U.el('span', { class: 'mono' }, U.money(entry.total) + ' \u00b7 ' + U.fmtDate(entry.iso.slice(0, 10)))
      ]));
    });
    return card;
  }

  function render(container) {
    container.innerHTML = '';
    container.appendChild(ui.header('Buy smart', 'Shop'));
    container.appendChild(listCard(container));
    const cart = cartCard(container);
    container.appendChild(optimizerCard(container));
    if (cart) container.appendChild(cart);
    const hist = historyCard();
    if (hist) container.appendChild(hist);
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.shop = { render };
})(typeof window !== 'undefined' ? window : globalThis);
