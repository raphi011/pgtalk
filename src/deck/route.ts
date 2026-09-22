import { useEffect, useState } from "react";

export interface Route {
  session: string;
  slide: number;
  step: number;
}

/** Deck position lives in the hash (#/s1/12/3) so a reload resumes in place. */
export function parseHash(fallback: string): Route {
  const [session, slide, step] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    session: session || fallback,
    slide: Number(slide) || 0,
    step: Number(step) || 0,
  };
}

export function writeHash(r: Route) {
  const next = `#/${r.session}/${r.slide}/${r.step}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}

/**
 * The hash records the step the deck is actually showing, not the one asked
 * for: entering a slide at ALL_STEPS must leave a usable position behind.
 */
export function useHashRoute(fallback: string): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(() => parseHash(fallback));

  useEffect(() => {
    const onPop = () => setRoute(parseHash(fallback));
    addEventListener("hashchange", onPop);
    return () => removeEventListener("hashchange", onPop);
  }, [fallback]);

  return [route, setRoute];
}
