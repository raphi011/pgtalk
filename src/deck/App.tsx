import { useEffect, useState } from "react";
import { Collection } from "./Collection.js";
import { Deck } from "./Deck.js";
import { useHashRoute } from "./route.js";
import { integrations, talkOf, type LabIntegration, type Talk } from "./talks.js";

function TalkDeck({ talk, ...props }: { talk: Talk } & Omit<Parameters<typeof Deck>[0], "talk" | "integration">) {
  const [integration, setIntegration] = useState<LabIntegration>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let live = true;
    if (talk.lab) integrations[talk.lab]().then(
      (loaded) => { if (live) setIntegration(loaded); },
      (reason) => { if (live) setError(String(reason)); },
    );
    return () => { live = false; };
  }, [talk.lab]);
  if (error) return <main className="collection">{error} <a href="#/">All talks</a></main>;
  if (talk.lab && !integration) return <main className="collection">Loading {talk.title}…</main>;
  return <Deck {...props} talk={talk} integration={integration} />;
}

export function App() {
  const [route, setRoute] = useHashRoute();
  const talk = route && talkOf(route.talk);
  useEffect(() => { document.title = talk ? talk.title : "Talks"; }, [talk]);
  return talk && route
    ? <TalkDeck key={talk.id} talk={talk} route={route} setRoute={setRoute} />
    : <Collection />;
}
