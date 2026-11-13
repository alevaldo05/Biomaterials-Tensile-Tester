/* The database connection and the migrations. Migrations are numbered .sql files in ../migrations, applied once each,
   in order, inside a transaction, by whichever API container gets the lock first. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type Db = pg.Pool;

/* apps/api/migrations, found from src/ (tests), dist/ (the built server), or dist/assets/ (bundled code); MIGRATIONS_DIR overrides. */
const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  || [path.resolve(here, '../migrations'), path.resolve(here, '../../migrations')].find((d) => fs.existsSync(path.join(d, '001_initial.sql')))
  || path.resolve(here, '../migrations');

export function connect(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000 });
  /* A database restart must not stop the API: idle connections that fail are dropped and replaced. */
  pool.on('error', () => undefined);
  return pool;
}

export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query('select pg_advisory_lock(746573)');
    await client.query('create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await client.query<{ version: string }>('select version from schema_migrations')).rows.map((r) => r.version));
    const files = fs.readdirSync(dir).filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      await client.query('begin');
      try {
        await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await client.query('insert into schema_migrations (version) values ($1)', [f]);
        await client.query('commit');
        applied.push(f);
      } catch (e) {
        await client.query('rollback');
        throw new Error('Migration ' + f + ' failed: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock(746573)').catch(() => undefined);
    client.release();
  }
  return applied;
}
