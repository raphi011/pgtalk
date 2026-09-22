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

interface Layout {
  boxes: Map<string, Rect>;
  /** Where each arrow's head lands, keyed `from->to`. */
  heads: Map<string, [number, number]>;
}

const Geometry = createContext<Layout>({ boxes: new Map(), heads: new Map() });

const rectOf = (p: BoxProps): Rect => ({
  x: p.x * CELL + GAP / 2,
  y: p.y * CELL + GAP / 2,
  w: (p.w ?? 2) * CELL - GAP,
  h: (p.h ?? 1) * CELL - GAP,
});

type Ends = { from: string; to: string };

/**
 * Collect every <Box> and <Arrow> in the tree before rendering, so <Arrow> can
 * reference a box declared after it, and so arrows sharing a target can be
 * told apart. Walking the children is what keeps the DSL free of authoring
 * order rules.
 */
function collect(children: ReactNode, boxes: Map<string, Rect>, arrows: Ends[]) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { id?: string; children?: ReactNode };
    if (child.type === Box && props.id) boxes.set(props.id, rectOf(child.props as BoxProps));
    if (child.type === Arrow) arrows.push(child.props as Ends);
    if (props.children) collect(props.children, boxes, arrows);
  });
}

/**
 * Arrows landing on the same side of a box get their own points along it, at
 * 1/(n+1), 2/(n+1) ... in the order of their sources, so the heads do not
 * pile into one shape and the lines do not cross. Every arrow in the diagram
 * counts, shown yet or not: one appearing later never moves one already on
 * screen. Tails are left to share a point, since a fan-out reads fine.
 */
function place(boxes: Map<string, Rect>, arrows: Ends[]) {
  const groups = new Map<string, { key: string; box: Rect; side: Side; source: Rect }[]>();
  for (const { from, to } of arrows) {
    const a = boxes.get(from);
    const b = boxes.get(to);
    if (!a || !b) continue;
    const side = facing(b, a);
    const group = groups.get(`${to}:${side}`) ?? [];
    group.push({ key: `${from}->${to}`, box: b, side, source: a });
    groups.set(`${to}:${side}`, group);
  }

  const heads = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    const across = (r: Rect) =>
      group[0].side === "left" || group[0].side === "right" ? r.y + r.h / 2 : r.x + r.w / 2;
    group.sort((p, q) => across(p.source) - across(q.source));
    group.forEach((g, i) => heads.set(g.key, point(g.box, g.side, (i + 1) / (group.length + 1))));
  }
  return heads;
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
  const boxes = new Map<string, Rect>();
  const arrows: Ends[] = [];
  collect(children, boxes, arrows);

  return (
    <Geometry.Provider value={{ boxes, heads: place(boxes, arrows) }}>
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
  hideAt?: number;
}

export function Box(props: BoxProps) {
  const { label, sub, tone = "plain", appearAt = 0, hideAt } = props;
  const r = rectOf(props);
  const appeared = useAppeared(appearAt, hideAt);

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

type Side = "left" | "right" | "top" | "bottom";

/** The side of `a` that faces `b`. */
function facing(a: Rect, b: Rect): Side {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

/** A point `t` of the way along one side of `a`. */
function point(a: Rect, side: Side, t = 0.5): [number, number] {
  switch (side) {
    case "left":
      return [a.x, a.y + a.h * t];
    case "right":
      return [a.x + a.w, a.y + a.h * t];
    case "top":
      return [a.x + a.w * t, a.y];
    case "bottom":
      return [a.x + a.w * t, a.y + a.h];
  }
}

/**
 * An arrow draws itself from `from` to `to` as it appears. `pulse` sends a dot
 * along it from `pulseAt` on — `"back"` runs against the arrow, which is how a
 * row travels up a tree whose arrows are requests travelling down (A3b).
 */
export function Arrow({
  from,
  to,
  label,
  appearAt = 0,
  hideAt,
  pulse,
  pulseAt = appearAt,
}: {
  from: string;
  to: string;
  label?: string;
  appearAt?: number;
  hideAt?: number;
  pulse?: "forward" | "back";
  pulseAt?: number;
}) {
  const { boxes, heads } = useContext(Geometry);
  const appeared = useAppeared(appearAt, hideAt);
  const pulsing = useAppeared(pulseAt, hideAt) && pulse !== undefined;
  const a = boxes.get(from);
  const b = boxes.get(to);
  if (!a || !b) return null;

  const [x1, y1] = point(a, facing(a, b));
  const [x2, y2] = heads.get(`${from}->${to}`) ?? point(b, facing(b, a));

  // Offset the label off the line rather than onto it: a vertical arrow would
  // otherwise strike straight through its own text.
  const vertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
  const lx = (x1 + x2) / 2 + (vertical ? 14 : 0);
  const ly = (y1 + y2) / 2 + (vertical ? 5 : -10);

  return (
    <g className={`appear ${appeared ? "in" : ""} arrow`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} markerEnd="url(#arrowhead)" />
      {pulsing ? (
        <circle className="pulse" r={8}>
          <animateMotion
            dur="1.2s"
            repeatCount="indefinite"
            path={pulse === "back" ? `M${x2},${y2} L${x1},${y1}` : `M${x1},${y1} L${x2},${y2}`}
          />
        </circle>
      ) : null}
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
  hideAt,
  align = "middle",
}: {
  x: number;
  y: number;
  text: string;
  appearAt?: number;
  hideAt?: number;
  align?: "start" | "middle" | "end";
}) {
  const appeared = useAppeared(appearAt, hideAt);
  return (
    <g className={`appear ${appeared ? "in" : ""} label`}>
      <text x={x * CELL} y={y * CELL} textAnchor={align}>
        {text}
      </text>
    </g>
  );
}

/** Outline a box to draw the eye to it. */
export function Highlight({
  target,
  appearAt = 0,
  hideAt,
}: {
  target: string;
  appearAt?: number;
  hideAt?: number;
}) {
  const { boxes } = useContext(Geometry);
  const appeared = useAppeared(appearAt, hideAt);
  const r = boxes.get(target);
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
  hideAt,
  align = "middle",
  size = 26,
}: {
  x: number;
  y: number;
  sql: string;
  appearAt?: number;
  hideAt?: number;
  align?: "start" | "middle" | "end";
  size?: number;
}) {
  const appeared = useAppeared(appearAt, hideAt);
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
