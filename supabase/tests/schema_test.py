"""Behaviour tests for the Cartas schema: RLS, triggers, playability query."""
import os, sys, pg8000.native

con = pg8000.native.Connection(host=os.environ.get("PGHOST", "127.0.0.1"),
                               port=int(os.environ.get("PGPORT", "55432")),
                               user=os.environ.get("PGUSER", "postgres"),
                               database=os.environ.get("PGDATABASE", "verify"))
passed, failed = [], []

def as_user(uid):
    con.run("reset role")
    con.run("select set_config('request.jwt.claim.sub', :u, false)", u=uid or '')
    con.run("set role authenticated")

def as_admin():
    con.run("reset role")
    con.run("select set_config('request.jwt.claim.sub', '', false)")

def as_anon():
    con.run("reset role")
    con.run("select set_config('request.jwt.claim.sub', '', false)")
    con.run("set role anon")

def check(name, fn):
    try:
        fn()
        passed.append(name)
        print(f"  pass  {name}")
    except AssertionError as e:
        failed.append((name, str(e)))
        print(f"  FAIL  {name}: {e}")
    except Exception as e:
        msg = e.args[0].get('M', str(e)) if e.args and isinstance(e.args[0], dict) else str(e)
        failed.append((name, f"unexpected error: {msg}"))
        print(f"  ERROR {name}: {msg}")

def must_fail(sql, **kw):
    """Denied = raised an error, or silently affected no rows (how RLS filters UPDATEs)."""
    try:
        con.run(sql, **kw)
    except Exception:
        return
    if con.row_count in (0, -1, None):
        return
    raise AssertionError(f"statement affected {con.row_count} rows but should have been denied")

OWNER = '11111111-1111-1111-1111-111111111111'
AUTHOR = '22222222-2222-2222-2222-222222222222'
READER = '33333333-3333-3333-3333-333333333333'
STRANGER = '44444444-4444-4444-4444-444444444444'
GAME = 'aaaaaaaa-0000-0000-0000-000000000001'
DECK = 'bbbbbbbb-0000-0000-0000-000000000001'
MATCH = 'cccccccc-0000-0000-0000-000000000001'

print("\n== setup ==")
as_admin()
for uid, email in [(OWNER, 'angel@example.com'), (AUTHOR, 'angel@other.com'),
                   (READER, 'lucia@example.com'), (STRANGER, 'x@example.com')]:
    con.run("insert into auth.users (id, email, raw_user_meta_data) values (:i, :e, '{}'::jsonb)",
            i=uid, e=email)
con.run("update profiles set role = 'owner' where id = :i", i=OWNER)

def t_profile_autocreated():
    rows = con.run("select username from profiles order by created_at, username")
    names = sorted(r[0] for r in rows)
    assert len(names) == 4, f"expected 4 profiles, got {names}"
    # two users share the local part 'angel' -> second must be de-duplicated
    assert 'angel' in names and 'angel1' in names, f"username collision not handled: {names}"

def t_role_escalation_blocked():
    as_user(READER)
    must_fail("update profiles set role = 'owner' where id = :i", i=READER)
    as_admin()
    r = con.run("select role from profiles where id = :i", i=READER)[0][0]
    assert str(r) == 'user', f"role escalated to {r}"

def t_author_can_draft():
    as_user(AUTHOR)
    con.run("""insert into decks (id, slug, name, kind, author_id, suits, ranks, card_count)
               values (:d, 'mi-mazo', 'Mi mazo', 'custom', :a,
                       '[{"key":"soles","name":"Soles"}]'::jsonb,
                       '[{"key":"1","label":"As","value":1}]'::jsonb, 10)""", d=DECK, a=AUTHOR)
    con.run("""insert into games (id, slug, author_id, status, players_min, players_max,
                                  missing_cards_policy)
               values (:g, 'mi-juego', :a, 'draft', 2, 4, 'strict')""", g=GAME, a=AUTHOR)
    con.run("""insert into game_texts (game_id, locale, title, summary)
               values (:g, 'es', 'Mi juego', 'Un juego de prueba para el esquema.')""", g=GAME)
    con.run("""insert into game_decks (game_id, deck_id, quantity)
               values (:g, :d, 2)""", g=GAME, d=DECK)

def t_author_cannot_publish_directly():
    as_user(AUTHOR)
    must_fail("""insert into games (slug, author_id, status, players_min, players_max)
                 values ('colado', :a, 'published', 2, 4)""", a=AUTHOR)

def t_author_cannot_self_publish():
    as_user(AUTHOR)
    must_fail("update games set status = 'published' where id = :g", g=GAME)

def t_author_can_submit():
    as_user(AUTHOR)
    con.run("update games set status = 'pending_review' where id = :g", g=GAME)
    as_admin()
    row = con.run("select status, submitted_at from games where id = :g", g=GAME)[0]
    assert str(row[0]) == 'pending_review', row[0]
    assert row[1] is not None, "submitted_at was not stamped"

def t_unpublished_game_is_hidden():
    as_user(READER)
    assert con.run("select count(*) from games where id = :g", g=GAME)[0][0] == 0, \
        "a reader can see a game that is not published"
    as_anon()
    assert con.run("select count(*) from games where id = :g", g=GAME)[0][0] == 0, \
        "anon can see a game that is not published"

def t_owner_sees_queue_and_publishes():
    as_user(OWNER)
    assert con.run("select count(*) from games where status = 'pending_review'")[0][0] == 1, \
        "owner cannot see the review queue"
    con.run("update games set status = 'published', reviewed_by = :o where id = :g",
            o=OWNER, g=GAME)
    con.run("""insert into game_reviews (game_id, reviewer_id, decision, via)
               values (:g, :o, 'approved', 'email')""", g=GAME, o=OWNER)
    as_admin()
    row = con.run("select published_at, reviewed_at from games where id = :g", g=GAME)[0]
    assert row[0] is not None and row[1] is not None, "publish timestamps not stamped"

def t_editing_published_game_requeues_it():
    """An author may not quietly change a game that is already public: the update is only
    allowed if it also sends the game back to pending_review."""
    as_user(AUTHOR)
    must_fail("update games set players_max = 6 where id = :g", g=GAME)
    as_admin()
    assert con.run("select players_max from games where id = :g", g=GAME)[0][0] == 4, \
        "a published game was edited without re-review"
    as_user(AUTHOR)
    con.run("""update games set players_max = 6, status = 'pending_review'
                where id = :g""", g=GAME)
    as_admin()
    row = con.run("select players_max, status from games where id = :g", g=GAME)[0]
    assert row[0] == 6 and str(row[1]) == 'pending_review', row
    con.run("update games set status = 'published' where id = :g", g=GAME)


def t_reviewer_insert_blocked_for_authenticated():
    as_user(READER)
    must_fail("""insert into game_reviews (game_id, decision) values (:g, 'approved')""", g=GAME)

def t_published_game_is_public():
    as_anon()
    assert con.run("select count(*) from games where id = :g", g=GAME)[0][0] == 1, \
        "published public game is not visible to anon"
    assert con.run("select count(*) from game_texts where game_id = :g", g=GAME)[0][0] == 1, \
        "published game text is not visible to anon"

def t_rejection_needs_reason():
    as_admin()
    must_fail("""insert into game_reviews (game_id, decision) values (:g, 'rejected')""", g=GAME)

def t_deck_count_trigger():
    as_admin()
    assert con.run("select deck_count_total from games where id = :g", g=GAME)[0][0] == 2, \
        "deck_count_total not maintained"

def t_rating_and_favorite_triggers():
    as_user(READER)
    con.run("insert into game_ratings (profile_id, game_id, stars) values (:p, :g, 4)",
            p=READER, g=GAME)
    con.run("insert into game_favorites (profile_id, game_id) values (:p, :g)", p=READER, g=GAME)
    as_user(STRANGER)
    con.run("insert into game_ratings (profile_id, game_id, stars) values (:p, :g, 5)",
            p=STRANGER, g=GAME)
    as_admin()
    row = con.run("select rating_avg, rating_count, favorite_count from games where id = :g",
                  g=GAME)[0]
    assert float(row[0]) == 4.5 and row[1] == 2 and row[2] == 1, f"denormalised stats wrong: {row}"

def t_cannot_rate_as_someone_else():
    as_user(READER)
    must_fail("insert into game_ratings (profile_id, game_id, stars) values (:p, :g, 1)",
              p=STRANGER, g=GAME)

def t_share_requires_friendship():
    as_user(READER)
    must_fail("""insert into game_shares (from_profile_id, to_profile_id, game_id)
                 values (:r, :a, :g)""", r=READER, a=AUTHOR, g=GAME)
    con.run("""insert into friendships (requester_id, addressee_id) values (:r, :a)""",
            r=READER, a=AUTHOR)
    # still pending -> not friends yet
    must_fail("""insert into game_shares (from_profile_id, to_profile_id, game_id)
                 values (:r, :a, :g)""", r=READER, a=AUTHOR, g=GAME)
    as_user(AUTHOR)
    con.run("update friendships set status = 'accepted' where addressee_id = :a", a=AUTHOR)
    as_user(READER)
    con.run("""insert into game_shares (from_profile_id, to_profile_id, game_id, message)
               values (:r, :a, :g, 'juguemos')""", r=READER, a=AUTHOR, g=GAME)

def t_requester_cannot_self_accept():
    as_user(STRANGER)
    con.run("insert into friendships (requester_id, addressee_id) values (:s, :o)",
            s=STRANGER, o=OWNER)
    must_fail("update friendships set status = 'accepted' where requester_id = :s", s=STRANGER)
    as_admin()
    st = con.run("select status from friendships where requester_id = :s", s=STRANGER)[0][0]
    assert str(st) == 'pending', f"request was accepted by its own requester: {st}"

def t_match_is_private_and_single_open():
    as_user(READER)
    con.run("""insert into matches (id, profile_id, game_id, player_count, deck_ids)
               values (:m, :p, :g, 3, array[:d]::uuid[])""",
            m=MATCH, p=READER, g=GAME, d=DECK)
    must_fail("""insert into matches (id, profile_id, game_id, player_count)
                 values (gen_random_uuid(), :p, :g, 3)""", p=READER, g=GAME)
    as_user(STRANGER)
    assert con.run("select count(*) from matches where id = :m", m=MATCH)[0][0] == 0, \
        "another user can read someone's match"

def t_stranger_can_translate_not_overwrite():
    as_user(STRANGER)
    con.run("""insert into game_texts (game_id, locale, title, summary, translator_id,
                                       is_machine_translated)
               values (:g, 'en', 'My game', 'A test game for the schema.', :s, false)""",
            g=GAME, s=STRANGER)
    must_fail("update game_texts set title = 'secuestrado' where game_id = :g and locale = 'es'",
              g=GAME)
    as_admin()
    title = con.run("select title from game_texts where game_id = :g and locale = 'es'",
                    g=GAME)[0][0]
    assert title == 'Mi juego', f"a stranger rewrote the author's text: {title}"

def t_search_vector_built():
    as_admin()
    n = con.run("""select count(*) from game_texts
                    where game_id = :g and search @@ to_tsquery('spanish', 'juego')""", g=GAME)[0][0]
    assert n >= 1, "spanish search vector did not index the title"

print("\n== triggers and profile creation ==")
check("profile auto-created with unique username", t_profile_autocreated)
check("client cannot escalate its own role", t_role_escalation_blocked)

print("\n== authoring and review ==")
check("author can create a draft with decks and text", t_author_can_draft)
check("author cannot insert a published game", t_author_cannot_publish_directly)
check("author cannot publish own game", t_author_cannot_self_publish)
check("author can submit for review", t_author_can_submit)
check("unpublished game hidden from readers and anon", t_unpublished_game_is_hidden)
check("owner sees queue and can publish", t_owner_sees_queue_and_publishes)
check("ordinary user cannot write the review log", t_reviewer_insert_blocked_for_authenticated)
check("published game readable by anon", t_published_game_is_public)
check("rejection without a reason is refused", t_rejection_needs_reason)
check("editing a published game forces re-review", t_editing_published_game_requeues_it)

print("\n== derived data ==")
check("deck_count_total trigger", t_deck_count_trigger)
check("rating and favorite triggers", t_rating_and_favorite_triggers)
check("cannot rate on behalf of another user", t_cannot_rate_as_someone_else)
check("spanish search vector", t_search_vector_built)

print("\n== social ==")
check("sharing requires an accepted friendship", t_share_requires_friendship)
check("requester cannot accept their own request", t_requester_cannot_self_accept)
check("matches are private, one open per game", t_match_is_private_and_single_open)

def t_seeded_catalogue():
    """The nine seeded games are published, readable by anyone, and complete."""
    as_anon()
    rows = con.run("""select g.slug, t.title, g.deck_count_total
                        from games g
                        join game_texts t on t.game_id = g.id and t.locale = 'es'
                       where g.status = 'published' and g.author_id is null
                       order by g.slug""")
    slugs = [r[0] for r in rows]
    assert len(slugs) == 9, f"expected 9 seeded games, got {slugs}"
    for expected in ('brisca', 'chinchon', 'cuarenta', 'escoba', 'guinote', 'mus',
                     'solitario-klondike', 'texas-holdem', 'tute'):
        assert expected in slugs, f"{expected} missing from the seeded catalogue"
    for slug, title, deck_count in rows:
        assert title and len(title) > 1, f"{slug} has no title"
        assert deck_count >= 1, f"{slug} requires no deck"


def t_every_seeded_game_has_rules():
    as_anon()
    rows = con.run("""select g.slug, jsonb_array_length(t.sections)
                        from games g
                        join game_texts t on t.game_id = g.id and t.locale = 'es'
                       where g.author_id is null""")
    for slug, sections in rows:
        assert sections >= 4, f"{slug} only has {sections} rules sections"


def t_cuarenta_removes_cards():
    """The one seeded game that needs a modified deck: 40 of the 52 French cards."""
    as_admin()
    row = con.run("""select d.slug, gd.quantity, gd.cards_removed, gd.note
                       from game_decks gd
                       join games g on g.id = gd.game_id
                       join decks d on d.id = gd.deck_id
                      where g.slug = 'cuarenta'""")
    assert len(row) == 1, row
    slug, quantity, removed, note = row[0]
    assert slug == 'francesa-52' and quantity == 1, row[0]
    assert removed == ['8', '9', '10'], removed
    assert note is not None and len(note) > 0


def t_deck_count_matches_requirements():
    as_admin()
    bad = con.run("""select g.slug, g.deck_count_total, coalesce(sum(gd.quantity), 0)
                       from games g left join game_decks gd on gd.game_id = g.id
                      group by g.id, g.slug, g.deck_count_total
                     having g.deck_count_total <> coalesce(sum(gd.quantity), 0)""")
    assert bad == [], f"deck_count_total out of step: {bad}"


def t_seeded_games_have_no_fake_ratings():
    as_admin()
    rows = con.run("""select slug, rating_avg, rating_count from games
                       where author_id is null and rating_count > 0""")
    assert rows == [], f"seeded games must not ship invented ratings: {rows}"


print("\n== catálogo sembrado ==")
check("nine seeded games, published and public", t_seeded_catalogue)
check("every seeded game has real rules sections", t_every_seeded_game_has_rules)
check("cuarenta strips the 8s, 9s and 10s", t_cuarenta_removes_cards)
check("deck_count_total matches the requirements", t_deck_count_matches_requirements)
check("no invented ratings on the seeded catalogue", t_seeded_games_have_no_fake_ratings)

print("\n== traducciones ==")
check("stranger may add a locale but not edit another", t_stranger_can_translate_not_overwrite)


def t_hide_adult_is_private():
    """A content preference is not a public fact: it lives in its own table."""
    as_user(READER)
    con.run("""insert into profile_settings (profile_id, hide_adult) values (:p, true)
               on conflict (profile_id) do update set hide_adult = true""", p=READER)
    assert con.run("select hide_adult from profile_settings where profile_id = :p",
                   p=READER)[0][0] is True

    as_user(STRANGER)
    assert con.run("select count(*) from profile_settings where profile_id = :p",
                   p=READER)[0][0] == 0, "another user can read your content preference"
    must_fail("""update profile_settings set hide_adult = false where profile_id = :p""",
              p=READER)

    as_anon()
    columns = [r[0] for r in con.run("""select column_name from information_schema.columns
                                         where table_name = 'profiles'""")]
    assert 'hide_adult' not in columns, "the preference is still on the public row"


print("\n== ajustes privados ==")
check("the hide-18+ setting is private to its owner", t_hide_adult_is_private)

GROUP = 'dddddddd-0000-0000-0000-000000000001'
FOLDER = 'eeeeeeee-0000-0000-0000-000000000001'


def t_folder_is_private():
    as_user(READER)
    con.run("""insert into deck_folders (id, profile_id, name)
               values (:f, :p, 'los del bar')""", f=FOLDER, p=READER)
    con.run("""insert into deck_folder_decks (folder_id, deck_id)
               select :f, id from decks where slug = 'espanola-40'""", f=FOLDER)
    as_user(STRANGER)
    assert con.run("select count(*) from deck_folders where id = :f", f=FOLDER)[0][0] == 0, \
        "another user can see my folder"
    assert con.run("""select count(*) from deck_folder_decks where folder_id = :f""",
                   f=FOLDER)[0][0] == 0, "another user can see what is in my folder"


def t_stranger_cannot_fill_my_folder():
    as_user(STRANGER)
    must_fail("""insert into deck_folder_decks (folder_id, deck_id)
                 select :f, id from decks where slug = 'francesa-52'""", f=FOLDER)
    as_admin()
    assert con.run("select count(*) from deck_folder_decks where folder_id = :f",
                   f=FOLDER)[0][0] == 1, "a stranger added a deck to someone else's folder"


def t_group_visible_to_members_only():
    as_user(READER)
    con.run("insert into friend_groups (id, owner_id, name) values (:g, :p, 'Los del bar')",
            g=GROUP, p=READER)
    # one member who has an account, one who is still just a name
    con.run("""insert into friend_group_members (group_id, profile_id) values (:g, :a)""",
            g=GROUP, a=AUTHOR)
    con.run("""insert into friend_group_members (group_id, display_name)
               values (:g, 'Marta')""", g=GROUP)

    as_user(AUTHOR)
    assert con.run("select count(*) from friend_groups where id = :g", g=GROUP)[0][0] == 1, \
        "a member cannot see the group they are in"
    assert con.run("select count(*) from friend_group_members where group_id = :g",
                   g=GROUP)[0][0] == 2, "a member cannot see who else is in the group"

    as_user(STRANGER)
    assert con.run("select count(*) from friend_groups where id = :g", g=GROUP)[0][0] == 0, \
        "a stranger can see someone else's group"


def t_member_is_an_account_or_a_name():
    as_admin()
    # both at once, or neither, are refused: that is the whole point of the column pair
    must_fail("""insert into friend_group_members (group_id, profile_id, display_name)
                 values (:g, :a, 'Ana')""", g=GROUP, a=STRANGER)
    must_fail("insert into friend_group_members (group_id) values (:g)", g=GROUP)


def t_no_duplicate_members():
    as_admin()
    must_fail("insert into friend_group_members (group_id, profile_id) values (:g, :a)",
              g=GROUP, a=AUTHOR)
    # and the same name twice, whatever the capitals
    must_fail("""insert into friend_group_members (group_id, display_name)
                 values (:g, 'MARTA')""", g=GROUP)


def t_only_the_owner_changes_membership():
    as_user(AUTHOR)
    must_fail("""insert into friend_group_members (group_id, display_name)
                 values (:g, 'Colado')""", g=GROUP)
    must_fail("delete from friend_group_members where group_id = :g", g=GROUP)
    as_admin()
    assert con.run("select count(*) from friend_group_members where group_id = :g",
                   g=GROUP)[0][0] == 2, "a member rewrote the membership list"


def t_group_chat_reaches_members_only():
    as_user(AUTHOR)
    con.run("""insert into group_messages (group_id, author_id, body)
               values (:g, :a, 'yo llevo las cartas')""", g=GROUP, a=AUTHOR)
    as_user(READER)
    assert con.run("select count(*) from group_messages where group_id = :g",
                   g=GROUP)[0][0] == 1, "the group owner cannot read the group chat"

    as_user(STRANGER)
    assert con.run("select count(*) from group_messages where group_id = :g",
                   g=GROUP)[0][0] == 0, "a stranger can read a group chat"
    must_fail("""insert into group_messages (group_id, author_id, body)
                 values (:g, :s, 'hola')""", g=GROUP, s=STRANGER)


def t_messages_cannot_be_rewritten():
    as_user(AUTHOR)
    must_fail("update group_messages set body = 'nunca dije eso' where group_id = :g", g=GROUP)
    as_admin()
    body = con.run("select body from group_messages where group_id = :g", g=GROUP)[0][0]
    assert body == 'yo llevo las cartas', f"a message was edited: {body}"


def t_cannot_post_as_someone_else():
    as_user(AUTHOR)
    must_fail("""insert into group_messages (group_id, author_id, body)
                 values (:g, :r, 'lo dijo el otro')""", g=GROUP, r=READER)


def t_matches_for_group():
    as_user(READER)
    con.run("""insert into matches (id, profile_id, game_id, player_count, group_id)
               values (gen_random_uuid(), :p, (select id from games where slug = 'mus'),
                       4, :g)""", p=READER, g=GROUP)
    rows = con.run("select count(*) from matches_for_group(:g)", g=GROUP)
    assert rows[0][0] == 1, rows
    # a stranger gets nothing back, even calling the function directly
    as_user(STRANGER)
    assert con.run("select count(*) from matches_for_group(:g)", g=GROUP)[0][0] == 0, \
        "matches_for_group leaks another group's matches"


print("\n== carpetas, grupos y chat ==")
check("a deck folder is private to its owner", t_folder_is_private)
check("a stranger cannot add decks to my folder", t_stranger_cannot_fill_my_folder)
check("a group is visible to its owner and its members", t_group_visible_to_members_only)
check("a member is an account or a name, never both", t_member_is_an_account_or_a_name)
check("the same person cannot join twice", t_no_duplicate_members)
check("only the owner changes who is in the group", t_only_the_owner_changes_membership)
check("the group chat reaches members only", t_group_chat_reaches_members_only)
check("messages cannot be rewritten", t_messages_cannot_be_rewritten)
check("nobody can post as someone else", t_cannot_post_as_someone_else)
check("matches_for_group only shows that group, to that group", t_matches_for_group)

ANA = '55555555-5555-5555-5555-555555555555'
BEA = '66666666-6666-6666-6666-666666666666'

as_admin()
for uid, email in ((ANA, 'ana@example.com'), (BEA, 'bea@example.com')):
    con.run("insert into auth.users (id, email, raw_user_meta_data) values (:i, :e, '{}'::jsonb)",
            i=uid, e=email)
con.run("update profiles set display_name = 'Ana Bolena' where id = :i", i=ANA)


def t_search_needs_two_characters():
    as_user(BEA)
    assert con.run("select count(*) from search_profiles('a')")[0][0] == 0, \
        "one character lists the directory"
    assert con.run("select count(*) from search_profiles('')")[0][0] == 0
    assert con.run("select count(*) from search_profiles(null)")[0][0] == 0


def t_search_finds_by_username_and_name():
    as_user(BEA)
    by_username = [r[1] for r in con.run("select * from search_profiles('ana')")]
    assert 'ana' in by_username, by_username
    by_name = [r[1] for r in con.run("select * from search_profiles('bolena')")]
    assert 'ana' in by_name, f"display name is not searchable: {by_name}"


def t_search_never_returns_yourself():
    as_user(ANA)
    found = [r[1] for r in con.run("select * from search_profiles('ana')")]
    assert 'ana' not in found, f"you can find yourself: {found}"


def t_search_exposes_no_email():
    """An email must be unreachable from the client, so it is not a column here."""
    as_user(BEA)
    con.run("select * from search_profiles('ana')")
    names = [c["name"] for c in con.columns]
    assert names == ['id', 'username', 'display_name', 'avatar_url', 'link'], names
    assert not any('mail' in n for n in names), names
    # and the table behind it holds no email at all
    cols = [r[0] for r in con.run("""select column_name from information_schema.columns
                                      where table_name = 'profiles'""")]
    assert not any('mail' in c for c in cols), cols


def t_search_escapes_wildcards():
    as_admin()
    con.run("insert into auth.users (id, email, raw_user_meta_data) values "
            "(gen_random_uuid(), 'odd_name@example.com', '{}'::jsonb)")
    as_user(BEA)
    # '%' must be looked for literally, not match everything
    assert con.run("select count(*) from search_profiles('%%')")[0][0] == 0, \
        "a percent sign matched every profile"
    found = [r[1] for r in con.run("select * from search_profiles('odd_name')")]
    assert 'odd_name' in found, found


def t_friend_request_shows_in_both_directions():
    as_user(ANA)
    link = con.run("select link from search_profiles('bea')")[0][0]
    assert link == 'none', link

    con.run("insert into friendships (requester_id, addressee_id) values (:a, :b)", a=ANA, b=BEA)
    assert con.run("select link from search_profiles('bea')")[0][0] == 'outgoing'

    as_user(BEA)
    assert con.run("select link from search_profiles('ana')")[0][0] == 'incoming', \
        "the other side does not see the request as incoming"

    # my_friends carries the pending request for both
    assert con.run("select link from my_friends()")[0][0] == 'incoming'
    as_user(ANA)
    assert con.run("select link from my_friends()")[0][0] == 'outgoing'


def t_accepting_makes_them_friends():
    as_user(BEA)
    con.run("update friendships set status = 'accepted', responded_at = now() "
            "where requester_id = :a and addressee_id = :b", a=ANA, b=BEA)
    assert con.run("select link from search_profiles('ana')")[0][0] == 'friends'
    as_user(ANA)
    rows = con.run("select username, link from my_friends()")
    assert rows == [['bea', 'friends']], rows


def t_a_stranger_sees_no_link():
    as_user(STRANGER)
    # the friendship between Ana and Bea is none of their business
    links = [r[4] for r in con.run("select * from search_profiles('ana')")]
    assert links == ['none'], links


print("\n== buscar personas por su nombre ==")
check("a search needs at least two characters", t_search_needs_two_characters)
check("finds people by username and by display name", t_search_finds_by_username_and_name)
check("never returns yourself", t_search_never_returns_yourself)
check("exposes no email, by construction", t_search_exposes_no_email)
check("treats % and _ as text, not wildcards", t_search_escapes_wildcards)
check("a request reads as outgoing and incoming", t_friend_request_shows_in_both_directions)
check("accepting makes them friends", t_accepting_makes_them_friends)
check("someone else's friendship is invisible", t_a_stranger_sees_no_link)

print(f"\n{len(passed)} passed, {len(failed)} failed")
for name, why in failed:
    print(f"  - {name}: {why}")
sys.exit(1 if failed else 0)
