# Talks

A collection of live, presenter-driven MDX talks on a fixed 1600×900 stage,
with stepped diagrams and sibling background notes.

- **Postgres Under The Hood:** a five-session series about PostgreSQL internals.
  Sessions 1 and 2 are written; SQL runs against the presenter's local PostgreSQL.
- **A small idea:** a tiny example showing the shared engine without a database.

Shared decisions live in [DESIGN.md](DESIGN.md); PostgreSQL decisions live in
[talks/postgres/DESIGN.md](talks/postgres/DESIGN.md).

## Running it

Needs Node, pnpm and [just](https://github.com/casey/just).

```sh
just dev                  # http://127.0.0.1:5173 — choose a talk
```

The collection and example need no PostgreSQL. For the PostgreSQL talk, also
install Homebrew and run:

```sh
just postgres setup       # install/start PostgreSQL and build fixtures
just postgres bootstrap   # rebuild fixtures if needed
just postgres psql        # demo database shell
```

The original `just setup`, `bootstrap`, `reset`, `psql` and `sizes` remain aliases.

Keys: `→`/`←` step (`Space` also advances), `↓`/`↑` slide, `n` notes,
`g` find a slide within this talk (left/right change session), `?` shortcuts.
PostgreSQL adds `Enter` to run the first unrun visible block, then the last,
`1`–`9` to run the nth, `r` to reset the fixture, and `` ` `` for the SQL REPL.
`?` or `Esc` closes the shortcut popup.

Positions use `#/postgres/s1/12/3` (talk/session/zero-based slide/step).
Old `#/s1/12/3` links still work. **All talks** returns to the collection.

## Adding a talk

Add `talks/<id>/talk.ts` with a default manifest containing `title` and ordered
`sessions`; add `lab: "postgres"` only when SQL demos are needed. Put slides
and sibling notes in `talks/<id>/slides/<session>/NN-name.mdx` and
`NN-name.notes.md`. Metadata uses ESM exports (`title`, and optionally
`fixture`). Talks own their assets and any setup files.

## Checks

```sh
npx tsc --noEmit -p .
just smoke                  # PostgreSQL session layer against a running server
just collection-smoke       # collection, routes, optional Lab and keyboard help
just shots postgres s2      # all slides; fail on console errors or stage overflow
just shots example s1
just shots s2               # PostgreSQL shorthand
node test/shoot.mjs 'postgres/s1/3/0:ArrowRight,Enter'
```

PostgreSQL smoke and screenshot checks share the Lab with open tabs: they
restore fixtures and reset sessions, so run them outside a presentation.
