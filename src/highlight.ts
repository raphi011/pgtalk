import { createHighlighter, type Highlighter } from "shiki";

let instance: Promise<Highlighter> | null = null;

export function highlighter() {
  instance ??= createHighlighter({ themes: ["github-dark"], langs: ["sql"] });
  return instance;
}
