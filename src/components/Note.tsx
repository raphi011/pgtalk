import type { ReactNode } from "react";
import { useAppeared } from "./Step.js";

/**
 * A stepped block of prose, for saying more about a diagram than a label can
 * hold. HTML rather than SVG text: it wraps on its own and can carry inline
 * code, which SVG tspans cannot do without manual line breaking.
 */
export function Note({
  appearAt = 0,
  hideAt,
  children,
}: {
  appearAt?: number;
  hideAt?: number;
  children: ReactNode;
}) {
  const appeared = useAppeared(appearAt, hideAt);
  if (!appeared) return null;
  return <div className="note">{children}</div>;
}
