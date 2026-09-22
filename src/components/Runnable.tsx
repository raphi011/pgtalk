import { createContext, useContext, type ReactNode } from "react";
import { lab } from "../lab.js";
import { ResultPanel } from "./ResultPanel.js";
import { Sql } from "./Sql.js";
import { useBlock } from "./useBlock.js";
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

export function BlockFrame({
  session,
  block,
  children,
}: {
  session: string;
  block: ReturnType<typeof useBlock>;
  children: ReactNode;
}) {
  const paired = useContext(Paired);
  return (
    <div className={`runnable state-${block.status}${paired ? " paired" : ""}`}>
      <div className="runnable-head">
        <span className="session-name">{session}</span>
        <span className={`badge badge-${block.status}`}>
          {STATE_LABEL[block.status]}
          {block.waiting ? ` — ${block.waiting}` : ""}
        </span>
        <span className="spacer" />
        <button onClick={() => block.setEditing((e) => !e)}>
          {block.editing ? "done" : "edit"}
        </button>
        {block.status === "blocked" || block.running ? (
          <button onClick={() => lab.cancel(session)}>cancel</button>
        ) : null}
        <button className="run" onClick={block.run}>
          run
        </button>
      </div>
      <Sql sql={block.sql} editing={block.editing} onChange={block.setSql} />
      {children}
    </div>
  );
}

export function Runnable({
  session = "s1",
  sql,
  appearAt = 0,
}: {
  session?: string;
  sql: string;
  appearAt?: number;
}) {
  const block = useBlock({ session, sql, appearAt });
  if (!block.appeared) return null;
  return (
    <BlockFrame session={session} block={block}>
      <ResultPanel output={block.output} />
    </BlockFrame>
  );
}

/** Two sessions side by side (E1). */
export function Sessions({ children }: { children: ReactNode }) {
  return (
    <Paired.Provider value={true}>
      <div className="sessions">{children}</div>
    </Paired.Provider>
  );
}
