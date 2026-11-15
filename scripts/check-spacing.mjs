/* Spacing check (dev only): opens every website page and every tester-app screen at five window widths, in light and dark,
   and looks for crowded or broken layout that a person would see at a glance.
   Run:  node scripts/check-spacing.mjs [output folder] [--site-only] [--app-only] [--widths=1366,390]
                                         [--pages=index.html,learn.html] [--browser=chromium|webkit] [--strict]
   (the app part needs "npm run app:build" first and is skipped, with a message, when apps/tester/dist is missing).

   Checks, per page, width, and theme:
     (a) sideways scroll: the page is wider than the window (scrollWidth > window width + 1).
     (b) overlap: two visible text blocks or controls (a, button, input, select, textarea, label, h1-h6, p, li, td, th, summary,
         [role=button]) whose boxes intersect by more than 2 px in both directions. One inside the other is not counted.
     (c) tight controls: two controls (a, button, input, select, textarea, summary) on the same row or column with a gap
         between their boxes of less than 4 px (and more than -2 px, so a real overlap is left to check b).
     (d) clipped text: an element with overflow hidden or clip that holds text and is smaller than its content. Text cut off
         with an ellipsis on purpose (text-overflow: ellipsis, or a line clamp) is listed separately.
     (e) broken words: a word in a button, label, table cell or heading that the browser split across two lines
         ("Tu / rn of / f"), which happens when a column or button is squeezed narrower than one word.
   Saves a full-page picture per page, width, and theme, and report.json, in the output folder (default: spacing-out/ when
   that folder is in .gitignore, otherwise a folder under the computer's temp folder; the path is printed). With --strict
   the exit code is 1 if there is any issue in checks a to e.

   Dev only. Not run by any workflow yet. Uses Chromium by default (Playwright, a dev tool); --browser=webkit runs the same checks in Playwright's WebKit,
   the engine behind Safari (not Safari itself). PW_CHROMIUM_PATH can point at a Chromium already installed on this computer.
   Pictures are named with the browser when it is not Chromium (for example site-index-390-light-webkit.png). Changes no project file; serves files
   from this computer only. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS, standIn } from './app-screenshots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps/tester/dist');
const SCHEMES = ['light', 'dark'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.csv': 'text/csv' };

/* ---------- options ---------- */
const flags = {};
const positional = [];
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else positional.push(a);
}
const BROWSER = String(flags.browser || 'chromium');
if (!['chromium', 'webkit'].includes(BROWSER)) { console.error('--browser must be chromium or webkit'); process.exit(2); }
const SUFFIX = BROWSER === 'chromium' ? '' : '-' + BROWSER;
const WIDTHS = (flags.widths ? String(flags.widths).split(',').map(Number) : [1366, 1280, 1024, 768, 390]).filter((n) => n > 0);
const heightFor = (w) => (w === 390 ? 844 : 900);

function defaultOut() {
  let ignored = false;
  try { ignored = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).some((l) => /^\/?spacing-out\/?$/.test(l.trim())); } catch (e) { /* no .gitignore */ }
  return ignored ? path.join(ROOT, 'spacing-out') : path.join(os.tmpdir(), 'spacing-out');
}
const OUT = path.resolve(positional[0] || defaultOut());

function serve(dir) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(dir, p === '/' ? 'index.html' : p);
    if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* The Windows-app stand-in (signed in on this computer as an admin, made-up people) is the one the pull-request
   screenshots use, so the two cannot drift apart. */

/* Same mechanism as display-settings.js: the saved choice is read from localStorage key "theme" before the page paints. */
function setSiteTheme(theme) {
  try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
}

/* ---------- the measuring code, run inside the page ---------- */
function measure() {
  const TEXTISH = 'a,button,input,select,textarea,label,h1,h2,h3,h4,h5,h6,p,li,td,th,summary,[role=button]';
  const CTRL = 'a,button,input,select,textarea,summary';
  const R = (n) => Math.round(n * 10) / 10;

  function desc(el) {
    const one = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id) s += '#' + e.id;
      else if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.');
      return s;
    };
    let s = one(el);
    if (el.parentElement && el.parentElement !== document.body) s = one(el.parentElement) + ' > ' + s;
    const t = (el.value && el.tagName === 'INPUT' ? el.value : (el.textContent || el.getAttribute('aria-label') || el.placeholder || '')).replace(/\s+/g, ' ').trim().slice(0, 28);
    return t ? s + ' "' + t + '"' : s;
  }

  /* Is the element drawn at all, and which part of it is shown? Excluded, because nobody sees them or they are not layout:
     display none, visibility hidden, opacity 0 (self or ancestor; covers closed dialogs and custom checkboxes drawn by a sibling),
     boxes of 1 px or less (visually hidden text), boxes wholly off the left or top of the page (skip links parked off screen),
     parts cut away by an ancestor with overflow other than visible (scroll areas, collapsed panels), and anything inside an svg or
     canvas (graph internals are drawn, not laid out). Returns the visible line boxes, plus whether it is fixed to the window. */
  function shown(el) {
    if (el.closest('svg,canvas')) return null;
    /* Content of a closed <details>, a hidden tab, or anything with content-visibility: hidden has a box but is not drawn.
       checkVisibility() knows all of these (display none, visibility, content-visibility, opacity), so it is asked first. */
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility !== 'visible') return null;
    let fixedRoot = null;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (+ps.opacity < 0.01 || ps.display === 'none') return null;
      if (!fixedRoot && ps.position === 'fixed') fixedRoot = p;
    }
    const rects = [];
    for (const r of el.getClientRects()) {
      if (r.width <= 1 || r.height <= 1 || r.right <= 0 || r.bottom <= 0) continue;
      let l = r.left, t = r.top, rr = r.right, b = r.bottom;
      for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        const ps = getComputedStyle(p);
        const pr = p.getBoundingClientRect();
        if (ps.overflowX !== 'visible') { l = Math.max(l, pr.left); rr = Math.min(rr, pr.right); }
        if (ps.overflowY !== 'visible') { t = Math.max(t, pr.top); b = Math.min(b, pr.bottom); }
      }
      if (rr - l > 1 && b - t > 1) rects.push({ l, t, r: rr, b });
    }
    return rects.length ? { rects, fixedRoot } : null;
  }

  const out = { scroll: null, overlaps: [], tight: [], clipped: [], ellipsis: [] };
  const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (sw > window.innerWidth + 1) out.scroll = { scrollWidth: sw, innerWidth: window.innerWidth };

  const items = [];
  for (const el of document.querySelectorAll(TEXTISH)) {
    const s = shown(el);
    if (!s) continue;
    /* A control whose text is only in a child that is hidden is fine; a text block with no text of its own is a wrapper. */
    const isCtrl = el.matches(CTRL);
    if (!isCtrl && !(el.textContent || '').trim()) continue;
    items.push({ el, rects: s.rects, fixedRoot: s.fixedRoot, isCtrl, abs: getComputedStyle(el).position === 'absolute' });
  }

  /* A control "looks like a button" when it has a visible border or a filled background (inputs and selects always do). Plain text links and
     list-style menu items that sit 2 px apart are separated by their own padding and line height, so they are not reported as tight. */
  const boxy = (el) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return true;
    const cs = getComputedStyle(el);
    const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 0; const p = m[1].split(/[ ,\/]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; };
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((d) => cs['border' + d + 'Style'] !== 'none' && parseFloat(cs['border' + d + 'Width']) > 0 && alpha(cs['border' + d + 'Color']) > 0.05);
    return border || alpha(cs.backgroundColor) > 0.05;
  };
  const inter = (a, b) => ({ dx: Math.min(a.r, b.r) - Math.max(a.l, b.l), dy: Math.min(a.b, b.b) - Math.max(a.t, b.t) });
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;               // one inside the other (badge in a button): intended
      /* An absolutely positioned control over its sibling field (the drop-down arrow drawn inside a combo box, an icon in a label)
         is placed on top on purpose. */
      if (A.el.parentElement === B.el.parentElement && ((A.abs && A.isCtrl) || (B.abs && B.isCtrl))) continue;
      if (!!A.fixedRoot !== !!B.fixedRoot) continue;                          // a fixed bar over page content is intended; fixed vs fixed is compared
      let best = null, tight = null;
      for (const ra of A.rects) for (const rb of B.rects) {
        const { dx, dy } = inter(ra, rb);
        if (dx > 2 && dy > 2 && (!best || dx * dy > best.dx * best.dy)) best = { dx, dy, ra, rb };
        if (A.isCtrl && B.isCtrl && boxy(A.el) && boxy(B.el)) {
          const minH = Math.min(ra.b - ra.t, rb.b - rb.t), minW = Math.min(ra.r - ra.l, rb.r - rb.l);
          let gap = null, axis = null;
          if (dy >= 0.5 * minH && dx > -4 && dx < 2 + 2) { gap = -dx; axis = 'horizontal'; }
          else if (dx >= 0.5 * minW && dy > -4 && dy < 2 + 2) { gap = -dy; axis = 'vertical'; }
          /* Joined groups (tab bars, segmented choices, the app's main menu) touch on purpose: siblings at a gap of 0.5 px or less
             are not reported. A gap of more than 0.5 and less than 4 px between siblings, or any gap under 4 px between
             unrelated controls (not siblings), is. */
          if (gap !== null && gap <= 0.5 && A.el.parentElement === B.el.parentElement) gap = null;
          if (gap !== null && gap < 4 && gap > -2 && !(dx > 2 && dy > 2) && (!tight || gap < tight.gap)) tight = { gap, axis };
        }
      }
      if (best) out.overlaps.push({ a: desc(A.el), b: desc(B.el), dx: R(best.dx), dy: R(best.dy), ra: [R(best.ra.l), R(best.ra.t), R(best.ra.r - best.ra.l), R(best.ra.b - best.ra.t)], rb: [R(best.rb.l), R(best.rb.t), R(best.rb.r - best.rb.l), R(best.rb.b - best.rb.t)] });
      else if (tight) out.tight.push({ a: desc(A.el), b: desc(B.el), gap: R(tight.gap), axis: tight.axis });
    }
  }

  /* Clipped text. html and body are skipped (the page itself); svg and canvas contents are skipped by shown(). */
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip', clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if (!clipX && !clipY) continue;
    if (!el.clientWidth || !el.clientHeight) continue;
    const overX = clipX ? el.scrollWidth - el.clientWidth : 0, overY = clipY ? el.scrollHeight - el.clientHeight : 0;
    if (overX <= 1 && overY <= 1) continue;
    if (!(el.textContent || '').trim()) continue;
    if (!shown(el)) continue;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const row = { el: desc(el), overX: Math.max(0, overX), overY: Math.max(0, overY), client: [el.clientWidth, el.clientHeight] };
    (cs.textOverflow === 'ellipsis' || clamp ? out.ellipsis : out.clipped).push(row);
  }
  /* (e) a word split over two lines: each word's own boxes, by line. Words that are long on their own (more than 24
     characters, such as a file name or a web address) may break on purpose and are skipped. */
  out.broken = [];
  const seenBroken = new Set();
  for (const el of document.querySelectorAll('button, label, th, td, summary, h1, h2, h3, h4, a, .field-label, [role=button]')) {
    if (out.broken.length > 200) break;
    if (!shown(el)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent || '';
      for (const m of text.matchAll(/\S+/g)) {
        if (m[0].length < 2 || m[0].length > 24) continue;
        const r = document.createRange();
        r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0.5).map((x) => Math.round(x.top)));
        if (tops.size > 1) {
          const key = desc(el) + '|' + m[0];
          if (!seenBroken.has(key)) { seenBroken.add(key); out.broken.push({ a: desc(el), word: m[0], lines: tops.size }); }
          break;
        }
      }
    }
  }
  /* Elements are turned to text here so the result can leave the page. */
  out.clipped = out.clipped.map((r) => ({ a: r.el, overX: r.overX, overY: r.overY, client: r.client }));
  out.ellipsis = out.ellipsis.map((r) => ({ a: r.el, overX: r.overX, overY: r.overY, client: r.client }));
  return out;
}

/* ---------- running ---------- */
const report = { browser: BROWSER, generated: new Date().toISOString(), widths: WIDTHS, out: OUT, notes: [], runs: 0, issues: [] };
const shotsDir = OUT;

function record(kind, page, width, theme, m) {
  const base = { kind, page, width, theme };
  if (m.scroll) report.issues.push({ ...base, check: 'scroll', a: 'page', detail: 'scrollWidth ' + m.scroll.scrollWidth + ' > window ' + m.scroll.innerWidth, mag: m.scroll.scrollWidth - m.scroll.innerWidth });
  for (const o of m.overlaps) report.issues.push({ ...base, check: 'overlap', a: o.a, b: o.b, detail: 'overlap ' + o.dx + ' x ' + o.dy + ' px', mag: o.dx * o.dy, rects: [o.ra, o.rb] });
  for (const t of m.tight) report.issues.push({ ...base, check: 'tight', a: t.a, b: t.b, detail: t.axis + ' gap ' + t.gap + ' px', mag: 4 - t.gap });
  for (const c of m.clipped) report.issues.push({ ...base, check: 'clipped', a: c.a, detail: 'content ' + c.overX + ' px wider, ' + c.overY + ' px taller than the box (' + c.client.join(' x ') + ')', mag: c.overX + c.overY });
  for (const w of m.broken || []) report.issues.push({ ...base, check: 'broken', a: w.a, detail: 'the word "' + w.word + '" is split over ' + w.lines + ' lines', mag: w.lines });
  for (const c of m.ellipsis) report.issues.push({ ...base, check: 'ellipsis', a: c.a, detail: 'truncated on purpose, ' + c.overX + ' px wider, ' + c.overY + ' px taller', mag: c.overX + c.overY });
}

async function visit(browser, kind, urlFor, items, label) {
  for (const width of WIDTHS) for (const theme of SCHEMES) {
    const ctx = await browser.newContext({ viewport: { width, height: heightFor(width) }, colorScheme: theme, reducedMotion: 'reduce' });
    if (kind === 'site') await ctx.addInitScript(setSiteTheme, theme);
    else await ctx.addInitScript(standIn);
    for (const it of items) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(urlFor(it));
        if (kind === 'app') {
          await page.waitForSelector('.update-bar', { timeout: 10000 });
          if (it.open) await page.getByRole(it.open.role, { name: it.open.name, exact: typeof it.open.name === 'string' }).first().click({ timeout: 8000 });
        } else {
          await page.waitForLoadState('load');
        }
        await page.waitForTimeout(350);
        const m = await page.evaluate(measure);
        record(kind, label(it), width, theme, m);
        await page.screenshot({ path: path.join(shotsDir, kind + '-' + label(it).replace(/\.html$/, '') + '-' + width + '-' + theme + SUFFIX + '.png'), fullPage: true });
        report.runs++;
        if (errors.length) report.notes.push(label(it) + ' ' + width + ' ' + theme + ': page error: ' + errors[0]);
      } catch (e) {
        report.notes.push(label(it) + ' ' + width + ' ' + theme + ': could not be checked: ' + String(e.message || e).split('\n')[0]);
      }
      await page.close();
    }
    await ctx.close();
  }
}

function summarise() {
  const checks = ['scroll', 'overlap', 'tight', 'clipped', 'broken', 'ellipsis'];
  const names = { scroll: 'sideways scroll', overlap: 'overlapping elements', tight: 'controls closer than 4 px', clipped: 'clipped text', broken: 'words split over two lines', ellipsis: 'truncated with ellipsis (on purpose, listed only)' };
  console.log('\nSpacing check: ' + report.runs + ' page/width/theme runs, widths ' + WIDTHS.join(', ') + ', ' + BROWSER + ' only.');
  for (const k of ['site', 'app']) {
    const mine = report.issues.filter((i) => i.kind === k);
    if (!mine.length && !report.issues.some((i) => i.kind === k) && !report.ran[k]) continue;
    console.log('\n' + (k === 'site' ? 'Website' : 'Tester app') + ':');
    for (const c of checks) console.log('  ' + String(mine.filter((i) => i.check === c).length).padStart(5) + '  ' + names[c]);
  }
  /* Group the same pair of elements across widths and themes. */
  const groups = new Map();
  for (const i of report.issues) {
    if (i.check === 'ellipsis') continue;
    const key = [i.kind, i.check, i.a, i.b || ''].join('|');
    const g = groups.get(key) || { ...i, hits: [], pages: new Set(), worst: i };
    g.pages.add(i.page);
    g.hits.push(i.page.replace(/\\.html$/, '') + ' ' + i.width + '/' + i.theme[0]);
    if (i.mag > g.worst.mag) g.worst = i;
    groups.set(key, g);
  }
  const order = { scroll: 0, overlap: 1, clipped: 2, broken: 3, tight: 4 };
  const list = [...groups.values()].sort((x, y) => order[x.check] - order[y.check] || y.worst.mag - x.worst.mag);
  report.groups = list.map((g) => ({ kind: g.kind, check: g.check, pages: [...g.pages], a: g.a, b: g.b || null, widths_themes: g.hits, worst: g.worst.detail + ' at ' + g.worst.width + ' ' + g.worst.theme }));
  console.log('\nTop issues (' + list.length + ' distinct; widths as width/theme):');
  for (const g of list.slice(0, 40)) {
    const widths = [...new Set(g.hits.map((h) => h.split(' ')[1]))].join(', ');
    console.log('- [' + g.check + '] ' + g.kind + ' ' + [...g.pages].join(', ') + ' @ ' + widths + '\n    A: ' + g.a + (g.b ? '\n    B: ' + g.b : '') + '\n    ' + g.worst.detail + ' (worst at ' + g.worst.width + ' ' + g.worst.theme + ')');
  }
  if (list.length > 40) console.log('... and ' + (list.length - 40) + ' more in report.json');
  if (report.notes.length) console.log('\nNotes:\n' + report.notes.map((n) => '- ' + n).join('\n'));
  console.log('\nPictures and report.json: ' + OUT);
  return list.length;
}

async function main() {
  const pw = await import('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  report.ran = { site: false, app: false };
  const browser = await pw[BROWSER].launch(BROWSER === 'chromium' && process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const servers = [];
  try {
    if (!flags['app-only']) {
      let pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
      if (flags.pages) { const want = String(flags.pages).split(','); pages = pages.filter((p) => want.includes(p)); }
      const server = await serve(ROOT); servers.push(server);
      const base = 'http://127.0.0.1:' + server.address().port + '/';
      report.ran.site = true;
      await visit(browser, 'site', (p) => base + p, pages, (p) => p);
    }
    if (!flags['site-only']) {
      if (!fs.existsSync(path.join(DIST, 'index.html'))) {
        const msg = 'Tester app skipped: no built app in ' + DIST + '. Run "npm run app:build" first.';
        console.log(msg); report.notes.push(msg);
      } else {
        const server = await serve(DIST); servers.push(server);
        const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
        report.ran.app = true;
        await visit(browser, 'app', () => base, SCREENS, (s) => s.id);
      }
    }
  } finally {
    await browser.close();
    servers.forEach((s) => s.close());
  }
  const distinct = summarise();
  const real = report.issues.filter((i) => i.check !== 'ellipsis').length;
  delete report.ran;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  if (flags.strict && real > 0) { console.log('--strict: ' + real + ' issues (' + distinct + ' distinct).'); process.exit(1); }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
