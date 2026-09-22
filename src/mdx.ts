import { Runnable, Sessions } from "./components/Runnable.js";
import { Arrow, Box, Diagram, Highlight, Label } from "./components/Diagram.js";
import { Step } from "./components/Step.js";

const shared = { Runnable, Sessions, Diagram, Box, Arrow, Label, Highlight, Step };

export function useMDXComponents(components: Record<string, unknown>) {
  return { ...shared, ...components };
}
