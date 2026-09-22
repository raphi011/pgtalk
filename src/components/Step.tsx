import { createContext, useContext, useEffect, type ReactNode } from "react";

interface StepCtx {
  /** The step the presenter has advanced to. */
  step: number;
  /** Tells the deck this slide has at least this many steps (A3). */
  register: (step: number) => void;
}

export const StepContext = createContext<StepCtx>({ step: 0, register: () => {} });

export function useStep() {
  return useContext(StepContext);
}

/**
 * True once the presenter has reached `appearAt`. Registering here rather than
 * in the deck is what lets a slide's step count come from its own content.
 */
export function useAppeared(appearAt = 0) {
  const { step, register } = useStep();
  useEffect(() => register(appearAt), [appearAt, register]);
  return step >= appearAt;
}

/**
 * The raw escape hatch (A3): anything inside shares the step machinery without
 * going through the DSL.
 */
export function Step({ n = 0, children }: { n?: number; children: ReactNode }) {
  const appeared = useAppeared(n);
  return <g className={appeared ? "appear in" : "appear"}>{children}</g>;
}
