import { useEffect, useRef } from "react";
import type { ShortcutGroup } from "./talks.js";

const groups = [
  {
    title: "Deck",
    keys: [
      ["→ / Space", "Next step; next slide at the end"],
      ["←", "Previous step; previous slide at the start"],
      ["↓ / ↑", "Next / previous slide"],
      ["n", "Open notes"],
      ["g", "Find a slide"],
      ["?", "Open / close shortcuts"],
    ],
  },
  {
    title: "Slide finder",
    keys: [
      ["← / →", "Previous / next session"],
      ["↑ / ↓", "Select a slide"],
      ["PgUp / PgDn", "Move a screenful"],
      ["Enter", "Go to the selected slide"],
      ["Esc", "Close the finder"],
    ],
  },
  {
    title: "Notes",
    keys: [
      ["n / Esc", "Close notes"],
      ["↑ / ↓ / Space / PgUp / PgDn", "Scroll notes"],
      ["Esc", "Leave a slide’s text input"],
    ],
  },
];

/** A modal keeps the slide and its keyboard still while help is open (F4d). */
export function Shortcuts({ onClose, extraGroups = [] }: { onClose: () => void; extraGroups?: ShortcutGroup[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      // React removes the dialog before effect cleanup, so restore focus
      // explicitly when the browser can no longer do it for us (F4d).
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog className="shortcuts" ref={dialog} aria-labelledby="shortcuts-title" onCancel={onClose}>
      <header className="notes-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <span className="spacer" />
        <button autoFocus onClick={onClose} aria-label="Close shortcuts">? / esc · close</button>
      </header>
      <div className="shortcuts-groups">
        {[...groups, ...extraGroups].map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.keys.map(([keys, description]) => (
                <div key={keys}>
                  <dt><kbd>{keys}</kbd></dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
