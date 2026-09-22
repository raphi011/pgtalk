# Postgres Under The Hood — presentation series design

A live, presenter-driven talk series explaining how PostgreSQL works, mixing
prose slides, step-built diagrams, and real SQL run against a local PostgreSQL
server. It is a sibling of the *Build Your Own PostgreSQL* book, not a second
route through it: that book builds a database, this explains the real one and
connects the internals to decisions a listener makes at work.

This document records the design decisions. Read the relevant one before
changing anything.

## Format

**F1. Live, presenter-driven.** One person at the keyboard, an audience
watching. Not a self-paced artifact. Every design choice below resolves in
favour of "works in a room with a projector and someone else's wifi".

**F2. Five sessions, ~35 minutes each**, roughly 60/40 internals to practical,
each ending on something usable the next working day.

| # | Session | Internals | Practical |
|---|---------|-----------|-----------|
| 1 | A query's life | parse, analyze, plan, execute | reading `EXPLAIN` |
| 2 | Storage | pages, tuples, visibility fields | bloat, `VACUUM` |
| 3 | Indexes | B-tree structure, planner choice | composite column order, covering indexes |
| 4 | Transactions and MVCC | snapshots, `xmin`/`xmax` | isolation levels and what each prevents |
| 5 | Concurrency in practice | lock modes, wait graphs | `SELECT FOR UPDATE`, deadlocks, optimistic concurrency, retries |

**F3. Not shared after the talk.** Slides carry speaker notes, not prose an
absent reader could follow. Revisit once session 1 has been given once.

**F4. One screen.** No presenter view on a second display: it means a second
window and cross-window state sync for something that depends on the room's
HDMI working. Notes toggle on `n` instead.

Keys: `->`/`<-` step, `Down`/`Up` slide, `Enter` run the focused block,
`r` reset the slide, `e` edit SQL, `n` notes, `g` jump to a slide.

## Stack

**S1. Vite + React + MDX**, one single-page app. This lived in the book's
repository at first, as a folder beside the chapters. It moved out: the book is
a zero-dependency Go module whose whole claim is the standard library, and a
Node toolchain sitting inside it muddied that. Cross-link the two; do not merge
them.

Astro was rejected: static generation and partial hydration solve publishing
problems, and F3 says there is nothing to publish.

**S2. Node owns the backend.** A Vite dev-server plugin holds the database
connections and speaks WebSocket to the app, so `just dev` starts everything.
A separate Go server was rejected: a second toolchain to start is a second
thing to go wrong while a room watches.

WebSocket rather than HTTP because of E2 — `s2` must visibly unblock the
instant `s1` commits, which polling renders as a lurch.

**S3. `pg` (node-postgres), not `psql` subprocesses.** An earlier draft piped
SQL into a long-lived interactive `psql` and read output up to a sentinel
prompt. Since A4 renders results as HTML, psql's aligned text would be parsed
only to be regenerated. `pg` gives structured rows and field types, notices via
`client.on('notice')`, and error objects carrying `code`, `position` and `hint`
so PostgreSQL's own message formatting can be reproduced.

Each session is a dedicated non-pooled `Client`. Never a pool: `BEGIN` in `s1`
must still be open on the next statement, which is the whole of sessions 4 and
5. Cancellation opens a second connection and calls `pg_cancel_backend` on the
known backend pid.

The loss is backslash meta-commands. `\timing` is measured on our side; `\d`
becomes a catalog query if a slide ever needs it.

**S4. The locally installed PostgreSQL** (18.6 via Homebrew at the time of
writing), not a container. `just bootstrap` creates the role, databases and
templates; `just seed` loads the dataset; `just dev` runs the deck; `just
reset` rebuilds the templates; `just psql` opens a shell on the demo database.

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

**E3. Failures surface.** No cached-output fallback, no silent substitution of
a recorded result. If a query breaks on stage it breaks visibly.

**E4. Fixture per slide, restored on navigation.** Each slide declares the
fixture it needs in frontmatter. Navigating to a slide restores that fixture if
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
copy is not.

**E5. One schema for all five sessions.** `customers`, `orders`, `order_items`,
with roughly 500k rows in `orders` — enough that a sequential scan and an index
scan differ visibly on the clock, small enough to restore instantly from a
template. A shared schema means session 3's index lands on a table the audience
already understands from session 2.

## Authoring

**A1. Slides are MDX.** Fixture in frontmatter, SQL inline:

```mdx
---
fixture: orders
notes: Ask who has read a plan before showing the tree.
---

<Diagram>...</Diagram>

<Runnable session="s1" sql="SELECT count(*) FROM orders;" />

<Sessions>
  <Runnable session="s1" sql="BEGIN; SELECT * FROM orders WHERE id = 1 FOR UPDATE;" />
  <Runnable session="s2" sql="UPDATE orders SET status = 'shipped' WHERE id = 1;" />
</Sessions>
```

`session` defaults to `s1`. SQL stays inline rather than in referenced `.sql`
files: at this size, a slide readable as a single unit while rehearsing beats
reuse that will not arise.

**A2. Diagrams are hand-authored and presenter-stepped.** Steps advance on
arrow keys only; nothing is derived from query results. Deriving diagram state
from real output is more work, more fragile live, and loses the property that
matters most — when a query fails, the diagram still tells the story.

**A3. A small step DSL, with an escape hatch.** Four primitives — `<Box>`,
`<Arrow>`, `<Label>`, `<Highlight>` — each taking `appearAt={n}`, placed on an
explicit coarse grid. No auto-layout: it reads as a time-saver and then fights
every diagram that needs a box moved slightly for an arrow to read.

`<Step n={3}>` stays public as a primitive, so a diagram the DSL cannot express
drops to raw SVG inside the same step machinery instead of forcing the DSL to
grow.

**A4. Results as HTML tables**, monospace, sized for a projector. psql's ASCII
borders are familiar but spend horizontal space that font size needs.

**A5. SQL is highlighted and read-only** until `e` swaps in a plain textarea.
Highlighting is what makes SQL legible from the back row; editing happens on
perhaps one slide in twenty.

**A6. `EXPLAIN` renders as a tree, and says so** from `EXPLAIN (FORMAT JSON)`: nested nodes,
costs and row estimates, actual-versus-estimated marked when the plan came from
`ANALYZE`. The largest single build item, and it carries two of the five
sessions. Text plans are unreadable past about six lines on a projector.

The block shows `EXPLAIN (ANALYZE, BUFFERS)` above the query and sends that
plus `FORMAT JSON`. Hiding the command entirely was the first version and it
was wrong: a listener could not reproduce what they had just watched, on a
slide whose subject was that command. Showing the literal text sent would be
worse, because nobody types `FORMAT JSON` by hand — it yields unreadable JSON
rather than this tree. So the pane shows the reproducible form and the panel
footer names the difference.

## Conventions

- Deck state lives in the URL hash (`#/s4/12/3` — session, slide, step) so a
  reload resumes in place.
- Each session is a route.
- No auth; the server binds to localhost.

## Build order

1. ~~`justfile`, schema, seed.~~
2. ~~The WebSocket session layer.~~ `just smoke` proves E1, E2 and E4.
3. ~~Step machinery and the diagram DSL.~~
4. ~~The `EXPLAIN` tree.~~
5. ~~Session 1 content.~~ Twelve slides in `slides/s1/`.
6. Sessions 2 to 5. Each will need fixtures beyond `orders`: a bloated table
   for session 2, an indexed copy for session 3.

`just shots` renders every slide through the real keyboard path and fails on
any console error, which is the closest thing to rehearsing without a room.
