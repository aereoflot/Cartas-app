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
