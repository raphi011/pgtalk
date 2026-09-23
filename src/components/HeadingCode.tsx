import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import type { ThemedToken } from "shiki";
import { highlighter } from "../highlight.js";

const InHeading = createContext(false);

/** A slide heading, marking its inline code for highlighting (A5c). */
export function H1(props: ComponentProps<"h1">) {
  return (
    <InHeading.Provider value={true}>
      <h1 {...props} />
    </InHeading.Provider>
  );
}

/**
 * Inline code. In a heading it is SQL, highlighted like a block's; elsewhere
 * it renders unchanged (A5c).
 */
export function InlineCode(props: ComponentProps<"code">) {
  const inHeading = useContext(InHeading);
  if (!inHeading || typeof props.children !== "string") return <code {...props} />;
  return <HighlightedCode sql={props.children} />;
}

function HighlightedCode({ sql }: { sql: string }) {
  const [tokens, setTokens] = useState<ThemedToken[] | null>(null);
  useEffect(() => {
    let live = true;
    highlighter().then((h) => {
      if (live) setTokens(h.codeToTokensBase(sql, { lang: "sql", theme: "github-dark" }).flat());
    });
    return () => {
      live = false;
    };
  }, [sql]);

  let body: ReactNode = sql;
  if (tokens) {
    body = tokens.map((t, i) => (
      <span key={i} style={{ color: t.color }}>
        {t.content}
      </span>
    ));
  }
  return <code className="heading-sql">{body}</code>;
}
