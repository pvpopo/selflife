/* ShelfLife — db.js
   Thin persistence layer over localStorage.
   - Global keys (user registry, session) live under "sl:".
   - Each user's data lives under "sl:u:<username>:" so accounts are isolated.
   - Everything is JSON in/out with safe fallbacks. */
(function (g) {
  'use strict';

  const GLOBAL_PREFIX = 'sl:';
  let userPrefix = null;

  function safeParse(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  const store = (() => {
    // localStorage can be unavailable (private mode quirks); degrade to memory.
    try {
      const t = '__sl_test__';
      g.localStorage.setItem(t, '1');
      g.localStorage.removeItem(t);
      return g.localStorage;
    } catch (e) {
      const mem = {};
      return {
        getItem: (k) => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: (k) => { delete mem[k]; },
        key: (i) => Object.keys(mem)[i] || null,
        get length() { return Object.keys(mem).length; }
      };
    }
  })();

  // change listeners (the cloud backup layer subscribes to these)
  const watchers = [];
  function notify(key) { watchers.forEach((fn) => { try { fn(key); } catch (e) { /* a bad listener never blocks writes */ } }); }

  const db = {
    /* ---- account binding ---- */
    bind(username) { userPrefix = GLOBAL_PREFIX + 'u:' + username + ':'; },
    unbind() { userPrefix = null; },
    isBound() { return !!userPrefix; },
    watch(fn) { watchers.push(fn); },

    /* ---- per-user data ---- */
    get(key, fallback) {
      if (!userPrefix) return fallback;
      return safeParse(store.getItem(userPrefix + key), fallback);
    },
    set(key, value) {
      if (!userPrefix) return;
      store.setItem(userPrefix + key, JSON.stringify(value));
      notify(key);
    },
    del(key) { if (userPrefix) { store.removeItem(userPrefix + key); notify(key); } },

    /* ---- global (cross-account) data ---- */
    gget(key, fallback) { return safeParse(store.getItem(GLOBAL_PREFIX + key), fallback); },
    gset(key, value) { store.setItem(GLOBAL_PREFIX + key, JSON.stringify(value)); },
    gdel(key) { store.removeItem(GLOBAL_PREFIX + key); },

    /* ---- backup / restore ---- */
    exportUser(username) {
      const prefix = GLOBAL_PREFIX + 'u:' + username + ':';
      const out = { app: 'ShelfLife', version: 1, username, exported: new Date().toISOString(), data: {} };
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(prefix)) out.data[k.slice(prefix.length)] = safeParse(store.getItem(k), null);
      }
      return out;
    },
    importUser(username, payload) {
      if (!payload || payload.app !== 'ShelfLife' || typeof payload.data !== 'object') {
        throw new Error('That file is not a ShelfLife backup.');
      }
      const prefix = GLOBAL_PREFIX + 'u:' + username + ':';
      Object.entries(payload.data).forEach(([k, v]) => store.setItem(prefix + k, JSON.stringify(v)));
    },
    wipeUser(username) {
      const prefix = GLOBAL_PREFIX + 'u:' + username + ':';
      const doomed = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(prefix)) doomed.push(k);
      }
      doomed.forEach((k) => store.removeItem(k));
    }
  };

  g.SL = g.SL || {};
  g.SL.db = db;
})(typeof window !== 'undefined' ? window : globalThis);
