/* Saves the current results of the website's calculation code as fixtures/reference.json.
   Run it (npm run reference:update) only when a calculation on the website is changed on purpose,
   and say so in the commit: the saved numbers are what the TypeScript port is held to. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReference } from './cases.mjs';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'reference.json');
fs.writeFileSync(file, JSON.stringify(buildReference(), null, 1) + '\n');
console.log('Saved ' + file);
