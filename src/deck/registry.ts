import { createContext, useContext } from "react";

/** A runnable block the presenter can trigger from the keyboard. */
export interface BlockHandle {
  run: () => void;
  toggleEdit: () => void;
}

export interface Registry {
  register: (handle: BlockHandle) => () => void;
}

export const RegistryContext = createContext<Registry>({ register: () => () => {} });
export const useRegistry = () => useContext(RegistryContext);
