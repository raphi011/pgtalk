import { useSyncExternalStore } from "react";
import type {
  ClientMessage,
  QueryError,
  QueryResult,
  ServerMessage,
  SessionName,
  SessionState,
} from "../../../server/labs/postgres/protocol.js";

export interface BlockOutput {
  session: SessionName;
  results?: QueryResult[];
  notices?: string[];
  error?: QueryError;
  durationMs: number;
  /** When the answer arrived, so a re-run replaces the panel rather than patching it. */
  at: number;
}

/**
 * A statement typed into the REPL. Kept apart from `blocks`, which every slide
 * change clears: the scrollback outlives navigation even though the REPL's
 * connection does not (F4b).
 */
export interface ReplEntry {
  id: string;
  sql: string;
  startedAt: number;
  output?: BlockOutput;
}

/** The session the REPL runs on, a backend of its own (F4b). */
export const REPL_SESSION = "repl";

interface LabState {
  connected: boolean;
  fatal?: string;
  sessions: Record<
    SessionName,
    { state: SessionState; pid?: number; waiting?: string; blockedBy?: string[] }
  >;
  blocks: Record<string, BlockOutput>;
  /** Blocks awaiting an answer, and when they were sent. */
  pending: Record<string, { session: SessionName; startedAt: number }>;
  repl: ReplEntry[];
}

let state: LabState = { connected: false, sessions: {}, blocks: {}, pending: {}, repl: [] };
let replCount = 0;
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let generation = 0;

function set(next: Partial<LabState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function connect() {
  if (socket) return;
  const connection = new WebSocket(`ws://${location.host}/lab`);
  socket = connection;
  // A fatal is about the connection it arrived on; a fresh one starts clean.
  socket.onopen = () => set({ connected: true, fatal: undefined });
  socket.onclose = () => {
    if (socket !== connection) return;
    set({ connected: false });
    socket = null;
    const previous = generation;
    setTimeout(() => { if (generation === previous) connect(); }, 500);
  };
  socket.onmessage = (ev) => apply(JSON.parse(ev.data) as ServerMessage);
}

function apply(msg: ServerMessage) {
  switch (msg.type) {
    case "state":
      set({
        sessions: {
          ...state.sessions,
          [msg.session]: {
            state: msg.state,
            pid: msg.pid,
            waiting: msg.waiting,
            blockedBy: msg.blockedBy,
          },
        },
      });
      break;
    case "result":
    case "error": {
      const output: BlockOutput = {
        session: msg.session,
        durationMs: msg.durationMs,
        at: performance.now(),
        ...(msg.type === "result"
          ? { results: msg.results, notices: msg.notices }
          : { error: msg.error }),
      };
      if (state.repl.some((e) => e.id === msg.blockId)) {
        set({ repl: state.repl.map((e) => (e.id === msg.blockId ? { ...e, output } : e)) });
        break;
      }
      const { [msg.blockId]: _, ...pending } = state.pending;
      set({ pending, blocks: { ...state.blocks, [msg.blockId]: output } });
      break;
    }
    case "restored":
      // A restore that completed proves the server can reach the database, so
      // an earlier fatal no longer describes the deck.
      set({ blocks: {}, pending: {}, fatal: undefined });
      break;
    case "fatal":
      set({ fatal: msg.message });
      break;
  }
}

function send(msg: ClientMessage) {
  connect();
  const previous = generation;
  const wait = () => {
    if (previous !== generation) return;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    else setTimeout(wait, 50);
  };
  wait();
}

export const lab = {
  disconnect() {
    // Leaving the selected talk cancels reconnects and queued sends (S5).
    generation++;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "reset-sessions" }));
    const previous = socket;
    socket = null;
    previous?.close();
    const now = performance.now();
    set({
      connected: false, sessions: {}, blocks: {}, pending: {},
      // The closed socket cannot deliver a reset reply to an unfinished prompt (E3).
      repl: state.repl.map((entry) => entry.output ? entry : {
        ...entry,
        output: {
          session: REPL_SESSION,
          durationMs: now - entry.startedAt,
          at: now,
          error: { message: "session was reset while this statement was running" },
        },
      }),
    });
  },
  run(blockId: string, session: SessionName, sql: string) {
    set({ pending: { ...state.pending, [blockId]: { session, startedAt: performance.now() } } });
    send({ type: "run", blockId, session, sql });
  },
  replRun(sql: string) {
    const id = `repl-${++replCount}`;
    set({ repl: [...state.repl, { id, sql, startedAt: performance.now() }] });
    send({ type: "run", blockId: id, session: REPL_SESSION, sql });
  },
  cancel(session: SessionName) {
    send({ type: "cancel", session });
  },
  restore(fixture: string, force = false) {
    send({ type: "restore", fixture, force });
  },
  resetSessions() {
    set({ blocks: {}, pending: {} });
    send({ type: "reset-sessions" });
  },
};

export function useLab(): LabState {
  return useSyncExternalStore(
    (l) => {
      connect();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
