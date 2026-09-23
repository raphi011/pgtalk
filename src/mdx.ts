import { Runnable, Sessions } from "./components/Runnable.js";
import { Arrow, Box, Code, Diagram, Highlight, Label } from "./components/Diagram.js";
import { Step } from "./components/Step.js";
import { Note } from "./components/Note.js";
import { Plan } from "./components/Plan.js";
import { PageMap } from "./components/PageMap.js";
import { Morph } from "./components/Morph.js";
import { Predict } from "./components/Predict.js";
import { Choice, Choices } from "./components/Choices.js";
import { H1, InlineCode } from "./components/HeadingCode.js";
import { Query } from "./components/Query.js";

const shared = { Runnable, Sessions, Plan, PageMap, Morph, Diagram, Box, Arrow, Code, Label, Highlight, Step, Note, Predict, Choices, Choice, Query, h1: H1, code: InlineCode };

export function useMDXComponents(components: Record<string, unknown>) {
  return { ...shared, ...components };
}
