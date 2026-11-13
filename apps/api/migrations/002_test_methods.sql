-- Test methods shared through the lab server: saved setups to start a test from. A change is a new revision row;
-- rows are never overwritten, so a recorded test can always name the revision it was started from.
create table test_methods (
  id           bigserial primary key,
  method_key   text not null,
  revision     integer not null check (revision >= 1),
  name         text not null check (length(name) between 1 and 120),
  test_type    text not null check (test_type in ('uniaxial', 'relaxation')),
  fields       jsonb not null default '{}',
  instructions text not null default '',
  archived     boolean not null default false,
  created_by   bigint references users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (method_key, revision)
);
create index test_methods_current on test_methods (method_key, revision desc);
