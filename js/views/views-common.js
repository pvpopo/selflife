/* ShelfLife — views/views-common.js
   Shared UI vocabulary. The recurring visual element is the "shelf tag":
   a punched supermarket price-tag used consistently for prices, deals and
   expiry countdowns, set in the mono utility face. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;
  const planner = g.SL.planner;

  const ui = {};

  /* ---------- toast ---------- */
  let toastTimer = null;
  ui.toast = function (msg, kind) {
    let host = U.$('#toast-host');
    if (!host) {
      host = U.el('div', { id: 'toast-host' });
      document.body.appendChild(host);
    }
    host.innerHTML = '';
    const t = U.el('div', { class: 'toast ' + (kind || '') }, msg);
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2600);
  };

  /* ---------- bottom sheet ---------- */
  ui.sheet = function ({ title, render, onClose, tall }) {
    const overlay = U.el('div', { class: 'sheet-overlay' });
    const sheet = U.el('div', { class: 'sheet' + (tall ? ' sheet-tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
    const head = U.el('div', { class: 'sheet-head' }, [
      U.el('div', { class: 'sheet-grab', 'aria-hidden': 'true' }),
      U.el('div', { class: 'sheet-title-row' }, [
        U.el('h2', { class: 'sheet-title', text: title || '' }),
        U.el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, '\u2715')
      ])
    ]);
    const body = U.el('div', { class: 'sheet-body' });
    sheet.appendChild(head);
    sheet.appendChild(body);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    document.body.classList.add('sheet-open');

    function close() {
      overlay.classList.add('closing');
      document.body.classList.remove('sheet-open');
      setTimeout(() => overlay.remove(), 220);
      if (onClose) onClose();
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    requestAnimationFrame(() => overlay.classList.add('open'));
    render(body, close);
    return { close, body };
  };

  ui.confirm = function (title, message, confirmLabel, danger) {
    return new Promise((resolve) => {
      ui.sheet({
        title,
        render(body, close) {
          body.appendChild(U.el('p', { class: 'sheet-text' }, message));
          body.appendChild(U.el('div', { class: 'sheet-actions' }, [
            U.el('button', { class: 'btn ghost', onclick: () => { close(); resolve(false); } }, 'Cancel'),
            U.el('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { close(); resolve(true); } }, confirmLabel || 'Confirm')
          ]));
        },
        onClose: () => resolve(false)
      });
    });
  };

  /* ---------- aisle-sign page header ---------- */
  ui.header = function (kicker, title, aside) {
    return U.el('header', { class: 'aisle' }, [
      U.el('div', {}, [
        U.el('div', { class: 'aisle-kicker', text: kicker }),
        U.el('h1', { class: 'aisle-title', text: title })
      ]),
      aside || null
    ]);
  };

  /* ---------- shelf tags (signature element) ---------- */
  ui.tag = function (content, tone) {
    return U.el('span', { class: 'shelf-tag' + (tone ? ' tone-' + tone : '') }, content);
  };

  ui.priceTag = function (price, deal) {
    if (deal) {
      return ui.tag([
        U.el('s', { class: 'tag-was' }, U.money(deal.was)),
        U.el('b', {}, U.money(price)),
        U.el('em', { class: 'tag-deal' }, '\u2212' + deal.pct + '%')
      ], 'deal');
    }
    return ui.tag(U.el('b', {}, U.money(price)));
  };

  ui.expiryTag = function (days) {
    let tone = 'fresh', label;
    if (days < 0) { tone = 'past'; label = 'past est. ' + Math.abs(days) + 'd'; }
    else if (days === 0) { tone = 'urgent'; label = 'use today'; }
    else if (days === 1) { tone = 'urgent'; label = '1 day'; }
    else if (days <= 4) { tone = 'soon'; label = days + ' days'; }
    else label = days + ' days';
    return ui.tag([U.el('span', { class: 'tag-dot', 'aria-hidden': 'true' }), U.el('b', {}, label)], tone);
  };

  /* ---------- chips ---------- */
  ui.chip = function (label, opts) {
    const o = opts || {};
    return U.el('button', {
      class: 'chip' + (o.active ? ' active' : '') + (o.small ? ' small' : ''),
      type: 'button',
      'aria-pressed': o.active ? 'true' : 'false',
      onclick: o.onclick
    }, label);
  };

  /* ---------- stepper ---------- */
  ui.stepper = function (value, min, max, onChange) {
    let v = value;
    const num = U.el('span', { class: 'stepper-num', text: String(v) });
    function set(n) {
      v = U.clamp(n, min, max);
      num.textContent = String(v);
      onChange(v);
    }
    return U.el('span', { class: 'stepper' }, [
      U.el('button', { class: 'stepper-btn', type: 'button', 'aria-label': 'Decrease', onclick: () => set(v - 1) }, '\u2212'),
      num,
      U.el('button', { class: 'stepper-btn', type: 'button', 'aria-label': 'Increase', onclick: () => set(v + 1) }, '+')
    ]);
  };

  /* ---------- nutrition macro row ---------- */
  ui.macros = function (n, compact) {
    if (compact) {
      return U.el('span', { class: 'macros compact' }, [
        U.el('b', {}, n.cal + ' cal'),
        U.el('span', {}, n.p + 'P \u00b7 ' + n.c + 'C \u00b7 ' + n.f + 'F')
      ]);
    }
    const cell = (v, label) => U.el('div', { class: 'macro-cell' }, [
      U.el('b', {}, String(v)), U.el('span', {}, label)
    ]);
    return U.el('div', { class: 'macros-grid' }, [
      cell(n.cal, 'calories'), cell(n.p + 'g', 'protein'), cell(n.c + 'g', 'carbs'),
      cell(n.f + 'g', 'fat'), cell(n.fib + 'g', 'fiber'), cell(n.na + 'mg', 'sodium')
    ]);
  };

  /* ---------- empty state ---------- */
  ui.empty = function ({ emoji, title, text, actionLabel, onAction }) {
    return U.el('div', { class: 'empty' }, [
      U.el('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, emoji || '\u{1F343}'),
      U.el('h3', {}, title),
      U.el('p', {}, text),
      actionLabel ? U.el('button', { class: 'btn primary', onclick: onAction }, actionLabel) : null
    ]);
  };

  /* ---------- searchable food picker ---------- */
  ui.pickFood = function (title, onPick) {
    ui.sheet({
      title: title || 'Add an item',
      tall: true,
      render(body, close) {
        const input = U.el('input', { class: 'input', type: 'search', placeholder: 'Search foods\u2026', autocomplete: 'off' });
        const listEl = U.el('div', { class: 'picker-list' });
        function draw(q) {
          listEl.innerHTML = '';
          const query = U.normalize(q);
          const matches = FOODS.list
            .filter((f) => !query || U.normalize(f.name).includes(query) || (f.aliases || []).some((a) => U.normalize(a).includes(query)))
            .slice(0, 40);
          if (!matches.length) {
            listEl.appendChild(U.el('p', { class: 'muted center' }, 'No catalog match \u2014 try another word.'));
            return;
          }
          matches.forEach((f) => {
            listEl.appendChild(U.el('button', {
              class: 'picker-row', type: 'button',
              onclick: () => { close(); onPick(f); }
            }, [
              U.el('span', {}, [U.el('b', {}, f.name), U.el('small', { class: 'muted' }, ' \u00b7 ' + f.pkg.label)]),
              U.el('span', { class: 'muted small-caps' }, FOODS.catLabel(f.cat))
            ]));
          });
        }
        input.addEventListener('input', U.debounce(() => draw(input.value), 120));
        body.appendChild(input);
        body.appendChild(listEl);
        draw('');
        setTimeout(() => input.focus(), 250);
      }
    });
  };

  /* ---------- shared preferences editor ---------- */
  const DIET_LABELS = {
    'vegetarian': 'Vegetarian', 'vegan': 'Vegan', 'gluten-free': 'Gluten-free',
    'dairy-free': 'Dairy-free', 'high-protein': 'High-protein', 'low-carb': 'Low-carb'
  };
  const ALLERGEN_LABELS = {
    dairy: 'Dairy', gluten: 'Gluten', eggs: 'Eggs', nuts: 'Peanuts/nuts',
    soy: 'Soy', fish: 'Fish', shellfish: 'Shellfish', sesame: 'Sesame'
  };
  ui.DIET_LABELS = DIET_LABELS;
  ui.ALLERGEN_LABELS = ALLERGEN_LABELS;

  ui.editPrefs = function (onSaved) {
    const p = planner.prefs();
    ui.sheet({
      title: 'Meal preferences',
      tall: true,
      render(body, close) {
        function chipGroup(labelText, options, labels, selected) {
          const wrap = U.el('div', { class: 'field' });
          wrap.appendChild(U.el('label', { class: 'field-label' }, labelText));
          const row = U.el('div', { class: 'chip-row' });
          options.forEach((opt) => {
            const chip = ui.chip(labels[opt] || opt, {
              active: selected.includes(opt),
              onclick: () => {
                const i = selected.indexOf(opt);
                if (i >= 0) selected.splice(i, 1); else selected.push(opt);
                chip.classList.toggle('active');
                chip.setAttribute('aria-pressed', chip.classList.contains('active'));
              }
            });
            row.appendChild(chip);
          });
          wrap.appendChild(row);
          return wrap;
        }

        body.appendChild(chipGroup('Diet (recipes must match all selected)', g.SL.recipes.DIETS, DIET_LABELS, p.diets));
        body.appendChild(chipGroup('Avoid allergens (recipes containing these are excluded)', g.SL.recipes.ALLERGENS, ALLERGEN_LABELS, p.allergens));
        body.appendChild(chipGroup('Favorite cuisines (boosted, not required)', g.SL.recipes.CUISINES, {}, p.cuisines));

        const servingsField = U.el('div', { class: 'field row-between' }, [
          U.el('label', { class: 'field-label' }, 'Servings per meal'),
          ui.stepper(p.servings, 1, 8, (v) => { p.servings = v; })
        ]);
        body.appendChild(servingsField);

        const slotWrap = U.el('div', { class: 'field' });
        slotWrap.appendChild(U.el('label', { class: 'field-label' }, 'Plan which meals'));
        const slotRow = U.el('div', { class: 'chip-row' });
        ['breakfast', 'lunch', 'dinner'].forEach((s) => {
          const chip = ui.chip(U.cap(s), {
            active: p.slots[s],
            onclick: () => { p.slots[s] = !p.slots[s]; chip.classList.toggle('active'); }
          });
          slotRow.appendChild(chip);
        });
        slotWrap.appendChild(slotRow);
        body.appendChild(slotWrap);

        const zipField = U.el('div', { class: 'field' }, [
          U.el('label', { class: 'field-label', for: 'pref-zip' }, 'ZIP code (finds nearby stores)'),
          U.el('input', { class: 'input', id: 'pref-zip', inputmode: 'numeric', maxlength: '5', placeholder: 'e.g. 98101', value: p.zip || '' })
        ]);
        body.appendChild(zipField);

        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: () => {
              if (!p.slots.breakfast && !p.slots.lunch && !p.slots.dinner) {
                ui.toast('Keep at least one meal in the plan.', 'warn'); return;
              }
              p.zip = (U.$('#pref-zip').value || '').replace(/\D/g, '').slice(0, 5);
              planner.savePrefs(p);
              close();
              ui.toast('Preferences saved');
              if (onSaved) onSaved(p);
            }
          }, 'Save preferences')
        ]));
      }
    });
  };

  /* meal-slot label helper */
  ui.slotLabel = function (s) { return U.cap(s); };

  g.SL = g.SL || {};
  g.SL.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
