## What this slide teaches

That vacuum's power is bounded by the oldest snapshot on the server, and that
a single idle transaction anywhere in the cluster can therefore make every
table in it grow without limit. It is the most common real cause of runaway
bloat and the least obvious from the vacuum's own output, which reports
success.

## The mechanism

A tuple can only be removed once no snapshot could still need it. The bound is
the **xmin horizon**: the oldest transaction id that any running transaction's
snapshot considers in progress. Vacuum computes it, and refuses to remove any
tuple whose `xmax` is newer.

`s2`'s `REPEATABLE READ` transaction took its snapshot at its first statement
and holds it until commit, so the horizon stops there. The `UPDATE` afterwards
produces 100 000 dead versions, all newer than the horizon, all unremovable.

`READ COMMITTED` differs in an important way: it takes a new snapshot per
statement, so an idle `READ COMMITTED` transaction that is between statements
holds no snapshot — but it still holds its locks, and `backend_xmin` stays set
while a statement is running. "Idle in transaction" is dangerous for both
reasons; the snapshot case is the one that bloats.

Other holders of the horizon, all of which cause the same symptom:

- A replica with `hot_standby_feedback = on`, whose queries hold back the
  primary's horizon across the network.
- A replication slot that is not being consumed.
- A prepared transaction nobody committed (`pg_prepared_xacts`).
- A long `pg_dump`, which is exactly a long `REPEATABLE READ` transaction.

### Finding it

```sql
SELECT pid, state, backend_xmin, now() - xact_start AS open_for, query
FROM pg_stat_activity
WHERE backend_xmin IS NOT NULL
ORDER BY age(backend_xmin) DESC;
```

The defence is `idle_in_transaction_session_timeout`, set to something an
application has no business exceeding. Session 5 comes back to this from the
lock side.

## Running it

Seven blocks; it is the longest slide in the session and it earns it. The two
`pgstattuple` readings are the before and after of one commit, with the
identical `VACUUM` in between.

The `backend_xmin` block shows two rows — `s2`'s snapshot and the querying
backend's own — and the `open_for` column is the one to read aloud: the
transaction holding everything up has been open for seconds and has done
nothing with them.

Both sessions are reset when the slide changes (E4), so a `COMMIT` left unrun
cannot follow you to the next slide.

## If someone asks

- **Would autovacuum have done better?** No. It computes the same horizon.
  This is not a vacuum configuration problem, and turning vacuum up makes it
  worse — more passes, each freeing nothing.
- **Does `VACUUM` say so?** `VACUUM (VERBOSE)` reports "N are dead but not yet
  removable" and the removable cutoff. It is not in the default output, which
  is why the symptom looks like vacuum is not running.
- **Is a long-running `SELECT` as bad as an idle transaction?** For the
  horizon, yes — the difference is that the long `SELECT` is at least doing
  something. Both hold back cleanup for the whole cluster.
- **What about `VACUUM FULL`?** Same horizon, same refusal. It also cannot
  remove what might still be needed.
