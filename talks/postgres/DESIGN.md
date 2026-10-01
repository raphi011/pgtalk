# Postgres Under The Hood — presentation series design

A live, presenter-driven talk series explaining how PostgreSQL works, mixing
prose slides, diagrams and real SQL. It is a sibling of the *Build Your Own
PostgreSQL* book: that book builds a database; this explains the real one and
connects internals to decisions a listener makes at work. Its Node toolchain
lives here rather than in the book's zero-dependency Go repository.

Shared stage, authoring and collection decisions live in
[../../DESIGN.md](../../DESIGN.md). Existing IDs are preserved across both files.

## Format

**F2. Five sessions, ~35 minutes each**, roughly 60/40 internals to practical,
each ending on something usable the next working day.

| # | Session | Internals | Practical |
|---|---------|-----------|-----------|
| 1 | A query's life | parse, analyze, plan, execute | reading `EXPLAIN` |
| 2 | Storage | pages, tuples, visibility fields | bloat, `VACUUM` |
| 3 | Indexes | B-tree structure, planner choice | composite column order, covering indexes |
| 4 | Transactions and MVCC | snapshots, `xmin`/`xmax` | isolation levels and what each prevents |
| 5 | Concurrency in practice | lock modes, wait graphs | `SELECT FOR UPDATE`, deadlocks, optimistic concurrency, retries |

**F2a. Connections are split between sessions 1 and 5.** The subject has
three parts and they do not belong together. The process model — one backend
process per connection, forked by the postmaster, carrying its own memory and
its own catalog and plan caches — opens session 1, before the parser, because
it is what "the query arrives" means and it is a prerequisite for nothing. The
other two parts wait for session 5: what is session-scoped versus
transaction-scoped (`SET`, prepared statements, temp tables, advisory locks,
`LISTEN`), and pooling — session versus transaction mode, pool size against
`max_connections`, and a connection held idle in a transaction holding a lock
with it. Transaction-mode pooling breaks exactly the session-scoped list, so it
cannot be explained before transactions exist, and it lands on the same wait
graph session 5 already draws.

Rejected as a sixth session: the process model alone does not fill 35 minutes,
and pooling on its own is a deployment topic, which would break the 60/40 split
of F2.

**F4b. A REPL for questions from the floor.** `` ` `` opens a psql-like prompt
over the slide, the same way the notes open: the deck ignores its own keys
while it is up, and `Esc` closes it. A statement ending in `;` runs on `Enter`,
anything else continues on the next line; `Cmd+Enter` runs regardless, `Up`
and `Down` recall earlier input, `Ctrl+C` cancels.

It runs on a session of its own, `repl`, rather than on `s1` or `s2`: typing
into a slide's session would change what the slide's next block sees. Being an
ordinary session, its answers render through the same panel as a block's, and
a slide's session waiting on a lock it holds reads `blocked by repl`. Like
every session it is reset on a slide change (E4), so a transaction left open
in it cannot hold a lock across into the next demo. The scrollback is kept
apart from the slide's block outputs and survives navigation; only the
connection behind it does not.

**F4f. PostgreSQL adds runnable shortcuts.** `Enter` runs the first visible
block that has not run yet, falling back to the last once all have. `1`–`9`
run visible blocks by position, `r` restores the slide's fixture, and `e`
addresses the focused block's editing path (disabled by A5b). On a
`<Sessions>` slide, repeated `Enter` therefore walks s1 then s2. Requiring
a mouse-selected block was rejected because the slide already states the
order in which its demo is read.

## Stack

**S3. `pg` (node-postgres), not `psql` subprocesses.** An earlier draft piped
SQL into a long-lived interactive `psql` and read output up to a sentinel
prompt. Since A4 renders results as HTML, psql's aligned text would be parsed
only to be regenerated. `pg` gives structured rows and field types, notices via
`client.on('notice')`, and error objects carrying `code`, `position` and `hint`
so PostgreSQL's own message formatting can be reproduced.

Each session is a dedicated non-pooled `Client`. Never a pool: `BEGIN` in `s1`
must still be open on the next statement, which is the whole of sessions 4 and
5 — and by F2a, session 5 teaches that constraint, so the deck is a worked
example of its own slide. Cancellation opens a second connection and calls
`pg_cancel_backend` on the known backend pid.

The loss is backslash meta-commands. `\timing` is measured on our side; `\d`
becomes a catalog query if a slide ever needs it.

**S4. The locally installed PostgreSQL** (18.6 via Homebrew at the time of
writing), not a container. `just postgres setup` installs and starts it through
Homebrew, whose `initdb` creates a superuser role named after the current user;
`just postgres bootstrap` creates the databases and templates; `just dev` runs the deck; `just postgres reset` rebuilds the templates; `just postgres psql` opens a shell on the demo database.

## Execution model

**E1. Named sessions, side by side.** Blocks address `s1` or `s2`; a
`<Sessions>` block lays them out as adjacent panes, each with its own run
control and a state badge. Built from the start rather than added at session 4:
a single session is the degenerate case of two, and retrofitting it would mean
rewriting every block in sessions 1 to 3.

**E2. `blocked` and `failed` are different states.** A statement waiting on a
lock never settles, and in session 5 that is the entire point — so a
non-settling statement is `blocked`, shown loudly and deliberately, with no
timeout. Only a dead connection or a protocol error is `failed`.

**E2a. A blocked session names who it waits for.** The poller asks
`pg_blocking_pids` alongside `pg_stat_activity`, and maps each pid to the deck
session that owns it; anything else (a psql the presenter opened) shows as its
pid. The badge reads `blocked by s1 on transactionid`, and `<Sessions>` draws a
"waits for" connector from the waiting pane to the holder under the panes, so
the wait graph session 5 is about is on screen rather than implied. The
connector row is reserved even when empty, so a lock arriving does not shift
the slide.

**E3. Failures surface.** No cached-output fallback, no silent substitution of
a recorded result. If a query breaks on stage it breaks visibly.

This includes a statement that loses its connection. Navigating away from a
slow query resets the session under it, and the block it belonged to is told
so rather than left waiting for a reply that can never arrive. The interrupted
backend is cancelled first, because closing a connection waits for its
in-flight query and a session running `pg_sleep` would otherwise go on
answering the next slide's blocks.

**E4. Fixture per slide, restored on navigation.** Each slide declares the
fixture it needs as an ESM export. Navigating to a slide restores that fixture if
the previous slide used a different one, so any slide can be entered cold —
rehearsing slide 12 alone, or backing up when someone asks a question.

Restore is `DROP DATABASE demo; CREATE DATABASE demo TEMPLATE demo_fix_<name>`,
a file copy rather than a re-run of the seed SQL: about three quarters of a
second against tens, and every one of those seconds would be felt on stage.
Open sessions are disconnected first, since a connected client blocks the drop.

The template is only copied when the fixture changes, but the session
connections are dropped on *every* slide change. Session-local state is the
other half of "entering a slide cold": a `SET` or an open transaction left by
the previous slide would otherwise make walking to a slide differ from jumping
to it. Reconnecting costs milliseconds, so this is paid every slide while the
copy is not. Leaving the PostgreSQL talk also resets named sessions and closes
the browser socket, so an open transaction cannot hold a lock while another
talk is selected. REPL scrollback survives; any interrupted entry shows its
reset error rather than waiting indefinitely (E3).

**E4a. One deck at a time.** Every connected socket shares one Lab, which is
what makes a second tab show the same database rather than a private copy. The
consequence is that a second tab mounting — a reload, or a window left open on
another slide — restores its own fixture and resets the sessions, interrupting
whatever the first tab was doing. That is correct for one presenter and wrong
for two, so do not leave a spare tab on the deck during a talk.

**E4b. A fixture is built from the one before it.** `talks/postgres/db/schema.sql` plus
`talks/postgres/db/seed.sql` make `orders`; `talks/postgres/db/fixtures/<name>.sql` is applied to a copy of
the previous template to make the next. Session 2 needs the page-inspection
extensions (`storage`) and a table already churned once (`bloat`), and neither
is worth thirty seconds of re-seeding when a template copy takes under a
second.

`storage` also sets `autovacuum_enabled = off` on `orders`. A 500k-row churn
crosses the default threshold, so a worker would wake up mid-talk and undo the
slide on screen. The autovacuum slide says so rather than letting the deck
imply that a real server behaves this way.

**E4c. A run waits for a restore in progress, and nothing else does.** `Enter`
pressed the moment a slide with a new fixture appears sends a run while the
demo database is between `DROP` and `CREATE`. Runs await the last restore
before connecting, and a connect that still fails answers the block with an
error (E3) rather than raising a deck-wide fatal. It is a barrier, not a queue:
serialising runs behind each other would leave a `COMMIT` stuck behind the
blocked statement it exists to release (E2).

**E5. One schema for all five sessions.** `customers`, `orders`, `order_items`,
with roughly 500k rows in `orders` — enough that a sequential scan and an index
scan differ visibly on the clock, small enough to restore instantly from a
template. A shared schema means session 3's index lands on a table the audience
already understands from session 2.

**E6. Sessions connect with parallel query off.** Every session starts with
`max_parallel_workers_per_gather = 0`, passed as a connection option. With it
on, the planner puts a `Gather` and its workers into plans that the talk reads
node by node: a parallel scan's cost no longer matches the arithmetic slide,
and `loops` on the worker side means something other than what the audience
just learned. Parallelism is in none of the five sessions, so it is off for
all of them. A `SET` on each slide that needed it was rejected: it spent a key
press and screen space on something the audience should not have to think
about. A presenter who wants the contrast runs `SET
max_parallel_workers_per_gather = 2` from the editor.

## Authoring

**A2a. The heap page is the one derived diagram.** `<PageMap>` draws
`heap_page_items` output as a page: line pointers, the tuple behind each, the
`t_ctid` chain and redirects. Session 2's point is what a page looks like after
a statement, which a hand-drawn picture could only assert. It stays a runnable
block with a table/page toggle, so a failed query still fails visibly (E3) and
the raw rows are one click away.

**A3d. Every session ends on a quiz.** Five questions, one per slide, after a
slide that announces the quiz and its rules, and before the closing slide so
the session still ends on what to do the next working day (F2). Each one checks a concept the rest of the series builds on, not a
detail. The room answers by show of hands: phones and a live poll were
rejected, because they depend on the room's wifi (F1) and would add a second
system to keep running. The quiz costs about five minutes over F2's 35, which
was accepted.

`<Choices revealAt>` letters its `<Choice>` children A, B, C, D, since `1`-`9`
already run blocks, and on `revealAt` dims all but the one marked `correct`.
Where the answer can be shown rather than told, a block appears between the
options and the reveal, so the room commits before the query runs. The slide's
notes take each wrong option and the misconception behind it.

**A3a. `appearAt`/`hideAt` on a runnable block too.** A demo whose point is a
before-and-after — vacuum, HOT, the xmin horizon — runs six or eight blocks,
and stacking them all pushes the interesting one off the bottom of the screen,
which F4 does not allow. So a block retires on `hideAt` exactly as a `<Note>`
does, and the slide shows the two measurements being compared rather than
every step taken to produce them. The session keeps what the block did: an
open transaction survives its block leaving the screen.

A block that runs `VACUUM` has to be a block of its own. Several statements in
one block are sent as one simple query, which PostgreSQL wraps in a
transaction, and `VACUUM` cannot run inside one.

**A4. Results as HTML tables**, monospace, sized for a projector. psql's ASCII
borders are familiar but spend horizontal space that font size needs.

**A4a. A block can be compared against an earlier one.** A block given a `name`
can be referenced by a later block's `against`, and changed cells then show
`was → now` with the delta; a `<PageMap>` marks new slots and changed fields
the same way. Before-and-after is the shape of most of session 2, and the
"before" panel has usually left the screen by then (A3a), so the audience
should not have to remember its numbers. Numeric columns are right-aligned, and
`int8`/`numeric` values of five digits or more are grouped; `int4` is not,
because `int4` columns here are identifiers such as pids, not quantities.

**A5. SQL is highlighted and read-only** until `e` swaps in a plain textarea.
Highlighting is what makes SQL legible from the back row; editing happens on
perhaps one slide in twenty.

**A5b. Editing is switched off for now** by `EDITABLE` in
`src/labs/postgres/useBlock.ts`: no edit button, and `e` does nothing. Questions
from the floor go to the REPL (`` ` ``), which takes any SQL without disturbing
the slide's block. The editing path is kept rather than removed so a later
slide can want it back.

**A6. `EXPLAIN` renders as a tree, and says so** from `EXPLAIN (FORMAT JSON)`: nested nodes,
costs and row estimates, actual-versus-estimated marked when the plan came from
`ANALYZE`. The largest single build item, and it carries two of the five
sessions. Text plans are unreadable past about six lines on a projector.

Actual rows and times are shown per loop, exactly as psql prints them, rather
than multiplied out. A listener checking the tree against their own terminal
has to see the same figures, and the multiplication would be wrong under a
`Gather` in any case, where loops counts workers running concurrently rather
than one repetition after another.

The block shows `EXPLAIN (ANALYZE, BUFFERS)` above the query and sends that
plus `FORMAT JSON`. Hiding the command entirely was the first version and it
was wrong: a listener could not reproduce what they had just watched, on a
slide whose subject was that command. Showing the literal text sent would be
worse, because nobody types `FORMAT JSON` by hand — it yields unreadable JSON
rather than this tree. So the pane shows the reproducible form and the panel
footer names the difference.

**A6a. The tree points at itself.** Each node carries a bar for its share of
the root's actual time, and a node whose actual rows are off from the estimate
by 10× or more is tinted. A `focus` list (`[{at, until?, node?, metric?}]`)
steps through parts of the tree and dims the rest, so the four-questions slide
can walk one question at a time over a single real plan instead of repeating
it four times.

## Build order

1. ~~`justfile`, schema, seed.~~
2. ~~The WebSocket session layer.~~ `just smoke` proves E1, E2 and E4.
3. ~~Step machinery and the diagram DSL.~~
4. ~~The `EXPLAIN` tree.~~
5. ~~Session 1 content.~~ Twenty slides in `talks/postgres/slides/s1/`, six of them the quiz.
6. ~~Session 2 content.~~ Twenty-one slides in `talks/postgres/slides/s2/`, on the `storage` and
   `bloat` fixtures, six of them the quiz.
7. Sessions 3 to 5. Session 3 will want an indexed copy of the dataset.

`just shots` renders every slide through the real keyboard path and fails on
any console error, which is the closest thing to rehearsing without a room.
