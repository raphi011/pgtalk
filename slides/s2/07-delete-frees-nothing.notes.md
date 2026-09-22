## What this slide teaches

That `DELETE` is a marking operation, not a freeing operation, and therefore
that "we deleted half the table and it got no smaller" is correct behaviour
rather than a bug. This is the single most common question the storage layer
produces in the wild.

## The mechanism

`DELETE` sets `t_xmax` on the current version and writes a WAL record. That is
all it does to the heap. The tuple keeps its bytes, its line pointer, its
`t_ctid` pointing at itself, and its position in the page.

A tuple is *dead* once no running or future snapshot can see it — that is,
once `xmax` has committed and every transaction that could still be using an
older snapshot has ended. Dead is not the same as removed. Removal happens in
one of two places:

- **Opportunistic pruning.** Any access to a page can prune it: dead tuples on
  that page are removed, their line pointers set to `LP_DEAD` or `LP_UNUSED`,
  and the free space coalesced. This is cheap and local, and it is why a page
  sometimes cleans itself without a vacuum ever running.
- **`VACUUM`.** A full pass over the table, which can also clear the index
  entries — the part pruning cannot do on its own.

The line pointer cannot be freed while an index entry might still point at it.
That is the whole reason `VACUUM` has to visit the indexes: to remove the
references before the slots can be reused.

## Running it

The first block builds the table and deletes one row in a single statement
batch, so the page dump is the interesting screen rather than the fourth one.

`t_xmin` and `t_xmax` are the same number on the deleted tuple because one
statement batch inserted and deleted it, so one transaction did both. On a
real delete they differ.

Point at the live row count of 2 next to a file that is one full page,
containing three tuples. The size does not move, and it is not supposed to.

The third note is the one to say slowly: *not merely allocated, not yet
reusable*. Most people assume deleted space is free space. Until it is in the
free space map it is neither.

## If someone asks

- **`TRUNCATE`?** Different mechanism entirely: it writes a new empty file and
  drops the old one, so it is O(1) and returns the space immediately. It also
  takes an `ACCESS EXCLUSIVE` lock and cannot be filtered.
- **Does the deleted row's index entry disappear?** No. It still points at the
  dead tuple, and an index scan that finds it must visit the heap to discover
  it is dead. That is why an unvacuumed table makes index scans slower too.
- **When does pruning happen on its own?** On a page access that finds dead
  tuples and can take the necessary lock — including during a plain `SELECT`.
  It never touches indexes, so it can only mark line pointers dead, not free
  them.
