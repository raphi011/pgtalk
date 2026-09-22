## What this slide teaches

Nothing yet. It states the subject and the promise: by the end of the session
the audience can explain why `DELETE` never returns disk to the operating
system, and can tell whether a table on their own server is bloated.

## Where this sits in the series

Session 1 ended on a plan whose cheapest option was a sequential scan of
`orders`, and on the observation that the planner never had a second path to
choose between. A sequential scan reads *pages*, and how many pages there are
is not a function of how many rows exist. That is this session.

Session 3 then puts an index on the same table, and an index entry is a key
plus a `ctid` — which is the third column on this title slide, and the first
thing slide 4 explains.

## The shape of the session

1. A table is a file, and the file is a list of 8 kB pages.
2. A page holds line pointers and tuples, growing towards each other.
3. `ctid` names a tuple by page and line pointer.
4. Every row version carries `xmin` and `xmax` in its header.
5. `UPDATE` writes a new version and leaves the old one. So does `DELETE`,
   minus the new version.
6. That is bloat. `VACUUM` is the answer, and it does less than most people
   think.
7. `HOT` and TOAST, the two mechanisms that change the arithmetic.

## The opening line

The `xmin` and `xmax` columns on the screen are real columns you can select
from any table, on any PostgreSQL server, without an extension. Most people in
the room will not have selected them before. That is the hook — the storage
layer is not hidden, it is just not in the `\d` output.
