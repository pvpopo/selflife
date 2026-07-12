# dev/ — managing the data

Everything in the app hangs off one idea: **a single canonical food id** (defined once in
`js/data/foods.js` or `js/data/foods-extra.js`) connects recipes, inventory, shelf life,
spoilage guidance, store catalogs, receipt matching and shelf-photo matching. This folder
holds the tooling that keeps that data correct as it grows.

Run everything with plain `node` — no npm install.

## The two food files

| File | What it is | How to change it |
|---|---|---|
| `js/data/foods.js` | Hand-curated core (~130 foods) | Edit by hand |
| `js/data/foods-extra.js` | Generated extensions (~330 foods) | **Never edit by hand** — regenerate via `ingest-foods.js` |

### Adding foods (batch pipeline)

1. Author entries as JSON arrays in `dev/foods-batch-*.json` (see `foods-batch-1.json` for the shape —
   same fields as `foods.js`: id, name, aliases, cat, unit, gpu, pkg, price, nutr per 100 g,
   shelf triple, storage, spoil prose, subs).
2. `node dev/ingest-foods.js` — validates every entry (category/unit enums, USDA-shaped nutrition,
   feasible shelf triple, spoilage prose length, id uniqueness; unknown `subs` are dropped) and
   rewrites `js/data/foods-extra.js`. Rejections are printed loudly.
3. `node dev/usda-nutrition.js --food <id>` — audits nutrition against USDA FoodData Central
   (free API key at fdc.nal.usda.gov) before you trust the numbers.
4. `node dev/validate.js` — full integrity + end-to-end suite; run after any data change.

Aliases matter twice: they drive **receipt** matching *and* **shelf-photo** matching (both go
through the shared `foods.match()`), so when a scan mis-matches, the fix is usually one more alias.

## Recipe pipeline

1. **Author** recipe docs in `dev/seed-recipes.js` (ingredients reference food ids; nutrition is
   never stored — it's computed live from the catalog).
2. `node dev/seed-recipes.js` — validates every doc (unknown ingredients, missing steps,
   out-of-range calories rejected; prints a diet/cuisine coverage report) and emits
   `dev/seed-recipes.sql` for the Supabase SQL editor (`split-sql.js` chunks it if the editor
   times out). Upsert-safe; re-run anytime.
3. **Quality loop:** `node dev/audit-recipes.js` flags suspicious recipes into
   `audit-flagged.json`; author fixes as `dev/repairs-*.json`; `node dev/apply-repairs.js`
   applies them; re-audit until clean.
4. **Community submissions** land in Supabase as `status: 'pending'` — review in the dashboard
   (Table Editor → recipes) and flip to `approved` to publish.

## Script index

| Script | Purpose |
|---|---|
| `validate.js` | Integrity + end-to-end tests (run after every change) |
| `ingest-foods.js` | `foods-batch-*.json` → `js/data/foods-extra.js` (strict validation) |
| `usda-nutrition.js` | Audit catalog nutrition against USDA FoodData Central |
| `seed-recipes.js` | Validate authored recipes → `seed-recipes.sql` for Supabase |
| `split-sql.js` | Chunk `seed-recipes.sql` into editor-sized parts |
| `audit-recipes.js` / `apply-repairs.js` | Flag & repair suspect recipes in batches |
| `list-ids.js` / `extract-foods.js` | Small helpers: dump ids / extract food tables |
