## What this slide teaches

The single fact the whole practical half of the session rests on: PostgreSQL
never modifies a row in place. An `UPDATE` appends a new version and marks the
old one as ended. Everything the audience finds surprising later — a table that
grows when rows are deleted, a `VACUUM` that frees nothing, an index that has
to be updated when a non-indexed column changes — follows from this one
screen.

## The mechanism

For `UPDATE shipments SET status = 'shipped' WHERE id = 2`:

1. Find the current version of row 2 at `(0,2)`.
2. Write a complete new tuple, all three columns, at the next free slot in the
   page — `(0,4)` here, because the page has room.
3. Set the old tuple's `t_xmax` to the current transaction id.
4. Set the old tuple's `t_ctid` to `(0,4)`: the forward pointer.
5. Update every index that covers a changed column. (Here: none. That makes
   this a HOT update, which is the slide near the end — do not open that now.)

On commit nothing else happens. The commit is a flag set in the commit log for
one transaction id, not a pass over the rows it touched. That is why a
transaction that updated a million rows commits as fast as one that updated
one.

### Why this design

The alternative is what most engines do: write the new value in place and keep
the old one in an undo log. That makes rollback expensive and readers
dependent on reconstructing old versions. PostgreSQL's choice makes a rollback
free — the new tuple is simply never visible — and reads of current data cheap,
at the cost of leaving the garbage in the table. The cost is the rest of this
session.

## Running it

Four blocks, four `Enter` presses. Give the second page dump time on screen and
read the changed columns out loud: line pointer 2 now has `t_xmax` set and
`t_ctid` `(0,4)`; line pointer 4 is new, with the new transaction as its
`t_xmin`.

The table is created by the slide rather than restored from the fixture, so
the slide can be entered cold and re-run — `DROP TABLE IF EXISTS` is why `r`
then a second run works.

`lp_flags` is 1 (`LP_NORMAL`) throughout here. It is on screen because the HOT
slide will show it as 2 and 0, and recognising it from earlier helps.

## If someone asks

- **Does `SELECT` see both versions?** No: `xmax` is set and committed, so the
  old version fails the visibility test for any snapshot taken after the
  commit. The full rule is session 4.
- **What if the page had been full?** The new version goes on another page,
  and the forward pointer crosses pages. That is the non-HOT case, and it
  forces an index update — the HOT slide covers it.
- **Is a rollback of the update free, then?** Yes. The new tuple stays in the
  page as garbage and is never visible to anyone. A rolled-back transaction
  bloats a table exactly as much as a committed one.
