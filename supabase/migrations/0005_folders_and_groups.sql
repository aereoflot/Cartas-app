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
