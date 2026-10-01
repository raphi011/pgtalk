## What this slide teaches

That the pipeline from the previous slide is observable. The audience does not
have to take "parser, then analyzer" on trust — two queries fail in two
different stages, and PostgreSQL says which.

## The two failures

`SELECT FROM WHERE customers;`

Dies in the parser. The grammar expects a `FROM` item after `FROM`, gets the
keyword `WHERE`, and gives up. The error is `42601 syntax_error` and it carries
a character position, because a position is the only thing the parser has to
offer: it has never opened the catalog, so it cannot mention a table, a column
or a type.

`SELECT nope FROM customers;`

Parses perfectly — grammatically it is an ordinary column reference. It dies in
the analyzer, which resolves `customers` to an OID, fetches the column list,
and finds no `nope`. The error is `42703 undefined_column`, and because that
stage is holding the real column names, PostgreSQL can add a `HINT` suggesting
the closest one.

## Why the SQLSTATE codes are the payoff

- `42601` — syntax error. Class 42 is "syntax error or access rule violation".
- `42703` — undefined column.

These are stable, machine-readable, and worth pointing out: application code
that branches on error text is fragile, and code that branches on SQLSTATE is
not. Every PostgreSQL driver exposes it (`err.code` in node-postgres,
`SQLSTATE` in JDBC, `pgcode` in psycopg).

The deeper reason to show them: the code tells you which stage failed, which
tells you what kind of fix applies. A 42601 is a typing mistake in the query
text. A 42703 means the query is well-formed but disagrees with the schema —
so it can start failing after a migration, on text that has not changed.

## The hint mechanism

The suggestion comes from a similarity search over the candidate names in
scope. It only fires when there is a close enough single candidate, so do not
promise it always appears. It is also purely an analyzer-stage feature; no
amount of typo in a keyword will produce one, because the parser has nothing to
compare against.

## Running it

Keys `1` and `2` run the two blocks. Run the first, let the character position
land, then run the second and point at the hint. If someone wants a third, try
`SELECT * FROM nope;` — also analyzer, `42P01 undefined_table`.
