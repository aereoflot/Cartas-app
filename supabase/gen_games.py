#!/usr/bin/env python3
"""Generate the seeded catalogue from supabase/content/games.py.

Writes two files from one source, so the database and the no-backend fallback
cannot disagree:

  supabase/migrations/0003_seed_games.sql
  src/lib/sampleGames.ts

Run:  python3 supabase/gen_games.py
"""
import importlib.util
import json
import pathlib
import sys
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sqlgen import assert_ascii, jsonb, lit, text_array  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
NS = uuid.UUID("6ba7b811-9dad-11d1-80b4-00c04fd430c8")  # uuid.NAMESPACE_URL


def load_games() -> list[dict]:
    spec = importlib.util.spec_from_file_location("content_games", ROOT / "supabase/content/games.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.GAMES


def game_id(slug: str) -> str:
    """Stable id from the slug, so SQL and TypeScript name the same game."""
    return str(uuid.uuid5(NS, f"cartas:game:{slug}"))


def sections_json(sections: list[tuple[str, str]]) -> list[dict]:
    return [{"heading": h, "body": b} for h, b in sections]


def to_sql(games: list[dict]) -> str:
    out = ["""-- Cartas - catalogo inicial
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
"""]
    for g in games:
        gid = game_id(g["slug"])
        teams = g.get("teams")
        out.append(f"""
-- {g['slug']}
insert into games (
  id, slug, author_id, status, visibility, listed, primary_locale,
  players_min, players_max, players_best, supports_teams, team_size,
  missing_cards_policy, missing_cards_note,
  duration_min, duration_max, complexity, age_min,
  requires_extras, mechanics, adult_only, published_at
) values (
  {lit(gid)}, {lit(g['slug'])}, null, 'published', 'public', true, 'es',
  {g['players'][0]}, {g['players'][1]}, {g.get('best') or 'null'},
  {'true' if teams else 'false'}, {teams or 'null'},
  '{g['missing']}', {lit(g.get('missing_note'))},
  {g['duration'][0]}, {g['duration'][1]}, {g['complexity']}, {g['age_min']},
  {text_array(g['extras'])}, {text_array(g['mechanics'])},
  {'true' if g['adult'] else 'false'}, now()
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
  {lit(gid)}, 'es', {lit(g['title'])}, {lit(g.get('tagline'))}, {lit(g['summary'])},
  {jsonb(sections_json(g['sections']))}
)
on conflict (game_id, locale) do update set
  title = excluded.title, tagline = excluded.tagline,
  summary = excluded.summary, sections = excluded.sections,
  updated_at = now();
""")
        for deck in g["decks"]:
            out.append(f"""insert into game_decks (game_id, deck_id, quantity, cards_removed, note)
select {lit(gid)}, d.id, {deck['quantity']}, {jsonb(deck.get('cards_removed', []))},
       {lit(deck.get('note'))}
  from decks d where d.slug = {lit(deck['slug'])}
on conflict (game_id, deck_id) do update set
  quantity = excluded.quantity, cards_removed = excluded.cards_removed,
  note = excluded.note;
""")
    out.append("""
-- Comprobacion: nueve juegos publicados, con sus mazos y su numero de cartas.
select g.slug, g.players_min, g.players_max, g.deck_count_total, g.complexity,
       g.missing_cards_policy, t.title
  from games g join game_texts t on t.game_id = g.id and t.locale = 'es'
 order by g.complexity, g.slug;
""")
    return "".join(out)


def to_typescript(games: list[dict]) -> str:
    items = []
    for g in games:
        teams = g.get("teams")
        item: dict = {
            "id": game_id(g["slug"]),
            "slug": g["slug"],
            # these nine are written in Spanish; the page says so to a reader
            # who has the app in English, instead of handing them Spanish rules
            # with no explanation
            "textLocale": "es",
            "title": g["title"],
            "summary": g["summary"],
            "sections": sections_json(g["sections"]),
            "playersMin": g["players"][0],
            "playersMax": g["players"][1],
            "supportsTeams": bool(teams),
            "decks": [
                {
                    "deckSlug": d["slug"],
                    "quantity": d["quantity"],
                    **({"cardsRemoved": d["cards_removed"]} if d.get("cards_removed") else {}),
                    **({"note": d["note"]} if d.get("note") else {}),
                }
                for d in g["decks"]
            ],
            "deckCountTotal": sum(d["quantity"] for d in g["decks"]),
            "missingCardsPolicy": g["missing"],
            "requiresExtras": g["extras"],
            "mechanics": g["mechanics"],
            "adultOnly": g["adult"],
            # nobody has rated the seeded catalogue; the UI hides a zero count
            "ratingAvg": 0,
            "ratingCount": 0,
        }
        if g.get("tagline"):
            item["tagline"] = g["tagline"]
        if g.get("best"):
            item["playersBest"] = g["best"]
        if teams:
            item["teamSize"] = teams
        if g.get("missing_note"):
            item["missingCardsNote"] = g["missing_note"]
        item["durationMin"], item["durationMax"] = g["duration"]
        item["complexity"] = g["complexity"]
        item["ageMin"] = g["age_min"]
        items.append(item)

    # the TypeScript file keeps real accents: Vite reads it as UTF-8 and it never
    # travels through a clipboard. Only the SQL has to be ASCII.
    body = json.dumps(items, ensure_ascii=False, indent=2)
    return f"""import type {{ Game }} from '@/types/cards'

/**
 * GENERATED by supabase/gen_games.py from supabase/content/games.py.
 * Do not edit by hand: edit the content file and regenerate.
 *
 * This is the fallback catalogue the app shows when no Supabase project is
 * configured, and it is the same content as supabase/migrations/0003_seed_games.sql.
 */
export const SAMPLE_GAMES: Game[] = {body}

export const gameBySlug = (slug: string): Game | undefined =>
  SAMPLE_GAMES.find((g) => g.slug === slug)
"""


def main() -> None:
    games = load_games()
    sql_path = ROOT / "supabase/migrations/0003_seed_games.sql"
    ts_path = ROOT / "src/lib/sampleGames.ts"
    sql = to_sql(games)
    assert_ascii(sql_path.name, sql)
    sql_path.write_text(sql, encoding="utf-8")
    ts_path.write_text(to_typescript(games), encoding="utf-8")
    print(f"{len(games)} juegos")
    print(f"  {sql_path.relative_to(ROOT)}: {len(sql_path.read_text(encoding='utf-8').splitlines())} líneas")
    print(f"  {ts_path.relative_to(ROOT)}: {len(ts_path.read_text(encoding='utf-8').splitlines())} líneas")


if __name__ == "__main__":
    main()
