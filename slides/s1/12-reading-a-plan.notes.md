## What this slide teaches

The portable procedure. Everything before this was mechanism; this is the part
someone uses on Monday against a plan they have never seen, on a schema you
know nothing about.

Four questions, in order. Leave the slide up while you say each one — the next
slide applies them to a real plan.

## 1. Read innermost first

The tree prints top-down and executes bottom-up. The deepest, most-indented
nodes are the scans that actually touch tables; everything above them is
combination and transformation. Reading in printed order means meeting the
answer before the work, which is why plans feel inscrutable at first.

Practically: find the leaves, name the tables, then walk outwards saying what
each parent does to its children's rows.

## 2. Find the widest gap between estimated and actual rows

Not the slowest node. The node where the estimate diverged is where the plan
*was decided wrongly*; the slow node is usually downstream of it, doing exactly
what it was told to do with ten times the rows anyone expected.

Look for the deepest node with a large ratio and start there — an error at a
leaf propagates upward and inflates every ratio above it, so the innermost bad
estimate is the cause and the rest are symptoms.

What counts as large: a factor of 2 is noise, a factor of 10 is worth
explaining, a factor of 100 is the bug.

## 3. Actual time is per loop

`actual time=0.031..0.042 rows=1 loops=71428` is not 0.042 ms of work. It is
0.042 ms × 71,428 ≈ 3 seconds. The per-loop presentation matches what psql
prints, so the multiplication is yours to do.

The corollary is the diagnostic: a node with a tiny per-loop time and an
enormous loop count is a nested loop that should probably have been a hash
join — which takes you straight back to question 2, because the loop count is
the outer side's row estimate made flesh.

Exception, as on the executor slide: under `Gather`, `loops` counts workers
running concurrently, not repetitions in sequence.

## 4. `read` means disk, `hit` means memory

Always ask for `BUFFERS`; in PostgreSQL 18 `EXPLAIN ANALYZE` includes it by
default, but say it explicitly for anyone on an older server.

- Large `read`, small time — a warm OS cache saved you, and nothing guarantees
  it will next time.
- Large `hit`, large time — CPU-bound, not I/O-bound. Look for filters
  rejecting many rows, expensive functions, or bad estimates causing spills.
- `temp read`/`temp written` — a sort or hash exceeded `work_mem` and went to
  disk. This is often a one-setting fix and always worth spotting.

## What to say about the order

The order is not decorative. Questions 1 and 2 locate the fault, question 3
tells you whether the numbers you are reading mean what they appear to mean,
and question 4 tells you whether the result will survive contact with a
production cache. Running them backwards produces confident conclusions about
the wrong node.

## If someone asks for a fifth

"Is this plan stable?" — that is, would it survive the table doubling in size,
or `ANALYZE` running? That question belongs to sessions 2 and 3, once indexes
give the planner genuine alternatives to flip between.
