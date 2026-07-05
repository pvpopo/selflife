/* ShelfLife — views/views-account.js
   Sign-in screen (login / register / guest) plus the account tab:
   profile & preferences, security, backups, and the About card that is
   candid about what's simulated and how to upgrade it. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const ui = g.SL.ui;
  const auth = g.SL.auth;
  const db = g.SL.db;
  const planner = g.SL.planner;

  /* ================= auth screen ================= */
  function renderAuth(container, onSignedIn) {
    container.innerHTML = '';
    const wrap = U.el('div', { class: 'auth-wrap' });

    wrap.appendChild(U.el('div', { class: 'brand' }, [
      U.el('div', { class: 'brand-mark', 'aria-hidden': 'true' }, '\u{1F96C}'),
      U.el('h1', { class: 'brand-name' }, 'ShelfLife'),
      U.el('p', { class: 'brand-tag' }, 'Plan meals. Shop smart. Waste less.')
    ]));

    let mode = 'login';
    const card = U.el('div', { class: 'card auth-card' });

    function draw() {
      card.innerHTML = '';
      const tabs = U.el('div', { class: 'auth-tabs', role: 'tablist' });
      [['login', 'Sign in'], ['register', 'Create account']].forEach(([m, label]) => {
        tabs.appendChild(U.el('button', {
          class: 'auth-tab' + (mode === m ? ' active' : ''), role: 'tab',
          'aria-selected': mode === m ? 'true' : 'false',
          onclick: () => { mode = m; draw(); }
        }, label));
      });
      card.appendChild(tabs);

      const userIn = U.el('input', { class: 'input', type: 'text', autocomplete: 'username', placeholder: 'Username', 'aria-label': 'Username' });
      const passIn = U.el('input', { class: 'input', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', placeholder: mode === 'login' ? 'Password' : 'Password (8+ characters)', 'aria-label': 'Password' });
      const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
      card.appendChild(userIn);
      card.appendChild(passIn);
      card.appendChild(err);

      async function go() {
        err.textContent = '';
        const btnEl = U.$('.auth-go', card);
        btnEl.disabled = true;
        try {
          if (mode === 'login') await auth.login(userIn.value, passIn.value);
          else await auth.register(userIn.value, passIn.value);
          onSignedIn();
        } catch (e) {
          err.textContent = e.message;
          btnEl.disabled = false;
        }
      }
      passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

      card.appendChild(U.el('button', { class: 'btn primary wide auth-go', onclick: go },
        mode === 'login' ? 'Sign in' : 'Create account'));

      card.appendChild(U.el('div', { class: 'divider-or' }, 'or'));
      card.appendChild(U.el('button', {
        class: 'btn ghost wide',
        onclick: () => { auth.guest(); onSignedIn(); }
      }, 'Try it as a guest'));

      card.appendChild(U.el('p', { class: 'muted small center' },
        'Accounts live on this device: passwords are salted & hashed (PBKDF2), and each profile\u2019s data is kept separate. Nothing is sent to a server.'));
    }
    draw();
    wrap.appendChild(card);
    container.appendChild(wrap);
  }

  /* ================= account tab ================= */
  function download(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = U.el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
  }

  function changePasswordSheet() {
    ui.sheet({
      title: 'Change password',
      render(body, close) {
        const oldIn = U.el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
        const newIn = U.el('input', { class: 'input', type: 'password', placeholder: 'New password (8+ characters)', autocomplete: 'new-password' });
        const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        body.appendChild(oldIn); body.appendChild(newIn); body.appendChild(err);
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: async () => {
              try { await auth.changePassword(oldIn.value, newIn.value); close(); ui.toast('Password changed'); }
              catch (e) { err.textContent = e.message; }
            }
          }, 'Change password')
        ]));
      }
    });
  }

  function deleteAccountSheet(onDone) {
    ui.sheet({
      title: 'Delete this account',
      render(body, close) {
        body.appendChild(U.el('p', { class: 'sheet-text' },
          'This permanently removes the account and all its data \u2014 pantry, plans, history \u2014 from this device. There is no undo.'));
        const passIn = auth.isGuest() ? null : U.el('input', { class: 'input', type: 'password', placeholder: 'Confirm with your password' });
        const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        if (passIn) body.appendChild(passIn);
        body.appendChild(err);
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Keep account'),
          U.el('button', {
            class: 'btn danger',
            onclick: async () => {
              try { await auth.deleteAccount(passIn ? passIn.value : ''); close(); onDone(); }
              catch (e) { err.textContent = e.message; }
            }
          }, 'Delete forever')
        ]));
      }
    });
  }

  function render(container) {
    container.innerHTML = '';
    const username = auth.current();
    const p = planner.prefs();

    container.appendChild(ui.header('You', 'Account'));

    /* profile */
    const prof = U.el('section', { class: 'card' });
    prof.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, '@' + username),
      auth.isGuest() ? U.el('span', { class: 'chip small static' }, 'guest') : null
    ]));
    if (auth.isGuest()) {
      prof.appendChild(U.el('p', { class: 'muted small' },
        'Guest data stays on this device under the shared guest profile. Create an account to keep your setup separate and password-protected.'));
    }
    prof.appendChild(U.el('button', { class: 'btn ghost wide', onclick: () => ui.editPrefs(() => render(container)) }, 'Meal preferences & ZIP'));

    const locRow = U.el('div', { class: 'row-between' }, [
      U.el('span', { class: 'muted' }, p.zip ? 'Stores near ZIP ' + p.zip : 'No ZIP set'),
      U.el('button', {
        class: 'btn small ghost',
        onclick: () => {
          if (!navigator.geolocation) { ui.toast('Location not available in this browser', 'warn'); return; }
          ui.toast('Requesting location\u2026');
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              // No reverse-geocoding service in a static app; derive a stable
              // local seed from coarse coordinates so "near me" is consistent.
              const seed = String(Math.abs(Math.round(pos.coords.latitude * 10)) % 100).padStart(2, '0')
                + String(Math.abs(Math.round(pos.coords.longitude * 10)) % 1000).padStart(3, '0');
              const cur = planner.prefs();
              cur.zip = seed;
              planner.savePrefs(cur);
              render(container);
              ui.toast('Using your approximate location for nearby stores');
            },
            () => ui.toast('Couldn\u2019t get location \u2014 enter a ZIP instead', 'warn'),
            { timeout: 8000, maximumAge: 600000 }
          );
        }
      }, '\u{1F4CD} Use my location')
    ]);
    prof.appendChild(locRow);
    container.appendChild(prof);

    /* security */
    const sec = U.el('section', { class: 'card' });
    sec.appendChild(U.el('h3', { class: 'card-title' }, 'Security'));
    sec.appendChild(U.el('p', { class: 'muted small' },
      (auth.strongCrypto
        ? 'Your password is salted and hashed with PBKDF2-SHA256 (210k rounds) \u2014 it is never stored. '
        : 'This browser lacks WebCrypto, so a weaker fallback hash is in use. ')
      + 'Data lives only in this browser\u2019s storage; anyone with full access to this device could read it. For synced, server-side accounts see the README\u2019s Supabase guide.'));
    if (!auth.isGuest()) {
      sec.appendChild(U.el('button', { class: 'btn ghost wide', onclick: changePasswordSheet }, 'Change password'));
    }
    container.appendChild(sec);

    /* data */
    const data = U.el('section', { class: 'card' });
    data.appendChild(U.el('h3', { class: 'card-title' }, 'Your data'));
    data.appendChild(U.el('button', {
      class: 'btn ghost wide',
      onclick: () => { download('shelflife-backup-' + U.iso(U.today()) + '.json', db.exportUser(username)); ui.toast('Backup downloaded'); }
    }, '\u2193 Export backup (JSON)'));

    const importInput = U.el('input', { class: 'file-input', type: 'file', accept: 'application/json', id: 'import-file' });
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          db.importUser(username, JSON.parse(reader.result));
          ui.toast('Backup restored');
          render(container);
        } catch (e) { ui.toast(e.message || 'That file didn\u2019t import.', 'warn'); }
      };
      reader.readAsText(file);
    });
    data.appendChild(U.el('label', { class: 'btn ghost wide', for: 'import-file' }, '\u2191 Restore from backup'));
    data.appendChild(importInput);
    container.appendChild(data);

    /* about */
    const about = U.el('section', { class: 'card' });
    about.appendChild(U.el('h3', { class: 'card-title' }, 'About ShelfLife'));
    about.appendChild(U.el('p', { class: 'muted small' },
      'Straight talk: store availability, prices and deals are a realistic simulation seeded by your ZIP \u2014 a static site can\u2019t legally or technically scrape live grocers. The planner, nutrition math, expiry estimates, receipt OCR, store optimizer and pantry are fully functional. The README covers wiring real store APIs (e.g. Kroger\u2019s) via a small proxy, and real multi-device accounts via Supabase.'));
    about.appendChild(U.el('p', { class: 'muted small' }, g.SL.inventory.DISCLAIMER));
    about.appendChild(U.el('p', { class: 'muted small' }, 'Nutrition figures are estimates computed from typical ingredient values \u2014 not a substitute for medical or dietetic advice.'));
    container.appendChild(about);

    /* session */
    const sess = U.el('section', { class: 'card' });
    sess.appendChild(U.el('button', {
      class: 'btn ghost wide',
      onclick: () => { auth.logout(); g.location.hash = ''; g.location.reload(); }
    }, 'Sign out'));
    sess.appendChild(U.el('button', {
      class: 'btn danger wide',
      onclick: () => deleteAccountSheet(() => { g.location.hash = ''; g.location.reload(); })
    }, 'Delete account & data'));
    container.appendChild(sess);
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.account = { render, renderAuth };
})(typeof window !== 'undefined' ? window : globalThis);
