## What this slide teaches

Nothing new. It closes the session by naming the three things the audience now
owns and handing each one to the session that uses it.

## The three handovers

- **Session 3 — indexes.** An index entry is a key and a `ctid`. Every claim in
  this session about index maintenance costs — the non-HOT update, vacuum's
  index pass, the entry that still points at a dead tuple — becomes the reason
  an index is not free. The visibility map from slide 2 is what makes an
  index-only scan possible.
- **Session 4 — MVCC.** `xmin` and `xmax` have been on screen all session
  without a visibility rule attached. Session 4 is that rule, and the xmin
  horizon from slide 12 is where it starts.
- **Session 5 — locks.** The `ACCESS EXCLUSIVE` that blocked a `VACUUM FULL`
  behind one idle reader, and the `FOR KEY SHARE` in `orders`'s `t_xmax`, are
  both session 5.

## The Monday task

Deliberately three commands, not a project:

```sql
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 10;

SELECT pid, state, now() - xact_start AS open_for, query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC LIMIT 5;

SELECT relname, pg_size_pretty(pg_total_relation_size(oid))
FROM pg_class WHERE relkind = 'r' ORDER BY pg_total_relation_size(oid) DESC LIMIT 10;
```

If the first query's top table has more dead than live rows, the second query
usually explains why.

## What was deliberately left out

- **Freezing and transaction id wraparound.** It belongs with `xmin`, so it is
  session 4. Say so if asked — it is the one vacuum topic that can take a
  server down, and it deserves its own ten minutes rather than a footnote
  here.
- **`CLUSTER` and physical ordering.** It needs an index to order by, so it
  waits for session 3.
- **Index bloat specifically.** Same reason.
- **Partitioning.** A deployment topic that would eat the session.
