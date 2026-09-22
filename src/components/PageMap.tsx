import { useState } from "react";
import { BlockFrame } from "./Runnable.js";
import { ResultPanel } from "./ResultPanel.js";
import { useBlock } from "./useBlock.js";
import type { QueryResult } from "../../server/protocol.js";

/** What `heap_page_items` calls each state of a line pointer. */
const LP_FLAG: Record<string, string> = { "0": "unused", "1": "normal", "2": "redirect", "3": "dead" };

/** The infomask bits the storage session talks about; the rest is noise here. */
const SHOWN_FLAGS = ["HEAP_HOT_UPDATED", "HEAP_ONLY_TUPLE", "HEAP_KEYS_UPDATED"];

interface Slot {
  lp: number;
  flag: string;
  /** For a redirect, the slot it points at: PostgreSQL keeps it in lp_off. */
  redirect?: number;
  tuple?: {
    xmin?: string;
    xmax?: string;
    /** The slot `t_ctid` points at, when it is on this page. */
    next?: number;
    ctid?: string;
    flags: string[];
  };
}

/** Line pointers and tuples, by column name, from any heap_page_items query. */
function slotsOf(r: QueryResult): Slot[] | null {
  const col = (name: string) => r.fields.findIndex((f) => f.name === name);
  const [lp, flags, off, xmin, xmax, ctid, mask] = [
    "lp", "lp_flags", "lp_off", "t_xmin", "t_xmax", "t_ctid", "flags",
  ].map(col);
  if (lp < 0 || flags < 0) return null;

  return r.rows.map((row) => {
    const flag = LP_FLAG[row[flags] ?? ""] ?? String(row[flags]);
    const slot: Slot = { lp: Number(row[lp]), flag };
    if (flag === "redirect" && off >= 0) slot.redirect = Number(row[off]);
    // Only a normal line pointer has tuple bytes behind it; unused, dead and
    // redirect ones are pointers to nothing.
    if (flag === "normal") {
      const c = ctid >= 0 ? row[ctid] : null;
      const m = c?.match(/^\((\d+),(\d+)\)$/);
      slot.tuple = {
        xmin: xmin >= 0 ? (row[xmin] ?? undefined) : undefined,
        xmax: xmax >= 0 ? (row[xmax] ?? undefined) : undefined,
        ctid: c ?? undefined,
        next: m && m[1] === "0" && Number(m[2]) !== slot.lp ? Number(m[2]) : undefined,
        flags: mask >= 0 ? SHOWN_FLAGS.filter((f) => row[mask]?.includes(f)) : [],
      };
    }
    return slot;
  });
}

const WIDTH = 1100;
const GAP = 16;
const LP_Y = 30;
const LP_H = 56;
const TUP_Y = 128;
const LINE = 24;

/** The text lines a tuple card carries, labelled so a comparison can match them. */
function linesOf(t: NonNullable<Slot["tuple"]>): { key: string; text: string; bit?: boolean }[] {
  return [
    t.xmin !== undefined ? { key: "xmin", text: `xmin ${t.xmin}` } : null,
    t.xmax !== undefined ? { key: "xmax", text: `xmax ${t.xmax}` } : null,
    t.ctid !== undefined ? { key: "ctid", text: `ctid ${t.ctid}` } : null,
    ...t.flags.map((f) => ({ key: f, text: f.replace(/^HEAP_/, ""), bit: true })),
  ].filter((l) => l !== null);
}

/** What differs about a slot from the same slot in an earlier run. */
function changesOf(slot: Slot, before?: Slot): Set<string> | "new" {
  if (!before) return "new";
  const changed = new Set<string>();
  if (before.flag !== slot.flag || before.redirect !== slot.redirect) changed.add("flag");
  const was = new Map(before.tuple ? linesOf(before.tuple).map((l) => [l.key, l.text]) : []);
  for (const l of slot.tuple ? linesOf(slot.tuple) : []) if (was.get(l.key) !== l.text) changed.add(l.key);
  return changed;
}

/**
 * One heap page drawn from `heap_page_items`: the line pointer array along the
 * top, the tuple behind each pointer below it, and the forward pointers a
 * reader follows — `t_ctid` from an old version to its successor, and a
 * redirect from one slot to another.
 *
 * This is the one diagram derived from a query result rather than authored
 * (A2a): the point of these slides is what the page looks like after a
 * statement, which a hand-drawn picture could only assert.
 */
function Page({ slots, baseline }: { slots: Slot[]; baseline?: Slot[] }) {
  const n = Math.max(slots.length, 1);
  const w = Math.min(200, (WIDTH - GAP * (n - 1)) / n);
  const x = (i: number) => i * (w + GAP);
  const at = new Map(slots.map((s, i) => [s.lp, i]));
  const was = new Map(baseline?.map((s) => [s.lp, s]));
  const chains = slots.filter((s) => s.tuple?.next !== undefined && at.has(s.tuple.next));
  // Every card is as tall as the fullest one, so the row reads as a row.
  const lines = Math.max(1, ...slots.map((s) => (s.tuple ? linesOf(s.tuple).length : 0)));
  const TUP_H = 18 + lines * LINE;
  const height = TUP_Y + TUP_H + (chains.length ? 60 : 12);

  return (
    <svg className="pagemap" viewBox={`0 0 ${WIDTH} ${height}`}>
      <defs>
        <marker id="pm-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
        </marker>
        {/* A marker takes its colour from where it is defined, not where it is
            used, so the accent redirect arrow needs a head of its own. */}
        <marker id="pm-head-accent" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" style={{ fill: "var(--accent)" }} />
        </marker>
      </defs>
      <text className="pm-caption" x={0} y={18}>line pointers</text>
      <text className="pm-caption" x={0} y={TUP_Y - 14}>tuples</text>

      {slots.map((s, i) => {
        const changes = baseline ? changesOf(s, was.get(s.lp)) : new Set<string>();
        const hot = (key: string) => (changes !== "new" && changes.has(key) ? " pm-changed" : "");
        return (
          <g
            key={s.lp}
            className={`pm-slot pm-${s.flag}${changes === "new" ? " pm-new" : ""}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <rect x={x(i)} y={LP_Y} width={w} height={LP_H} rx={8} />
            <text className="pm-lp" x={x(i) + w / 2} y={LP_Y + 24}>
              lp {s.lp}
              {changes === "new" ? " · new" : ""}
            </text>
            <text className={`pm-flag${hot("flag")}`} x={x(i) + w / 2} y={LP_Y + 44}>
              {s.flag}
              {s.redirect !== undefined ? ` → ${s.redirect}` : ""}
            </text>

            {s.tuple ? (
              <>
                <line className="pm-link" x1={x(i) + w / 2} y1={LP_Y + LP_H} x2={x(i) + w / 2} y2={TUP_Y} />
                <g className={`pm-tuple${s.tuple.xmax && s.tuple.xmax !== "0" ? " pm-ended" : ""}`}>
                  <rect x={x(i)} y={TUP_Y} width={w} height={TUP_H} rx={8} />
                  {linesOf(s.tuple).map((l, j) => (
                    <text
                      key={l.key}
                      className={`${l.bit ? "pm-bit" : `pm-${l.key}`}${hot(l.key)}`}
                      x={x(i) + 12}
                      y={TUP_Y + 26 + j * LINE}
                    >
                      {l.text}
                    </text>
                  ))}
                </g>
              </>
            ) : null}
          </g>
        );
      })}

      {/* Redirects arc over the pointer row, version chains under the tuples:
          the two kinds of forward pointer live in different places. */}
      {slots.map((s, i) => {
        const j = s.redirect !== undefined ? at.get(s.redirect) : undefined;
        if (j === undefined) return null;
        const [x1, x2] = [x(i) + w / 2, x(j) + w / 2];
        return (
          <path
            key={`r${s.lp}`}
            className="pm-arrow pm-redirect-arrow"
            d={`M${x1},${LP_Y} C${x1},${LP_Y - 30} ${x2},${LP_Y - 30} ${x2},${LP_Y}`}
            markerEnd="url(#pm-head-accent)"
          />
        );
      })}
      {chains.map((s) => {
        const [i, j] = [at.get(s.lp)!, at.get(s.tuple!.next!)!];
        const [x1, x2] = [x(i) + w / 2, x(j) + w / 2];
        const y = TUP_Y + TUP_H;
        return (
          <path
            key={`c${s.lp}`}
            className="pm-arrow"
            d={`M${x1},${y} C${x1},${y + 50} ${x2},${y + 50} ${x2},${y + 2}`}
            markerEnd="url(#pm-head)"
          />
        );
      })}
    </svg>
  );
}

/**
 * A runnable `heap_page_items` query whose answer is drawn as the page (A2a).
 * A button flips to the plain table, for a question the drawing does not answer.
 */
export function PageMap({
  session = "s1",
  sql,
  appearAt = 0,
  hideAt,
  name,
  against,
}: {
  session?: string;
  sql: string;
  appearAt?: number;
  hideAt?: number;
  name?: string;
  /** An earlier PageMap to mark new slots and changed fields against (A4a). */
  against?: string;
}) {
  const block = useBlock({ session, sql, appearAt, hideAt, name, against });
  const [table, setTable] = useState(false);
  if (!block.appeared) return null;

  const result = block.output?.results?.find((r) => r.fields.length > 0);
  const slots = result ? slotsOf(result) : null;
  const before = block.baseline?.results?.find((r) => r.fields.length > 0);
  const drawn = slots && !table && !block.output?.error;

  return (
    <BlockFrame
      session={session}
      block={block}
      actions={
        slots ? (
          <button onClick={() => setTable((t) => !t)}>{table ? "page" : "table"}</button>
        ) : null
      }
    >
      {drawn ? (
        <div key={block.output!.at} className="panel arrived">
          <Page slots={slots} baseline={before ? (slotsOf(before) ?? undefined) : undefined} />
        </div>
      ) : (
        <ResultPanel output={block.output} />
      )}
    </BlockFrame>
  );
}
