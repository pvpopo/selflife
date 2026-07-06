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

  // brand marks for the OAuth buttons (inline so they work offline)
  const GOOGLE_LOGO = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.29a12 12 0 0 0 0 10.74l3.98-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z"/></svg>';
  const APPLE_LOGO = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M16.36 12.76c.03 3.26 2.86 4.35 2.9 4.36-.03.08-.46 1.56-1.5 3.09-.9 1.32-1.84 2.64-3.32 2.66-1.45.03-1.92-.86-3.58-.86-1.66 0-2.18.84-3.55.89-1.43.05-2.51-1.43-3.42-2.75-1.86-2.69-3.28-7.6-1.37-10.92a5.32 5.32 0 0 1 4.49-2.72c1.4-.03 2.72.94 3.58.94.85 0 2.46-1.17 4.15-1 .71.03 2.69.29 3.96 2.15-.1.06-2.37 1.38-2.34 4.16zM13.62 4.9c.76-.92 1.27-2.2 1.13-3.47-1.09.04-2.42.73-3.2 1.65-.7.81-1.32 2.11-1.15 3.36 1.22.1 2.46-.62 3.22-1.54z"/></svg>';

  function oauthProvider() {
    const p = auth.provider ? auth.provider() : null;
    return (p === 'google' || p === 'apple' || p === 'oauth') ? p : null;
  }

  function isCloudAccount() {
    const p = auth.provider ? auth.provider() : null;
    return p === 'google' || p === 'apple' || p === 'oauth' || p === 'email';
  }

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

      // cloud sign-in — buttons always visible; they explain themselves when
      // js/config.js hasn't been wired to Supabase yet
      const oauthErr = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
      const oauthStack = U.el('div', { class: 'oauth-stack' });
      [['google', 'Continue with Google', GOOGLE_LOGO], ['apple', 'Continue with Apple', APPLE_LOGO]].forEach(([prov, label, logo]) => {
        oauthStack.appendChild(U.el('button', {
          class: 'btn oauth wide ' + prov, type: 'button',
          onclick: async () => {
            oauthErr.textContent = '';
            try { await auth.oauth(prov); }
            catch (e) { oauthErr.textContent = e.message; }
          }
        }, [U.el('span', { class: 'oauth-logo', 'aria-hidden': 'true', html: logo }), label]));
      });
      card.appendChild(oauthStack);
      card.appendChild(oauthErr);
      card.appendChild(U.el('div', { class: 'divider-or' }, 'or'));

      const tabs = U.el('div', { class: 'auth-tabs', role: 'tablist' });
      [['login', 'Sign in'], ['register', 'Create account']].forEach(([m, label]) => {
        tabs.appendChild(U.el('button', {
          class: 'auth-tab' + (mode === m ? ' active' : ''), role: 'tab',
          'aria-selected': mode === m ? 'true' : 'false',
          onclick: () => { mode = m; draw(); }
        }, label));
      });
      card.appendChild(tabs);

      // cloud on \u2192 email accounts (confirmation + recovery via Supabase);
      // cloud off \u2192 the original on-device username accounts
      const cloud = !!auth.cloudReady;
      const idIn = U.el('input', {
        class: 'input',
        type: cloud ? 'email' : 'text',
        autocomplete: cloud ? 'email' : 'username',
        inputmode: cloud ? 'email' : null,
        placeholder: cloud ? 'Email' : 'Username',
        'aria-label': cloud ? 'Email' : 'Username'
      });
      const passIn = U.el('input', { class: 'input', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', placeholder: mode === 'login' ? 'Password' : 'Password (8+ characters)', 'aria-label': 'Password' });
      const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
      card.appendChild(idIn);
      card.appendChild(passIn);
      card.appendChild(err);

      function confirmNotice(email) {
        card.innerHTML = '';
        card.appendChild(U.el('div', { class: 'confirm-note' }, [
          U.el('div', { class: 'confirm-emoji', 'aria-hidden': 'true' }, '\u{1F4EC}'),
          U.el('h3', {}, 'Check your inbox'),
          U.el('p', { class: 'muted' }, 'We sent a confirmation link to ' + email + '. Open it on this device and you\u2019ll be signed in automatically.'),
          U.el('p', { class: 'muted small' }, 'Nothing arriving? Check spam, or try again in a minute \u2014 confirmation emails are rate-limited.'),
          U.el('button', { class: 'btn ghost wide', onclick: () => draw() }, '\u2190 Back to sign in')
        ]));
      }

      async function go() {
        err.textContent = '';
        const btnEl = U.$('.auth-go', card);
        btnEl.disabled = true;
        try {
          if (cloud) {
            const email = idIn.value.trim();
            if (mode === 'login') {
              await auth.signInEmail(email, passIn.value);
              onSignedIn();
            } else {
              const res = await auth.signUpEmail(email, passIn.value);
              if (res.confirmed) onSignedIn();
              else confirmNotice(email);
            }
          } else {
            if (mode === 'login') await auth.login(idIn.value, passIn.value);
            else await auth.register(idIn.value, passIn.value);
            onSignedIn();
          }
        } catch (e) {
          err.textContent = e.message;
          btnEl.disabled = false;
        }
      }
      passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });

      card.appendChild(U.el('button', { class: 'btn primary wide auth-go', onclick: go },
        mode === 'login' ? 'Sign in' : 'Create account'));

      if (cloud && mode === 'login') {
        card.appendChild(U.el('button', {
          class: 'link-btn', type: 'button',
          onclick: () => forgotPasswordSheet(idIn.value.trim())
        }, 'Forgot password?'));
      }

      card.appendChild(U.el('div', { class: 'divider-or' }, 'or'));
      card.appendChild(U.el('button', {
        class: 'btn ghost wide',
        onclick: () => { auth.guest(); onSignedIn(); }
      }, 'Try it as a guest'));

      if (cloud) {
        // privacy option: the original no-email, on-device accounts
        const det = U.el('details', { class: 'device-account' });
        det.appendChild(U.el('summary', {}, 'Prefer a device-only account? (no email needed)'));
        const dUser = U.el('input', { class: 'input', type: 'text', autocomplete: 'username', placeholder: 'Username' });
        const dPass = U.el('input', { class: 'input', type: 'password', placeholder: 'Password (8+ characters)' });
        const dErr = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        const row = U.el('div', { class: 'btn-row' }, [
          U.el('button', {
            class: 'btn ghost',
            onclick: async () => { dErr.textContent = ''; try { await auth.login(dUser.value, dPass.value); onSignedIn(); } catch (e) { dErr.textContent = e.message; } }
          }, 'Sign in'),
          U.el('button', {
            class: 'btn ghost',
            onclick: async () => { dErr.textContent = ''; try { await auth.register(dUser.value, dPass.value); onSignedIn(); } catch (e) { dErr.textContent = e.message; } }
          }, 'Create')
        ]);
        det.appendChild(dUser); det.appendChild(dPass); det.appendChild(dErr); det.appendChild(row);
        det.appendChild(U.el('p', { class: 'muted small' }, 'Device-only accounts never touch a server \u2014 but they can\u2019t be recovered if you forget the password, and they don\u2019t sync.'));
        card.appendChild(det);
      }

      card.appendChild(U.el('p', { class: 'muted small center' },
        cloud
          ? 'Email and Google/Apple accounts get a confirmation email, password recovery, and a private cloud backup that follows you across devices.'
          : 'Accounts live on this device: passwords are salted & hashed (PBKDF2), and each profile\u2019s data is kept separate. Nothing is sent to a server.'));
    }

    function forgotPasswordSheet(prefill) {
      ui.sheet({
        title: 'Reset your password',
        render(body, close) {
          body.appendChild(U.el('p', { class: 'sheet-text' },
            'Enter your account email and we\u2019ll send a reset link. Opening it brings you back here to set a new password.'));
          const emailIn = U.el('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'Email', value: prefill || '' });
          const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
          body.appendChild(emailIn); body.appendChild(err);
          body.appendChild(U.el('div', { class: 'sheet-actions' }, [
            U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
            U.el('button', {
              class: 'btn primary',
              onclick: async () => {
                err.textContent = '';
                try { await auth.resetPassword(emailIn.value.trim()); close(); ui.toast('Reset link sent \u2014 check your inbox'); }
                catch (e) { err.textContent = e.message; }
              }
            }, 'Send reset link')
          ]));
        }
      });
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
    const cloudEmail = auth.provider && auth.provider() === 'email';
    ui.sheet({
      title: 'Change password',
      render(body, close) {
        const oldIn = cloudEmail ? null : U.el('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
        const newIn = U.el('input', { class: 'input', type: 'password', placeholder: 'New password (8+ characters)', autocomplete: 'new-password' });
        const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        if (oldIn) body.appendChild(oldIn);
        body.appendChild(newIn); body.appendChild(err);
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', { class: 'btn ghost', onclick: close }, 'Cancel'),
          U.el('button', {
            class: 'btn primary',
            onclick: async () => {
              try {
                if (cloudEmail) await auth.updatePassword(newIn.value);
                else await auth.changePassword(oldIn.value, newIn.value);
                close(); ui.toast('Password changed');
              }
              catch (e) { err.textContent = e.message; }
            }
          }, 'Change password')
        ]));
      }
    });
  }

  /* shown when the user arrives from a password-reset email */
  function promptNewPassword() {
    ui.sheet({
      title: 'Set a new password',
      render(body, close) {
        body.appendChild(U.el('p', { class: 'sheet-text' }, 'You followed a reset link — choose a new password for your account.'));
        const newIn = U.el('input', { class: 'input', type: 'password', placeholder: 'New password (8+ characters)', autocomplete: 'new-password' });
        const err = U.el('p', { class: 'auth-error', 'aria-live': 'polite' }, '');
        body.appendChild(newIn); body.appendChild(err);
        body.appendChild(U.el('div', { class: 'sheet-actions' }, [
          U.el('button', {
            class: 'btn primary',
            onclick: async () => {
              err.textContent = '';
              try { await auth.updatePassword(newIn.value); close(); ui.toast('Password updated — you’re signed in'); }
              catch (e) { err.textContent = e.message; }
            }
          }, 'Save new password')
        ]));
      }
    });
  }

  function deleteAccountSheet(onDone) {
    ui.sheet({
      title: 'Delete this account',
      render(body, close) {
        body.appendChild(U.el('p', { class: 'sheet-text' },
          isCloudAccount()
            ? 'This removes all ShelfLife data for this account \u2014 on this device and the cloud backup \u2014 and signs you out. There is no undo.'
            : 'This permanently removes the account and all its data \u2014 pantry, plans, history \u2014 from this device. There is no undo.'));
        const passIn = (auth.isGuest() || isCloudAccount()) ? null : U.el('input', { class: 'input', type: 'password', placeholder: 'Confirm with your password' });
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
    const handle = auth.handle ? auth.handle() : username;
    const oauthed = oauthProvider();
    const cloudAcct = isCloudAccount();
    const p = planner.prefs();

    container.appendChild(ui.header('You', 'Account'));

    /* profile */
    const prof = U.el('section', { class: 'card' });
    prof.appendChild(U.el('div', { class: 'card-title-row' }, [
      U.el('h3', { class: 'card-title' }, '@' + handle),
      auth.isGuest() ? U.el('span', { class: 'chip small static' }, 'guest') : null,
      cloudAcct ? U.el('span', { class: 'chip small static' }, 'via ' + (oauthed ? (oauthed === 'apple' ? 'Apple' : 'Google') : 'email')) : null
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
      oauthed
        ? 'You\u2019re signed in with ' + (oauthed === 'apple' ? 'Apple' : 'Google') + ' \u2014 your password and sign-in security live there, and ShelfLife never sees them. Your data is backed up privately to your cloud account (row-level security) and restored when you sign in on another device.'
        : cloudAcct
          ? 'You\u2019re signed in with a confirmed email account. Your password is handled by secure cloud auth (never stored by ShelfLife), you can reset it by email from the sign-in screen, and your data is backed up privately (row-level security) and restored when you sign in on another device.'
          : (auth.strongCrypto
            ? 'Your password is salted and hashed with PBKDF2-SHA256 (210k rounds) \u2014 it is never stored. '
            : 'This browser lacks WebCrypto, so a weaker fallback hash is in use. ')
          + 'Data lives only in this browser\u2019s storage; anyone with full access to this device could read it. For synced, server-side accounts see the README\u2019s cloud sign-in guide.'));
    if (!auth.isGuest() && !oauthed) {
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
      onclick: async () => { await auth.logout(); g.location.hash = ''; g.location.reload(); }
    }, 'Sign out'));
    sess.appendChild(U.el('button', {
      class: 'btn danger wide',
      onclick: () => deleteAccountSheet(() => { g.location.hash = ''; g.location.reload(); })
    }, 'Delete account & data'));
    container.appendChild(sess);
  }

  g.SL = g.SL || {};
  g.SL.views = g.SL.views || {};
  g.SL.views.account = { render, renderAuth, promptNewPassword };
})(typeof window !== 'undefined' ? window : globalThis);
