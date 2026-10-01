import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

let [talk = "postgres", session = "s1"] = process.argv.slice(2);
// Preserve PostgreSQL's original session shorthand (F4e).
if (/^s\d+$/.test(talk)) [talk, session] = ["postgres", talk];
if (![talk, session].every((part) => /^[a-zA-Z0-9_-]+$/.test(part))) throw new Error("Invalid talk or session");
const slides = (await readdir(`talks/${talk}/slides/${session}`)).filter((file) => file.endsWith(".mdx"));
if (!slides.length) throw new Error("No slides in this session");
const result = spawnSync(process.execPath, ["test/shoot.mjs", ...slides.map((_, index) => `${talk}/${session}/${index}/9`)], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
