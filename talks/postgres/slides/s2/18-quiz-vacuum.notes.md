## What this question checks

That deleted space is neither freed nor shrunk (slide 7), and that `VACUUM`
only records it as free inside the same file (slide 9).

## Running it

Take the hands after the options appear, then run the three blocks in order.
The `VACUUM` is a block of its own because it cannot run inside the implicit
transaction of a multi-statement block (A3a). The last block compares against the
first: `rows` halves and `file` does not move, which is the answer.

## The wrong answers

- **A** is the expectation from every file system.
- **C** makes autovacuum something different from `VACUUM`. It is the same
  operation, started by a background worker.
- **D** describes `VACUUM FULL`, which does need room for both copies while it
  rewrites.

## The exception worth knowing

"Every other row" is deliberate. `VACUUM` *does* truncate empty pages at the
end of the file, taking a brief exclusive lock to do it. Delete the newest
half of a table instead and the file does shrink. If someone asks why their
table shrank after a vacuum, that is why.
