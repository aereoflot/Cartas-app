"""Generate supabase/migrations/0002_standard_decks.sql.

card_count is computed from suits x ranks(copies) + extras, never hand-typed.
Output is pure ASCII and re-runnable; see supabase/sqlgen.py for why.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sqlgen import assert_ascii, jsonb, lit  # noqa: E402

import json  # noqa: E402

def suit(key, name, en, symbol, color):
    return {"key": key, "name": name, "name_i18n": {"en": en},
            "symbol": symbol, "color": color}

def rank(key, label, en, value, order, copies=1):
    r = {"key": key, "label": label, "label_i18n": {"en": en},
         "value": value, "order": order}
    if copies != 1:
        r["copies"] = copies
    return r

ES_SUITS = [
    suit("oros",    "Oros",    "Coins",  "O", "gold"),
    suit("copas",   "Copas",   "Cups",   "C", "red"),
    suit("espadas", "Espadas", "Swords", "E", "blue"),
    suit("bastos",  "Bastos",  "Clubs",  "B", "green"),
]
# 1-7 then the three figures; 8 and 9 exist only in the 48-card deck
ES_NUM = [rank(str(v), lab, en, v, i + 1) for i, (v, lab, en) in enumerate([
    (1, "As", "Ace"), (2, "Dos", "Two"), (3, "Tres", "Three"), (4, "Cuatro", "Four"),
    (5, "Cinco", "Five"), (6, "Seis", "Six"), (7, "Siete", "Seven")])]
ES_FIG = [rank("10", "Sota", "Jack", 10, 8), rank("11", "Caballo", "Knight", 11, 9),
          rank("12", "Rey", "King", 12, 10)]
ES_8_9 = [rank("8", "Ocho", "Eight", 8, 8), rank("9", "Nueve", "Nine", 9, 9)]

FR_SUITS = [
    suit("treboles",  "Tréboles",  "Clubs",    "♣", "black"),
    suit("diamantes", "Diamantes", "Diamonds", "♦", "red"),
    suit("corazones", "Corazones", "Hearts",   "♥", "red"),
    suit("picas",     "Picas",     "Spades",   "♠", "black"),
]
FR_RANKS = [rank("a", "As", "Ace", 1, 1)] + \
           [rank(str(v), str(v), str(v), v, v) for v in range(2, 11)] + \
           [rank("j", "J", "Jack", 11, 11), rank("q", "Q", "Queen", 12, 12),
            rank("k", "K", "King", 13, 13)]
FR_32 = [r for r in FR_RANKS if r["value"] in (1, 7, 8, 9, 10, 11, 12, 13)]

DE_SUITS = [
    suit("bellotas",   "Bellotas",   "Acorns", "B", "brown"),
    suit("hojas",      "Hojas",      "Leaves", "H", "green"),
    suit("corazones",  "Corazones",  "Hearts", "♥", "red"),
    suit("cascabeles", "Cascabeles", "Bells",  "K", "gold"),
]
DE_RANKS = [rank(str(v), str(v), str(v), v, i + 1) for i, v in enumerate([7, 8, 9, 10])] + [
    rank("unter", "Unter", "Under-knave", 11, 5),
    rank("ober",  "Ober",  "Over-knave",  12, 6),
    rank("koenig", "Rey",  "King",        13, 7),
    rank("as",     "As",   "Ace",         14, 8)]

TAROT_SUITS = [
    suit("bastos",  "Bastos",  "Wands",     "B", "green"),
    suit("copas",   "Copas",   "Cups",      "C", "blue"),
    suit("espadas", "Espadas", "Swords",    "E", "grey"),
    suit("oros",    "Oros",    "Pentacles", "O", "gold"),
]
TAROT_RANKS = [rank(str(v), str(v), str(v), v, v) for v in range(1, 11)] + [
    rank("sota",      "Sota",      "Page",   11, 11),
    rank("caballero", "Caballero", "Knight", 12, 12),
    rank("reina",     "Reina",     "Queen",  13, 13),
    rank("rey",       "Rey",       "King",   14, 14)]

UNO_SUITS = [
    suit("rojo",     "Rojo",     "Red",    "R", "red"),
    suit("amarillo", "Amarillo", "Yellow", "A", "yellow"),
    suit("verde",    "Verde",    "Green",  "V", "green"),
    suit("azul",     "Azul",     "Blue",   "Z", "blue"),
]
UNO_RANKS = [rank("0", "0", "0", 0, 1)] + \
            [rank(str(v), str(v), str(v), v, v + 1, copies=2) for v in range(1, 10)] + [
             rank("salta",   "Salta",    "Skip",     20, 11, copies=2),
             rank("reversa", "Reversa",  "Reverse",  20, 12, copies=2),
             rank("roba2",   "Roba dos", "Draw two", 20, 13, copies=2)]

DECKS = [
    dict(uid="d0000001-0000-4000-8000-000000000001", slug="espanola-40",
         name="Baraja española (40)", en="Spanish deck (40)",
         desc="La baraja de 40 cartas: del as al siete más sota, caballo y rey. "
              "La de mus, tute, brisca y guiñote.",
         kind="standard", parent=None,
         suits=ES_SUITS, ranks=ES_NUM + ES_FIG, extras=[]),
    dict(uid="d0000002-0000-4000-8000-000000000002", slug="espanola-48",
         name="Baraja española (48)", en="Spanish deck (48)",
         desc="La española completa, con los ochos y los nueves. Necesaria para el tute cabrón "
              "y algunas variantes regionales.",
         kind="standard", parent=None,
         suits=ES_SUITS,
         ranks=ES_NUM + ES_8_9 + [dict(r, order=r["order"] + 2) for r in ES_FIG], extras=[]),
    dict(uid="d0000003-0000-4000-8000-000000000003", slug="francesa-52",
         name="Baraja francesa (52)", en="French deck (52)",
         desc="Las cartas de póker: trece figuras en cuatro palos, sin comodines.",
         kind="standard", parent=None,
         suits=FR_SUITS, ranks=FR_RANKS, extras=[]),
    dict(uid="d0000004-0000-4000-8000-000000000004", slug="francesa-54",
         name="Baraja francesa con comodines (54)", en="French deck with jokers (54)",
         desc="La francesa de 52 más los dos comodines. Para canasta, rummy y cualquier juego "
              "que los use.",
         kind="variant", parent="d0000003-0000-4000-8000-000000000003",
         suits=FR_SUITS, ranks=FR_RANKS,
         extras=[{"key": "comodin", "label": "Comodín", "label_i18n": {"en": "Joker"},
                  "count": 2}]),
    dict(uid="d0000005-0000-4000-8000-000000000005", slug="francesa-32",
         name="Baraja francesa corta (32)", en="French deck, short (32)",
         desc="La francesa sin el 2 al 6: del siete al as. La de la belote y el skat con palos "
              "franceses.",
         kind="variant", parent="d0000003-0000-4000-8000-000000000003",
         suits=FR_SUITS, ranks=FR_32, extras=[]),
    dict(uid="d0000006-0000-4000-8000-000000000006", slug="alemana-32",
         name="Baraja alemana (32)", en="German deck (32)",
         desc="Bellotas, hojas, corazones y cascabeles, del siete al as. La del skat y el schafkopf.",
         kind="standard", parent=None,
         suits=DE_SUITS, ranks=DE_RANKS, extras=[]),
    dict(uid="d0000007-0000-4000-8000-000000000007", slug="tarot-78",
         name="Tarot (78)", en="Tarot (78)",
         desc="Cincuenta y seis cartas en cuatro palos con cuatro figuras, más los veintidós "
              "arcanos mayores.",
         kind="standard", parent=None,
         suits=TAROT_SUITS, ranks=TAROT_RANKS,
         extras=[{"key": "arcanos", "label": "Arcanos mayores",
                  "label_i18n": {"en": "Major arcana"}, "count": 22}]),
    dict(uid="d0000008-0000-4000-8000-000000000008", slug="uno-108",
         name="Mazo tipo Uno (108)", en="Uno-style deck (108)",
         desc="Cuatro colores con números y cartas de acción, más los comodines. Para los juegos "
              "de descarte por color y número.",
         kind="standard", parent=None,
         suits=UNO_SUITS, ranks=UNO_RANKS,
         extras=[{"key": "comodin", "label": "Comodín", "label_i18n": {"en": "Wild"}, "count": 4},
                 {"key": "comodin4", "label": "Comodín roba cuatro",
                  "label_i18n": {"en": "Wild draw four"}, "count": 4}]),
]

def count(d):
    per_suit = sum(r.get("copies", 1) for r in d["ranks"])
    return per_suit * len(d["suits"]) + sum(e.get("count", 1) for e in d["extras"])

def q(s):
    return "'" + s.replace("'", "''") + "'"

def j(obj):
    return q(json.dumps(obj, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"

lines = ["""-- Cartas - seeded standard decks
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
"""]
for d in DECKS:
    n = count(d)
    lines.append(f"""insert into decks (id, slug, name, name_i18n, description, kind,
                   parent_deck_id, visibility, suits, ranks, extras, card_count)
values ({lit(d['uid'])}, {lit(d['slug'])}, {lit(d['name'])},
        {jsonb({'en': d['en']})},
        {lit(d['desc'])},
        '{d['kind']}', {lit(d['parent']) if d['parent'] else 'null'}, 'public',
        {jsonb(d['suits'])},
        {jsonb(d['ranks'])},
        {jsonb(d['extras'])},
        {n})
on conflict (slug) do update set
  name = excluded.name, name_i18n = excluded.name_i18n,
  description = excluded.description, kind = excluded.kind,
  parent_deck_id = excluded.parent_deck_id, suits = excluded.suits,
  ranks = excluded.ranks, extras = excluded.extras,
  card_count = excluded.card_count;
""")
    print(f"{d['slug']:<14} {n:>3} cards   ({len(d['suits'])} suits x "
          f"{sum(r.get('copies', 1) for r in d['ranks'])} + "
          f"{sum(e.get('count', 1) for e in d['extras'])} extras)")

out = "\n".join(lines)
assert_ascii("0002_standard_decks.sql", out)
root = pathlib.Path(__file__).resolve().parent.parent
(root / "supabase/migrations/0002_standard_decks.sql").write_text(out, encoding="utf-8")


# The TypeScript fallback, from the same source. It used to be hand-written and
# held three of the eight decks, so the app without a backend showed a different
# deck list from the database. Generated, it cannot drift again.
by_uid = {d["uid"]: d["slug"] for d in DECKS}
items = []
for d in DECKS:
    item = {
        "id": d["uid"],
        "slug": d["slug"],
        "name": d["name"],
        "name_i18n": {"en": d["en"]},
        "description": d["desc"],
        "kind": d["kind"],
        "suits": d["suits"],
        "ranks": d["ranks"],
        "extras": d["extras"],
        "cardCount": count(d),
    }
    if d["parent"]:
        item["parentSlug"] = by_uid[d["parent"]]
    items.append(item)

ts = """import type { Deck } from '@/types/cards'

/**
 * GENERATED by supabase/gen_decks.py.
 * Do not edit by hand: edit that script and regenerate.
 *
 * The standard decks the app falls back on when no Supabase project is
 * configured. Same source as supabase/migrations/0002_standard_decks.sql, so the
 * list can never differ from the database. Accents and card suits are real here:
 * Vite reads this as UTF-8 and it never travels through a clipboard.
 */
export const STANDARD_DECKS: Deck[] = """ + json.dumps(items, ensure_ascii=False, indent=2) + """

export const deckBySlug = (slug: string): Deck | undefined =>
  STANDARD_DECKS.find((d) => d.slug === slug)

/**
 * A requirement's deck name and size. Postgres joins the deck in, the sample
 * catalogue only stores a slug, so resolve either without the caller caring.
 */
export function requirementDeck(req: DeckRequirement): { name: string; cardCount?: number } {
  const known = deckBySlug(req.deckSlug)
  const name = req.deckName ?? known?.name ?? req.deckSlug
  const cardCount = req.deckCardCount ?? known?.cardCount
  return cardCount === undefined ? { name } : { name, cardCount }
}
"""
ts = ts.replace(
    "import type { Deck } from '@/types/cards'",
    "import type { Deck, DeckRequirement } from '@/types/cards'",
)
(root / "src/lib/decks.ts").write_text(ts, encoding="utf-8")
print(f"  src/lib/decks.ts: {len(ts.splitlines())} lineas, {len(items)} mazos")
