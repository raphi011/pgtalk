## What this question checks

The split between syntax and meaning (slides 3 and 4): the parser knows the
grammar and nothing about your tables; the analyzer resolves names against the
catalog.

## Running it

Take the hands first, then run both blocks. The two errors are the answer:
`s1` reports `column "nope" does not exist`, `s2` reports
`syntax error at or near "customers"`.

The misspelt keyword has to sit after a column. `SELECT FRUM customers` alone
is valid grammar, a column `frum` with the alias `customers`, and fails in the
analyzer like the first. Then step to reveal.

## The wrong answers

- **A** is the intuitive answer, since "it's a typo". The parser only sees an
  identifier where an identifier is allowed.
- **C** and **D** would mean a bad name could reach a stage that works with
  plans or rows. Nothing past the analyzer handles names at all: they are
  OIDs and attribute numbers by then (slide 5).
