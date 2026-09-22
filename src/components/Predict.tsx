import type { ReactNode } from "react";
import { useAppeared } from "./Step.js";

/**
 * A question put to the room before the answer is on screen. Stepped, because
 * a prompt visible from the start has been read, and half-answered, before the
 * presenter gets to it. No reserved height, unlike <Note>: a prompt is not
 * replaced by the next one, it stays until the slide changes.
 */
export function Predict({ appearAt = 0, children }: { appearAt?: number; children: ReactNode }) {
  const appeared = useAppeared(appearAt);
  if (!appeared) return null;
  return (
    <div className="predict">
      <strong>Predict.</strong> {children}
    </div>
  );
}
