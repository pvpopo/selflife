/* ShelfLife — proxy/vision-worker.js
   Cloudflare Worker that identifies groceries in a photo of a pantry,
   fridge, or freezer shelf using the Claude API (vision + structured
   output). The API key lives here, never in the static site.

   Endpoint:
     POST /scan
     body: { image: "<base64 JPEG/PNG, no data: prefix>",
             media_type: "image/jpeg" | "image/png",
             storage: "pantry" | "fridge" | "freezer" }
     → { items: [{ name, quantity, storage, confidence }], imageId|null }

   PRIVACY / RETENTION
   The uploaded photo is forwarded to the Claude API to identify the food
   and, if a VISION_IMAGES KV namespace is bound, stored with a 7-day TTL
   (auto-deleted by Cloudflare KV — no cron needed) so recent scans can be
   debugged/re-run. Without the KV binding nothing is stored here at all.
   The app's UI states this retention to the user before every scan.

   ── Setup (once, ~10 minutes) ─────────────────────────────────────────────
   1. Get an Anthropic API key: https://platform.claude.com → API keys.
   2. Deploy this worker (free tier is plenty):
          npm i -g wrangler && wrangler login
          wrangler deploy proxy/vision-worker.js --name shelflife-vision
          wrangler secret put ANTHROPIC_API_KEY
      Optionally lock CORS to your site:
          wrangler deploy ... --var ALLOW_ORIGIN:https://<you>.github.io
      Optionally keep scans for 7 days (for debugging):
          wrangler kv namespace create VISION_IMAGES
          # then add the binding to the deploy command or wrangler.toml
   3. Put the worker URL into js/config.js → visionProxy. Done: the Pantry
      tab's "Shelf photo" flow lights up.
   ────────────────────────────────────────────────────────────────────────── */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';
const IMAGE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, enforced by KV expirationTtl
const MAX_IMAGE_B64 = 8_000_000; // ~6 MB image — plenty for a downscaled shelf photo

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Common grocery name for the item, e.g. "chicken breast", "whole milk", "canned black beans". No brand names unless the brand IS the item.'
          },
          quantity: {
            type: 'integer',
            description: 'How many packages/units of this item are visible. 1 if unsure.'
          },
          storage: {
            type: 'string',
            enum: ['pantry', 'fridge', 'freezer'],
            description: 'Where this item is normally stored.'
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'How sure you are about the identification.'
          }
        },
        required: ['name', 'quantity', 'storage', 'confidence'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
};

function prompt(storage) {
  return 'This is a photo of the inside of a home ' + storage + ' (food storage). ' +
    'List every distinct FOOD or DRINK item you can identify. For each item give a common ' +
    'grocery name (the kind that would appear on a shopping list), how many packages/units ' +
    'of it are visible, where it is normally stored, and your confidence. ' +
    'Group identical items into one entry with the total count. ' +
    'Skip non-food objects (containers, appliances, decorations) and anything too unclear to name. ' +
    'If the photo does not show food storage at all, return an empty items list.';
}

export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/scan' || request.method !== 'POST') {
      return json({ error: 'POST /scan with { image, media_type, storage }' }, 404, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Worker is missing the ANTHROPIC_API_KEY secret — see setup at the top of proxy/vision-worker.js.' }, 500, cors);
    }

    let body;
    try { body = await request.json(); } catch (e) {
      return json({ error: 'Body must be JSON.' }, 400, cors);
    }
    const image = typeof body.image === 'string' ? body.image : '';
    const mediaType = body.media_type === 'image/png' ? 'image/png' : 'image/jpeg';
    const storage = ['pantry', 'fridge', 'freezer'].includes(body.storage) ? body.storage : 'pantry';
    if (!image) return json({ error: 'Missing image (base64 string).' }, 400, cors);
    if (image.length > MAX_IMAGE_B64) return json({ error: 'Image too large — retake or let the app downscale it.' }, 413, cors);

    // Optional 7-day retention (KV auto-deletes at TTL). Off unless bound.
    let imageId = null;
    if (env.VISION_IMAGES) {
      imageId = crypto.randomUUID();
      ctx.waitUntil(env.VISION_IMAGES.put(imageId, image, {
        expirationTtl: IMAGE_TTL_SECONDS,
        metadata: { media_type: mediaType, storage, uploaded_at: new Date().toISOString() }
      }));
    }

    let res;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8000,
          output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: prompt(storage) }
            ]
          }]
        })
      });
    } catch (e) {
      return json({ error: 'Could not reach the vision model — try again.' }, 502, cors);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // don't leak the raw upstream body to the browser; log it instead
      console.error('anthropic error', res.status, detail.slice(0, 500));
      return json({ error: 'Vision model error (' + res.status + ') — try again in a moment.' }, 502, cors);
    }

    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      return json({ error: 'The vision model declined to analyze that photo.' }, 422, cors);
    }
    const text = (data.content || []).find((b) => b.type === 'text');
    if (!text || !text.text) {
      return json({ error: 'The vision model returned no result — try a clearer photo.' }, 502, cors);
    }
    let parsed;
    try { parsed = JSON.parse(text.text); } catch (e) {
      return json({ error: 'Could not parse the vision result — try again.' }, 502, cors);
    }

    return json({ items: parsed.items || [], imageId, retentionDays: 7 }, 200, cors);
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
}
