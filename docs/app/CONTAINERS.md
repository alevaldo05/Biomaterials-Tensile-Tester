# Containers: running the whole system on one computer

Status: the five images were built and run here in Docker 29; the website, app, and API were used through the gateway in Chromium, and each service was stopped, restarted, or replaced while the others kept working. Not yet tried on your computer or the lab computer, or on Windows (Docker Desktop).

## The parts

| Service | Image | What it does | Depends on |
|---|---|---|---|
| `gateway` | `tensile/gateway` (nginx) | The one address you open. `/` → website, `/app/` → tester app, `/api/` → back end | nothing; it answers "being restarted" for a part that is down |
| `web` | `tensile/web` (nginx) | The website, built exactly as for GitHub Pages | nothing |
| `app` | `tensile/app` (nginx) | The tester app, lab edition | nothing (it records without the back end) |
| `api` | `tensile/api` (Node) | The back end | the database, but it starts without it and keeps trying |
| `db` | `postgres:16-alpine` | The database, in the `db-data` volume | nothing |

Each has its own image, version, and health check, and none waits for another to start. USB stays in the browser: no container talks to the tester or the acquisition board.

The files are in `deploy/`: `compose.yml`, one `Dockerfile` per service, the gateway's `nginx.conf`, `.env.example`, and `backup.sh`.

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

```bash
./backup.sh
```

This writes `deploy/backups/tester-<date>.dump` (kept out of Git). To restore, with the system running:

```bash
docker compose exec -T db pg_restore -U tester -d tester --clean --if-exists < backups/<file>.dump
```

Stopping or removing the containers keeps the data. `docker compose down -v` deletes it.

## Moving to the lab computer

1. Install Docker there and copy the repository (or just the `deploy/` folder once images are published).
2. Copy `.env` (or make a new one with the same `POSTGRES_PASSWORD`) and the latest backup.
3. `docker compose up -d --build`, then restore the backup as above.

Nothing in the files names a computer. By default the gateway listens only on this computer (`BIND_ADDRESS=127.0.0.1`). Opening it to the lab network needs HTTPS first (and `COOKIE_SECURE=true`); that is not set up yet.

## Checks

`.github/workflows/app.yml` runs on pushes to `main` and `tester-app` and on pull requests into `main`. It builds `deploy/test/Dockerfile` (all type checks and tests, with PostgreSQL and a C++ compiler), then builds and starts the containers and checks each part through the gateway. It publishes no image.

## Notes for unusual networks

On a network that inspects HTTPS with its own certificate, the image builds can be given that certificate as a build secret named `npm_ca` (for example `docker build --secret id=npm_ca,src=<certificate file> ...`). Normally it is not needed.
