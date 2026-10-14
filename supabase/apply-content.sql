-- ===========================================================================
--  Cartas - mazos y juegos (re-ejecutable)
--
--  Pegar TODO este fichero en el SQL Editor de Supabase y pulsar Run:
--  https://supabase.com/dashboard/project/iqxiykqweqzsvyqahbsk/sql/new
--
--  Solo contenido: no toca las tablas ni los permisos. Se puede ejecutar
--  tantas veces como quieras, y cada vez deja los mazos y los juegos
--  exactamente como dice el repositorio. Es tambien el arreglo si algun
--  texto se guardo mal.
--
--  Contiene:
--    0002_standard_decks.sql
--    0003_seed_games.sql
--
--  GENERADO por supabase/gen_apply.py. Todo el fichero es ASCII puro: los
--  acentos y los palos de la baraja van codificados, para que ningun
--  portapapeles ni ninguna codificacion de Windows pueda romperlos. Por eso se
--  lee raro aqui y se lee bien en la app.
-- ===========================================================================


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
