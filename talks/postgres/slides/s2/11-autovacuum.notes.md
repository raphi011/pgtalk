## What this slide teaches

That vacuuming is automatic, that the trigger is a *proportion* of the table,
and that the proportion is the wrong shape for large tables. Also where to
look — `pg_stat_user_tables` — when someone reports that "autovacuum is not
running".

## The mechanism

The autovacuum launcher wakes every `autovacuum_naptime` (60 s) and starts a
worker per database that needs one, up to `autovacuum_max_workers` (3). A
worker vacuums a table when

```
n_dead_tup > autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor * reltuples
           = 50                          + 0.2                            * reltuples
```

and analyses it on the same shape of rule with a 0.1 scale factor. Since
PostgreSQL 13 there is a second trigger for inserts alone
(`autovacuum_vacuum_insert_threshold`, 1000), so an append-only table gets its
visibility map maintained rather than never being touched.

`n_dead_tup` comes from the cumulative statistics system, which is a set of
counters backends flush as they work — not a scan. It is an estimate, and it
is reset by a crash.

### Why the scale factor is the problem

20% of 10 000 rows is nothing. 20% of 100 million rows is 20 million dead
tuples, gigabytes of file, and a vacuum that then has to read all of it in one
long pass. The standard remedy is per-table settings on the few large, hot
tables:

```sql
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.02,
                        autovacuum_vacuum_threshold    = 5000);
```

### Why a worker seems to "not run"

- **Cost limits.** A worker sleeps `autovacuum_vacuum_cost_delay` (2 ms by
  default since PG 12) every `autovacuum_vacuum_cost_limit` units of I/O. On a
  large table with the historical 20 ms default this throttles a vacuum to a
  crawl, and the table gets dirtier faster than the worker cleans it.
- **Worker starvation.** Three workers across hundreds of tables, each taking
  minutes.
- **It ran and freed nothing.** The next slide — an old snapshot makes dead
  tuples unremovable, and vacuum reports success having achieved nothing.
- **It is switched off for that table**, as here.

## Running it

The `reloptions` column shows `{autovacuum_enabled=off}`: this deck's own
fixture. Say it out loud — the numbers on the previous three slides depended on
no worker interfering, and hiding that would be dishonest.

The `ANALYZE` block before the last one is not decoration. A fixture restore
copies the database's data, and the cumulative statistics are not part of a
database copy — so every counter starts at zero and `orders` only has numbers
because it was just analysed. Two things fall out of that, both worth saying:
`ANALYZE` refreshes the dead-tuple estimate as well as the planner's
histograms, and the counters on the other two tables stay at zero, which is
what a table nobody has touched since the statistics were reset looks like.

## If someone asks

- **Should I ever disable autovacuum?** For a table you are bulk-loading and
  will vacuum manually at the end, briefly. Never as a permanent setting, and
  never globally — wraparound protection runs through the same workers.
- **Can I make it more aggressive safely?** Lower the scale factor per table,
  and raise `autovacuum_vacuum_cost_limit` or lower the delay. Vacuum is mostly
  I/O, so the ceiling is the disk.
- **Does it lock anything?** Same as a manual `VACUUM`: no exclusive lock, and
  it yields if something else wants one.
- **Why is my small queue table bloated despite autovacuum?** Usually a long
  transaction (next slide), or the table is vacuumed constantly but the index
  never gets a chance to shrink.
