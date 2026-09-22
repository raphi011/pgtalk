import { Runnable, Sessions } from "./components/Runnable.js";
import { Arrow, Box, Code, Diagram, Highlight, Label } from "./components/Diagram.js";
import { Step } from "./components/Step.js";
import { Note } from "./components/Note.js";
import { Plan } from "./components/Plan.js";
import { PageMap } from "./components/PageMap.js";
import { Morph } from "./components/Morph.js";
import { Predict } from "./components/Predict.js";

const shared = { Runnable, Sessions, Plan, PageMap, Morph, Diagram, Box, Arrow, Code, Label, Highlight, Step, Note, Predict };

export function useMDXComponents(components: Record<string, unknown>) {
  return { ...shared, ...components };
}
