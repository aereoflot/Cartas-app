#!/usr/bin/env python3
"""Exercise the app's write paths against the real project, safely.

    python3 supabase/live_check.py

Everything happens as a **throwaway account** created at the start and deleted at
the end, so this cannot touch anybody's real rows. That rule exists because an
earlier version of this check cleaned up with "delete ... where profile_id = me"
against the owner's own profile, and deleted a favourite and a folder that the
owner had actually created. Deleting the temp account cascades, so the cleanup
needs no deletes of its own.
"""
import importlib.util
import pathlib
import sys
import uuid

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("cartas_migrate", HERE / "migrate.py")
assert spec is not None and spec.loader is not None
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if condition else 'FAIL'}  {label}{f'  {detail}' if detail else ''}")
    if not condition:
        failures.append(label)


def main() -> None:
    con = migrate.connect(migrate.read_env())
    email = f"live-check-{uuid.uuid4().hex[:8]}@example.invalid"
    friend_email = f"live-friend-{uuid.uuid4().hex[:8]}@example.invalid"
    group_id = str(uuid.uuid4())
    match_id = str(uuid.uuid4())
    game_id = str(uuid.uuid4())
    game_slug = f"live-check-{uuid.uuid4().hex[:8]}"

    before = con.run("select count(*) from profiles")[0][0]
    games_before = con.run("select count(*) from games")[0][0]
    con.run("insert into auth.users (id, email, raw_user_meta_data) "
            "values (gen_random_uuid(), :e, '{}'::jsonb)", e=email)
    me = con.run("select id from auth.users where email = :e", e=email)[0][0]

    def as_me() -> None:
        con.run("reset role")
        con.run("select set_config('request.jwt.claim.sub', :u, false)", u=str(me))
        con.run("set role authenticated")

    def as_friend() -> None:
        con.run("reset role")
        con.run("select set_config('request.jwt.claim.sub', :u, false)", u=str(friend))
        con.run("set role authenticated")

    try:
        print(f"\nthrowaway account {email}\n")
        as_me()

        print("favourites")
        for slug in ("mus", "brisca"):
            con.run("""insert into game_favorites (profile_id, game_id)
                       select :p, id from games where slug = :s""", p=me, s=slug)
        starred = [r[0] for r in con.run(
            """select g.slug from game_favorites f join games g on g.id = f.game_id
                where f.profile_id = :p order by g.slug""", p=me)]
        check("two games can be starred", starred == ["brisca", "mus"], str(starred))

        # the replace the app does on every change: delete what is no longer there
        keep = con.run("select id from games where slug = 'mus'")[0][0]
        con.run("delete from game_favorites where profile_id = :p and game_id <> :k",
                p=me, k=keep)
        left = [r[0] for r in con.run(
            """select g.slug from game_favorites f join games g on g.id = f.game_id
                where f.profile_id = :p""", p=me)]
        check("unstarring removes only that one", left == ["mus"], str(left))

        print("\nfolders")
        con.run("""insert into deck_folders (profile_id, name, position)
                   values (:p, 'los del bar', 0)""", p=me)
        folder = con.run("select id from deck_folders where profile_id = :p", p=me)[0][0]
        for slug in ("espanola-40", "francesa-52"):
            con.run("""insert into deck_folder_decks (folder_id, deck_id)
                       select :f, id from decks where slug = :s""", f=folder, s=slug)
        held = con.run("""select count(*) from deck_folder_decks where folder_id = :f""",
                       f=folder)[0][0]
        check("a folder holds decks", held == 2, f"{held} decks")

        con.run("""insert into deck_folders (profile_id, name, position) values (:p, 'viaje', 1)
                   on conflict (profile_id, name) do update set position = 1""", p=me)
        check("a second folder can be added",
              con.run("select count(*) from deck_folders where profile_id = :p", p=me)[0][0] == 2)

        print("\ngroups with a real friend in them")
        con.run("reset role")
        con.run("insert into auth.users (id, email, raw_user_meta_data) "
                "values (gen_random_uuid(), :e, '{}'::jsonb)", e=friend_email)
        friend = con.run("select id from auth.users where email = :e", e=friend_email)[0][0]
        con.run("insert into friendships (requester_id, addressee_id, status, responded_at) "
                "values (:a, :b, 'accepted', now())", a=me, b=friend)

        as_me()
        con.run("insert into friend_groups (id, owner_id, name) values (:g, :p, 'Los del bar')",
                g=group_id, p=me)
        con.run("insert into friend_group_members (group_id, profile_id) values (:g, :f)",
                g=group_id, f=friend)
        con.run("insert into friend_group_members (group_id, display_name) "
                "values (:g, 'Marta')", g=group_id)
        members = con.run("""select coalesce(p.display_name, m.display_name),
                                    m.profile_id is not null
                               from friend_group_members m
                               left join profiles p on p.id = m.profile_id
                              where m.group_id = :g order by 2 desc""", g=group_id)
        check("a group holds an account and a plain name", len(members) == 2, str(members))

        as_friend()
        check("the friend sees the group they are in",
              con.run("select count(*) from friend_groups where id = :g", g=group_id)[0][0] == 1)
        con.run("insert into group_messages (group_id, author_id, body) "
                "values (:g, :f, 'yo llevo las cartas')", g=group_id, f=friend)
        as_me()
        said = con.run("select body from group_messages where group_id = :g", g=group_id)
        check("a message from the friend reaches the owner", said == [['yo llevo las cartas']],
              str(said))

        as_friend()
        before_kick = con.run("select count(*) from friend_group_members where group_id = :g",
                              g=group_id)[0][0]
        con.run("delete from friend_group_members where group_id = :g", g=group_id)
        after_kick = con.run("select count(*) from friend_group_members where group_id = :g",
                             g=group_id)[0][0]
        check("a member cannot rewrite the membership", before_kick == after_kick,
              f"{before_kick} -> {after_kick}")

        print("\nmatch history")
        as_me()
        stamp = "2026-10-14T10:00:00+00:00"
        con.run("""insert into matches (id, profile_id, game_id, player_count, notes,
                                       started_at, updated_at)
                   values (:m, :p, (select id from games where slug = 'mus'), 4, 'Ana 11',
                           :s, :s)""", m=match_id, p=me, s=stamp)
        kept = con.run("select updated_at from matches where id = :m", m=match_id)[0][0]
        check("the device's updated_at survives an insert",
              kept.isoformat().startswith("2026-10-14T10:00"), str(kept))

        # the upsert the app does when a match changes
        later = "2026-10-14T11:00:00+00:00"
        con.run("""insert into matches (id, profile_id, game_id, player_count, notes,
                                       started_at, updated_at)
                   values (:m, :p, (select id from games where slug = 'mus'), 4,
                           'Ana 11 - Luis 7', :s, :l)
                   on conflict (id) do update set notes = excluded.notes,
                                                  updated_at = excluded.updated_at""",
                m=match_id, p=me, s=stamp, l=later)
        row = con.run("select notes, updated_at from matches where id = :m", m=match_id)[0]
        check("an upsert updates the match and keeps the device's timestamp",
              row[0] == "Ana 11 - Luis 7" and row[1].isoformat().startswith("2026-10-14T11:00"),
              str(row))

        print("\ndeck inventory and private settings")
        as_me()
        con.run("""insert into user_decks (profile_id, deck_id)
                   select :p, id from decks where slug = 'espanola-40'""", p=me)
        owned = [r[0] for r in con.run("""select d.slug from user_decks u
                                            join decks d on d.id = u.deck_id
                                           where u.profile_id = :p""", p=me)]
        check("a deck can be marked as owned", owned == ['espanola-40'], str(owned))

        con.run("""insert into profile_settings (profile_id, hide_adult) values (:p, true)
                   on conflict (profile_id) do update set hide_adult = true""", p=me)
        check("the hide-18+ setting saves",
              con.run("select hide_adult from profile_settings where profile_id = :p",
                      p=me)[0][0] is True)

        print("\nreview queue")
        con.run("reset role")
        # the friend account doubles as a moderator here; only one *owner* is allowed,
        # moderators are not limited, and the real owner is never touched
        con.run("update profiles set role = 'moderator' where id = :f", f=friend)

        as_me()
        con.run("""insert into games (id, slug, author_id, status, players_min, players_max,
                                      missing_cards_policy)
                   values (:g, :s, :p, 'pending_review', 2, 4, 'strict')""",
                g=game_id, s=game_slug, p=me)
        con.run("""insert into game_texts (game_id, locale, title, summary)
                   values (:g, 'es', 'Juego de prueba',
                           'Un juego enviado por la comprobacion en vivo.')""", g=game_id)
        check("an author can submit a game for review",
              con.run("select status from games where id = :g", g=game_id)[0][0]
              == 'pending_review')

        con.run("reset role")
        con.run("select set_config('request.jwt.claim.sub', "
                "'99999999-9999-9999-9999-999999999999', false)")
        con.run("set role authenticated")
        check("a stranger cannot see a game awaiting review",
              con.run("select count(*) from games where id = :g", g=game_id)[0][0] == 0)

        as_friend()
        check("a moderator sees the queue",
              con.run("select count(*) from games where status = 'pending_review'")[0][0] >= 1)

        try:
            con.run("""insert into game_reviews (game_id, reviewer_id, decision)
                       values (:g, :f, 'rejected')""", g=game_id, f=friend)
            refused = False
        except Exception:
            refused = True
        check("a rejection with no reason is refused", refused)

        con.run("update games set status = 'published', reviewed_by = :f where id = :g",
                f=friend, g=game_id)
        con.run("""insert into game_reviews (game_id, reviewer_id, decision, via)
                   values (:g, :f, 'approved', 'app')""", g=game_id, f=friend)
        row = con.run("""select status, published_at is not null, reviewed_at is not null
                           from games where id = :g""", g=game_id)[0]
        check("approving publishes it and stamps the dates",
              str(row[0]) == 'published' and row[1] and row[2], str(row))

        as_me()
        seen = con.run("""select decision, reason from game_reviews where game_id = :g""",
                       g=game_id)
        check("the author can read the decision on their own game",
              len(seen) == 1 and str(seen[0][0]) == 'approved', str(seen))

        print("\nprivacy")
        con.run("reset role")
        con.run("select set_config('request.jwt.claim.sub', "
                "'99999999-9999-9999-9999-999999999999', false)")
        con.run("set role authenticated")
        check("a stranger sees no favourites",
              con.run("select count(*) from game_favorites")[0][0] == 0)
        check("a stranger sees no folders",
              con.run("select count(*) from deck_folders")[0][0] == 0)
        check("a stranger sees nothing inside a folder",
              con.run("select count(*) from deck_folder_decks")[0][0] == 0)
        check("a stranger sees no group",
              con.run("select count(*) from friend_groups")[0][0] == 0)
        check("a stranger cannot read the group chat",
              con.run("select count(*) from group_messages")[0][0] == 0)
        check("a stranger sees no match history",
              con.run("select count(*) from matches")[0][0] == 0)
        check("a stranger sees nobody's deck inventory",
              con.run("select count(*) from user_decks")[0][0] == 0)
        check("a stranger cannot read a content preference",
              con.run("select count(*) from profile_settings")[0][0] == 0)
    finally:
        con.run("reset role")
        # deleting the account cascades through profiles, favourites and folders
        # the game outlives its author (author_id is set null, not cascaded), so it
        # has to go explicitly or the catalogue would keep a test row for ever
        con.run("delete from games where id = :g", g=game_id)
        # deleting both accounts cascades through everything else they created
        con.run("delete from auth.users where email in (:e, :f)", e=email, f=friend_email)
        after = con.run("select count(*) from profiles")[0][0]
        games_after = con.run("select count(*) from games")[0][0]
        print(f"\ncleanup: profiles {before} -> {after}, games {games_before} -> {games_after}")
        if after != before or games_after != games_before:
            failures.append("cleanup left something behind")
        con.close()

    print("\nall checks passed\n" if not failures else f"\n{len(failures)} failed\n")
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
