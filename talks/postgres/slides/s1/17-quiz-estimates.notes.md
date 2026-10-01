## What this question checks

That every number the planner produces is a prediction from stored
statistics (slide 6), and that a bad plan is usually a bad input rather than a
bad planner.

## Running it

Take the hands, then run the block. `shipped` and its frequency are in the
most-common-values list; the estimate on slide 9 was that frequency times
`reltuples`.

## The wrong answers

- **A** is the most common belief. Counting would cost as much as running the
  query; planning time does not grow with the table.
- **C** is how some other databases adapt. PostgreSQL keeps no feedback from
  past executions.
- **D** is what happens when there are *no* statistics for an expression, as
  with `id % 7` on slide 10. For a plain column there are.

## If someone asks

- **When are statistics refreshed?** By autovacuum's analyze pass once enough
  rows changed, or by a manual `ANALYZE`. After a bulk load, run it yourself.
