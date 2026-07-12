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
  const vision = g.SL.vision;
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

  /* ---------- date correction: label photo or manual pick ---------- */
  function saveCorrectedDate(item, iso, how, container) {
    inv.update(item.id, { expiresISO: iso, verified: true });
    // share the anonymous observation so estimates improve for everyone —
    // but only when the purchase date has provenance (receipt-dated or
    // bought in-app), so misdated items can't pollute the consensus
    const days = U.daysBetween(U.parseISO(item.purchasedISO), U.parseISO(iso));
    if (g.SL.expiry) {
      g.SL.expiry.recordObservation(item.foodId, item.storage, days, {
        source: item.source, purchasedISO: item.purchasedISO
      }).then((shared) => {
        if (shared) ui.toast('Date set from ' + how + ' — thanks, this improves everyone’s estimates');
        else ui.toast('Date set from ' + how);
      });
    } else ui.toast('Date set from ' + how);
    render(container);
  }

  function scanLabelDate(item, container, closeParent, onSaved) {
    ui.sheet({
      title: 'Scan the date label',
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'Photograph the best-by / use-by print on the package. It’s read on your device — the photo never leaves your phone.'));
        const input = U.el('input', { class: 'file-input', type: 'file', accept: 'image/*', capture: 'environment', id: 'label-file' });
        body.appendChild(U.el('label', { class: 'btn primary wide', for: 'label-file' }, '\u{1F4F8} Photo of the date'));
        body.appendChild(input);
        const progress = U.el('p', { class: 'muted center', 'aria-live': 'polite' }, '');
        body.appendChild(progress);

        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          progress.textContent = 'Loading OCR engine…';
          try {
            const text = await receipt.scanImage(file, (pct) => { progress.textContent = 'Reading label… ' + pct + '%'; });
            const iso = g.SL.expiry.parseDate(text, 'label');
            if (!iso) { progress.textContent = 'Couldn’t find a date in that photo — try closer/steadier, or set it by hand below.'; return; }
            close(); if (closeParent) closeParent();
            ui.confirm('Date found: ' + U.fmtDateLong(iso), 'Use this as the use-by date for ' + FOODS.byId(item.foodId).name + '?', 'Use this date')
              .then((yes) => { if (yes) { saveCorrectedDate(item, iso, 'the label', container); if (onSaved) onSaved(iso); } });
          } catch (err) {
            progress.textContent = err.message || 'Scan failed — set the date by hand below.';
          }
        });

        body.appendChild(U.el('div', { class: 'divider-or' }, 'or set it by hand'));
        const dateIn = U.el('input', { class: 'input', type: 'date', value: item.expiresISO, 'aria-label': 'Use-by date' });
        body.appendChild(dateIn);
        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: () => {
            if (!dateIn.value) return;
            close(); if (closeParent) closeParent();
            saveCorrectedDate(item, dateIn.value, 'your entry', container);
            if (onSaved) onSaved(dateIn.value);
          }
        }, 'Save this date'));
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
        const src = item.verified ? null : (g.SL.expiry ? g.SL.expiry.estimateSource(food, item.storage) : { kind: 'catalog' });
        facts.appendChild(U.el('div', { class: 'item-fact' }, [
          U.el('span', { class: 'muted' }, item.verified ? 'Use by (from label)' : 'Est. use by'),
          ui.expiryTag(st.days)
        ]));
        body.appendChild(facts);
        if (src && src.kind === 'community') {
          body.appendChild(U.el('p', { class: 'muted small' }, 'Estimate refined from ' + src.n + ' community label scans of this food.'));
        }

        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: () => scanLabelDate(item, container, close)
        }, '\u{1F4F8} Scan the date label (or fix the date)'));

        body.appendChild(U.el('h3', { class: 'sub' }, 'Is it still good?'));
        body.appendChild(U.el('p', { class: 'sheet-text' }, food.spoil));
        body.appendChild(U.el('p', { class: 'muted small' }, inv.DISCLAIMER));

        body.appendChild(U.el('button', {
          class: 'btn primary wide',
          onclick: () => { close(); cookItUp(item, container); }
        }, '🍳 Use it in a meal'));

        body.appendChild(U.el('button', {
          class: 'btn ghost wide',
          onclick: () => ui.foodInfo(food)
        }, 'ℹ️ Nutrition, shelf life & swaps for ' + food.name.toLowerCase()));

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

  /* ---------- cook it up: recipes for this item, ranked by what else
     they'd rescue from the expiring shelf ---------- */
  function cookItUp(item, container) {
    const food = FOODS.byId(item.foodId);
    const recipes = planner.recipesUsing(item.foodId, 6);
    ui.sheet({
      title: 'Cook the ' + food.name.toLowerCase(),
      tall: true,
      render(body) {
        if (!recipes.length) {
          body.appendChild(U.el('p', { class: 'muted' }, 'No recipes match your diet and allergen filters for this ingredient. Loosen a filter in preferences to see options.'));
          return;
        }
        body.appendChild(U.el('p', { class: 'muted small' },
          'Ranked to work through your pantry: recipes that also use up other food expiring in the next few days float to the top.'));
        recipes.forEach((r) => {
          const others = planner.rescues(r).filter((x) => x.foodId !== item.foodId);
          const n = g.SL.nutrition.perServing(r);
          body.appendChild(U.el('button', {
            class: 'swap-row', type: 'button',
            onclick: () => g.SL.views.plan.openRecipe(r)
          }, [
            U.el('span', { class: 'recipe-emoji sm', 'aria-hidden': 'true' }, r.emoji),
            U.el('span', { class: 'swap-name' }, [
              U.el('b', {}, r.name),
              U.el('small', { class: 'muted' }, r.cuisine + ' · ' + r.time + ' min · ' + n.cal + ' cal'),
              others.length ? U.el('small', { class: 'rescue-note' }, '⚡ also uses: ' + others.slice(0, 3).map((x) => FOODS.byId(x.foodId).name.toLowerCase() + ' (' + x.days + 'd)').join(', ')) : null
            ])
          ]));
        });
        body.appendChild(U.el('p', { class: 'muted small center' }, 'Open any recipe to add it to this week’s plan.'));
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
            reviewParsed(receipt.parseReceipt(text), container, receipt.receiptDate(text));
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
            reviewParsed(parsed, container, receipt.receiptDate(ta.value));
          }
        }, 'Parse pasted text'));
      }
    });
  }

  function reviewParsed(parsed, container, dateISO) {
    if (!parsed.length) {
      ui.toast('No item lines found on that receipt.', 'warn');
      return;
    }
    const NF = g.SL.nonfood;
    // rows: food matches go to the pantry; priced unmatched lines are
    // presumed non-food purchases and auto-categorized
    const rows = parsed.map((p) => ({
      raw: p.raw, text: p.text, qty: Math.max(1, p.qty || 1), price: p.price,
      match: p.match, nonfood: p.match ? null : NF.classify(p.text),
      include: !!p.match || (!p.match && p.price != null),
      storage: p.match ? FOODS.byId(p.match).storage : 'pantry'
    }));
    let purchasedISO = dateISO || null;

    ui.sheet({
      title: 'Review scanned items',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'OCR is guesswork on thermal paper \u2014 fix anything before adding. Lines that aren\u2019t food become household inventory, categorized automatically.'));

        const dateRow = U.el('div', { class: 'field row-between' }, [
          U.el('label', { class: 'field-label' }, purchasedISO ? 'Receipt date (dates count from here)' : 'Purchase date'),
          (() => {
            const d = U.el('input', { class: 'input date-inline', type: 'date', value: purchasedISO || U.iso(U.today()) });
            d.addEventListener('change', () => { purchasedISO = d.value || null; });
            return d;
          })()
        ]);
        body.appendChild(dateRow);
        if (dateISO) body.appendChild(U.el('p', { class: 'muted small' }, '\ud83d\udcc5 Found ' + U.fmtDateLong(dateISO) + ' printed on the receipt.'));

        rows.forEach((row) => {
          const box = U.el('div', { class: 'review-row' + (row.include ? '' : ' skipped') });
          const head = U.el('div', { class: 'review-head' });
          const toggle = U.el('button', {
            class: 'check ' + (row.include ? 'on' : ''), type: 'button',
            'aria-label': 'Include ' + row.text,
            onclick: () => {
              row.include = !row.include;
              toggle.classList.toggle('on', row.include);
              toggle.textContent = row.include ? '\u2713' : '';
              box.classList.toggle('skipped', !row.include);
            }
          }, row.include ? '\u2713' : '');
          head.appendChild(toggle);
          head.appendChild(U.el('span', { class: 'review-raw mono' }, row.raw));
          box.appendChild(head);

          const label = () => row.match
            ? '\u2192 ' + FOODS.byId(row.match).name
            : '\u2192 ' + NF.byCat(row.nonfood).emoji + ' non-food \u00b7 ' + NF.byCat(row.nonfood).label;
          const matchBtn = U.el('button', {
            class: 'review-match', type: 'button',
            onclick: () => assignRow(row, () => { matchBtn.textContent = label(); toggle.classList.add('on'); toggle.textContent = '\u2713'; box.classList.remove('skipped'); })
          }, label());
          box.appendChild(matchBtn);
          body.appendChild(box);
        });

        function assignRow(row, done) {
          ui.sheet({
            title: 'What is \u201c' + row.text + '\u201d?',
            render(body2, close2) {
              body2.appendChild(U.el('button', {
                class: 'btn primary wide',
                onclick: () => { close2(); ui.pickFood('Match \u201c' + row.text + '\u201d', (food) => { row.match = food.id; row.nonfood = null; row.storage = food.storage; row.include = true; done(); }); }
              }, '\ud83c\udf4e It\u2019s a food \u2014 pick from catalog'));
              body2.appendChild(U.el('div', { class: 'divider-or' }, 'or a household item'));
              const chips = U.el('div', { class: 'chip-row' });
              NF.CATEGORIES.forEach((c) => {
                chips.appendChild(ui.chip(c.emoji + ' ' + c.label, {
                  small: true, active: row.nonfood === c.id,
                  onclick: () => { row.match = null; row.nonfood = c.id; row.include = true; close2(); done(); }
                }));
              });
              body2.appendChild(chips);
            }
          });
        }

        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => {
              const foodLines = rows
                .filter((r) => r.include && r.match)
                .map((r) => ({ foodId: r.match, packages: r.qty, storage: r.storage }));
              const nfRows = rows.filter((r) => r.include && !r.match);
              if (!foodLines.length && !nfRows.length) { ui.toast('Nothing selected to add.', 'warn'); return; }
              if (foodLines.length) inv.addPurchases(foodLines, 'receipt', purchasedISO || undefined);
              nfRows.forEach((r) => NF.add({ name: r.text, cat: r.nonfood, qty: r.qty, purchasedISO: purchasedISO || undefined, price: r.price }));
              close(); render(container);
              const bits = [];
              if (foodLines.length) bits.push(foodLines.length + ' food');
              if (nfRows.length) bits.push(nfRows.length + ' household');
              ui.toast(bits.join(' + ') + ' items added' + (purchasedISO ? ' \u00b7 dated from receipt' : ''));
            }
          }, 'Add everything')
        ]));
      }
    });
  }

  /* ---------- shelf photo scan (vision model via proxy/vision-worker.js) ---------- */
  function scanShelf(container) {
    if (!vision.configured()) {
      ui.sheet({
        title: 'Shelf photo scanning',
        render(body) {
          body.appendChild(U.el('p', { class: 'sheet-text' },
            'Photograph the inside of your pantry, fridge or freezer and a vision model identifies the food, so you can update the whole shelf in one go.'));
          body.appendChild(U.el('p', { class: 'sheet-text' },
            'It needs a small (free-tier) Cloudflare Worker with a Claude API key — the walkthrough is at the top of proxy/vision-worker.js. Paste the worker URL into js/config.js → visionProxy and this button lights up.'));
          body.appendChild(U.el('p', { class: 'muted small' }, vision.RETENTION_NOTE));
        }
      });
      return;
    }

    let storage = 'pantry';
    ui.sheet({
      title: 'Photograph a shelf',
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' }, vision.RETENTION_NOTE));

        const stWrap = U.el('div', { class: 'field' });
        stWrap.appendChild(U.el('label', { class: 'field-label' }, 'What are you photographing?'));
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

        const input = U.el('input', { class: 'file-input', type: 'file', accept: 'image/*', capture: 'environment', id: 'shelf-file' });
        body.appendChild(U.el('label', { class: 'btn primary wide', for: 'shelf-file' }, '\u{1F4F7} Photo of the shelf'));
        body.appendChild(input);
        const progress = U.el('p', { class: 'muted center', 'aria-live': 'polite' }, '');
        body.appendChild(progress);

        input.addEventListener('change', async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const rows = await vision.scanShelf(file, storage, (msg) => { progress.textContent = msg; });
            if (!rows.length) { progress.textContent = 'No food found in that photo — try closer or with more light.'; return; }
            close();
            reviewShelf(rows, container);
          } catch (err) {
            progress.textContent = err.message || 'Scan failed — try again.';
          }
        });
      }
    });
  }

  /* Review what the model saw before anything is saved — same contract as
     the receipt flow: the user confirms every line. */
  function reviewShelf(rows, container) {
    ui.sheet({
      title: 'Review spotted items',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'The model’s best guess at what’s on the shelf — fix anything before adding. Quantity is packages, and items it wasn’t sure about start unticked.'));

        rows.forEach((row) => {
          row.include = row.include != null ? row.include : (!!row.match && row.confidence !== 'low');
          const box = U.el('div', { class: 'review-row' + (row.include ? '' : ' skipped') });

          const head = U.el('div', { class: 'review-head' });
          const toggle = U.el('button', {
            class: 'check ' + (row.include ? 'on' : ''), type: 'button',
            'aria-label': 'Include ' + row.name,
            onclick: () => {
              row.include = !row.include;
              toggle.classList.toggle('on', row.include);
              toggle.textContent = row.include ? '✓' : '';
              box.classList.toggle('skipped', !row.include);
            }
          }, row.include ? '✓' : '');
          head.appendChild(toggle);
          head.appendChild(U.el('span', { class: 'review-raw mono' },
            row.name + (row.confidence === 'low' ? ' (unsure)' : '')));
          head.appendChild(ui.stepper(row.qty, 1, 24, (v) => { row.qty = v; }));
          box.appendChild(head);

          const label = () => row.match
            ? '→ ' + FOODS.byId(row.match).name + ' · ' + FOODS.STORAGE_LABELS[row.storage]
            : '→ no catalog match — tap to pick';
          const matchBtn = U.el('button', {
            class: 'review-match', type: 'button',
            onclick: () => ui.pickFood('Match “' + row.name + '”', (food) => {
              row.match = food.id;
              row.include = true;
              matchBtn.textContent = label();
              toggle.classList.add('on'); toggle.textContent = '✓';
              box.classList.remove('skipped');
            })
          }, label());
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
              const added = inv.addPurchases(lines, 'photo');
              close(); render(container);
              ui.toast(added.length + ' ' + U.plural(added.length, 'item') + ' added from the shelf photo');
              quickDates(added, container);
            }
          }, 'Add to pantry')
        ]));
      }
    });
  }

  /* ---------- quick expiration pass, right after a shelf scan ----------
     Items already in the pantry have unknown purchase dates, so the shelf-life
     guess (counted from today) can run long. One screen to sanity-check every
     date: nudge it, type it, or photograph the printed label. */
  function quickDates(items, container) {
    if (!items.length) return;
    ui.sheet({
      title: 'Quick date check',
      tall: true,
      render(body, close) {
        body.appendChild(U.el('p', { class: 'muted small' },
          'Estimates count from today, but shelf items may have been open a while — adjust anything that looks off. Every row saves as you change it.'));

        items.forEach((item) => {
          const food = FOODS.byId(item.foodId);
          const box = U.el('div', { class: 'review-row' });
          box.appendChild(U.el('div', { class: 'review-head' }, [
            U.el('span', { class: 'review-raw' }, [
              U.el('b', {}, food.name),
              U.el('small', { class: 'muted' }, ' · ' + U.fmtQty(item.qty, food.unit))
            ])
          ]));

          const dateIn = U.el('input', { class: 'input date-inline', type: 'date', value: item.expiresISO, 'aria-label': 'Use-by date for ' + food.name });
          const setDate = (iso, verified) => {
            inv.update(item.id, { expiresISO: iso, verified: !!verified });
            item.expiresISO = iso;
            dateIn.value = iso;
          };
          dateIn.addEventListener('change', () => { if (dateIn.value) setDate(dateIn.value, true); });

          const nudge = (days) => U.el('button', {
            class: 'btn small ghost', type: 'button',
            onclick: () => setDate(U.iso(U.addDays(U.parseISO(item.expiresISO), days)))
          }, (days > 0 ? '+' : '') + days + 'd');

          box.appendChild(U.el('div', { class: 'btn-row tight' }, [
            nudge(-3), nudge(-1), dateIn, nudge(1), nudge(3),
            U.el('button', {
              class: 'btn small ghost', type: 'button',
              title: 'Scan the printed best-by date',
              onclick: () => scanLabelDate(item, container, null, (iso) => { item.expiresISO = iso; dateIn.value = iso; })
            }, '\u{1F4F8}')
          ]));
          body.appendChild(box);
        });

        body.appendChild(U.el('button', {
          class: 'btn primary wide',
          onclick: () => { close(); render(container); }
        }, 'Done — dates look right'));
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
      U.el('button', { class: 'btn small ghost', onclick: () => scanReceipt(container) }, '\u{1F9FE} Receipt'),
      U.el('button', { class: 'btn small ghost', onclick: () => scanShelf(container) }, '\u{1F4F7} Shelf'),
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

    container.appendChild(nonfoodCard(container));
  }

  /* ---------- household (non-food) inventory ---------- */
  function nonfoodCard(container) {
    const NF = g.SL.nonfood;
    const all = NF.items();
    const card = U.el('section', { class: 'card' });
    card.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, '\u{1F9FB} Household & more' + (all.length ? ' \u00b7 ' + all.length : '')),
      U.el('button', { class: 'btn small ghost', onclick: () => addNonfood(container) }, '+ Add')
    ]));
    if (!all.length) {
      card.appendChild(U.el('p', { class: 'muted small' },
        'Non-food purchases land here \u2014 receipt lines that aren\u2019t groceries are categorized automatically (cleaning, paper goods, personal care\u2026).'));
      return card;
    }
    const groups = NF.grouped();
    NF.CATEGORIES.forEach((c) => {
      const items = groups[c.id];
      if (!items || !items.length) return;
      card.appendChild(U.el('div', { class: 'aisle-label small-caps' }, c.emoji + ' ' + c.label));
      items.forEach((it) => {
        card.appendChild(U.el('button', {
          class: 'inv-row', type: 'button', onclick: () => openNonfood(it, container)
        }, [
          U.el('span', { class: 'list-info' }, [
            U.el('b', {}, it.name),
            U.el('small', { class: 'muted' }, (it.qty > 1 ? '\u00D7' + it.qty + ' \u00b7 ' : '') + 'bought ' + U.fmtDate(it.purchasedISO))
          ]),
          it.price != null ? U.el('span', { class: 'mono muted small' }, U.money(it.price)) : null
        ]));
      });
    });
    return card;
  }

  function openNonfood(item, container) {
    const NF = g.SL.nonfood;
    ui.sheet({
      title: item.name,
      render(body, close) {
        body.appendChild(U.el('div', { class: 'field row-between' }, [
          U.el('label', { class: 'field-label' }, 'Quantity'),
          ui.stepper(item.qty, 1, 99, (v) => NF.update(item.id, { qty: v }))
        ]));
        const chips = U.el('div', { class: 'chip-row' });
        NF.CATEGORIES.forEach((c) => {
          chips.appendChild(ui.chip(c.emoji + ' ' + c.label, {
            small: true, active: item.cat === c.id,
            onclick: () => { NF.update(item.id, { cat: c.id }); close(); render(container); }
          }));
        });
        body.appendChild(U.el('div', { class: 'field' }, [U.el('label', { class: 'field-label' }, 'Category'), chips]));
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: () => { close(); render(container); } }, 'Done'),
          U.el('button', {
            class: 'btn danger',
            onclick: () => { NF.remove(item.id); close(); render(container); ui.toast('Removed'); }
          }, 'Used up \u2014 remove')
        ]));
      }
    });
  }

  function addNonfood(container) {
    const NF = g.SL.nonfood;
    ui.sheet({
      title: 'Add a household item',
      render(body, close) {
        const nameIn = U.el('input', { class: 'input', type: 'text', placeholder: 'e.g. Paper towels 6pk' });
        body.appendChild(nameIn);
        let cat = null;
        const chips = U.el('div', { class: 'chip-row' });
        NF.CATEGORIES.forEach((c) => {
          chips.appendChild(ui.chip(c.emoji + ' ' + c.label, {
            small: true,
            onclick: (e) => { cat = c.id; U.$$('.chip', chips).forEach((x) => x.classList.remove('active')); e.currentTarget ? e.currentTarget.classList.add('active') : null; }
          }));
        });
        body.appendChild(U.el('div', { class: 'field' }, [U.el('label', { class: 'field-label' }, 'Category (auto-guessed if left alone)'), chips]));
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => {
              if (!nameIn.value.trim()) { ui.toast('Give it a name first', 'warn'); return; }
              NF.add({ name: nameIn.value, cat: cat || undefined });
              close(); render(container); ui.toast('Added to household inventory');
            }
          }, 'Add')
        ]));
      }
    });
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.pantry = { render };
})(typeof window !== 'undefined' ? window : globalThis);
