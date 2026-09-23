## What this question checks

That a `ctid` is the physical address of one row version (slide 4), and that
an update produces a new version rather than changing the old one (slide 6).

## Running it

Take the hands, then run both blocks. The second reports the new `ctid`
against the first, so the first block leaves at the reveal. `SET status = status` is deliberate: nothing about the row
changed, and it moved anyway.

## The wrong answers

- **A** is the belief the question exists to break.
- **C** is too pessimistic: the address is valid until the row is updated,
  deleted, or the table rewritten, however many transactions that spans.
- **D** confuses versions with addresses. Two sessions with different
  snapshots may see different *versions* of a row, and each version has one
  address that every session agrees on.

## If someone asks

- **Is `ctid` ever useful?** Inside one statement, yes: deduplicating rows
  with no key, or batching deletes by physical range. Never across statements.
