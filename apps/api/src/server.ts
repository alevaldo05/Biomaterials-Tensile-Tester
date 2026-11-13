/* Starts the API. It listens at once, so the gateway and the app can see it is alive, and keeps trying the database
   until it answers; until then /api/v1/health says the database is down. */
import { buildApp } from './app';
import { readConfig } from './config';
import { connect, migrate } from './db';

const config = readConfig();
const db = connect(config.databaseUrl);
const app = buildApp({ db, config, logger: true });

async function migrateWhenReady(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const done = await migrate(db);
      app.log.info(done.length ? 'Applied migrations: ' + done.join(', ') : 'Database is up to date.');
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/^Migration /.test(msg)) { app.log.error(msg); process.exit(1); }
      app.log.warn('Database not reachable yet (attempt ' + attempt + '): ' + msg);
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * attempt)));
    }
  }
}

await app.listen({ host: config.host, port: config.port });
void migrateWhenReady();
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { void app.close().then(() => db.end()).then(() => process.exit(0)); });
