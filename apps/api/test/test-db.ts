/* A throwaway PostgreSQL server for the API tests: a new data folder, a free port, removed afterwards.
   Needs the PostgreSQL server programs (initdb, pg_ctl). When run as root they run as the "postgres" user. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function findBin(): string | null {
  const base = '/usr/lib/postgresql';
  const fromPath = (() => { try { return path.dirname(execFileSync('which', ['initdb'], { encoding: 'utf8' }).trim()); } catch { return null; } })();
  if (fromPath) return fromPath;
  if (!fs.existsSync(base)) return null;
  const v = fs.readdirSync(base).sort().reverse().find((d) => fs.existsSync(path.join(base, d, 'bin/initdb')));
  return v ? path.join(base, v, 'bin') : null;
}
export const PG_BIN = findBin();

async function freePort(): Promise<number> {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => resolve(p)); }); });
}

export interface TestDb {
  url: string;
  /** Stops the server for good and removes its folder. */
  stop: () => void;
  /** Stops and starts the same server, to test what the API does while the database restarts. */
  pause: () => void;
  resume: () => void;
}

export async function startTestDb(): Promise<TestDb> {
  if (!PG_BIN) throw new Error('PostgreSQL server programs not found.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tensile-pg-')), port = await freePort();
  const asRoot = process.getuid?.() === 0;
  const run = (bin: string, args: string[]) => (asRoot
    ? execFileSync('runuser', ['-u', 'postgres', '--', path.join(PG_BIN as string, bin), ...args], { stdio: 'pipe' })
    : execFileSync(path.join(PG_BIN as string, bin), args, { stdio: 'pipe' }));
  if (asRoot) execFileSync('chown', ['postgres', dir]);
  run('initdb', ['-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'tester', '--no-sync']);
  run('pg_ctl', ['-D', path.join(dir, 'data'), '-w', '-l', path.join(dir, 'log'), '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']);
  const data = path.join(dir, 'data'), opts = `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`;
  return {
    url: `postgres://tester@127.0.0.1:${port}/postgres`,
    pause: () => run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']),
    resume: () => run('pg_ctl', ['-D', data, '-w', '-l', path.join(dir, 'log'), '-o', opts, 'start']),
    stop: () => {
      try { run('pg_ctl', ['-D', path.join(dir, 'data'), '-m', 'immediate', '-w', 'stop']); } catch { /* already stopped */ }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

