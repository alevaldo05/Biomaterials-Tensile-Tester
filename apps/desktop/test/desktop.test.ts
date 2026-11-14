/* Checks on the Windows app that run without Electron: the locked-down window settings, the preload that gives the
   screens nothing, the file server that cannot leave the ui folder, and the packaging switches. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, '..');
const read = (f: string) => readFileSync(path.join(dir, f), 'utf8');
const PEOPLE = ['status', 'setup', 'sign-in', 'sign-out', 'current', 'touch', 'change-password', 'list', 'responsible-choices', 'confirm-responsible', 'add', 'update', 'recover', 'usage-log'];
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
  it('the installed program refuses remote-debugging, inspector, and V8-flag switches (only the start-up check may use one)', () => {
    expect(main).toMatch(/const BLOCKED_SWITCHES = \['remote-debugging-port', 'remote-debugging-pipe', 'remote-debugging-address', 'inspect', 'inspect-brk', 'inspect-port', 'js-flags'\];/);
    expect(main).toContain("if (app.isPackaged && process.env.TT_SMOKE_CHECK !== '1' && blockedSwitch()) {");
    expect(main).toContain('app.exit(1);');
    /* the check runs before the window, the protocol, or the bridge are set up */
    expect(main.indexOf('blockedSwitch()) {')).toBeLessThan(main.indexOf('protocol.registerSchemesAsPrivileged'));
    expect(read('smoke.cjs')).toContain("TT_SMOKE_CHECK: '1'");
    expect(main.match(/TT_SMOKE_CHECK/g)).toHaveLength(2);   /* the comment and the check; nothing else reads it */
  });
  it('sends no machine commands and has no other way to reach the device', () => {
    expect(main).not.toMatch(/start_stream|stop_stream|set_settings|serialport|child_process/);
  });
  it('answers only the lab-address, journal, people, and update calls, and only from its own screens', () => {
    expect([...main.matchAll(/ipcMain\.(\w+)\('([^']+)'/g)].map((m) => m[1] + ' ' + m[2])).toEqual(['handle journal:', 'handle people:', 'handle lab-server:get', 'handle update:check', 'handle update:open', 'handle update:get-setting', 'handle update:set-setting', 'handle lab-server:set']);
    expect(main.match(/if \(!own\(e\)/g)?.length).toBe(5);
    expect(main).toContain("ipcMain.handle('update:check', (e) => (own(e) ? updateOnce() : { available: false }));");
    expect(main).toContain("ipcMain.handle('update:get-setting', (e) => (own(e) ? checkUpdates : true));");
    /* the release page is checked before it is opened, and nothing else is opened from an update call */
    expect(main).toContain("if (!own(e) || !isReleasePage(url)) return false;");
    expect(main).toContain("if (!own(e) || typeof on !== 'boolean') return { error: 'Not allowed.' };");
    expect(main).toContain("const JOURNAL_CALLS = ['begin', 'append', 'finish', 'list', 'lines', 'remove', 'estimate'];");
    expect(main).toContain("if (!own(e)) throw new Error('Not allowed.');");
    expect(main).not.toMatch(/ipcMain\.on\(|webContents\.send|\.send\(/);
    expect(main).toContain('const own = (e) => fromApp(e.senderFrame && e.senderFrame.url);');
    expect(main).toContain('checkLabUrl(');
  });
  it('the preload gives the screens a fixed label, the lab-address, journal, people, and update calls, nothing else', () => {
    const pre = read('preload.cjs');
    expect(pre.match(/exposeInMainWorld/g)).toHaveLength(1);
    expect(pre).toContain("kind: 'windows-app'");
    expect([...pre.matchAll(/ipcRenderer\.(\w+)\('([^']+)'/g)].map((m) => m[1] + ' ' + m[2])).toEqual(['invoke lab-server:get', 'invoke lab-server:set',
      'invoke update:check', 'invoke update:open', 'invoke update:get-setting', 'invoke update:set-setting',
      ...['begin', 'append', 'finish', 'list', 'lines', 'remove', 'estimate'].map((n) => 'invoke journal:' + n),
      ...PEOPLE.map((n) => 'invoke people:' + n)]);
    expect(pre.match(/ipcRenderer\./g)).toHaveLength(13 + PEOPLE.length);
    /* every people call the preload offers is answered by the main process, with the same number of arguments at most */
    const table = Object.fromEntries([...main.split('const PEOPLE_CALLS = {')[1]!.split('};')[0]!.matchAll(/'?([a-z-]+)'?: (\d)/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(table)).toEqual(PEOPLE);
    expect(pre).not.toMatch(/require\(['"](fs|node:|child_process|path)/);
  });
  it('lets only a signed-in person who may run the machine open the USB port or start a recording, and names them itself', () => {
    expect(main).toContain("(permission === 'serial' && machineAllowed())");
    expect(main).toContain("s.setDevicePermissionHandler((d) => d.deviceType === 'serial' && fromApp(d.origin) && machineAllowed());");
    const pick = main.split("s.on('select-serial-port'")[1]!;
    expect(pick.indexOf('if (!machineAllowed())')).toBeGreaterThan(-1);
    expect(pick.indexOf('if (!machineAllowed())')).toBeLessThan(pick.indexOf('callback(pick === cancel'));
    const begin = main.split("if (name === 'begin') {")[1]!.split('return undefined;')[0]!;
    expect(begin).toContain('if (!m.allowed) throw new Error(m.why);');
    /* the screens' own operator field is replaced by the main process's */
    expect(begin).toContain("operator: people.operatorBlock() }");
    expect(begin.indexOf('...(args[0]')).toBeLessThan(begin.indexOf('operator: people.operatorBlock()'));
    expect(main).toContain('const machineAllowed = () => !!people && people.machine().allowed;');
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
    expect(pkg.build.files).toEqual(expect.arrayContaining(['main.cjs', 'preload.cjs', 'ui-files.cjs', 'lab-proxy.cjs', 'journal-files.cjs', 'people.cjs', 'update-check.cjs', 'ui/**/*']));
  });
  it('uses the curve mark as the Windows icon: a 256 x 256 PNG that electron-builder turns into the .ico', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.build.win.icon).toBe('build/icon.png');
    const png = readFileSync(path.join(dir, pkg.build.win.icon));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([256, 256]);
  });
  it('builds an installer and a portable program, both x64, both named unsigned beta, with the same name before the kind', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.build.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }]);
    expect(pkg.build.nsis.artifactName).toMatch(/-beta-unsigned-setup\.\$\{ext\}$/);
    expect(pkg.build.portable.artifactName).toMatch(/-beta-unsigned-portable\.\$\{ext\}$/);
    expect(pkg.build.portable.artifactName.replace('-portable.', '-setup.')).toBe(pkg.build.nsis.artifactName);
  });
  it('has its build workflow hash and attach both .exe files, and start-check only the unpacked program', () => {
    const wf = readFileSync(path.resolve(dir, '../../.github/workflows/desktop.yml'), 'utf8');
    expect(wf).toContain('sha256sum *.exe > SHA256SUMS.txt');
    expect(wf).toContain('release/*.exe release/SHA256SUMS.txt');
    expect(wf).toContain('for kind in setup portable; do');
    expect(wf).toContain('exe=$(ls release/win-unpacked/*.exe | grep -v -i uninstall | head -1)');
    expect(wf).toContain('--draft');
    /* the release notes and the job summary carry the Help screen's line, from the same sources */
    expect(wf).toContain('node scripts/shared-files.js --short');
    expect(wf).toContain("require('./apps/desktop/package.json').version");
    expect(wf).toContain('line="Version ${version} · built from ${GITHUB_SHA:0:12} · shared website files ${shared}"');
    expect(wf).toContain('${BUILD_LINE}');
  });
  it('builds a draft (not a pre-release, so the latest-release link finds it once published) and stamps the run number', () => {
    const wf = readFileSync(path.resolve(dir, '../../.github/workflows/desktop.yml'), 'utf8');
    expect(wf).toMatch(/gh release create "\$tag" --draft --target/);
    expect(wf).not.toContain('--prerelease');
    expect(wf).toContain('npm pkg set buildNumber="${GITHUB_RUN_NUMBER}" --json');
    expect(wf).toContain('tag="app-v${version}-run.${GITHUB_RUN_NUMBER}"');
    expect(wf).toMatch(/^ {2}workflow_dispatch:/m);
    expect(wf).toMatch(/tags: \['app-v\*'\]/);
  });
  it('makes a draft only when asked (Run workflow or an app-v tag); a merge is a check only', () => {
    const wf = readFileSync(path.resolve(dir, '../../.github/workflows/desktop.yml'), 'utf8');
    const job = (name: string) => wf.split(new RegExp('^  ' + name + ':\\s*$', 'm'))[1]!.split(/^  \S/m)[0]!;
    const asked = "github.event_name == 'workflow_dispatch' || github.ref_type == 'tag'";
    const installer = job('installer'), release = job('release');
    /* the build job can only read; only the release job can write, and it runs only when asked */
    expect(installer).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(installer).not.toContain('contents: write');
    expect(installer).not.toContain('gh release');
    expect(release).toContain('if: ${{ ' + asked + ' }}');
    expect(release).toContain('needs: installer');
    expect(release).toMatch(/permissions:\s*\n\s*contents: write/);
    expect(release).toContain('gh release create');
    expect(installer).toContain('if: ${{ !(' + asked + ') }}');
    expect(installer).toContain('Check only: no draft made');
  });
  it('removes only older unpublished app drafts, never the new one, a published release, or a backup', () => {
    const wf = readFileSync(path.resolve(dir, '../../.github/workflows/desktop.yml'), 'utf8');
    const step = wf.split('- name: Remove older app drafts')[1]!;
    expect(step).toContain('select(.isDraft == true)');
    expect(step).toContain('select(.tagName | startswith("app-v"))');
    expect(step).toContain('[ "$old" != "$NEW_TAG" ]');
    expect(step.match(/gh release delete/g)).toHaveLength(1);
    expect(wf.indexOf('gh release create')).toBeLessThan(wf.indexOf('gh release delete'));
  });
  it('builds on merges into main that change the app or any shared website file (no file is missed)', () => {
    const wf = readFileSync(path.resolve(dir, '../../.github/workflows/desktop.yml'), 'utf8');
    const push = wf.split(/^ {2}push:\s*$/m)[1]!.split(/^\S/m)[0]!;
    expect(push).toMatch(/^ {4}branches: \[main\]\s*$/m);
    const paths = [...push.split(/^ {4}paths:\s*$/m)[1]!.matchAll(/^ {6}- '([^']+)'\s*$/gm)].map((m) => m[1]!);
    const { SHARED_FILES } = createRequire(import.meta.url)('../../../scripts/shared-files.js') as { SHARED_FILES: string[] };
    for (const f of [...SHARED_FILES, 'apps/**', 'packages/**', 'package-lock.json', 'scripts/shared-files.js', '.github/workflows/desktop.yml']) {
      expect(paths, f + ' is missing from the paths in .github/workflows/desktop.yml').toContain(f);
    }
  });
});
