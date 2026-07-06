/* ShelfLife — cartlink.js
   One-click real-store carts, no AI required. Walmart supports cart
   deep-links: opening
     https://affil.walmart.com/cart/addToCart?items=<itemId>_<qty>,<itemId>...
   in the user's browser puts those products straight into their walmart.com
   cart (their own session — ShelfLife never touches their account).

   The catch: the link needs Walmart item IDs, and there's no public API to
   search them from a static site. So this module works in two tiers:
     1. Foods mapped in WALMART_IDS get the one-click cart link.
     2. Unmapped foods fall back to a per-item Walmart search link the user
        (or an AI agent) can tap through.
   Fill WALMART_IDS by hand (the digits at the end of any walmart.com product
   URL) or automate it with the Walmart Affiliate API proxy described in the
   README. Pure logic, no DOM — exercised by dev/validate.js. */
(function (g) {
  'use strict';

  /* foodId → Walmart item ID (the number at the end of a product URL,
     e.g. walmart.com/ip/Chicken-Breast/27935840 → '27935840').
     Every entry you add here upgrades that food from "search link"
     to "already in the cart". */
  const WALMART_IDS = {
    // chicken_breast: '27935840',
    // eggs: '145051970',
  };

  const CART_BASE = 'https://affil.walmart.com/cart/addToCart?items=';
  const SEARCH_BASE = 'https://www.walmart.com/search?q=';

  /* Split the items: which get the one-click cart, which need a search tap. */
  function splitItems(items) {
    const mapped = [], unmapped = [];
    items.forEach((it) => {
      if (WALMART_IDS[it.foodId]) mapped.push(it);
      else unmapped.push(it);
    });
    return { mapped, unmapped };
  }

  /* One URL that fills the Walmart cart with every mapped item. */
  function cartUrl(items) {
    const { mapped } = splitItems(items);
    if (!mapped.length) return null;
    return CART_BASE + mapped
      .map((it) => WALMART_IDS[it.foodId] + (it.qty > 1 ? '_' + it.qty : ''))
      .join(',');
  }

  function searchUrl(name) {
    return SEARCH_BASE + encodeURIComponent(name);
  }

  g.SL = g.SL || {};
  g.SL.cartlink = { WALMART_IDS, splitItems, cartUrl, searchUrl };
})(typeof window !== 'undefined' ? window : globalThis);
