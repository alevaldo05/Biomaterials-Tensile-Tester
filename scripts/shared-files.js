/* The website files the tester app shares, in one list, and a hash of them.
   Run it with:  node scripts/shared-files.js          (prints the list and the hash, full and short)
                 node scripts/shared-files.js --short  (prints only the short hash)
   The app's Help screen shows the short hash it was built with ("shared website files <hash>"). If it differs from
   what this prints for the current files, the installed app was built before a change to one of them.
   Used by the app's build (apps/tester/build-info.ts, apps/tester/site-data.ts) and by the reference tests of the
   website's calculations (packages/core/reference). A test fails if either reads a website file not listed here.
   Changes nothing. Uses only Node's built-in modules. */
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.resolve(__dirname, '..');

/* Paths from the top of the project, with forward slashes. The order is part of the hash: add new files at the end. */
var SHARED_FILES = [
  /* read when the app is built (apps/tester/site-data.ts): definitions and materials */
  'data/terms.js',
  'data/materials.js',
  /* run by the reference tests (packages/core/reference): the calculations and file formats the app's packages/core matches */
  'data/device.js',
  'data/samples.js',
  'graph-core.js',
  'live-csv.js',
  'calibration.js',
  'compare.js',
  'excel-export.js'
];

/* Line endings are made LF before hashing, so a Windows checkout (CRLF) and a Linux one give the same hash. */
function normalize(text) {
  return String(text).replace(/\r\n/g, '\n');
}

/* Reads one shared file. Refuses a file that is not in the list, so a new one cannot be read without being added. */
function readShared(rel, root) {
  if (SHARED_FILES.indexOf(rel) < 0) {
    throw new Error(rel + ' is not in the list of shared website files in scripts/shared-files.js. Add it there (at the end) so the build stamp covers it.');
  }
  return fs.readFileSync(path.join(root || ROOT, rel), 'utf8');
}

/* SHA-256 over every listed file, in list order. Each file adds:  <path> "\n" <length in bytes> "\n" <content>
   (content with LF line endings, UTF-8). The length keeps the end of one file from running into the next. */
function sharedFilesHash(root) {
  var h = crypto.createHash('sha256');
  SHARED_FILES.forEach(function (rel) {
    var body = Buffer.from(normalize(fs.readFileSync(path.join(root || ROOT, rel), 'utf8')), 'utf8');
    h.update(rel + '\n' + body.length + '\n', 'utf8');
    h.update(body);
  });
  return h.digest('hex');
}

/* The part shown in the app's Help line and the release notes. */
function shortHash(hash) {
  return String(hash).slice(0, 12);
}

module.exports = { ROOT: ROOT, SHARED_FILES: SHARED_FILES, normalize: normalize, readShared: readShared, sharedFilesHash: sharedFilesHash, shortHash: shortHash };

if (require.main === module) {
  var hash = sharedFilesHash();
  if (process.argv.indexOf('--short') >= 0) {
    console.log(shortHash(hash));
  } else {
    console.log('Shared website files (' + SHARED_FILES.length + '):');
    SHARED_FILES.forEach(function (f) { console.log('  ' + f); });
    console.log('SHA-256: ' + hash);
    console.log('Short:   ' + shortHash(hash) + '   (the app\'s Help screen shows "shared website files ' + shortHash(hash) + '")');
  }
}
