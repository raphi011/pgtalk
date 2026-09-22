import { createContext, useContext, useEffect } from "react";
import { BlockFrame } from "./Runnable.js";
import { useBlock } from "./useBlock.js";
import { useStep } from "./Step.js";

/** The subset of EXPLAIN (FORMAT JSON) a slide reads. */
interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  Alias?: string;
  "Index Name"?: string;
  "Join Type"?: string;
  "Scan Direction"?: string;
  "Startup Cost": number;
  "Total Cost": number;
  "Plan Rows": number;
  "Plan Width": number;
  "Actual Rows"?: number;
  "Actual Total Time"?: number;
  "Actual Loops"?: number;
  "Index Cond"?: string;
  Filter?: string;
  "Hash Cond"?: string;
  "Rows Removed by Filter"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanNode[];
}

interface PlanRoot {
  Plan: PlanNode;
  "Execution Time"?: number;
  "Planning Time"?: number;
}

/** A misestimate worth pointing at from the stage. */
const MISESTIMATE = 10;

/**
 * Something on the tree to point at from a step: nodes whose title contains
 * `node` (every node when omitted), and optionally one of their figures. While
 * any focus is live the rest of the tree dims — the plan is the slide, and the
 * presenter is talking about one part of it.
 */
export interface Focus {
  at: number;
  until?: number;
  node?: string;
  metric?: "rows" | "time" | "loops" | "buffers";
}

interface Shown {
  focus: Focus[];
  /** The root's actual time, which every node's bar is a share of. */
  total?: number;
}

const ShownContext = createContext<Shown>({ focus: [] });

function title(node: PlanNode) {
  const parts = [node["Node Type"]];
  if (node["Join Type"] && node["Node Type"] !== "Nested Loop") {
    parts.unshift(node["Join Type"]);
  }
  if (node["Index Name"]) parts.push(`using ${node["Index Name"]}`);
  if (node["Relation Name"]) {
    parts.push(`on ${node["Relation Name"]}`);
    if (node.Alias && node.Alias !== node["Relation Name"]) parts.push(node.Alias);
  }
  return parts.join(" ");
}

function Node({ node, depth = 0 }: { node: PlanNode; depth?: number }) {
  const { focus, total } = useContext(ShownContext);
  const mine = focus.filter((f) => f.node === undefined || title(node).includes(f.node));
  const on = (metric: Focus["metric"]) => (mine.some((f) => f.metric === metric) ? "focus" : undefined);
  const dimmed = focus.length > 0 && mine.length === 0;

  // Every actual number PostgreSQL reports is per loop, and so is the
  // estimate. They are shown as psql shows them, unmultiplied: a listener
  // comparing this tree against their own terminal must see the same figures,
  // and multiplying would be wrong anyway under a Gather, where loops counts
  // workers running at the same time rather than one after another.
  const estimated = node["Plan Rows"];
  const actual = node["Actual Rows"];
  const loops = node["Actual Loops"] ?? 1;
  const ratio =
    actual === undefined
      ? 0
      : Math.max(estimated, 1) / Math.max(actual, 1) >= MISESTIMATE ||
          Math.max(actual, 1) / Math.max(estimated, 1) >= MISESTIMATE
        ? Math.max(estimated, actual) / Math.max(1, Math.min(estimated, actual))
        : 0;

  // Inclusive time as a share of the whole query: the bar that answers "where
  // did the time go" before anyone reads a number.
  const time = node["Actual Total Time"];
  const share = time !== undefined && total ? Math.min(1, (time * loops) / total) : undefined;

  const conditions = [
    node["Index Cond"] && ["Index Cond", node["Index Cond"]],
    node["Hash Cond"] && ["Hash Cond", node["Hash Cond"]],
    node.Filter && ["Filter", node.Filter],
  ].filter(Boolean) as [string, string][];

  return (
    <div
      className={["plan-node", ratio ? "off" : "", dimmed ? "dimmed" : "", mine.some((f) => !f.metric) ? "focus" : ""].join(" ")}
      style={{ marginLeft: depth ? "1.6rem" : 0 }}
    >
      <div className="plan-title">{title(node)}</div>
      {share !== undefined ? (
        <div className="plan-bar">
          <span style={{ width: `${share * 100}%` }} />
        </div>
      ) : null}
      <div className="plan-meta">
        <span>
          cost {node["Startup Cost"].toFixed(2)}..{node["Total Cost"].toFixed(2)}
        </span>
        <span className={on("rows")}>
          rows {estimated.toLocaleString()}
          {actual !== undefined ? ` → ${actual.toLocaleString()}` : ""}
        </span>
        {time !== undefined ? <span className={on("time")}>{time.toFixed(2)} ms</span> : null}
        {/* A loop count of 1 is noise until the presenter asks about loops. */}
        {loops > 1 || on("loops") ? (
          <span className={["loops", on("loops")].join(" ")}>loops {loops.toLocaleString()}</span>
        ) : null}
        {node["Rows Removed by Filter"] ? (
          <span>−{node["Rows Removed by Filter"].toLocaleString()} filtered</span>
        ) : null}
        {node["Shared Read Blocks"] !== undefined ? (
          <span className={on("buffers")}>
            buffers {node["Shared Hit Blocks"] ?? 0} hit / {node["Shared Read Blocks"]} read
          </span>
        ) : null}
        {ratio ? <span className="misestimate">{Math.round(ratio)}× off</span> : null}
      </div>
      {conditions.map(([k, v]) => (
        <div key={k} className="plan-cond">
          {k}: <code>{v}</code>
        </div>
      ))}
      {node.Plans?.map((child, i) => (
        <Node key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

/**
 * Shows a query, runs EXPLAIN for it, and renders the plan as a tree (A6).
 * Text plans are unreadable past about six lines on a projector.
 */
export function Plan({
  session = "s1",
  sql,
  analyze = false,
  appearAt = 0,
  focus = [],
}: {
  session?: string;
  sql: string;
  analyze?: boolean;
  appearAt?: number;
  focus?: Focus[];
}) {
  // Focus steps register like any other step, so the deck counts them (A3).
  const { step, register } = useStep();
  const steps = focus.flatMap((f) => (f.until === undefined ? [f.at] : [f.at, f.until])).join(",");
  useEffect(() => {
    for (const s of steps ? steps.split(",") : []) register(Number(s));
  }, [steps, register]);
  const live = focus.filter((f) => step >= f.at && (f.until === undefined || step < f.until));

  // Shown: what a listener would type in psql to get this. Sent: the same
  // thing plus FORMAT JSON, which is what the tree below is parsed from and
  // which by hand would only produce unreadable JSON.
  const shown = analyze ? "EXPLAIN (ANALYZE, BUFFERS)" : "EXPLAIN";
  const sent = ["FORMAT JSON", ...(analyze ? ["ANALYZE", "BUFFERS"] : [])].join(", ");
  const block = useBlock({
    session,
    sql,
    appearAt,
    wrap: (s) => `EXPLAIN (${sent}) ${s}`,
  });
  if (!block.appeared) return null;

  const raw = block.output?.results?.[0]?.rows?.[0]?.[0];
  const roots: PlanRoot[] | null = raw ? JSON.parse(raw) : null;

  return (
    <BlockFrame session={session} block={block} prefix={shown}>
      {block.output?.error ? (
        <div className="panel error">
          <div className="error-line">ERROR:  {block.output.error.message}</div>
        </div>
      ) : null}
      {roots ? (
        <div key={block.output!.at} className="panel plan arrived">
          <ShownContext.Provider value={{ focus: live, total: roots[0].Plan["Actual Total Time"] }}>
            <Node node={roots[0].Plan} />
          </ShownContext.Provider>
          <div className="plan-totals">
            {roots[0]["Planning Time"] !== undefined ? (
              <span>planning {roots[0]["Planning Time"].toFixed(2)} ms</span>
            ) : null}
            {roots[0]["Execution Time"] !== undefined ? (
              <span>execution {roots[0]["Execution Time"].toFixed(2)} ms</span>
            ) : null}
            {!analyze ? <span className="estimate-only">estimates only</span> : null}
            <span>tree rendered from FORMAT JSON</span>
          </div>
        </div>
      ) : null}
    </BlockFrame>
  );
}
