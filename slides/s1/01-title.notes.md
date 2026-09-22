## What this session is for

The audience can already write SQL. What they cannot usually do is explain why
the same query is fast on Monday and slow on Friday when nothing in the query
changed. The answer is almost always that PostgreSQL's *planner* changed its
mind, and the planner changes its mind because it works from statistics rather
than from the data.

So the session has one claim, repeated five ways: **a query plan is a
prediction, and `EXPLAIN` shows you the prediction, not the truth.** Everything
else — the five stages, the cost arithmetic, the worked examples — exists to
make that claim concrete enough to act on.

## Why "a query's life"

Framing the session as a journey through stages gives each concept a place to
live:

- the parser explains why some errors point at a character position;
- the analyzer explains why others can say "did you mean";
- the planner explains everything that is interesting about performance;
- the executor explains why `LIMIT` is cheap and `ORDER BY` is not.

Without the pipeline, "the planner estimated wrong" is a piece of folklore.
With it, it is a specific stage, with specific inputs, that the audience can
inspect themselves with two catalog queries.

## Background worth having in your head

- The stages are real source-level boundaries in PostgreSQL, not a teaching
  simplification: `gram.y` (parser), `parse_analyze` (analyzer),
  `QueryRewrite` (rewriter), `planner` / `standard_planner`, and `ExecutorRun`.
- The split matters because only the planner is non-deterministic in practice.
  The same text always parses the same way; the same query does not always plan
  the same way, because `ANALYZE` may have run in between, or a setting may
  differ, or the table may have grown.
- Prepared statements add a wrinkle we deliberately skip today: a plan can be
  made once and reused (generic plan) or made per execution (custom plan).
  That is a session-3 conversation, once indexes give the planner a real
  decision to make.

## Setting expectations

Everything runs live against PostgreSQL 18 on this laptop. That is a
deliberate choice, not bravado: the whole session argues that the numbers are
real and checkable, and a screenshot of a plan would undercut that. If a query
breaks on stage, the audience sees it break, which is a better lesson than a
recording.

## The one sentence they should leave with

By the end of this session they can look at any plan and say, node by node,
which number is a guess and which number is a measurement.
