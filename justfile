# Postgres Under The Hood — presentation series.
# Talks to the locally installed PostgreSQL (S4).

demo    := "pgtalk_demo"
fixture := "pgtalk_fix_orders"
storage := "pgtalk_fix_storage"
bloat   := "pgtalk_fix_bloat"

default:
    @just --list

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

# Screenshot every slide of a session, failing on any console error.
shots session="s1":
    node test/shoot.mjs $(seq 0 $(($(ls slides/{{session}}/*.mdx | wc -l) - 1)) | sed 's|^|{{session}}/|;s|$|/9|' | tr '\n' ' ')
