# AGENTS.md

A live talk deck about PostgreSQL internals: MDX slides, and SQL run against the
local PostgreSQL through a WebSocket session layer inside the Vite dev server.
`README.md` has setup and keys; the `justfile` has every command.

## DESIGN.md is the source of truth

Every decision has an ID (`F4a`, `E2`, `A3a` ...). Code comments cite those IDs
instead of re-explaining, and a comment's reasoning belongs in DESIGN.md once it
outgrows a line or two. Read the entry a change touches before making it. When a
change makes or alters a decision (a new key, a new component, a new rule about
sessions), update or add its entry in the same commit, following the existing
format: bold ID and one-line claim, then the reason and what was rejected.

## Slides

- `slides/<session>/NN-name.mdx`, each with a sibling `NN-name.notes.md` (F3).
  The `NN` prefix is the order.
- A slide states `fixture` and `title` as ESM exports (`export const fixture =
  "storage";`), not frontmatter. DESIGN.md A1 still shows frontmatter.
- Slides are laid out on a fixed 1600×900 stage (F4a) and must fit it:
  the presenter cannot scroll. Retire blocks with `hideAt` (A3a) to make room
  rather than shrinking type.
- Code that measures the screen divides by `ZoomContext` before writing a size
  into a style (see `src/components/Morph.tsx`).

## Session layer

- One dedicated `pg.Client` per named session, never a pool (S3): an open
  transaction must survive to the next statement.
- Values stay as the text PostgreSQL sent (`textOnly` in `server/lab.ts`).
- A statement that never settles is `blocked`, not `failed` (E2). No timeouts,
  no fallback to recorded output (E3).

## Verifying

Everything runs against a live `just dev` on port 5173 and a bootstrapped local
PostgreSQL (`just bootstrap`). Start `just dev` in the background if it is not
already answering.

- `npx tsc --noEmit -p .` for types.
- `just smoke` after touching `server/` or `src/lab.ts`.
- `just shots <session>` after touching anything a slide renders; it fails on a
  console error or a slide overflowing the stage. Read the PNGs in `test/shots/`
  to check layout.
- `node test/shoot.mjs 's1/3/0:ArrowRight,Enter'` shoots one position after
  pressing keys; `type=<text>` types instead (no commas or colons).

All tabs and scripts share one Lab (E4a): a shot or smoke run restores fixtures
and resets sessions under any open deck tab. Say so before running one while
the user may be presenting or rehearsing.

## Style

- Comments explain why, in full sentences, and cite decision IDs.
- British spelling: colour, centred, behaviour.
- Commits go straight to `main`. Subject in the imperative, sentence case, no
  prefix (`Pin the status bar to the window`); the body says why.
