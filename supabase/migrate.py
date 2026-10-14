#!/usr/bin/env python3
"""Apply pending migrations straight to the Supabase project.

    python3 supabase/migrate.py                # apply what is pending
    python3 supabase/migrate.py --status       # list applied and pending, change nothing
    python3 supabase/migrate.py --dry-run      # say what it would apply
    python3 supabase/migrate.py --mark-applied # adopt a database already migrated by hand

Credentials come from supabase/.env (git-ignored):

    SUPABASE_PROJECT_REF=...
    SUPABASE_DB_PASSWORD=...
    SUPABASE_DB_HOST=...      # optional, skips region discovery

Why this exists: every schema change used to mean pasting a file into the SQL
Editor by hand, and the Windows clipboard silently corrupted the accents on the
way in once already. This applies the same files, in order, each in its own
transaction, and records what it applied in `schema_migrations` so it never runs
one twice.

TLS is verified against Supabase's own root (supabase/supabase-root-2021-ca.crt,
taken from the chain the pooler serves). Python 3.13+ adds a strict X.509 check
that this 2021 root does not satisfy - no keyUsage extension - so that one flag
is cleared; chain and hostname verification stay on.
"""
import pathlib
import ssl
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

ROOT = pathlib.Path(__file__).resolve().parent.parent
CA = ROOT / "supabase/supabase-root-2021-ca.crt"
MIGRATIONS = ROOT / "supabase/migrations"

REGIONS = [
    "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-2",
    "eu-north-1", "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "ca-central-1", "sa-east-1", "ap-south-1", "ap-southeast-1",
    "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
]


def read_env() -> dict[str, str]:
    path = ROOT / "supabase/.env"
    if not path.exists():
        raise SystemExit(
            "supabase/.env is missing. Create it with SUPABASE_PROJECT_REF and "
            "SUPABASE_DB_PASSWORD (the database password from Settings -> Database, "
            "not the Supabase account password)."
        )
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() == "" or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=str(CA))
    ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
    return ctx


def connect(env: dict[str, str]):
    import pg8000.native

    ref = env.get("SUPABASE_PROJECT_REF", "")
    password = env.get("SUPABASE_DB_PASSWORD", "")
    if ref == "" or password == "":
        raise SystemExit("supabase/.env needs SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD")

    hosts = (
        [env["SUPABASE_DB_HOST"]]
        if env.get("SUPABASE_DB_HOST")
        else [f"{p}-{r}.pooler.supabase.com" for p in ("aws-1", "aws-0") for r in REGIONS]
    )

    ctx = ssl_context()
    wrong_password_at: list[str] = []
    for host in hosts:
        try:
            con = pg8000.native.Connection(
                user=f"postgres.{ref}", password=password, host=host, port=5432,
                database="postgres", ssl_context=ctx, timeout=12,
            )
            print(f"connected: {host}")
            if len(hosts) > 1:
                print(f"  tip: put SUPABASE_DB_HOST={host} in supabase/.env to skip the search")
            return con
        except Exception as exc:
            message = (
                exc.args[0].get("M", str(exc))
                if exc.args and isinstance(exc.args[0], dict)
                else str(exc)
            )
            # "tenant not found" just means the project does not live in that region
            if "not found" in message:
                continue
            if "password authentication failed" in message:
                wrong_password_at.append(host)
                continue
            print(f"  {host}: {message[:120]}")

    if wrong_password_at:
        raise SystemExit(
            "The project was found at "
            + ", ".join(wrong_password_at)
            + "\nbut the password was rejected. SUPABASE_DB_PASSWORD must be the *database*"
            "\npassword: Supabase dashboard -> Settings -> Database -> Database password"
            "\n(Reset it there if you do not have it; the account login password is a"
            "\ndifferent thing and will not work here)."
        )
    raise SystemExit("Could not reach the project on any pooler region.")


def ensure_ledger(con) -> set[str]:
    con.run("""
        create table if not exists schema_migrations (
          name       text primary key,
          applied_at timestamptz not null default now(),
          sha256     text not null
        )
    """)
    return {row[0] for row in con.run("select name from schema_migrations")}


def statements(text: str) -> list[str]:
    """Split on ';' but never inside a $$ body, a quoted string or a comment."""
    out: list[str] = []
    buf: list[str] = []
    i, n = 0, len(text)
    in_dollar = in_str = in_comment = False
    while i < n:
        ch, two = text[i], text[i : i + 2]
        if in_comment:
            buf.append(ch)
            in_comment = ch != "\n" and in_comment
            i += 1
            continue
        if in_dollar:
            if two == "$$":
                buf.append(two)
                in_dollar = False
                i += 2
                continue
            buf.append(ch)
            i += 1
            continue
        if in_str:
            if ch == "'":
                if text[i + 1 : i + 2] == "'":
                    buf.append("''")
                    i += 2
                    continue
                in_str = False
            buf.append(ch)
            i += 1
            continue
        if two == "--":
            in_comment = True
            buf.append(two)
            i += 2
            continue
        if two == "$$":
            in_dollar = True
            buf.append(two)
            i += 2
            continue
        if ch == "'":
            in_str = True
            buf.append(ch)
            i += 1
            continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


def main() -> None:
    import hashlib

    args = set(sys.argv[1:])
    env = read_env()
    files = sorted(MIGRATIONS.glob("*.sql"))
    if not files:
        raise SystemExit(f"no migrations in {MIGRATIONS}")

    con = connect(env)
    applied = ensure_ledger(con)
    pending = [f for f in files if f.name not in applied]

    print(f"\n{len(applied)} applied, {len(pending)} pending")
    for f in files:
        print(f"  {'applied' if f.name in applied else 'PENDING'}  {f.name}")

    if "--status" in args:
        return

    if "--mark-applied" in args:
        # Adopting a database that was migrated by hand: record the files as
        # applied without running them. Guarded, because doing this to a database
        # that has NOT had them applied would hide missing tables behind a tidy
        # ledger: the check is that the schema this repo creates is really there.
        if applied:
            raise SystemExit(
                "the ledger already has entries; --mark-applied is only for adopting "
                "a database for the first time"
            )
        present = con.run("""select count(*) from information_schema.tables
                              where table_schema = 'public'
                                and table_name in ('games','decks','matches',
                                                   'friend_groups','deck_folders')""")[0][0]
        if present < 5:
            raise SystemExit(
                f"only {present} of the 5 expected tables exist, so these migrations have "
                "not all been applied. Run without --mark-applied instead."
            )
        for f in pending:
            con.run(
                "insert into schema_migrations (name, sha256) values (:n, :h)",
                n=f.name,
                h=hashlib.sha256(f.read_text(encoding="utf-8").encode()).hexdigest(),
            )
        print(f"\nmarked {len(pending)} migrations as applied, ran none of them")
        return
    if not pending:
        print("\nnothing to do")
        return
    if "--dry-run" in args:
        print("\n--dry-run: nothing was applied")
        return

    for f in pending:
        text = f.read_text(encoding="utf-8")
        parts = statements(text)
        print(f"\napplying {f.name} ({len(parts)} statements)")
        con.run("begin")
        try:
            for stmt in parts:
                con.run(stmt)
            con.run(
                "insert into schema_migrations (name, sha256) values (:n, :h)",
                n=f.name,
                h=hashlib.sha256(text.encode()).hexdigest(),
            )
            con.run("commit")
            print("  ok")
        except Exception as exc:
            con.run("rollback")
            message = (
                exc.args[0].get("M", str(exc))
                if exc.args and isinstance(exc.args[0], dict)
                else str(exc)
            )
            raise SystemExit(f"  FAILED, rolled back: {message}")

    print("\ndone")


if __name__ == "__main__":
    main()
