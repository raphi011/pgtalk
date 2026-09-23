## What this slide teaches

Where the session stopped, and why each remaining topic is a session rather
than a footnote.

## The four threads

- **Session 2 — storage.** Pages, tuples, the visibility fields on every row,
  and what `VACUUM` actually does. Picked up directly from today's `hit` versus
  `read`: buffers are 8 kB pages, and the question of which pages exist and why
  there are more of them than the data needs is the definition of bloat.
- **Session 3 — indexes.** B-tree structure, and the planner's choice between
  an index scan and a sequential scan. Picked up from cost arithmetic: today
  only one formula was needed because only one access path existed.
- **Session 4 — MVCC and isolation.** Snapshots, `xmin`/`xmax`, and what each
  isolation level actually prevents. Picked up from the system columns glimpsed
  in `pg_attribute`.
- **Session 5 — concurrency in practice.** Lock modes, wait graphs,
  `SELECT FOR UPDATE`, deadlocks, retry strategies.

## The honest closing point

Every plan today was a sequential scan or a single primary-key lookup. That
means the planner never had a real decision to make: there was one sensible way
to answer each query and it found it.

Everything that makes the planner interesting — and everything that makes it
capable of being spectacularly wrong in a way that costs money — requires at
least two candidate access paths to price against each other. That requires an
index, and no index has been created in this session beyond the primary keys
that came with the schema.

So today was the machinery: the stages, the cost model, the difference between
a guess and a measurement, and the four questions. The decisions start once
there is something to decide between.

## Why end on an admission

Because the alternative is an audience that leaves believing plans are
straightforward. They are not; today's were. Naming that keeps the four
questions honest — they are a procedure for reading any plan, and the plans
they will meet at work have ten nodes, three join algorithms and a bad estimate
somewhere in the middle.

## The last line

Next time: where the rows actually live.
