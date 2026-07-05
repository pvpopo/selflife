/* ShelfLife — util.js
   Small dependency-free helpers shared across the app.
   Classic script (no modules) so the app also runs from file:// without a server. */
(function (g) {
  'use strict';

  const U = {};

  /* ---------- DOM ---------- */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.el = function (tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  };

  U.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- ids / misc ---------- */
  U.uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  U.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  U.round1 = (n) => Math.round(n * 10) / 10;
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  U.byId = (arr) => { const m = {}; arr.forEach((x) => { m[x.id] = x; }); return m; };
  U.debounce = function (fn, ms) {
    let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  };
  U.plural = (n, one, many) => (n === 1 ? one : (many || one + 's'));
  U.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /* ---------- money / quantities ---------- */
  U.money = (n) => '$' + (Math.round(n * 100) / 100).toFixed(2);

  U.fmtQty = function (qty, unit) {
    if (unit === 'ct') return '\u00d7' + U.round1(qty);            // ×3
    if (unit === 'g') return qty >= 1000 ? U.round1(qty / 1000) + ' kg' : Math.round(qty) + ' g';
    if (unit === 'ml') return qty >= 1000 ? U.round1(qty / 1000) + ' L' : Math.round(qty) + ' ml';
    return U.round1(qty) + ' ' + unit;
  };

  /* ---------- dates ---------- */
  U.today = function () { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  U.addDays = function (date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
  U.iso = (d) => {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };
  U.parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  U.daysBetween = (a, b) => Math.round((U.parseISO(U.iso(b)) - U.parseISO(U.iso(a))) / 86400000);
  U.daysLeft = (expiresISO) => U.daysBetween(U.today(), U.parseISO(expiresISO));
  U.fmtDate = function (d) {
    const x = typeof d === 'string' ? U.parseISO(d) : d;
    return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  U.fmtDateLong = function (d) {
    const x = typeof d === 'string' ? U.parseISO(d) : d;
    return x.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  U.isoWeek = function (date) {
    // ISO-8601 week number; used to rotate weekly store deals.
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  /* ---------- deterministic pseudo-randomness ----------
     Store availability, prices and weekly deals are simulated but stable:
     the same zip code always produces the same nearby stores and prices. */
  U.strSeed = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.rngFor = (str) => U.mulberry32(U.strSeed(str));

  /* ---------- fuzzy text matching (receipt lines -> foods) ---------- */
  U.normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  U.tokenScore = function (text, candidate) {
    // Overlap score between a receipt line and a food name/alias. 0..1
    const a = U.normalize(text), b = U.normalize(candidate);
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return 0.95;
    const at = new Set(a.split(' ')), bt = b.split(' ');
    let hit = 0;
    for (const t of bt) {
      if (at.has(t)) { hit++; continue; }
      // prefix match helps with receipt abbreviations: "CHKN" ~ "chicken"
      for (const w of at) {
        if (t.length >= 3 && w.length >= 3 && (w.startsWith(t.slice(0, 4)) || t.startsWith(w.slice(0, 4)))) { hit += 0.7; break; }
      }
    }
    return hit / bt.length;
  };

  g.SL = g.SL || {};
  g.SL.util = U;
})(typeof window !== 'undefined' ? window : globalThis);
