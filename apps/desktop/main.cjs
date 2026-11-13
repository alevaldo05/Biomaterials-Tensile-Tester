'use strict';
/* The Windows app: one window that shows the tester app's screens, bundled with the installer (the ui folder),
   served from app://tester/. It never loads screens from a server or another site.
   Security: the screens run with context isolation and the sandbox, without Node, and the preload gives them nothing
   but a fixed label. Navigation away is blocked; links to the public website open in the computer's browser.
   Only USB serial is allowed, and the person chooses the port each time. The app sends no machine commands. */
const { app, BrowserWindow, dialog, Menu, net, protocol, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { uiFile } = require('./ui-files.cjs');

const SCHEME = 'app', ORIGIN = 'app://tester';
const UI_DIR = path.join(__dirname, 'ui');
/* The only outside pages the app opens, in the computer's own browser. */
const SITE = 'https://alevaldo05.github.io/Biomaterials-Tensile-Tester/';

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

/* Two copies would compete for the USB port and the recordings on this computer. */
const firstCopy = app.requestSingleInstanceLock();
if (!firstCopy) app.quit();

const fromApp = (url) => typeof url === 'string' && (url === ORIGIN || url.startsWith(ORIGIN + '/'));

function serveUi() {
  protocol.handle(SCHEME, async (req) => {
    const u = new URL(req.url);
    if (u.host !== 'tester' || req.method !== 'GET') return new Response('Not found', { status: 404 });
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
  wc.on('will-navigate', (e, url) => { if (!fromApp(url)) e.preventDefault(); });
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
  serveUi();
  lockDown();
  createWindow();
});
