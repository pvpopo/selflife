/* ShelfLife — proxy/kroger-worker.js
   Cloudflare Worker for the Kroger lane. Kroger's public API (free, no paid
   membership) offers what Walmart's affiliate API doesn't: TRUE per-store
   availability (stock level at a specific location) and location search.
   The client credentials live here, never in the static site.

   Endpoints:
     GET /stores?zip=98101
       → [{ id, name, address }]                      (nearest Kroger-family stores)
     GET /match?locationId=<id>&terms=<foodId>:<name>|...
       → { "<foodId>": { id, price, available, name } | null, ... }

   ── Setup (once, ~10 minutes) ─────────────────────────────────────────────
   1. Create a free account at https://developer.kroger.com, register an
      application with the "Products" API (product.compact scope), and note
      the Client ID and Client Secret.
   2. Deploy:
        wrangler deploy proxy/kroger-worker.js --name shelflife-kroger
        wrangler secret put KROGER_CLIENT_ID --name shelflife-kroger
        wrangler secret put KROGER_CLIENT_SECRET --name shelflife-kroger
      Optionally lock CORS: --var ALLOW_ORIGIN:https://pvpopo.github.io
   3. Put the worker URL into js/config.js → krogerProxy.
   ──────────────────────────────────────────────────────────────────────────
   Product lookups are edge-cached per (location, term) for 6h; locations per
   zip for 24h. OAuth tokens are cached until shortly before expiry. */

const API = 'https://api.kroger.com/v1';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === '/stores') {
        const zip = (url.searchParams.get('zip') || '').replace(/\D/g, '').slice(0, 5);
        if (zip.length !== 5) return json({ error: 'zip required' }, 400, cors);
        return json(await storesCached(zip, env), 200, { ...cors, 'Cache-Control': 'public, max-age=3600' });
      }
      if (url.pathname === '/match') {
        const locationId = url.searchParams.get('locationId') || '';
        const terms = (url.searchParams.get('terms') || '').split('|').map((t) => t.trim()).filter(Boolean).slice(0, 80);
        if (!locationId || !terms.length) return json({ error: 'locationId and terms required' }, 400, cors);
        const out = {};
        for (const batch of chunk(terms, 5)) {
          await Promise.all(batch.map(async (term) => {
            const sep = term.indexOf(':');
            const foodId = sep > 0 ? term.slice(0, sep) : term;
            const name = sep > 0 ? term.slice(sep + 1) : term;
            out[foodId] = await productCached(locationId, name, env);
          }));
        }
        return json(out, 200, { ...cors, 'Cache-Control': 'public, max-age=3600' });
      }
      return json({ error: 'GET /stores?zip= or /match?locationId=&terms=' }, 404, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, cors);
    }
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...(headers || {}) } });
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ---- OAuth: client-credentials token, cached until near expiry ---- */
let tokenCache = { token: null, exp: 0 };

async function token(env) {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60000) return tokenCache.token;
  const res = await fetch(API + '/connect/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(env.KROGER_CLIENT_ID + ':' + env.KROGER_CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials&scope=product.compact'
  });
  if (!res.ok) throw new Error('kroger auth ' + res.status);
  const data = await res.json();
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 1800) * 1000 };
  return tokenCache.token;
}

/* ---- nearest locations for a zip (24h edge cache) ---- */
async function storesCached(zip, env) {
  const key = new Request('https://cache.local/kr/stores/' + zip);
  const hit = await caches.default.match(key);
  if (hit) return hit.json();

  const t = await token(env);
  const res = await fetch(API + '/locations?filter.zipCode.near=' + zip + '&filter.limit=3', {
    headers: { Authorization: 'Bearer ' + t }
  });
  if (!res.ok) throw new Error('kroger locations ' + res.status);
  const data = await res.json();
  const stores = (data.data || []).map((l) => ({
    id: l.locationId,
    name: (l.chain ? l.chain.charAt(0) + l.chain.slice(1).toLowerCase() : 'Kroger') + ' · ' + ((l.address && l.address.city) || ''),
    address: l.address ? [l.address.addressLine1, l.address.city].filter(Boolean).join(', ') : ''
  }));
  await caches.default.put(key, new Response(JSON.stringify(stores), {
    headers: { 'Cache-Control': 'public, max-age=86400' }
  }));
  return stores;
}

/* ---- product match at a specific store (6h edge cache) ---- */
async function productCached(locationId, name, env) {
  const key = new Request('https://cache.local/kr/p/' + locationId + '/' + encodeURIComponent(name.toLowerCase()));
  const hit = await caches.default.match(key);
  if (hit) return (await hit.json()).match;

  let match = null;
  try { match = await product(locationId, name, env); } catch (e) { /* hiccup → null, not cached */ }
  if (match !== null) {
    await caches.default.put(key, new Response(JSON.stringify({ match }), {
      headers: { 'Cache-Control': 'public, max-age=21600' }
    }));
  }
  return match;
}

async function product(locationId, name, env) {
  const t = await token(env);
  const res = await fetch(API + '/products?filter.term=' + encodeURIComponent(name) + '&filter.locationId=' + encodeURIComponent(locationId) + '&filter.limit=3', {
    headers: { Authorization: 'Bearer ' + t }
  });
  if (!res.ok) throw new Error('kroger products ' + res.status);
  const data = await res.json();
  const products = data.data || [];
  // prefer something actually in stock at this store
  const scored = products.map((p) => {
    const item = (p.items && p.items[0]) || {};
    const stock = item.inventory && item.inventory.stockLevel;
    const price = item.price ? (item.price.promo || item.price.regular) : null;
    return {
      id: p.productId,
      name: p.description || null,
      price: typeof price === 'number' && price > 0 ? price : null,
      available: stock ? stock !== 'TEMPORARILY_OUT_OF_STOCK' : (item.fulfillment ? !!(item.fulfillment.inStore || item.fulfillment.curbside) : true),
      stock: stock || null
    };
  });
  const best = scored.find((p) => p.available && p.price !== null) || scored.find((p) => p.available) || scored[0];
  return best || null;
}
