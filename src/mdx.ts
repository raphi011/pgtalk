import { Runnable, Sessions } from "./components/Runnable.js";

export function useMDXComponents(components: Record<string, unknown>) {
  return { Runnable, Sessions, ...components };
}
