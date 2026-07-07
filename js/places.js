/* ShelfLife — places.js
   Real nearby grocery stores, no API key required: OpenStreetMap's Overpass
   API finds actual supermarkets within the user's chosen radius, and
   Nominatim handles geolocation lookups (both are free, CORS-open public
   services — be gentle, results are cached for a day).

   Store names are chain-matched so live retailer lanes attach to the real
   location ("Walmart Supercenter" gets walmart.com prices; Kroger-family
   banners get the Kroger API when configured). Everything else keeps
   clearly-labeled estimated pricing until its API is wired.
   Pure helpers are Node-safe and exercised by dev/validate.js. */
(function (g) {
  'use strict';
  const db = g.SL.db;

  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  const NOMINATIM = 'https://nominatim.openstreetmap.org';
  const TTL = 24 * 60 * 60 * 1000;

  /* ---------- pure helpers (validated in Node) ---------- */
  function distMi(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // earth radius, miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  const KROGER_FAMILY = /\b(kroger|ralphs|fred meyer|king soopers|fry'?s|smith'?s|qfc|harris teeter|dillons|food 4 less|city market|mariano'?s|pick ?'?n ?save|metro market|bakers)\b/i;

  function chainOf(name) {
    const n = String(name || '');
    if (/\bwal.?mart\b/i.test(n)) return 'walmart';
    if (KROGER_FAMILY.test(n)) return 'kroger';
    return null;
  }

  /* ---------- cache ---------- */
  function cacheKey(lat, lon, mi) {
    return 'osmStores:' + lat.toFixed(2) + ',' + lon.toFixed(2) + ':' + mi;
  }

  /* The roster for the CURRENT prefs location, or null. Sync — this is what
     stores.js reads while pricing. */
  function cachedFor() {
    const p = g.SL.planner ? g.SL.planner.prefs() : null;
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
    const c = db.gget(cacheKey(p.lat, p.lon, p.radiusMi || 5), null);
    return (c && c.stores && c.stores.length) ? c : null;
  }

  /* ---------- network ---------- */
  async function ensure(prefs) {
    if (typeof g.fetch !== 'function') return null;
    if (typeof prefs.lat !== 'number' || typeof prefs.lon !== 'number') return null;
    const mi = prefs.radiusMi || 5;
    const key = cacheKey(prefs.lat, prefs.lon, mi);
    const hit = db.gget(key, null);
    if (hit && hit.ts && (Date.now() - hit.ts) < TTL) return hit;

    const meters = Math.round(mi * 1609);
    const q = '[out:json][timeout:15];('
      + 'node["shop"="supermarket"](around:' + meters + ',' + prefs.lat + ',' + prefs.lon + ');'
      + 'way["shop"="supermarket"](around:' + meters + ',' + prefs.lat + ',' + prefs.lon + ');'
      + ');out center 40;';
    const res = await g.fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) throw new Error('Store lookup unavailable right now (' + res.status + ')');
    const data = await res.json();

    const seen = {};
    const stores = (data.elements || [])
      .map((el) => {
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);
        const name = el.tags && (el.tags.name || el.tags.brand);
        if (!name || !lat) return null;
        return { id: 'osm_' + el.id, name, lat, lon, dist: distMi(prefs.lat, prefs.lon, lat, lon), chain: chainOf(name) };
      })
      .filter(Boolean)
      .filter((s) => { // dedupe same-name stores that are OSM node+way twins
        const k = s.name + ':' + Math.round(s.dist * 2);
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);

    const entry = { ts: Date.now(), place: prefs.place || '', stores };
    db.gset(key, entry);
    return entry;
  }

  /* geolocate + reverse-lookup a human-readable place name */
  function locate() {
    return new Promise((resolve, reject) => {
      if (!g.navigator || !g.navigator.geolocation) return reject(new Error('Location isn’t available in this browser.'));
      g.navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1000) / 1000;
        const lon = Math.round(pos.coords.longitude * 1000) / 1000;
        let place = '', zip = '';
        try {
          const r = await g.fetch(NOMINATIM + '/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon);
          const j = await r.json();
          const a = j.address || {};
          place = a.city || a.town || a.village || a.suburb || a.county || '';
          zip = a.postcode || '';
        } catch (e) { /* name lookup is a nicety, not a requirement */ }
        resolve({ lat, lon, place, zip });
      }, () => reject(new Error('Couldn’t get your location — enter a ZIP instead.')), { timeout: 10000, maximumAge: 600000 });
    });
  }

  /* zip → coordinates + place name */
  async function geocodeZip(zip) {
    const clean = String(zip || '').replace(/\D/g, '').slice(0, 5);
    if (clean.length !== 5) throw new Error('Enter a 5-digit ZIP.');
    const r = await g.fetch(NOMINATIM + '/search?format=jsonv2&postalcode=' + clean + '&countrycodes=us&limit=1');
    const j = await r.json();
    if (!j.length) throw new Error('Couldn’t find that ZIP.');
    const hit = j[0];
    const place = (hit.display_name || '').split(',').slice(0, 2).join(',').trim();
    return { lat: Math.round(+hit.lat * 1000) / 1000, lon: Math.round(+hit.lon * 1000) / 1000, place, zip: clean };
  }

  g.SL = g.SL || {};
  g.SL.places = { distMi, chainOf, cachedFor, ensure, locate, geocodeZip };
})(typeof window !== 'undefined' ? window : globalThis);
