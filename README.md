# ShelfLife

**Plan meals. Shop smart. Waste less.**

A mobile-first web app that plans your week around your diet *and* your pantry: it favors recipes that use up food before it turns, builds a shopping list of only what you actually lack, compares nearby stores to consolidate the trip into one or two stops, and files every purchase back into an expiration-tracked inventory — closing the loop for next week's plan.

Built as a zero-build static site: push it to GitHub, turn on Pages, done. No server, no npm install, no framework. It also runs by simply opening `index.html`.

---

## Features

- **Diet-aware weekly planning.** Hard filters for diets (vegetarian, vegan, gluten-free, dairy-free, high-protein, low-carb) and excluded allergens; soft boosts for favorite cuisines. Swap any slot, leave slots empty, regenerate the week.
- **Waste-driven scoring.** The planner scores every recipe by how much soon-to-expire stock it would use. Spinach turning in two days genuinely pulls spinach recipes into your week — this is the core mechanic, not a gimmick.
- **Clear recipes with real nutrition.** Every recipe shows step-by-step instructions plus per-serving calories, protein, carbs, fat, fiber and sodium — computed live from the ingredient database, so the numbers always match the ingredient list. Day totals appear on the plan.
- **Smart shopping list.** Built from the plan, minus what's already fresh in the pantry, converted to real package sizes ("2 lb tray", "15 oz can"). Staples like oil and salt sit in a separate "you probably have these" check section.
- **1–2 store consolidation.** The optimizer prices your whole basket at every nearby store, applies listed substitutions when an item is out of stock (ground turkey ⇄ beef, yogurt ⇄ sour cream, …), factors in weekly deals and delivery fees, and recommends the best single store — or a two-store split only when the second stop genuinely earns its trip.
- **Purchases become inventory.** Marking the cart purchased files everything into the pantry with an estimated use-by date based on storage location (pantry / fridge / freezer), which you confirm per item.
- **Receipt scanning.** Photograph a paper receipt; OCR runs *on your device* (Tesseract.js — the image never leaves the browser). Parsed lines are fuzzy-matched to the catalog ("CHKN BRST" → chicken breast) and you review every match before anything is saved. A paste-the-text fallback works offline.
- **Honest expiration tracking.** Every item shows a countdown shelf-tag. A prominent disclaimer states these are guesstimates, and every item's detail view describes what spoilage *actually looks like* for that food — smell, color, texture — with "trust your senses" actions ("looks fine, extend estimate" / "tossed it").
- **Account management.** Local accounts with salted PBKDF2-SHA256 password hashing (WebCrypto, 210k rounds), per-user data isolation, password change, JSON export/import backups, account deletion, and a guest mode. See the security section below for exactly what this does and doesn't protect.
- **Installable PWA.** Manifest + service worker: add it to your phone's home screen and the app shell works offline.

## What's real and what's simulated

Being straight about this matters more than a longer feature list.

**Fully real:** the planning engine, nutrition math, package math, shopping-list diffing against inventory, the store-comparison optimizer and substitution logic, expiration estimation, receipt OCR and parsing, accounts, backups, and the PWA.

**Simulated:** the stores themselves. `js/data/stores.js` generates a realistic ecosystem of six chains (a supermarket, a discounter, an organic co-op, a big-box, a corner market, and a delivery service with a fee) deterministically seeded by your ZIP code — same ZIP, same stores, same prices, with weekly rotating deals. Why: a static site cannot scrape live grocery prices (browsers block cross-origin requests), and scraping violates most grocers' terms of service anyway. Rather than pretend, the app says so in its UI and exposes a clean three-function adapter so you can wire real data properly — see below.

**Local, not cloud:** accounts and data live in this browser's storage. Real password hashing, real per-user isolation, but no server means no sync across devices and no protection from someone with full access to your unlocked device. The Supabase path below upgrades this properly.

## Quick start

**Run locally** — open `index.html` in a browser. That's it. (Or `npx serve` / `python3 -m http.server` for a local server, which also enables the service worker.)

**Deploy to GitHub Pages**

1. Create a new GitHub repository and push this folder to it (the repo root should contain `index.html`).
2. In the repo: **Settings → Pages → Source: Deploy from a branch**, pick `main` and `/ (root)`, save.
3. Your app is live at `https://<username>.github.io/<repo>/` in about a minute. All paths are relative, so project-page subpaths work out of the box (`.nojekyll` is included).

On your phone, open that URL and use "Add to Home Screen" to install it.

## Using it (the loop)

1. **Account** → sign up (or tap guest) → set diets, allergens, cuisines, servings and ZIP.
2. **Plan** → *Generate this week*. Swap anything. The "Use these up" strip shows expiring stock and the recipes that rescue it.
3. **Shop** → *Build from plan* (pantry stock is already subtracted) → *Compare stores* → pick the recommended plan → *Mark purchased* and confirm where each item is stored.
4. **Pantry** → everything now has an estimated date. Scan receipts from other trips. Tap any item for spoilage signs. Cook meals from the Plan tab and *mark cooked* to deduct ingredients.
5. Next week, regenerate — the plan leans into whatever you still have.

## Architecture

```
index.html                  app shell, script load order
css/styles.css              design system ("shelf tag" identity)
js/
  util.js                   DOM/format/date helpers, seeded PRNG, fuzzy matcher
  db.js                     namespaced localStorage layer + export/import
  auth.js                   PBKDF2 accounts, sessions, guest mode
  data/foods.js             72-item catalog: nutrition /100g, package sizes,
                            prices, shelf life per storage, spoilage signs,
                            receipt aliases, substitutes  ← the linchpin
  data/recipes.js           28 recipes; ingredients reference food ids
  data/stores.js            simulated store ecosystem (swap point for real APIs)
  nutrition.js              per-serving + day totals, computed from foods
  inventory.js              pantry, expiry estimates, FIFO consumption
  planner.js                eligibility filters + waste-driven scoring
  shopping.js               list diffing, package math, 1–2 store optimizer,
                            cart → purchase → inventory
  receipt.js                Tesseract.js loader, OCR, receipt-line parser
  views/                    one file per tab + shared components
  app.js                    router, auth gate, service worker registration
sw.js / manifest.webmanifest / icons/    PWA
dev/validate.js             node harness: data integrity + end-to-end tests
```

Everything hangs off one idea: **a single canonical food id** connects recipes, inventory, shelf life, spoilage guidance, store catalogs and receipt matching. Add a food once in `foods.js` and every subsystem knows it.

Run the test harness any time: `node dev/validate.js` (24 checks: referential integrity, nutrition sanity, deterministic pricing, and a full register → plan → shop → purchase → cook → scan flow).

## Wiring real store data

The whole app consumes stores through three functions in `js/data/stores.js`:

```js
nearbyStores(zip)                    // -> [{id, name, tag, dist, fee, delivery}]
isAvailable(storeId, foodId, zip)    // -> boolean
priceFor(storeId, food, zip, date)   // -> { price, deal|null }
```

Reimplement those against a real source and nothing else changes. The realistic path:

1. **Use an official API, not scraping.** Kroger's public API (developer.kroger.com) offers OAuth'd `locations` (stores by ZIP) and `products` (search, price, availability) endpoints and covers many US banners. Walmart and Spoonacular have product APIs too.
2. **Put a tiny proxy in front of it.** API keys can't live in a static site. A ~40-line serverless function (Cloudflare Workers / Vercel) holds the key, exposes `/stores?zip=` and `/price?locationId=&term=`, and adds CORS headers for your Pages origin.
3. **Map catalog foods to search terms.** Each food's `name` + `aliases` already make decent product-search queries; cache responses in the proxy for a few hours to stay inside rate limits.

Instacart-style delivery pricing has no public API; the honest options are a partner agreement or keeping that lane simulated.

## Real accounts with Supabase (optional upgrade)

For sync across devices: create a free Supabase project, enable email auth, and add one `user_data` table (`user_id uuid references auth.users, key text, value jsonb`) with row-level security `user_id = auth.uid()`. Then replace `js/auth.js` with `supabase.auth.signUp/signInWithPassword` and point `js/db.js`'s `get/set` at that table (the app already funnels all persistence through those two files). Supabase's JS client works from static sites — the anon key is designed to be public, RLS does the guarding.

## Disclaimers

**Food safety:** expiration dates in this app are rough estimates in the spirit of USDA/FDA FoodKeeper guidance — not safety guarantees. Storage conditions vary. Always judge food by smell, taste, color and texture, use the per-item spoilage descriptions as a guide, and when in doubt, throw it out.

**Nutrition:** figures are estimates computed from typical ingredient values and are not medical or dietetic advice.

## License

MIT — see `LICENSE`. Recipe text, food data and code are original to this project; shelf-life figures are approximations informed by public FoodKeeper-style guidance.
