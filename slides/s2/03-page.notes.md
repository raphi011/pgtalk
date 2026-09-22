## What this slide teaches

The internal layout of one page — the diagram opens by picking one cell out of
the file drawn on the previous slide, so the zoom is on screen rather than in
the presenter's sentence —  in enough detail that `ctid` on the next
slide is obvious rather than magic, and that the line pointer is understood as
a level of indirection. Everything later in the session — the forward pointer
left by an `UPDATE`, the redirect left by a HOT prune, the dead stub that
`VACUUM` frees — is a line pointer doing something.

## The mechanism

A page is `BLCKSZ` bytes, 8192 by default and effectively always. Its layout:

| part | size | grows |
|---|---|---|
| `PageHeaderData` | 24 bytes | fixed |
| line pointer array | 4 bytes each | forwards from byte 24 |
| free space | whatever is left | shrinks |
| tuples | variable | backwards from the end |
| special space | 0 for a heap | fixed at the end |

The header fields that matter here are `pd_lower` (end of the line pointer
array) and `pd_upper` (start of the tuple data). The free space is exactly
`pd_upper - pd_lower`, which is what the block on the slide computes.

`special` is 8192 — the end of the page — because heap pages have no special
area. Index pages do: a B-tree keeps its sibling pointers there, which is
session 3.

The dashed outline in the diagram is the page itself; everything that appears
later appears inside it. The strip of cells above it is the file from the
previous slide, with the one page this slide is about picked out.

### The line pointer

`ItemIdData` is 4 bytes: a 15-bit offset, a 15-bit length and 2 flag bits.
The flags are the interesting part, and all four values appear later this
session:

- `LP_UNUSED` — free, reusable.
- `LP_NORMAL` — points at a tuple.
- `LP_REDIRECT` — points at another line pointer on the same page (HOT).
- `LP_DEAD` — the tuple is gone but the slot cannot be reused yet, because an
  index may still point at it.

### Why the indirection exists

An index entry stores a `ctid`. If a tuple's byte offset within its page were
the address, defragmenting a page would invalidate every index entry pointing
into it. With line pointers, the page can move its tuples around to coalesce
free space and just update the offsets in place — which is what `VACUUM` does
when it prunes a page.

## Running it

`lower - 24` is the line pointer array in bytes; divide by 4 for the count.
On page 0 of `orders` that is 136 pointers and 8 bytes of free space: the page
is full, and the next insert went elsewhere. Saying the division out loud is
worth more than adding a column for it.

## If someone asks

- **Can I change the page size?** Only by recompiling, and then only for a new
  cluster. Do not.
- **Why 8 kB?** It predates everything, and it is a compromise between wasted
  space on small rows and page-level lock and WAL granularity. Larger pages
  make full-page images in WAL more expensive.
- **Is the free space in the middle usable for a new tuple of any size?** Only
  if the tuple plus its 4-byte line pointer fit. The fill factor setting (slide
  on HOT) deliberately keeps some of it in reserve.
