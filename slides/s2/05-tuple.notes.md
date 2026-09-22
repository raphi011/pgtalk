## What this slide teaches

That every row version carries 23 bytes of bookkeeping, and that two of those
fields — `xmin` and `xmax` — are what make the rest of this session, and all of
session 4, possible. It also smuggles in the one piece of practical advice in
this half of the talk: column order changes row width.

## The mechanism

`HeapTupleHeaderData`, in order:

| field | bytes | meaning |
|---|---|---|
| `t_xmin` | 4 | transaction that inserted this version |
| `t_xmax` | 4 | transaction that deleted or locked it, else 0 |
| `t_cid` / `t_xvac` | 4 | command id within the transaction |
| `t_ctid` | 6 | this tuple's own address, or the next version's |
| `t_infomask2` | 2 | column count plus flags (HOT, key updated) |
| `t_infomask` | 2 | visibility and format flags |
| `t_hoff` | 1 | offset to the data |

23 bytes, then an optional null bitmap of `ceil(natts/8)` bytes, then padding
to the alignment the first column needs, then the values.

### `t_ctid` points at itself

For a live, never-updated tuple `t_ctid` equals the tuple's own address. When
an `UPDATE` writes a new version, the old tuple's `t_ctid` is set to the new
version's address — a forward pointer. Following that chain is how a
transaction that read the old version finds the current one. The next slide
watches it happen.

### Why `xmax` is already set on `orders`

If someone inspects `orders` instead of `order_items` they will see `t_xmax`
non-zero on rows nobody has ever updated. That is a lock, not a delete:
`order_items` has a foreign key to `orders`, and inserting a child row takes a
`FOR KEY SHARE` lock on the parent, which is recorded in the parent's `t_xmax`
with `HEAP_XMAX_LOCK_ONLY` set. `order_items` has no inbound foreign key, which
is why the slide inspects that table and gets clean zeros.

This is worth knowing before someone asks it from the floor. It is also a
preview of session 5: a lock that lives in the tuple rather than in shared
memory is how PostgreSQL avoids a lock table entry per row.

### Column order, concretely

Alignment is per column, to the type's own requirement (`int` to 4, `bigint`
and `timestamptz` to 8, `text` to 1). Declaring

```sql
CREATE TABLE t (a int, b bigint, c int);   -- 4 + 4 pad + 8 + 4 = 20 bytes of data
CREATE TABLE t (b bigint, a int, c int);   -- 8 + 4 + 4     = 16 bytes of data
```

is 44 bytes against 40 measured with `pg_column_size(t.*)`, header included —
four bytes a row, for free, and only at `CREATE TABLE` time. Mention it, do not dwell: it matters at
hundreds of millions of rows and is noise below that.

## Running it

The first block is the same page from the previous slide, read as tuples
rather than as bytes: `lp_off` descending as tuples fill from the back,
`lp_len` constant at 48 bytes, `t_ctid` equal to each tuple's own `(0,n)`.

The second decodes the flag bits. `HEAP_XMIN_COMMITTED` is the visibility
cache — the first reader to establish that `xmin` committed writes the flag
back into the tuple, so later readers do not consult the commit log. That is
why the first `SELECT` after a bulk load can be slower than the second, and it
is a write, on a `SELECT`.

## If someone asks

- **Can I see `xmin` without pageinspect?** Yes: `SELECT xmin, xmax, ctid FROM …`.
  pageinspect adds the dead tuples, which SQL cannot see.
- **Is 23 bytes per row not enormous for a narrow table?** It is. A table of
  two `int` columns is 8 bytes of data in a 32-byte footprint. Row stores are
  not for that shape of data.
- **Does `DROP COLUMN` reclaim its width?** No. It marks the attribute dropped
  and leaves the bytes in every existing row. Only a rewrite removes them.
