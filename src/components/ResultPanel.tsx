import type { BlockOutput } from "../lab.js";

/** Results as HTML tables, monospace, sized for a projector (A4). */
export function ResultPanel({ output }: { output?: BlockOutput }) {
  if (!output) return null;

  if (output.error) {
    const e = output.error;
    return (
      <div className="panel error">
        <div className="error-line">
          ERROR:  {e.message}
          {e.code ? <span className="sqlstate"> ({e.code})</span> : null}
        </div>
        {e.detail ? <div className="error-aux">DETAIL:  {e.detail}</div> : null}
        {e.hint ? <div className="error-aux">HINT:  {e.hint}</div> : null}
      </div>
    );
  }

  return (
    <div className="panel">
      {output.notices?.map((n, i) => (
        <div key={i} className="notice">
          {n}
        </div>
      ))}
      {output.results?.map((r, i) => (
        <div key={i} className="result">
          {r.fields.length > 0 ? (
            <table>
              <thead>
                <tr>
                  {r.fields.map((f) => (
                    <th key={f.name}>{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={cell === null ? "null" : undefined}>
                        {cell === null ? "NULL" : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
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
