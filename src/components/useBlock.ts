import { useEffect, useId, useRef, useState } from "react";
import { lab, useLab } from "../lab.js";
import { useRegistry } from "../deck/registry.js";
import { useAppeared } from "./Step.js";
import type { SessionState } from "../../server/protocol.js";

/**
 * Whether blocks can be edited in place (A5b). Off while questions from the
 * floor go to the REPL; the editing path stays so it can be switched back on.
 */
const EDITABLE = false;

/**
 * Everything a runnable block needs: its own output, its session's state, and
 * a keyboard registration that is live only while the block is visible.
 *
 * `wrap` lets a block send something other than what it shows — <Plan> shows a
 * query and sends EXPLAIN.
 */
export function useBlock({
  session,
  sql: initial,
  appearAt = 0,
  hideAt,
  name,
  against,
  wrap = (s: string) => s,
}: {
  session: string;
  sql: string;
  appearAt?: number;
  hideAt?: number;
  /** How a later block on the same slide refers to this one. */
  name?: string;
  /** A named block whose answer this one is shown against. */
  against?: string;
  wrap?: (sql: string) => string;
}) {
  const id = useId();
  const state = useLab();
  const [sql, setSql] = useState(initial);
  const [editing, setEditing] = useState(false);
  const appeared = useAppeared(appearAt, hideAt);
  const { register, didRun, names } = useRegistry();

  // Registered for as long as the block is mounted, which is as long as its
  // slide is: a hidden block keeps its hooks, so it can still be compared to.
  useEffect(() => {
    if (!name) return;
    names.set(name, id);
    return () => {
      if (names.get(name) === id) names.delete(name);
    };
  }, [name, id, names]);

  // The keyboard runs the current text, not the text captured at registration.
  const latest = useRef({ sql, session, wrap });
  latest.current = { sql, session, wrap };

  const run = () => {
    didRun(id);
    lab.run(id, latest.current.session, latest.current.wrap(latest.current.sql));
  };

  // Registered through a ref so the keyboard and the button are the same path:
  // a block run by either is a block the deck knows has run.
  const latestRun = useRef(run);
  latestRun.current = run;

  useEffect(() => {
    if (!appeared) return;
    return register({
      id,
      run: () => latestRun.current(),
      toggleEdit: () => {
        if (EDITABLE) setEditing((e) => !e);
      },
    });
  }, [id, register, appeared]);

  const status: SessionState = state.sessions[session]?.state ?? "disconnected";

  return {
    id,
    appeared,
    sql,
    setSql,
    editable: EDITABLE,
    editing,
    setEditing,
    run,
    status,
    waiting: state.sessions[session]?.waiting,
    blockedBy: state.sessions[session]?.blockedBy,
    running: state.pending[id] !== undefined,
    startedAt: state.pending[id]?.startedAt,
    output: state.blocks[id],
    baseline: against ? state.blocks[names.get(against) ?? ""] : undefined,
  };
}
