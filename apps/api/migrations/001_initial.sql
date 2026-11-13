-- First database layout. Migrations only ever add: an older app or API container keeps working against a newer
-- database. Never edit a migration that has been applied; add a new numbered file instead.

create table users (
  id            bigserial primary key,
  username      text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{1,39}$'),
  display_name  text not null default '',
  password_hash text not null,
  role          text not null check (role in ('admin', 'user')),
  disabled      boolean not null default false,
  must_change_password boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Signed-in browsers. Only a hash of the token is stored.
create table login_sessions (
  token_hash   bytea primary key,
  user_id      bigint not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index login_sessions_user on login_sessions (user_id);

-- Documented connection and measurement settings: the conditioning circuit for each channel.
-- A profile cannot enable motion or skip a check; it only describes the circuit.
create table device_profiles (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  name        text not null,
  channels    jsonb not null,
  notes       text not null default '',
  created_by  bigint references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Acquisition devices that have identified themselves to the app (by their hello message).
create table devices (
  device_id     text primary key,
  device_type   text not null,
  last_software text not null default '',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

-- Volts at the machine's output to newtons or millimetres, with the whole signal path it was made with.
-- Only calibrations of real equipment are kept here; the simulator's made-up records never are.
create table calibrations (
  id           text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
  profile_id   text not null references device_profiles (id),
  quantity     text not null check (quantity in ('force', 'displacement')),
  unit         text not null check (unit in ('N', 'mm')),
  slope        double precision not null,
  offset_value double precision not null,
  signal_path  jsonb not null,
  origin       text not null check (origin = 'measured'),
  status       text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  note         text not null default '',
  created_by   bigint references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  approved_by  bigint references users (id) on delete set null,
  approved_at  timestamptz,
  check ((quantity = 'force' and unit = 'N') or (quantity = 'displacement' and unit = 'mm'))
);

-- One recorded test. The facts here are read from the session file by the server, not taken from the browser.
create table test_sessions (
  id              bigserial primary key,
  owner_id        bigint not null references users (id),
  test_type       text not null check (test_type in ('uniaxial', 'relaxation')),
  recorded_from   text not null check (recorded_from in ('real', 'simulated')),
  material        text not null default '',
  specimen_id     text not null default '',
  device_id       text not null default '',
  device_type     text not null default '',
  device_software text not null default '',
  protocol        text not null default '',
  app_version     text not null default '',
  calibration_ids text[] not null default '{}',
  sample_count    integer not null default 0,
  started_at      timestamptz,
  summary         jsonb not null default '{}',
  notes           text not null default '',
  created_at      timestamptz not null default now()
);
create index test_sessions_owner on test_sessions (owner_id, created_at desc);

-- The session file itself (every protocol line as received), compressed. Replayable in the app.
create table session_files (
  session_id     bigint primary key references test_sessions (id) on delete cascade,
  format_version integer not null,
  gzip           bytea not null,
  sha256         text not null,
  bytes_raw      integer not null
);

create table audit_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  user_id  bigint references users (id) on delete set null,
  action   text not null,
  detail   jsonb not null default '{}'
);
