/* Combination check: loads the site in a real browser under many combinations of the display choices and looks for bugs.
   Run it with:  node scripts/check-combinations.js            (needs Playwright installed on your computer; see below)
                 node scripts/check-combinations.js --quick     (a small sample, a few minutes)
   Options: --phase=A|B|all   --workers=N   --limit=N (a sample of N combinations of each phase)   --out=file.json
            --pages=help,index (only these pages)   --only=layout=tabs (only combinations with that value; can be repeated as --only=a=b,c=d)
   It starts its own small web server for this folder, changes nothing, and saves nothing except an optional report file.
   It is NOT part of node scripts/check-site.js and is not run by the publish workflow, because it needs Playwright
   (a browser driver) that this project does not install. Install it yourself, for example: npm install playwright

   Phase A: EVERY combination of color theme x layout x style (7 x 5 x 5 = 175), on every page, at 1280 px and 1024 px.
   Phase B: pairwise coverage of all 16 display choices (every pair of values of any two choices appears together at least once).
   For every page load it checks: no console error, failed request, or "Refused to" policy message; no sideways scroll; the title is
   shown and not clipped; the header logo, title, and menu do not overlap; and the contrast of the text actually drawn on the page
   (4.5 to 1, or 3 to 1 for large text). It also runs each page's main feature (a simulated test with STOP and the CSV download on both
   test pages, Load Test with one file and with several, Calibration, Materials, both protocol pages, Settings, the inline tutorials (Watch how) and the Help list of tutorial links,
   the header search, and the text checker). On the test pages it also tabs through the controls and checks a focus ring is drawn.
   Findings are "FAIL" (a bug) or "WARN" (contrast of text; review it). Exit code 1 if any FAIL, or any WARN with --strict. */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path');
var pw;
try { pw = require('playwright'); } catch (e) { console.error('This check needs Playwright (a browser driver). Install it first, for example: npm install playwright'); process.exit(2); }

var ROOT = path.resolve(__dirname, '..');
var args = {}; process.argv.slice(2).forEach(function (a) { var m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) args[m[1]] = m[2] === undefined ? true : m[2]; });
var QUICK = !!args.quick, WORKERS = +args.workers || 6, LIMIT = +args.limit || (QUICK ? 6 : 0), PHASE = args.phase || 'all', STRICT = !!args.strict;

/* ---------- the combinations ---------- */
var OPTS = {
  theme: ['light', 'dark', 'purple', 'pink', 'purple-dark', 'pink-dark', 'mu'],
  layout: ['start', 'sidebar', 'cards', 'tabs', 'reading'],
  style: ['standard', 'lab', 'clinical', 'drafting', 'academic'],
  font: ['serif', 'sans', 'humanist'], textsize: ['100', '125', '150', '200'], spacing: ['standard', 'comfortable', 'compact'],
  motion: ['system', 'reduced', 'standard'], linewidth: ['3', '1.5', '2', '4'], curve: ['line', 'markers'], grid: ['major', 'off', 'minor'],
  stressunit: ['mpa', 'kpa'], strainunit: ['ratio', 'percent'], digits: ['standard', '4', '5'], checklist: ['off', 'on'],
  helpprompts: ['on', 'off'], steps: ['guided', 'all']
};
function product() {
  var out = [];
  OPTS.theme.forEach(function (t) { OPTS.layout.forEach(function (l) { OPTS.style.forEach(function (s) { out.push({ theme: t, layout: l, style: s }); }); }); });
  return out;
}
/* A small greedy "all pairs" generator (seeded, so the list is the same every run). */
function pairwise() {
  var keys = Object.keys(OPTS), seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var uncovered = {}, count = 0;
  for (var i = 0; i < keys.length; i++) for (var j = i + 1; j < keys.length; j++) OPTS[keys[i]].forEach(function (a) { OPTS[keys[j]].forEach(function (b) { uncovered[keys[i] + '=' + a + '|' + keys[j] + '=' + b] = 1; count++; }); });
  var rows = [];
  while (count > 0) {
    var best = null, bestGain = -1;
    for (var t = 0; t < 400; t++) {
      var cand = {}; keys.forEach(function (k) { cand[k] = OPTS[k][Math.floor(rnd() * OPTS[k].length)]; });
      var gain = 0;
      for (var x = 0; x < keys.length; x++) for (var y = x + 1; y < keys.length; y++) if (uncovered[keys[x] + '=' + cand[keys[x]] + '|' + keys[y] + '=' + cand[keys[y]]]) gain++;
      if (gain > bestGain) { bestGain = gain; best = cand; }
    }
    for (var x2 = 0; x2 < keys.length; x2++) for (var y2 = x2 + 1; y2 < keys.length; y2++) {
      var id = keys[x2] + '=' + best[keys[x2]] + '|' + keys[y2] + '=' + best[keys[y2]];
      if (uncovered[id]) { delete uncovered[id]; count--; }
    }
    rows.push(best);
  }
  return rows;
}

/* ---------- a tiny web server for this folder ---------- */
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
function serve(cb) {
  var srv = http.createServer(function (req, res) {
    var p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    var f = path.join(ROOT, p);
    if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  srv.listen(0, '127.0.0.1', function () { cb(srv, srv.address().port); });
}

/* ---------- a sample CSV (made here, so no file is needed) ---------- */
function sampleCsv() {
  var out = ['# Test,Uniaxial tension', '# Source,simulated (not measured)', '# Material,Sample', '# Gauge length L0 (mm),10', '# Width (mm),5', '# Thickness (mm),1.5', '# Crosshead speed (mm/min),6', 'time_s,force_N,displacement_mm,strain,stress_MPa'];
  for (var i = 0; i <= 80; i++) { var e = i * 0.0025, s = 0.4 * e + 18 * e * e * e + 0.02 * Math.sin(i), d = e * 10; out.push([(i * 0.5).toFixed(3), (s * 7.5).toFixed(4), d.toFixed(4), e.toFixed(5), s.toFixed(5)].join(',')); }
  return out.join('\r\n') + '\r\n';
}

/* ---------- checks that run inside the page ---------- */
function inPage() {
  var issues = [], de = document.documentElement;
  if (de.scrollWidth > innerWidth + 1) issues.push({ k: 'overflow', m: 'the page scrolls sideways (' + de.scrollWidth + ' wide in ' + innerWidth + ')' });
  function box(e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; }
  var h1 = document.querySelector('main h1, h1');
  if (h1) { if (!box(h1)) issues.push({ k: 'title', m: 'the page title (h1) is not shown' }); else if (h1.scrollWidth > h1.clientWidth + 1) issues.push({ k: 'title', m: 'the page title is clipped' }); }
  var brand = document.querySelector('.topbar .brand, .sidebar .brand'), nav = document.querySelector('.topbar nav, .sidebar nav');
  if (brand && nav) {
    var a = box(brand), b = box(nav);
    if (!a || !b) issues.push({ k: 'header', m: 'the logo or main menu is not shown' });
    else if (!(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1)) issues.push({ k: 'header', m: 'the logo and the main menu overlap' });
    var links = nav.querySelectorAll('a'); for (var i = 0; i < links.length; i++) if (links[i].scrollWidth > links[i].clientWidth + 2) { issues.push({ k: 'header', m: 'a menu link is clipped: ' + links[i].textContent }); break; }
  }
  /* contrast of the text that is drawn */
  function parse(c) { var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  function over(top, bot) { var a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; }
  function lum(c) { var v = c.slice(0, 3).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function bgOf(el) {
    var layers = [];
    for (var e = el; e; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return null;
      var c = parse(cs.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] === 1) break; }
    }
    var base = [255, 255, 255, 1]; for (var k = layers.length - 1; k >= 0; k--) base = over(layers[k], base); return base;
  }
  function faded(el) { for (var e = el; e; e = e.parentElement) { if (+getComputedStyle(e).opacity < 1) return true; } return false; }
  var seen = {}, warns = [], total = 0, els = document.querySelectorAll('body *');
  for (var n = 0; n < els.length; n++) {
    var el = els[n], tag = el.tagName;
    if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|LINE|RECT|CIRCLE|POLYLINE|G|DEFS|MARKER|TITLE|OPTION)$/i.test(tag) && tag !== 'text') continue;
    var own = ''; for (var ch = el.firstChild; ch; ch = ch.nextSibling) if (ch.nodeType === 3) own += ch.nodeValue;
    if (!own.trim()) continue;
    if (el.closest('[hidden], .sr-only, dialog:not([open])') || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('fieldset:disabled')) continue;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 2 || r.height < 2 || faded(el)) continue;
    if (el.closest('.sb:disabled, button:disabled, .is-hidden')) continue;
    var fg = parse(tag === 'text' || el.namespaceURI === 'http://www.w3.org/2000/svg' ? cs.fill : cs.color), bg = bgOf(el.namespaceURI === 'http://www.w3.org/2000/svg' ? (el.closest('svg').parentElement || el) : el);
    if (!fg || !bg) continue;
    total++;
    var f = fg[3] < 1 ? over(fg, bg) : fg, size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold), need = large ? 3 : 4.5, rr = ratio(f, bg);
    if (rr < need - 0.01) {
      var id = (el.className && el.className.baseVal === undefined ? '.' + String(el.className).split(' ')[0] : tag.toLowerCase()) + '|' + cs.color + '|' + cs.backgroundColor;
      if (!seen[id]) { seen[id] = 1; warns.push({ k: 'contrast', m: rr.toFixed(1) + ':1 (needs ' + need + ') ' + tag.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && el.className.baseVal === undefined ? '.' + String(el.className).trim().split(/\s+/)[0] : '') + ' "' + own.trim().slice(0, 28) + '"' }); }
    }
  }
  return { issues: issues, warns: warns.slice(0, 6), texts: total };
}

/* ---------- the work for one page ---------- */
var PAGES = ['index', 'learn', 'about', 'help', 'choose-test', 'test-uniaxial-tension', 'test-stress-relaxation', 'practice', 'practice-relaxation', 'load-test', 'calibration', 'materials', 'protocol-uniaxial-tension', 'protocol-stress-relaxation', 'settings', 'check-text'];
async function visible(page, sel) { var e = await page.$(sel); return e ? page.isVisible(sel) : false; }

async function runTest(page, issues) {
  var guided = await page.evaluate(function () { return document.documentElement.getAttribute('data-steps') !== 'all'; });
  /* inline tutorial at the top of the page: opens, fits, hides */
  await page.click('#tut-run-simulated .tut-toggle', { timeout: 4000 }).catch(function () { issues.push({ k: 'tutorial', m: 'the Watch how button at the top of the test page could not be clicked' }); });
  if (await visible(page, '#tut-panel-run-simulated')) {
    var tp = await page.evaluate(inPage); tp.issues.forEach(function (x) { x.m = '(tutorial open) ' + x.m; issues.push(x); });
    await page.click('#tut-panel-run-simulated .tut-hide');
  } else issues.push({ k: 'tutorial', m: 'the inline tutorial panel did not open on the test page' });
  /* At 1100 px and narrower the Setup sidebar is a drawer: open it to use the setup, close it to use the toolbar. */
  async function side(open) {
    if (!(await visible(page, '#ws-setup-open'))) return;
    var isOpen = await page.evaluate(function () { return document.querySelector('.ws-side').classList.contains('is-open'); });
    if (open && !isOpen) await page.click('#ws-setup-open');
    else if (!open && isOpen) await page.click('#ws-side-toggle');
  }
  await side(true);
  await page.fill('#s-mat', 'Test');   /* Material is required */
  if (guided) {
    await page.click('.is-current [data-next]');
    await page.click('#s-example-dims'); await page.click('.is-current [data-next]');
    await page.click('#s-example-settings'); await page.click('.is-current [data-next]');
    await side(false); await page.click('#c-sim'); await side(true); await page.click('.gs-nav[data-step="4"] [data-next]');
  } else { await page.click('#s-example-dims'); await page.click('#s-example-settings'); await side(false); await page.click('#c-sim'); }
  await side(false);
  await page.click('#r-start');
  if (await visible(page, 'dialog.pretest[open]')) {
    var boxes = await page.$$('dialog.pretest input'); for (var b = 0; b < boxes.length; b++) await boxes[b].check();
    await page.click('#pt-go');
  }
  await page.waitForTimeout(1300);
  if (!(await visible(page, '#stop-dock'))) issues.push({ k: 'stop', m: 'the pinned STOP bar is not shown while recording' });
  if (!(await visible(page, '#r-stop-dock'))) issues.push({ k: 'stop', m: 'the pinned STOP button is not shown while recording' });
  var dock = await page.evaluate(function () { var d = document.querySelector('#stop-dock'); return d ? d.innerText : ''; });
  if (!/Not an emergency stop/i.test(dock)) issues.push({ k: 'stop', m: 'the pinned bar lacks "Not an emergency stop."' });
  if (!(await visible(page, '#r-stop'))) issues.push({ k: 'stop', m: 'the STOP button in the page is not shown while recording' });
  if (!(await visible(page, '#graph-app svg'))) issues.push({ k: 'graph', m: 'the graph is not shown while recording' });
  var r = await page.evaluate(inPage); r.issues.forEach(function (x) { x.m = '(recording) ' + x.m; issues.push(x); });
  await page.click('#r-stop'); await page.waitForTimeout(400);
  var dl = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#dl-csv')]).catch(function () { return null; });
  if (!dl) issues.push({ k: 'download', m: 'the CSV download did not start' });
  else { var f = await dl[0].path(); if (!f || fs.statSync(f).size < 200) issues.push({ k: 'download', m: 'the CSV file is empty or tiny' }); }
  if (!(await visible(page, '#results tr'))) issues.push({ k: 'results', m: 'Key results are not shown after the test' });
}
async function focusRings(page, issues) {
  await page.evaluate(function () { document.body.focus(); window.scrollTo(0, 0); });
  for (var i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    var r = await page.evaluate(function () {
      var e = document.activeElement; if (!e || e === document.body) return null;
      var cs = getComputedStyle(e), rr = e.getBoundingClientRect();
      if (rr.width < 2 || rr.height < 2) return { hidden: true, name: e.id || e.tagName };
      var ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (cs.boxShadow && cs.boxShadow !== 'none');
      return { ring: !!ring, name: (e.id || e.className || e.tagName) + '' };
    });
    if (r && r.hidden) issues.push({ k: 'focus', m: 'keyboard focus landed on an element that is not shown: ' + r.name });
    else if (r && !r.ring) { issues.push({ k: 'focus', m: 'no focus ring drawn on ' + String(r.name).slice(0, 40) }); break; }
  }
}
async function feature(page, name, port, issues) {
  var base = 'http://127.0.0.1:' + port + '/';
  if (name === 'practice' || name === 'practice-relaxation') { await runTest(page, issues); return; }   /* the simulator exists only on the practice page; the real test pages cannot run without a tester */
  if (name === 'load-test') {
    var csv = Buffer.from(sampleCsv());
    await page.setInputFiles('#load-file', { name: 'sample.csv', mimeType: 'text/csv', buffer: csv });
    await page.waitForSelector('#results tr', { timeout: 6000 }).catch(function () { issues.push({ k: 'load', m: 'Load Test did not show key results for a sample file' }); });
    if (!(await visible(page, '#graph-app svg'))) issues.push({ k: 'graph', m: 'Load Test graph is not shown' });
    var r1 = await page.evaluate(inPage); r1.issues.forEach(function (x) { x.m = '(file open) ' + x.m; issues.push(x); });
    await page.click('#tut-load-compare .tut-toggle').catch(function () { issues.push({ k: 'tutorial', m: 'Load Test: the Watch how button could not be clicked' }); });
    if (!(await visible(page, '#tut-panel-load-compare'))) issues.push({ k: 'tutorial', m: 'Load Test: the inline tutorial did not open' }); else { var rt = await page.evaluate(inPage); rt.issues.forEach(function (x) { x.m = '(tutorial open) ' + x.m; issues.push(x); }); }
    await page.goto(base + 'load-test.html'); await page.check('input[name="load-mode"][value="compare"]');
    await page.setInputFiles('#cmp-file', [{ name: 'a.csv', mimeType: 'text/csv', buffer: csv }, { name: 'b.csv', mimeType: 'text/csv', buffer: csv }]);
    await page.waitForSelector('.cmp-table', { timeout: 6000 }).catch(function () { issues.push({ k: 'compare', m: 'Compare did not show its table for two files' }); });
    var r2 = await page.evaluate(inPage); r2.issues.forEach(function (x) { x.m = '(compare) ' + x.m; issues.push(x); });
    return;
  }
  if (name === 'calibration') {
    await page.click('#c-example');
    var t = await page.evaluate(function () { var e = document.querySelector('#cal-results'); return e ? e.innerText : ''; });
    if (!/Gain/.test(t)) issues.push({ k: 'calibration', m: 'Calibration showed no fit after "Fill example values"' });
    var r3 = await page.evaluate(inPage); r3.issues.forEach(function (x) { x.m = '(results) ' + x.m; issues.push(x); });
    await page.click('#tut-calibration .tut-toggle').catch(function () { issues.push({ k: 'tutorial', m: 'Calibration: the Watch how button could not be clicked' }); });
    if (!(await visible(page, '#tut-panel-calibration'))) issues.push({ k: 'tutorial', m: 'Calibration: the inline tutorial did not open' }); else { var rc = await page.evaluate(inPage); rc.issues.forEach(function (x) { x.m = '(tutorial open) ' + x.m; issues.push(x); }); }
    return;
  }
  if (name === 'materials') {
    await page.goto(base + 'materials.html#al-6061/properties'); await page.waitForTimeout(250);
    if (!(await page.$$eval('.mt tbody tr', function (e) { return e.length; }).catch(function () { return 0; }))) issues.push({ k: 'materials', m: 'no property table rows' });
    await page.goto(base + 'materials.html#al-6061/chart'); await page.waitForTimeout(250);
    if (!(await visible(page, '#mat-chart svg'))) issues.push({ k: 'materials', m: 'the chart is not shown' });
    var r4 = await page.evaluate(inPage); r4.issues.forEach(function (x) { x.m = '(chart) ' + x.m; issues.push(x); });
    return;
  }
  if (/^protocol-/.test(name)) {
    var tabs = await page.$$('[role="tab"]');
    for (var i = 0; i < tabs.length; i++) { await tabs[i].click(); await page.waitForTimeout(80); var rr = await page.evaluate(inPage); rr.issues.forEach(function (x) { x.m = '(tab ' + (i + 1) + ') ' + x.m; issues.push(x); }); }
    if (tabs.length < 4) issues.push({ k: 'protocol', m: 'fewer than 4 protocol tabs (' + tabs.length + ')' });
    return;
  }
  if (name === 'help') {
    if (!(await visible(page, '#tutorials-list a'))) {   /* the Tabs layout shows one section at a time */
      var tab = await page.$('[role="tab"]:has-text("Tutorials")'); if (tab) await tab.click();
    }
    var hrefs = await page.$$eval('#tutorials-list a', function (e) { return e.map(function (a) { return a.getAttribute('href'); }); });
    if (hrefs.length !== 7 || hrefs.some(function (h) { return !/#tut-/.test(h); })) issues.push({ k: 'tutorial', m: 'the Help Tutorials list should hold 7 links to page#tut-ID (found ' + hrefs.length + ')' });
    await page.click('#tutorials-list a:has-text("Enter a calibration")', { timeout: 5000 }).catch(function () { issues.push({ k: 'tutorial', m: 'the Tutorials list link could not be clicked' }); });
    await page.waitForSelector('#tut-panel-calibration:not([hidden])', { timeout: 4000 }).catch(function () { issues.push({ k: 'tutorial', m: 'a Help Tutorials link did not open its tutorial on the page' }); });
    return;
  }
  if (name === 'index') {
    await page.click('.ss-btn'); await page.keyboard.type('help'); await page.waitForTimeout(200);
    var n = await page.$$eval('.ss-list li, .ss-list [role="option"]', function (e) { return e.length; }).catch(function () { return 0; });
    if (!n) issues.push({ k: 'search', m: 'the header search showed no result for "help"' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    return;
  }
  if (name === 'settings') {
    var radios = await page.$$eval('input[name="theme"]', function (e) { return e.length; });
    if (radios !== 7) issues.push({ k: 'settings', m: 'expected 7 color theme choices, found ' + radios });
    return;
  }
  if (name === 'check-text') {
    var txt = await page.evaluate(function () { var e = document.querySelector('#check-report'); return e ? e.innerText : ''; });
    if (!/All text files look good/.test(txt)) issues.push({ k: 'text', m: 'the text checker reports a problem' });
  }
}

async function task(browser, port, combo, name, width, withFeature, withFocus) {
  var ctx = await browser.newContext({ viewport: { width: width, height: 900 }, acceptDownloads: true }), page = await ctx.newPage(), issues = [], warns = [];
  page.on('console', function (m) { if (m.type() === 'error' || /Refused/.test(m.text())) issues.push({ k: 'console', m: m.text().slice(0, 140) }); });
  page.on('pageerror', function (e) { issues.push({ k: 'script', m: String(e).slice(0, 140) }); });
  page.on('requestfailed', function (r) { issues.push({ k: 'request', m: 'failed: ' + r.url() }); });
  page.on('response', function (r) { if (r.status() >= 400) issues.push({ k: 'request', m: r.status() + ' ' + r.url() }); });
  try {
    await page.addInitScript(function (c) { for (var k in c) localStorage.setItem(k, c[k]); }, combo);
    await page.goto('http://127.0.0.1:' + port + '/' + (name === 'practice-relaxation' ? 'practice.html#relaxation' : name + '.html')); await page.waitForTimeout(120);
    var r = await page.evaluate(inPage); r.issues.forEach(function (x) { issues.push(x); }); warns = r.warns;
    if (withFocus) await focusRings(page, issues);
    if (withFeature) await feature(page, name, port, issues);
  } catch (e) { issues.push({ k: 'script', m: 'the check itself stopped: ' + String(e).split('\n')[0].slice(0, 160) }); }
  await ctx.close();
  return { combo: combo, page: name, width: width, issues: issues, warns: warns };
}

(async function () {
  var phases = []; var A = product(), B = pairwise();
  if (PHASE === 'A' || PHASE === 'all') phases.push(['A', LIMIT ? A.filter(function (_, i) { return i % Math.ceil(A.length / LIMIT) === 0; }) : A]);
  if (PHASE === 'B' || PHASE === 'all') phases.push(['B', LIMIT ? B.slice(0, LIMIT) : B]);
  var only = {}; String(args.only || '').split(',').filter(Boolean).forEach(function (kv) { var m = kv.split('='); only[m[0]] = m[1]; });
  phases.forEach(function (ph) { ph[1] = ph[1].filter(function (c) { return Object.keys(only).every(function (k) { return String(c[k]) === only[k]; }); }); });
  if (args.pages && args.pages !== true) PAGES = PAGES.filter(function (p) { return String(args.pages).split(',').indexOf(p) >= 0; });
  serve(async function (srv, port) {
    var browser = await pw.chromium.launch(), jobs = [], t0 = Date.now();
    phases.forEach(function (ph) {
      ph[1].forEach(function (combo) {
        var full = Object.assign({ motion: 'reduced' }, combo);   /* Phase A leaves the other choices at their defaults; motion reduced keeps pages still */
        PAGES.forEach(function (name) {
          [1280, 1024].forEach(function (w) {
            var feat = w === 1280 || ph[0] === 'B', focus = w === 1280 && /^test-/.test(name);
            jobs.push({ ph: ph[0], combo: ph[0] === 'A' ? full : combo, name: name, w: w, feat: feat, focus: focus });
          });
        });
      });
    });
    console.log('Combination check: ' + jobs.length + ' page runs (' + phases.map(function (p) { return 'phase ' + p[0] + ': ' + p[1].length + ' combinations'; }).join(', ') + '), ' + WORKERS + ' at a time.');
    var results = [], next = 0, done = 0;
    async function worker() {
      while (next < jobs.length) { var j = jobs[next++]; var r = await task(browser, port, j.combo, j.name, j.w, j.feat, j.focus); r.ph = j.ph; results.push(r); done++; if (done % 200 === 0) console.log('  ' + done + ' / ' + jobs.length + ' done (' + Math.round((Date.now() - t0) / 1000) + ' s)'); }
    }
    var ws = []; for (var i = 0; i < WORKERS; i++) ws.push(worker());
    await Promise.all(ws); await browser.close(); srv.close();
    /* ---------- report ---------- */
    var fails = {}, warns = {}, failRuns = 0, warnRuns = 0;
    results.forEach(function (r) {
      var key = JSON.stringify(r.combo);
      if (r.issues.length) failRuns++;
      r.issues.forEach(function (x) { var id = x.k + ' | ' + x.m.replace(/\d+(\.\d+)?/g, '#').slice(0, 90); (fails[id] = fails[id] || { k: x.k, m: x.m, n: 0, ex: [] }).n++; if (fails[id].ex.length < 3) fails[id].ex.push(r.page + '@' + r.width + ' ' + key); });
      if (r.warns.length) warnRuns++;
      r.warns.forEach(function (x) { var id = x.m.replace(/\d+\.\d:1 \(needs [\d.]+\) /, '').slice(0, 80); var theme = r.combo.theme || 'light'; var w = (warns[id + '|' + theme] = warns[id + '|' + theme] || { m: x.m, theme: theme, n: 0, ex: [] }); w.n++; if (w.ex.length < 2) w.ex.push(r.page + '@' + r.width + ' style=' + (r.combo.style || 'standard') + ' layout=' + (r.combo.layout || 'start')); });
    });
    console.log('\nFinished: ' + results.length + ' page runs in ' + Math.round((Date.now() - t0) / 1000) + ' s.');
    var fl = Object.keys(fails).map(function (k) { return fails[k]; }).sort(function (a, b) { return b.n - a.n; });
    console.log(fl.length ? '\nFAIL: ' + fl.length + ' kinds of problem on ' + failRuns + ' page runs:' : '\nFAIL: none. Every page run passed every check.');
    fl.slice(0, 40).forEach(function (f) { console.log('  FAIL [' + f.k + '] x' + f.n + ': ' + f.m + '\n        e.g. ' + f.ex[0]); });
    var wl = Object.keys(warns).map(function (k) { return warns[k]; }).sort(function (a, b) { return b.n - a.n; });
    console.log(wl.length ? '\nWARN (text contrast below the minimum; review): ' + wl.length + ' items on ' + warnRuns + ' page runs:' : '\nWARN: none. All checked text meets the contrast minimum.');
    wl.slice(0, 40).forEach(function (w) { console.log('  WARN x' + w.n + ' theme ' + w.theme + ': ' + w.m + '\n        e.g. ' + w.ex[0]); });
    if (args.out && args.out !== true) fs.writeFileSync(args.out, JSON.stringify({ runs: results.length, fails: fl, warns: wl }, null, 1));
    process.exit(fl.length || (STRICT && wl.length) ? 1 : 0);
  });
})();
