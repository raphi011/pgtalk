## What this slide teaches

The four questions applied to a plan with more than one node, including a join.
This is the rehearsal for doing it alone.

## Why parallelism is off

The deck's sessions run with `max_parallel_workers_per_gather = 0` (design
decision E6). With it on, the planner puts a `Gather` or `Gather Merge` and
three workers between the audience and the join, and `loops` on the worker side
means something different from the meaning they just learned. That is a genuine
second lesson and it is not today's.

If someone asks what it would look like, run `SET
max_parallel_workers_per_gather = 2;` from the editor and re-run the plan — the
contrast is instructive, as long as it lands after the four questions rather
than during them.

## The query

```sql
SELECT c.country, count(*)
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.total_cents > 200000
GROUP BY c.country;
```

The expected shape: two sequential scans, a hash built on the smaller relation,
a hash join, then aggregation by country.

## Question 1 — innermost first

Name the leaves: a sequential scan of `orders` with the `total_cents` filter,
and a sequential scan of `customers`. Then `Hash` over one of them, then
`Hash Join`, then the grouped aggregate on top. Say the whole tree as one
sentence before touching any number.

Worth noting: the planner chose a hash join rather than a nested loop because
both sides are large and there is no index to make repeated inner lookups
cheap. That absence is the note the final slide ends on.

## Question 2 — estimates against actuals

The join estimated about 101,538 rows and produced about 101,307. The filter's
estimate is close too, because `total_cents` is an ordinary column with an
ordinary histogram, so the planner can read the selectivity of `> 200000`
straight off it.

Say explicitly that the planner was right here. A correct plan is worth showing
for the same reason the previous slide's broken one was: the audience needs the
contrast to calibrate what "wrong" looks like. Exact figures depend on the
fixture; read whatever the tree shows rather than the numbers written here.

## Question 3 — loops

Every `loops` is 1, so the reported times are already wall-clock totals for
each subtree and no multiplication is needed. Point that out precisely because
it is the boring case — the audience should confirm the loop count before
trusting a time, every time, including when the answer is 1.

Remember that each node's time is inclusive of its children, so the root's time
is the query's time, and a child's share is a subtraction.

## Question 4 — buffers

The first run after entering the slide shows `read`s on the `orders` scan
(around 1 600 of its 3 677 pages): the fixture was copied into a fresh
database a moment ago, and its pages are in the OS cache but not yet in
`shared_buffers`. Run it again and every page is a `hit`. That second run is
the demonstration: same tree, same rows, different clock. On a server where
these tables did not fit in memory at all, the reads would come from disk and
the difference would be far larger.

This is the honest caveat about every benchmark run on a laptop, and it is the
hinge into session 2: what a page is, where it lives, and what happens when it
does not fit.

## If it goes wrong live

If the plan comes back with a different shape — a merge join, or a parallel
plan because the session setting did not take — treat it as material rather
than as a failure. Walk the same four questions over whatever appeared; the procedure is
the point, not the specific tree.
