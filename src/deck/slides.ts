import type { ComponentType } from "react";

/**
 * A slide is an MDX module. Frontmatter would need extra plugins, so a slide
 * states its fixture and notes as plain ESM exports instead.
 */
export interface SlideModule {
  default: ComponentType;
  fixture?: string;
  notes?: string;
  title?: string;
}

export interface Slide extends SlideModule {
  path: string;
  session: string;
}

const modules = import.meta.glob<SlideModule>("../../slides/*/*.mdx", { eager: true });

export const slides: Slide[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, mod]) => ({
    ...mod,
    path,
    session: path.split("/").at(-2)!,
  }));

export const sessionIds = [...new Set(slides.map((s) => s.session))].sort();

export const slidesOf = (session: string) => slides.filter((s) => s.session === session);
