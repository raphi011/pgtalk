# Postgres Under The Hood — presentation series.
# Talks to the locally installed PostgreSQL (S4).

demo    := "pgtalk_demo"
fixture := "pgtalk_fix_orders"
storage := "pgtalk_fix_storage"
bloat   := "pgtalk_fix_bloat"
pg      := "postgresql@18"

default:
    @just --list

# One-time machine setup: PostgreSQL via Homebrew (S4), dependencies, fixtures.
# Safe to re-run: each step skips what is already in place.
setup:
    command -v pg_isready >/dev/null || brew install {{pg}}
    brew services start {{pg}}
    until pg_isready -q; do sleep 0.5; done
    just install bootstrap

# Build every fixture template from schema + seed, then the demo database.
bootstrap: _build-fixtures reset
    @echo "bootstrap complete"

# Fixtures beyond `orders` are built by copying the one before them rather
# than by re-running the seed: a template copy takes under a second, and the
# seed takes tens.
_build-fixtures:
    dropdb --if-exists --force {{fixture}}
    createdb {{fixture}}
    psql -q -v ON_ERROR_STOP=1 -d {{fixture}} -f db/schema.sql
    psql -q -v ON_ERROR_STOP=1 -d {{fixture}} -f db/seed.sql
    dropdb --if-exists --force {{storage}}
    createdb --template={{fixture}} {{storage}}
    psql -q -v ON_ERROR_STOP=1 -d {{storage}} -f db/fixtures/storage.sql
    dropdb --if-exists --force {{bloat}}
    createdb --template={{storage}} {{bloat}}
    psql -q -v ON_ERROR_STOP=1 -d {{bloat}} -f db/fixtures/bloat.sql

# Restore the demo database from the fixture template (E4).
reset:
    dropdb --if-exists --force {{demo}}
    createdb --template={{fixture}} {{demo}}

# Install dependencies exactly as the lockfile pins them.
install:
    pnpm install --frozen-lockfile

# Run the deck. Installs first, so a fresh checkout starts without a separate
# step; on an up-to-date checkout the install is a no-op.
dev: install
    @pg_isready -q || { echo "PostgreSQL is not running; run just setup"; exit 1; }
    pnpm dev

# Open a psql shell on the demo database.
psql:
    psql -d {{demo}}

# Sizes of the demo tables, for sanity.
sizes:
    psql -d {{demo}} -c "SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS size, reltuples::bigint AS rows FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY pg_total_relation_size(oid) DESC;"

# Prove the session layer against a running `just dev` (E1, E2, E4).
smoke:
    node test/lab-smoke.mjs

# Screenshot every slide of a session, failing on any console error.
shots session="s1":
    node test/shoot.mjs $(seq 0 $(($(ls slides/{{session}}/*.mdx | wc -l) - 1)) | sed 's|^|{{session}}/|;s|$|/9|' | tr '\n' ' ')
