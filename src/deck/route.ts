import { useEffect, useState } from "react";
import { talkOf } from "./talks.js";

export interface Route {
  talk: string;
  session: string;
  slide: number;
  step: number;
}

// Legacy links still enter PostgreSQL; an empty hash opens the collection (F4e).
export function parseHash(): Route | null {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (!parts[0]) return null;
  if (/^s\d+$/.test(parts[0])) parts.unshift("postgres");
  const [talk, session, slide, step] = parts;
  const manifest = talkOf(talk);
  if (!manifest) return null;
  const position = (value: string) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  };
  return {
    talk,
    session: manifest.sessions.includes(session) ? session : manifest.sessions[0],
    slide: position(slide),
    step: position(step),
  };
}

export function writeHash(route: Route) {
  const next = `#/${route.talk}/${route.session}/${route.slide}/${route.step}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}

export function useHashRoute(): [Route | null, (route: Route) => void] {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onPop = () => setRoute(parseHash());
    addEventListener("hashchange", onPop);
    return () => removeEventListener("hashchange", onPop);
  }, []);
  return [route, setRoute];
}
