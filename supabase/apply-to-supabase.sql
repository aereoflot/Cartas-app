-- ===========================================================================
--  Cartas - montar la base de datos entera
--
--  Pegar TODO este fichero en el SQL Editor de Supabase y pulsar Run:
--  https://supabase.com/dashboard/project/iqxiykqweqzsvyqahbsk/sql/new
--
--  Para un proyecto NUEVO y vacio. Crea las tablas, los permisos, los
--  mazos y los juegos. En un proyecto que ya tiene tablas fallara con
--  "already exists": en ese caso usa apply-content.sql.
--
--  Contiene:
--    0001_init.sql
--    0002_standard_decks.sql
--    0003_seed_games.sql
--    0004_match_stake.sql
--    0005_folders_and_groups.sql
--    0006_profile_search.sql
--
--  GENERADO por supabase/gen_apply.py. Todo el fichero es ASCII puro: los
--  acentos y los palos de la baraja van codificados, para que ningun
--  portapapeles ni ninguna codificacion de Windows pueda romperlos. Por eso se
--  lee raro aqui y se lee bien en la app.
-- ===========================================================================


-- ======================= 0001_init.sql =======================

-- Cartas - initial schema
-- Mirrors docs/data-model.md. Order matters: tables, then functions that read them,
-- then triggers and policies.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type deck_kind            as enum ('standard', 'variant', 'custom');
create type visibility           as enum ('public', 'friends', 'private');
create type game_status          as enum ('draft', 'pending_review', 'published',
                                          'rejected', 'archived');
create type missing_cards_policy as enum ('strict', 'tolerant', 'irrelevant');
create type friendship_status    as enum ('pending', 'accepted', 'blocked');
create type report_status        as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type profile_role         as enum ('user', 'moderator', 'owner');
create type review_decision      as enum ('approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     citext not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text   not null check (char_length(display_name) between 1 and 60),
  avatar_url   text,
  bio          text   check (char_length(bio) <= 400),
  locale       text   not null default 'es' check (locale in ('es', 'en')),
  role         profile_role not null default 'user',
  hide_adult   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- exactly one owner account
create unique index profiles_single_owner_idx on profiles ((role)) where role = 'owner';

-- ---------------------------------------------------------------------------
-- Decks
-- ---------------------------------------------------------------------------

create table decks (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name           text not null,
  name_i18n      jsonb not null default '{}'::jsonb,
  description    text,
  kind           deck_kind not null,
  parent_deck_id uuid references decks (id) on delete set null,
  author_id      uuid references profiles (id) on delete set null,
  visibility     visibility not null default 'public',
  suits          jsonb not null default '[]'::jsonb check (jsonb_typeof(suits)  = 'array'),
  ranks          jsonb not null default '[]'::jsonb check (jsonb_typeof(ranks)  = 'array'),
  extras         jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array'),
  card_count     int  not null check (card_count between 1 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint variant_has_parent check (kind <> 'variant' or parent_deck_id is not null),
  constraint standard_has_no_author check (kind <> 'standard' or author_id is null)
);

create index decks_parent_idx on decks (parent_deck_id);
create index decks_author_idx on decks (author_id);
create index decks_kind_idx   on decks (kind, visibility);

create table user_decks (
  profile_id    uuid not null references profiles (id) on delete cascade,
  deck_id       uuid not null references decks (id) on delete cascade,
  copies        int  not null default 1 check (copies between 1 and 20),
  missing_cards jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_cards) = 'array'),
  note          text,
  created_at    timestamptz not null default now(),
  primary key (profile_id, deck_id)
);

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------

create table games (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  author_id            uuid references profiles (id) on delete set null,
  fork_of_id           uuid references games (id) on delete set null,
  status               game_status not null default 'draft',
  visibility           visibility  not null default 'public',
  listed               boolean     not null default true,
  primary_locale       text not null default 'es' check (primary_locale in ('es', 'en')),

  players_min          int not null check (players_min between 1 and 64),
  players_max          int not null check (players_max between 1 and 64),
  players_best         int check (players_best between 1 and 64),
  supports_teams       boolean not null default false,
  team_size            int check (team_size between 2 and 8),

  deck_count_total     int not null default 0,
  missing_cards_policy missing_cards_policy not null default 'strict',
  missing_cards_note   text,

  duration_min         int check (duration_min between 1 and 1440),
  duration_max         int check (duration_max between 1 and 1440),
  complexity           smallint check (complexity between 1 and 5),
  age_min              smallint check (age_min between 3 and 21),

  requires_extras      text[] not null default '{}',
  mechanics            text[] not null default '{}',
  adult_only           boolean not null default false,

  rating_avg           numeric(3,2) not null default 0,
  rating_count         int  not null default 0,
  favorite_count       int  not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz,
  reviewed_at          timestamptz,
  reviewed_by          uuid references profiles (id) on delete set null,
  published_at         timestamptz,

  constraint player_range   check (players_max >= players_min),
  constraint duration_range check (duration_max is null or duration_min is null
                                   or duration_max >= duration_min),
  constraint teams_need_size check (not supports_teams or team_size is not null),
  constraint best_in_range  check (players_best is null
                                   or players_best between players_min and players_max)
);

create index games_players_idx   on games (players_min, players_max);
create index games_mechanics_idx on games using gin (mechanics);
create index games_extras_idx    on games using gin (requires_extras);
create index games_browse_idx    on games (status, visibility, listed, published_at desc);
create index games_queue_idx     on games (submitted_at) where status = 'pending_review';
create index games_author_idx    on games (author_id);
create index games_fork_idx      on games (fork_of_id);

create table game_decks (
  game_id       uuid not null references games (id) on delete cascade,
  deck_id       uuid not null references decks (id) on delete restrict,
  quantity      int  not null default 1 check (quantity between 1 and 20),
  cards_removed jsonb not null default '[]'::jsonb check (jsonb_typeof(cards_removed) = 'array'),
  note          text,
  primary key (game_id, deck_id)
);

create index game_decks_deck_idx on game_decks (deck_id);

create table game_texts (
  game_id               uuid not null references games (id) on delete cascade,
  locale                text not null check (locale in ('es', 'en')),
  title                 text not null check (char_length(title) between 2 and 120),
  tagline               text check (char_length(tagline) <= 160),
  summary               text not null check (char_length(summary) between 10 and 600),
  sections              jsonb not null default '[]'::jsonb
                          check (jsonb_typeof(sections) = 'array'),
  translator_id         uuid references profiles (id) on delete set null,
  is_machine_translated boolean not null default false,
  updated_at            timestamptz not null default now(),
  search                tsvector generated always as (
                          to_tsvector(
                            case locale when 'es' then 'spanish'::regconfig
                                        else 'english'::regconfig end,
                            coalesce(title, '') || ' ' || coalesce(tagline, '') || ' ' ||
                            coalesce(summary, '')
                          )
                        ) stored,
  primary key (game_id, locale)
);

create index game_texts_search_idx on game_texts using gin (search);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);

create unique index friendships_pair_idx on friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

create table game_shares (
  id              uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles (id) on delete cascade,
  to_profile_id   uuid not null references profiles (id) on delete cascade,
  game_id         uuid not null references games (id) on delete cascade,
  message         text check (char_length(message) <= 300),
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  constraint no_self_share check (from_profile_id <> to_profile_id)
);

create index game_shares_inbox_idx on game_shares (to_profile_id, read_at, created_at desc);

create table game_favorites (
  profile_id uuid not null references profiles (id) on delete cascade,
  game_id    uuid not null references games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, game_id)
);

create table deck_favorites (
  profile_id uuid not null references profiles (id) on delete cascade,
  deck_id    uuid not null references decks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, deck_id)
);

create table game_ratings (
  profile_id uuid not null references profiles (id) on delete cascade,
  game_id    uuid not null references games (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (profile_id, game_id)
);

create table game_comments (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games (id) on delete cascade,
  author_id  uuid not null references profiles (id) on delete cascade,
  parent_id  uuid references game_comments (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index game_comments_game_idx on game_comments (game_id, created_at);

create table content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles (id) on delete set null,
  target_type text not null check (target_type in ('game', 'deck', 'comment', 'profile')),
  target_id   uuid not null,
  reason      text not null check (reason in
                ('spam', 'copyright', 'inappropriate', 'wrong-rules', 'other')),
  detail      text check (char_length(detail) <= 1000),
  status      report_status not null default 'open',
  created_at  timestamptz not null default now()
);

create index content_reports_open_idx on content_reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Review log
-- ---------------------------------------------------------------------------

create table game_reviews (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games (id) on delete cascade,
  reviewer_id uuid references profiles (id) on delete set null,
  decision    review_decision not null,
  reason      text check (char_length(reason) <= 1000),
  via         text not null default 'app' check (via in ('app', 'email')),
  created_at  timestamptz not null default now(),
  constraint rejection_needs_reason
    check (decision <> 'rejected' or (reason is not null and char_length(reason) > 0))
);

create index game_reviews_game_idx on game_reviews (game_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Matches (offline-first: id generated by the client)
-- ---------------------------------------------------------------------------

create table matches (
  id           uuid primary key,
  profile_id   uuid not null references profiles (id) on delete cascade,
  game_id      uuid not null references games (id) on delete restrict,
  player_count int not null check (player_count between 1 and 64),
  deck_ids     uuid[] not null default '{}',
  player_names jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(player_names) = 'array'),
  notes        text,
  tally        jsonb not null default '[]'::jsonb check (jsonb_typeof(tally) = 'array'),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  updated_at   timestamptz not null default now(),
  constraint match_time_order check (ended_at is null or ended_at >= started_at)
);

create index matches_history_idx on matches (profile_id, started_at desc);
create index matches_game_idx    on matches (game_id);
-- at most one unfinished match per game per person, so "Resume" is never ambiguous
create unique index matches_one_open_idx on matches (profile_id, game_id)
  where ended_at is null;

-- ---------------------------------------------------------------------------
-- AI threads
-- ---------------------------------------------------------------------------

create table ai_threads (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  game_id    uuid references games (id) on delete set null,
  mode       text not null check (mode in ('explain', 'referee', 'suggest', 'author')),
  title      text,
  created_at timestamptz not null default now()
);

create index ai_threads_profile_idx on ai_threads (profile_id, created_at desc);

create table ai_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references ai_threads (id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  model         text,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

create index ai_messages_thread_idx on ai_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and exists (
    select 1 from friendships f
     where f.status = 'accepted'
       and ((f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create or replace function is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.role in ('owner', 'moderator')
  );
$$;

create or replace function can_view_game(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from games x
     where x.id = g
       and ( x.author_id = auth.uid()
          or is_reviewer()
          or (x.status = 'published' and x.visibility = 'public')
          or (x.status = 'published' and x.visibility = 'friends'
              and are_friends(auth.uid(), x.author_id)) )
  );
$$;

create or replace function owns_game(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from games x where x.id = g and x.author_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch   before update on profiles   for each row execute function touch_updated_at();
create trigger decks_touch      before update on decks      for each row execute function touch_updated_at();
create trigger games_touch      before update on games      for each row execute function touch_updated_at();
create trigger game_texts_touch before update on game_texts for each row execute function touch_updated_at();
create trigger matches_touch    before update on matches    for each row execute function touch_updated_at();

-- deck_count_total = sum of required copies
-- security definer: this reads every user's rows and writes a game it does not own,
-- so it must run outside RLS or the counters silently stay at zero.
create or replace function sync_deck_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid := coalesce(new.game_id, old.game_id);
begin
  update games g
     set deck_count_total = coalesce(
           (select sum(quantity) from game_decks where game_id = target), 0)
   where g.id = target;
  return null;
end $$;

create trigger game_decks_count after insert or update or delete on game_decks
  for each row execute function sync_deck_count();

-- security definer: this reads every user's rows and writes a game it does not own,
-- so it must run outside RLS or the counters silently stay at zero.
create or replace function sync_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid := coalesce(new.game_id, old.game_id);
begin
  update games g
     set rating_avg   = coalesce((select round(avg(stars), 2) from game_ratings
                                   where game_id = target), 0),
         rating_count = (select count(*) from game_ratings where game_id = target)
   where g.id = target;
  return null;
end $$;

create trigger game_ratings_sync after insert or update or delete on game_ratings
  for each row execute function sync_rating();

-- security definer: this reads every user's rows and writes a game it does not own,
-- so it must run outside RLS or the counters silently stay at zero.
create or replace function sync_favorite_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid := coalesce(new.game_id, old.game_id);
begin
  update games g
     set favorite_count = (select count(*) from game_favorites where game_id = target)
   where g.id = target;
  return null;
end $$;

create trigger game_favorites_sync after insert or delete on game_favorites
  for each row execute function sync_favorite_count();

-- status timestamps. submitted_at moving is also what invalidates email review tokens.
create or replace function stamp_game_status() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending_review' then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending_review' then
      new.submitted_at := now();
    elsif new.status = 'published' then
      new.reviewed_at  := now();
      new.published_at := coalesce(new.published_at, now());
    elsif new.status = 'rejected' then
      new.reviewed_at  := now();
    end if;
  end if;
  return new;
end $$;

create trigger games_stamp_status before insert or update on games
  for each row execute function stamp_game_status();

-- a new auth user gets a profile with a unique, slug-safe username
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base      text;
  candidate text;
  n         int := 0;
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  want      text  := coalesce(meta->>'locale', 'es');
begin
  base := lower(coalesce(nullif(meta->>'username', ''),
                         nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                         'jugador'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := base || 'jugador';
  end if;
  base      := left(base, 20);
  candidate := base;

  while exists (select 1 from profiles where username = candidate) loop
    n         := n + 1;
    candidate := base || n::text;
  end loop;

  insert into profiles (id, username, display_name, locale)
  values (new.id,
          candidate,
          left(coalesce(nullif(meta->>'display_name', ''), candidate), 60),
          case when want in ('es', 'en') then want else 'es' end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- "What can we play right now"
-- ---------------------------------------------------------------------------

create or replace function games_playable_for(
  p_profile          uuid,
  p_players          int     default null,
  p_allow_incomplete boolean default false,
  p_hide_adult       boolean default false
) returns setof games
language sql stable as $$
  select g.*
    from games g
   where g.status = 'published'
     and g.visibility = 'public'
     and g.listed
     and (not p_hide_adult or not g.adult_only)
     and (p_players is null or p_players between g.players_min and g.players_max)
     and not exists (
       select 1
         from game_decks gd
         left join user_decks ud
           on ud.deck_id = gd.deck_id and ud.profile_id = p_profile
        where gd.game_id = g.id
          and (ud.deck_id is null or ud.copies < gd.quantity)
     )
     and (p_allow_incomplete or g.missing_cards_policy <> 'strict' or not exists (
       select 1
         from game_decks gd
         join user_decks ud
           on ud.deck_id = gd.deck_id and ud.profile_id = p_profile
        where gd.game_id = g.id
          and jsonb_array_length(ud.missing_cards) > 0
     ))
   order by g.rating_avg desc, g.favorite_count desc;
$$;

-- ---------------------------------------------------------------------------
-- Privilege escalation guard
--
-- RLS cannot restrict columns, so `role` is protected two ways: `authenticated`
-- is never granted UPDATE on that column (see grants below), and this trigger
-- refuses the change even if a future grant is too generous.
-- ---------------------------------------------------------------------------

create or replace function guard_profile_role() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'role changes are not allowed from the client';
  end if;
  return new;
end $$;

create trigger profiles_guard_role before update on profiles
  for each row execute function guard_profile_role();

create or replace function owns_thread(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ai_threads x where x.id = t and x.profile_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Grants. RLS decides which rows; these decide which tables and columns.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- a client may edit its own profile, but never its own role
revoke update on profiles from authenticated;
grant  update (username, display_name, avatar_url, bio, locale, hide_adult)
  on profiles to authenticated;

-- a recipient may only mark a share read
revoke update on game_shares from authenticated;
grant  update (read_at) on game_shares to authenticated;

-- the review log is append-only: a reviewer may add a decision in the app, but nobody
-- may rewrite history (the edge function uses the service role for email approvals)
revoke update, delete on game_reviews from authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table profiles        enable row level security;
alter table decks           enable row level security;
alter table user_decks      enable row level security;
alter table games           enable row level security;
alter table game_decks      enable row level security;
alter table game_texts      enable row level security;
alter table friendships     enable row level security;
alter table game_shares     enable row level security;
alter table game_favorites  enable row level security;
alter table deck_favorites  enable row level security;
alter table game_ratings    enable row level security;
alter table game_comments   enable row level security;
alter table content_reports enable row level security;
alter table game_reviews    enable row level security;
alter table matches         enable row level security;
alter table ai_threads      enable row level security;
alter table ai_messages     enable row level security;

-- profiles -------------------------------------------------------------------
create policy profiles_read on profiles for select to anon, authenticated
  using (true);
create policy profiles_insert_self on profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- decks ----------------------------------------------------------------------
create policy decks_read on decks for select to anon, authenticated
  using (visibility = 'public'
      or author_id = auth.uid()
      or is_reviewer()
      or (visibility = 'friends' and are_friends(auth.uid(), author_id)));
create policy decks_insert on decks for insert to authenticated
  with check (author_id = auth.uid() and kind in ('variant', 'custom'));
create policy decks_update on decks for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and kind in ('variant', 'custom'));
create policy decks_delete on decks for delete to authenticated
  using (author_id = auth.uid());

-- user_decks: friends can see your shelf, so "what can we play" works for a group
create policy user_decks_read on user_decks for select to authenticated
  using (profile_id = auth.uid() or are_friends(auth.uid(), profile_id));
create policy user_decks_write on user_decks for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- games ----------------------------------------------------------------------
create policy games_read on games for select to anon, authenticated
  using (author_id = auth.uid()
      or is_reviewer()
      or (status = 'published' and visibility = 'public')
      or (status = 'published' and visibility = 'friends'
          and are_friends(auth.uid(), author_id)));
-- an author may create and submit, but never publish
create policy games_insert on games for insert to authenticated
  with check (author_id = auth.uid() and status in ('draft', 'pending_review'));
create policy games_update_author on games for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and status in ('draft', 'pending_review'));
create policy games_update_reviewer on games for update to authenticated
  using (is_reviewer()) with check (is_reviewer());
create policy games_delete on games for delete to authenticated
  using (author_id = auth.uid() or is_reviewer());

-- game_decks / game_texts ----------------------------------------------------
create policy game_decks_read on game_decks for select to anon, authenticated
  using (can_view_game(game_id));
create policy game_decks_write on game_decks for all to authenticated
  using (owns_game(game_id) or is_reviewer())
  with check (owns_game(game_id) or is_reviewer());

create policy game_texts_read on game_texts for select to anon, authenticated
  using (can_view_game(game_id));
create policy game_texts_write on game_texts for all to authenticated
  using (owns_game(game_id) or is_reviewer())
  with check (owns_game(game_id) or is_reviewer());
-- anyone who can read a game may add a locale it does not have yet; the primary
-- key stops them from overwriting an existing one
create policy game_texts_translate on game_texts for insert to authenticated
  with check (can_view_game(game_id) and translator_id = auth.uid());
create policy game_texts_translator_update on game_texts for update to authenticated
  using (translator_id = auth.uid()) with check (translator_id = auth.uid());

-- friendships ----------------------------------------------------------------
create policy friendships_read on friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert on friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy friendships_respond on friendships for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status in ('accepted', 'blocked'));
create policy friendships_delete on friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- shares ---------------------------------------------------------------------
create policy game_shares_read on game_shares for select to authenticated
  using (from_profile_id = auth.uid() or to_profile_id = auth.uid());
create policy game_shares_send on game_shares for insert to authenticated
  with check (from_profile_id = auth.uid()
          and are_friends(auth.uid(), to_profile_id)
          and can_view_game(game_id));
create policy game_shares_mark_read on game_shares for update to authenticated
  using (to_profile_id = auth.uid()) with check (to_profile_id = auth.uid());
create policy game_shares_delete on game_shares for delete to authenticated
  using (from_profile_id = auth.uid() or to_profile_id = auth.uid());

-- favorites and ratings: own rows only; public totals live on games -----------
create policy game_favorites_own on game_favorites for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy deck_favorites_own on deck_favorites for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy game_ratings_own on game_ratings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- comments -------------------------------------------------------------------
create policy game_comments_read on game_comments for select to anon, authenticated
  using (can_view_game(game_id));
create policy game_comments_insert on game_comments for insert to authenticated
  with check (author_id = auth.uid() and can_view_game(game_id));
create policy game_comments_update on game_comments for update to authenticated
  using (author_id = auth.uid() or is_reviewer())
  with check (author_id = auth.uid() or is_reviewer());
create policy game_comments_delete on game_comments for delete to authenticated
  using (is_reviewer());

-- reports --------------------------------------------------------------------
create policy content_reports_read on content_reports for select to authenticated
  using (reporter_id = auth.uid() or is_reviewer());
create policy content_reports_insert on content_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy content_reports_update on content_reports for update to authenticated
  using (is_reviewer()) with check (is_reviewer());

-- review log: the author reads the reason, reviewers read everything ----------
create policy game_reviews_read on game_reviews for select to authenticated
  using (is_reviewer() or owns_game(game_id));
create policy game_reviews_insert on game_reviews for insert to authenticated
  with check (is_reviewer() and reviewer_id = auth.uid());

-- matches --------------------------------------------------------------------
create policy matches_own on matches for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- AI -------------------------------------------------------------------------
create policy ai_threads_own on ai_threads for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy ai_messages_own on ai_messages for all to authenticated
  using (owns_thread(thread_id)) with check (owns_thread(thread_id));

-- ======================= 0002_standard_decks.sql =======================

-- Cartas - seeded standard decks
--
-- GENERADO por supabase/gen_decks.py. No editar a mano.
-- card_count se calcula (palos x figuras(copias) + aparte), nunca se escribe a mano.
-- A rank may carry "copies" (default 1) because an Uno-style deck has two of each
-- number per colour; "extras" are cards that belong to no suit (jokers, major arcana).
-- Author-less by design: `standard_has_no_author` keeps these out of any user's name.
--
-- Re-runnable: "on conflict do update" means running this again repairs rows that
-- were written wrong (see supabase/sqlgen.py), keeping each deck's id and so every
-- foreign key pointing at it.
--
-- Pure ASCII on purpose: accents and card suits travel as JSON unicode escapes
-- inside jsonb and as base64 for plain text, so no clipboard or codepage can
-- corrupt them.

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000001-0000-4000-8000-000000000001', 'espanola-40', convert_from(decode('QmFyYWphIGVzcGHDsW9sYSAoNDAp','base64'),'UTF8'),
        '{"en":"Spanish deck (40)"}'::jsonb,
        convert_from(decode('TGEgYmFyYWphIGRlIDQwIGNhcnRhczogZGVsIGFzIGFsIHNpZXRlIG3DoXMgc290YSwgY2FiYWxsbyB5IHJleS4gTGEgZGUgbXVzLCB0dXRlLCBicmlzY2EgeSBndWnDsW90ZS4=','base64'),'UTF8'),
        'standard', null, 'public',
        '[{"key":"oros","name":"Oros","name_i18n":{"en":"Coins"},"symbol":"O","color":"gold"},{"key":"copas","name":"Copas","name_i18n":{"en":"Cups"},"symbol":"C","color":"red"},{"key":"espadas","name":"Espadas","name_i18n":{"en":"Swords"},"symbol":"E","color":"blue"},{"key":"bastos","name":"Bastos","name_i18n":{"en":"Clubs"},"symbol":"B","color":"green"}]'::jsonb,
        '[{"key":"1","label":"As","label_i18n":{"en":"Ace"},"value":1,"order":1},{"key":"2","label":"Dos","label_i18n":{"en":"Two"},"value":2,"order":2},{"key":"3","label":"Tres","label_i18n":{"en":"Three"},"value":3,"order":3},{"key":"4","label":"Cuatro","label_i18n":{"en":"Four"},"value":4,"order":4},{"key":"5","label":"Cinco","label_i18n":{"en":"Five"},"value":5,"order":5},{"key":"6","label":"Seis","label_i18n":{"en":"Six"},"value":6,"order":6},{"key":"7","label":"Siete","label_i18n":{"en":"Seven"},"value":7,"order":7},{"key":"10","label":"Sota","label_i18n":{"en":"Jack"},"value":10,"order":8},{"key":"11","label":"Caballo","label_i18n":{"en":"Knight"},"value":11,"order":9},{"key":"12","label":"Rey","label_i18n":{"en":"King"},"value":12,"order":10}]'::jsonb,
        '[]'::jsonb,
        40)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000002-0000-4000-8000-000000000002', 'espanola-48', convert_from(decode('QmFyYWphIGVzcGHDsW9sYSAoNDgp','base64'),'UTF8'),
        '{"en":"Spanish deck (48)"}'::jsonb,
        convert_from(decode('TGEgZXNwYcOxb2xhIGNvbXBsZXRhLCBjb24gbG9zIG9jaG9zIHkgbG9zIG51ZXZlcy4gTmVjZXNhcmlhIHBhcmEgZWwgdHV0ZSBjYWJyw7NuIHkgYWxndW5hcyB2YXJpYW50ZXMgcmVnaW9uYWxlcy4=','base64'),'UTF8'),
        'standard', null, 'public',
        '[{"key":"oros","name":"Oros","name_i18n":{"en":"Coins"},"symbol":"O","color":"gold"},{"key":"copas","name":"Copas","name_i18n":{"en":"Cups"},"symbol":"C","color":"red"},{"key":"espadas","name":"Espadas","name_i18n":{"en":"Swords"},"symbol":"E","color":"blue"},{"key":"bastos","name":"Bastos","name_i18n":{"en":"Clubs"},"symbol":"B","color":"green"}]'::jsonb,
        '[{"key":"1","label":"As","label_i18n":{"en":"Ace"},"value":1,"order":1},{"key":"2","label":"Dos","label_i18n":{"en":"Two"},"value":2,"order":2},{"key":"3","label":"Tres","label_i18n":{"en":"Three"},"value":3,"order":3},{"key":"4","label":"Cuatro","label_i18n":{"en":"Four"},"value":4,"order":4},{"key":"5","label":"Cinco","label_i18n":{"en":"Five"},"value":5,"order":5},{"key":"6","label":"Seis","label_i18n":{"en":"Six"},"value":6,"order":6},{"key":"7","label":"Siete","label_i18n":{"en":"Seven"},"value":7,"order":7},{"key":"8","label":"Ocho","label_i18n":{"en":"Eight"},"value":8,"order":8},{"key":"9","label":"Nueve","label_i18n":{"en":"Nine"},"value":9,"order":9},{"key":"10","label":"Sota","label_i18n":{"en":"Jack"},"value":10,"order":10},{"key":"11","label":"Caballo","label_i18n":{"en":"Knight"},"value":11,"order":11},{"key":"12","label":"Rey","label_i18n":{"en":"King"},"value":12,"order":12}]'::jsonb,
        '[]'::jsonb,
        48)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000003-0000-4000-8000-000000000003', 'francesa-52', 'Baraja francesa (52)',
        '{"en":"French deck (52)"}'::jsonb,
        convert_from(decode('TGFzIGNhcnRhcyBkZSBww7NrZXI6IHRyZWNlIGZpZ3VyYXMgZW4gY3VhdHJvIHBhbG9zLCBzaW4gY29tb2RpbmVzLg==','base64'),'UTF8'),
        'standard', null, 'public',
        '[{"key":"treboles","name":"Tr\u00e9boles","name_i18n":{"en":"Clubs"},"symbol":"\u2663","color":"black"},{"key":"diamantes","name":"Diamantes","name_i18n":{"en":"Diamonds"},"symbol":"\u2666","color":"red"},{"key":"corazones","name":"Corazones","name_i18n":{"en":"Hearts"},"symbol":"\u2665","color":"red"},{"key":"picas","name":"Picas","name_i18n":{"en":"Spades"},"symbol":"\u2660","color":"black"}]'::jsonb,
        '[{"key":"a","label":"As","label_i18n":{"en":"Ace"},"value":1,"order":1},{"key":"2","label":"2","label_i18n":{"en":"2"},"value":2,"order":2},{"key":"3","label":"3","label_i18n":{"en":"3"},"value":3,"order":3},{"key":"4","label":"4","label_i18n":{"en":"4"},"value":4,"order":4},{"key":"5","label":"5","label_i18n":{"en":"5"},"value":5,"order":5},{"key":"6","label":"6","label_i18n":{"en":"6"},"value":6,"order":6},{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":7},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":8},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":9},{"key":"10","label":"10","label_i18n":{"en":"10"},"value":10,"order":10},{"key":"j","label":"J","label_i18n":{"en":"Jack"},"value":11,"order":11},{"key":"q","label":"Q","label_i18n":{"en":"Queen"},"value":12,"order":12},{"key":"k","label":"K","label_i18n":{"en":"King"},"value":13,"order":13}]'::jsonb,
        '[]'::jsonb,
        52)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000004-0000-4000-8000-000000000004', 'francesa-54', 'Baraja francesa con comodines (54)',
        '{"en":"French deck with jokers (54)"}'::jsonb,
        convert_from(decode('TGEgZnJhbmNlc2EgZGUgNTIgbcOhcyBsb3MgZG9zIGNvbW9kaW5lcy4gUGFyYSBjYW5hc3RhLCBydW1teSB5IGN1YWxxdWllciBqdWVnbyBxdWUgbG9zIHVzZS4=','base64'),'UTF8'),
        'variant', 'd0000003-0000-4000-8000-000000000003', 'public',
        '[{"key":"treboles","name":"Tr\u00e9boles","name_i18n":{"en":"Clubs"},"symbol":"\u2663","color":"black"},{"key":"diamantes","name":"Diamantes","name_i18n":{"en":"Diamonds"},"symbol":"\u2666","color":"red"},{"key":"corazones","name":"Corazones","name_i18n":{"en":"Hearts"},"symbol":"\u2665","color":"red"},{"key":"picas","name":"Picas","name_i18n":{"en":"Spades"},"symbol":"\u2660","color":"black"}]'::jsonb,
        '[{"key":"a","label":"As","label_i18n":{"en":"Ace"},"value":1,"order":1},{"key":"2","label":"2","label_i18n":{"en":"2"},"value":2,"order":2},{"key":"3","label":"3","label_i18n":{"en":"3"},"value":3,"order":3},{"key":"4","label":"4","label_i18n":{"en":"4"},"value":4,"order":4},{"key":"5","label":"5","label_i18n":{"en":"5"},"value":5,"order":5},{"key":"6","label":"6","label_i18n":{"en":"6"},"value":6,"order":6},{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":7},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":8},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":9},{"key":"10","label":"10","label_i18n":{"en":"10"},"value":10,"order":10},{"key":"j","label":"J","label_i18n":{"en":"Jack"},"value":11,"order":11},{"key":"q","label":"Q","label_i18n":{"en":"Queen"},"value":12,"order":12},{"key":"k","label":"K","label_i18n":{"en":"King"},"value":13,"order":13}]'::jsonb,
        '[{"key":"comodin","label":"Comod\u00edn","label_i18n":{"en":"Joker"},"count":2}]'::jsonb,
        54)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000005-0000-4000-8000-000000000005', 'francesa-32', 'Baraja francesa corta (32)',
        '{"en":"French deck, short (32)"}'::jsonb,
        'La francesa sin el 2 al 6: del siete al as. La de la belote y el skat con palos franceses.',
        'variant', 'd0000003-0000-4000-8000-000000000003', 'public',
        '[{"key":"treboles","name":"Tr\u00e9boles","name_i18n":{"en":"Clubs"},"symbol":"\u2663","color":"black"},{"key":"diamantes","name":"Diamantes","name_i18n":{"en":"Diamonds"},"symbol":"\u2666","color":"red"},{"key":"corazones","name":"Corazones","name_i18n":{"en":"Hearts"},"symbol":"\u2665","color":"red"},{"key":"picas","name":"Picas","name_i18n":{"en":"Spades"},"symbol":"\u2660","color":"black"}]'::jsonb,
        '[{"key":"a","label":"As","label_i18n":{"en":"Ace"},"value":1,"order":1},{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":7},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":8},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":9},{"key":"10","label":"10","label_i18n":{"en":"10"},"value":10,"order":10},{"key":"j","label":"J","label_i18n":{"en":"Jack"},"value":11,"order":11},{"key":"q","label":"Q","label_i18n":{"en":"Queen"},"value":12,"order":12},{"key":"k","label":"K","label_i18n":{"en":"King"},"value":13,"order":13}]'::jsonb,
        '[]'::jsonb,
        32)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000006-0000-4000-8000-000000000006', 'alemana-32', 'Baraja alemana (32)',
        '{"en":"German deck (32)"}'::jsonb,
        'Bellotas, hojas, corazones y cascabeles, del siete al as. La del skat y el schafkopf.',
        'standard', null, 'public',
        '[{"key":"bellotas","name":"Bellotas","name_i18n":{"en":"Acorns"},"symbol":"B","color":"brown"},{"key":"hojas","name":"Hojas","name_i18n":{"en":"Leaves"},"symbol":"H","color":"green"},{"key":"corazones","name":"Corazones","name_i18n":{"en":"Hearts"},"symbol":"\u2665","color":"red"},{"key":"cascabeles","name":"Cascabeles","name_i18n":{"en":"Bells"},"symbol":"K","color":"gold"}]'::jsonb,
        '[{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":1},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":2},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":3},{"key":"10","label":"10","label_i18n":{"en":"10"},"value":10,"order":4},{"key":"unter","label":"Unter","label_i18n":{"en":"Under-knave"},"value":11,"order":5},{"key":"ober","label":"Ober","label_i18n":{"en":"Over-knave"},"value":12,"order":6},{"key":"koenig","label":"Rey","label_i18n":{"en":"King"},"value":13,"order":7},{"key":"as","label":"As","label_i18n":{"en":"Ace"},"value":14,"order":8}]'::jsonb,
        '[]'::jsonb,
        32)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000007-0000-4000-8000-000000000007', 'tarot-78', 'Tarot (78)',
        '{"en":"Tarot (78)"}'::jsonb,
        convert_from(decode('Q2luY3VlbnRhIHkgc2VpcyBjYXJ0YXMgZW4gY3VhdHJvIHBhbG9zIGNvbiBjdWF0cm8gZmlndXJhcywgbcOhcyBsb3MgdmVpbnRpZMOzcyBhcmNhbm9zIG1heW9yZXMu','base64'),'UTF8'),
        'standard', null, 'public',
        '[{"key":"bastos","name":"Bastos","name_i18n":{"en":"Wands"},"symbol":"B","color":"green"},{"key":"copas","name":"Copas","name_i18n":{"en":"Cups"},"symbol":"C","color":"blue"},{"key":"espadas","name":"Espadas","name_i18n":{"en":"Swords"},"symbol":"E","color":"grey"},{"key":"oros","name":"Oros","name_i18n":{"en":"Pentacles"},"symbol":"O","color":"gold"}]'::jsonb,
        '[{"key":"1","label":"1","label_i18n":{"en":"1"},"value":1,"order":1},{"key":"2","label":"2","label_i18n":{"en":"2"},"value":2,"order":2},{"key":"3","label":"3","label_i18n":{"en":"3"},"value":3,"order":3},{"key":"4","label":"4","label_i18n":{"en":"4"},"value":4,"order":4},{"key":"5","label":"5","label_i18n":{"en":"5"},"value":5,"order":5},{"key":"6","label":"6","label_i18n":{"en":"6"},"value":6,"order":6},{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":7},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":8},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":9},{"key":"10","label":"10","label_i18n":{"en":"10"},"value":10,"order":10},{"key":"sota","label":"Sota","label_i18n":{"en":"Page"},"value":11,"order":11},{"key":"caballero","label":"Caballero","label_i18n":{"en":"Knight"},"value":12,"order":12},{"key":"reina","label":"Reina","label_i18n":{"en":"Queen"},"value":13,"order":13},{"key":"rey","label":"Rey","label_i18n":{"en":"King"},"value":14,"order":14}]'::jsonb,
        '[{"key":"arcanos","label":"Arcanos mayores","label_i18n":{"en":"Major arcana"},"count":22}]'::jsonb,
        78)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ('d0000008-0000-4000-8000-000000000008', 'uno-108', 'Mazo tipo Uno (108)',
        '{"en":"Uno-style deck (108)"}'::jsonb,
        convert_from(decode('Q3VhdHJvIGNvbG9yZXMgY29uIG7Dum1lcm9zIHkgY2FydGFzIGRlIGFjY2nDs24sIG3DoXMgbG9zIGNvbW9kaW5lcy4gUGFyYSBsb3MganVlZ29zIGRlIGRlc2NhcnRlIHBvciBjb2xvciB5IG7Dum1lcm8u','base64'),'UTF8'),
        'standard', null, 'public',
        '[{"key":"rojo","name":"Rojo","name_i18n":{"en":"Red"},"symbol":"R","color":"red"},{"key":"amarillo","name":"Amarillo","name_i18n":{"en":"Yellow"},"symbol":"A","color":"yellow"},{"key":"verde","name":"Verde","name_i18n":{"en":"Green"},"symbol":"V","color":"green"},{"key":"azul","name":"Azul","name_i18n":{"en":"Blue"},"symbol":"Z","color":"blue"}]'::jsonb,
        '[{"key":"0","label":"0","label_i18n":{"en":"0"},"value":0,"order":1},{"key":"1","label":"1","label_i18n":{"en":"1"},"value":1,"order":2,"copies":2},{"key":"2","label":"2","label_i18n":{"en":"2"},"value":2,"order":3,"copies":2},{"key":"3","label":"3","label_i18n":{"en":"3"},"value":3,"order":4,"copies":2},{"key":"4","label":"4","label_i18n":{"en":"4"},"value":4,"order":5,"copies":2},{"key":"5","label":"5","label_i18n":{"en":"5"},"value":5,"order":6,"copies":2},{"key":"6","label":"6","label_i18n":{"en":"6"},"value":6,"order":7,"copies":2},{"key":"7","label":"7","label_i18n":{"en":"7"},"value":7,"order":8,"copies":2},{"key":"8","label":"8","label_i18n":{"en":"8"},"value":8,"order":9,"copies":2},{"key":"9","label":"9","label_i18n":{"en":"9"},"value":9,"order":10,"copies":2},{"key":"salta","label":"Salta","label_i18n":{"en":"Skip"},"value":20,"order":11,"copies":2},{"key":"reversa","label":"Reversa","label_i18n":{"en":"Reverse"},"value":20,"order":12,"copies":2},{"key":"roba2","label":"Roba dos","label_i18n":{"en":"Draw two"},"value":20,"order":13,"copies":2}]'::jsonb,
        '[{"key":"comodin","label":"Comod\u00edn","label_i18n":{"en":"Wild"},"count":4},{"key":"comodin4","label":"Comod\u00edn roba cuatro","label_i18n":{"en":"Wild draw four"},"count":4}]'::jsonb,
        108)
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;

-- ======================= 0003_seed_games.sql =======================

-- Cartas - catalogo inicial
--
-- GENERADO por supabase/gen_games.py desde supabase/content/games.py.
-- No editar a mano: edita el contenido y vuelve a generar.
--
-- Los juegos entran como 'published' y sin autor: son el catalogo de la casa,
-- escrito en este repositorio. Los juegos de los usuarios si pasaran por
-- 'pending_review' y por la cola de revision del dueno (docs/product-spec.md 3.8).
--
-- deck_count_total no se escribe aqui: lo mantiene el trigger al insertar en
-- game_decks.
--
-- Re-ejecutable: "on conflict do update" hace que volver a lanzarlo corrija filas
-- mal escritas (ver supabase/sqlgen.py), conservando el id de cada juego y por
-- tanto todo lo que apunte a el. No toca status/visibility/listed/published_at:
-- eso son decisiones del dueno, no contenido.
--
-- ASCII puro a proposito: los acentos viajan como escapes de JSON dentro de jsonb
-- y como base64 en el texto plano, asi que ningun portapapeles puede romperlos.
-- Por eso este fichero se lee raro y la base de datos se lee bien.

-- brisca
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '99541f53-9fa3-5cce-a049-835293c3e039', 'brisca', null, 'published', 'public', true, 'es',
  2, 4, 2,
  true, 2,
  'strict', convert_from(decode('TG9zIDEyMCBwdW50b3MgZGVwZW5kZW4gZGUgcXVlIGVzdMOpbiBsYXMgY3VhcmVudGEgY2FydGFzLiBTaSBmYWx0YSB1bmEgZmlndXJhLCBsYSBjdWVudGEgZmluYWwgZGVqYSBkZSBjdWFkcmFyLg==','base64'),'UTF8'),
  10, 20, 1, 6,
  array[]::text[], array['bazas', 'triunfo']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '99541f53-9fa3-5cce-a049-835293c3e039', 'es', 'Brisca', convert_from(decode('RWwganVlZ28gZGUgYmF6YXMgbcOhcyBmw6FjaWwgZGUgZW5zZcOxYXIgZW4gdW4gbWludXRvLg==','base64'),'UTF8'), convert_from(decode('VW4ganVlZ28gZGUgYmF6YXMgY29uIHRyaXVuZm8gcGFyYSBkb3MgYSBjdWF0cm8gcGVyc29uYXMuIFNlIHJvYmEgdW5hIGNhcnRhIGRlc3B1w6lzIGRlIGNhZGEgYmF6YSwgYXPDrSBxdWUgbGEgbWFubyBzZSByZXBvbmUgc29sYSBoYXN0YSBxdWUgc2UgYWNhYmEgZWwgbWF6by4gR2FuYSBxdWllbiByZcO6bmEgbcOhcyBwdW50b3MgZW4gY2FydGFzLg==','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Ganar bazas que contengan cartas de valor. Hay 120 puntos en la baraja; gana quien pase de 60."},{"heading":"Preparaci\u00f3n","body":"Reparte tres cartas a cada jugador. Pon el resto en el centro boca abajo y levanta la carta de arriba, medio asomada bajo el mazo: su palo es el **triunfo** durante toda la partida."},{"heading":"Valor de las cartas","body":"- As: 11 puntos\n- Tres: 10 puntos\n- Rey: 4 puntos\n- Caballo: 3 puntos\n- Sota: 2 puntos\n- Siete, seis, cinco, cuatro y dos: 0 puntos\n\nDentro de un palo, el orden de fuerza es: as, tres, rey, caballo, sota, siete, seis, cinco, cuatro, dos."},{"heading":"Desarrollo","body":"Sale el jugador a la derecha de quien reparti\u00f3. Cada uno echa una carta; no hace falta seguir el palo ni asistir. Gana la baza la carta m\u00e1s alta del palo de triunfo y, si no hay triunfos, la m\u00e1s alta del palo de salida. Quien gana la baza se la queda, roba primero y sale en la siguiente."},{"heading":"Puntuaci\u00f3n","body":"Al acabar las cartas, cada jugador suma los puntos de las cartas que ha ganado. Con 60 puntos hay empate; con m\u00e1s, victoria. Por parejas, se suman los puntos de los dos miembros."},{"heading":"Variantes","body":"- **Cambiar el siete**: quien tenga el siete del palo de triunfo puede cambiarlo por la carta de triunfo descubierta, si \u00e9sta es una figura.\n- **Por parejas**: con cuatro jugadores, los que se sientan enfrente son compa\u00f1eros."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '99541f53-9fa3-5cce-a049-835293c3e039', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- chinchon
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '4a58d480-a6b6-5599-b157-b2979e9cd30a', 'chinchon', null, 'published', 'public', true, 'es',
  2, 6, 4,
  false, null,
  'strict', 'Las escaleras necesitan que no falte ninguna carta del palo: sin el cinco de copas, media baraja deja de ligar.',
  20, 45, 2, 8,
  array[convert_from(decode('cGFwZWwgeSBsw6FwaXo=','base64'),'UTF8')]::text[], array['ligar', 'descarte']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '4a58d480-a6b6-5599-b157-b2979e9cd30a', 'es', convert_from(decode('Q2hpbmNow7Nu','base64'),'UTF8'), 'Ligar grupos y escaleras antes de que te pillen con cartas en la mano.', convert_from(decode('Q2FkYSBqdWdhZG9yIHJvYmEgeSBkZXNjYXJ0YSBidXNjYW5kbyBncnVwb3MgZGUgY2FydGFzIGlndWFsZXMgeSBlc2NhbGVyYXMgZGVsIG1pc21vIHBhbG8uIFF1aWVuIGNpZXJyYSBkZWphIGEgbG9zIGRlbcOhcyBjb24gcHVudG9zIGVuIGxhIG1hbm8sIHkgc2UganVlZ2EgaGFzdGEgcXVlIGFsZ3VpZW4gc2UgcGFzYSBkZWwgbMOtbWl0ZSBhY29yZGFkby4=','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Ligar las siete cartas de la mano en grupos y escaleras y cerrar la ronda. Los dem\u00e1s suman los puntos que les queden sin ligar; se elimina quien llegue a 100."},{"heading":"Preparaci\u00f3n","body":"Reparte siete cartas a cada jugador. El resto va al centro boca abajo y se voltea la primera para empezar el mont\u00f3n de descartes."},{"heading":"Desarrollo","body":"En tu turno robas una carta \u2014del mazo o la de arriba del descarte\u2014 y descartas otra, siempre qued\u00e1ndote con siete. Un **grupo** son tres o cuatro cartas del mismo n\u00famero; una **escalera** son tres o m\u00e1s cartas seguidas del mismo palo. En la escalera, el orden es 1-2-3-4-5-6-7-sota-caballo-rey."},{"heading":"Cerrar","body":"Puedes cortar cuando al descartar te quede todo ligado, o te quede una sola carta suelta de cinco puntos o menos. Descarta boca abajo y anuncia el corte. Un **chinch\u00f3n** \u2014las siete cartas en una escalera del mismo palo\u2014 gana la partida entera en el acto."},{"heading":"Puntuaci\u00f3n","body":"Cada jugador suma lo que le queda sin ligar: as 1 punto, del dos al siete su n\u00famero, y sota, caballo y rey 10 cada una. Quien cort\u00f3 suma 0, o -10 si cerr\u00f3 con todo ligado. Se anota por rondas hasta que alguien pasa de 100 y queda eliminado."},{"heading":"Variantes","body":"- **Con comodines**: se a\u00f1aden dos comodines que valen por cualquier carta y punt\u00faan 25 si te quedan en la mano.\n- **Reengancharse**: quien se elimina puede volver a entrar con los puntos del jugador que vaya peor, una sola vez."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '4a58d480-a6b6-5599-b157-b2979e9cd30a', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- escoba
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '306d3111-a83e-5e7d-82f6-59508701f8d6', 'escoba', null, 'published', 'public', true, 'es',
  2, 4, 2,
  true, 2,
  'strict', 'La cuenta de oros y de sietes decide la partida: si falta un oro, el recuento final no sirve.',
  15, 30, 2, 7,
  array[convert_from(decode('cGFwZWwgeSBsw6FwaXo=','base64'),'UTF8')]::text[], array['capturar', convert_from(decode('YXJpdG3DqXRpY2E=','base64'),'UTF8'), 'memoria']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '306d3111-a83e-5e7d-82f6-59508701f8d6', 'es', 'Escoba de 15', 'Sumar quince y barrer la mesa.', convert_from(decode('U2UgY2FwdHVyYW4gY2FydGFzIGRlIGxhIG1lc2Egc3VtYW5kbyBleGFjdGFtZW50ZSBxdWluY2UgY29uIHVuYSBkZSBsYSBtYW5vLiBMaW1waWFyIGxhIG1lc2EgZW50ZXJhIGVzIHVuYSBlc2NvYmEgeSB2YWxlIHVuIHB1bnRvLiBKdWVnbyBjb3J0bywgYXJpdG3DqXRpY2Egc2VuY2lsbGEgeSBtdWNoYSBtZW1vcmlhLg==','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Capturar cartas sumando quince, y en particular los oros y el siete de oros. Se juega a 21 puntos."},{"heading":"Preparaci\u00f3n","body":"Se juega con 40 cartas: si usas baraja de 48, quita los ochos y los nueves. Reparte tres cartas a cada jugador y pon cuatro boca arriba en la mesa. Si en la mesa inicial hay tres cartas que sumen quince, se vuelve a repartir."},{"heading":"Valor de las cartas","body":"As 1, dos a siete su n\u00famero, sota 8, caballo 9 y rey 10."},{"heading":"Desarrollo","body":"En tu turno echas una carta. Si con una o varias cartas de la mesa suma exactamente quince, te las llevas todas junto con la tuya. Si no suma quince, la carta se queda en la mesa. Cuando se agotan las manos se reparten tres m\u00e1s, sin a\u00f1adir cartas a la mesa, hasta acabar el mazo."},{"heading":"Escoba","body":"Si tu captura deja la mesa vac\u00eda, es **escoba**: un punto, y se anota aparte. Las cartas que queden en la mesa al final se las lleva quien hizo la \u00faltima captura."},{"heading":"Puntuaci\u00f3n","body":"Cada escoba vale 1 punto. Adem\u00e1s: 1 punto por tener m\u00e1s cartas, 1 por tener m\u00e1s oros, 1 por el siete de oros (el *velo*) y 1 por tener m\u00e1s sietes. Se juega hasta 21."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '306d3111-a83e-5e7d-82f6-59508701f8d6', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- texas-holdem
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '10f8ec2c-ac87-5a22-962d-3be9b21b9d23', 'texas-holdem', null, 'published', 'public', true, 'es',
  2, 10, 6,
  false, null,
  'strict', 'Las probabilidades que hacen justo el juego dependen de las 52 cartas exactas.',
  30, 180, 3, 18,
  array['fichas']::text[], array['apuestas', 'faroleo', 'manos']::text[],
  true, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '10f8ec2c-ac87-5a22-962d-3be9b21b9d23', 'es', convert_from(decode('UMOza2VyIFRleGFzIGhvbGTigJllbQ==','base64'),'UTF8'), 'Dos cartas tapadas, cinco en el centro, cuatro rondas de apuestas.', convert_from(decode('TGEgdmFyaWFudGUgZGUgcMOza2VyIG3DoXMganVnYWRhLiBDYWRhIGp1Z2Fkb3IgcmVjaWJlIGRvcyBjYXJ0YXMgcHJvcGlhcyB5IGNvbXBhcnRlIGNpbmNvIGNvbXVuaXRhcmlhczsgc2UgYXB1ZXN0YSBlbiBjdWF0cm8gcm9uZGFzIHkgZ2FuYSBsYSBtZWpvciBtYW5vIGRlIGNpbmNvIGNhcnRhcywgbyBxdWllbiBjb25zaWdhIHF1ZSBsb3MgZGVtw6FzIHNlIHJldGlyZW4u','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Ganar el bote, bien con la mejor combinaci\u00f3n de cinco cartas, bien haciendo que todos los dem\u00e1s abandonen la mano."},{"heading":"Preparaci\u00f3n","body":"Hacen falta fichas y un bot\u00f3n que marque qui\u00e9n reparte. Los dos jugadores a la izquierda del bot\u00f3n ponen la ciega peque\u00f1a y la ciega grande antes de ver sus cartas."},{"heading":"Desarrollo","body":"Cada jugador recibe dos cartas tapadas y se apuesta. Despu\u00e9s se descubren tres cartas comunitarias (**flop**) y se apuesta; una cuarta (**turn**) y se apuesta; una quinta (**river**) y se apuesta por \u00faltima vez. En cada ronda puedes pasar, apostar, igualar, subir o retirarte."},{"heading":"Orden de las manos","body":"De mayor a menor: escalera de color, p\u00f3ker, full, color, escalera, tr\u00edo, doble pareja, pareja, carta alta. Cada jugador forma su mejor mano de cinco cartas combinando las dos suyas con las cinco del centro."},{"heading":"Fin de la mano","body":"Si quedan dos o m\u00e1s jugadores tras la \u00faltima apuesta, se descubren las cartas y gana la mejor mano. El bot\u00f3n pasa al jugador de la izquierda y empieza otra mano."},{"heading":"Juego responsable","body":"Si se juega con dinero, acordad antes el l\u00edmite de la mesa y respetadlo. No es un juego para menores."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '10f8ec2c-ac87-5a22-962d-3be9b21b9d23', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'francesa-52'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- mus
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '0f24581c-5378-5aad-93ff-b6286de7dcef', 'mus', null, 'published', 'public', true, 'es',
  4, 4, 4,
  true, 2,
  'strict', convert_from(decode('R3JhbmRlLCBjaGljYSwgcGFyZXMgeSBqdWVnbyBzZSBjdWVudGFuIHNvYnJlIGxhcyBjdWFyZW50YSBjYXJ0YXMgZXhhY3Rhcy4gU2kgZmFsdGEgdW5hLCBsb3MgY8OhbGN1bG9zIGRlIHRvZGEgbGEgbWVzYSBkZWphbiBkZSB2YWxlci4=','base64'),'UTF8'),
  20, 60, 5, 12,
  array['fichas o garbanzos para el tanteo']::text[], array['apuestas', 'faroleo', 'parejas', convert_from(decode('c2XDsWFz','base64'),'UTF8')]::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '0f24581c-5378-5aad-93ff-b6286de7dcef', 'es', 'Mus', convert_from(decode('Q3VhdHJvIGFwdWVzdGFzLCB1bmEgcGFyZWphIHkgc2XDsWFzIHBvciBkZWJham8gZGUgbGEgbWVzYS4=','base64'),'UTF8'), convert_from(decode('RWwganVlZ28gZGUgYXB1ZXN0YXMgZXNwYcOxb2wgcG9yIGV4Y2VsZW5jaWEsIGVuIHBhcmVqYXMuIE5vIGdhbmEgbGEgbWVqb3IgbWFubywgZ2FuYSBxdWllbiBtZWpvciBhcHVlc3RhOiBzZSBwdWphIGN1YXRybyB2ZWNlcyBwb3IgbWFubyB5IHNlIHB1ZWRlIGdhbmFyIHVuIGxhbmNlIGNvbiBsYXMgcGVvcmVzIGNhcnRhcyBzaSBlbCByaXZhbCBubyB0ZSBhZ3VhbnRhLiBMb3MgY29tcGHDsWVyb3Mgc2UgYXZpc2FuIGNvbiBzZcOxYXMsIHkgZXNvIGVzIHBhcnRlIGRlbCBqdWVnby4=','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Llegar a 40 piedras antes que la pareja contraria, ganando las apuestas de los cuatro lances de cada mano. Ojo: se gana apostando, no teniendo buenas cartas."},{"heading":"Preparaci\u00f3n","body":"Cuatro jugadores en dos parejas, cada uno enfrente de su compa\u00f1ero. Baraja de 40 cartas y cuatro cartas a cada jugador. Hacen falta fichas para contar: cada ficha es una **piedra**, cinco piedras son un **amarreco** y ocho amarrecos (40 piedras) son una partida."},{"heading":"Valor de las cartas","body":"Los **tres** valen como reyes y los **dos** valen como ases. Para grande y chica el orden de fuerza es: rey (y tres), caballo, sota, siete, seis, cinco, cuatro, as (y dos).\n\nPara el lance de juego: rey, tres, caballo y sota valen 10; el siete, seis, cinco y cuatro su n\u00famero; el as y el dos valen 1."},{"heading":"El mus: cambiar cartas","body":"Antes de apostar, por turno, cada jugador dice **mus** si quiere cambiar cartas. Si los cuatro dicen mus, cada uno descarta las que quiera y roba otras tantas. Se repite mientras los cuatro acepten. En cuanto alguien dice **no hay mus**, se cortan las cartas y empiezan los lances."},{"heading":"Los cuatro lances","body":"Se juegan siempre en este orden:\n\n- **Grande**: qui\u00e9n tiene las cartas m\u00e1s altas.\n- **Chica**: qui\u00e9n tiene las cartas m\u00e1s bajas.\n- **Pares**: solo juegan quienes tengan parejas. Una pareja son *pares simples*, un tr\u00edo son *medias*, y dos parejas o cuatro cartas iguales son *duples*.\n- **Juego**: solo juegan quienes sumen 31 o m\u00e1s. El mejor juego es el 31, despu\u00e9s el 32, y luego 40, 37, 36, 35, 34 y 33. Si nadie llega a 31, se disputa el **punto**: gana la suma m\u00e1s alta por debajo de 31."},{"heading":"C\u00f3mo se apuesta","body":"En cada lance, por turno, puedes **pasar**, **envidar** (apostar dos piedras, y el rival puede subir) o cantar **\u00f3rdago** (apostar la partida entera). Si el rival no quiere la apuesta, quien apost\u00f3 se lleva una piedra y el lance se acaba ah\u00ed sin ense\u00f1ar cartas. Si la quiere, el lance se resuelve al final de la mano, al descubrir."},{"heading":"Puntuaci\u00f3n","body":"Al acabar la mano se cobran los lances ganados: grande 1 piedra, chica 1, y adem\u00e1s lo apostado. En pares se cobra seg\u00fan lo que tengas: pares simples 1, medias 2, duples 3. En juego se cobran 2, o 3 si era 31. El punto paga 1.\n\nQuien llega a 40 piedras gana la partida. Se suele jugar al mejor de tres."},{"heading":"Las se\u00f1as","body":"Los compa\u00f1eros se avisan de lo que llevan con gestos acordados: morderse el labio son duples, gui\u00f1ar un ojo son dos reyes, sacar la punta de la lengua son dos ases, levantar las cejas es juego. Hacer se\u00f1as es legal; lo que no vale es hablar. Si la pareja contraria te pilla una se\u00f1a, puede cantarla en voz alta."},{"heading":"Variantes","body":"- **A chico**: partidas a 30 piedras en vez de 40.\n- **Sin se\u00f1as**: m\u00e1s limpio y mucho m\u00e1s dif\u00edcil.\n- **Mus corrido**: no hace falta que los cuatro acepten el mus para cambiar cartas.\n- Cada zona tiene sus propias reglas de cobro: acordadlas antes de empezar."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '0f24581c-5378-5aad-93ff-b6286de7dcef', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- tute
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '4c905703-bf6b-579f-8652-b99637e9c15d', 'tute', null, 'published', 'public', true, 'es',
  2, 4, 4,
  true, 2,
  'strict', 'Se reparte la baraja entera y los cantes son parejas concretas: sin el caballo de copas, ni se reparte igual ni se puede cantar.',
  20, 40, 4, 10,
  array[convert_from(decode('cGFwZWwgeSBsw6FwaXo=','base64'),'UTF8')]::text[], array['bazas', 'triunfo', 'cantes', 'parejas']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '4c905703-bf6b-579f-8652-b99637e9c15d', 'es', 'Tute', 'Bazas con triunfo, cantes de veinte y cuarenta, y el tute que gana de golpe.', 'Se reparte toda la baraja y se juega al arrastre: hay que asistir al palo y matar si puedes. Reunir rey y caballo del mismo palo se canta y da puntos, y juntar los cuatro reyes o los cuatro caballos gana la partida en el acto.',
  '[{"heading":"Objetivo","body":"Sumar m\u00e1s puntos que el rival entre las cartas ganadas en bazas y los cantes. Hay 120 puntos en cartas m\u00e1s 10 por las diez \u00faltimas."},{"heading":"Preparaci\u00f3n","body":"Con cuatro jugadores se reparten diez cartas a cada uno, en parejas enfrentadas, y se acaba la baraja. La \u00faltima carta que se reparte quien da se muestra a todos: su palo es el **triunfo**."},{"heading":"Valor de las cartas","body":"- As: 11 puntos\n- Tres: 10\n- Rey: 4\n- Caballo: 3\n- Sota: 2\n- Siete, seis, cinco, cuatro y dos: 0\n\nEl orden de fuerza dentro de un palo es as, tres, rey, caballo, sota, siete, seis, cinco, cuatro, dos."},{"heading":"Desarrollo: el arrastre","body":"Se juega al arrastre desde la primera baza: est\u00e1s obligado a echar una carta del palo de salida y, si puedes ganar la baza, a ganarla. Si no tienes el palo, tienes que echar triunfo si te queda alguno. Si ya hay un triunfo en la mesa y puedes superarlo, debes hacerlo. Quien gana la baza sale en la siguiente."},{"heading":"Los cantes","body":"Justo despu\u00e9s de ganar una baza puedes cantar si tienes en la mano rey y caballo del mismo palo:\n\n- **Las veinte**: rey y caballo de un palo que no sea triunfo, 20 puntos.\n- **Las cuarenta**: rey y caballo del palo de triunfo, 40 puntos.\n\nSe canta en voz alta y se ense\u00f1an las dos cartas, que siguen en juego."},{"heading":"El tute","body":"Si re\u00fanes los cuatro reyes o los cuatro caballos y lo cantas, ganas la partida en ese momento, sin contar puntos."},{"heading":"Puntuaci\u00f3n","body":"Al acabar las bazas, cada bando suma el valor de sus cartas m\u00e1s sus cantes, y las diez \u00faltimas valen 10 puntos para quien gane la \u00faltima baza. Gana quien m\u00e1s sume. Lo normal es anotar varias manos y jugar a un total acordado."},{"heading":"Variantes","body":"- **Tute cabr\u00f3n** (o tute subastado): con baraja de 48 y pujando por elegir triunfo.\n- **Con robo**: se reparten menos cartas y se roba del mazo hasta agotarlo; el arrastre empieza entonces, como en el gui\u00f1ote.\n- A tres jugadores se juega cada uno por su cuenta, repartiendo trece cartas y dejando una fuera."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '4c905703-bf6b-579f-8652-b99637e9c15d', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- guinote
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  'affc9a87-8d53-54fa-bb28-7c425f8fce57', 'guinote', null, 'published', 'public', true, 'es',
  2, 4, 4,
  true, 2,
  'strict', convert_from(decode('RWwgY2FtYmlvIGRlbCBzaWV0ZSwgbG9zIGNhbnRlcyB5IGxhcyBkaWV6IMO6bHRpbWFzIGRlcGVuZGVuIGRlIGNhcnRhcyBjb25jcmV0YXM6IGxhIGJhcmFqYSB0aWVuZSBxdWUgZXN0YXIgY29tcGxldGEu','base64'),'UTF8'),
  20, 45, 3, 10,
  array[convert_from(decode('cGFwZWwgeSBsw6FwaXo=','base64'),'UTF8')]::text[], array['bazas', 'triunfo', 'cantes', 'parejas']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  'affc9a87-8d53-54fa-bb28-7c425f8fce57', 'es', convert_from(decode('R3Vpw7FvdGU=','base64'),'UTF8'), convert_from(decode('RWwgdHV0ZSBhcmFnb27DqXM6IHByaW1lcm8gcm9iYXMsIHkgY3VhbmRvIHNlIGFjYWJhIGVsIG1hem8gZW1waWV6YSBsbyBzZXJpby4=','base64'),'UTF8'), convert_from(decode('QmF6YXMgY29uIHRyaXVuZm8gZW4gZG9zIGZhc2VzLiBNaWVudHJhcyBxdWVkYSBtYXpvIHB1ZWRlcyBlY2hhciBsbyBxdWUgcXVpZXJhcyB5IHJvYmFzIGRlc3B1w6lzIGRlIGNhZGEgYmF6YTsgY3VhbmRvIHNlIGFnb3RhLCBoYXkgcXVlIGFzaXN0aXIgeSBtYXRhci4gQ29uIGxvcyBjYW50ZXMgZGUgdmVpbnRlIHkgY3VhcmVudGEgc2UgbGxlZ2EgYSAxMDEgcHVudG9zLg==','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Llegar a 101 puntos entre cartas ganadas y cantes. Se juega en parejas enfrentadas."},{"heading":"Preparaci\u00f3n","body":"Seis cartas a cada jugador. El resto va al centro boca abajo y se descubre la carta de arriba, medio asomada: su palo es el **triunfo**."},{"heading":"Valor de las cartas","body":"As 11, tres 10, rey 4, caballo 3, sota 2; el resto no vale nada. En total 120 puntos en cartas, m\u00e1s 10 por ganar la \u00faltima baza (**las diez \u00faltimas**)."},{"heading":"Primera fase: con mazo","body":"Mientras quede mazo no hay obligaci\u00f3n de asistir: puedes echar la carta que quieras. Gana la baza el triunfo m\u00e1s alto o, si no hay triunfos, la carta m\u00e1s alta del palo de salida. Quien gana roba primero y sale en la siguiente baza."},{"heading":"Segunda fase: el arrastre","body":"Cuando se agota el mazo cambian las reglas: hay que asistir al palo de salida, matar si puedes, y echar triunfo si no tienes el palo. Aqu\u00ed es donde se decide la mano, y donde hace falta haber contado las cartas."},{"heading":"Cantes y cambio del siete","body":"Despu\u00e9s de ganar una baza puedes cantar **las veinte** (rey y caballo de un palo cualquiera) o **las cuarenta** (rey y caballo del triunfo). Tambi\u00e9n puedes cambiar el siete del palo de triunfo por la carta de triunfo descubierta, si \u00e9sta es una figura."},{"heading":"Puntuaci\u00f3n","body":"Se anotan los puntos de cada mano hasta llegar a 101. Hay que **cantar las 101** en voz alta cuando crees que tu pareja las ha alcanzado: si te equivocas, la partida es para los contrarios. Por eso conviene llevar la cuenta de verdad y no a ojo."},{"heading":"Variantes","body":"- **A 201**: dos partidas seguidas.\n- **Con se\u00f1as** entre compa\u00f1eros, como en el mus.\n- **Renuncio**: si alguien no asiste debiendo hacerlo y se descubre, pierde la mano."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select 'affc9a87-8d53-54fa-bb28-7c425f8fce57', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'espanola-40'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- cuarenta
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '4b38d44a-dc4a-578f-abf8-8a2312fa316c', 'cuarenta', null, 'published', 'public', true, 'es',
  2, 4, 4,
  true, 2,
  'strict', 'El recuento final se hace sobre 40 cartas exactas (20 cartas son 6 puntos). Si falta una, el conteo no cuadra.',
  30, 60, 3, 10,
  array['fichas para los tantos y los perros']::text[], array['capturar', convert_from(decode('YXJpdG3DqXRpY2E=','base64'),'UTF8'), 'parejas', 'memoria']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '4b38d44a-dc4a-578f-abf8-8a2312fa316c', 'es', 'Cuarenta', 'El juego nacional de Ecuador: caer, ligar y contar hasta cuarenta.', convert_from(decode('U2UgY2FwdHVyYW4gY2FydGFzIGRlIGxhIG1lc2EgZW1wYXJlamFuZG8gbsO6bWVyb3MgbyBzdW3DoW5kb2xvcywgeSBsb3MgcHVudG9zIHZhbiBlbiBmaWNoYXM6IHRhbnRvcyBkZSBkb3MgeSBwZXJyb3MgZGUgZGllei4gU2UganVlZ2EgZW4gcGFyZWphcyB5IGxhIGNoaWNhIHNlIGdhbmEgYWwgbGxlZ2FyIGEgY3VhcmVudGEu','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Llegar a 40 puntos y ganar la **chica**. La partida se gana al llevarse dos chicas, o de golpe si el rival no ha llegado a 10 puntos al acabar la primera (lo que se llama *zapater\u00eda*)."},{"heading":"Preparaci\u00f3n","body":"Se juega con 40 cartas: coge la baraja francesa y quita los ochos, los nueves y los dieces. Dos o cuatro jugadores, en parejas enfrentadas. Se reparten cinco cartas a cada uno y se ponen cuatro boca arriba en la mesa.\n\nLos puntos se llevan con fichas: cada **tanto** vale 2 puntos y cada **perro** vale 10."},{"heading":"Capturar cartas","body":"En tu turno echas una carta a la mesa. Puedes llevarte cartas de dos maneras:\n\n- **Caer**: tu carta es igual a una de la mesa, y te llevas las dos.\n- **Ligar o sumar**: tu carta es igual a la suma de dos o m\u00e1s cartas de la mesa, y te llevas todas \u00e9sas junto con la tuya.\n\nSi no capturas nada, la carta se queda en la mesa."},{"heading":"Puntos durante la mano","body":"- **Ca\u00edda**: 2 puntos, si caes con una carta igual a la que acaba de echar el rival.\n- **Limpia**: 2 puntos, si tu captura deja la mesa vac\u00eda.\n- **Ronda**: 2 puntos, si al repartir te llegan tres cartas del mismo n\u00famero. Hay que pedirla antes de jugar tu primera carta."},{"heading":"Conteo al final de la mano","body":"Se cuentan las cartas que ha capturado cada pareja. Veinte cartas son 6 puntos, y cada carta de m\u00e1s a\u00f1ade punto, redondeando al par siguiente. Si ninguna pareja llega a veinte, la que tenga m\u00e1s cartas se lleva 2 puntos."},{"heading":"Variantes","body":"Las reglas de conteo cambian bastante de una zona a otra: qu\u00e9 pasa si las dos parejas llegan a veinte cartas, si existe la *doble ronda* como victoria autom\u00e1tica, o cu\u00e1ntos puntos valen las cartas de m\u00e1s. Acordadlo en la mesa antes de la primera mano y no a mitad de partida."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '4b38d44a-dc4a-578f-abf8-8a2312fa316c', d.id, 1, '["8","9","10"]'::jsonb,
       'sin los ochos, nueves y dieces: quedan 40 cartas'
  from decks d where d.slug = 'francesa-52'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- solitario-klondike
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  '1f67a40d-dc16-589d-b94c-5aaa8354e200', 'solitario-klondike', null, 'published', 'public', true, 'es',
  1, 1, 1,
  false, null,
  'strict', convert_from(decode('U2kgZmFsdGEgdW5hIGNhcnRhLCBlbCBzb2xpdGFyaW8gZXMgaW1wb3NpYmxlIGRlIHRlcm1pbmFyOiB0ZSBxdWVkYXLDoXMgc2llbXByZSBhIHVuIGh1ZWNvLg==','base64'),'UTF8'),
  5, 20, 2, 7,
  array[]::text[], array['solitario', 'ordenar']::text[],
  false, now()
)
on conflict (slug) do update set
  primary_locale = excluded.primary_locale,
  players_min = excluded.players_min, players_max = excluded.players_max,
  players_best = excluded.players_best, supports_teams = excluded.supports_teams,
  team_size = excluded.team_size,
  missing_cards_policy = excluded.missing_cards_policy,
  missing_cards_note = excluded.missing_cards_note,
  duration_min = excluded.duration_min, duration_max = excluded.duration_max,
  complexity = excluded.complexity, age_min = excluded.age_min,
  requires_extras = excluded.requires_extras, mechanics = excluded.mechanics,
  adult_only = excluded.adult_only;

insert into game_texts (game_id, locale, title, tagline, summary, sections)
values (
  '1f67a40d-dc16-589d-b94c-5aaa8354e200', 'es', 'Solitario (Klondike)', 'El de siempre: siete columnas, cuatro palos y paciencia.', convert_from(decode('RWwgc29saXRhcmlvIGNsw6FzaWNvLCBwYXJhIGp1Z2FyIHNvbG8uIFNlIG9yZGVuYW4gbGFzIGNhcnRhcyBlbiBjb2x1bW5hcyBhbHRlcm5hbmRvIGNvbG9yIHkgZW4gb3JkZW4gZGVzY2VuZGVudGUsIHBhcmEgaXIgc3ViaWVuZG8gY2FkYSBwYWxvIGRlbCBhcyBhbCByZXkuIE5vIHNpZW1wcmUgc2UgcHVlZGUgZ2FuYXIsIHkgZXNvIGVzIHBhcnRlIGRlbCBqdWVnby4=','base64'),'UTF8'),
  '[{"heading":"Objetivo","body":"Subir las 52 cartas a cuatro montones, uno por palo, empezando por el as y acabando en el rey."},{"heading":"Preparaci\u00f3n","body":"Reparte siete columnas de izquierda a derecha: la primera con una carta, la segunda con dos, y as\u00ed hasta siete. Solo la \u00faltima carta de cada columna va boca arriba. Las 24 cartas restantes quedan en la mano como **tal\u00f3n**."},{"heading":"Desarrollo","body":"Sobre una carta boca arriba puedes colocar la inmediatamente inferior de color contrario: un seis rojo va sobre un siete negro. Puedes mover una carta o un bloque entero ya ordenado. Al descubrir una carta tapada, se vuelve boca arriba. En una columna vac\u00eda solo puede empezar un rey.\n\nCuando no haya movimientos, levanta cartas del tal\u00f3n de una en una y juega la que quede arriba. Los ases suben a los montones en cuanto aparecen."},{"heading":"Fin del juego","body":"Ganas si subes las 52 cartas. Pierdes cuando no quedan movimientos posibles ni cartas \u00fatiles en el tal\u00f3n, que pasa m\u00e1s veces de las que gustar\u00eda."},{"heading":"Variantes","body":"- **De tres en tres**: se levantan tres cartas del tal\u00f3n y solo se puede jugar la de arriba. Mucho m\u00e1s dif\u00edcil.\n- **Vueltas limitadas**: solo puedes repasar el tal\u00f3n una o tres veces.\n- **Sacar del mont\u00f3n**: se permite bajar una carta ya subida para desatascar una columna."}]'::jsonb
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select '1f67a40d-dc16-589d-b94c-5aaa8354e200', d.id, 1, '[]'::jsonb,
       null
  from decks d where d.slug = 'francesa-52'
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;

-- Comprobacion: nueve juegos publicados, con sus mazos y su numero de cartas.
select g.slug, g.players_min, g.players_max, g.deck_count_total, g.complexity,
       g.missing_cards_policy, t.title
  from games g join game_texts t on t.game_id = g.id and t.locale = 'es'
 order by g.complexity, g.slug;

-- ======================= 0004_match_stake.sql =======================

-- Cartas - "what are we playing for"
--
-- An optional stake on a match: a beer, dinner, the washing up. It is a free
-- text line, not a currency amount, because that is how people actually bet at
-- a card table and because money owed is not something this app should model.
--
-- Lives on the match, not on the game: the same game is played for nothing on
-- Tuesday and for dinner on Saturday.

alter table matches add column if not exists stake text
  check (stake is null or char_length(stake) <= 120);

comment on column matches.stake is
  'Optional prize agreed at the table, in the players own words. Free text, never an amount.';

-- ======================= 0005_folders_and_groups.sql =======================

-- Cartas - deck folders, friend groups and the group chat
--
-- These three features already work in the app against local storage, which is
-- what lets them work with no account at all. This is where they land once there
-- is an account to attach them to, so they can follow someone between devices.
--
-- The important decision is in friend_group_members: a member is EITHER a real
-- account or a plain name, never both. Names are what the app can offer today;
-- accounts are what makes the group chat reach anybody. The constraint encodes
-- the transition instead of leaving a text column to rot next to a user id.

-- ---------------------------------------------------------------------------
-- Deck folders
-- ---------------------------------------------------------------------------

create table deck_folders (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, name)
);

create index deck_folders_profile_idx on deck_folders (profile_id, position);

create table deck_folder_decks (
  folder_id uuid not null references deck_folders (id) on delete cascade,
  deck_id   uuid not null references decks (id) on delete cascade,
  position  int  not null default 0,
  added_at  timestamptz not null default now(),
  primary key (folder_id, deck_id)
);

create index deck_folder_decks_deck_idx on deck_folder_decks (deck_id);

-- ---------------------------------------------------------------------------
-- Friend groups
-- ---------------------------------------------------------------------------

create table friend_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create index friend_groups_owner_idx on friend_groups (owner_id);

create table friend_group_members (
  group_id     uuid not null references friend_groups (id) on delete cascade,
  -- a real account, once both sides have one...
  profile_id   uuid references profiles (id) on delete cascade,
  -- ...or just a name written at the table until then
  display_name text check (char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now(),
  id           uuid primary key default gen_random_uuid(),
  constraint member_is_an_account_or_a_name check (
    (profile_id is not null and display_name is null)
    or (profile_id is null and display_name is not null)
  )
);

-- the same person cannot be in a group twice, by account or by name
create unique index friend_group_members_account_idx
  on friend_group_members (group_id, profile_id) where profile_id is not null;
create unique index friend_group_members_name_idx
  on friend_group_members (group_id, lower(display_name)) where display_name is not null;

create table group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references friend_groups (id) on delete cascade,
  author_id  uuid references profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index group_messages_group_idx on group_messages (group_id, created_at);

-- A match can say which group it was played with, so "our last matches" is a
-- real query rather than guesswork over the player names typed that evening.
alter table matches add column if not exists group_id uuid
  references friend_groups (id) on delete set null;

create index matches_group_idx on matches (group_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function owns_folder(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from deck_folders x where x.id = f and x.profile_id = auth.uid()
  );
$$;

-- the owner, or anyone in it by account: those are the people a group is for
create or replace function in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friend_groups x where x.id = g and x.owner_id = auth.uid())
      or exists (select 1 from friend_group_members m
                  where m.group_id = g and m.profile_id = auth.uid());
$$;

create or replace function owns_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friend_groups x where x.id = g and x.owner_id = auth.uid());
$$;

-- Matches played with a group, newest first.
create or replace function matches_for_group(p_group uuid)
returns setof matches
language sql stable as $$
  select m.* from matches m
   where m.group_id = p_group and in_group(p_group)
   order by m.started_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Grants and row level security
-- ---------------------------------------------------------------------------

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on deck_folders, deck_folder_decks, friend_groups,
  friend_group_members, group_messages to authenticated;

-- a message is a record of what was said: editable by nobody
revoke update on group_messages from authenticated;

alter table deck_folders         enable row level security;
alter table deck_folder_decks    enable row level security;
alter table friend_groups        enable row level security;
alter table friend_group_members enable row level security;
alter table group_messages       enable row level security;

create policy deck_folders_own on deck_folders for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy deck_folder_decks_own on deck_folder_decks for all to authenticated
  using (owns_folder(folder_id)) with check (owns_folder(folder_id));

create policy friend_groups_read on friend_groups for select to authenticated
  using (in_group(id));
create policy friend_groups_insert on friend_groups for insert to authenticated
  with check (owner_id = auth.uid());
create policy friend_groups_write on friend_groups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy friend_groups_delete on friend_groups for delete to authenticated
  using (owner_id = auth.uid());

create policy group_members_read on friend_group_members for select to authenticated
  using (in_group(group_id));
-- only the person who made the group changes who is in it
create policy group_members_write on friend_group_members for all to authenticated
  using (owns_group(group_id)) with check (owns_group(group_id));

create policy group_messages_read on group_messages for select to authenticated
  using (in_group(group_id));
create policy group_messages_insert on group_messages for insert to authenticated
  with check (in_group(group_id) and author_id = auth.uid());
create policy group_messages_delete on group_messages for delete to authenticated
  using (author_id = auth.uid() or owns_group(group_id));

-- ======================= 0006_profile_search.sql =======================

-- Cartas - find people by their name, not by their email
--
-- A profile already had a username, but it was derived from the email local
-- part ("ancorodrigezortega") and nothing let anyone change it. Two things
-- happen here:
--
--   1. the username becomes something you pick, searchable as you type
--   2. searching never exposes an email, because profiles do not hold one:
--      emails live in auth.users, which the client cannot read at all
--
-- Asking for someone's email to add them as a friend is also a privacy leak in
-- the other direction - it tells you whether an address has an account. A
-- handle you chose to publish does not.

create extension if not exists pg_trgm;

-- trigram indexes: "as you type" search over a few thousand profiles without a
-- full scan each keystroke
create index profiles_username_trgm_idx
  on profiles using gin ((username::text) gin_trgm_ops);
create index profiles_display_name_trgm_idx
  on profiles using gin (display_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

-- Escape the LIKE wildcards in what the user typed, so a search for "100%"
-- looks for that text instead of matching everything.
create or replace function like_escape(q text) returns text
language sql immutable as $$
  select replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
$$;

/*
 * Profiles matching `q`, with how you stand with each one:
 *
 *   none      no relationship
 *   outgoing  you asked them
 *   incoming  they asked you
 *   friends   accepted
 *   blocked   one of you blocked the other
 *
 * The friendships join runs under RLS, so it can only ever see rows where the
 * caller is one of the two parties - the link is yours, not anyone else's.
 * Shorter than two characters returns nothing, so this cannot be used to list
 * the whole directory with an empty search.
 */
create or replace function search_profiles(q text, max_rows int default 20)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  link         text
)
language sql stable as $$
  select p.id,
         p.username::text,
         p.display_name,
         p.avatar_url,
         case
           when f.id is null              then 'none'
           when f.status = 'accepted'     then 'friends'
           when f.status = 'blocked'      then 'blocked'
           when f.requester_id = auth.uid() then 'outgoing'
           else 'incoming'
         end
    from profiles p
    left join friendships f
      on (f.requester_id = auth.uid() and f.addressee_id = p.id)
      or (f.addressee_id = auth.uid() and f.requester_id = p.id)
   where char_length(coalesce(q, '')) >= 2
     and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (p.username::text ilike '%' || like_escape(q) || '%'
       or p.display_name   ilike '%' || like_escape(q) || '%')
   order by (p.username::text ilike like_escape(q) || '%') desc, p.username::text
   limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

/*
 * Everyone you are connected to, in one call: accepted friends and the requests
 * waiting in both directions. The client needs all three to draw the screen, and
 * doing it in SQL keeps the three states consistent with each other.
 */
create or replace function my_friends()
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  link         text,
  since        timestamptz
)
language sql stable as $$
  select p.id,
         p.username::text,
         p.display_name,
         p.avatar_url,
         case
           when f.status = 'accepted'       then 'friends'
           when f.status = 'blocked'        then 'blocked'
           when f.requester_id = auth.uid() then 'outgoing'
           else 'incoming'
         end,
         coalesce(f.responded_at, f.created_at)
    from friendships f
    join profiles p
      on p.id = case when f.requester_id = auth.uid() then f.addressee_id
                     else f.requester_id end
   where auth.uid() in (f.requester_id, f.addressee_id)
   order by (f.status = 'accepted') desc, p.username::text;
$$;
