/* ShelfLife — views/views-pantry.js
   What you own, where it lives, and when it's *estimated* to turn.
   Two intake paths: receipt scan (OCR in the browser, always user-reviewed)
   and manual add. Expiry drives the planner; the disclaimer keeps it honest. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const ui = g.SL.ui;
  const FOODS = g.SL.foods;
  const inv = g.SL.inventory;
  const receipt = g.SL.receipt;
  const planner = g.SL.planner;

  /* ---------- disclaimer ---------- */
  function disclaimerBanner() {
    return U.el('div', { class: 'disclaimer', role: 'note' }, [
      U.el('span', { class: 'disclaimer-icon', 'aria-hidden': 'true' }, '\u26A0\uFE0F'),
      U.el('p', {}, [
        U.el('b', {}, 'Dates are guesstimates. '),
        'Trust your senses \u2014 smell, taste, color, texture \u2014 over any date here. ',
        U.el('button', { class: 'link-btn', onclick: showDisclaimer }, 'How to check')
      ])
    ]);
  }

  function showDisclaimer() {
    ui.sheet({
      title: 'About these dates',
      render(body) {
        body.appendChild(U.el('p', { class: 'sheet-text' }, inv.DISCLAIMER));
        body.appendChild(U.el('p', { class: 'sheet-text' },
          'Every item\u2019s detail view includes what spoilage actually looks like for that food. ' +
          '\u201cPast estimate\u201d means the guess ran out \u2014 it does not automatically mean the food is bad, ' +
          'and food can also spoil early. When in doubt, throw it out.'));
      }
    });
  }

  /* ---------- item detail ---------- */
  function openItem(item, container) {
    const food = FOODS.byId(item.foodId);
    const st = inv.status(item);
    ui.sheet({
      title: food.name,
      tall: true,
      render(body, close) {
        const facts = U.el('div', { class: 'item-facts' });
        facts.appendChild(U.el('div', { class: 'item-fact' }, [U.el('span', { class: 'muted' }, 'Quantity'), U.el('b', { class: 'mono' }, U.fmtQty(item.qty, food.unit))]));
        facts.appendChild(U.el('div', { class: 'item-fact' }, [U.el('span', { class: 'muted' }, 'Purchased'), U.el('b', { class: 'mono' }, U.fmtDate(item.purchasedISO))]));
        facts.appendChild(U.el('div', { class: 'item-fact' }, [U.el('span', { class: 'muted' }, 'Est. use by'), ui.expiryTag(st.days)]));
        body.appendChild(facts);

        body.appendChild(U.el('h3', { class: 'sub' }, 'Is it still good?'));
        body.appendChild(U.el('p', { class: 'sheet-text' }, food.spoil));
        body.appendChild(U.el('p', { class: 'muted small' }, inv.DISCLAIMER));

        body.appendChild(U.el('h3', { class: 'sub' }, 'Storage'));
        const stRow = U.el('div', { class: 'chip-row' });
        ['pantry', 'fridge', 'freezer'].forEach((s) => {
          stRow.appendChild(ui.chip(FOODS.STORAGE_LABELS[s], {
            active: item.storage === s,
            onclick: () => {
              inv.update(item.id, { storage: s });
              close(); render(container);
              ui.toast('Moved to ' + s + ' \u2014 date re-estimated');
            }
          }));
        });
        body.appendChild(stRow);

        body.appendChild(U.el('div', { class: 'sheet-actions column' }, [
          U.el('button', {
            class: 'btn ghost wide',
            onclick: () => {
              inv.update(item.id, { expiresISO: U.iso(U.addDays(U.parseISO(item.expiresISO), 3)) });
              close(); render(container);
              ui.toast('Estimate extended 3 days \u2014 your call, your nose');
            }
          }, 'Looks fine \u2014 extend estimate +3 days'),
          U.el('button', {
            class: 'btn ghost wide',
            onclick: () => {
              const half = Math.max(0.5, Math.round(item.qty / 2));
              inv.update(item.id, { qty: item.qty - half });
              close(); render(container);
              ui.toast('Used ' + U.fmtQty(half, food.unit));
            }
          }, 'Used about half'),
          U.el('button', {
            class: 'btn danger wide',
            onclick: async () => {
              close();
              inv.remove(item.id);
              render(container);
              ui.toast('Removed from pantry');
            }
          }, st.level === 'past' ? 'Tossed it \u2014 remove' : 'All used up \u2014 remove')
        ]));
      }
    });
  }

  /* ---------- manual add ---------- */
  function addManually(container) {
    ui.pickFood('Add to pantry', (food) => {
      let packages = 1;
      let storage = food.storage;
      ui.sheet({
        title: food.name,
        render(body, close) {
          body.appendChild(U.el('div', { class: 'field row-between' }, [
            U.el('label', { class: 'field-label' }, 'How many \u00d7 ' + food.pkg.label + '?'),
            ui.stepper(1, 1, 12, (v) => { packages = v; })
          ]));
          const stWrap = U.el('div', { class: 'field' });
          stWrap.appendChild(U.el('label', { class: 'field-label' }, 'Stored in'));
          const row = U.el('div', { class: 'chip-row' });
          ['pantry', 'fridge', 'freezer'].forEach((s) => {
            const chip = ui.chip(FOODS.STORAGE_LABELS[s], {
              active: storage === s,
              onclick: () => {
                storage = s;
                U.$$('.chip', row).forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
              }
            });
            row.appendChild(chip);
          });
          stWrap.appendChild(row);
          body.appendChild(stWrap);
          body.appendChild(U.el('div', { class: 'sheet-actions' }, [
            U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
            U.el('button', {
              class: 'btn primary',
              onclick: () => {
                inv.addPurchases([{ foodId: food.id, packages, storage }], 'manual');
                close(); render(container);
                ui.toast(food.name + ' added \u00b7 est. date set');
              }
            }, 'Add to pantry')
          ]));
        }
      });
    });
  }

  /* ---------- receipt scan ---------- */
  function scanReceipt(container) {
    ui.sheet({
      title: 'Scan a receipt',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'Snap or upload a photo \u2014 text is read on your device and nothing is uploaded anywhere. You\u2019ll review every match before it lands in the pantry.'));

        const fileInput = U.el('input', { class: 'file-input', type: 'file', accept: 'image/*', id: 'receipt-file' });
        const fileBtn = U.el('label', { class: 'btn primary wide', for: 'receipt-file' }, '\u{1F4F8} Photo of receipt');
        const progress = U.el('p', { class: 'muted center', 'aria-live': 'polite' }, '');
        body.appendChild(fileBtn);
        body.appendChild(fileInput);
        body.appendChild(progress);

        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          progress.textContent = 'Loading OCR engine\u2026';
          try {
            const text = await receipt.scanImage(file, (pct) => { progress.textContent = 'Reading receipt\u2026 ' + pct + '%'; });
            close();
            reviewParsed(receipt.parseReceipt(text), container);
          } catch (err) {
            progress.textContent = err.message || 'Scan failed \u2014 try pasting the text below.';
          }
        });

        body.appendChild(U.el('div', { class: 'divider-or' }, 'or paste the text'));
        const ta = U.el('textarea', { class: 'input textarea', rows: '6', placeholder: 'CHKN BRST 9.49\\nSPINACH 5OZ 3.29\\n\u2026' });
        body.appendChild(ta);
        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: () => {
            const parsed = receipt.parseReceipt(ta.value);
            if (!parsed.length) { ui.toast('Couldn\u2019t find item lines in that text.', 'warn'); return; }
            close();
            reviewParsed(parsed, container);
          }
        }, 'Parse pasted text'));
      }
    });
  }

  function reviewParsed(parsed, container) {
    if (!parsed.length) {
      ui.toast('No item lines found on that receipt.', 'warn');
      return;
    }
    // rows: {raw, qty, match, storage, include}
    const rows = parsed.map((p) => ({
      raw: p.raw, text: p.text, qty: Math.max(1, p.qty || 1),
      match: p.match, include: !!p.match,
      storage: p.match ? FOODS.byId(p.match).storage : 'pantry'
    }));

    ui.sheet({
      title: 'Review scanned items',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'OCR is guesswork on thermal paper \u2014 fix any bad matches before adding. Unmatched lines are skipped unless you assign them.'));

        rows.forEach((row) => {
          const box = U.el('div', { class: 'review-row' + (row.include ? '' : ' skipped') });
          const head = U.el('div', { class: 'review-head' });
          const toggle = U.el('button', {
            class: 'check ' + (row.include ? 'on' : ''), type: 'button',
            'aria-label': 'Include ' + row.text,
            onclick: () => {
              row.include = !row.include && !!row.match;
              if (!row.match) ui.toast('Assign a food first', 'warn');
              toggle.classList.toggle('on', row.include);
              toggle.textContent = row.include ? '\u2713' : '';
              box.classList.toggle('skipped', !row.include);
            }
          }, row.include ? '\u2713' : '');
          head.appendChild(toggle);
          head.appendChild(U.el('span', { class: 'review-raw mono' }, row.raw));
          box.appendChild(head);

          const matchBtn = U.el('button', {
            class: 'review-match', type: 'button',
            onclick: () => ui.pickFood('Match \u201c' + row.text + '\u201d', (food) => {
              row.match = food.id;
              row.storage = food.storage;
              row.include = true;
              matchBtn.textContent = '\u2192 ' + food.name;
              toggle.classList.add('on'); toggle.textContent = '\u2713';
              box.classList.remove('skipped');
            })
          }, row.match ? '\u2192 ' + FOODS.byId(row.match).name : '\u2192 tap to assign a food');
          box.appendChild(matchBtn);
          body.appendChild(box);
        });

        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => {
              const lines = rows
                .filter((r) => r.include && r.match)
                .map((r) => ({ foodId: r.match, packages: r.qty, storage: r.storage }));
              if (!lines.length) { ui.toast('Nothing selected to add.', 'warn'); return; }
              inv.addPurchases(lines, 'receipt');
              close(); render(container);
              ui.toast(lines.length + ' items added with estimated dates');
            }
          }, 'Add to pantry')
        ]));
      }
    });
  }

  /* ---------- main render ---------- */
  function itemRow(item, container) {
    const food = FOODS.byId(item.foodId);
    const st = inv.status(item);
    return U.el('button', { class: 'inv-row', type: 'button', onclick: () => openItem(item, container) }, [
      U.el('span', { class: 'list-info' }, [
        U.el('b', {}, food.name),
        U.el('small', { class: 'muted' }, U.fmtQty(item.qty, food.unit) + ' \u00b7 bought ' + U.fmtDate(item.purchasedISO))
      ]),
      ui.expiryTag(st.days)
    ]);
  }

  function render(container) {
    container.innerHTML = '';
    const items = inv.items();

    const aside = U.el('div', { class: 'btn-row tight' }, [
      U.el('button', { class: 'btn small ghost', onclick: () => scanReceipt(container) }, '\u{1F9FE} Scan receipt'),
      U.el('button', { class: 'btn small primary', onclick: () => addManually(container) }, '+ Add')
    ]);
    container.appendChild(ui.header('On hand', 'Pantry', aside));
    container.appendChild(disclaimerBanner());

    if (!items.length) {
      container.appendChild(ui.empty({
        emoji: '\u{1F962}',
        title: 'Pantry\u2019s empty',
        text: 'Add what you have, scan a receipt, or mark a cart purchased on the Shop tab. Once stock exists, the planner cooks toward it.',
        actionLabel: 'Load a sample pantry',
        onAction: () => { inv.loadSample(); render(container); ui.toast('Sample pantry loaded'); }
      }));
      return;
    }

    const past = inv.pastEstimate();
    if (past.length) {
      const card = U.el('section', { class: 'card past-card' });
      card.appendChild(U.el('div', { class: 'card-title-row' }, [
        U.el('h3', { class: 'card-title' }, 'Past estimate (' + past.length + ')'),
        U.el('button', { class: 'link-btn', onclick: showDisclaimer }, 'what this means')
      ]));
      card.appendChild(U.el('p', { class: 'muted small' }, 'The guess ran out \u2014 check each with your senses before deciding.'));
      past.forEach(({ item }) => card.appendChild(itemRow(item, container)));
      container.appendChild(card);
    }

    const groups = inv.grouped();
    [['fridge', '\u{1F9CA}'], ['freezer', '\u2744\uFE0F'], ['pantry', '\u{1F3FA}']].forEach(([storage, icon]) => {
      const fresh = groups[storage].filter((it) => U.daysLeft(it.expiresISO) >= 0);
      if (!fresh.length) return;
      const card = U.el('section', { class: 'card' });
      card.appendChild(U.el('h3', { class: 'card-title' }, icon + ' ' + FOODS.STORAGE_LABELS[storage] + ' \u00b7 ' + fresh.length));
      fresh.forEach((item) => card.appendChild(itemRow(item, container)));
      container.appendChild(card);
    });
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.pantry = { render };
})(typeof window !== 'undefined' ? window : globalThis);
