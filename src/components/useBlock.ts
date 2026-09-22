import { useEffect, useId, useRef, useState } from "react";
import { lab, useLab } from "../lab.js";
import { useRegistry } from "../deck/registry.js";
import { useAppeared } from "./Step.js";
import type { SessionState } from "../../server/protocol.js";

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
  wrap = (s: string) => s,
}: {
  session: string;
  sql: string;
  appearAt?: number;
  wrap?: (sql: string) => string;
}) {
  const id = useId();
  const state = useLab();
  const [sql, setSql] = useState(initial);
  const [editing, setEditing] = useState(false);
  const appeared = useAppeared(appearAt);
  const { register } = useRegistry();

  // The keyboard runs the current text, not the text captured at registration.
  const latest = useRef({ sql, session, wrap });
  latest.current = { sql, session, wrap };

  const run = () => lab.run(id, latest.current.session, latest.current.wrap(latest.current.sql));

  useEffect(() => {
    if (!appeared) return;
    return register({
      run: () => lab.run(id, latest.current.session, latest.current.wrap(latest.current.sql)),
      toggleEdit: () => setEditing((e) => !e),
    });
  }, [id, register, appeared]);

  const status: SessionState = state.sessions[session]?.state ?? "disconnected";

  return {
    id,
    appeared,
    sql,
    setSql,
    editing,
    setEditing,
    run,
    status,
    waiting: state.sessions[session]?.waiting,
    running: state.pending[id] !== undefined,
    output: state.blocks[id],
  };
}
