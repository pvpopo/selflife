/* ShelfLife — vision.js
   Shelf photo -> pantry. Photograph the inside of a pantry/fridge/freezer
   and a vision model (via proxy/vision-worker.js) identifies the food.

   PRIVACY: unlike receipt OCR (which runs on-device), the shelf photo is
   sent to the vision worker and on to the Claude API; the worker keeps it
   at most 7 days, then it is auto-deleted. The UI states this before every
   scan, and the whole feature stays off unless config.visionProxy is set.

   The model returns generic item names ("whole milk", "canned black beans");
   matching to the catalog happens HERE, on-device, with the same fuzzy
   matcher receipts use (foods.match) — and every match is user-reviewed
   before anything lands in the pantry. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;

  const RETENTION_NOTE =
    'Unlike receipt scanning, this photo leaves your device: it’s sent to your vision service ' +
    'to identify the food, kept at most 7 days for troubleshooting, then deleted automatically. ' +
    'Only the item list comes back — you review it before anything is saved.';

  const MAX_EDGE = 1568;      // downscale before upload: faster, cheaper, plenty for identification
  const JPEG_QUALITY = 0.85;

  function configured() {
    return !!(g.SL.config && g.SL.config.visionProxy);
  }

  /* Downscale + re-encode the photo on-device so a 12 MP phone photo
     becomes a ~300 KB JPEG before it goes anywhere. Returns bare base64. */
  async function fileToJpegBase64(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Could not read that image — try another photo.'));
        i.src = objectUrl;
      });
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      return dataUrl.slice(dataUrl.indexOf(',') + 1);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /* Photograph -> [{ name, qty, storage, confidence, match, score }].
     Rows mirror the receipt-review shape so the UI treats both alike. */
  async function scanShelf(file, storage, onProgress) {
    if (!configured()) throw new Error('Shelf scanning is not set up — see proxy/vision-worker.js.');
    if (onProgress) onProgress('Preparing photo…');
    const image = await fileToJpegBase64(file);

    if (onProgress) onProgress('Identifying food… (a few seconds)');
    let res;
    try {
      res = await fetch(g.SL.config.visionProxy.replace(/\/+$/, '') + '/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, media_type: 'image/jpeg', storage })
      });
    } catch (e) {
      throw new Error('Could not reach the vision service — check your connection.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* fall through to status error */ }
    if (!res.ok) {
      throw new Error((data && data.error) || 'The vision service returned an error (' + res.status + ').');
    }

    return (data.items || []).map((item) => toRow(item, storage)).filter(Boolean);
  }

  function toRow(item, sheetStorage) {
    if (!item || !item.name || typeof item.name !== 'string') return null;
    const name = item.name.trim().slice(0, 80);
    if (!name) return null;
    const m = FOODS.match(name);
    const qty = U.clamp(Math.round(Number(item.quantity) || 1), 1, 24);
    return {
      name,
      qty,
      // items live on the shelf that was photographed; per-row override in review
      storage: sheetStorage,
      confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
      match: m.id,
      score: Math.round(m.score * 100) / 100
    };
  }

  g.SL = g.SL || {};
  g.SL.vision = { configured, scanShelf, toRow, RETENTION_NOTE };
})(typeof window !== 'undefined' ? window : globalThis);
