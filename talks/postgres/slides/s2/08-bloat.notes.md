## What this slide teaches

Bloat, caused on stage in under two seconds, by a statement that changes no
data at all. The point is not that `UPDATE` is expensive — it is that the cost
is proportional to rows touched, not to bytes changed, and that the space is
not given back.

## The mechanism

`UPDATE orders SET status = status` is a no-op semantically and a full rewrite
physically: 500 000 new tuples appended, 500 000 old tuples marked with
`t_xmax`. PostgreSQL does not compare the old and new values to skip identical
rows, and it could not usefully do so — triggers, rules and the row version
semantics all depend on the update happening.

The file goes from 29 MB to 57 MB. Not quite double, because the new versions
pack into whatever free space the existing pages had before extending the
file.

Once it has happened, every sequential scan reads both halves. The dead
tuples are checked for visibility and discarded, one by one. A table that is
80% dead does five times the I/O for the same answer — and session 1's cost
model prices it that way too, because `relpages` is what the planner multiplies
by `seq_page_cost`.

### The real-world shapes

- A job/queue table: insert, `claimed`, `running`, `done` — four versions per
  row, and the table is small enough that nobody looks at it until the index
  is 90% dead.
- `UPDATE users SET last_seen_at = now()` on every request.
- Nightly `UPDATE ... SET` over a partition that mostly rewrites unchanged
  values.
- An `ON CONFLICT DO UPDATE` upsert loop.

In every one, the row count is stable and the file grows.

## Running it

The `UPDATE` takes about two seconds on this dataset, which is long enough to
say the sentence about changing nothing while it runs.

The `pgstattuple` block at the end is the honest measurement: it reads every
page and reports actual dead bytes, as against the estimate in
`pg_stat_user_tables`. It is expensive on a real table — a full scan — so it is
a diagnosis tool, not a monitoring one.

Autovacuum is switched off for `orders` in this session's fixture. Without
that, a worker would notice 500 000 dead tuples within a minute and quietly
clean up the table the next three slides are about. Say so if the numbers are
questioned; it is a deck constraint, not a claim about PostgreSQL.

## If someone asks

- **Would `WHERE status IS DISTINCT FROM 'x'` have helped?** Yes, enormously,
  and it is the practical fix: never update a row to the value it already has.
  A `WHERE` clause that excludes the no-op rows turns this into zero work.
- **Does a rolled-back `UPDATE` bloat as much?** Exactly as much.
- **How do I know if my table is bloated?** `pg_stat_user_tables.n_dead_tup`
  for cheap monitoring, `pgstattuple` for a definitive answer on one table, and
  the `pgstattuple_approx` function for a compromise.
