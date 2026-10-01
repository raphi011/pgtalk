## What this question checks

The xmin horizon (slide 12): a vacuum that runs and removes nothing is almost
always waiting on an old snapshot, not badly tuned.

## The wrong answers

- **A** runs more vacuums that each remove nothing.
- **C** is a real cost of updates (slide 13, HOT), and not why cleanup stops.
- **D** blocks every query on the table while it runs, and the table grows
  back if the transaction is still open.

## The query

```sql
SELECT pid, state, backend_xmin, now() - xact_start AS open_for, query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC;
```

The usual culprits: `idle in transaction` sessions from an application that
forgot to commit, long reports on a primary, and on a primary with
`hot_standby_feedback` on, a long query on a replica. Replication slots and
prepared transactions hold the horizon too and do not show up here.
