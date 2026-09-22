## What this slide teaches

The central slide of the session. Everything before it is scaffolding for this:
a query where the planner's arithmetic is flawless and its answer is off by a
factor of 29, with the reason visible and fixable.

Slow down here.

## What is happening

```sql
SELECT count(*) FROM orders WHERE id % 7 = 0;
```

One row in seven matches — about 14.3% of the table, roughly 71,428 of 500,000
rows. The planner estimates 2,500, which is 0.5%.

Why 0.5%: the planner has full statistics on the column `id` — a histogram,
most-common values, `n_distinct` — but it has no statistics whatsoever on the
*expression* `id % 7`. The statistics describe a column; the predicate is about
a derived value. Faced with an opaque expression it cannot see through,
`clause_selectivity` falls back to a hard-coded default,
`DEFAULT_EQ_SEL = 0.005` in `selfuncs.c`. That constant is the estimate. It is
not derived from your data in any way.

So the tree shows `rows=2500` against `rows=71428`, and the panel marks it
about 29× off.

## Why it does not matter here, and why that is the lesson

On this query the misestimate costs nothing. There is one scan and one
aggregate; whether the planner expected 2,500 rows or 71,428, the only
available plan is "read the table and count". Say that plainly — it stops the
audience concluding that a bad estimate is automatically a bad day.

The damage appears the moment the estimate feeds a *decision*:

- Put this predicate on one side of a join. The planner sees 2,500 rows and
  chooses a nested loop, which is the right algorithm for 2,500 iterations and
  a catastrophe for 71,428.
- Feed it into a `Hash`. The hash table is sized for 2,500 rows, overflows its
  `work_mem` budget, and spills to disk in batches.
- Feed it into a `Sort`. Same story: a quicksort in memory becomes an external
  merge sort on disk.

This is the mechanism behind "the query was fine for a year and then one day it
took four minutes". Nothing was slow. One estimate was wrong, and the wrong
estimate chose the wrong algorithm.

## The fixes, in order of preference

There is no hint syntax in PostgreSQL, by design. What you do instead is give
the planner statistics it can actually use:

1. **An expression index** — `CREATE INDEX ON orders ((id % 7))`. Creating it
   also creates statistics on the expression, so the estimate improves even for
   queries that never use the index to scan.
2. **Extended statistics** — `CREATE STATISTICS ... ON (id % 7) FROM orders;`
   then `ANALYZE orders;`. Available since PostgreSQL 14 for expressions, and
   the right tool when you want the estimate without paying for an index.
3. **Store the value as a column** — a generated column carries ordinary
   per-column statistics and needs no special handling at all.
4. **Rewrite the predicate** so it is sargable against the column itself, where
   the shape of the query permits it.

The first three all come down to the same move: make the thing the planner is
estimating into a thing `ANALYZE` measures.

## Related default constants, if asked

`DEFAULT_EQ_SEL` 0.005 for equality, `DEFAULT_INEQ_SEL` 0.3333 for an open-ended inequality,
`DEFAULT_RANGE_INEQ_SEL` 0.005 for a bounded range, `DEFAULT_MATCH_SEL` 0.005
for pattern matching. Seeing `rows` equal to exactly 0.5% or exactly a third of
a table is a strong signal that the planner is guessing blind.

## The question on the slide

Key 2 shows the question with the plan. Ask for the fraction before running it. The room will reason from the data —
"one in seven, so 14%" — which is exactly the reasoning the planner cannot do,
and that is what makes the reveal land.
