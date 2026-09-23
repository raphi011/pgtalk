import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lab, useLab } from "../lab.js";
import { StepContext } from "../components/Step.js";
import { Repl } from "../components/Repl.js";
import { Switcher } from "./Switcher.js";
import { RegistryContext, type BlockHandle } from "./registry.js";
import { useHashRoute, writeHash } from "./route.js";
import { ZoomContext } from "./zoom.js";
import { sessionIds, slidesOf } from "./slides.js";

/** Shows a slide fully built; clamped down to its real step count on mount. */
const ALL_STEPS = 9999;

/**
 * The slide is laid out on a fixed 16:9 stage and zoomed to fit the window, so
 * the room's projector changes how big the slide is and never what fits on it:
 * a slide that fits at rehearsal fits on stage.
 */
export const STAGE = { width: 1600, height: 900 };

/**
 * Fits the stage to the element it is centred in, which is the window less the
 * status bar, so the bar can sit at the bottom of the window at any aspect ratio.
 */
function useStageZoom() {
  const [zoom, setZoom] = useState(1);
  const ref = useCallback((area: HTMLElement | null) => {
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setZoom(Math.min(width / STAGE.width, height / STAGE.height));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  return [zoom, ref] as const;
}

export function Deck() {
  const [route, setRoute] = useHashRoute(sessionIds[0] ?? "s1");
  const [steps, setSteps] = useState({ path: "", max: 0 });
  const [showNotes, setShowNotes] = useState(false);
  const [showRepl, setShowRepl] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const { connected, fatal } = useLab();
  const [zoom, stageAreaRef] = useStageZoom();

  const deck = slidesOf(route.session);
  const index = Math.min(route.slide, Math.max(0, deck.length - 1));
  const slide = deck[index];

  // Steps register themselves as the slide renders (A3). The count is keyed by
  // slide path rather than reset in an effect: a child's effect runs before its
  // parent's, so an effect here would clear the registrations it just received.
  const path = slide?.path ?? "";
  const pathRef = useRef(path);
  pathRef.current = path;
  const register = useCallback((step: number) => {
    setSteps((prev) =>
      prev.path !== pathRef.current
        ? { path: pathRef.current, max: step }
        : step > prev.max
          ? { path: prev.path, max: step }
          : prev,
    );
  }, []);

  const maxStep = steps.path === path ? steps.max : 0;

  // route.step is the position asked for; step is what this slide can show.
  // Entering at ALL_STEPS lands on the fully built slide without the route
  // having to know the count in advance.
  const step = Math.min(route.step, maxStep);
  useEffect(() => {
    writeHash({ session: route.session, slide: index, step });
  }, [route.session, index, step]);

  // Restoring only on a change of fixture keeps navigation inside one fixture
  // instant, and entering a slide cold correct (E4).
  const current = useRef<string | null>(null);
  useEffect(() => {
    if (slide?.fixture && slide.fixture !== current.current) {
      current.current = slide.fixture;
      lab.restore(slide.fixture);
    } else {
      // Same fixture, new slide: the data is already right, but a SET or an
      // open transaction from the previous slide is not.
      lab.resetSessions();
    }
  }, [path]);

  const blocks = useRef<BlockHandle[]>([]);
  // Which blocks have already run, by the stable id a block keeps across the
  // re-registration that stepping back and forward causes.
  const ran = useRef(new Set<string>());
  const registry = useMemo(
    () => ({
      register(handle: BlockHandle) {
        blocks.current.push(handle);
        return () => {
          blocks.current = blocks.current.filter((b) => b !== handle);
        };
      },
      didRun(id: string) {
        ran.current.add(id);
      },
      names: new Map<string, string>(),
    }),
    [],
  );
  // Blocks unregister themselves as they unmount, so only the run record needs
  // clearing here. Clearing the handles too would be wrong: a child's effect
  // runs before this one, so it would wipe the new slide's registrations.
  useEffect(() => {
    ran.current = new Set();
  }, [slide?.path]);

  const go = useCallback(
    (slideDelta: number, atEnd = false) => {
      const next = index + slideDelta;
      if (next < 0 || next >= deck.length) return;
      setRoute({ ...route, slide: next, step: atEnd ? ALL_STEPS : 0 });
    },
    [index, deck.length, route],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The switcher handles its own keys, closing included, on its input.
      if (showSwitcher) return;
      if (showRepl) {
        // Like the notes, the REPL takes the keyboard while it is open. Its
        // own keys are handled on its input; only closing it is the deck's.
        if (e.key === "Escape" || (e.key === "`" && !(e.target instanceof HTMLTextAreaElement))) {
          setShowRepl(false);
          e.preventDefault();
        }
        return;
      }
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key !== "Escape") return;
        (e.target as HTMLElement).blur();
        return;
      }
      if (showNotes) {
        // While the notes are up the deck ignores its own keys, leaving arrows,
        // space and page keys to scroll the overlay natively.
        if (e.key === "n" || e.key === "Escape") {
          setShowNotes(false);
          e.preventDefault();
        }
        return;
      }
      // The block `Enter` and `e` address: the first one on the slide that has
      // not run yet, so a paired slide walks s1 then s2 on the same key. Once
      // they all have, it stays on the last, which is where a re-run is wanted.
      const focused = blocks.current.find((b) => !ran.current.has(b.id)) ?? blocks.current.at(-1);
      switch (e.key) {
        case "ArrowRight":
        case " ":
          if (step < maxStep) setRoute({ ...route, step: step + 1 });
          else go(1);
          break;
        case "ArrowLeft":
          if (step > 0) setRoute({ ...route, step: step - 1 });
          else go(-1, true);
          break;
        case "ArrowDown":
          go(1);
          break;
        case "ArrowUp":
          go(-1);
          break;
        case "Enter":
          focused?.run();
          break;
        case "e":
          focused?.toggleEdit();
          break;
        case "n":
          setShowNotes(true);
          break;
        case "`":
          setShowRepl(true);
          break;
        case "r":
          // Force: the fixture is by definition already loaded, and the point
          // of the key is to undo whatever the last few minutes did to it.
          if (slide?.fixture) lab.restore(slide.fixture, true);
          break;
        case "g":
          setShowSwitcher(true);
          break;
        default:
          if (/^[1-9]$/.test(e.key)) blocks.current[Number(e.key) - 1]?.run();
          return;
      }
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [route, step, maxStep, go, slide?.fixture, showNotes, showRepl, showSwitcher]);

  // The overlay scrolls with the keyboard only while it holds focus, and it
  // opens at the top rather than where it was last left.
  const notesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (showNotes) {
      notesRef.current?.scrollTo(0, 0);
      notesRef.current?.focus();
    }
  }, [showNotes]);

  if (!slide) {
    return <div className="deck empty">No slides in {route.session}.</div>;
  }

  const Body = slide.default;
  const Notes = slide.Notes;
  return (
    <RegistryContext.Provider value={registry}>
      <StepContext.Provider value={{ step, register }}>
        <div className="deck">
          <div className="stage-area" ref={stageAreaRef}>
            <div className="stage" style={{ zoom }}>
              <div className="stage-body">
                <article className="slide">
                  <ZoomContext.Provider value={zoom}>
                    <Body />
                  </ZoomContext.Provider>
                </article>
              </div>
            </div>
          </div>

          <footer className="chrome">
            <span className={connected ? "dot ok" : "dot bad"} />
            <span>{route.session}</span>
            <span>
              {index + 1} / {deck.length}
            </span>
            {maxStep > 0 ? (
              <span>
                step {step} / {maxStep}
              </span>
            ) : null}
            {slide.fixture ? <span className="fixture">{slide.fixture}</span> : null}
            {fatal ? <span className="fatal">{fatal}</span> : null}
          </footer>

          {showNotes && Notes ? (
            <aside className="notes" tabIndex={-1} ref={notesRef}>
              <header className="notes-head">
                <span>{slide.title ?? `slide ${index + 1}`}</span>
                <span className="spacer" />
                <span>n or esc to close</span>
              </header>
              <div className="notes-body">
                <Notes />
              </div>
            </aside>
          ) : null}

          {showRepl ? <Repl /> : null}

          {showSwitcher ? (
            <Switcher
              current={{ session: route.session, index }}
              onGo={(session, slide) => {
                setShowSwitcher(false);
                setRoute({ session, slide, step: 0 });
              }}
              onClose={() => setShowSwitcher(false)}
            />
          ) : null}
        </div>
      </StepContext.Provider>
    </RegistryContext.Provider>
  );
}
