/* ShelfLife — app.js
   Boot, auth gate, hash routing, tab bar, service worker. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const auth = g.SL.auth;

  const ROUTES = ['plan', 'recipes', 'shop', 'pantry', 'account'];

  function currentRoute() {
    const h = (g.location.hash || '').replace(/^#\/?/, '');
    return ROUTES.includes(h) ? h : 'plan';
  }

  function setTab(route) {
    U.$$('.tab').forEach((t) => {
      const active = t.dataset.route === route;
      t.classList.toggle('active', active);
      t.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function renderRoute() {
    const view = U.$('#view');
    const route = currentRoute();
    setTab(route);
    g.SL.views[route].render(view);
    view.scrollTop = 0;
    g.scrollTo(0, 0);
  }
  g.SL.router = { rerender: renderRoute };

  function showApp() {
    U.$('#auth-root').hidden = true;
    U.$('#app-root').hidden = false;
    renderRoute();
  }

  function showAuth() {
    U.$('#app-root').hidden = true;
    const root = U.$('#auth-root');
    root.hidden = false;
    g.SL.views.account.renderAuth(root, () => {
      showApp();
      g.SL.ui.toast('Welcome to ShelfLife');
    });
  }

  function boot() {
    // tab bar clicks
    U.$$('.tab').forEach((t) => {
      t.addEventListener('click', () => { g.location.hash = '#/' + t.dataset.route; });
    });
    g.addEventListener('hashchange', () => { if (auth.current()) renderRoute(); });

    if (auth.resume()) showApp();
    else showAuth();

    // PWA: relative path so it works on GitHub Pages project sites
    if ('serviceWorker' in navigator && g.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is a bonus, not a requirement */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
