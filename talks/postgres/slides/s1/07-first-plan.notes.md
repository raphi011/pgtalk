## What this slide teaches

The anatomy of a single plan node, on the simplest possible plan, before any
`ANALYZE` numbers exist to distract from it.

## Reading the node aloud

```
Index Scan using customers_pkey on customers  (cost=0.42..8.44 rows=1 width=28)
  Index Cond: (id = 42)
```

- **Node type** — what the executor will do here.
- **`cost=0.42..8.44`** — two numbers, not one.
- **`rows=1`** — how many rows the planner expects this node to emit.
- **`width=28`** — expected average bytes per emitted row.
- **`Index Cond`** — the condition pushed into the index itself, as opposed to
  a `Filter`, which is applied to rows after they are fetched. That distinction
  is worth planting now; it is the whole of session 3.

## The two costs

The first number is **start-up cost**: work done before the first row can be
emitted. The second is **total cost**: work to emit all rows.

For an index scan on a primary key, start-up is the descent through the B-tree
(0.42) and total adds fetching the row. For nodes that must see everything
before answering — `Sort`, `Hash`, most aggregates — start-up is nearly the
whole cost, and that is exactly what makes them different.

Why it matters practically: `LIMIT` prices a plan as
`start-up + (total − start-up) × limit / rows`. A plan with a high start-up
cost gets no benefit from a small `LIMIT`, and a plan with a low one gets
almost all of it. That is why adding `LIMIT 10` can flip the planner to a
completely different plan shape, and why "add a LIMIT and it got slower" is a
real thing that happens when the chosen index order does not match the
`ORDER BY`.

## Everything here is a guess

Say this explicitly while pointing at the line:

- `rows=1` is a guess — a good one, since a primary-key equality can emit at
  most one row, but still produced by arithmetic and not by looking.
- `width=28` is a guess, from average column widths in the statistics.
- The costs are guesses.
- There is **no time anywhere on this line**, because nothing ran. `EXPLAIN`
  without `ANALYZE` executes nothing.

The one exception worth mentioning if it comes up: `EXPLAIN` does execute
functions in an `EXPLAIN (ANALYZE)` sense only; plain `EXPLAIN` on a query
containing a volatile function in the target list still does not run it, but
`EXPLAIN ANALYZE` of an `INSERT` genuinely inserts. Wrap it in a transaction
and roll back if you are demonstrating that.

## The question on the slide

Key 2, once the plan has run and the numbers are on screen.
"Two numbers separated by `..` — what is the difference between them?" Let them
answer. The common guesses are "min and max" or "best and worst case"; the
right answer is "first row and last row", and the moment of correcting that is
what makes the `LIMIT` behaviour make sense later.
