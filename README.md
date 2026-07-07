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
- **Account management.** Local accounts with salted PBKDF2-SHA256 password hashing (WebCrypto, 210k rounds), per-user data isolation, password change, JSON export/import backups, account deletion, and a guest mode. Optionally, **Sign in with Google / Apple** via Supabase — with a private, row-level-secured cloud backup so your data follows you across devices. See "Cloud sign-in" below.
- **Agent hand-off for real stores.** One tap turns your optimized cart into a guard-railed brief an AI browsing agent (e.g. Claude with the Chrome extension) can execute on a real grocer's site — it fills the cart in your own session and stops before checkout. See "Real-store carts with an AI agent" below.
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
  config.js                 optional cloud switches (Supabase URL + anon key)
  db.js                     namespaced localStorage layer + export/import
  auth.js                   PBKDF2 accounts, sessions, guest mode
  auth-cloud.js             optional Google/Apple sign-in + cloud backup (Supabase)
  agent.js                  real-store hand-off briefs for AI browsing agents
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

## Recipe repository (central, community-fed, honestly rated)

The 28 built-in recipes are the offline baseline. The real repository lives in Supabase: approved recipes load at boot (`js/recipedb.js`) and merge over the built-ins — same JSON schema, validated by `recipes.register()` so a bad document can never break nutrition math or shopping lists. Create the tables:

```sql
create table if not exists public.recipes (
  id text primary key,
  doc jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
create policy "read approved" on public.recipes for select using (status = 'approved');
create policy "submit pending" on public.recipes for insert to authenticated
  with check (status = 'pending' and submitted_by = auth.uid());

create table if not exists public.recipe_ratings (
  recipe_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
alter table public.recipe_ratings enable row level security;
create policy "rate" on public.recipe_ratings for insert to authenticated with check (user_id = auth.uid());
create policy "rerate" on public.recipe_ratings for update to authenticated using (user_id = auth.uid());

create or replace view public.recipe_stars as
  select recipe_id, count(*)::int as n, round(avg(stars)::numeric, 1) as stars
  from public.recipe_ratings group by recipe_id;
grant select on public.recipe_stars to anon, authenticated;
```

**Growing the catalog in batches**: author recipe docs in `dev/seed-recipes.js` and run it — every doc is validated (unknown ingredients, missing steps, out-of-range calories rejected loudly, with a diet/cuisine coverage report), then `dev/seed-recipes.sql` is emitted for the Supabase SQL editor. Upsert-safe; re-run anytime.

**Community submissions**: signed-in users submit recipes from the Recipes tab (ingredients restricted to the catalog picker, so every submission automatically works with nutrition, shopping and expiry). Submissions land as `status: 'pending'`; review them in the Supabase dashboard (Table Editor → recipes) and flip to `approved` to publish, `rejected` to decline.

**Ratings are earned, not imported**: users rate 1–5★ in the recipe sheet; the aggregate (average + count) shows on recipe cards. Seed recipes are original, modeled on canonical widely-loved dishes — the app never displays a star it didn't collect itself.

**Nutrition correctness at scale**: recipes carry no nutrition data — every number is computed from the food catalog, so accuracy lives in one place. `dev/usda-nutrition.js` audits the catalog against **USDA FoodData Central** (the U.S. government's lab-analyzed, public-domain nutrient database): it flags any food whose per-100g values drift beyond tolerance from the USDA record, with the FDC id for traceability. Run it when adding foods (`node dev/usda-nutrition.js --food <id>`, free API key at fdc.nal.usda.gov). Growing recipes to the hundreds means growing foods too — add the food with USDA-verified numbers first, and every recipe referencing it is automatically correct.

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

## Real-store carts

The Shop tab's **"Shop it for real"** card takes the optimized cart (or the raw list) to an actual store. Two paths, no AI required for the first:

**One-tap Walmart carts (`js/cartlink.js`).** Walmart supports cart deep-links: `https://affil.walmart.com/cart/addToCart?items=<itemId>_<qty>,...` adds those products to the visitor's own walmart.com cart in one tap — they review the cart on walmart.com and check out with their payment there. ShelfLife never touches the user's Walmart account or payment.

The link needs Walmart item IDs, and the module resolves them in three tiers (best available wins):

1. **Automatic (recommended).** Deploy `proxy/walmart-worker.js` to Cloudflare Workers (free) with your Walmart Affiliate API credentials — the setup walkthrough is at the top of that file: walmart.io signup, three `openssl` commands, `wrangler deploy`, paste the worker URL into `js/config.js → walmartProxy`. From then on the Walmart sheet matches every cart item to a real Walmart product at runtime ("Matching your items…" → "Add all N items to Walmart cart"), caching matches on-device and at the edge for a day.
2. **Hand-mapped.** Add entries to `WALMART_IDS` in `js/cartlink.js` — the id is the digits at the end of any walmart.com product URL (`walmart.com/ip/Chicken-Breast/27935840` → `'27935840'`). Useful for pinning exact products you prefer over the API's top match.
3. **Search fallback.** Anything unresolved appears as a per-item Walmart search link.

**AI agent hand-off (`js/agent.js`).** Alternatively, the same card produces a guard-railed markdown brief for an AI browsing agent (e.g. Claude with the Chrome extension): store, fulfillment, ZIP, every item with package size and acceptable substitutes, plus hard rules — use the existing session, never touch credentials or payment, stop at cart review. Works for Walmart, Kroger, Target, Safeway, H-E-B, Instacart, and Amazon Fresh.

**Kroger lane (`proxy/kroger-worker.js` + `js/kroger.js`).** Kroger's public API is free, needs no paid membership, and — unlike Walmart's — reports **true per-store stock levels**. Setup (~10 min): register at [developer.kroger.com](https://developer.kroger.com) with the Products API, deploy the worker with your client ID/secret (walkthrough at the top of the file), and paste the worker URL into `js/config.js → krogerProxy`. Your nearest Kroger-family store (Kroger, Ralphs, Fred Meyer, King Soopers…) then joins the comparison with live location-level availability and prices.

## Smarter expiration dates

Three layers, most authoritative wins:

1. **Catalog baseline** — FoodKeeper-style shelf life per storage location (`foods.js`), counted from the purchase date. Receipt scans use the **date printed on the receipt**, so a Tuesday receipt scanned Friday still counts from Tuesday.
2. **Community consensus** — when someone corrects a date (label scan or manual edit), the app shares an anonymous observation: food + storage + how many days it was actually good for. Nothing personal — no user id is readable, no item, no store account. Once 3+ observations exist for a food/storage pair, the community median replaces the catalog guess for everyone ("store-brand milk really lasts 11 days").

   **Data quality — observations are tethered to real purchase dates.** Only items whose purchase date has provenance qualify: receipt-dated items (`source: 'receipt'`, purchase date read off the receipt itself) and in-app purchases (`source: 'purchase'`, bought via the cart flow that day). Manually added stock has an *assumed* date and never feeds the consensus — a week-old jug of milk added today would otherwise report a bogus 4-day shelf life. Implausible spans (beyond 4× the catalog baseline — a typo'd year, a misallocated receipt) are also rejected client-side, and the median aggregation shrugs off any stragglers that slip through. Requires the Supabase project; create the tables with:

```sql
create table if not exists public.shelf_observations (
  id bigint generated always as identity primary key,
  food_id text not null,
  storage text not null default 'fridge',
  days int not null check (days between 0 and 365),
  purchased_on date,
  source text check (source in ('receipt','purchase')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.shelf_observations enable row level security;
create policy "insert own observations" on public.shelf_observations
  for insert to authenticated with check (auth.uid() = user_id);

create or replace view public.shelf_consensus as
  select food_id, storage, count(*)::int as n,
         percentile_cont(0.5) within group (order by days)::int as days
  from public.shelf_observations
  group by food_id, storage;
grant select on public.shelf_consensus to anon, authenticated;
```

3. **The label itself** — every pantry item has *"📸 Scan the date label"*: photograph the best-by print, OCR runs on-device (Tesseract.js, photo never uploaded), the date parser handles `08/15/26`, `2026-08-15`, `BEST BY AUG 15` and friends, and the item switches from estimate to verified date. A manual date picker sits right under it.

## Non-food inventory

Receipt lines that aren't groceries (paper towels, detergent, toothpaste…) aren't dropped — they're auto-classified (cleaning / paper & wraps / personal care / health / pet / baby / kitchen & home / other, `js/nonfood.js`) into a **Household & more** section on the Pantry tab: quantity, category, purchase date, price. No expiry pressure, no meal planning — just an editable record of what the household owns.

## Cloud sign-in (Google & Apple) — optional

The code is already in place (`js/auth-cloud.js`); it lights up when you give it a Supabase project. Until then the Google/Apple buttons explain what's missing and local accounts work as always. Supabase's JS client works from static sites — the anon key is designed to be public, row-level security does the guarding, and the OAuth flow uses PKCE so no tokens ever land in your code or URL history.

**1. Create the project (~2 min).** Free tier at [supabase.com](https://supabase.com). In **Project Settings → API**, copy the *Project URL* and *anon public* key into `js/config.js`.

**2. Create the backup table.** SQL editor → run:

```sql
create table if not exists public.shelflife_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.shelflife_snapshots enable row level security;
create policy "own snapshot" on public.shelflife_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**3. Enable Google.** In Supabase **Authentication → Providers → Google**, follow the linked guide: create an OAuth client in Google Cloud Console (free), authorize Supabase's callback URL, paste the client ID/secret back into Supabase.

**4. Enable Apple.** Same page, **Apple** provider. Honest caveat: Sign in with Apple requires an Apple Developer Program membership ($99/yr) to create the required Services ID and key. If you don't have one, ship with Google only — the Apple button will report the configuration error cleanly.

**5. Allow your site's URL.** In **Authentication → URL Configuration**, set the Site URL to `https://<username>.github.io/<repo>/` (and add `http://localhost:8000` or similar for local dev).

What you get: Google/Apple sign-in from the auth screen, per-user isolated data exactly like local accounts, and a debounced private cloud backup (last-write-wins) that restores automatically when the same account signs in on another device. Password management stays with the provider; ShelfLife never sees credentials.

### Email accounts (confirmation + recovery)

With Supabase connected, the Sign in / Create account form switches from device-only usernames to **email accounts**: sign-up sends a confirmation email (Supabase's Email provider, on by default), unconfirmed sign-ins are rejected with a clear message, and **"Forgot password?"** sends a reset link that returns the user to the app to set a new password. This works for any address — Gmail, Outlook, custom domains — and Gmail users can equally use the one-tap Google button; both routes get the same cloud backup and recovery.

Two production notes:
- **Email sending limits.** Supabase's built-in mailer is for development (a few emails per hour). Before real users: **Authentication → Emails → SMTP Settings** and plug in any SMTP service (Resend, Postmark, SES — free tiers are plenty). The email templates (confirmation, reset) are editable on the same page.
- **Device-only accounts remain** for the privacy-conscious, tucked under "Prefer a device-only account?" on the sign-in screen — no email, PBKDF2-hashed locally, but no recovery and no sync, and the UI says so.

## Disclaimers

**Food safety:** expiration dates in this app are rough estimates in the spirit of USDA/FDA FoodKeeper guidance — not safety guarantees. Storage conditions vary. Always judge food by smell, taste, color and texture, use the per-item spoilage descriptions as a guide, and when in doubt, throw it out.

**Nutrition:** figures are estimates computed from typical ingredient values and are not medical or dietetic advice.

## License

MIT — see `LICENSE`. Recipe text, food data and code are original to this project; shelf-life figures are approximations informed by public FoodKeeper-style guidance.
