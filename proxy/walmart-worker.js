/* ShelfLife — proxy/walmart-worker.js
   Cloudflare Worker that matches food names to Walmart item IDs using the
   official Walmart Affiliate API (walmart.io) — the sanctioned alternative
   to scraping. The API key lives here, never in the static site.

   Endpoint:
     GET /ids?terms=<foodId>:<name>|<foodId>:<name>|...
     → { "<foodId>": "<walmartItemId>" | null, ... }

   ── Setup (once, ~15 minutes) ─────────────────────────────────────────────
   1. Walmart credentials (free):
      - Sign up at https://walmart.io → create an application for the
        "Walmart Affiliates" API.
      - Generate an RSA key pair locally:
          openssl genrsa -out wm.pem 2048
          openssl rsa -in wm.pem -pubout -out wm.pub
          openssl pkcs8 -topk8 -inform PEM -in wm.pem -nocrypt -outform DER | base64 -w0 > wm.pkcs8.b64
      - Upload the PUBLIC key (wm.pub) in the walmart.io dashboard; note the
        Consumer ID and Key Version it assigns.
   2. Deploy this worker (free tier is plenty):
          npm i -g wrangler && wrangler login
          wrangler deploy proxy/walmart-worker.js --name shelflife-walmart
          wrangler secret put WM_CONSUMER_ID      # from the dashboard
          wrangler secret put WM_KEY_VERSION      # usually "1"
          wrangler secret put WM_PRIVATE_KEY_B64  # contents of wm.pkcs8.b64
      Optionally set ALLOW_ORIGIN as a plain var to lock CORS to your site:
          wrangler deploy ... --var ALLOW_ORIGIN:https://pvpopo.github.io
   3. Put the worker URL into js/config.js → walmartProxy. Done: the Shop
      tab's Walmart sheet now matches every item automatically.
   ──────────────────────────────────────────────────────────────────────────
   Results are cached at Cloudflare's edge for 24h per term, so Walmart's
   rate limits are a non-issue for normal traffic. */

/* Walmart environment: set WM_ENV=stage while your walmart.io app only has
   a Sandbox/Stage configuration (Stage Consumer ID). Leave unset (or set
   WM_ENV=prod) once the Production configuration is approved — stage data
   can be a limited/test catalog, so real matches need production. */
const HOSTS = {
  prod: 'https://developer.api.walmart.com',
  stage: 'https://developer.api.stg.walmart.com'
};
const SEARCH_PATH = '/api-proxy/service/affil/product/v2/search';
const CACHE_TTL = 60 * 60 * 24; // seconds

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/ids') {
      return json({ error: 'GET /ids?terms=foodId:name|foodId:name' }, 404, cors);
    }
    const terms = (url.searchParams.get('terms') || '')
      .split('|').map((t) => t.trim()).filter(Boolean).slice(0, 80);
    if (!terms.length) return json({ error: 'no terms' }, 400, cors);

    const out = {};
    // resolve sequentially-ish in small batches to stay friendly to the API
    for (const batch of chunk(terms, 5)) {
      await Promise.all(batch.map(async (term) => {
        const sep = term.indexOf(':');
        const foodId = sep > 0 ? term.slice(0, sep) : term;
        const name = sep > 0 ? term.slice(sep + 1) : term;
        out[foodId] = await lookupCached(name, env);
      }));
    }
    return json(out, 200, { ...cors, 'Cache-Control': 'public, max-age=3600' });
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* Edge-cache each product lookup for a day. */
async function lookupCached(name, env) {
  const cacheKey = new Request('https://cache.local/wm/' + encodeURIComponent(name.toLowerCase()));
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return (await hit.json()).id;

  let id = null;
  try { id = await lookup(name, env); } catch (e) { /* Walmart hiccup → null, retried next time (not cached) */ }
  if (id !== null) {
    await cache.put(cacheKey, new Response(JSON.stringify({ id }), {
      headers: { 'Cache-Control': 'public, max-age=' + CACHE_TTL }
    }));
  }
  return id;
}

/* One signed Walmart Affiliate API search; returns the best item id. */
async function lookup(name, env) {
  const ts = Date.now().toString();
  const signature = await sign(env.WM_CONSUMER_ID + '\n' + ts + '\n' + env.WM_KEY_VERSION + '\n', env.WM_PRIVATE_KEY_B64);
  const host = HOSTS[env.WM_ENV === 'stage' ? 'stage' : 'prod'];
  const res = await fetch(host + SEARCH_PATH + '?query=' + encodeURIComponent(name) + '&numItems=3', {
    headers: {
      'WM_CONSUMER.ID': env.WM_CONSUMER_ID,
      'WM_CONSUMER.INTIMESTAMP': ts,
      'WM_SEC.KEY_VERSION': env.WM_KEY_VERSION,
      'WM_SEC.AUTH_SIGNATURE': signature,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) throw new Error('walmart ' + res.status);
  const data = await res.json();
  const items = data.items || [];
  // prefer an available, shippable grocery item; fall back to the top hit
  const best = items.find((i) => i.availableOnline !== false) || items[0];
  return best ? String(best.itemId) : null;
}

/* RSA-SHA256 signature over the consumer-id/timestamp/key-version triple. */
async function sign(data, privateKeyB64) {
  const raw = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', raw.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
