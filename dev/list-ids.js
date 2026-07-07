/* dev/list-ids.js — regenerate dev/existing-ids.txt from built-ins,
   hand-authored seed, and prior generated batches. */
'use strict';
const fs = require('fs');
const path = require('path');
const mem = {};
globalThis.localStorage = {
  getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] || null,
  get length() { return Object.keys(mem).length; }
};
['js/util.js', 'js/data/foods.js', 'js/data/recipes.js'].forEach((f) => eval(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
const ids = new Set(globalThis.SL.recipes.list.map((r) => r.id));
[...fs.readFileSync(path.join(__dirname, 'seed-recipes.js'), 'utf8').matchAll(/id: '([a-z0-9_]+)'/g)].forEach((m) => ids.add(m[1]));
const genPath = path.join(__dirname, 'seed-generated.json');
if (fs.existsSync(genPath)) JSON.parse(fs.readFileSync(genPath, 'utf8')).forEach((r) => ids.add(r.id));
fs.writeFileSync(path.join(__dirname, 'existing-ids.txt'), [...ids].join(', '));
console.log('existing ids: ' + ids.size);
