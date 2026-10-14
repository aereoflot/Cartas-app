#!/usr/bin/env bash
# Apply the migrations to a throwaway local Postgres and run the schema tests.
# No Docker, no sudo, no Supabase account: downloads a prebuilt Postgres on first run.
#
#   ./supabase/tests/run.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# deliberately outside the repo: the repo lives in OneDrive and these are ~100 MB of binaries
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/cartas-pgtest"
PGROOT="$CACHE/pg"
PGDATA="$CACHE/data"
VENV="$CACHE/venv"
export PGHOST=127.0.0.1 PGPORT="${PGPORT:-54329}" PGUSER=postgres PGDATABASE=verify
export LD_LIBRARY_PATH="$PGROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
mkdir -p "$CACHE"

if [ ! -x "$PGROOT/bin/postgres" ]; then
  echo "==> fetching Postgres binaries (first run only)"
  BASE=https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64
  VER=$(curl -sSL --max-time 60 "$BASE/maven-metadata.xml" \
        | grep -o '<version>[^<]*</version>' | sed 's/<[^>]*>//g' \
        | grep -E '^17\.' | tail -1)   # pinned to 17 to match Supabase
  curl -sSL --max-time 300 "$BASE/$VER/embedded-postgres-binaries-linux-amd64-$VER.jar" \
       -o "$CACHE/pg.jar"
  rm -rf "$CACHE/jar" "$PGROOT" && mkdir -p "$CACHE/jar" "$PGROOT"
  python3 -I -m zipfile -e "$CACHE/pg.jar" "$CACHE/jar"
  tar -xJf "$(find "$CACHE/jar" -name '*.txz' | head -1)" -C "$PGROOT"
  echo "    postgres $VER"
fi

if [ ! -x "$VENV/bin/python" ]; then
  echo "==> creating python venv with pg8000"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q pg8000
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "==> initdb"
  "$PGROOT/bin/initdb" -D "$PGDATA" -U postgres --auth=trust --no-sync -E UTF8 >/dev/null
fi

running=0
"$PGROOT/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 && running=1
if [ "$running" -eq 0 ]; then
  echo "==> starting postgres on $PGHOST:$PGPORT"
  # TCP, not a unix socket: socket paths over 107 bytes are rejected
  "$PGROOT/bin/pg_ctl" -D "$PGDATA" -l "$CACHE/pg.log" -w \
    -o "-h $PGHOST -p $PGPORT -c fsync=off -c listen_addresses=$PGHOST" start >/dev/null
  STARTED_HERE=1
fi
cleanup() {
  if [ "${STARTED_HERE:-0}" = "1" ]; then
    "$PGROOT/bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> applying migrations"
"$VENV/bin/python" -I "$ROOT/supabase/tests/apply.py" --fresh \
  "$ROOT/supabase/tests/auth_stub.sql" \
  "$ROOT"/supabase/migrations/*.sql

echo "==> schema tests"
"$VENV/bin/python" -I "$ROOT/supabase/tests/schema_test.py"
