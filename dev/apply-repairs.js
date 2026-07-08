/* dev/apply-repairs.js — merge dev/repairs-*.json (arrays of repaired recipe
   docs) into dev/seed-generated.json by id, then report. Run the seed
   pipeline afterwards to re-validate everything. */
'use strict';
const fs = require('fs');
const path = require('path');

const genPath = path.join(__dirname, 'seed-generated.json');
const all = JSON.parse(fs.readFileSync(genPath, 'utf8'));
const byId = {};
all.forEach((r, i) => { byId[r.id] = i; });

let applied = 0, unknown = [];
fs.readdirSync(__dirname)
  .filter((f) => /^repairs-\d+\.json$/.test(f))
  .forEach((f) => {
    const repairs = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
    repairs.forEach((r) => {
      if (r.id in byId) { all[byId[r.id]] = r; applied++; }
      else unknown.push(r.id + ' (' + f + ')');
    });
  });

fs.writeFileSync(genPath, JSON.stringify(all, null, 1));
console.log('applied ' + applied + ' repairs into seed-generated.json');
if (unknown.length) console.log('UNKNOWN ids (not applied):\n  ' + unknown.join('\n  '));
