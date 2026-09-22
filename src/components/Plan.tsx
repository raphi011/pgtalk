import { BlockFrame } from "./Runnable.js";
import { useBlock } from "./useBlock.js";

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
  const estimated = node["Plan Rows"];
  const actual = node["Actual Rows"];
  const loops = node["Actual Loops"] ?? 1;
  const actualTotal = actual === undefined ? undefined : actual * loops;
  const ratio =
    actualTotal === undefined
      ? 0
      : Math.max(estimated, 1) / Math.max(actualTotal, 1) >= MISESTIMATE ||
          Math.max(actualTotal, 1) / Math.max(estimated, 1) >= MISESTIMATE
        ? Math.max(estimated, actualTotal) / Math.max(1, Math.min(estimated, actualTotal))
        : 0;

  const conditions = [
    node["Index Cond"] && ["Index Cond", node["Index Cond"]],
    node["Hash Cond"] && ["Hash Cond", node["Hash Cond"]],
    node.Filter && ["Filter", node.Filter],
  ].filter(Boolean) as [string, string][];

  return (
    <div className="plan-node" style={{ marginLeft: depth ? "1.6rem" : 0 }}>
      <div className="plan-title">{title(node)}</div>
      <div className="plan-meta">
        <span>
          cost {node["Startup Cost"].toFixed(2)}..{node["Total Cost"].toFixed(2)}
        </span>
        <span>
          rows {estimated.toLocaleString()}
          {actualTotal !== undefined ? ` → ${actualTotal.toLocaleString()}` : ""}
        </span>
        {node["Actual Total Time"] !== undefined ? (
          <span>{(node["Actual Total Time"] * loops).toFixed(2)} ms</span>
        ) : null}
        {loops > 1 ? <span>loops {loops.toLocaleString()}</span> : null}
        {node["Rows Removed by Filter"] ? (
          <span>−{node["Rows Removed by Filter"].toLocaleString()} filtered</span>
        ) : null}
        {node["Shared Read Blocks"] !== undefined ? (
          <span>
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
}: {
  session?: string;
  sql: string;
  analyze?: boolean;
  appearAt?: number;
}) {
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
        <div className="panel plan">
          <Node node={roots[0].Plan} />
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
