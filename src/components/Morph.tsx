import { useContext, useEffect, useState } from "react";
import type { Highlighter } from "shiki";
import { ShikiMagicMove } from "@shikijs/magic-move/react";
import "@shikijs/magic-move/dist/style.css";
import { highlighter } from "../highlight.js";
import { ZoomContext } from "../deck/zoom.js";
import { useStep } from "./Step.js";

/**
 * Read-only SQL that turns into other text as the presenter steps, tokens
 * that survive sliding to their new place rather than the block being
 * replaced. For showing one statement become another form of itself, where a
 * cut would lose which part became which. Not a block: nothing here runs.
 *
 * Each entry shows from its `at` until the next one's; the first entry's `at`
 * is when the whole thing appears.
 */
export function Morph({ steps }: { steps: { at: number; sql: string }[] }) {
  const { step, register } = useStep();
  const ats = steps.map((s) => s.at).join(",");
  useEffect(() => {
    for (const s of ats.split(",")) register(Number(s));
  }, [ats, register]);

  const zoom = useContext(ZoomContext);
  const [h, setH] = useState<Highlighter | null>(null);
  useEffect(() => {
    let live = true;
    highlighter().then((x) => {
      if (live) setH(x);
    });
    return () => {
      live = false;
    };
  }, []);

  const current = steps.filter((s) => step >= s.at).at(-1);
  if (!current || !h) return null;
  return (
    <div className="sql morph">
      <ShikiMagicMove highlighter={h} lang="sql" theme="github-dark" code={current.sql} options={{ duration: 800, globalScale: zoom }} />
    </div>
  );
}
