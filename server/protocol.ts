// Wire protocol between the deck and the session layer.

export type SessionName = string;

/** What a session is doing. `blocked` and `failed` are different (E2). */
export type SessionState =
  | "disconnected"
  | "idle"
  | "in-transaction"
  | "running"
  | "blocked"
  | "failed";

export interface Field {
  name: string;
  dataTypeID: number;
}

export interface QueryResult {
  command: string;
  rowCount: number | null;
  fields: Field[];
  rows: (string | null)[][];
}

export interface QueryError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  position?: string;
}

export type ClientMessage =
  | { type: "run"; blockId: string; session: SessionName; sql: string }
  | { type: "cancel"; session: SessionName }
  | { type: "reset-sessions" }
  | { type: "restore"; fixture: string; force?: boolean };

export type ServerMessage =
  /**
   * Session state changed. When blocked, `waiting` names the lock wait event
   * (`transactionid`, `relation` ...) and `blockedBy` the sessions holding the
   * lock (a pid for one outside the deck).
   */
  | {
      type: "state";
      session: SessionName;
      state: SessionState;
      pid?: number;
      waiting?: string;
      blockedBy?: string[];
    }
  | {
      type: "result";
      blockId: string;
      session: SessionName;
      results: QueryResult[];
      notices: string[];
      durationMs: number;
    }
  | {
      type: "error";
      blockId: string;
      session: SessionName;
      error: QueryError;
      durationMs: number;
    }
  | { type: "restored"; fixture: string; durationMs: number }
  | { type: "fatal"; message: string };
