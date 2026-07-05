/* ShelfLife — auth-cloud.js
   Optional Google / Apple sign-in via Supabase, layered over the local
   PBKDF2 accounts in auth.js. Loads only in the browser; when js/config.js
   has no Supabase credentials this file still installs the facade so the
   OAuth buttons can explain what's missing, but all behavior stays local.

   Security model: the OAuth handshake and token storage/refresh are handled
   entirely by supabase-js (PKCE flow, tokens never touch our code paths).
   Each cloud user gets an isolated data namespace (sb_<uuid>), and their
   data is backed up to a row-level-secured snapshots table so signing in
   on another device restores it. */
(function (g) {
  'use strict';
  if (!g.document) return; // browser-only layer; dev/validate.js exercises auth.js directly

  const db = g.SL.db;
  const local = g.SL.auth;
  const cfg = (g.SL.config && g.SL.config.supabase) || {};
  const configured = !!(cfg.url && cfg.anonKey);

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  const TABLE = 'shelflife_snapshots';

  let client = null;
  let cloud = null; // { uid, handle, provider }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (g.supabase) return resolve();
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Couldn’t load the sign-in library — check your connection.'));
      document.head.appendChild(s);
    });
  }

  async function ensureClient() {
    if (client) return client;
    await loadSdk();
    client = g.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { flowType: 'pkce' } // authorization-code flow: no tokens in the URL fragment
    });
    return client;
  }

  function handleFor(user) {
    const m = user.user_metadata || {};
    const base = m.preferred_username || m.name || m.full_name
      || (user.email ? user.email.split('@')[0] : 'you');
    return String(base).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'you';
  }

  function nsFor(uid) { return 'sb_' + uid; }

  function bindCloud(user) {
    cloud = {
      uid: user.id,
      handle: handleFor(user),
      provider: (user.app_metadata && user.app_metadata.provider) || 'oauth'
    };
    db.bind(nsFor(user.id));
  }

  /* ---------- cloud snapshot backup (last write wins) ---------- */
  let pushTimer = null;

  async function pushSnapshot() {
    if (!cloud || !client) return;
    const stamp = new Date().toISOString();
    const snap = db.exportUser(nsFor(cloud.uid));
    try {
      const { error } = await client.from(TABLE)
        .upsert({ user_id: cloud.uid, data: snap, updated_at: stamp });
      if (!error) db.gset('cloud:seen:' + cloud.uid, stamp);
    } catch (e) { /* offline — the next change retries */ }
  }

  function schedulePush() {
    if (!cloud) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSnapshot, 4000);
  }

  async function pullSnapshot() {
    if (!cloud || !client) return;
    try {
      const { data, error } = await client.from(TABLE)
        .select('data, updated_at').eq('user_id', cloud.uid).maybeSingle();
      if (error || !data) return;
      const seen = db.gget('cloud:seen:' + cloud.uid, null);
      if (!seen || data.updated_at > seen) {
        db.importUser(nsFor(cloud.uid), data.data);
        db.gset('cloud:seen:' + cloud.uid, data.updated_at);
      }
    } catch (e) { /* offline — local copy is authoritative until we reconnect */ }
  }

  if (db.watch) db.watch(() => schedulePush());

  /* ---------- facade over the local auth API ---------- */
  const facade = Object.assign({}, local, {
    cloudReady: configured,

    current() { return cloud ? nsFor(cloud.uid) : local.current(); },
    isGuest() { return cloud ? false : local.isGuest(); },
    handle() { return cloud ? cloud.handle : local.current(); },
    provider() {
      if (cloud) return cloud.provider;
      if (!local.current()) return null;
      return local.isGuest() ? 'guest' : 'local';
    },

    async resume() {
      // surface OAuth errors bounced back from the provider (e.g. "provider
      // is not enabled") instead of silently landing on the sign-in screen
      const bounced = new URLSearchParams(
        (g.location.search || '').slice(1) + '&' + (g.location.hash || '').slice(1)
      );
      const oauthError = bounced.get('error_description') || bounced.get('error');
      if (oauthError) {
        g.history.replaceState(null, '', g.location.pathname);
        if (g.SL.ui) g.SL.ui.toast('Sign-in failed: ' + oauthError.replace(/\+/g, ' '), 'warn');
      }
      if (configured) {
        try {
          const c = await ensureClient();
          const { data } = await c.auth.getSession();
          if (data && data.session) {
            bindCloud(data.session.user);
            await pullSnapshot();
            return facade.current();
          }
        } catch (e) { /* SDK unreachable (offline) — fall back to local accounts */ }
      }
      return local.resume();
    },

    async oauth(provider) {
      if (!configured) {
        throw new Error('Cloud sign-in isn’t configured yet — paste your Supabase keys into js/config.js (see “Cloud sign-in” in the README).');
      }
      const c = await ensureClient();
      const { error } = await c.auth.signInWithOAuth({
        provider,
        options: { redirectTo: g.location.origin + g.location.pathname }
      });
      if (error) throw new Error(error.message);
      // the browser is now navigating to the provider's consent screen
    },

    async logout() {
      if (cloud) {
        clearTimeout(pushTimer);
        await pushSnapshot(); // don't lose the last few seconds of changes
        cloud = null;
        db.unbind();
        try { await client.auth.signOut(); } catch (e) { /* token revoke is best-effort */ }
        return;
      }
      local.logout();
    },

    async changePassword(oldPassword, newPassword) {
      if (cloud) {
        throw new Error('Your password lives with ' + (cloud.provider === 'apple' ? 'Apple' : 'Google') + ' — change it there.');
      }
      return local.changePassword(oldPassword, newPassword);
    },

    async deleteAccount(password) {
      if (cloud) {
        const uid = cloud.uid;
        clearTimeout(pushTimer);
        try { await client.from(TABLE).delete().eq('user_id', uid); } catch (e) { /* row may not exist */ }
        db.wipeUser(nsFor(uid));
        db.gdel('cloud:seen:' + uid);
        cloud = null;
        db.unbind();
        try { await client.auth.signOut(); } catch (e) { /* best-effort */ }
        return;
      }
      return local.deleteAccount(password);
    }
  });

  g.SL.auth = facade;
})(typeof window !== 'undefined' ? window : globalThis);
