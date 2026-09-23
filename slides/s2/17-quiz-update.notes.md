## What this question checks

The core of the session (slide 6): nothing on a heap page is overwritten, and
every write leaves a version behind for something to clean up.

## The wrong answers

- **A** is how most people picture a database. It would make MVCC impossible:
  a concurrent reader's snapshot needs the old value.
- **C** is half right about the future and wrong about when. The space is
  reclaimed by pruning or `VACUUM`, and only once the old version is dead to
  every snapshot.
- **D** has a grain of truth: the new version goes wherever there is room,
  on the same page if it fits (HOT, slide 13), otherwise on another page. It
  is not a move, since the old version stays.
