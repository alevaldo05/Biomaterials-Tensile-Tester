/* Checks on the Windows app that run without Electron: the locked-down window settings, the preload that gives the
   screens nothing, the file server that cannot leave the ui folder, and the packaging switches. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, '..');
const read = (f: string) => readFileSync(path.join(dir, f), 'utf8');
const { uiFile } = createRequire(import.meta.url)('../ui-files.cjs') as { uiFile: (ui: string, p: string) => { file: string; type: string } | null };

describe('Windows app', () => {
  const main = read('main.cjs');
  it('runs the screens isolated, sandboxed, and without Node', () => {
    for (const s of ['contextIsolation: true', 'sandbox: true', 'nodeIntegration: false', 'nodeIntegrationInWorker: false', 'webSecurity: true', 'allowRunningInsecureContent: false', 'webviewTag: false', 'devTools: !app.isPackaged']) expect(main).toContain(s);
    expect(main).not.toMatch(/enableRemoteModule|nodeIntegration: true|sandbox: false|contextIsolation: false|webSecurity: false/);
  });
  it('loads only its own bundled screens, blocks navigation away, and opens only the public website outside', () => {
    expect(main).toContain("win.loadURL(ORIGIN + '/index.html')");
    expect(main).not.toMatch(/loadURL\(['"]https?:/);
    expect(main).toContain("wc.on('will-navigate'");
    expect(main).toContain("return { action: 'deny' }");
    expect(main).toMatch(/if \(url\.startsWith\(SITE\)\) void shell\.openExternal\(url\)/);
  });
  it('allows only USB serial, chosen by the person, and copying text', () => {
    expect(main).toContain("d.deviceType === 'serial' && fromApp(d.origin)");
    expect(main).toContain("'select-serial-port'");
    expect(main).toContain("permission === 'clipboard-sanitized-write'");
    expect(main).not.toMatch(/'(media|geolocation|notifications|hid|usb|bluetooth)'/);
  });
  it('sends no machine commands and has no other way to reach the device', () => {
    expect(main).not.toMatch(/start_stream|stop_stream|set_settings|serialport|child_process/);
  });
  it('answers only the lab-address and journal calls, and only from its own screens', () => {
    expect([...main.matchAll(/ipcMain\.(\w+)\('([^']+)'/g)].map((m) => m[1] + ' ' + m[2])).toEqual(['handle journal:', 'handle lab-server:get', 'handle lab-server:set']);
    expect(main).toContain("const JOURNAL_CALLS = ['begin', 'append', 'finish', 'list', 'lines', 'remove', 'estimate'];");
    expect(main).toContain("if (!own(e)) throw new Error('Not allowed.');");
    expect(main).not.toMatch(/ipcMain\.on\(|webContents\.send|\.send\(/);
    expect(main).toContain('const own = (e) => fromApp(e.senderFrame && e.senderFrame.url);');
    expect(main).toContain('checkLabUrl(');
  });
  it('the preload gives the screens a fixed label, the lab-address calls, and the journal calls, nothing else', () => {
    const pre = read('preload.cjs');
    expect(pre.match(/exposeInMainWorld/g)).toHaveLength(1);
    expect(pre).toContain("kind: 'windows-app'");
    expect([...pre.matchAll(/ipcRenderer\.(\w+)\('([^']+)'/g)].map((m) => m[1] + ' ' + m[2])).toEqual(['invoke lab-server:get', 'invoke lab-server:set',
      ...['begin', 'append', 'finish', 'list', 'lines', 'remove', 'estimate'].map((n) => 'invoke journal:' + n)]);
    expect(pre.match(/ipcRenderer\./g)).toHaveLength(9);
    expect(pre).not.toMatch(/require\(['"](fs|node:|child_process|path)/);
  });
  it('sends only /api/v1/ requests to the lab server, never screens', () => {
    expect(main).toContain('if (u.pathname.startsWith(API_PREFIX)) return lab.handle(req);');
    expect(main).toContain("win.loadURL(ORIGIN + '/index.html')");
  });
  it('serves files from the ui folder only', () => {
    const ui = path.join(dir, 'ui');
    expect(uiFile(ui, '/')).toEqual({ file: path.join(ui, 'index.html'), type: 'text/html; charset=utf-8' });
    expect(uiFile(ui, '/assets/index-abc.js')?.type).toContain('javascript');
    for (const bad of ['/../main.cjs', '/..%2fmain.cjs', '/%2e%2e/%2e%2e/package.json', '/assets/../../preload.cjs', '/a\0.js', '/%E0%A4%A', '/secret.exe', '/notes']) {
      const r = uiFile(ui, bad);
      if (r) expect(r.file.startsWith(ui + path.sep), bad).toBe(true);
      expect(r === null || /\.(html|js|css|json|svg|png|ico|woff2|txt)$/.test(r.file), bad).toBe(true);
    }
    expect(uiFile(ui, '/../main.cjs')).toBeNull();
    expect(uiFile(ui, '/secret.exe')).toBeNull();
  });
  it('is packaged with the hardening switches on, unsigned beta in the file name, and no auto-publish', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.devDependencies.electron).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies['electron-builder']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.build.electronFuses).toMatchObject({ runAsNode: false, enableNodeOptionsEnvironmentVariable: false, enableNodeCliInspectArguments: false, onlyLoadAppFromAsar: true, enableEmbeddedAsarIntegrityValidation: true });
    expect(pkg.build.publish).toBeNull();
    expect(pkg.build.nsis.artifactName).toContain('beta-unsigned');
    expect(pkg.build.files).not.toContain('node_modules/**/*');
    expect(pkg.build.files).toEqual(expect.arrayContaining(['main.cjs', 'preload.cjs', 'ui-files.cjs', 'lab-proxy.cjs', 'journal-files.cjs', 'ui/**/*']));
  });
});
