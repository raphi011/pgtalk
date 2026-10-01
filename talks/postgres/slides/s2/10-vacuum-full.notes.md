## What this slide teaches

That there is a way to get the disk back, that it is not a tuning knob but a
rewrite, and that its cost is a lock rather than CPU. The blocked state on
screen is the argument — most people have read "VACUUM FULL locks the table"
and have not watched a single idle `SELECT` hold it off.

## The mechanism

`VACUUM FULL` takes `ACCESS EXCLUSIVE` on the table, creates a new empty
relfilenode, copies every live tuple into it in physical order, rebuilds every
index against the new addresses, and drops the old file. It is `CLUSTER`
without an ordering column.

Consequences, in the order they bite:

- **It waits for every existing reader.** `ACCESS EXCLUSIVE` conflicts with
  everything including `ACCESS SHARE`, which a plain `SELECT` holds for the
  duration of its transaction.
- **Everything after it waits too.** PostgreSQL's lock queue is ordered: a new
  `SELECT` arriving while the `VACUUM FULL` is waiting queues behind it, even
  though the two `SELECT`s would not have conflicted with each other. One
  forgotten open transaction therefore turns a maintenance command into a full
  outage of that table.
- **It needs the space twice.** Both copies exist until the swap, so a table
  with no room to double cannot be vacuumed full.
- **Every `ctid` changes**, so every index is rebuilt — which is why it is
  often faster than the alternatives, and why it invalidates anything that
  cached a row address.

`pg_repack` achieves the same compaction by building a copy, keeping it in
sync with triggers, and taking the exclusive lock only for the final swap. It
is an extension; on a managed service check it is available before promising
it.

## Running it

Four `Enter` presses: `s2` opens its transaction, `s1` starts the rewrite and
the badge goes to `blocked` with the lock it is waiting on, `s2` commits, and
the rewrite completes in well under a second.

The blocked badge is doing the teaching. Leave it on screen and say what is
holding it: a transaction that did one trivial read and is now idle, holding
`ACCESS SHARE` until it commits. That is a web request that opened a
transaction and then called a slow HTTP API.

There is no timeout here and there is not supposed to be one (E2) — the
statement would wait for ever.

If `s1` is still blocked and you want out without committing `s2`, the block's
own **cancel** button works.

## If someone asks

- **Can I avoid the queueing?** Set `lock_timeout` before the `VACUUM FULL`,
  so it gives up rather than accumulating a queue behind it. That is the
  standard safety measure for any DDL on a live table.
- **Does `VACUUM FULL` need `VACUUM` first?** No, it supersedes it.
- **When should I run it at all?** After a one-off event that left a table
  permanently oversized — a bulk delete, a migration — and not on a schedule.
  Routine bloat is autovacuum's job.
- **Is `TRUNCATE` an alternative?** Only if losing the rows is acceptable. It
  takes the same lock.
