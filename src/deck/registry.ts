import { createContext, useContext } from "react";

/** A runnable block the presenter can trigger from the keyboard. */
export interface BlockHandle {
  id: string;
  run: () => void;
  toggleEdit: () => void;
}

export interface Registry {
  register: (handle: BlockHandle) => () => void;
  /** Every path to running a block reports it, so `Enter` can find the next. */
  didRun: (id: string) => void;
  /** Blocks by their `name`, so a later block can compare `against` one (A4a). */
  names: Map<string, string>;
}

export const RegistryContext = createContext<Registry>({
  register: () => () => {},
  didRun: () => {},
  names: new Map(),
});
export const useRegistry = () => useContext(RegistryContext);
