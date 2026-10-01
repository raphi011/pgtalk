## What this slide teaches

Where big values go, that compression happens before relocation, and the
practical consequence: the column list in a query decides whether the TOAST
table is read at all.

## The mechanism

TOAST — The Oversized-Attribute Storage Technique — applies to variable-length
types. When a tuple would exceed `TOAST_TUPLE_THRESHOLD` (about 2 kB, a
quarter of a page), PostgreSQL works on its widest variable-length columns in
turn:

1. **Compress** the value (LZ4 or pglz, per `default_toast_compression`).
2. If the row still does not fit, **move the value out of line**: split it into
   ~2 kB chunks, insert them into the table's TOAST relation, and store an
   18-byte pointer in the row.

The TOAST relation is a normal table — `pg_toast.pg_toast_<oid>`, with its own
index on chunk id and sequence number — and it has its own vacuum needs, its
own bloat, and its own entry in `pg_total_relation_size`.

Per-column strategies (`ALTER TABLE ... ALTER COLUMN ... SET STORAGE`):

- `EXTENDED` — compress, then move out of line. The default for `text`,
  `bytea`, `json`, `jsonb`.
- `EXTERNAL` — move out of line without compressing. Faster for substring
  access on large values, since a compressed value must be decompressed whole.
- `MAIN` — compress and keep in line if at all possible.
- `PLAIN` — neither. The only option for fixed-width types.

### Why the column list matters

The pointer is dereferenced only when the value is read. A query that selects
`id` and `kind` from a table whose rows are mostly a TOASTed `body` reads the
heap pages and stops. A `SELECT *` fetches every chunk of every row it
returns, from a different table, through an index, one value at a time. On a
table of documents that is the difference between a scan and an outage.

The same fact makes wide TOASTed columns cheaper than they look for filtering:
they are not in the heap pages, so they do not widen the rows a sequential scan
reads.

## Running it

The three rows are chosen to show the three outcomes: small enough to ignore,
large but compressible, large and incompressible. 40 000 characters at 477
bytes is the number that gets a reaction.

`pg_column_size` reports the stored size including the length header, so the
100-character value costs 101 bytes and the out-of-line one reports its full
64 000 — the function reports the value's size, not the row's footprint.

The last block's `heap` of 8192 bytes next to a 120 kB total is the payoff:
three rows, one heap page, everything else in the TOAST table and its index.

## If someone asks

- **Can I see the TOAST table's contents?** Yes, as superuser:
  `SELECT * FROM pg_toast.pg_toast_<oid>`. The chunks are `bytea`.
- **What is the maximum value size?** 1 GB per value, and you do not want to
  be near it. Streaming large objects (`lo_*`) exist for that case.
- **Does TOAST make updates cheaper?** Yes, when the big column does not
  change: an update rewrites the heap tuple and reuses the existing TOAST
  pointer, so a 1 MB document is not copied. If the value does change, the old
  chunks become dead rows in the TOAST table.
- **LZ4 or pglz?** LZ4 is faster at both ends and usually compresses a little
  worse. It needs a build with LZ4 support, which most packages have.
