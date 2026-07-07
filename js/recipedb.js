/* ShelfLife — recipedb.js
   Central recipe repository on Supabase. The 28 built-in recipes remain the
   offline baseline; approved recipes in the `recipes` table load on boot and
   merge over them (same JSON schema, validated by recipes.register — an
   unknown ingredient can never break nutrition math).

   Community: signed-in users can submit recipes (status 'pending'); you
   approve them in the Supabase dashboard (set status = 'approved') and they
   appear for everyone within the cache TTL. Users rate recipes 1–5 stars;
   the aggregate view drives the ★ shown on cards — ratings are earned in
   the app, never invented. SQL schema lives in the README. */
(function (g) {
  'use strict';
  const db = g.SL.db;

  const CACHE_KEY = 'remoteRecipes';
  const STARS_KEY = 'recipeStars';
  const TTL = 6 * 60 * 60 * 1000;

  function client() {
    const auth = g.SL.auth;
    return auth && auth.supabaseClient ? auth.supabaseClient() : Promise.resolve(null);
  }

  /* ---------- load approved recipes + community ratings ---------- */
  async function load(force) {
    const cached = db.gget(CACHE_KEY, null);
    if (cached && cached.docs) {
      g.SL.recipes.register(cached.docs); // instant from cache, refresh below
    }
    if (!force && cached && cached.ts && (Date.now() - cached.ts) < TTL) return 0;
    try {
      const c = await client();
      if (!c) return 0;
      const [recipesRes, starsRes] = await Promise.all([
        c.from('recipes').select('doc').eq('status', 'approved'),
        c.from('recipe_stars').select('recipe_id, n, stars')
      ]);
      let added = 0;
      if (!recipesRes.error && recipesRes.data) {
        const docs = recipesRes.data.map((r) => r.doc).filter(Boolean);
        added = g.SL.recipes.register(docs);
        db.gset(CACHE_KEY, { ts: Date.now(), docs });
      }
      if (!starsRes.error && starsRes.data) {
        const map = {};
        starsRes.data.forEach((r) => { map[r.recipe_id] = { n: r.n, stars: Number(r.stars) }; });
        db.gset(STARS_KEY, { ts: Date.now(), map });
      }
      return added;
    } catch (e) { return 0; /* offline — built-ins + cache carry the day */ }
  }

  /* ---------- ratings ---------- */
  function starsFor(recipeId) {
    const c = db.gget(STARS_KEY, null);
    return (c && c.map && c.map[recipeId]) || null;
  }

  async function rate(recipeId, stars) {
    const auth = g.SL.auth;
    if (!auth || !auth.cloudUserId || !auth.cloudUserId()) {
      throw new Error('Sign in (email or Google) to rate recipes.');
    }
    const c = await client();
    if (!c) throw new Error('Ratings need the cloud connection.');
    const { error } = await c.from('recipe_ratings')
      .upsert({ recipe_id: recipeId, user_id: auth.cloudUserId(), stars });
    if (error) throw new Error(error.message);
    // optimistic local nudge so the UI reflects the vote immediately
    const cache = db.gget(STARS_KEY, { ts: Date.now(), map: {} });
    const cur = cache.map[recipeId] || { n: 0, stars: 0 };
    cache.map[recipeId] = { n: cur.n + 1, stars: Math.round(((cur.stars * cur.n + stars) / (cur.n + 1)) * 10) / 10 };
    db.gset(STARS_KEY, cache);
  }

  /* ---------- community submissions ---------- */
  async function submit(doc) {
    const auth = g.SL.auth;
    if (!auth || !auth.cloudUserId || !auth.cloudUserId()) {
      throw new Error('Sign in (email or Google) to submit a recipe.');
    }
    // validate against the same gate the loader uses — reject early & clearly
    const probe = JSON.parse(JSON.stringify(doc));
    const FOODS = g.SL.foods;
    if (!probe.name || probe.name.length < 3) throw new Error('Give the recipe a name.');
    if (!probe.ing || !probe.ing.length) throw new Error('Add at least one ingredient.');
    if (probe.ing.some((i) => !FOODS.byId(i.f) || !(i.q > 0))) throw new Error('Every ingredient needs a catalog food and a quantity.');
    if (!probe.steps || probe.steps.length < 3) throw new Error('Write at least three steps.');
    if (!probe.meal || !probe.meal.length) throw new Error('Pick at least one meal slot.');
    probe.id = 'community_' + probe.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) + '_' + Math.random().toString(36).slice(2, 6);
    const c = await client();
    if (!c) throw new Error('Submissions need the cloud connection.');
    const { error } = await c.from('recipes').insert({
      id: probe.id, doc: probe, status: 'pending', submitted_by: auth.cloudUserId()
    });
    if (error) throw new Error(error.message);
    return probe.id;
  }

  g.SL = g.SL || {};
  g.SL.recipedb = { load, submit, rate, starsFor };
})(typeof window !== 'undefined' ? window : globalThis);
