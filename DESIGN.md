# Talk collection — presentation engine design

Shared decisions for the Vite/React/MDX presentation engine. PostgreSQL's
content and Lab decisions live in [talks/postgres/DESIGN.md](talks/postgres/DESIGN.md).
IDs stay stable across both documents; follow that link for E, S3, S4 and SQL-specific A decisions.

## Format

**F1. Live, presenter-driven.** One person at the keyboard, an audience
watching. Not a self-paced artifact. Every design choice below resolves in
favour of "works in a room with a projector and someone else's wifi".

**F3. Not shared after the talk.** The slides themselves carry nothing an
absent reader could follow. What they do carry is *background*: each slide has
a sibling `.notes.md` explaining what the slide teaches, why it is shaped that
way, and the mechanism behind it in more depth than the slide shows. That is
preparation material and an answer to a question from the floor, not a script
to read from on stage. Revisit once session 1 has been given once.

**F4. One screen.** No presenter view on a second display: it means a second
window and cross-window state sync for something that depends on the room's
HDMI working. Notes open over the slide on `n` instead, nearly full screen and
scrollable, since F3 makes them longer than a corner panel could hold. While
they are open the deck ignores its own keys, so the arrows scroll the notes and
nothing on stage moves underneath them.

Keys: `->`/`<-` step, `Space` advance, `Down`/`Up` slide, `n` notes,
`g` find a slide, `?` shortcuts. Optional Labs add their own actions; see
[PostgreSQL F4b, F4f and A5b](talks/postgres/DESIGN.md).

**F4a. A fixed stage, zoomed to the window.** Every slide is laid out on a
1600×900 stage and CSS-zoomed to fit, so the projector changes how big a slide
is and never what fits on it: a slide that fits at rehearsal fits on stage.
`just shots` fails on any slide whose content is taller than the stage, since
the presenter cannot scroll mid-sentence. Anything that measures the screen
gets zoomed pixels and has to divide the zoom back out before writing a size
into a style; the stage provides it for that.

**F4c. `g` opens a quick switcher.** A search box over the slide lists the
slides of one session in the selected talk, starting with the current one; `Left`/`Right` change
session. One list of every session's slides was too long to scan, and the
session in hand is nearly always the one wanted. The arrows no longer move the
caret, which a search of a word or two does not miss. A number matches a slide
number exactly and any other word a part of the title, so `12` still jumps to
slide 12. `Up`/`Down` choose, `PgUp`/`PgDn` move a screenful, `Enter` goes,
`Esc` closes; the deck ignores its own keys while the switcher is open, as it
does for the REPL. It replaced a `prompt()` that took a slide number only:
finding the slide someone is asking about by remembering its number fails
mid-talk, and a browser dialog is a modal the deck cannot style or dismiss.

**F4d. `?` opens keyboard help.** A centred popup lists the deck keys and the
keys specific to notes, the slide finder and the selected Lab. PostgreSQL
adds its SQL REPL and the currently disabled editing key (A5b). `?`, `Esc` or its close button dismisses
it; while open, it takes the keyboard so looking up a key cannot step the
slide or run SQL. Text inputs keep `?` as text, and the other overlays keep
their own keys. A button in the status bar makes help discoverable and lets it
open over an existing overlay. A native modal dialog contains focus and
returns it to the previous control on closing. A separate help slide was
rejected because navigating to it would reset live sessions (E4).

## Stack

**S1. Vite + React + MDX, one app and one dependency set.** A talk collection
shares its stage and authoring primitives. Separate packages and a workspace
were rejected: the talks use the same toolchain, and independent installations
would add setup without providing isolation the content needs.

Astro was rejected: static generation and partial hydration solve publishing
problems, and F3 says there is nothing to publish.

**S2. Node owns optional backends.** A Vite dev-server plugin holds any Lab's
connections and speaks WebSocket to the app, so `just dev` starts everything.
A separate Go server was rejected: a second toolchain to start is a second
thing to go wrong while a room watches. PostgreSQL uses WebSocket rather than
HTTP so a blocked query unblocks immediately (E2).

## Authoring

**A1. Slides are MDX, with metadata as ESM exports.** Each talk owns
`talks/<talk>/slides/<session>/NN-name.mdx` and its sibling notes:

```mdx
export const title = "An idea";

# An idea

<Note appearAt={1}>One step at a time.</Note>
```

The manifest in `talks/<talk>/talk.ts` declares the title, ordered sessions
and an optional Lab. A PostgreSQL slide also exports `fixture` and keeps SQL
inline, so the slide can be read as a unit. Frontmatter was rejected because
plain ESM needs no extra plugin.

Notes live beside the slide as `<slide>.notes.md`, not as an exported string:
at the length F3 asks for they want headings, lists and code blocks. The MDX
plugin already compiles `.md` as plain markdown, so this costs no dependency.

**A2. Diagrams are hand-authored and presenter-stepped.** Steps advance on
arrow keys only; nothing is derived from query results. Deriving diagram state
from real output is more work, more fragile live, and loses the property that
matters most — when a query fails, the diagram still tells the story.

**A3. A small step DSL, with an escape hatch.** Four primitives — `<Box>`,
`<Arrow>`, `<Label>`, `<Highlight>` — plus `<Code>` for highlighted SQL, each
taking `appearAt={n}` and an optional `hideAt={n}`, placed on an explicit
coarse grid. `hideAt` is what lets one caption replace the previous one
instead of five of them stacking up under a diagram.

Anything longer than a caption goes in a `<Note appearAt hideAt>` block
underneath, which is HTML rather than SVG: it wraps on its own, carries inline
code and bold, and reserves its height so swapping one note for another does
not shift the slide. SVG tspans would need every line break placed by hand. No auto-layout: it reads as a time-saver and then fights
every diagram that needs a box moved slightly for an arrow to read.

`<Step n={3}>` stays public as a primitive, so a diagram the DSL cannot express
drops to raw SVG inside the same step machinery instead of forcing the DSL to
grow.

**A3b. Arrows draw, and can carry a pulse.** An arrow draws itself from source
to target as it appears, and `pulse="forward" | "back"` with `pulseAt` sends a
dot along it. `"back"` runs against the arrow, which is how a row travels up a
plan tree whose arrows are requests travelling down: the executor slide needs
both directions on one arrow.

Arrows landing on the same side of a box get their own points along it, in the
order of their sources, instead of piling their heads into one shape. This is
placement of arrow ends, not layout: boxes stay where the author put them.
Every arrow counts whether it has appeared yet or not, so one arriving later
never moves one already on screen. Tails still share a point; a fan-out reads
fine.

**A3c. Questions to the room are stepped.** `<Predict appearAt>` is a prompt
put before the answer is on screen. A prompt visible from step 0 has been read
and half-answered before the presenter reaches it. Unlike a `<Note>` it
reserves no height: it is not replaced by a later one.

**A5c. SQL in a heading is highlighted, and a statement leaves the heading.**
Inline code inside a slide's `h1` is coloured with the same Shiki theme as a
block, so a keyword or table name reads as code rather than as more purple
words. A whole statement does not belong in a heading at all: it wraps at a
heading's size and splits the question around it. A quiz question about one
says "this statement" and shows it underneath in a `<Query>`, a highlighted
block with no session that nothing can run. It applies to every
heading, not only the quiz, so a keyword looks the same in every title. Inline
code elsewhere is left as it was: in prose and notes it is as often
a setting or a function name as SQL, and highlighting would colour it
inconsistently.

**A5a. `<Morph>` for one statement becoming another form of itself.** Stepped,
read-only SQL that animates token by token between texts (via
`@shikijs/magic-move`), for slides where a cut would lose which part became
which — the analyzer turning names into OIDs. Not a block: nothing runs. The
text it morphs into is a sketch, and says so in a comment.

## Collection architecture

**F4e. A collection contains talks, sessions and slides.** The empty hash opens
a collection page; a talk's manifest orders its sessions. Positions use
`#/postgres/s1/12/3`, with zero-based slide and step positions. Old
`#/s1/12/3` links enter PostgreSQL and are rewritten to the new form.
The slide finder searches only the selected talk, and an All talks link returns
to the collection. Mixing all talks into the finder was rejected because it
would make live navigation longer and ambiguous.

**S5. A Lab is optional and owns its behaviour.** The generic Deck has no
PostgreSQL import. A dynamically loaded integration supplies navigation/reset
effects, status, its overlay, extra keys and scoped MDX components. Shared
diagrams, notes, choices and highlighted code need no Lab. PostgreSQL opens
its server connection on the first Lab request and its browser socket only
while the talk is selected; leaving closes it and resets named sessions.
The example talk and collection need no PostgreSQL installation or service.
An elaborate plugin/package framework was rejected because one typed integration
boundary suffices. A globally initialised Lab was rejected because its startup
failure would prevent unrelated talks from running.

Generic `just dev` installs dependencies and starts the collection. PostgreSQL
owns setup/bootstrap/psql in its own justfile, exposed by `just postgres <command>`.
The original setup/bootstrap/reset/psql/sizes and screenshot session shorthand
remain aliases so rehearsal commands keep working.

## Conventions

- Each talk owns slides, notes, database fixtures and assets.
- Design IDs remain unique across shared and talk-specific documents.
- No auth; the server binds to localhost.
- `just shots <talk> <session>` checks the fixed stage via the real keyboard path.
