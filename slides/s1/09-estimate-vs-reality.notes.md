## What this slide teaches

The shape of an `EXPLAIN (ANALYZE, BUFFERS)` line, on a plan where the planner
happens to be right. Showing a correct plan first matters: it establishes what
"agreement" looks like, so the disagreement on the next slide is visible as an
anomaly rather than as the normal state of things.

## Reading the node now

```
Seq Scan on orders  (cost=0.00..8677.00 rows=500000 width=0)
                    (actual time=0.008..38.2 rows=500000 loops=1)
  Buffers: shared hit=3677
```

Two brackets, and the whole session is the relationship between them:

- `cost` — prediction, in page-read units.
- `actual time` — measurement, in milliseconds, **per loop**.
- `rows` appears in both: estimated and actual.
- `loops` — how many times this subtree was executed.
- `Buffers` — 8 kB pages touched.

## `rows 500000 → 500000`

The planner was right, and it is worth saying why: counting a whole table needs
no selectivity estimate at all. There is no `WHERE`, so the row count is just
`reltuples`. The planner is only ever guessing when it has to answer "what
fraction of rows survive this condition?" — and here it does not have to.

That framing sets up the next slide precisely: break the selectivity estimate
and everything falls over, while the size numbers stay perfectly correct.

## `hit` versus `read`

- `shared hit` — the page was already in `shared_buffers`, PostgreSQL's own
  cache. Roughly a memcpy.
- `shared read` — the page was not, so PostgreSQL asked the operating system
  for it. That may still be an OS page-cache hit rather than physical I/O;
  PostgreSQL cannot tell the difference and neither can the plan.

Practical consequence: a plan with small times and large `read` counts is a
plan that has not been punished yet. The same plan on a cold cache, or on a
server where this table no longer fits in memory, can be orders of magnitude
slower with an identical tree. That gap is most of session 2.

Here everything is a `hit`, because the fixture was restored moments ago and
500k rows fit comfortably in shared buffers.

## The overhead caveat

`EXPLAIN ANALYZE` instruments every node, and on plans that emit millions of
rows the timing instrumentation itself can add tens of percent. If a query is
fast in the application and slow under `EXPLAIN ANALYZE`, that is why.
`EXPLAIN (ANALYZE, TIMING OFF)` gives row counts without the clock overhead.
