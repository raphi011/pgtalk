## What this question checks

That a connection is a process (slide 2), not a lightweight handle. It is the
fact behind `max_connections`, connection pools, and session 5's pooling
discussion.

## The wrong answers

- **A** confuses the listener with the worker. The postmaster accepts and
  forks; it never runs a query.
- **B** is the thread-pool model of other servers. PostgreSQL has none.
- **D** is the pool's view of the world. The backend is forked at connect time,
  before any query, and lives until disconnect.

## If someone asks

- **Is fifty a lot?** Each backend costs a few MB at rest and up to `work_mem`
  per sort or hash node while working. Hundreds of idle connections are mostly
  a memory and snapshot-scanning cost; thousands are a real problem. Session 5
  covers pooling.
