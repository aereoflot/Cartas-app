# Schema tests

`./supabase/tests/run.sh` applies every file in `supabase/migrations/` to a throwaway local
Postgres and asserts the schema behaves: RLS keeps an author from publishing their own game,
counters stay correct across users, friendship gates sharing, `games_playable_for` respects deck
copies and missing cards. No Docker, no sudo, no Supabase project — it downloads a prebuilt
Postgres into `~/.cache/cartas-pgtest/` on first run (outside the repo: OneDrive should not sync 100 MB of binaries).

Run it after any change to a migration.

- `auth_stub.sql` — a local stand-in for what Supabase provides (`auth.users`, `auth.uid()`, the
  `anon` / `authenticated` / `service_role` roles). **Not** a project migration; Supabase ships
  these itself.
- `apply.py` — applies .sql files, splitting statements without breaking `$$ … $$` bodies.
- `schema_test.py` — the assertions. `must_fail` treats "affected zero rows" as denied, because
  that is how RLS rejects an `UPDATE`: silently, not with an error.

Two bugs it caught on the first run, both invisible without a second user in the test:

1. The counter triggers (`rating_avg`, `favorite_count`, `deck_count_total`) ran as the calling
   user, so RLS hid other people's rows and silently blocked the write to a game they don't own.
   Every counter stayed at zero. They are `security definer` now.
2. Revoking `insert` on `game_reviews` from `authenticated` also blocked the owner's own in-app
   approval — the main review path. The log is append-only via `revoke update, delete` plus an
   insert policy requiring `is_reviewer()`.
