'use strict';
/* Copies the built tester app (apps/tester/dist, from "npm run app:build" at the top of the project) into ui/,
   which the installer bundles. Fails if the build is missing. */
const fs = require('node:fs');
const path = require('node:path');

const from = path.resolve(__dirname, '../tester/dist'), to = path.join(__dirname, 'ui');
if (!fs.existsSync(path.join(from, 'index.html'))) { console.error('No built app in ' + from + '. Run "npm run app:build" at the top of the project first.'); process.exit(1); }
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log('Copied the built app into ' + to);
