## What this slide teaches

The planner's complete job description: three inputs, one arithmetic model, one
output. None of the inputs is the data itself.

## The three inputs

### 1. Statistics (`pg_statistic`, readable via `pg_stats`)

Collected by `ANALYZE`, which runs as part of autovacuum. For each column it
samples rows — 300 × `default_statistics_target` (default 100, so ~30,000 rows)
regardless of table size — and stores summaries:

- `null_frac` — fraction of NULLs;
- `n_distinct` — number of distinct values, or a negative number meaning "this
  fraction of the table";
- **most common values** and their frequencies (`most_common_vals`,
  `most_common_freqs`);
- a **histogram** of the remaining values (`histogram_bounds`);
- `correlation` — how well physical order matches logical order, which is what
  makes an index scan cheap or expensive.

Also in `pg_class`: `relpages` and `reltuples`, the table's size picture.

The sample being a fixed size is the source of a great deal of real-world pain:
on a 500-million-row table the histogram is built from the same 30,000 rows as
on a 500-thousand-row one.

### 2. Cost constants

`seq_page_cost` (1.0), `random_page_cost` (4.0), `cpu_tuple_cost` (0.01),
`cpu_index_tuple_cost` (0.005), `cpu_operator_cost` (0.0025). These are
`postgresql.conf` settings with defaults chosen for spinning disks in the late
1990s. On NVMe, `random_page_cost = 4.0` overstates the penalty for random I/O
badly, which is why lowering it to 1.1–2.0 is the single most common sensible
tuning change.

They are also unitless *relative* numbers: everything is expressed as multiples
of one sequential page read.

### 3. Candidate plans

Access paths per relation (sequential scan, index scan, index-only scan, bitmap
heap scan), join orders, join algorithms (nested loop, hash, merge). The search
is exhaustive over join orders up to `geqo_threshold` relations (12 by default)
and a genetic algorithm above that — which means very large joins get a plan
that is good, not provably cheapest.

## The model

Cost is arithmetic over those numbers. No I/O happens, nothing is sampled at
plan time, no row is read. Planning a query on a 500-million-row table takes
about as long as planning it on an empty one.

## The one line that matters

**A plan can be wrong while the planner is working perfectly.** The planner is
a function of its inputs; when the output is bad, one of the inputs was stale,
missing or inapplicable:

- stale statistics — `ANALYZE` has not run since a bulk load;
- missing statistics — nothing exists for an expression, which is the next
  slide but two;
- inapplicable constants — `random_page_cost` describing a disk you do not own;
- correlated columns the model assumes are independent.

Each of those has a different fix, and none of them is a query hint —
PostgreSQL deliberately has no hint syntax, on the argument that a hint freezes
a decision that should be re-made as the data changes.

## If someone asks

- **When does `ANALYZE` run?** Autovacuum triggers it after roughly
  `autovacuum_analyze_threshold + 0.1 × reltuples` changed rows. After a bulk
  load, run it manually — the trigger may be minutes away.
- **Can I see the statistics?** `SELECT * FROM pg_stats WHERE tablename =
  'orders';` — worth a live detour if the room is interested.
