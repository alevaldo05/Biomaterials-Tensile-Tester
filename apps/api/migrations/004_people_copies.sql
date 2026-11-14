-- Copies of the people list of a lab computer's Windows app (apps/desktop/people.cjs), so a second lab computer can
-- use the same Admin, Operator and Student accounts. Each copy is the whole list as one document, kept as sent: the
-- passwords in it are scrypt hashes made on the lab computer, never the passwords themselves. Only an admin of this
-- server may save or read a copy. These accounts are separate from this server's own users. Only adds; changes nothing.
create table people_copies (
  id bigserial primary key,
  people jsonb not null,
  person_count integer not null,
  created_by bigint not null references users(id),
  created_at timestamptz not null default now()
);
