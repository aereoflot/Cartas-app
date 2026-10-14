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
