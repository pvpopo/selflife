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
      url: '',      // e.g. 'https://abcdefghijkl.supabase.co'
      anonKey: ''   // the long 'anon' 'public' key from Project Settings → API
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
