import { Runnable, Sessions } from "./components/Runnable.js";
import { Arrow, Box, Code, Diagram, Highlight, Label } from "./components/Diagram.js";
import { Step } from "./components/Step.js";
import { Plan } from "./components/Plan.js";

const shared = { Runnable, Sessions, Plan, Diagram, Box, Arrow, Code, Label, Highlight, Step };

export function useMDXComponents(components: Record<string, unknown>) {
  return { ...shared, ...components };
}
