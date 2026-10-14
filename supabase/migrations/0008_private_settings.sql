-- Cartas - a content preference is nobody else's business
--
-- `profiles` is world-readable on purpose: a byline on a game and a handle a
-- friend can search for have to be. `hide_adult` was sitting in that same row,
-- so anyone could read whether a given person hides adult games. That is a
-- personal preference, not a public fact.
--
-- It moves to its own table, readable and writable only by its owner. While it
-- was public it was also unused by the app; it is wired up now (the search drops
-- 18+ games when it is on), because a setting that does nothing is worse than no
-- setting.

create table profile_settings (
  profile_id uuid primary key references profiles (id) on delete cascade,
  hide_adult boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into profile_settings (profile_id, hide_adult)
select id, hide_adult from profiles
on conflict (profile_id) do nothing;

alter table profiles drop column hide_adult;

grant select, insert, update, delete on profile_settings to authenticated;
grant select on profile_settings to anon;

alter table profile_settings enable row level security;

create policy profile_settings_own on profile_settings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create trigger profile_settings_touch before update on profile_settings
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- games_playable_for is gone
--
-- It answered "what can we play with the decks I own", and nothing called it.
-- The app is local-first: that question gets asked at a table, often with no
-- signal, so it is answered on the device from the deck inventory it already
-- holds, with no round trip. A tested, documented function with no caller is
-- still dead code.
-- ---------------------------------------------------------------------------

drop function if exists games_playable_for(uuid, int, boolean, boolean);
