'use strict';
/* Start-up check for the built Windows app, run by the build workflow (not shipped in the installer).
   It starts the unpacked program, waits for its window to load, and confirms that the only pages open are the
   app's own bundled screens (app://tester/), then closes it. It reads the window list from the browser engine's
   local debugging port, which is opened only by this check, on 127.0.0.1.
   Usage: node smoke.cjs "<path to the program>" [port] [seconds] */
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');

const ORIGIN = 'app://tester/';

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

/** Judges one list of open targets: ok only when there is a page, and every page is the app's own screen. */
function judge(targets) {
  const pages = (Array.isArray(targets) ? targets : []).filter((t) => t && t.type === 'page');
  if (!pages.length) return { ok: false, reason: 'no window yet' };
  const outside = pages.filter((p) => typeof p.url !== 'string' || !p.url.startsWith(ORIGIN));
  if (outside.length) return { ok: false, reason: 'a page is not the app\'s own screen: ' + outside.map((p) => p.url).join(', '), final: true };
  return { ok: true, reason: pages.length + ' page(s), first: ' + pages[0].url + ' (title: ' + (pages[0].title || '') + ')' };
}

function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

async function run(exe, port, seconds, args = []) {
  const child = spawn(exe, ['--remote-debugging-port=' + port, ...args], { stdio: 'ignore', windowsHide: false });
  let exited = null;
  child.on('exit', (code) => { exited = code; });
  child.on('error', (e) => { exited = 'error: ' + e.message; });
  const end = Date.now() + seconds * 1000;
  let last = { ok: false, reason: 'the window list could not be read' };
  try {
    while (Date.now() < end) {
      if (exited !== null) return { ok: false, reason: 'the program exited early (' + exited + ')' };
      try { last = judge(await getJson(port, '/json/list')); } catch { last = { ok: false, reason: 'the window list could not be read' }; }
      if (last.ok || last.final) return last;
      await new Promise((r) => setTimeout(r, 500));
    }
    return { ok: false, reason: 'timed out after ' + seconds + ' s: ' + last.reason };
  } finally { stop(child); }
}

module.exports = { judge, run };

if (require.main === module) {
  const [exe, port = '9333', seconds = '60'] = process.argv.slice(2);
  if (!exe) { console.error('Usage: node smoke.cjs "<program>" [port] [seconds]'); process.exit(2); }
  run(exe, Number(port), Number(seconds)).then((r) => {
    console.log((r.ok ? 'PASS: ' : 'FAIL: ') + r.reason);
    process.exit(r.ok ? 0 : 1);
  });
}
