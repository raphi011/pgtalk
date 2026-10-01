# Shared presentation commands (S5).
default:
    @just --list

install:
    pnpm install --frozen-lockfile

# A database-free talk needs only the presentation server (S5).
dev: install
    pnpm dev

# PostgreSQL owns its machine setup and fixture commands (S4).
postgres command="psql":
    just --justfile talks/postgres/justfile {{command}}

# Preserve the original PostgreSQL command names (S5).
setup:
    just postgres setup

bootstrap:
    just postgres bootstrap

reset:
    just postgres reset

psql:
    just postgres psql

sizes:
    just postgres sizes

# Prove the PostgreSQL session layer against a running dev server (E1, E2, E4).
smoke:
    node test/lab-smoke.mjs

# Exercise collection navigation and optional Lab controls (F4d, F4e, S5).
collection-smoke:
    node test/collection-smoke.mjs

# Use 'just shots s2' for legacy PostgreSQL shorthand, or 'just shots example s1' (F4e).
shots talk="postgres" session="s1":
    node test/shoot-session.mjs {{talk}} {{session}}
