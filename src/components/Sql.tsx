import { useEffect, useState } from "react";
import { highlighter } from "../highlight.js";

/** Highlighted, read-only SQL. Editing swaps in a textarea (A5). */
export function Sql({
  sql,
  editing,
  onChange,
}: {
  sql: string;
  editing: boolean;
  onChange: (sql: string) => void;
}) {
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

  if (editing) {
    return (
      <textarea
        className="sql-edit"
        value={sql}
        spellCheck={false}
        autoFocus
        rows={Math.max(2, sql.split("\n").length)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return <div className="sql" dangerouslySetInnerHTML={{ __html: html }} />;
}
