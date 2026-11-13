/* The start-up check's own logic, tried with a stand-in program that serves a window list (no Electron needed).
   Whether the real built app starts is shown only by the Windows build run. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const { judge, run } = createRequire(import.meta.url)('../smoke.cjs') as {
  judge: (t: unknown) => { ok: boolean; reason: string; final?: boolean };
  run: (exe: string, port: number, seconds: number, args?: string[]) => Promise<{ ok: boolean; reason: string }>;
};

/* the stand-in programs are scripts, which only run directly on Linux and macOS */
const itPosix = process.platform === 'win32' ? it.skip : it;

describe('start-up check', () => {
  it('passes only when every open page is the app\'s own screen', () => {
    expect(judge([]).ok).toBe(false);
    expect(judge([{ type: 'page', url: 'app://tester/index.html', title: 'T' }]).ok).toBe(true);
    expect(judge([{ type: 'page', url: 'app://tester/index.html' }, { type: 'background_page', url: 'https://x' }]).ok).toBe(true);
    const bad = judge([{ type: 'page', url: 'https://example.com/' }]);
    expect(bad.ok).toBe(false);
    expect(bad.final).toBe(true);
    expect(judge([{ type: 'page', url: 'app://tester.evil.test/' }]).ok).toBe(false);
  });

  const dir = mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
  const stand = (body: string) => {
    const f = path.join(dir, 'fake-' + Math.random().toString(36).slice(2) + '.js');
    writeFileSync(f, '#!/usr/bin/env node\n' + body, { mode: 0o755 });
    return f;
  };
  const server = (targets: string) => `const p=Number(process.argv.find(a=>a.startsWith('--remote-debugging-port=')).split('=')[1]);
require('http').createServer((q,r)=>{r.end(JSON.stringify(${targets}));}).listen(p,'127.0.0.1');`;

  itPosix('reports success for a program that shows the app\'s screen', async () => {
    const r = await run(stand(server("[{type:'page',url:'app://tester/index.html',title:'Biomaterials Tensile Tester'}]")), 19333, 10);
    expect(r.ok).toBe(true);
  }, 20_000);
  itPosix('reports failure for a program that shows another page', async () => {
    const r = await run(stand(server("[{type:'page',url:'https://example.com/'}]")), 19334, 10);
    expect(r.ok).toBe(false);
  }, 20_000);
  itPosix('reports failure for a program that exits at once', async () => {
    const r = await run(stand('process.exit(3)'), 19335, 10);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('exited early');
  }, 20_000);
});
