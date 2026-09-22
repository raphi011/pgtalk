## What this slide teaches

That "the analyzer resolves names" is a literal statement about rows in tables
you can query. The catalog is not a metaphor for metadata; it is metadata
stored in ordinary PostgreSQL tables, queryable with ordinary SQL.

## The morph

Step 1 turns `SELECT email FROM customers WHERE id = 7;` into a sketch of the
analyzer's output. It is not the real node dump (`debug_print_parse` prints
pages of it), but every number is real:

- `relid 70445797` is the OID of `customers`. It is assigned when the fixture
  is built, so `just bootstrap` changes it; update the slide after a
  bootstrap, or the table on step 2 will contradict it.
- `attno 3` is `email`, `attno 1` is `id`.
- `type 25` is `text`, `type 23` is `int4`.
- `opno 96` is the `=` operator for `(int4, int4)`: even the operator was a
  name, looked up by its argument types. `SELECT 96::regoperator;` shows it.

Step 2's query prints `attrelid` and `atttypid` raw so the audience can match
them against the sketch before the `regtype` column translates them back.

## Reading the query

```sql
SELECT attrelid, attname, attnum, atttypid, atttypid::regtype AS type
FROM pg_attribute
WHERE attrelid = 'customers'::regclass AND attnum > 0
ORDER BY attnum;
```

- `pg_attribute` holds one row per column of every relation in the database.
- `'customers'::regclass` is the cast that does the analyzer's own job in
  miniature: it takes a name and gives back an OID. `regclass` is an OID type
  with a nice text representation, which is why the output of
  `oid::regclass` reads as a table name rather than a number.
- `atttypid::regtype` does the same for types: the column really stores an OID
  pointing into `pg_type`, and `regtype` renders it as `text`, `integer` and so
  on.
- `attnum > 0` filters out the system columns, which have negative attribute
  numbers (`ctid` is -1, `xmin` -3, `xmax` -4, and so on — those become
  session 2 and session 4 material).

## The `attnum` detail worth dwelling on

`attnum` is an identity, not a position. Drop a column and the row stays in
`pg_attribute` with `attisdropped = true`, keeping its number; the remaining
columns do not renumber. So a table can have columns 1, 2, 4, 5 and nothing
you can write in SQL will compact them.

Why this matters outside a trivia quiz:

- It explains why `ALTER TABLE ... DROP COLUMN` is instant and does not rewrite
  the table: it is a catalog flag, and the old values stay on disk until the
  rows are next rewritten.
- It explains why the physical layout of a row can contain dead space that
  `VACUUM FULL` alone does not reclaim, a thread that session 2 picks up.
- It is the reason to be wary of anything that depends on ordinal position —
  `SELECT *` into positional consumers, `INSERT` without a column list — on a
  table that has had columns dropped.

## Tying back

This table is the thing that made the previous slide's `HINT` possible. The
analyzer had exactly this list open when it failed to find `nope`, so it could
compare and suggest. Conversely the parser could not, because it runs before
any of this is consulted.

## If someone asks

- **Where does the OID itself come from?** `pg_class`, one row per table,
  index, view, sequence. `SELECT oid, relname, relkind FROM pg_class WHERE
  relname = 'customers';` if you want to show it.
- **Is the catalog cached?** Yes — each backend keeps a relcache and syscache,
  which is why repeated planning does not re-read these tables from disk.
