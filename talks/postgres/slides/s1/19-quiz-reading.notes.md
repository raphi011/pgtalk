## What this question checks

The second of the four questions (slide 12): the biggest gap between estimated
and actual rows is where the plan went wrong, not the node with the most time.

## The wrong answers

- **A** treats the symptom. The join is slow because it was chosen and sized
  for a thousandth of its real input.
- **C** may even help, and hides the cause. The next query with the same
  misestimate picks the same wrong shape.
- **D** is a rewrite before a diagnosis.

## What to do next with B

Run `ANALYZE` on the table and look again. If the estimate is still off, the
filter is something the statistics do not describe, such as an expression
(slide 10) or correlated columns, and the fix is extended statistics or an
expression the planner can read.
