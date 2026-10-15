-- Cartas - publishing is a one-way door
--
-- Until now a published game was just the author's row with `status =
-- 'published'`, which meant the author could take it off the shelf twice over:
-- by saving it privately (status back to draft) and by editing it (status back
-- to pending_review while it waited). Both are the same bug seen from two
-- sides — people playing a game they found last week open the app and it is
-- gone, because somebody else is rewriting a sentence in it.
--
-- Publishing it is accepting that it is in the app. So the approved game is
-- frozen here, as its own row, and that is what the public catalogue reads.
-- The author's row goes back to being what it always was: their working copy,
-- theirs to edit, hide, or abandon half-written, with no audience.
--
--   author edits a published game  -> their row goes to pending_review, this
--                                     snapshot does not move, readers see the
--                                     approved version
--   author saves it privately      -> their row goes private, this snapshot
--                                     does not move
--   reviewer approves              -> this snapshot is replaced, version + 1
--   reviewer takes it down         -> this row is deleted, and only a reviewer
--                                     can do that
--
-- The payload is the game in exactly the shape the catalogue query returns, so
-- the app keeps one mapper (`mapGame`) for both paths and this table needs no
-- schema of its own for a nested deck or a second language. The counters stay
-- on `games` and are read live: a frozen rating would stop counting the day it
-- was approved.

create table game_versions (
  game_id     uuid primary key references games (id) on delete cascade,
  -- the public URL. Unique here, not just on `games`: two snapshots claiming
  -- one address would make "which game is this" a question with two answers.
  slug        text not null unique,
  version     int  not null default 1 check (version > 0),
  payload     jsonb not null check (jsonb_typeof(payload) = 'object'),
  approved_at timestamptz not null default now(),
  approved_by uuid references profiles (id) on delete set null
);

create index game_versions_approved_idx on game_versions (approved_at desc);

grant select on game_versions to anon, authenticated;
grant insert, update, delete on game_versions to authenticated;

alter table game_versions enable row level security;

-- A published game is public, full stop: that is what being published means,
-- and the row's existence is the only condition.
create policy game_versions_read on game_versions for select to anon, authenticated
  using (true);

-- Only a reviewer publishes, republishes or takes down. An author cannot write
-- here at all, which is what makes the door one-way.
create policy game_versions_write on game_versions for all to authenticated
  using (is_reviewer()) with check (is_reviewer());

-- ---------------------------------------------------------------------------
-- Backfill: the nine games already published, frozen as they stand
--
-- Without this the catalogue would be empty the moment the app starts reading
-- snapshots. Built with the same column names the query uses, so one mapper
-- reads both.
-- ---------------------------------------------------------------------------

insert into game_versions (game_id, slug, version, payload, approved_at, approved_by)
select
  g.id,
  g.slug,
  1,
  jsonb_build_object(
    'players_min', g.players_min,
    'players_max', g.players_max,
    'players_best', g.players_best,
    'supports_teams', g.supports_teams,
    'team_size', g.team_size,
    'deck_count_total', g.deck_count_total,
    'missing_cards_policy', g.missing_cards_policy,
    'missing_cards_note', g.missing_cards_note,
    'duration_min', g.duration_min,
    'duration_max', g.duration_max,
    'complexity', g.complexity,
    'age_min', g.age_min,
    'requires_extras', g.requires_extras,
    'mechanics', g.mechanics,
    'adult_only', g.adult_only,
    'primary_locale', g.primary_locale,
    'author', (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name)
        from profiles p where p.id = g.author_id
    ),
    'texts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'locale', t.locale, 'title', t.title, 'tagline', t.tagline,
               'summary', t.summary, 'sections', t.sections))
        from game_texts t where t.game_id = g.id
    ), '[]'::jsonb),
    'decks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'quantity', gd.quantity,
               'cards_removed', gd.cards_removed,
               'note', gd.note,
               'deck', jsonb_build_object(
                 'slug', d.slug, 'name', d.name, 'card_count', d.card_count)))
        from game_decks gd join decks d on d.id = gd.deck_id
       where gd.game_id = g.id
    ), '[]'::jsonb)
  ),
  coalesce(g.published_at, g.created_at),
  g.reviewed_by
from games g
where g.status = 'published'
on conflict (game_id) do nothing;

comment on table game_versions is
  'The approved, public version of a game. Written only by reviewers. The '
  'author''s own row in `games` is their working copy and may be edited or '
  'hidden without affecting what readers see.';
