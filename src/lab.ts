import { useSyncExternalStore } from "react";
import type {
  ClientMessage,
  QueryError,
  QueryResult,
  ServerMessage,
  SessionName,
  SessionState,
} from "../server/protocol.js";

export interface BlockOutput {
  session: SessionName;
  results?: QueryResult[];
  notices?: string[];
  error?: QueryError;
  durationMs: number;
}

interface LabState {
  connected: boolean;
  fatal?: string;
  sessions: Record<SessionName, { state: SessionState; pid?: number; waiting?: string }>;
  blocks: Record<string, BlockOutput>;
  pending: Record<string, SessionName>;
}

let state: LabState = { connected: false, sessions: {}, blocks: {}, pending: {} };
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;

function set(next: Partial<LabState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function connect() {
  if (socket) return;
  socket = new WebSocket(`ws://${location.host}/lab`);
  socket.onopen = () => set({ connected: true });
  socket.onclose = () => {
    set({ connected: false });
    socket = null;
    setTimeout(connect, 500);
  };
  socket.onmessage = (ev) => apply(JSON.parse(ev.data) as ServerMessage);
}

function apply(msg: ServerMessage) {
  switch (msg.type) {
    case "state":
      set({
        sessions: {
          ...state.sessions,
          [msg.session]: { state: msg.state, pid: msg.pid, waiting: msg.waiting },
        },
      });
      break;
    case "result":
    case "error": {
      const { [msg.blockId]: _, ...pending } = state.pending;
      set({
        pending,
        blocks: {
          ...state.blocks,
          [msg.blockId]: {
            session: msg.session,
            durationMs: msg.durationMs,
            ...(msg.type === "result"
              ? { results: msg.results, notices: msg.notices }
              : { error: msg.error }),
          },
        },
      });
      break;
    }
    case "restored":
      set({ blocks: {}, pending: {} });
      break;
    case "fatal":
      set({ fatal: msg.message });
      break;
  }
}

function send(msg: ClientMessage) {
  connect();
  const wait = () => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    else setTimeout(wait, 50);
  };
  wait();
}

export const lab = {
  run(blockId: string, session: SessionName, sql: string) {
    set({ pending: { ...state.pending, [blockId]: session } });
    send({ type: "run", blockId, session, sql });
  },
  cancel(session: SessionName) {
    send({ type: "cancel", session });
  },
  restore(fixture: string) {
    send({ type: "restore", fixture });
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
