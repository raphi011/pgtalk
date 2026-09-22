// Proves E1 (two sessions), E2 (blocked vs failed) and E4 (fixture restore)
// against a running `just dev`. Exits non-zero on the first failed assertion.
import WebSocket from "ws";

const ws = new WebSocket("ws://127.0.0.1:5173/lab");
const log = [];
const state = {};
const waiters = [];

ws.on("message", (d) => {
  const m = JSON.parse(String(d));
  log.push(m);
  if (m.type === "state") state[m.session] = m;
  for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
});

const send = (m) => ws.send(JSON.stringify(m));
// `from` limits the search to messages received after a mark, for assertions
// where an identical message earlier in the run would otherwise match.
const until = (pred, ms = 10000, from = 0) =>
  new Promise((resolve, reject) => {
    const hit = log.slice(from).find(pred);
    if (hit) return resolve(hit);
    const w = { pred, resolve };
    waiters.push(w);
    setTimeout(() => reject(new Error("timeout waiting for " + pred)), ms).unref?.();
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
};

await new Promise((r) => ws.on("open", r));

send({ type: "restore", fixture: "orders", force: true });
const restored = await until((m) => m.type === "restored");
check("fixture restores", restored.durationMs < 3000, `${restored.durationMs.toFixed(0)} ms`);

send({ type: "run", blockId: "a", session: "s1", sql: "SELECT count(*) FROM orders WHERE status = 'shipped';" });
const a = await until((m) => m.blockId === "a");
check("simple query returns rows", a.type === "result" && a.results[0].rows.length === 1, JSON.stringify(a.results?.[0]?.rows));
check("values arrive as postgres text", typeof a.results?.[0]?.rows?.[0]?.[0] === "string");

send({ type: "run", blockId: "b", session: "s1", sql: "SELECT * FROM nope;" });
const b = await until((m) => m.blockId === "b");
check("bad sql is an error, not a crash", b.type === "error" && b.error.code === "42P01", b.error?.message);
check("session survives an error", (await until((m) => m.type === "state" && m.session === "s1" && m.state === "idle")) != null);

send({ type: "run", blockId: "c", session: "s1", sql: "BEGIN; UPDATE orders SET status = 'shipped' WHERE id = 1;" });
await until((m) => m.blockId === "c");
await sleep(400);
check("open transaction shows as in-transaction", state.s1?.state === "in-transaction", state.s1?.state);

send({ type: "run", blockId: "d", session: "s2", sql: "UPDATE orders SET status = 'cancelled' WHERE id = 1;" });
const blocked = await until((m) => m.type === "state" && m.session === "s2" && m.state === "blocked");
check("conflicting write reports blocked", true, blocked.waiting);
check("blocked statement has not settled", !log.some((m) => m.blockId === "d"));

send({ type: "run", blockId: "e", session: "s1", sql: "COMMIT;" });
const d = await until((m) => m.blockId === "d");
check("blocked statement completes on commit", d.type === "result", `${d.durationMs.toFixed(0)} ms`);
check("s2 returns to idle", (await until((m) => m.type === "state" && m.session === "s2" && m.state === "idle")) != null);

// A state message carries no query identity, so it cannot serve as an
// acknowledgement that this particular statement started: the one that arrives
// might be the previous block's, reported late by the poller. Waiting a beat
// is what makes this deterministic, and pg_sleep(30) makes the window wide.
send({ type: "run", blockId: "slow", session: "s1", sql: "SELECT pg_sleep(30);" });
await sleep(500);
send({ type: "reset-sessions" });
const abandoned = await until((m) => m.blockId === "slow");
check("a reset reports the statement it interrupted", abandoned.type === "error", abandoned.error?.message);

send({ type: "run", blockId: "g", session: "s1", sql: "SET max_parallel_workers_per_gather = 0;" });
await until((m) => m.blockId === "g");
send({ type: "reset-sessions" });
await until((m) => m.type === "state" && m.session === "s1" && m.state === "disconnected");
send({ type: "run", blockId: "h", session: "s1", sql: "SHOW max_parallel_workers_per_gather;" });
const h = await until((m) => m.blockId === "h");
check("a slide change drops session-local SET", h.results?.[0]?.rows?.[0]?.[0] !== "0", JSON.stringify(h.results?.[0]?.rows));

send({ type: "run", blockId: "f", session: "s1", sql: "SELECT status FROM orders WHERE id = 1;" });
const f = await until((m) => m.blockId === "f");
check("s1 sees s2's committed write", f.results?.[0]?.rows?.[0]?.[0] === "cancelled", JSON.stringify(f.results?.[0]?.rows));

ws.close();
console.log(failures ? `\n${failures} failure(s)` : "\nall ok");
process.exit(failures ? 1 : 0);
