#!/usr/bin/env python3
"""Bundle the migrations into files to paste into the Supabase SQL Editor.

Two bundles, because the SQL Editor runs a paste as one unit: on an existing
project, re-running the schema migration fails on "type already exists" and that
error would abort everything after it, repair included.

  apply-to-supabase.sql   every migration. For a brand new, empty project.
  apply-content.sql       the data migrations only (decks and games). Safe to run
                          as many times as you like on an existing project: the
                          inserts upsert, so this is also the repair script.

Both are pure ASCII (see supabase/sqlgen.py).

Run:  python3 supabase/gen_apply.py
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from sqlgen import assert_ascii  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROJECT = "iqxiykqweqzsvyqahbsk"
EDITOR = f"https://supabase.com/dashboard/project/{PROJECT}/sql/new"


def header(title: str, body: str, files: list[pathlib.Path]) -> str:
    listed = "\n".join(f"--    {p.name}" for p in files)
    return f"""-- ===========================================================================
--  Cartas - {title}
--
--  Pegar TODO este fichero en el SQL Editor de Supabase y pulsar Run:
--  {EDITOR}
--
{body}
--
--  Contiene:
{listed}
--
--  GENERADO por supabase/gen_apply.py. Todo el fichero es ASCII puro: los
--  acentos y los palos de la baraja van codificados, para que ningun
--  portapapeles ni ninguna codificacion de Windows pueda romperlos. Por eso se
--  lee raro aqui y se lee bien en la app.
-- ===========================================================================

"""


def bundle(path: pathlib.Path, title: str, body: str, files: list[pathlib.Path]) -> None:
    parts = [header(title, body, files)]
    for src in files:
        parts.append(
            f"\n-- ======================= {src.name} =======================\n\n"
            + src.read_text(encoding="utf-8")
        )
    text = "".join(parts)
    assert_ascii(path.name, text)
    path.write_text(text, encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}: {len(text.splitlines())} lineas")


def main() -> None:
    migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
    # Content migrations are the generated ones, and only those: they upsert, so
    # re-running them is safe and is how a damaged row gets repaired. Schema
    # migrations (create table, alter table) fail on a second run, so they must
    # never end up in the re-runnable bundle. The marker is written by the
    # generators themselves, so a new generated file is classified without
    # anyone remembering to update a list here.
    content = [
        p for p in migrations
        if "GENERADO por supabase/gen_" in p.read_text(encoding="utf-8")
    ]
    pending_note = [p.name for p in migrations if p not in content]

    bundle(
        ROOT / "supabase/apply-to-supabase.sql",
        "montar la base de datos entera",
        "--  Para un proyecto NUEVO y vacio. Crea las tablas, los permisos, los\n"
        "--  mazos y los juegos. En un proyecto que ya tiene tablas fallara con\n"
        "--  \"already exists\": en ese caso usa apply-content.sql.",
        migrations,
    )
    print("  (esquema: " + ", ".join(pending_note) + ")")
    bundle(
        ROOT / "supabase/apply-content.sql",
        "mazos y juegos (re-ejecutable)",
        "--  Solo contenido: no toca las tablas ni los permisos. Se puede ejecutar\n"
        "--  tantas veces como quieras, y cada vez deja los mazos y los juegos\n"
        "--  exactamente como dice el repositorio. Es tambien el arreglo si algun\n"
        "--  texto se guardo mal.",
        content,
    )


if __name__ == "__main__":
    main()
