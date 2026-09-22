## What this slide teaches

That "running a query" is five distinct jobs, and that failures, hints, and
performance surprises each belong to a specific one of them. Once the audience
can name the stage, the rest of the session has somewhere to hang.

The slide's notes carry the definitions; the value you add on stage is the
*consequence* of each stage, below.

## Stage by stage

### Parser

Grammar only. It turns text into a parse tree and knows nothing about the
catalog — not a table name, not a column name, not a type. This is why a syntax
error points at a character position and nothing else: at that moment
PostgreSQL genuinely has no idea what you were talking about.

Consequence for the audience: a syntax error is never about the database's
state. It will fail identically on an empty database.

### Analyzer

Name resolution against the system catalogs. `customers` becomes an OID,
`email` becomes an attribute number, `=` becomes one particular operator for
one particular pair of types, and the result is a `Query` structure with no
strings left in it.

Consequence: this is the only stage that can offer a "did you mean" hint,
because it is the first stage holding the list of real names. It is also where
type resolution happens, which is why `WHERE id = '42'` works and
`WHERE id = 'abc'` fails here rather than at execution.

### Rewriter

Query-tree rewriting. Views are substituted by their definitions, rules are
applied, row-level security policies are injected as extra qualifications.

Consequence: a view is not a stored result and not a cached plan. It is a macro
expanded at this stage, so a view of a view of a view arrives at the planner as
one large flat query. When someone says "the view is slow", the honest
translation is usually "the planner got a query much bigger than the one I
wrote".

### Planner

The only stage with a choice to make. It enumerates equivalent ways to answer
the query — access paths per relation, join orders, join algorithms — prices
each with a cost model, and keeps the cheapest. Join-order search is exhaustive
up to `geqo_threshold` (default 12 relations), genetic above it.

Consequence: it never reads a row of your data. Every row count and width in an
`EXPLAIN` output without `ANALYZE` is arithmetic over summaries.

### Executor

Walks the chosen plan as a tree of iterators and does the actual I/O. The only
stage `EXPLAIN ANALYZE` can put a clock on.

Consequence: when a plan is slow, the executor is usually doing exactly what it
was told; the question is why it was told to do that.

## The point of the final step

Four of the five stages are deterministic: the same input gives the same output
forever. The planner is the one that can be entirely correct about everything
it knows and still pick a plan that takes four minutes, because what it knows
is a summary that has drifted from the table.

That asymmetry is why the rest of the session is almost entirely about the
planner.

## If someone asks

- **Where does the query cache live?** It does not. PostgreSQL has no query
  result cache. Plans can be cached per session for prepared statements; that
  is all.
- **Is the rewriter where optimisation happens?** No. Subquery pull-up,
  predicate pushdown and similar transformations happen inside the planner.
