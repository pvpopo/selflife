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
  let compareQueued = false; // set by the Plan tab's approve flow

  /* Pull live store data (Walmart matches, Kroger locations + stock) for the
     active list so the synchronous optimizer can read it from the caches. */
  async function warmLive(list) {
    // discover real nearby stores first so the optimizer prices against them
    if (g.SL.places) {
      try { await g.SL.places.ensure(planner.prefs()); } catch (e) { /* roster falls back to demo */ }
    }
    const items = g.SL.agent.itemsFromList(shopping.activeLines(list), FOODS);
    const jobs = [];
    const CL = g.SL.cartlink;
    if (CL && CL.canResolve()) jobs.push(CL.resolveIds(items));
    if (g.SL.kroger && g.SL.kroger.enabled()) jobs.push(g.SL.kroger.warm(planner.prefs().zip, items));
    if (!jobs.length) return;
    const results = await Promise.allSettled(jobs);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) ui.toast((failed.reason && failed.reason.message) || 'Some live store data is unavailable right now.', 'warn');
  }

  function anyLiveLane() {
    return (g.SL.cartlink && g.SL.cartlink.canResolve()) || (g.SL.kroger && g.SL.kroger.enabled());
  }

  /* ---------- where are you shopping? ---------- */
  function locationSheet(container) {
    const PL = g.SL.places;
    ui.sheet({
      title: 'Where are you shopping?',
      render(body, close) {
        const p = planner.prefs();
        const status = U.el('p', { class: 'muted small', 'aria-live': 'polite' },
          typeof p.lat === 'number'
            ? 'Currently: ' + (p.place || p.lat + ', ' + p.lon) + ' — real stores within ' + (p.radiusMi || 5) + ' miles via OpenStreetMap.'
            : 'No location set — the store comparison uses a simulated demo roster until you set one.');
        body.appendChild(status);

        async function saveLocation(loc) {
          const cur = planner.prefs();
          cur.lat = loc.lat; cur.lon = loc.lon; cur.place = loc.place || cur.place;
          if (loc.zip) cur.zip = loc.zip;
          planner.savePrefs(cur);
          status.textContent = 'Finding grocery stores near ' + (loc.place || 'you') + '…';
          try {
            const entry = await PL.ensure(planner.prefs());
            close(); render(container);
            ui.toast(entry && entry.stores.length
              ? 'Found ' + entry.stores.length + ' real stores near ' + (loc.place || 'you')
              : 'No supermarkets found in range — try a bigger radius', entry && entry.stores.length ? undefined : 'warn');
          } catch (e) { status.textContent = e.message; }
        }

        body.appendChild(U.el('button', {
          class: 'btn primary wide',
          onclick: async (ev) => {
            ev.currentTarget.disabled = true;
            status.textContent = 'Looking up your location…';
            try {
              const loc = await PL.locate();
              status.textContent = 'You’re near ' + (loc.place || (loc.lat + ', ' + loc.lon)) + (loc.zip ? ' (' + loc.zip + ')' : '') + '.';
              await saveLocation(loc);
            } catch (e) { status.textContent = e.message; ev.currentTarget && (ev.currentTarget.disabled = false); }
          }
        }, '📍 Use my current location'));

        body.appendChild(U.el('div', { class: 'divider-or' }, 'or by ZIP'));
        const zipIn = U.el('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: 'ZIP code', value: p.zip || '' });
        body.appendChild(zipIn);
        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: async () => {
            status.textContent = 'Looking up that ZIP…';
            try { await saveLocation(await PL.geocodeZip(zipIn.value)); }
            catch (e) { status.textContent = e.message; }
          }
        }, 'Find stores near this ZIP'));

        const radWrap = U.el('div', { class: 'field' });
        radWrap.appendChild(U.el('label', { class: 'field-label' }, 'Search radius'));
        const radRow = U.el('div', { class: 'chip-row' });
        [2, 5, 10, 20].forEach((mi) => {
          radRow.appendChild(ui.chip(mi + ' mi', {
            small: true, active: (p.radiusMi || 5) === mi,
            onclick: async () => {
              const cur = planner.prefs();
              cur.radiusMi = mi;
              planner.savePrefs(cur);
              if (typeof cur.lat === 'number') {
                status.textContent = 'Re-searching within ' + mi + ' miles…';
                try { const entry = await PL.ensure(planner.prefs()); close(); render(container); ui.toast('Found ' + (entry ? entry.stores.length : 0) + ' stores within ' + mi + ' mi'); }
                catch (e) { status.textContent = e.message; }
              } else { close(); locationSheet(container); }
            }
          }));
        });
        radWrap.appendChild(radRow);
        body.appendChild(radWrap);

        body.appendChild(U.el('p', { class: 'muted small' },
          'Store discovery uses OpenStreetMap — free and privacy-friendly; your coordinates stay on this device except for the map lookups themselves.'));
      }
    });
  }

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
        U.el('small', { class: 'muted' }, opt.stores.map((s) => s.delivery ? 'delivery' : (s.liveNote || (s.online ? 'live' : s.dist + ' mi'))).join(' \u00b7 '))
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

    const liveLanes = [];
    if (g.SL.cartlink && g.SL.cartlink.canResolve()) liveLanes.push('Walmart (walmart.com prices)');
    if (g.SL.kroger && g.SL.kroger.enabled()) liveLanes.push('Kroger (per-store stock)');
    const realRoster = g.SL.places && g.SL.places.cachedFor();
    card.appendChild(U.el('p', { class: 'muted small' },
      realRoster
        ? 'These are real stores near ' + (realRoster.place || 'you') + ' (OpenStreetMap). ' + (liveLanes.length ? liveLanes.join(' and ') + ' pricing is live; other stores show estimates until their APIs are wired.' : 'Prices are estimates until retailer APIs are wired \u2014 see About.')
        : liveLanes.length
          ? liveLanes.join(' and ') + (liveLanes.length === 1 ? ' is' : ' are') + ' live. The remaining stores are a simulated demo (seeded by your ZIP) \u2014 set a location (\ud83d\udccd above) for real nearby stores.'
          : 'Simulated demo stores \u2014 tap \ud83d\udccd above to pull real grocery stores near you. Prices stay estimates until retailer APIs are wired.'));

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
        onclick: async (e) => {
          const btn = e.currentTarget;
          if (anyLiveLane()) {
            btn.disabled = true;
            btn.textContent = 'Checking live store prices…';
            await warmLive(list);
          }
          lastOptions = shopping.optimize();
          render(container);
        }
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

  /* ---------- real-store hand-off (brief for an AI browsing agent) ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    // fallback for older mobile browsers
    const ta = U.el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function agentSheet(cart, lines) {
    const AG = g.SL.agent;
    const p = planner.prefs();
    const items = cart ? AG.itemsFromCart(cart, FOODS) : AG.itemsFromList(lines, FOODS);
    const budget = cart ? cart.total : null;
    let retailerId = AG.RETAILERS[0].id;
    let mode = 'pickup';

    ui.sheet({
      title: 'Hand off to an AI agent',
      tall: true,
      render(body) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'This brief tells a browsing agent (Claude with the Chrome extension, or any computer-use agent) exactly what to put in your cart on the real store’s site — and where to stop. It never checks out or touches payment; you review the cart and place the order yourself.'));

        const pre = U.el('pre', { class: 'brief-preview mono' });
        function refresh() {
          pre.textContent = AG.buildBrief({ retailerId, mode, zip: p.zip, items, budget });
        }

        const storeWrap = U.el('div', { class: 'field' });
        storeWrap.appendChild(U.el('label', { class: 'field-label' }, 'Store'));
        const storeRow = U.el('div', { class: 'chip-row' });
        function drawStores() {
          storeRow.innerHTML = '';
          AG.RETAILERS.forEach((r) => {
            storeRow.appendChild(ui.chip(r.name, {
              active: retailerId === r.id,
              onclick: () => { retailerId = r.id; drawStores(); refresh(); }
            }));
          });
        }
        drawStores();
        storeWrap.appendChild(storeRow);
        body.appendChild(storeWrap);

        const modeWrap = U.el('div', { class: 'field' });
        modeWrap.appendChild(U.el('label', { class: 'field-label' }, 'Fulfillment'));
        const modeRow = U.el('div', { class: 'chip-row' });
        function drawModes() {
          modeRow.innerHTML = '';
          [['pickup', 'Pickup'], ['delivery', 'Delivery']].forEach(([m, label]) => {
            modeRow.appendChild(ui.chip(label, {
              active: mode === m,
              onclick: () => { mode = m; drawModes(); refresh(); }
            }));
          });
        }
        drawModes();
        modeWrap.appendChild(modeRow);
        body.appendChild(modeWrap);

        body.appendChild(pre);
        refresh();

        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', {
            class: 'btn ghost',
            onclick: () => {
              const blob = new Blob([pre.textContent], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = U.el('a', { href: url, download: 'shelflife-agent-brief.md' });
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
            }
          }, '↓ Download .md'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => copyText(pre.textContent).then(() => ui.toast('Brief copied — paste it to your agent'))
          }, 'Copy brief')
        ]));
      }
    });
  }

  function walmartSheet(items) {
    const CL = g.SL.cartlink;
    ui.sheet({
      title: 'Shop this at Walmart',
      tall: true,
      render(body) {
        function draw(status) {
          body.innerHTML = '';
          const { mapped, unmapped } = CL.splitItems(items);

          if (status) body.appendChild(U.el('p', { class: 'muted small resolving' }, status));

          if (mapped.length) {
            const all = !unmapped.length;
            body.appendChild(U.el('p', { class: 'muted small' },
              all
                ? 'All ' + mapped.length + ' items matched. One tap fills your Walmart cart — then just review it on walmart.com and check out with your payment there.'
                : mapped.length + ' of ' + items.length + ' items matched — one tap adds them to your Walmart cart.'));
            body.appendChild(U.el('a', {
              class: 'btn primary wide', target: '_blank', rel: 'noopener',
              href: CL.cartUrl(items)
            }, '\u{1F6D2} Add ' + (all ? 'all ' : '') + mapped.length + ' ' + U.plural(mapped.length, 'item') + ' to Walmart cart'));
          }

          if (unmapped.length) {
            body.appendChild(U.el('p', { class: 'muted small' },
              (mapped.length ? 'The remaining ' + unmapped.length + ' open' : 'Each item opens') + ' as a Walmart search — tap through, pick your product, add to cart.'
              + (CL.canResolve() ? '' : ' (Deploy the Walmart matcher in proxy/walmart-worker.js and every item becomes one-tap — see README.)')));
            const listEl = U.el('div', { class: 'picker-list' });
            unmapped.forEach((it) => {
              listEl.appendChild(U.el('a', {
                class: 'picker-row', target: '_blank', rel: 'noopener',
                href: CL.searchUrl(it.name)
              }, [
                U.el('span', {}, [U.el('b', {}, it.name), U.el('small', { class: 'muted' }, ' · ' + it.qty + ' × ' + it.pkg)]),
                U.el('span', { class: 'muted small-caps' }, 'search ↗')
              ]));
            });
            body.appendChild(listEl);
          }

          body.appendChild(U.el('p', { class: 'muted small center' },
            'Everything happens in your own Walmart session — ShelfLife never sees your account or payment. Prices on walmart.com are the real ones and may differ from the estimate.'));
        }

        // first paint with whatever is already known, then auto-match the rest
        const needsResolve = CL.canResolve() && CL.splitItems(items).unmapped.length > 0;
        draw(needsResolve ? 'Matching your items to Walmart products…' : null);
        if (needsResolve) {
          CL.resolveIds(items)
            .then((learned) => { draw(null); if (learned) ui.toast(learned + ' items matched to Walmart products'); })
            .catch((e) => { draw(null); ui.toast(e.message, 'warn'); });
        }
      }
    });
  }

  function agentCard() {
    const c = shopping.cart();
    const list = shopping.currentList();
    const lines = list ? shopping.activeLines(list) : [];
    if (!c && !lines.length) return null;
    const AG = g.SL.agent;
    const items = c ? AG.itemsFromCart(c, FOODS) : AG.itemsFromList(lines, FOODS);
    const card = U.el('section', { class: 'card' });
    card.appendChild(U.el('h3', { class: 'card-title' }, 'Shop it for real'));
    card.appendChild(U.el('p', { class: 'muted small' },
      (c ? 'Take this cart' : 'Take your list') + ' to a real store. Walmart items open in your own browser session — no AI involved, you review and place the order.'
      + (c ? '' : ' Tip: build a cart above first to include the optimizer’s substitutions and budget.')));
    card.appendChild(U.el('button', {
      class: 'btn primary wide',
      onclick: () => walmartSheet(items)
    }, 'Shop at Walmart'));
    card.appendChild(U.el('button', { class: 'btn ghost wide', onclick: () => agentSheet(c, lines) }, '\u{1F916} Or hand off to an AI agent'));
    return card;
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
    // arriving from "Approve week": run the store comparison automatically
    if (compareQueued) {
      compareQueued = false;
      const list = shopping.currentList();
      if (list && shopping.activeLines(list).length && planner.prefs().zip && !shopping.cart()) {
        lastOptions = shopping.optimize();
      }
    }
    container.innerHTML = '';
    const p0 = planner.prefs();
    const locLabel = (typeof p0.lat === 'number')
      ? '📍 ' + (p0.place || 'Located') + ' · ' + (p0.radiusMi || 5) + ' mi'
      : '📍 Set location';
    container.appendChild(ui.header('Buy smart', 'Shop',
      U.el('button', { class: 'btn small ghost', onclick: () => locationSheet(container) }, locLabel)));
    container.appendChild(listCard(container));
    const cart = cartCard(container);
    container.appendChild(optimizerCard(container));
    if (cart) container.appendChild(cart);
    const agent = agentCard();
    if (agent) container.appendChild(agent);
    const hist = historyCard();
    if (hist) container.appendChild(hist);
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.shop = { render, warmLive, queueCompare: () => { compareQueued = true; lastOptions = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
