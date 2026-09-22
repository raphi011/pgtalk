# Postgres Under The Hood — presentation series.
# Talks to the locally installed PostgreSQL (S4).

demo    := "pgtalk_demo"
fixture := "pgtalk_fix_orders"

default:
    @just --list

# Build the fixture template database from schema + seed, then the demo database.
bootstrap: _build-fixture reset
    @echo "bootstrap complete"

_build-fixture:
    dropdb --if-exists {{fixture}}
    createdb {{fixture}}
    psql -q -v ON_ERROR_STOP=1 -d {{fixture}} -f db/schema.sql
    psql -q -v ON_ERROR_STOP=1 -d {{fixture}} -f db/seed.sql

# Restore the demo database from the fixture template (E4).
reset:
    dropdb --if-exists --force {{demo}}
    createdb --template={{fixture}} {{demo}}

# Run the deck.
dev:
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
