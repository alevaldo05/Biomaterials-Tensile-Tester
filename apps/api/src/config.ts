/* Settings come from environment variables, so the same container runs on your computer and on the lab computer.
   Secrets (the database password) are part of DATABASE_URL and are never written into the repository. */
export interface Config {
  databaseUrl: string;
  host: string;
  port: number;
  /** Send the login cookie only over HTTPS. Turn off only for plain http://localhost use. */
  cookieSecure: boolean;
  sessionHours: number;
  /** Believe X-Forwarded-For from the gateway in front of the API. */
  trustProxy: boolean;
  bodyLimitBytes: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (for example postgres://tester:password@db:5432/tester).');
  const num = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return {
    databaseUrl: url,
    host: env.HOST || '0.0.0.0',
    port: num(env.PORT, 3000),
    cookieSecure: env.COOKIE_SECURE !== 'false',
    sessionHours: num(env.SESSION_HOURS, 12),
    trustProxy: env.TRUST_PROXY === 'true',
    bodyLimitBytes: num(env.BODY_LIMIT_MB, 64) * 1024 * 1024,
  };
}
