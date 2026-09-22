import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { lab, REPL_SESSION, useLab } from "../lab.js";
import { Elapsed, STATE_LABEL } from "./Runnable.js";
import { ResultPanel } from "./ResultPanel.js";
import { Sql } from "./Sql.js";

const noop = () => {};

/**
 * A psql-like prompt over the deck for a question from the floor (F4b). It
 * runs on a session of its own, so its answers come back through the same
 * panel as a slide's and it shows up in the wait graph by name.
 */
export function Repl() {
  const { repl, sessions } = useLab();
  const session = sessions[REPL_SESSION];
  const status = session?.state ?? "disconnected";
  const [input, setInput] = useState("");
  // Position in the history while recalling with Up/Down, and the text that
  // was being typed before recall started, so Down past the end gives it back.
  const recall = useRef<{ index: number; draft: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const last = repl.at(-1);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [repl.length, last?.output]);

  const run = () => {
    if (!input.trim()) return;
    lab.replRun(input);
    setInput("");
    recall.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const box = e.currentTarget;
    const collapsed = box.selectionStart === box.selectionEnd;
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey || input.trimEnd().endsWith(";"))) {
      // Like psql: a statement ending in `;` runs, anything else continues on
      // the next line. Cmd/Ctrl+Enter runs regardless.
      e.preventDefault();
      run();
    } else if (e.key === "c" && e.ctrlKey && collapsed) {
      e.preventDefault();
      lab.cancel(REPL_SESSION);
    } else if (e.key === "ArrowUp" && collapsed && !input.slice(0, box.selectionStart).includes("\n")) {
      const index = (recall.current?.index ?? repl.length) - 1;
      if (index < 0) return;
      e.preventDefault();
      recall.current = { index, draft: recall.current?.draft ?? input };
      setInput(repl[index].sql);
    } else if (e.key === "ArrowDown" && collapsed && !input.slice(box.selectionEnd).includes("\n")) {
      if (!recall.current) return;
      e.preventDefault();
      const index = recall.current.index + 1;
      if (index < repl.length) {
        recall.current = { ...recall.current, index };
        setInput(repl[index].sql);
      } else {
        setInput(recall.current.draft);
        recall.current = null;
      }
    }
  };

  return (
    <aside className="repl">
      <header className="notes-head">
        <span className="session-name">{REPL_SESSION}</span>
        <span className={`badge badge-${status}`}>
          {STATE_LABEL[status]}
          {session?.blockedBy?.length ? ` by ${session.blockedBy.join(", ")}` : ""}
          {session?.waiting ? ` on ${session.waiting}` : ""}
        </span>
        <span className="spacer" />
        <span>; or cmd+enter to run · ctrl+c to cancel · esc to close</span>
      </header>
      <div className="repl-scroll">
        {repl.map((entry) => (
          <div key={entry.id} className="repl-entry">
            <Sql sql={entry.sql} editing={false} onChange={noop} />
            {entry.output ? (
              <ResultPanel output={entry.output} />
            ) : (
              <div className="panel">
                <Elapsed since={entry.startedAt} />
              </div>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <textarea
        className="repl-input"
        value={input}
        spellCheck={false}
        autoFocus
        placeholder="SQL"
        rows={Math.max(2, input.split("\n").length)}
        onChange={(e) => {
          setInput(e.target.value);
          recall.current = null;
        }}
        onKeyDown={onKeyDown}
      />
    </aside>
  );
}
