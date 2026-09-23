import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sessionIds, slidesOf } from "./slides.js";

/**
 * Every word must match: a number matches the slide's number exactly, any
 * other word a part of its title (F4c).
 */
function search(query: string, session: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return slidesOf(session)
    .map((s, index) => ({ index, title: s.title ?? "" }))
    .filter((e) =>
      words.every((w) => (/^\d+$/.test(w) ? Number(w) === e.index + 1 : e.title.toLowerCase().includes(w))),
    );
}

/**
 * A searchable jump to any slide (F4c). It lists one session at a time,
 * starting with the current one, and `Left`/`Right` change session. It opens
 * over the slide like the REPL and takes the keyboard while it is up.
 */
export function Switcher({
  current,
  onGo,
  onClose,
}: {
  current: { session: string; index: number };
  onGo: (session: string, index: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(current.session);
  const [selected, setSelected] = useState(0);
  const results = search(query, session);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    list.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected, query, session]);

  // Moves the selection by `delta` rows, clamped to the list.
  const move = (delta: number) => setSelected((i) => Math.max(0, Math.min(i + delta, results.length - 1)));
  // A page is as many rows as the list shows at once.
  const page = () => {
    const row = list.current?.firstElementChild as HTMLElement | null;
    return row ? Math.max(1, Math.floor(list.current!.clientHeight / row.offsetHeight)) : 1;
  };
  // Steps to the neighbouring session, stopping at either end like the deck.
  const turn = (delta: number) => {
    const next = sessionIds[sessionIds.indexOf(session) + delta];
    if (!next) return;
    setSession(next);
    setSelected(0);
  };

  // Left and Right no longer move the caret: a search is a word or two, typed
  // and deleted, so the keys are worth more for changing session.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "PageDown") move(page());
    else if (e.key === "PageUp") move(-page());
    else if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowLeft") turn(-1);
    else if (e.key === "Enter" && results[selected]) onGo(session, results[selected].index);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <aside className="switcher">
      <input
        className="switcher-input"
        autoFocus
        spellCheck={false}
        placeholder="Slide number or title"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
      />
      <nav className="switcher-sessions">
        {sessionIds.map((id) => (
          <span key={id} className={id === session ? "active" : ""}>
            {id} · {slidesOf(id)[0]?.title}
          </span>
        ))}
        <span className="switcher-hint">← → session</span>
      </nav>
      <ol className="switcher-list" ref={list}>
        {results.length === 0 ? <li className="switcher-empty">No slide matches</li> : null}
        {results.map((r, i) => (
          <li
            key={r.index}
            className={[
              i === selected ? "selected" : "",
              session === current.session && r.index === current.index ? "current" : "",
            ].join(" ")}
            onMouseMove={() => setSelected(i)}
            onClick={() => onGo(session, r.index)}
          >
            <span className="switcher-pos">{r.index + 1}</span>
            {r.title}
          </li>
        ))}
      </ol>
    </aside>
  );
}
