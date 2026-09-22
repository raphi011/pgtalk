import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { lab, useLab } from "../lab.js";
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

/**
 * Time since the statement was sent, ticking while it is outstanding. A
 * two-second UPDATE otherwise looks exactly like one that never started, and
 * a blocked statement's wait is the number session 5 is about.
 */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, []);
  return <span className="elapsed">{((now - since) / 1000).toFixed(1)} s</span>;
}

export function BlockFrame({
  session,
  block,
  prefix,
  actions,
  children,
}: {
  session: string;
  block: ReturnType<typeof useBlock>;
  prefix?: string;
  /** Extra buttons a block type adds beside edit and run. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const paired = useContext(Paired);
  return (
    <div className={`runnable state-${block.status}${paired ? " paired" : ""}`}>
      <div className="runnable-head">
        <span className="session-name">{session}</span>
        <span className={`badge badge-${block.status}`}>
          {STATE_LABEL[block.status]}
          {block.blockedBy?.length ? ` by ${block.blockedBy.join(", ")}` : ""}
          {block.waiting ? ` on ${block.waiting}` : ""}
        </span>
        {block.running && block.startedAt !== undefined ? <Elapsed since={block.startedAt} /> : null}
        <span className="spacer" />
        {actions}
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
      <Sql sql={block.sql} prefix={prefix} editing={block.editing} onChange={block.setSql} />
      {children}
    </div>
  );
}

/**
 * A block retired by `hideAt` leaves the slide, and its keyboard registration
 * with it: a long demo can show the step it is on rather than every step it
 * has been through, the same way a <Note> replaces the previous caption (A3).
 * The session keeps whatever the block did — an open transaction survives its
 * block leaving the screen.
 */
export function Runnable({
  session = "s1",
  sql,
  appearAt = 0,
  hideAt,
  name,
  against,
}: {
  session?: string;
  sql: string;
  appearAt?: number;
  hideAt?: number;
  name?: string;
  against?: string;
}) {
  const block = useBlock({ session, sql, appearAt, hideAt, name, against });
  if (!block.appeared) return null;
  return (
    <BlockFrame session={session} block={block}>
      <ResultPanel output={block.output} baseline={block.baseline} />
    </BlockFrame>
  );
}

/**
 * Two sessions side by side (E1). While one waits on the other's lock, a
 * connector under the panes points from the waiter to the holder: the badge
 * says it in words, the connector says it where the eye already is. The row
 * is reserved even when empty so a lock arriving does not shift the slide.
 */
export function Sessions({ children }: { children: ReactNode }) {
  const { sessions } = useLab();
  // Each column's session, read from the pane's own props with the same
  // default a block uses.
  const columns = Children.toArray(children).map((c) =>
    isValidElement<{ session?: string }>(c) ? (c.props.session ?? "s1") : undefined,
  );
  const waits = columns.flatMap((name, from) =>
    (name ? (sessions[name]?.blockedBy ?? []) : [])
      .map((holder) => ({ name, holder, from, to: columns.indexOf(holder) }))
      .filter((w) => w.to >= 0 && w.to !== w.from),
  );
  const centre = (i: number) => ((i + 0.5) / columns.length) * 100;

  return (
    <Paired.Provider value={true}>
      <div className="sessions">{children}</div>
      <div className="waits">
        {waits.map((w) => (
          <div
            key={`${w.name}-${w.holder}`}
            className={`waits-for ${w.to < w.from ? "to-left" : "to-right"}`}
            style={{
              left: `${centre(Math.min(w.from, w.to))}%`,
              width: `${Math.abs(centre(w.to) - centre(w.from))}%`,
            }}
          >
            <span>
              {w.name} waits for {w.holder}
            </span>
          </div>
        ))}
      </div>
    </Paired.Provider>
  );
}
