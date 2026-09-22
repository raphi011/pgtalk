## What this slide teaches

That the address of a row is `(page, line pointer)`, that it is visible from
SQL, and that pages per table is a number the audience can now derive rather
than look up.

The second block finishes the arithmetic started two slides ago: 3677 pages
hold 500 000 rows, so a page holds 135 of them. That is what session 1's cost
model ran on — `seq_page_cost` charged 3677 times, `cpu_tuple_cost` 500 000
times.

## The mechanism

`ctid` is a system column of type `tid`, present on every table, printed as
`(block, offset)`. Both parts are 1-based in the printed form except the block,
which is 0-based: the first row of a table is at `(0,1)`.

It is the cheapest possible access path — `WHERE ctid = '(0,1)'` is a Tid Scan,
one page read, no index — and the most dangerous thing to store, because the
address is only valid until the next update of that row. A `ctid` written to
an application table becomes a pointer to a different row's slot, silently.

### Rows per page, exactly

135 here, because an `orders` tuple is 56 bytes on disk (23-byte header,
padding, five fixed-width columns) plus 4 bytes of line pointer, into 8168
usable bytes. The next slide takes that tuple apart.

This is the number that makes a table's size predictable: halving the row
width doubles the rows per page and halves every sequential scan. Column order
is the free half of that, and it is on the next slide.

## Running it

The first block shows rows 1 and 2 on page 0 and row 500000 near page 3676 —
`placed_at` is correlated with `id` by design (see the seed's comment), so the
physical order matches the logical one here. Do not promise that in general:
it is true of an append-only table and false as soon as anything updates.

The second block computes 135 rows per page. Tie it back to session 1 out
loud: that is where the `cost=0.00..8677.00` on the sequential
scan came from — 3677 page reads at 1.0 plus 500000 tuples at 0.01.

## If someone asks

- **Is `ctid` stable if I do not touch the row?** Until something else on the
  page prunes or the table is rewritten. `VACUUM FULL` and `CLUSTER` change
  every `ctid` in the table.
- **Can I order by `ctid` to get insertion order?** It approximates it on a
  table that has never been updated or vacuumed. Rely on it for nothing.
- **What is the maximum table size, then?** 32 TB per relation with 8 kB pages,
  from the 32-bit block number.
