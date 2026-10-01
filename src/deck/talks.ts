import type { ComponentType } from "react";
import type { BlockHandle } from "./registry.js";

export interface TalkManifest {
  title: string;
  sessions: string[];
  lab?: "postgres";
}

export interface ShortcutGroup {
  title: string;
  keys: string[][];
}

// Optional integrations own their effects and controls, keeping the stage reusable (S5).
export interface LabIntegration {
  components: Record<string, unknown>;
  Navigation: ComponentType<{ path: string; fixture?: string }>;
  Status: ComponentType<{ fixture?: string }>;
  Overlay: ComponentType;
  closeOverlayKeys: string[];
  shortcuts: ShortcutGroup[];
  onKey: (key: string, context: {
    fixture?: string;
    focused?: BlockHandle;
    blocks: BlockHandle[];
    openOverlay: () => void;
  }) => boolean;
}

const manifests = import.meta.glob<{ default: TalkManifest }>("../../talks/*/talk.ts", { eager: true });
export const talks = Object.entries(manifests).map(([path, module]) => ({
  ...module.default,
  id: path.split("/").at(-2)!,
}));
export type Talk = (typeof talks)[number];
export const talkOf = (id: string) => talks.find((talk) => talk.id === id);

export const integrations = {
  postgres: () => import("../labs/postgres/integration.js").then((module) => module.postgres),
};
