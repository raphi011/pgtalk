import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lab, useLab } from "../lab.js";
import { StepContext } from "../components/Step.js";
import { RegistryContext, type BlockHandle } from "./registry.js";
import { useHashRoute, writeHash } from "./route.js";
import { sessionIds, slidesOf } from "./slides.js";

/** Shows a slide fully built; clamped down to its real step count on mount. */
const ALL_STEPS = 9999;

export function Deck() {
  const [route, setRoute] = useHashRoute(sessionIds[0] ?? "s1");
  const [steps, setSteps] = useState({ path: "", max: 0 });
  const [showNotes, setShowNotes] = useState(false);
  const { connected, fatal } = useLab();

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
  const registry = useMemo(
    () => ({
      register(handle: BlockHandle) {
        blocks.current.push(handle);
        return () => {
          blocks.current = blocks.current.filter((b) => b !== handle);
        };
      },
    }),
    [],
  );
  useEffect(() => {
    blocks.current = [];
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
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key !== "Escape") return;
        (e.target as HTMLElement).blur();
        return;
      }
      const last = blocks.current.at(-1);
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
          last?.run();
          break;
        case "e":
          last?.toggleEdit();
          break;
        case "n":
          setShowNotes((s) => !s);
          break;
        case "r":
          if (slide?.fixture) lab.restore(slide.fixture);
          break;
        case "g": {
          const answer = prompt(`Slide (1–${deck.length})`);
          const n = Number(answer);
          if (n >= 1 && n <= deck.length) setRoute({ ...route, slide: n - 1, step: 0 });
          break;
        }
        default:
          if (/^[1-9]$/.test(e.key)) blocks.current[Number(e.key) - 1]?.run();
          return;
      }
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [route, step, maxStep, go, deck.length, slide?.fixture]);

  if (!slide) {
    return <div className="deck empty">No slides in {route.session}.</div>;
  }

  const Body = slide.default;
  return (
    <RegistryContext.Provider value={registry}>
      <StepContext.Provider value={{ step, register }}>
        <div className="deck">
          <article className="slide">
            <Body />
          </article>

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

          {showNotes && slide.notes ? <aside className="notes">{slide.notes}</aside> : null}
        </div>
      </StepContext.Provider>
    </RegistryContext.Provider>
  );
}
