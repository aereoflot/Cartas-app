-- Cartas - the device owns updated_at on matches
--
-- Matches are written at a table, offline, and synced afterwards, so the client
-- is the only thing that knows when a match really changed. The generic
-- touch_updated_at trigger overwrote that with now() on every upsert, which made
-- the server copy always look newer and would have let a stale phone win every
-- conflict.
--
-- Inserts still get now() from the column default; an update must carry the
-- timestamp the device stamped.

drop trigger if exists matches_touch on matches;

comment on column matches.updated_at is
  'Set by the device, not by a trigger: matches sync from offline, so the client is the only thing that knows when one changed.';
