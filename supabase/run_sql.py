#!/usr/bin/env python3
"""Run a one-off .sql file against the Supabase project and print what it returns.

    python3 supabase/run_sql.py supabase/make-owner.sql

For scripts that are not migrations: promoting the owner, inspecting a table,
fixing one row. Migrations go through supabase/migrate.py, which keeps a ledger;
this deliberately does not, because these are meant to be run when needed.

Connection and TLS come from migrate.py, so there is one place that knows how to
reach the project.
"""
import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("cartas_migrate", HERE / "migrate.py")
assert spec is not None and spec.loader is not None
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: run_sql.py <file.sql> [more.sql ...]")

    con = migrate.connect(migrate.read_env())
    for name in sys.argv[1:]:
        path = pathlib.Path(name)
        print(f"\n== {path.name} ==")
        for stmt in migrate.statements(path.read_text(encoding="utf-8")):
            rows = con.run(stmt)
            head = " ".join(stmt.split())[:70]
            if rows:
                print(f"  {head}")
                for row in rows[:20]:
                    print("     ", row)
            else:
                print(f"  {head}  (sin filas)")
    con.close()


if __name__ == "__main__":
    main()
