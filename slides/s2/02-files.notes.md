## What this slide teaches

That "storage" is not an abstraction with a vendor-specific implementation
hidden behind it: it is a file whose path you can print, whose size you can
read, and whose growth the rest of the session explains.

It also does the arithmetic that the next slide needs: 29 MB of file is 3677
blocks of 8192 bytes, and the block is the unit of every read the server does.
Without that number on screen first, the page anatomy slide opens inside
something the audience has not been told exists.

It also plants the two side forks. The free space map is the answer to "what
did `VACUUM` accomplish if the file did not shrink", and the visibility map is
half of why an index-only scan is possible in session 3. Both land better for
having been seen once before they are needed.

## The mechanism

`pg_class.relfilenode` is the number the file is named after; `oid` is the
identity the catalog uses. They start equal and diverge: anything that rewrites
a table — `VACUUM FULL`, `CLUSTER`, most forms of `ALTER TABLE ... TYPE` —
writes a new file with a new `relfilenode` and drops the old one. That is why
`TRUNCATE` is fast and why `VACUUM FULL` needs room for a second copy of the
table.

The path is relative to the data directory (`SHOW data_directory`):

```
base/<database oid>/<relfilenode>
base/<database oid>/<relfilenode>_fsm
base/<database oid>/<relfilenode>_vm
```

Segments after the first are `<relfilenode>.1`, `.2`, and so on, each up to 1 GB
(`--with-segsize` at build time, 1 GB everywhere in practice). The limit is
historical — filesystems that could not hold larger files — and is kept because
it makes the smgr layer's arithmetic simple.

### The forks

- **main** — the pages of tuples. Everything else this session is about this.
- **fsm** — a tree of one-byte free-space categories, one leaf per page. The
  granularity is coarse (32 categories) on purpose: it is a hint for where to
  put the next tuple, not an allocator.
- **vm** — two bits per page: all-visible and all-frozen. Set by `VACUUM`,
  cleared by any write to the page.

`pg_total_relation_size` adds indexes and the TOAST relation to the main fork,
which is why it is bigger than `pg_relation_size` even here.

## Running it

Two blocks. The first is five numbers: Worth pointing at: the fsm is 24 kB and the vm 8 kB
against a 29 MB table, so the bookkeeping is a rounding error on the data.

The `vm` being non-empty at all is because the seed ran `ANALYZE` and an
earlier vacuum touched the table; on a freshly loaded table it is often 0
bytes until the first `VACUUM`.

The second block divides the file by `block_size` and gets 3677. Say the
division out loud — it is the only arithmetic in the session that everything
else rests on, and the next four slides are all about what is inside one of
those 3677.

`block_size` is read from `current_setting` rather than typed as 8192, because
it is a compile-time constant and a listener on a differently built cluster
should see their own number.

## If someone asks

- **Can I find my table's file from the shell?** Yes:
  `SHOW data_directory`, then join it to `pg_relation_filepath`. Do not open it
  with anything that writes.
- **Why is the file named after a number?** So a rename is a catalog update,
  and so a rewrite can swap files atomically.
- **Is one file per table a problem with many tables?** At tens of thousands of
  tables, yes — directory scans and file descriptor counts start to show up.
  It is a known cost of many-tenant-schema designs.
