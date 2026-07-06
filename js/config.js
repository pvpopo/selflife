/* ShelfLife — config.js
   Optional cloud services. Everything works without this file being
   filled in — these switches just light up extra capability.

   CLOUD SIGN-IN (Google & Apple) via Supabase:
   1. Create a free project at https://supabase.com (takes ~2 minutes).
   2. Project Settings → API: copy the Project URL and the anon public key
      into `supabase.url` / `supabase.anonKey` below. The anon key is
      designed to be public — row-level security does the real guarding.
   3. Follow "Cloud sign-in (Google & Apple)" in the README to enable the
      Google / Apple providers and create the snapshots table.

   With this left blank, the Google/Apple buttons explain what's missing
   and local (on-device) accounts keep working exactly as before. */
(function (g) {
  'use strict';
  g.SL = g.SL || {};
  g.SL.config = {
    supabase: {
      url: 'https://bcurybrflyzpahyihnok.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjdXJ5YnJmbHl6cGFoeWlobm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzMyMjUsImV4cCI6MjA5ODg0OTIyNX0.sujCwmOI2asqAJR6wvn1WGT9yDhO6F-5kRBI2BPkF1I' // anon key — public by design, RLS guards the data
    },

    /* One-tap Walmart carts: URL of your deployed proxy/walmart-worker.js
       (e.g. 'https://shelflife-walmart.<you>.workers.dev'). It matches
       catalog foods to Walmart products so the whole cart adds in one tap.
       Leave blank and the app falls back to hand-mapped ids + search links.
       Setup: see "Real-store carts" in the README. */
    walmartProxy: ''
  };
})(typeof window !== 'undefined' ? window : globalThis);
