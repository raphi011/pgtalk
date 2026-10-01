import type { ComponentType } from "react";

/**
 * A slide is an MDX module. Frontmatter would need extra plugins, so a slide
 * states its fixture as a plain ESM export instead.
 */
export interface SlideModule {
  default: ComponentType;
  fixture?: string;
  title?: string;
}

export interface Slide extends SlideModule {
  path: string;
  talk: string;
  session: string;
  /** Background for the slide, from its sibling `.notes.md` (F3). */
  Notes?: ComponentType;
}

const modules = import.meta.glob<SlideModule>("../../talks/*/slides/*/*.mdx", { eager: true });

// Notes are markdown rather than a string export: they are long enough to want
// headings and lists, and the MDX plugin already compiles `.md` as plain
// markdown, so this costs no dependency.
const notes = import.meta.glob<{ default: ComponentType }>("../../talks/*/slides/*/*.notes.md", {
  eager: true,
});

export const slides: Slide[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({
    ...mod,
    path,
    talk: path.split("/").at(-4)!,
    session: path.split("/").at(-2)!,
    Notes: notes[path.replace(/\.mdx$/, ".notes.md")]?.default,
  }));

export const slidesOf = (talk: string, session: string) => slides.filter((s) => s.talk === talk && s.session === session);
