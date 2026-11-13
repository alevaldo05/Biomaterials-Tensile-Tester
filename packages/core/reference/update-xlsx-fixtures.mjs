/* Saves the .xlsx files made by the website's excel-export.js as fixtures/xlsx-reference.json (base64).
   Run it only when excel-export.js is changed on purpose; the TypeScript port is held to these bytes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildXlsxReference } from './xlsx-reference.mjs';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'xlsx-reference.json');
fs.writeFileSync(file, JSON.stringify(buildXlsxReference(), null, 1) + '\n');
console.log('Saved ' + file);
