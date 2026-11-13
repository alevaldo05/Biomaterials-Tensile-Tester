# Containers: running the whole system on one computer

Status: the images were built and run here in Docker 29; the website, app, and API were used through the gateway in Chromium, and each service was stopped, restarted, or replaced while the others kept working. Not yet tried on your computer or the lab computer, or on Windows (Docker Desktop).

## The parts

| Service | Image | What it does | Depends on |
|---|---|---|---|
| `gateway` | `tensile/gateway` (nginx) | The one address you open. `/` → website, `/app/` → tester app, `/api/` → back end | nothing; it answers "being restarted" for a part that is down |
| `web` | `tensile/web` (nginx) | The website, built exactly as for GitHub Pages | nothing |
| `app` | `tensile/app` (nginx) | The tester app, lab edition | nothing (it records without the back end) |
| `api` | `tensile/api` (Node) | The back end | the database, but it starts without it and keeps trying |
| `db` | `postgres:16-alpine` | The database, in the `db-data` volume | nothing |
| `backup` | `postgres:16-alpine` (same image) | Saves the database to `deploy/backups` on a schedule | nothing; a failed backup is logged and retried at the next interval |

Each has its own image, version, and health check, and none waits for another to start. USB stays in the browser: no container talks to the tester or the acquisition board.

The files are in `deploy/`: `compose.yml`, one `Dockerfile` per service, the gateway's `nginx.conf`, `.env.example`, `backup.sh` (a backup by hand), `backup/loop.sh` (the scheduled backups), and `make-cert.sh` (HTTPS).

## First start

Needs Docker (Docker Desktop on Windows or Mac).

```bash
cd deploy
```

```bash
cp .env.example .env
```

Edit `.env` and set `POSTGRES_PASSWORD` to a long random password. `.env` is never committed.

```bash
docker compose up -d --build
```

Create the first admin (it asks for the password without showing it):

```bash
docker compose exec api node dist/cli.js create-admin <username>
```

Open <http://localhost:8080/app/> for the app and <http://localhost:8080/> for the website. Use `localhost` on the computer the tester is plugged into: Chrome allows USB (Web Serial) only on `localhost` or HTTPS.

## Updating one part without touching the others

Rebuild and replace only that service:

```bash
docker compose up -d --no-deps --build api
```

The same works for `app`, `web`, and `gateway`. While one part is replaced, the others keep running: the website and the app stay open, and a test in progress keeps recording, because recording happens in the browser.

When images come from a registry instead of being built here, set the version in `.env` (for example `API_VERSION=0.2.0`), then:

```bash
docker compose pull api
```

```bash
docker compose up -d --no-deps api
```

Database changes only ever add, so a newer API can be put in front of the same database, and an older app keeps working with it. Make a backup before updating the API.

## Backups

The `backup` service saves the database by itself. Five minutes after start, and then every `BACKUP_INTERVAL_HOURS` (default 24), it writes `deploy/backups/tester-YYYY-MM-DD_HHMMSS.dump` (kept out of Git). It writes to a temporary name and renames the file when it is complete, so a half-written file is never taken for a backup. It keeps the newest `BACKUP_KEEP` (default 14) and deletes older files that match that name pattern, never anything else. Each backup or failure is one plain line in `docker compose logs backup`. If the database is not up yet, the failure is logged and tried again at the next interval; the other services are not affected. The three settings and `BACKUP_FIRST_DELAY_SECONDS` are in `.env.example`.

For a backup by hand (it uses the same file names, so it counts toward the newest `BACKUP_KEEP` too):

```bash
./backup.sh
```

Copy the `backups` folder to another disk or computer now and then: backups next to the database protect against mistakes, not against losing the computer.

To restore, with the system running:

```bash
docker compose exec -T db pg_restore -U tester -d tester --clean --if-exists < backups/<file>.dump
```

Stopping or removing the containers keeps the data. `docker compose down -v` deletes it.

## HTTPS

Chrome allows USB (Web Serial) only on `localhost` or HTTPS, so other computers on the lab network need HTTPS. The gateway serves HTTPS only when `deploy/certs/cert.pem` and `deploy/certs/key.pem` exist; without them it is plain HTTP exactly as before. `deploy/certs/` is ignored by Git and by image builds, so no certificate or key is ever committed or copied into an image.

Make a self-signed certificate for the names and addresses people will type (run in `deploy/`):

```bash
./make-cert.sh lab-pc lab-pc.local 192.168.1.20
```

On Linux, run it before the first `docker compose up` (otherwise Docker creates an empty `certs` folder owned by root, and you must remove it first). It writes `certs/cert.pem` and `certs/key.pem` (mode 600), valid 825 days, and refuses to replace existing files unless you add `--force`. Then restart the gateway:

```bash
docker compose up -d --no-deps gateway
```

HTTP stays on `HTTP_PORT` (8080) and HTTPS is on `HTTPS_PORT` (8443), both on `BIND_ADDRESS`. To open the system to the lab network set `BIND_ADDRESS=0.0.0.0` (or the computer's address) in `.env`. HTTP is not redirected, so nothing that works now breaks; HSTS is left off on purpose, so a self-signed certificate cannot lock anyone out. TLS 1.2 and 1.3 are accepted.

A self-signed certificate is not trusted by browsers until each computer is told to trust it. On Windows, double-click `cert.pem` (copy it as `cert.crt` first), choose Install Certificate, Current User, "Place all certificates in the following store", and pick "Trusted Root Certification Authorities"; then restart Chrome. Or ask the lab's IT for a certificate for the computer's name and save it as `cert.pem` and `key.pem`.

When everyone uses HTTPS, set `COOKIE_SECURE=true` in `.env` and run `docker compose up -d --no-deps api`. Do not set it while people still use plain `http://` addresses other than `localhost`, because they could not log in.

Status: HTTPS and the backup service were run with Docker 29 on Linux with a self-signed certificate, checked with `curl`. Not tried with a browser, on Windows, or with a certificate from IT.

## Moving to the lab computer

1. Install Docker there and copy the repository (or just the `deploy/` folder once images are published).
2. Copy `.env` (or make a new one with the same `POSTGRES_PASSWORD`) and the latest backup.
3. `docker compose up -d --build`, then restore the backup as above.

Nothing in the files names a computer. By default the gateway listens only on this computer (`BIND_ADDRESS=127.0.0.1`). Opening it to the lab network needs HTTPS first (see HTTPS above, and set `COOKIE_SECURE=true`). Copy `deploy/certs` too if you keep the same certificate; it is never in Git.

## Checks

`.github/workflows/app.yml` runs on pushes to `main` and `tester-app` and on pull requests into `main`. It builds `deploy/test/Dockerfile` (all type checks and tests, with PostgreSQL and a C++ compiler), then builds and starts the containers (with a throwaway certificate), checks each part through the gateway over HTTP and HTTPS, and checks that the backup service wrote a dump that `pg_restore --list` can read. It publishes no image.

## Notes for unusual networks

On a network that inspects HTTPS with its own certificate, the image builds can be given that certificate as a build secret named `npm_ca` (for example `docker build --secret id=npm_ca,src=<certificate file> ...`). Normally it is not needed.
