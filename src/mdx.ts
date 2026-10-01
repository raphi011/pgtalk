import { createContext, useContext } from "react";
import { Arrow, Box, Code, Diagram, Highlight, Label } from "./components/Diagram.js";
import { Step } from "./components/Step.js";
import { Note } from "./components/Note.js";
import { Morph } from "./components/Morph.js";
import { Predict } from "./components/Predict.js";
import { Choice, Choices } from "./components/Choices.js";
import { H1, InlineCode } from "./components/HeadingCode.js";
import { Query } from "./components/Query.js";

const shared = { Morph, Diagram, Box, Arrow, Code, Label, Highlight, Step, Note, Predict, Choices, Choice, Query, h1: H1, code: InlineCode };

export const AuthoringContext = createContext<Record<string, unknown>>({});

export function useMDXComponents(components: Record<string, unknown>) {
  return { ...shared, ...useContext(AuthoringContext), ...components };
}
