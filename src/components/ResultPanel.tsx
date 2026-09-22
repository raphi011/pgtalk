import type { BlockOutput } from "../lab.js";
import type { Field, QueryResult } from "../../server/protocol.js";

/** Type OIDs PostgreSQL uses for numbers; psql right-aligns these. */
const NUMERIC = new Set([20, 21, 23, 700, 701, 1700]);
/**
 * Of those, the ones a slide uses for quantities: `count(*)` and the size
 * functions are bigint. An int4 is as often a pid as an amount, and grouping
 * the digits of a pid would make it look like one.
 */
const GROUPED = new Set([20, 1700]);

function display(field: Field, cell: string) {
  if (!GROUPED.has(field.dataTypeID) || !/^-?\d{5,}$/.test(cell)) return cell;
  return cell.replace(/\B(?=(\d{3})+$)/g, ",");
}

/** Signed difference for two integers, or nothing for anything else. */
function delta(before: string, after: string) {
  if (!/^-?\d+$/.test(before) || !/^-?\d+$/.test(after)) return null;
  const d = BigInt(after) - BigInt(before);
  const digits = (d < 0n ? -d : d).toString().replace(/\B(?=(\d{3})+$)/g, ",");
  return `${d < 0n ? "−" : "+"}${digits}`;
}

function Cell({
  field,
  cell,
  before,
}: {
  field: Field;
  cell: string | null;
  before?: string | null;
}) {
  const numeric = NUMERIC.has(field.dataTypeID);
  const classes = [numeric ? "num" : "", cell === null ? "null" : ""];
  const shown = cell === null ? "NULL" : display(field, cell);

  // A value compared against an earlier run shows both, so the audience does
  // not have to remember a number from a panel that has left the screen (A4a).
  if (before !== undefined && before !== cell) {
    const d = before !== null && cell !== null ? delta(before, cell) : null;
    return (
      <td className={[...classes, "changed"].join(" ")}>
        <span className="was">{before === null ? "NULL" : display(field, before)}</span>
        <span className="to"> → </span>
        <span className="now">{shown}</span>
        {d ? <span className="delta"> {d}</span> : null}
      </td>
    );
  }
  return <td className={classes.join(" ").trim() || undefined}>{shown}</td>;
}

function Table({ result, baseline }: { result: QueryResult; baseline?: QueryResult }) {
  // Columns are matched by name, rows by position: a comparison is between
  // two runs of the same query, not a join.
  const beforeCol = result.fields.map((f) => baseline?.fields.findIndex((b) => b.name === f.name) ?? -1);
  return (
    <table>
      <thead>
        <tr>
          {result.fields.map((f) => (
            <th key={f.name} className={NUMERIC.has(f.dataTypeID) ? "num" : undefined}>
              {f.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => {
              const prev = baseline?.rows[ri];
              const before = prev && beforeCol[ci] >= 0 ? prev[beforeCol[ci]] : undefined;
              return <Cell key={ci} field={result.fields[ci]} cell={cell} before={before} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Results as HTML tables, monospace, sized for a projector (A4). `baseline` is
 * an earlier block's answer to compare this one against.
 */
export function ResultPanel({ output, baseline }: { output?: BlockOutput; baseline?: BlockOutput }) {
  if (!output) return null;

  if (output.error) {
    const e = output.error;
    return (
      <div key={output.at} className="panel error arrived">
        <div className="error-line">
          ERROR:  {e.message}
          {e.code ? <span className="sqlstate"> ({e.code})</span> : null}
        </div>
        {e.detail ? <div className="error-aux">DETAIL:  {e.detail}</div> : null}
        {e.hint ? <div className="error-aux">HINT:  {e.hint}</div> : null}
      </div>
    );
  }

  // The last result with columns is the one a comparison is about: a block
  // that runs a SET before its SELECT still compares the SELECT.
  const base = baseline?.results?.filter((r) => r.fields.length > 0).at(-1);

  return (
    <div key={output.at} className="panel arrived">
      {output.notices?.map((n, i) => (
        <div key={i} className="notice">
          {n}
        </div>
      ))}
      {output.results?.map((r, i) => (
        <div key={i} className="result">
          {r.fields.length > 0 ? <Table result={r} baseline={base} /> : null}
          <div className="tag">
            {r.command}
            {r.rowCount !== null ? ` ${r.rowCount}` : ""}
          </div>
        </div>
      ))}
      <div className="timing">{output.durationMs.toFixed(1)} ms</div>
    </div>
  );
}
