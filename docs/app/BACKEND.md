# Back end and database

Status: implemented and tested against a real PostgreSQL 16 (throwaway servers started by the tests), and run in containers ([CONTAINERS.md](CONTAINERS.md)). Not yet used on the lab computer.

One back end serves both front ends. The tester app uses it for signing in, saved tests, device profiles, and calibrations. The website stays a static site on GitHub Pages and works without it; a public page cannot reach a back end on a lab or home computer.

**Recording never depends on the back end.** USB stays in the browser. If the API or the database is down or being updated, a test still records and can be downloaded; only signing in, history, saving to the lab, and admin wait.

## What is stored

| Table | Holds |
|---|---|
| `users` | Username, display name, role (`admin` or `user`), argon2id password hash, disabled, must-change-password |
| `login_sessions` | Signed-in browsers: a SHA-256 hash of the token, never the token itself; expiry |
| `device_profiles` | The reviewed conditioning circuit for each channel (gain, offset). Never overwritten: a changed circuit gets a new id |
| `calibrations` | Volts at the machine output to N or mm, with the whole signal path it was made with. Real equipment only. Draft → approved → retired; never overwritten |
| `devices` | Acquisition devices that identified themselves in saved real tests |
| `test_sessions` | One row per saved test. Its facts (device, sample count, calibrations) are read from the session file by the server |
| `test_sessions.calibration_source` | `lab`, `not-from-lab`, `none`, or `unchecked` (saved before migration `003_calibration_source.sql`) |
| `test_methods` | Shared test methods (saved setups). Every change, archiving included, adds a row with the next revision; rows are never changed (migration `002_test_methods.sql`) |
| `session_files` | The session file itself (every protocol line as received), compressed. It can be replayed in the app |
| `audit_log` | Sign-ins, failed sign-ins, people and calibration changes, saved tests. No passwords |

Migrations (`apps/api/migrations/NNN_name.sql`) only ever add, so an older app or API keeps working against a newer database. An applied migration is never edited.

## Roles

| | User | Admin |
|---|---|---|
| Sign in, change own password | yes | yes |
| Save a test, see own saved tests, download and replay them | yes | yes |
| See everyone's saved tests | no | yes |
| Load a device profile and its approved calibrations | yes | yes |
| Add people, change roles, disable, reset passwords | no | yes |
| Add device profiles and calibrations; approve and retire calibrations | no | yes |
| Read the record of changes | no | yes |

The server checks the role on every request. **View as user** in the app only changes what the admin's screen shows; it does not change what the server allows. The last active admin cannot remove their own admin role or disable themself.

A profile or calibration cannot enable machine motion: the app has no machine control at all.

## API

All under `/api/v1`, JSON. Changes (POST, PATCH) must carry the header `x-tensile-client: app`; together with a `SameSite=Strict`, `HttpOnly` cookie limited to `/api`, this stops another web site from acting with a signed-in person's cookie.

| Method and path | Who | Does |
|---|---|---|
| `GET /health` | anyone | `{ ok, database: "up" or "down" }` |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password` | | Sign in (5 failures in 15 minutes pause sign-in for that name or address), sign out, who am I, change password (signs out your other browsers) |
| `GET /users`, `POST /users`, `PATCH /users/:id` | admin | People |
| `GET /device-profiles` · `POST /device-profiles` | signed in · admin | Profiles |
| `GET /calibrations` · `POST /calibrations`, `POST /calibrations/:id/approve`, `POST /calibrations/:id/retire` | signed in · admin | Calibrations |
| `GET /methods` · `POST /methods`, `POST /methods/:key/archive` | signed in · admin | Shared test methods (current revisions only). Fields are limited to the setup's own names (material, temperature, environment, dimensions, speed, hold, offset yield); a specimen ID, notes, or any other name is refused. A change names the revision it was made from and is refused (409) if someone changed the method since |
| `GET /setup-files/:profileId` | signed in | A profile with its approved calibrations, in the app's setup-file shape |
| `POST /test-sessions`, `GET /test-sessions`, `GET /test-sessions/:id`, `GET /test-sessions/:id/file` | signed in | Save a test, list (own; admins all, `?owner=`), details, the session file. Someone else's test answers "not found". A save is refused when the file is marked simulated, a line is not a protocol-1 message a device sends, or there is not one arrival time per line. The calibration is labeled, never refused: lab-approved (every calibration in the file is approved here with the same numbers), not from the lab, or none |
| `GET /audit` | admin | The last 200 entries |

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | (required) | For example `postgres://tester:<password>@db:5432/tester`. Keep it out of the repository |
| `PORT`, `HOST` | `3000`, `0.0.0.0` | Where the API listens |
| `COOKIE_SECURE` | `true` | Send the login cookie only over HTTPS. Set `false` only for plain `http://localhost` |
| `SESSION_HOURS` | `12` | How long a sign-in lasts |
| `TRUST_PROXY` | `false` | `true` behind the gateway, so sign-in limits use the real address |
| `BODY_LIMIT_MB` | `64` | Largest upload (a long test's session file) |

## Running it on your computer (without containers)

Needs Node 22 and a PostgreSQL database you can reach.

```bash
npm install
```

```bash
npm run build -w @tensile/api
```

```bash
DATABASE_URL=postgres://tester:<password>@localhost:5432/tester COOKIE_SECURE=false npm run start -w @tensile/api
```

Create the first admin (asks for the password without showing it):

```bash
DATABASE_URL=postgres://tester:<password>@localhost:5432/tester node apps/api/dist/cli.js create-admin <username>
```

Then start the app (`npm run app`); its development server passes `/api` to `http://localhost:3000`.

## Moving to the lab computer

See [CONTAINERS.md](CONTAINERS.md): copy `deploy/.env` and a backup, start the containers, restore. Nothing in the code names a computer.

## Not done yet

- HTTPS on the lab network. Web Serial needs `localhost` or HTTPS, so until HTTPS is set up the app is opened on the computer the tester is plugged into.
- The website reading from the back end (planned).
- Backups on a schedule.
