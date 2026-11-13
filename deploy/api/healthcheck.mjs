// Exits 0 when the API process answers its health address (whatever the database is doing).
try {
  const r = await fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/v1/health', { signal: AbortSignal.timeout(4000) });
  process.exit(r.status === 200 || r.status === 503 ? 0 : 1);
} catch {
  process.exit(1);
}
