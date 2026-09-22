import { lab, useLab } from "./lab.js";
import { Runnable, Sessions } from "./components/Runnable.js";

/**
 * Temporary harness for build step 2: proves E1 (two sessions), E2 (blocked vs
 * failed) and E4 (fixture restore) before the deck machinery exists.
 */
export function App() {
  const { connected, fatal } = useLab();
  return (
    <div className="deck">
      <h1>Session layer harness</h1>
      <p style={{ color: fatal ? "var(--bad)" : "var(--dim)" }}>
        {fatal ?? (connected ? "connected" : "connecting…")}
        {" · "}
        <button onClick={() => lab.restore("orders")}>restore fixture</button>
      </p>

      <Runnable sql="SELECT count(*) FROM orders WHERE status = 'shipped';" />
      <Runnable sql="SELECT * FROM nope;" />

      <Sessions>
        <Runnable
          session="s1"
          sql={"BEGIN;\nUPDATE orders SET status = 'shipped' WHERE id = 1;"}
        />
        <Runnable
          session="s2"
          sql={"UPDATE orders SET status = 'cancelled' WHERE id = 1;"}
        />
      </Sessions>

      <Sessions>
        <Runnable session="s1" sql="COMMIT;" />
        <Runnable session="s2" sql="SELECT status FROM orders WHERE id = 1;" />
      </Sessions>
    </div>
  );
}
