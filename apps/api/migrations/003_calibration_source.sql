-- Where a saved test's calibration came from, checked by the server when the test is saved:
-- 'lab' (every calibration in the file is approved on this server with the same numbers),
-- 'not-from-lab' (at least one is unknown here, not approved, or has different numbers), or 'none' (voltages only).
-- Tests saved before this migration are 'unchecked'.
alter table test_sessions add column calibration_source text not null default 'unchecked'
  check (calibration_source in ('lab', 'not-from-lab', 'none', 'unchecked'));
