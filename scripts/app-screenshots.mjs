/* Pictures of the tester app's screens, for pull requests: the owner sees what changed without installing the app.
   Run after "npm run app:build":   node scripts/app-screenshots.mjs [output folder, default screenshots]
   It serves apps/tester/dist on this computer only (Node's own http, no network), opens each screen in Chromium
   (Playwright, a dev tool that is never shipped), and saves one picture per screen at 1366 and 390 px, light and dark,
   plus one contact sheet per width (app-screens-1366.png, app-screens-390.png) that the workflow uploads.
   A stand-in for the Windows app is given to the screens so Settings shows its Updates section and the update bar
   shows; no device is connected and no data is recorded. Changes no project file.
   PW_CHROMIUM_PATH can point at a Chromium already installed on this computer. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps/tester/dist');

/** The screens pictured, by the app's page id (apps/tester/src/Shell.tsx PAGE_TITLES). History and Admin need a
    lab-server sign-in, so they are not pictured. The stand-in is signed in on this computer as an admin (made-up
    people), so People is pictured too. `open` is the button that leads there from Home. */
export const SCREENS = [
  { id: 'home', open: null },
  { id: 'test', open: { role: 'button', name: 'Test' } },
  { id: 'load', open: { role: 'button', name: /Load a recorded test/ } },
  { id: 'methods', open: { role: 'button', name: /Test methods/ } },
  { id: 'device', open: { role: 'button', name: 'Device' } },
  { id: 'help', open: { role: 'button', name: 'Help' } },
  { id: 'settings', open: { role: 'button', name: 'Settings' } },
  { id: 'people', open: { role: 'button', name: 'People' } },
];
export const SIZES = [{ width: 1366, height: 900 }, { width: 390, height: 844 }];
export const SCHEMES = ['light', 'dark'];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

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

/* The same shape as apps/desktop/preload.cjs gives, with fixed answers (made-up people, not real accounts). */
export function standIn() {
  const me = { name: 'Example Admin', username: 'admin', kind: 'admin', kindName: 'Admin', mustChange: false, endDate: null, daysLeft: null, responsible: null, canRunMachine: true, why: '' };
  const person = { disabled: false, endDate: null, ended: false, mustChange: false, createdAt: '2026-11-14T09:00:00.000Z', lastSignIn: '2026-11-14T10:00:00.000Z' };
  window.tensileDesktop = Object.freeze({
    kind: 'windows-app', getLabServer: async () => '', setLabServer: async () => ({}),
    checkForUpdate: async () => ({ available: true, version: '1.0.0-beta.2', pageUrl: 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/tag/app-v1.0.0-beta.2-run.1' }),
    openReleasePage: async () => true, getUpdateCheck: async () => true, setUpdateCheck: async (on) => ({ on }),
    people: Object.freeze({
      status: async () => ({ ok: { setUp: true, broken: null } }),
      current: async () => ({ ok: me }), touch: async () => ({ ok: me }), signOut: async () => ({ ok: null }),
      list: async () => ({ ok: [
        { ...person, id: 'p-1', username: 'admin', name: 'Example Admin', kind: 'admin', kindName: 'Admin', addedBy: null },
        { ...person, id: 'p-2', username: 'op.one', name: 'Example Operator', kind: 'operator', kindName: 'Operator', addedBy: 'Example Admin' },
        { ...person, id: 'p-3', username: 'student.one', name: 'Example Student', kind: 'student', kindName: 'Student', endDate: '2027-05-31', addedBy: 'Example Operator', training: { at: '2026-11-14T11:00:00.000Z', by: 'Example Operator' } },
        { ...person, id: 'p-4', username: 'student.two', name: 'Second Student', kind: 'student', kindName: 'Student', endDate: '2027-05-31', addedBy: 'Example Operator', mustChange: true },
      ] }),
      usageLog: async () => ({ ok: [] }),
      trainingItems: async () => ({ ok: ['Safety briefing given', 'Shown where the tester’s own STOP is', 'Practice test completed'] }),
      usageReport: async () => ({ ok: [
        { username: 'op.one', name: 'Example Operator', kind: 'operator', kindName: 'Operator', tests: 4, recordingMinutes: 31.5, lastUse: '2026-11-14T10:00:00.000Z', asResponsible: 3 },
        { username: 'student.one', name: 'Example Student', kind: 'student', kindName: 'Student', tests: 3, recordingMinutes: 18, lastUse: '2026-11-14T11:00:00.000Z', asResponsible: 0 },
      ] }),
    }),
  });
}

async function sheet(browser, shots, width, file) {
  const scale = width > 800 ? 0.5 : 0.8;
  const rows = SCREENS.map((s) => '<tr><th>' + s.id + '</th>' + SCHEMES.map((c) => {
    const b64 = fs.readFileSync(shots[s.id + '-' + width + '-' + c]).toString('base64');
    return '<td><img src="data:image/png;base64,' + b64 + '"></td>';
  }).join('') + '</tr>').join('');
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.setContent('<style>body{margin:12px;font:14px system-ui,sans-serif}img{width:' + Math.round(width * scale) + 'px;border:1px solid #ccc}th{text-align:left;vertical-align:top;padding-right:8px}td{padding:0 8px 12px 0;vertical-align:top}</style>' +
    '<p>Tester app at ' + width + ' px, light and dark. Stand-in Windows app: no device connected, nothing recorded.</p><table>' + rows + '</table>');
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

export async function run(out = 'screenshots') {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('No built app in ' + DIST + '. Run "npm run app:build" first.');
  const { chromium } = await import('playwright');
  fs.mkdirSync(out, { recursive: true });
  const server = await serve(DIST);
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const shots = {};
  const errors = [];
  try {
    for (const size of SIZES) for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: size, colorScheme: scheme, reducedMotion: 'reduce' });
      await ctx.addInitScript(standIn);
      for (const s of SCREENS) {
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(s.id + ': ' + e.message));
        await page.goto(base);
        await page.waitForSelector('.update-bar', { timeout: 10000 });
        if (s.open) await page.getByRole(s.open.role, { name: s.open.name, exact: typeof s.open.name === 'string' }).first().click();
        await page.waitForTimeout(300);
        const file = path.join(out, s.id + '-' + size.width + '-' + scheme + '.png');
        await page.screenshot({ path: file });
        shots[s.id + '-' + size.width + '-' + scheme] = file;
        await page.close();
      }
      await ctx.close();
    }
    for (const size of SIZES) await sheet(browser, shots, size.width, path.join(out, 'app-screens-' + size.width + '.png'));
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) throw new Error('Errors on the screens:\n' + errors.join('\n'));
  return Object.keys(shots).length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv[2]).then((n) => console.log('Saved ' + n + ' pictures and 2 contact sheets.'), (e) => { console.error(e.message || e); process.exit(1); });
}
