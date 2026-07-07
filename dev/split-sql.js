/* dev/split-sql.js — the Supabase SQL editor rejects very large pastes, so
   split dev/seed-recipes.sql into seed-recipes-part<N>.sql chunks of
   RECIPES_PER_PART statements each. Every part is independently runnable
   and upsert-safe; order doesn't matter. */
'use strict';
const fs = require('fs');
const path = require('path');

const RECIPES_PER_PART = 200;
const src = fs.readFileSync(path.join(__dirname, 'seed-recipes.sql'), 'utf8').split('\n');

// two header comment lines, then statements in pairs (insert + on-conflict)
const header = src.slice(0, 2);
const body = src.slice(2).filter((l) => l.trim().length);
if (body.length % 2 !== 0) { console.error('unexpected SQL shape'); process.exit(1); }

const pairs = [];
for (let i = 0; i < body.length; i += 2) pairs.push(body[i] + '\n' + body[i + 1]);

let part = 0;
for (let i = 0; i < pairs.length; i += RECIPES_PER_PART) {
  part++;
  const chunk = pairs.slice(i, i + RECIPES_PER_PART);
  const file = path.join(__dirname, 'seed-recipes-part' + part + '.sql');
  fs.writeFileSync(file, header.join('\n') + '\n-- Part ' + part + ' (' + chunk.length + ' recipes)\n' + chunk.join('\n') + '\n');
  console.log('part' + part + ': ' + chunk.length + ' recipes, ' + Math.round(fs.statSync(file).size / 1024) + ' KB');
}
