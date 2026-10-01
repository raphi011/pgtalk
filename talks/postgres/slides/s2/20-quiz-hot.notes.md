## What this question checks

The two conditions for a heap-only tuple (slide 13).

## The wrong answers

- **A** changes an indexed column, so the `customer_id` index needs a new
  entry, and then every index gets one, since the version is no longer
  heap-only.
- **C** misses the first condition.
- **D** is true of an update that is not HOT, which is why HOT matters: on a
  table with five indexes it saves five index writes, and five index entries
  for vacuum to clear later.

## If someone asks

- **How do I make room on the page?** A `fillfactor` below 100 leaves free
  space on each page for updates to land in. Worth it on a heavily updated
  table with unindexed columns that change.
- **How do I know it is working?** `n_tup_hot_upd` against `n_tup_upd` in
  `pg_stat_user_tables`.
