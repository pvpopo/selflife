/* ShelfLife — auth.js
   Local accounts: salted PBKDF2-SHA256 password hashing (WebCrypto, 210k
   rounds), per-user sessions, guest mode. No server — the registry and the
   session marker live under db's global keys; user data is isolated by
   db.bind(username). Falls back to a weaker pure-JS hash where WebCrypto
   is unavailable (the UI discloses this via auth.strongCrypto). */
(function (g) {
  'use strict';
  const db = g.SL.db;

  const ITERATIONS = 210000;
  const GUEST = 'guest';
  const subtle = g.crypto && g.crypto.subtle;

  /* ---------- primitives ---------- */
  function randomSalt() {
    if (g.crypto && g.crypto.getRandomValues) {
      const b = new Uint8Array(16);
      g.crypto.getRandomValues(b);
      return toHex(b);
    }
    // last-resort salt: still per-account, just not cryptographically random
    let s = '';
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function pbkdf2(password, saltHex) {
    const enc = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      key, 256
    );
    return toHex(new Uint8Array(bits));
  }

  function weakHash(password, saltHex) {
    // FNV-1a-style iterated mix — NOT cryptographically strong; only used
    // when WebCrypto is missing so the app still functions.
    let out = '';
    for (let lane = 0; lane < 8; lane++) {
      let h = (2166136261 ^ lane) >>> 0;
      const input = saltHex + ':' + password;
      for (let round = 0; round < 2048; round++) {
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        h = (h ^ (h >>> 15)) >>> 0;
      }
      out += h.toString(16).padStart(8, '0');
    }
    return out;
  }

  async function hashPassword(password, saltHex) {
    return subtle ? pbkdf2(password, saltHex) : Promise.resolve(weakHash(password, saltHex));
  }

  function constantEq(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- registry & session ---------- */
  function users() { return db.gget('users', {}); }
  function saveUsers(u) { db.gset('users', u); }

  function normalize(username) { return String(username || '').trim().toLowerCase(); }

  function validUsername(u) { return /^[a-z0-9_]{3,20}$/.test(u); }

  function requirePassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Password needs at least 8 characters.');
    }
  }

  let session = null; // { user, guest }

  function startSession(username, isGuest) {
    session = { user: username, guest: !!isGuest };
    db.gset('session', session);
    db.bind(username);
    return username;
  }

  async function verify(record, password) {
    const hash = await hashPassword(password, record.salt);
    return constantEq(hash, record.hash);
  }

  /* ---------- public API ---------- */
  const auth = {
    strongCrypto: !!subtle,

    current() { return session ? session.user : null; },
    isGuest() { return !!(session && session.guest); },

    resume() {
      const saved = db.gget('session', null);
      if (!saved || !saved.user) return null;
      if (!saved.guest && !users()[saved.user]) { db.gdel('session'); return null; }
      session = { user: saved.user, guest: !!saved.guest };
      db.bind(saved.user);
      return saved.user;
    },

    async register(username, password) {
      const name = normalize(username);
      if (!validUsername(name)) {
        throw new Error('Username must be 3–20 characters: letters, numbers or underscores.');
      }
      if (name === GUEST) throw new Error('That name is reserved — try another.');
      requirePassword(password);
      const reg = users();
      if (reg[name]) throw new Error('That username is taken — sign in instead?');
      const salt = randomSalt();
      const hash = await hashPassword(password, salt);
      reg[name] = { salt, hash, iterations: ITERATIONS, algo: subtle ? 'PBKDF2-SHA256' : 'weak-fnv', created: new Date().toISOString() };
      saveUsers(reg);
      return startSession(name, false);
    },

    async login(username, password) {
      const name = normalize(username);
      const record = users()[name];
      // hash even for unknown users so timing doesn't reveal which usernames exist
      const ok = record ? await verify(record, String(password || '')) : (await hashPassword(String(password || ''), randomSalt()), false);
      if (!ok) throw new Error('Wrong username or password.');
      return startSession(name, false);
    },

    guest() {
      return startSession(GUEST, true);
    },

    logout() {
      session = null;
      db.gdel('session');
      db.unbind();
    },

    async changePassword(oldPassword, newPassword) {
      if (!session || session.guest) throw new Error('Guests don’t have a password.');
      const reg = users();
      const record = reg[session.user];
      if (!record || !(await verify(record, String(oldPassword || '')))) {
        throw new Error('Current password is incorrect.');
      }
      requirePassword(newPassword);
      record.salt = randomSalt();
      record.hash = await hashPassword(newPassword, record.salt);
      record.iterations = ITERATIONS;
      record.algo = subtle ? 'PBKDF2-SHA256' : 'weak-fnv';
      saveUsers(reg);
    },

    async deleteAccount(password) {
      if (!session) throw new Error('Not signed in.');
      const name = session.user;
      if (!session.guest) {
        const record = users()[name];
        if (!record || !(await verify(record, String(password || '')))) {
          throw new Error('Password doesn’t match — account kept.');
        }
        const reg = users();
        delete reg[name];
        saveUsers(reg);
      }
      db.wipeUser(name);
      auth.logout();
    }
  };

  g.SL = g.SL || {};
  g.SL.auth = auth;
})(typeof window !== 'undefined' ? window : globalThis);
