## What this question checks

The pull model (slide 11): a node produces a row only when its parent asks for
one, so a node that stops asking stops all the work below it.

## The wrong answers

- **A**, **C** and **D** all end in an aggregate. `count`, `max` and a
  per-group count cannot answer until the input is exhausted, so the scan runs
  to the end of the table.
- **C** is the tempting one. With an index on `total_cents` the planner would
  read one entry from the end of it; without one, `max` is a full scan.

## If someone asks

- **How early does B stop?** After the tenth matching row. How far into the
  table that is depends on where the shipped orders sit, which is why the same
  `LIMIT` query can be instant on one table and slow on another.
