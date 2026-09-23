import type { ReactNode } from "react";
import { useAppeared } from "./Step.js";

/**
 * A quiz question's options, lettered for a show of hands (A3d). Letters
 * rather than numbers, because `1`-`9` already run blocks. The answer is
 * marked on `revealAt`, a later step than the options, so the room commits
 * before it is shown.
 */
export function Choices({
  appearAt = 1,
  revealAt,
  children,
}: {
  appearAt?: number;
  revealAt: number;
  children: ReactNode;
}) {
  const appeared = useAppeared(appearAt);
  const revealed = useAppeared(revealAt);
  if (!appeared) return null;
  return <ol className={revealed ? "choices revealed" : "choices"}>{children}</ol>;
}

export function Choice({ correct = false, children }: { correct?: boolean; children: ReactNode }) {
  return <li className={correct ? "choice correct" : "choice"}>{children}</li>;
}
