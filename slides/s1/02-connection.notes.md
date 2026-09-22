## What this slide teaches

That "the query arrives" means a specific thing: an operating system process
that exists for exactly as long as the connection does. The rest of the session
describes what happens *inside* that process, so it is worth ninety seconds to
establish that the process is there.

It also pays for the two panes. `s1` and `s2` appear on every slide from here
to session 5; this is where they stop being labels.

## The mechanism

The postmaster owns the listening socket. On each connection it forks a child,
hands the socket over, and returns to listening — it never executes a query
itself. The child ("backend") does authentication, then parse, plan and execute
for every statement on that connection until the client disconnects, at which
point the process exits.

There is no thread pool and no work queue. Concurrency is process count.

### Private per backend

- Session state: `SET`, `search_path`, session variables.
- Prepared statements and their cached plans.
- Temporary tables, and the buffers for them (`temp_buffers`).
- `work_mem` allocations — per sort or hash *node*, not per query and not per
  connection, so one query can hold several multiples of it at once.
- The relation and catalog caches, which is why the first query touching a
  table on a fresh connection is measurably slower than the second.

### Shared across all backends

- Shared buffers: one page cache for the whole cluster.
- The lock table, and the array of running transactions used for snapshots.
- WAL buffers.

## Why the cost matters

Baseline memory is on the order of a couple of megabytes per idle backend, but
the sharper cost is not memory. Taking a snapshot scans the list of running
backends, so work that every transaction does grows with the number of
connections, idle ones included. A thousand mostly-idle connections make a
busy server slower at everything, not just at the thousandth query.

This is the opening of the pooling argument in session 5 (F2a). Do not give
the answer here — the audience does not yet know what a transaction holds, and
"use pgbouncer" without that is cargo cult. State only that connections cost
something, and that the cost is per process.

## Running it

`Enter` twice: the first press runs `s1`, the second `s2`. The two
`pg_backend_pid()` calls return different numbers. Worth saying out
loud that these are real pids you could find in `ps`.

Per E4 the deck reconnects both sessions on every slide change, so the numbers
will differ from the ones you saw while rehearsing, and from the ones on the
previous run of this slide. That is itself the point: a connection dropped is a
process gone.

If someone wants to see them from the server's side:

```sql
SELECT pid, backend_type, state, query
FROM pg_stat_activity
WHERE datname = current_database();
```

## If someone asks

- **Why processes and not threads?** History and isolation: a crash in one
  backend cannot corrupt another's memory, and PostgreSQL predates usable
  portable threading. Changing it now is a multi-year project that gets
  proposed roughly annually.
- **Is `max_connections` the number to raise, then?** Raising it makes the
  problem legal rather than absent. It also sizes several shared-memory
  structures at startup, so it cannot be changed without a restart.
- **Does a connection cost anything when idle?** Yes — its memory, and its
  entry in the structures every other backend scans.
