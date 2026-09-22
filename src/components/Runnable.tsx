import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { lab, useLab } from "../lab.js";
import { ResultPanel } from "./ResultPanel.js";
import { Sql } from "./Sql.js";
import { useRegistry } from "../deck/registry.js";
import { useAppeared } from "./Step.js";
import type { SessionState } from "../../server/protocol.js";

/** Set by <Sessions> so a nested block knows it is one of a pair. */
const Paired = createContext(false);

const STATE_LABEL: Record<SessionState, string> = {
  disconnected: "disconnected",
  idle: "idle",
  "in-transaction": "in transaction",
  running: "running",
  blocked: "blocked",
  failed: "failed",
};

export function Runnable({
  session = "s1",
  sql: initial,
  appearAt = 0,
}: {
  session?: string;
  sql: string;
  appearAt?: number;
}) {
  const id = useId();
  const state = useLab();
  const [sql, setSql] = useState(initial);
  const [editing, setEditing] = useState(false);
  const paired = useContext(Paired);
  const appeared = useAppeared(appearAt);
  const { register } = useRegistry();

  // The keyboard triggers the latest value of sql, not the one captured when
  // the block first registered.
  const latest = useRef({ sql, session });
  latest.current = { sql, session };
  // Only a visible block should answer the keyboard.
  useEffect(() => {
    if (!appeared) return;
    return register({
      run: () => lab.run(id, latest.current.session, latest.current.sql),
      toggleEdit: () => setEditing((e) => !e),
    });
  }, [id, register, appeared]);

  if (!appeared) return null;

  const info = state.sessions[session];
  const status = info?.state ?? "disconnected";
  const running = state.pending[id] !== undefined;

  return (
    <div className={`runnable state-${status}${paired ? " paired" : ""}`}>
      <div className="runnable-head">
        <span className="session-name">{session}</span>
        <span className={`badge badge-${status}`}>
          {STATE_LABEL[status]}
          {info?.waiting ? ` — ${info.waiting}` : ""}
        </span>
        <span className="spacer" />
        <button onClick={() => setEditing((e) => !e)}>{editing ? "done" : "edit"}</button>
        {status === "blocked" || running ? (
          <button onClick={() => lab.cancel(session)}>cancel</button>
        ) : null}
        <button className="run" onClick={() => lab.run(id, session, sql)}>
          run
        </button>
      </div>
      <Sql sql={sql} editing={editing} onChange={setSql} />
      <ResultPanel output={state.blocks[id]} />
    </div>
  );
}

/** Two sessions side by side (E1). */
export function Sessions({ children }: { children: React.ReactNode }) {
  return (
    <Paired.Provider value={true}>
      <div className="sessions">{children}</div>
    </Paired.Provider>
  );
}
