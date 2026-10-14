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
