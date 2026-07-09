/* dev/extract-foods.js — pull the foods array out of a workflow task-output
   wrapper and write it as dev/foods-batch-1.json for ingest-foods.js.
   Usage: node dev/extract-foods.js <task-output-file> */
'use strict';
const fs = require('fs');
const path = require('path');
const wrapper = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let payload = wrapper.result !== undefined ? wrapper.result : wrapper;
if (typeof payload === 'string') payload = JSON.parse(payload);
if (!payload || !Array.isArray(payload.foods)) { console.error('no foods array in result'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'foods-batch-1.json'), JSON.stringify(payload.foods, null, 1));
console.log('extracted ' + payload.foods.length + ' food entries');
