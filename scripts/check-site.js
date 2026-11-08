/* Checks the site before it is published.
   Run it with:  node scripts/check-site.js
   It reads the files and changes nothing. It uses only Node's built-in modules.
   If a check fails, it says which file and what to fix, and exits with an error so the site is not published.
   Guide: docs/DEPLOY.md. */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var crypto = require('crypto');
var os = require('os');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..');
var SKIP_DIRS = { '.git': 1, '_site': 1, 'node_modules': 1 };
var failures = 0;

function begin(name) { console.log('\n' + name); }
function ok(msg) { console.log('  ok    ' + msg); }
function fail(msg) { failures++; console.log('  FAIL  ' + msg); }
function note(msg) { console.log('  note  ' + msg); }

function walk(dir, rel, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (SKIP_DIRS[e.name]) return;
    var r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else if (e.isFile()) out.push(r);
  });
  return out;
}
var FILES = walk(ROOT, '', []).sort();
var PAGES = FILES.filter(function (f) { return /^[^\/]+\.html$/.test(f); });
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return FILES.indexOf(rel) >= 0; }

/* The relative file a link points to, or null for web addresses, anchors, and mail links. */
function localPath(from, ref) {
  ref = ref.split('#')[0].split('?')[0];
  if (!ref || /^[a-z][a-z0-9+.\-]*:/i.test(ref) || ref.indexOf('//') === 0) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
}
function scriptsOf(html) {
  var out = [], re = /<script[^>]*\ssrc\s*=\s*"([^"]+)"/gi, m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/* 1. Every file a page links to exists. */
begin('1. Page links');
(function () {
  var before = failures, count = 0;
  PAGES.forEach(function (page) {
    var re = /\b(?:src|href)\s*=\s*"([^"]*)"/gi, m, html = read(page);
    while ((m = re.exec(html))) {
      var target = localPath(page, m[1]);
      if (target === null) continue;
      count++;
      if (!exists(target)) fail(page + ' links to "' + m[1] + '", but that file is not in the project. Check the name and the folder.');
    }
  });
  if (failures === before) ok(count + ' links in ' + PAGES.length + ' pages all point to files that exist');
})();

/* 2. Every script file is valid JavaScript (it is compiled, not run). */
begin('2. Script syntax');
(function () {
  var before = failures, js = FILES.filter(function (f) { return /\.js$/.test(f); });
  js.forEach(function (f) {
    try { new vm.Script(read(f), { filename: f }); }
    catch (e) { fail(f + ' has a mistake: ' + e.message + '. Look for a missing quote, comma, or bracket near that line.'); }
  });
  if (failures === before) ok(js.length + ' script files have no syntax mistakes');
})();

/* 3. The data files load in the order each page lists them, and contain what the pages need. */
begin('3. Data files');
(function () {
  var before = failures, seen = {};
  function isStr(v) { return typeof v === 'string' && v.trim() !== ''; }
  function isArr(v) { return Array.isArray(v) && v.length > 0; }
  var RULES = {
    'data/materials.js': function (g) {
      if (!isArr(g.MATERIALS)) return 'MATERIALS should be a non-empty list';
      var ids = {}, fams = {};
      if (!isArr(g.MATERIAL_FAMILIES)) return 'MATERIAL_FAMILIES should be a non-empty list';
      g.MATERIAL_FAMILIES.forEach(function (f) { fams[f.id] = 1; });
      for (var i = 0; i < g.MATERIALS.length; i++) {
        var m = g.MATERIALS[i];
        if (!m || !isStr(m.id) || !isStr(m.name)) return 'material number ' + (i + 1) + ' needs an id and a name';
        if (ids[m.id]) return 'two materials share the id "' + m.id + '"';
        if (!fams[m.family]) return 'material "' + m.id + '" has an unknown family "' + m.family + '"';
        ids[m.id] = 1;
        if (!g.MATERIAL_BY_ID || g.MATERIAL_BY_ID[m.id] !== m) return 'MATERIAL_BY_ID is missing "' + m.id + '"';
      }
      return '';
    },
    'data/samples.js': sampleRule,
    'data/sample-models.js': function (g) {
      var problem = sampleRule(g);
      if (problem) return problem;
      if (!isArr(g.MATERIALS)) return 'data/materials.js must be listed before data/sample-models.js on the page';
      var curves = g.SAMPLE_DATA.filter(function (r) { return r.test === 'uniaxial'; }).length;
      if (curves < g.MATERIALS.length) return 'only ' + curves + ' example curves for ' + g.MATERIALS.length + ' materials; data/materials.js must be listed before data/sample-models.js on the page';
      return '';
    },
    'data/device.js': function (g) {
      var d = g.DEVICE;
      if (!d || !(d.baudRate > 0)) return 'DEVICE.baudRate should be a number above 0';
      if (!d.columns || typeof d.columns.time !== 'number' || typeof d.columns.force !== 'number' || typeof d.columns.displacement !== 'number') return 'DEVICE.columns needs time, force, and displacement positions';
      if (!d.messages || !isStr(d.messages.done)) return 'DEVICE.messages.done should be text';
      return '';
    },
    'data/checklist.js': function (g) { return g.PRETEST_CHECKLIST && isArr(g.PRETEST_CHECKLIST.groups) ? '' : 'PRETEST_CHECKLIST.groups should be a non-empty list'; },
    'data/protocols.js': function (g) {
      var P = g.PROTOCOLS, tests = ['uniaxial', 'relaxation'], mats = ['general', 'skin', 'steel', 'concrete'];
      if (!P) return 'PROTOCOLS is missing';
      for (var a = 0; a < tests.length; a++) for (var b = 0; b < mats.length; b++) {
        var p = P[tests[a]] && P[tests[a]][mats[b]];
        if (!p || !isStr(p.summary)) return 'PROTOCOLS.' + tests[a] + '.' + mats[b] + ' needs a summary';
      }
      return '';
    },
    'data/references.js': function (g) {
      var R = g.REFERENCES, nums = [];
      if (!R || !isArr(R.groups)) return 'REFERENCES.groups should be a non-empty list';
      for (var i = 0; i < R.groups.length; i++) {
        var items = R.groups[i].items;
        if (!isArr(items)) return 'reference group number ' + (i + 1) + ' has no items';
        for (var j = 0; j < items.length; j++) {
          if (typeof items[j].n !== 'number' || !isStr(items[j].text)) return 'a reference in group ' + (i + 1) + ' needs n: (a number) and text: "..."';
          nums.push(items[j].n);
        }
      }
      nums.sort(function (x, y) { return x - y; });
      for (var k = 0; k < nums.length; k++) if (nums[k] !== k + 1) return 'reference numbers should run 1, 2, 3 ... with none missing or repeated (problem near ' + nums[k] + ')';
      return '';
    },
    'data/articles.js': function (g) { return Array.isArray(g.ARTICLES) ? '' : 'ARTICLES should be a list (it may be empty)'; }
  };
  ['home', 'learn', 'about', 'help'].forEach(function (k) {
    RULES['data/text/' + k + '.js'] = function (g) {
      var t = g.SITE_TEXT && g.SITE_TEXT[k];
      return t && typeof t === 'object' && Object.keys(t).length ? '' : 'SITE_TEXT.' + k + ' is missing or empty';
    };
  });
  function sampleRule(g) {
    if (!isArr(g.SAMPLE_DATA)) return 'SAMPLE_DATA should be a non-empty list';
    for (var i = 0; i < g.SAMPLE_DATA.length; i++) {
      var r = g.SAMPLE_DATA[i];
      if (!r || !isStr(r.id) || !isStr(r.test) || !isStr(r.material)) return 'sample curve number ' + (i + 1) + ' needs id, test, and material';
      if (!Array.isArray(r.x) || !Array.isArray(r.y) || r.x.length < 2 || r.x.length !== r.y.length) return 'sample curve "' + r.id + '" needs x and y lists of the same length (at least 2)';
    }
    return '';
  }

  PAGES.forEach(function (page) {
    var list = scriptsOf(read(page)).map(function (s) { return localPath(page, s); }).filter(function (p) { return p && /^data\//.test(p) && exists(p); });
    if (!list.length) return;
    var sandbox = {}; sandbox.window = sandbox; sandbox.self = sandbox;
    vm.createContext(sandbox);
    var broke = false;
    list.forEach(function (f) {
      if (broke) return;
      try { vm.runInContext(read(f), sandbox, { filename: f }); }
      catch (e) { broke = true; fail(page + ': ' + f + ' stops with an error when loaded in the order this page lists it: ' + e.message + '. Check that the right file is in the data folder and that the page lists the data files in the right order.'); }
    });
    if (broke) return;
    list.forEach(function (f) {
      if (seen[f]) return;
      seen[f] = true;
      if (!RULES[f]) return;
      var problem = RULES[f](sandbox);
      if (problem) fail(f + ': ' + problem + '.');
    });
  });
  if (failures === before) ok(Object.keys(seen).length + ' data files load in page order and have the expected contents');
})();

/* 4. No two files have the same content (catches a file copied or uploaded into the wrong place). */
begin('4. Duplicate files');
(function () {
  var before = failures, byHash = {};
  FILES.forEach(function (f) {
    var buf = fs.readFileSync(path.join(ROOT, f));
    if (!buf.length) return;
    var h = crypto.createHash('sha256').update(buf).digest('hex');
    (byHash[h] = byHash[h] || []).push(f);
  });
  Object.keys(byHash).forEach(function (h) {
    if (byHash[h].length > 1) fail('These files have exactly the same content: ' + byHash[h].join(', ') + '. One may have been put in the wrong place.');
  });
  if (failures === before) ok('no two files are identical');
})();

/* 5. The publish step (scripts/build-site.sh) produces the right folder. */
begin('5. Build output');
(function () {
  var before = failures;
  var sha = 'abcdef0123456789abcdef0123456789abcdef01', short = sha.slice(0, 7);
  var out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'site-check-')), 'site');
  var r = cp.spawnSync('bash', [path.join(ROOT, 'scripts', 'build-site.sh'), out, sha, 'check'], { cwd: ROOT, encoding: 'utf8' });
  if (r.error) {
    if (process.env.CI) fail('bash is needed to run scripts/build-site.sh but was not found');
    else note('skipped: bash was not found on this computer (the check runs on GitHub)');
    return;
  }
  if (r.status !== 0) { fail('scripts/build-site.sh failed: ' + (r.stderr || r.stdout || '').trim()); return; }
  try {
    var v = JSON.parse(fs.readFileSync(path.join(out, 'version.json'), 'utf8'));
    if (v.commit !== sha || v.short !== short) fail('version.json has the wrong commit or short value');
  } catch (e) { fail('version.json is missing or is not valid JSON'); }
  var asset = /\b(?:src|href)="[^"#?:]+\.(?:css|js)"/g, stamped = new RegExp('\\b(?:src|href)="[^"#?:]+\\.(?:css|js)\\?v=' + short + '"', 'g');
  PAGES.forEach(function (page) {
    var want = (read(page).match(asset) || []).length, p = path.join(out, page);
    if (!fs.existsSync(p)) { fail(page + ' is missing from the build output'); return; }
    var html = fs.readFileSync(p, 'utf8'), have = (html.match(stamped) || []).length, left = (html.match(asset) || []).length;
    if (have !== want || left !== 0) fail(page + ': ' + have + ' of ' + want + ' script and style links got the ?v= stamp');
  });
  var built = walk(out, '', []), leftOut = /^(\.github|scripts|docs)\/|\.md$|^\.gitignore$/;
  built.forEach(function (f) { if (leftOut.test(f)) fail('the build output should not contain ' + f); });
  FILES.forEach(function (f) { if (!leftOut.test(f) && built.indexOf(f) < 0) fail(f + ' is missing from the build output'); });
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  if (failures === before) ok('the build stamps every link, writes version.json, and leaves out documents and scripts');
})();

/* 6. No email address (other than a GitHub no-reply one) and no key or token in any file. */
begin('6. Private details');
(function () {
  var before = failures;
  var email = /[A-Za-z0-9._%+\-]+@([A-Za-z0-9\-]+\.)+[A-Za-z]{2,}/g;
  var keys = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_\-]{30,}/, /xox[baprs]-[A-Za-z0-9\-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  function mask(s) { return s.slice(0, 2) + '...'; }
  FILES.forEach(function (f) {
    var buf = fs.readFileSync(path.join(ROOT, f));
    if (buf.length > 2e6 || buf.indexOf(0) >= 0) return;
    read(f).split(/\r?\n/).forEach(function (line, i) {
      var m;
      email.lastIndex = 0;
      while ((m = email.exec(line))) {
        if (!/@users\.noreply\.github\.com$/i.test(m[0])) fail(f + ' line ' + (i + 1) + ' contains an email address (' + mask(m[0]) + '). Remove it before publishing.');
      }
      keys.forEach(function (k) {
        var hit = line.match(k);
        if (hit) fail(f + ' line ' + (i + 1) + ' looks like a key or token (' + mask(hit[0]) + '). Remove it and replace the key.');
      });
    });
  });
  if (failures === before) ok(FILES.length + ' files contain no email address or key');
})();

/* 7. Every Action in the workflows is pinned to a full commit ID, so a moved tag cannot change what runs. */
begin('7. Publishing workflow');
(function () {
  var before = failures, count = 0;
  FILES.filter(function (f) { return /^\.github\/workflows\/[^\/]+\.ya?ml$/.test(f); }).forEach(function (f) {
    read(f).split(/\r?\n/).forEach(function (line, i) {
      var m = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
      if (!m) return;
      count++;
      if (m[1].indexOf('./') === 0) return;
      if (!/^[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-\/]+@[0-9a-f]{40}$/.test(m[1])) {
        fail(f + ' line ' + (i + 1) + ' uses "' + m[1] + '", which is not pinned to a full 40-character commit ID. Look the ID up on GitHub (see docs/DEPLOY.md, "Updating a pinned Action").');
      }
    });
  });
  if (failures === before) ok(count + ' Action references in the workflows are all pinned to a full commit ID');
})();

/* 8. Every page carries the Content Security Policy tag, and no page or script uses inline code that the policy blocks. */
begin('8. Security policy and inline code');
(function () {
  var before = failures;
  PAGES.forEach(function (page) {
    var html = read(page);
    var tags = html.match(/<meta[^>]*http-equiv\s*=\s*"Content-Security-Policy"[^>]*>/gi) || [];
    if (tags.length !== 1) fail(page + ' needs exactly one Content Security Policy <meta> tag in its <head> (it has ' + tags.length + '). Copy the tag from index.html.');
    else {
      var scriptSrc = (tags[0].match(/script-src([^;"]*)/i) || [, ''])[1];
      if (!/'self'/.test(scriptSrc) || /'unsafe-inline'|'unsafe-eval'|\*|https?:/.test(scriptSrc)) fail(page + ': the policy must allow scripts from \'self\' only (no \'unsafe-inline\', \'unsafe-eval\', or other sites).');
      if (!/default-src\s+'none'/.test(tags[0])) fail(page + ': the policy must start from default-src \'none\'.');
      var firstScript = html.search(/<script\b/i);
      if (firstScript >= 0 && html.indexOf(tags[0]) > firstScript) fail(page + ': the policy tag must come before the first <script>, or it does not apply to it.');
    }
    if (!/<meta[^>]*name\s*=\s*"referrer"[^>]*content\s*=\s*"no-referrer"/i.test(html)) fail(page + ' needs <meta name="referrer" content="no-referrer"> in its <head>.');
    if (/<script\b(?![^>]*\ssrc\s*=)[^>]*>/i.test(html)) fail(page + ' has an inline <script> block. The policy blocks it; move the code into a .js file.');
    if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html)) fail(page + ' has an inline event handler such as onclick=. The policy blocks it; attach the handler in a .js file.');
    if (/javascript:/i.test(html)) fail(page + ' has a javascript: link. The policy blocks it.');
  });
  FILES.filter(function (f) { return /\.js$/.test(f) && !/^(scripts|\.github)\//.test(f); }).forEach(function (f) {
    var js = read(f);
    if (/<[a-z][^>'"]*\son[a-z]+\s*=/i.test(js)) fail(f + ' builds HTML with an inline event handler such as onclick=. The policy blocks it; add the handler with addEventListener.');
    if (/javascript:/i.test(js)) fail(f + ' contains a javascript: link. The policy blocks it.');
  });
  if (failures === before) ok(PAGES.length + ' pages have the policy tag and no inline scripts or handlers; page scripts build none either');
})();

console.log('\n' + (failures ? failures + ' problem' + (failures === 1 ? '' : 's') + ' found. Fix them before merging; the site is not published while a check fails.' : 'All checks passed.'));
process.exit(failures ? 1 : 0);
