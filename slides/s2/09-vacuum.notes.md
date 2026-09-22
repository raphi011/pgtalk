## What this slide teaches

The two-part answer to "what does `VACUUM` do": it removes dead tuples and
records their space in the free space map, and it does *not* give the space
back. The second half is the one that surprises people, and the third block is
the payoff — a vacuumed table stops growing, which is the actual goal.

## The mechanism

A `VACUUM` of one table:

1. Scans the pages it must visit — with the visibility map, only those with
   possibly-dead tuples, which is why a mostly-static table vacuums almost for
   free.
2. Collects the `ctid`s of dead tuples.
3. Visits every index and removes entries pointing at them. This is the
   expensive half, and the reason vacuum cost scales with index count.
4. Returns to the heap, marks the line pointers `LP_UNUSED`, defragments each
   page, and updates the free space map.
5. Updates the visibility map for pages that are now all-visible.
6. Advances `relfrozenxid` where it can, freezing old tuples — the wraparound
   half of vacuum, which belongs to session 4.

The file only shrinks in one case: if the *trailing* pages are entirely empty,
vacuum truncates them, and that needs a brief `ACCESS EXCLUSIVE` lock which it
gives up rather than waits for. Space in the middle of the file stays in the
file.

### The free space map is the point

Before the vacuum, `pg_freespace` reports zero usable bytes across 7353 pages
even though 46% of them are dead tuples. The map records what is *known* free,
and nothing had recorded it. That is why the churn on the previous slide
extended the file instead of filling the holes it had just made.

After the vacuum, 29 MB is on record, and the next churn of the same size fits
inside it.

## Running it

Entering this slide restores the `bloat` fixture — `orders` already churned
once, which is what the previous slide did live. So it can be walked into or
jumped to and the numbers are the same.

The `UPDATE` in block 7 takes about two seconds again. The punchline is block
8 showing 57 MB unchanged, and it is worth pausing before revealing it: ask
the room whether the file will grow.

`pgstattuple` reads every page, so the first and third blocks each take a
moment on a 57 MB table. That is the price of an exact answer; `n_dead_tup` in
`pg_stat_user_tables` is the cheap estimate, and after a template restore it
starts at zero, which is why this slide does not use it.

## If someone asks

- **How do I actually get the disk back?** `VACUUM FULL`, `CLUSTER`, or
  `pg_repack`. The next slide.
- **Is a 2× table bad?** A steady-state overhead of some tens of percent is
  normal and healthy — it is the working space. A table that is ten times its
  live data is a problem.
- **Does `VACUUM` block anything?** No `ACCESS EXCLUSIVE` lock, so reads and
  writes continue throughout. Only the optional truncation at the end takes
  one, and it yields.
- **Why is it not automatic?** It is — autovacuum, two slides on. It is
  switched off for this table in this deck so these numbers hold still.
