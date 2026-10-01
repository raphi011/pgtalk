## What this slide teaches

That not all updates cost the same: an update that touches no indexed column
and fits on its own page is dramatically cheaper, and the difference is
visible in the page. This is the lever behind two pieces of practical advice —
do not index columns that churn, and lower `fillfactor` on tables that do.

## The mechanism

An update is **HOT** (Heap-Only Tuple) when both hold:

1. No indexed column changed.
2. The new version fits on the same page as the old one.

Then PostgreSQL writes the new version into that page, sets `HEAP_HOT_UPDATED`
on the old tuple and `HEAP_ONLY_TUPLE` on the new one, and writes **no index
entries at all**. Index entries keep pointing at the original line pointer;
a reader arriving there follows the `t_ctid` chain within the page to the
version its snapshot wants.

What that saves, per update:

- One entry per index, plus the WAL for each. On a table with six indexes that
  is most of the cost of the statement.
- The index bloat those entries would become.
- Vacuum's index pass for them later — a HOT chain is prunable by any page
  access, without touching an index, because nothing outside the page points
  into it.

After pruning, the chain's original line pointer becomes `LP_REDIRECT`: it
holds no tuple, only the offset of the current one. That is what keeps the old
index entries valid while the tuples they nominally point at are recycled.

### Fillfactor

Condition 2 is the one you control. `fillfactor` (default 100 for heaps) tells
inserts to leave a percentage of each page empty, reserved for later HOT
updates:

```sql
ALTER TABLE shipments SET (fillfactor = 85);
```

It costs disk and sequential scan time proportionally — 85 means 15% more
pages for the same rows — and it pays off only on a table that is updated
often. Set it on the queue table, not on the append-only one. Existing pages
are unaffected until they are rewritten.

### The counters

`pg_stat_user_tables.n_tup_upd` and `n_tup_hot_upd` are the production
measurement: the ratio between them is how much of this you are getting. They
are not on the slide because the cumulative statistics do not survive a fixture
restore and lag by up to half a second, which reads on stage as the demo being
broken.

## Running it

Six blocks. The two page dumps are the slide; the flag lists are long, so
point at the one word that differs — `HEAP_ONLY_TUPLE` present, then absent.

The second update changes the primary key, which is a deliberately blunt way
of touching an indexed column. If someone objects that nobody updates a
primary key: any indexed column does this, a `status` column with an index on
it included, and that is exactly the queue-table case.

The `VACUUM` block must stay a block of its own — `VACUUM` cannot run inside a
transaction, and a block of several statements is sent as one.

## If someone asks

- **Does HOT work if the page is full?** No, and that is the whole reason
  `fillfactor` exists. A full page forces the new version elsewhere and with it
  an index entry per index.
- **Does an index on an unchanged column block HOT?** No — only indexes whose
  columns actually changed matter. Six indexes are free if you update a
  seventh, unindexed column.
- **Do expression and partial indexes count?** Yes, if the expression's inputs
  changed. A partial index counts if the column appears in it at all.
- **Is there a downside?** Long HOT chains cost a little on each read until
  they are pruned, and pruning is a page write that a `SELECT` may end up
  doing.
