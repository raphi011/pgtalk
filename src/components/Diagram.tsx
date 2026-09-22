import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAppeared } from "./Step.js";
import { highlighter } from "../highlight.js";

/** Grid unit in SVG user units; boxes are placed on whole grid cells (A3). */
const CELL = 100;
const GAP = 12;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const Geometry = createContext<Map<string, Rect>>(new Map());

const rectOf = (p: BoxProps): Rect => ({
  x: p.x * CELL + GAP / 2,
  y: p.y * CELL + GAP / 2,
  w: (p.w ?? 2) * CELL - GAP,
  h: (p.h ?? 1) * CELL - GAP,
});

/**
 * Collect every <Box> in the tree before rendering, so <Arrow> can reference a
 * box declared after it. Walking the children is what keeps the DSL free of
 * authoring order rules.
 */
function collect(children: ReactNode, into: Map<string, Rect>) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { id?: string; children?: ReactNode };
    if (child.type === Box && props.id) into.set(props.id, rectOf(child.props as BoxProps));
    if (props.children) collect(props.children, into);
  });
}

export function Diagram({
  cols = 12,
  rows = 6,
  children,
}: {
  cols?: number;
  rows?: number;
  children: ReactNode;
}) {
  const geometry = new Map<string, Rect>();
  collect(children, geometry);

  return (
    <Geometry.Provider value={geometry}>
      <svg className="diagram" viewBox={`0 0 ${cols * CELL} ${rows * CELL}`}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        </defs>
        {children}
      </svg>
    </Geometry.Provider>
  );
}

interface BoxProps {
  id?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  tone?: "plain" | "accent" | "warn";
  appearAt?: number;
}

export function Box(props: BoxProps) {
  const { label, sub, tone = "plain", appearAt = 0 } = props;
  const r = rectOf(props);
  const appeared = useAppeared(appearAt);

  return (
    <g className={`appear ${appeared ? "in" : ""} box tone-${tone}`}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={10} />
      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (sub ? -6 : 6)} textAnchor="middle">
        {label}
      </text>
      {sub ? (
        <text className="sub" x={r.x + r.w / 2} y={r.y + r.h / 2 + 18} textAnchor="middle">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

/** Anchor on the side of `a` that faces `b`. */
function anchor(a: Rect, b: Rect): [number, number] {
  const ac = [a.x + a.w / 2, a.y + a.h / 2];
  const bc = [b.x + b.w / 2, b.y + b.h / 2];
  const dx = bc[0] - ac[0];
  const dy = bc[1] - ac[1];
  if (Math.abs(dx) > Math.abs(dy)) {
    return [dx > 0 ? a.x + a.w : a.x, ac[1]];
  }
  return [ac[0], dy > 0 ? a.y + a.h : a.y];
}

export function Arrow({
  from,
  to,
  label,
  appearAt = 0,
}: {
  from: string;
  to: string;
  label?: string;
  appearAt?: number;
}) {
  const geometry = useContext(Geometry);
  const appeared = useAppeared(appearAt);
  const a = geometry.get(from);
  const b = geometry.get(to);
  if (!a || !b) return null;

  const [x1, y1] = anchor(a, b);
  const [x2, y2] = anchor(b, a);

  // Offset the label off the line rather than onto it: a vertical arrow would
  // otherwise strike straight through its own text.
  const vertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
  const lx = (x1 + x2) / 2 + (vertical ? 14 : 0);
  const ly = (y1 + y2) / 2 + (vertical ? 5 : -10);

  return (
    <g className={`appear ${appeared ? "in" : ""} arrow`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#arrowhead)" />
      {label ? (
        <text x={lx} y={ly} textAnchor={vertical ? "start" : "middle"}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function Label({
  x,
  y,
  text,
  appearAt = 0,
  align = "middle",
}: {
  x: number;
  y: number;
  text: string;
  appearAt?: number;
  align?: "start" | "middle" | "end";
}) {
  const appeared = useAppeared(appearAt);
  return (
    <g className={`appear ${appeared ? "in" : ""} label`}>
      <text x={x * CELL} y={y * CELL} textAnchor={align}>
        {text}
      </text>
    </g>
  );
}

/** Outline a box to draw the eye to it. */
export function Highlight({ target, appearAt = 0 }: { target: string; appearAt?: number }) {
  const geometry = useContext(Geometry);
  const appeared = useAppeared(appearAt);
  const r = geometry.get(target);
  if (!r) return null;
  return (
    <g className={`appear ${appeared ? "in" : ""} highlight`}>
      <rect x={r.x - 6} y={r.y - 6} width={r.w + 12} height={r.h + 12} rx={14} />
    </g>
  );
}

interface Token {
  content: string;
  color?: string;
}

/**
 * Highlighted SQL inside a diagram. The HTML highlighter cannot be reused
 * here: this has to be SVG text to share the diagram's coordinate space, so
 * the code is tokenised and each token becomes a coloured tspan.
 */
export function Code({
  x,
  y,
  sql,
  appearAt = 0,
  align = "middle",
  size = 26,
}: {
  x: number;
  y: number;
  sql: string;
  appearAt?: number;
  align?: "start" | "middle" | "end";
  size?: number;
}) {
  const appeared = useAppeared(appearAt);
  const [lines, setLines] = useState<Token[][] | null>(null);

  useEffect(() => {
    let live = true;
    highlighter().then((h) => {
      if (live) setLines(h.codeToTokensBase(sql, { lang: "sql", theme: "github-dark" }));
    });
    return () => {
      live = false;
    };
  }, [sql]);

  // Fall back to plain text until the grammar has loaded, so a slide is never
  // briefly blank.
  const rendered: Token[][] = lines ?? sql.split("\n").map((line) => [{ content: line }]);

  return (
    <g className={`appear ${appeared ? "in" : ""} code`}>
      <text
        x={x * CELL}
        y={y * CELL}
        textAnchor={align}
        fontSize={size}
        xmlSpace="preserve"
      >
        {rendered.map((line, i) => (
          <tspan key={i} x={x * CELL} dy={i === 0 ? 0 : size * 1.5}>
            {line.map((token, j) => (
              <tspan key={j} fill={token.color}>
                {token.content}
              </tspan>
            ))}
          </tspan>
        ))}
      </text>
    </g>
  );
}
