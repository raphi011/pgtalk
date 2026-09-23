## What this slide teaches

That cost is not a mystical score. It is a formula over two catalog numbers and
two constants, and it can be reproduced by hand, to the penny, in front of the
room. Once someone has predicted a cost correctly, "the planner guesses" stops
being a slogan and becomes a mechanism.

## The sequence

1. **Key 1** — `relpages` and `reltuples` from `pg_class`. This is the entirety
   of what the planner knows about the table's size. Note that `reltuples` is a
   float and an estimate, updated by `VACUUM` and `ANALYZE`, not a live count.
   It can be wrong; after a bulk load it is usually very wrong.
2. **Key 2** — the prompt and the plan, not yet run. Let the room work the
   cost out, then Enter.

## The arithmetic

A sequential scan costs:

```
relpages × seq_page_cost + reltuples × cpu_tuple_cost
= 3677 × 1.0 + 500000 × 0.01
= 3677 + 5000
= 8677.00
```

The `Aggregate` node on top adds one `cpu_operator_cost` per input row for the
counting itself:

```
500000 × 0.0025 = 1250
8677.00 + 1250 = 9927.00
```

which is the total cost the plan reports. The numbers above are from the
current fixture; if the seed changes, re-read `relpages` and redo the sum
rather than trusting the printed figures.

Pedantic detail, if someone checks closely: `count(*)` also pays
`cpu_tuple_cost` for the single row the aggregate emits, so tiny discrepancies
in the last digits are the aggregate's own output row, not a mistake.

## The payoff line

**Cost units are not milliseconds.** One unit is "read one page sequentially".
A cost of 9927 means "about as expensive as reading 9927 pages sequentially",
which on this laptop is not 9.9 seconds and not 9.9 milliseconds — it is a
number whose only meaningful use is comparison against another plan for the
same query.

Therefore:

- comparing cost between two candidate plans: meaningful, that is the entire
  purpose;
- comparing cost to wall-clock time: meaningless;
- comparing cost between two different queries: nearly meaningless;
- setting an alert on "cost above 10000": a trap that fires on a healthy report
  query and stays silent on a broken one.

## Why show the formula at all

Because it makes the failure mode legible. If cost is arithmetic over
`relpages`, `reltuples` and selectivity, then a wrong cost has exactly three
possible causes: wrong size numbers, wrong selectivity, or constants that do
not describe your hardware. The next slides attack the middle one.

## If someone asks

- **Why `cpu_tuple_cost = 0.01`?** It says processing a row in memory is a
  hundredth of the cost of reading a page from disk. On modern storage that
  ratio understates CPU, which is part of why sequential scans are chosen more
  often than they should be with default settings.
- **Can I change these?** Yes, per session, per user, per database. They are
  ordinary GUCs. `random_page_cost` is the one worth changing on SSDs.
