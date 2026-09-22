# Postgres Under The Hood

A live talk series explaining how PostgreSQL works: MDX slides with
step-built diagrams and SQL that runs against a real PostgreSQL server on
the presenter's machine.

Five sessions of about 35 minutes — a query's life, storage, indexes,
transactions and MVCC, concurrency in practice. Sessions 1 and 2 are written;
`DESIGN.md` records the decisions behind the rest.

## Running it

Needs a local PostgreSQL (18 at the time of writing), Node and
[just](https://github.com/casey/just).

```sh
pnpm install
just bootstrap   # build the fixture template databases and the demo copy
just dev         # http://127.0.0.1:5173
```

Keys: `→`/`←` step, `↓`/`↑` slide, `Enter` run the last visible block,
`1`–`9` run the nth, `e` edit SQL, `r` reset the fixture, `n` notes, `` ` `` REPL,
`g` jump to a slide.

## Checks

```sh
just smoke       # session layer against a running dev server
just shots s2    # screenshot every slide of a session, fail on any console error
```
