import { createContext } from "react";

/**
 * The zoom the stage is shown at. Layout inside the stage is unaffected, but
 * anything that measures the screen gets zoomed pixels and has to divide them
 * back out before writing them into a style (F4a).
 */
export const ZoomContext = createContext(1);
