/* ShelfLife — receipt.js
   Receipt -> pantry, entirely in the browser.
   - OCR runs locally via Tesseract.js (loaded from CDN only when needed;
     the photo never leaves the device).
   - Parsed lines are fuzzy-matched to the food catalog and ALWAYS reviewed
     by the user before anything is added — OCR on crumpled thermal paper
     is guesswork, and the review step is where it becomes data.
   - A paste-the-text fallback covers offline use or failed CDN loads. */
(function (g) {
  'use strict';
  const U = g.SL.util;
  const FOODS = g.SL.foods;

  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  let loading = null;
  function ensureTesseract() {
    if (g.Tesseract) return Promise.resolve(g.Tesseract);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_SRC;
      s.onload = () => resolve(g.Tesseract);
      s.onerror = () => { loading = null; reject(new Error('Could not load the OCR engine. Check your connection, or paste the receipt text instead.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  async function scanImage(file, onProgress) {
    const T = await ensureTesseract();
    const result = await T.recognize(file, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100));
      }
    });
    return result.data.text || '';
  }

  /* ---------- parsing ---------- */
  const NOISE = /\b(subtotal|total|tax|change|cash|credit|debit|visa|mastercard|amex|balance|tend|payment|approved|auth|ref|invoice|store|thank|welcome|save|saved|coupon|rewards|member|card|item count|items sold|net sales)\b/i;
  const PRICE_RE = /(\d{1,3}[.,]\d{2})\s*[a-z]?\s*$/i;
  const QTY_AT_RE = /^(\d{1,2})\s*(?:@|x)\s/i;
  const CODE_RE = /\b\d{6,}\b/g;

  function parseLine(raw) {
    let line = raw.trim();
    if (!line || line.length < 3) return null;
    if (NOISE.test(line)) return null;

    let price = null;
    const pm = line.match(PRICE_RE);
    if (pm) {
      price = parseFloat(pm[1].replace(',', '.'));
      line = line.slice(0, pm.index).trim();
    }

    let qty = 1;
    const qm = line.match(QTY_AT_RE);
    if (qm) { qty = parseInt(qm[1], 10) || 1; line = line.replace(QTY_AT_RE, '').trim(); }

    line = line.replace(CODE_RE, ' ').replace(/\s{2,}/g, ' ').trim();
    if (line.replace(/[^a-z]/gi, '').length < 3) return null;

    // best catalog match (shared matcher — same one the shelf-photo flow uses)
    const m = FOODS.match(line);

    return {
      raw: raw.trim(),
      text: line,
      price,
      qty,
      match: m.id,
      score: Math.round(m.score * 100) / 100
    };
  }

  function parseReceipt(text) {
    const lines = String(text || '').split(/\r?\n/);
    const parsed = [];
    lines.forEach((l) => {
      const p = parseLine(l);
      if (p) parsed.push(p);
    });
    // de-duplicate identical consecutive OCR ghosts
    return parsed.filter((p, i) => i === 0 || p.raw !== parsed[i - 1].raw);
  }

  /* The receipt's printed date (usually the header/footer) — becomes the
     purchase date so expiry estimates count from the actual shopping day. */
  function receiptDate(text) {
    return g.SL.expiry ? g.SL.expiry.parseDate(text, 'receipt') : null;
  }

  g.SL = g.SL || {};
  g.SL.receipt = { ensureTesseract, scanImage, parseReceipt, receiptDate };
})(typeof window !== 'undefined' ? window : globalThis);
