import { useHighlighted } from "./Sql.js";

/**
 * A statement shown for reading, not running: a quiz question about a query
 * puts it here rather than in the heading (A5c). No session and no key, so it
 * takes no place in the order `Enter` and `1`-`9` run blocks in.
 */
export function Query({ sql }: { sql: string }) {
  const html = useHighlighted(sql);
  return <div className="sql query" dangerouslySetInnerHTML={{ __html: html }} />;
}
