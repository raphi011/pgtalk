## What this slide teaches

That a plan is not a program executed top to bottom, or a pipeline executed
bottom to top, but a tree of iterators driven by demand from the root. Getting
this right explains three things that otherwise look arbitrary: why `LIMIT` can
be nearly free, why a `Sort` in the middle of a tree is not, and what `loops`
means in a plan.

## The model

Every node implements essentially one operation: *give me your next row*. The
executor calls it on the root; the root calls it on its children as needed.
This is the Volcano or iterator model, and in PostgreSQL's source it is
`ExecProcNode`.

Walk exactly one row through the tree on the slide:

1. `Aggregate` is asked for a row. To answer, it needs all its input, so it
   asks `Filter` for a row.
2. `Filter` asks `Seq Scan` for a row.
3. `Seq Scan` reads the next tuple from the current page and returns it.
4. `Filter` tests `status = 'shipped'`. If it fails, `Filter` does not return —
   it asks the scan again. If it passes, it returns the row upward.
5. `Aggregate` increments its counter and asks again.

Repeat 500,000 times. Then `Aggregate` returns one row and the executor is
done.

Two consequences from the walk itself: rows move one at a time rather than as
materialised intermediate sets, so a plan's memory use is a property of its
blocking nodes rather than of its row counts; and a `Filter` that rejects a row
costs CPU for every row it rejects, which is why the `rows removed by filter`
line in a plan is worth reading.

## Blocking versus streaming nodes

- **Streaming** — `Seq Scan`, `Index Scan`, `Nested Loop`, `Filter`, `Append`.
  They can return a first row after bounded work, so their start-up cost is low
  and a `LIMIT` above them genuinely stops the work.
- **Blocking** — `Sort`, `Hash`, `Materialize`, aggregates without grouping,
  `GroupAggregate` per group. They cannot answer until they have consumed their
  entire input, so their start-up cost is nearly their total cost and a `LIMIT`
  above them saves almost nothing.

This is the same start-up/total distinction from the first-plan slide, now
explained by the mechanism rather than asserted.

## `LIMIT` and early stop

`LIMIT` is a node that stops calling its child once it has emitted enough rows.
Nothing else in the tree knows about the limit at execution time — though the
planner does know at planning time, which is how it prices the plan
differently. A plan can therefore end with `Seq Scan` whose `actual rows` is 10
on a 500,000-row table: it simply never got asked for row 11.

## What `loops` means

`loops` is how many times a subtree was started over from the beginning. The
common case is a nested loop join: the inner subtree is re-executed once per
outer row, so `loops=71428` on an inner index scan means that scan ran 71,428
times. Reported `actual time` and `rows` are per loop — an average — which is
why multiplying is required before believing anything, and it is the single
most common misreading of a plan.

Under `Gather`, `loops` counts concurrent workers rather than repetitions, so
the multiplication does not apply there. That exception is why this deck shows
per-loop figures exactly as psql does rather than helpfully multiplying them
out.

## Where this goes next

Session 3 spends its time on the choice between a nested loop with an index on
the inner side and a hash join, which is precisely a question about how many
times the inner subtree gets restarted. This slide is the vocabulary for that
conversation.
