import { useEffect, useRef } from "react";
import type { LabIntegration } from "../../deck/talks.js";
import { lab, useLab } from "./client.js";
import { Runnable, Sessions } from "./Runnable.js";
import { Plan } from "./Plan.js";
import { PageMap } from "./PageMap.js";
import { Repl } from "./Repl.js";

function Navigation({ path, fixture }: { path: string; fixture?: string }) {
  const current = useRef<string | null>(null);
  useEffect(() => {
    // Restore data only when the fixture changes; reset connections every slide (E4).
    if (fixture && fixture !== current.current) {
      current.current = fixture;
      lab.restore(fixture);
    } else lab.resetSessions();
  }, [path, fixture]);
  useEffect(() => () => {
    // Leaving the talk closes its connections so transactions cannot outlive it (E4).
    current.current = null;
    lab.disconnect();
  }, []);
  return null;
}

function Status({ fixture }: { fixture?: string }) {
  const { connected, fatal } = useLab();
  return <>
    <span className={connected ? "dot ok" : "dot bad"} />
    {fixture ? <span className="fixture">{fixture}</span> : null}
    {fatal ? <span className="fatal">{fatal}</span> : null}
  </>;
}

export const postgres: LabIntegration = {
  components: { Runnable, Sessions, Plan, PageMap },
  Navigation,
  Status,
  Overlay: Repl,
  closeOverlayKeys: ["`"],
  shortcuts: [
    {
      title: "PostgreSQL",
      keys: [
        ["Enter", "Run the first unrun visible block, then the last"],
        ["1–9", "Run a visible block by position"],
        ["r", "Restore the slide’s fixture"],
        ["`", "Open the SQL REPL"],
        ["e", "Edit the focused SQL block (currently disabled)"],
      ],
    },
    {
      title: "SQL REPL",
      keys: [
        ["Enter", "Run if the input ends in ;, otherwise add a line"],
        ["Cmd / Ctrl + Enter", "Run regardless of the final character"],
        ["Shift + Enter", "Add a line"],
        ["↑ / ↓", "Recall history at the first / last input line"],
        ["Ctrl + C", "Cancel the statement when no text is selected"],
        ["Esc", "Close the REPL"],
        ["`", "Close when outside the SQL input"],
      ],
    },
  ],
  onKey(key, { fixture, focused, blocks, openOverlay }) {
    if (key === "Enter") focused?.run();
    else if (key === "e") focused?.toggleEdit();
    else if (key === "`") openOverlay();
    else if (key === "r") { if (fixture) lab.restore(fixture, true); }
    else if (/^[1-9]$/.test(key)) blocks[Number(key) - 1]?.run();
    else return false;
    return true;
  },
};
