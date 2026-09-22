import pg from "pg";
import type {
  QueryError,
  QueryResult,
  ServerMessage,
  SessionName,
  SessionState,
} from "./protocol.js";

export const DEMO_DB = "pgtalk_demo";
export const fixtureDb = (name: string) => `pgtalk_fix_${name}`;

/**
 * Keep every value as the text PostgreSQL sent. node-postgres would otherwise
 * hand back Date and number objects, and the panel would render JavaScript's
 * idea of a timestamp rather than PostgreSQL's.
 */
const textOnly = { getTypeParser: () => (v: string) => v };

type Emit = (msg: ServerMessage) => void;

class Session {
  client: pg.Client | null = null;
  pid = 0;
  state: SessionState = "disconnected";
  waiting?: string;
  blockedBy?: string[];
  /** Resolves when the in-flight query settles; undefined when idle. */
  inFlight?: Promise<unknown>;
  /** The block whose query is in flight, and the one abandoned by a reset. */
  inFlightBlock?: string;
  abandonedBlock?: string;

  constructor(readonly name: SessionName) {}
}

/**
 * Owns one dedicated connection per named session (E1) plus one admin
 * connection to the `postgres` database used for observation, cancellation and
 * fixture restores. pg_stat_activity is cluster-wide, so a single admin
 * connection covers all three.
 */
export class Lab {
  private sessions = new Map<SessionName, Session>();
  private admin: pg.Client | null = null;
  private fixture: string | null = null;
  private poller?: NodeJS.Timeout;
  /** Serialises the admin connection: one client cannot run two queries. */
  private adminQueue: Promise<unknown> = Promise.resolve();
  /**
   * Settles when the last requested restore has finished. Runs wait on it and
   * nothing else does: queueing runs behind each other instead would leave a
   * COMMIT stuck behind the blocked statement it is meant to release (E2).
   */
  private restoring: Promise<unknown> = Promise.resolve();

  constructor(private emit: Emit) {}

  async start() {
    this.admin = new pg.Client({ database: "postgres", types: textOnly });
    await this.admin.connect();
    this.poller = setInterval(() => void this.poll(), 250);
  }

  async stop() {
    clearInterval(this.poller);
    for (const s of this.sessions.values()) await s.client?.end().catch(() => {});
    this.sessions.clear();
    await this.admin?.end().catch(() => {});
    this.admin = null;
  }

  /**
   * Run on the admin connection, one at a time. The poller, cancellation and
   * fixture restores all share it, and a restore landing mid-poll would
   * otherwise issue two concurrent queries on one client.
   */
  private withAdmin<T>(fn: (admin: pg.Client) => Promise<T>): Promise<T> {
    const next = this.adminQueue.then(() =>
      this.admin ? fn(this.admin) : Promise.reject(new Error("admin connection closed")),
    );
    this.adminQueue = next.catch(() => {});
    return next;
  }

  private async session(name: SessionName): Promise<Session> {
    let s = this.sessions.get(name);
    if (!s) {
      s = new Session(name);
      this.sessions.set(name, s);
    }
    if (!s.client) {
      const client = new pg.Client({
        database: DEMO_DB,
        application_name: `pgtalk:${name}`,
        types: textOnly,
      });
      client.on("error", () => this.setState(s!, "failed"));
      await client.connect();
      s.client = client;
      const pid = await client.query<{ pid: string }>("SELECT pg_backend_pid() AS pid");
      s.pid = Number(pid.rows[0].pid);
      this.setState(s, "idle");
    }
    return s;
  }

  private setState(s: Session, state: SessionState, waiting?: string, blockedBy?: string[]) {
    if (s.state === state && s.waiting === waiting && s.blockedBy?.join() === blockedBy?.join()) return;
    s.state = state;
    s.waiting = waiting;
    s.blockedBy = blockedBy;
    this.emit({ type: "state", session: s.name, state, pid: s.pid, waiting, blockedBy });
  }

  /**
   * A statement that has not settled is only `blocked` if the backend is
   * actually waiting on a lock; a slow sequential scan is `running` (E2).
   * Idle sessions report `in-transaction` when they hold an open transaction,
   * which is the state sessions 4 and 5 are about.
   *
   * A blocked session also names who it waits for: the other deck session by
   * name, anything else (a psql the presenter opened) by pid, since that is
   * what pg_stat_activity would show them.
   */
  private async poll() {
    const live = [...this.sessions.values()].filter((s) => s.client);
    if (!this.admin || live.length === 0) return;
    const pids = live.map((s) => s.pid);
    const { rows } = await this.withAdmin((admin) =>
      admin.query<{
        pid: string;
        state: string;
        wait_event_type: string | null;
        wait_event: string | null;
        blockers: string;
      }>(
        `SELECT pid, state, wait_event_type, wait_event, pg_blocking_pids(pid)::text AS blockers
           FROM pg_stat_activity WHERE pid = ANY($1::int[])`,
        [pids],
      ),
    ).catch(() => ({ rows: [] as never[] }));

    for (const s of live) {
      const row = rows.find((r) => Number(r.pid) === s.pid);
      if (!row) continue;
      if (s.inFlight) {
        if (row.wait_event_type === "Lock") {
          // int[] arrives as its text form, `{123,456}` (textOnly).
          const blockedBy = row.blockers
            .slice(1, -1)
            .split(",")
            .filter(Boolean)
            .map((pid) => live.find((o) => o.pid === Number(pid))?.name ?? `pid ${pid}`);
          this.setState(s, "blocked", row.wait_event ?? undefined, blockedBy);
        } else {
          this.setState(s, "running");
        }
      } else if (row.state === "idle in transaction") {
        this.setState(s, "in-transaction");
      } else if (row.state === "idle") {
        this.setState(s, "idle");
      }
    }
  }

  async run(blockId: string, name: SessionName, sql: string) {
    // A run sent the moment a slide appears can arrive while its fixture is
    // being copied, when the demo database does not exist.
    await this.restoring;
    let s: Session;
    try {
      s = await this.session(name);
    } catch (err) {
      // The block asked, so the block is answered (E3); the deck as a whole
      // is not broken by one session failing to connect.
      this.emit({ type: "error", blockId, session: name, error: toError(err), durationMs: 0 });
      return;
    }
    const notices: string[] = [];
    const onNotice = (n: { severity?: string; message?: string }) =>
      notices.push(`${n.severity}:  ${n.message}`);
    s.client!.on("notice", onNotice);

    const started = performance.now();
    this.setState(s, "running");
    const query = s.client!.query({ text: sql, rowMode: "array" });
    s.inFlight = query;
    s.inFlightBlock = blockId;

    /** True once a reset has already reported this block's fate. */
    const abandoned = () => {
      if (s.abandonedBlock !== blockId) return false;
      s.abandonedBlock = undefined;
      return true;
    };

    try {
      const raw = await query;
      if (abandoned()) return;
      const results = (Array.isArray(raw) ? raw : [raw]).map(toResult);
      this.emit({
        type: "result",
        blockId,
        session: name,
        results,
        notices,
        durationMs: performance.now() - started,
      });
    } catch (err) {
      if (abandoned()) return;
      this.emit({
        type: "error",
        blockId,
        session: name,
        error: toError(err),
        durationMs: performance.now() - started,
      });
    } finally {
      s.client?.off("notice", onNotice);
      s.inFlight = undefined;
      s.inFlightBlock = undefined;
      await this.poll();
    }
  }

  /**
   * Drop every session connection without touching the data. Session-local
   * state — SET, an open transaction — must not survive a slide change, or
   * entering a slide by walking to it would differ from entering it cold
   * (E4). Restoring the template for this would cost the best part of a
   * second per slide; reconnecting costs milliseconds.
   */
  async resetSessions() {
    for (const s of this.sessions.values()) {
      const client = s.client;
      const pid = s.pid;
      const interrupted = s.inFlightBlock;

      // Drop the reference before closing. client.end() waits for an in-flight
      // query to finish, so a session running pg_sleep would otherwise stay
      // visible — and answer the next run — for as long as the sleep lasts.
      s.client = null;
      s.pid = 0;
      s.inFlight = undefined;
      s.inFlightBlock = undefined;
      this.setState(s, "disconnected");

      // A statement losing its connection must fail loudly (E3). Without this
      // the block waits for a reply that can never come: navigate away from a
      // slow query and its panel would stay blank for ever.
      if (interrupted) {
        s.abandonedBlock = interrupted;
        this.emit({
          type: "error",
          blockId: interrupted,
          session: s.name,
          error: { message: "session was reset while this statement was running" },
          durationMs: 0,
        });
        if (pid) {
          await this.withAdmin((admin) =>
            admin.query("SELECT pg_cancel_backend($1)", [pid]),
          ).catch(() => {});
        }
      }

      void client?.end().catch(() => {});
    }
  }

  /** Cancel from the admin connection; the session's own is busy. */
  async cancel(name: SessionName) {
    const s = this.sessions.get(name);
    if (!s?.pid) return;
    await this.withAdmin((admin) =>
      admin.query("SELECT pg_cancel_backend($1)", [s.pid]),
    );
  }

  /**
   * Restore a fixture by copying its template database (E4). Sessions are
   * disconnected first: an open connection blocks DROP DATABASE, and after the
   * copy their old connection would point at a database that no longer exists.
   */
  restore(fixture: string, force = false) {
    const next = this.restoring.then(() => this.copyFixture(fixture, force));
    this.restoring = next.catch(() => {});
    return next;
  }

  private async copyFixture(fixture: string, force: boolean) {
    const started = performance.now();
    // Always answer, even when there is nothing to do: a caller waiting for
    // the reply must not hang because the fixture happened to be loaded.
    if (!force && this.fixture === fixture) {
      this.emit({ type: "restored", fixture, durationMs: 0 });
      return;
    }
    await this.resetSessions();
    await this.withAdmin(async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS ${DEMO_DB} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${DEMO_DB} TEMPLATE ${fixtureDb(fixture)}`);
    });
    this.fixture = fixture;
    this.emit({
      type: "restored",
      fixture,
      durationMs: performance.now() - started,
    });
  }
}

function toResult(r: pg.QueryArrayResult): QueryResult {
  return {
    command: r.command,
    rowCount: r.rowCount,
    fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: r.rows as (string | null)[][],
  };
}

function toError(err: unknown): QueryError {
  const e = err as pg.DatabaseError & { message: string };
  return {
    message: e.message,
    code: e.code,
    detail: e.detail ?? undefined,
    hint: e.hint ?? undefined,
    position: e.position ?? undefined,
  };
}
