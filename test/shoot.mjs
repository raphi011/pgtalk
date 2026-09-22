// Screenshot deck positions against a running `just dev`, so slide layout and
// the step machinery can be checked without a human at the keyboard.
//   node test/shoot.mjs s1/1/0 s1/2/2:Enter,Enter ...
// A position may carry keys to press after it loads, so the keyboard path is
// exercised rather than the URL alone.
import { launch } from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync } from "node:fs";

const cacheDir = join(homedir(), ".cache/puppeteer/chrome");
const build = readdirSync(cacheDir).sort().at(-1);
const executablePath = join(
  cacheDir,
  build,
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
);

const positions = process.argv.slice(2);
await mkdir("test/shots", { recursive: true });

const browser = await launch({ executablePath, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

for (const spec of positions) {
  const [pos, keys] = spec.split(":");
  await page.goto(`http://127.0.0.1:5173/#/${pos}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
  for (const key of keys ? keys.split(",") : []) {
    await page.keyboard.press(key);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
  }
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  const name = spec.replaceAll(/[/:,]/g, "-");
  await page.screenshot({ path: `test/shots/${name}.png` });
  console.log(`shot ${name}`);
}

await browser.close();
if (errors.length) {
  console.error("\npage errors:\n" + errors.join("\n"));
  process.exit(1);
}
