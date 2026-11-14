'use strict';
/* The Windows app: one window that shows the tester app's screens, bundled with the installer (the ui folder),
   served from app://tester/. It never loads screens from a server or another site.
   Security: the screens run with context isolation and the sandbox, without Node, and the preload gives them nothing
   but a fixed label. Navigation away is blocked; links to the public website open in the computer's browser.
   Only USB serial is allowed, and the person chooses the port each time. The app sends no machine commands.
   The lab server (optional, set in Settings) is a data connection only: requests to /api/v1/ are sent on to it by
   lab-proxy.cjs, which keeps the sign-in here and never gives it to the screens.
   Recordings are kept as files in the app's data folder ("recordings") by journal-files.cjs, which checks
   everything the screens send.
   Update check (update-check.cjs): once per start, when the screens ask and the "Check for updates" setting is on,
   it asks GitHub whether a newer published release exists. It downloads nothing; the person opens the release page. */
const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { uiFile } = require('./ui-files.cjs');
const { checkLabUrl, createLabProxy, API_PREFIX } = require('./lab-proxy.cjs');
const { createJournalFiles } = require('./journal-files.cjs');
const { createUpdateOnce, isReleasePage } = require('./update-check.cjs');

/* The installed program refuses to start with switches that let another program inspect or drive it
   (remote debugging, the Node inspector, V8 flags). The start-up check in the build workflow needs remote debugging,
   so smoke.cjs sets TT_SMOKE_CHECK=1 for its own run. Someone who can set environment variables on this computer
   already controls it; this guards against other programs and shortcuts that add a switch, not against them. */
const BLOCKED_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'inspect', 'inspect-brk', 'inspect-port', 'js-flags'];
const blockedSwitch = () => BLOCKED_SWITCHES.find((s) => app.commandLine.hasSwitch(s)) || (process.argv.find((a) => /^--(inspect|remote-debugging|js-flags)/.test(a)) ?? null);
if (app.isPackaged && process.env.TT_SMOKE_CHECK !== '1' && blockedSwitch()) {
  dialog.showErrorBox('Biomaterials Tensile Tester', 'The app was started with a debugging switch (' + blockedSwitch() + ') and will close. Start it from its own shortcut.');
  app.exit(1);
}

const SCHEME = 'app', ORIGIN = 'app://tester';
const UI_DIR = path.join(__dirname, 'ui');
/* The only outside pages the app opens, in the computer's own browser. */
const SITE = 'https://alevaldo05.github.io/Biomaterials-Tensile-Tester/';

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

/* Two copies would compete for the USB port and the recordings on this computer. */
const firstCopy = app.requestSingleInstanceLock();
if (!firstCopy) app.quit();

/* Settings kept by the Windows app on this computer: the lab server address and whether to check for updates. */
const settingsFile = () => path.join(app.getPath('userData'), 'desktop-settings.json');
let labUrl = '';
let checkUpdates = true;
function loadSettings() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {}; } catch { s = {}; }
  const c = checkLabUrl(s.labUrl); labUrl = c.url ?? '';
  checkUpdates = s.checkUpdates !== false;
}
function saveSettings(next) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ labUrl: next.labUrl, checkUpdates: next.checkUpdates }, null, 2));
  labUrl = next.labUrl; checkUpdates = next.checkUpdates;
}
const saveLabUrl = (url) => saveSettings({ labUrl: url, checkUpdates });

/* This copy's version and the workflow run it was built by (package.json buildNumber, set only by the workflow). */
function ownBuild() {
  let run = 0;
  try { const n = require('./package.json').buildNumber; if (Number.isInteger(n) && n > 0) run = n; } catch { run = 0; }
  return { version: app.getVersion(), run };
}
/* At most one request to GitHub per start; never while the setting is off. */
const updateOnce = createUpdateOnce((url, init) => net.fetch(url, init), ownBuild, () => checkUpdates);
const lab = createLabProxy({ fetch: (url, init) => net.fetch(url, init), labUrl: () => labUrl });

const fromApp = (url) => typeof url === 'string' && (url === ORIGIN || url.startsWith(ORIGIN + '/'));

function serveUi() {
  protocol.handle(SCHEME, async (req) => {
    const u = new URL(req.url);
    if (u.host !== 'tester') return new Response('Not found', { status: 404 });
    if (u.pathname.startsWith(API_PREFIX)) return lab.handle(req);
    if (req.method !== 'GET') return new Response('Not found', { status: 404 });
    const f = uiFile(UI_DIR, u.pathname);
    if (!f) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(f.file).toString()).catch(() => null);
    if (!res || !res.ok) return new Response('Not found', { status: 404 });
    return new Response(res.body, { status: 200, headers: { 'content-type': f.type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' } });
  });
}

function lockDown() {
  const s = session.defaultSession;
  /* Nothing but USB serial (chosen by the person) and copying text is allowed, and only for the app's own screens. */
  s.setPermissionRequestHandler((wc, permission, cb) => cb(fromApp(wc.getURL()) && permission === 'clipboard-sanitized-write'));
  s.setPermissionCheckHandler((_wc, permission, origin) => fromApp(origin) && (permission === 'serial' || permission === 'clipboard-sanitized-write'));
  s.setDevicePermissionHandler((d) => d.deviceType === 'serial' && fromApp(d.origin));
  s.on('select-serial-port', (event, ports, wc, callback) => {
    event.preventDefault();
    if (!ports.length) {
      dialog.showMessageBox(BrowserWindow.fromWebContents(wc), { type: 'info', title: 'No device found', message: 'No USB serial device was found.', detail: 'Check the cable and that the acquisition device is powered, then press Connect again.' });
      return callback('');
    }
    const shown = ports.slice(0, 8);
    const labels = shown.map((p) => (p.displayName || p.portName || 'Serial port') + (p.portName && p.displayName ? ' (' + p.portName + ')' : '') + (p.vendorId ? ' · USB ' + p.vendorId + ':' + (p.productId || '') : ''));
    const cancel = labels.length;
    const pick = dialog.showMessageBoxSync(BrowserWindow.fromWebContents(wc), {
      type: 'question', title: 'Choose the acquisition device', message: 'Choose the USB serial port of the acquisition device.',
      detail: 'After connecting, the device says who it is. A port name alone is not accepted as identification.',
      buttons: [...labels, 'Cancel'], cancelId: cancel, defaultId: cancel, noLink: true,
    });
    callback(pick === cancel ? '' : shown[pick].portId);
  });
}

app.on('web-contents-created', (_e, wc) => {
  wc.on('will-navigate', (e, url) => { if (!fromApp(url) || new URL(url).pathname.startsWith(API_PREFIX)) e.preventDefault(); });
  wc.on('will-redirect', (e, url) => { if (!fromApp(url)) e.preventDefault(); });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SITE)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  /* The screens ask before leaving while recording or with unsaved data; Electron needs the question asked here. */
  wc.on('will-prevent-unload', (e) => {
    const leave = dialog.showMessageBoxSync(BrowserWindow.fromWebContents(wc), {
      type: 'warning', title: 'Leave without saving?', message: 'A test is recording, or its data has not been saved.',
      detail: 'Closing now may lose data that was not saved on this computer. This does not stop the tester.',
      buttons: ['Stay', 'Leave without saving'], defaultId: 0, cancelId: 0, noLink: true,
    });
    if (leave === 1) e.preventDefault();
  });
});

/* The bridge: read and set the lab server address, and the recording journal. Only the app's own screens may use them;
   every argument is checked again in lab-proxy.cjs and journal-files.cjs. */
const JOURNAL_CALLS = ['begin', 'append', 'finish', 'list', 'lines', 'remove', 'estimate'];
function bridge() {
  const own = (e) => fromApp(e.senderFrame && e.senderFrame.url);
  const journal = createJournalFiles(path.join(app.getPath('userData'), 'recordings'));
  for (const name of JOURNAL_CALLS) {
    ipcMain.handle('journal:' + name, async (e, ...args) => {
      if (!own(e)) throw new Error('Not allowed.');
      return journal[name](...args.slice(0, 3));
    });
  }
  ipcMain.handle('lab-server:get', (e) => (own(e) ? labUrl : ''));
  ipcMain.handle('update:check', (e) => (own(e) ? updateOnce() : { available: false }));
  ipcMain.handle('update:open', (e, url) => {
    if (!own(e) || !isReleasePage(url)) return false;
    void shell.openExternal(String(url));
    return true;
  });
  ipcMain.handle('update:get-setting', (e) => (own(e) ? checkUpdates : true));
  ipcMain.handle('update:set-setting', (e, on) => {
    if (!own(e) || typeof on !== 'boolean') return { error: 'Not allowed.' };
    try { saveSettings({ labUrl, checkUpdates: on }); } catch { return { error: 'The setting could not be saved on this computer.' }; }
    return { on };
  });
  ipcMain.handle('lab-server:set', (e, input) => {
    if (!own(e)) return { error: 'Not allowed.' };
    const c = checkLabUrl(typeof input === 'string' ? input.slice(0, 300) : '');
    if (c.error) return { error: c.error };
    try { saveLabUrl(c.url); } catch { return { error: 'The address could not be saved on this computer.' }; }
    lab.forget();
    return { url: c.url };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 900, minWidth: 900, minHeight: 600, title: 'Biomaterials Tensile Tester', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.once('ready-to-show', () => win.show());
  void win.loadURL(ORIGIN + '/index.html');
  return win;
}

app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(() => {
  if (!firstCopy) return;
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'Learning website', click: () => void shell.openExternal(SITE) }, { label: 'Troubleshooting', click: () => void shell.openExternal(SITE + 'help.html#trouble-title') }] },
  ]));
  loadSettings();
  serveUi();
  lockDown();
  bridge();
  createWindow();
});
