import { useEffect, useState } from "react";
import { highlighter } from "../highlight.js";

function useHighlighted(sql: string) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let live = true;
    highlighter().then((h) => {
      if (live) setHtml(h.codeToHtml(sql, { lang: "sql", theme: "github-dark" }));
    });
    return () => {
      live = false;
    };
  }, [sql]);
  return html;
}

/**
 * Highlighted, read-only SQL. Editing swaps in a textarea (A5).
 *
 * `prefix` is SQL the block wraps around the query — EXPLAIN and its options.
 * It is shown so the audience can reproduce the command, and kept out of the
 * editable region because changing it would not change what runs.
 */
export function Sql({
  sql,
  prefix,
  editing,
  onChange,
}: {
  sql: string;
  prefix?: string;
  editing: boolean;
  onChange: (sql: string) => void;
}) {
  const html = useHighlighted(sql);
  const prefixHtml = useHighlighted(prefix ?? "");

  return (
    <>
      {prefix ? (
        <div className="sql sql-prefix" dangerouslySetInnerHTML={{ __html: prefixHtml }} />
      ) : null}
      {editing ? (
        <textarea
          className="sql-edit"
          value={sql}
          spellCheck={false}
          autoFocus
          rows={Math.max(2, sql.split("\n").length)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="sql" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </>
  );
}
