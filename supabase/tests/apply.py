"""Apply .sql files to a database, splitting statements $$-aware.

Usage: python apply.py [--fresh] file.sql [file.sql ...]
Connection comes from PGHOST / PGPORT / PGUSER / PGDATABASE.
"""
import os, sys, pg8000.native

PG = dict(host=os.environ.get("PGHOST", "127.0.0.1"),
          port=int(os.environ.get("PGPORT", "55432")),
          user=os.environ.get("PGUSER", "postgres"))
DB = os.environ.get("PGDATABASE", "verify")

def split_sql(text):
    """Split on ';' but never inside a $$...$$ body or a '...' literal or -- comment."""
    out, buf, i, n = [], [], 0, len(text)
    in_dollar = in_str = in_line_comment = False
    while i < n:
        c = text[i]
        two = text[i:i+2]
        if in_line_comment:
            buf.append(c)
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
        if in_dollar:
            if two == '$$':
                buf.append(two); in_dollar = False; i += 2; continue
            buf.append(c); i += 1; continue
        if in_str:
            if c == "'":
                if text[i+1:i+2] == "'":
                    buf.append("''"); i += 2; continue
                in_str = False
            buf.append(c); i += 1; continue
        if two == '--':
            in_line_comment = True; buf.append(two); i += 2; continue
        if two == '$$':
            in_dollar = True; buf.append(two); i += 2; continue
        if c == "'":
            in_str = True; buf.append(c); i += 1; continue
        if c == ';':
            stmt = ''.join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []; i += 1; continue
        buf.append(c); i += 1
    tail = ''.join(buf).strip()
    if tail:
        out.append(tail)
    return out

def run(con, path, label):
    stmts = split_sql(open(path, encoding='utf-8').read())
    for k, s in enumerate(stmts, 1):
        try:
            con.run(s)
        except Exception as e:
            head = ' '.join(s.split())[:160]
            print(f"\nFAIL {label} stmt {k}/{len(stmts)}: {head}\n  -> {e}")
            return False
    print(f"OK   {label}: {len(stmts)} statements")
    return True

args = [a for a in sys.argv[1:] if a != "--fresh"]
if "--fresh" in sys.argv[1:]:
    admin = pg8000.native.Connection(**{**PG, "database": "postgres"})
    admin.run(f"drop database if exists {DB}")
    admin.run(f"create database {DB}")
    admin.close()
    print(f"-- fresh database {DB!r}")

con = pg8000.native.Connection(**PG, database=DB)
ok = True
for arg in args:
    label = arg.split('/')[-1]
    ok = run(con, arg, label) and ok
    if not ok:
        break
sys.exit(0 if ok else 1)
