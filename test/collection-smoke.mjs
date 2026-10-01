// Exercise collection routing, optional Lab boundaries and modal keys (F4d, F4e, S5).
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { launch } from "puppeteer-core";

const cache = join(homedir(), ".cache/puppeteer/chrome");
const executablePath = join(cache, readdirSync(cache).sort().at(-1),
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const base = process.env.TALK_TEST_URL ?? "http://127.0.0.1:5173";
const noDatabase = process.argv.includes("--no-database");
const browser = await launch({ executablePath, headless: true });
try {
  await mkdir("test/shots", { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const network = await page.createCDPSession();
  await network.send("Network.enable");
  const sockets = [];
  const runs = [];
  network.on("Network.webSocketCreated", (event) => { if (event.url.endsWith("/lab")) sockets.push(event); });
  network.on("Network.webSocketFrameSent", (event) => {
    try { if (JSON.parse(event.response.payloadData).type === "run") runs.push(event); } catch {}
  });
  const visit = (hash) => page.goto(`${base}/#/${hash}`, { waitUntil: "networkidle0" });
  const hash = () => page.evaluate(() => location.hash);
  const key = (value) => page.keyboard.press(value);

  await visit("");
  assert.equal(await page.$$eval(".collection a", (elements) => elements.length), 2);
  await page.screenshot({ path: "test/shots/collection.png" });
  await page.click('a[href="#/example/s1/0/0"]');
  await page.waitForSelector(".slide");
  await key("ArrowRight");
  await page.waitForFunction(() => location.hash === "#/example/s1/0/1");
  await key("n");
  await page.waitForSelector(".notes");
  const beforeNotes = await hash();
  await key("ArrowDown");
  assert.equal(await hash(), beforeNotes);
  await key("Escape");
  await key("?");
  await page.waitForSelector("dialog[open]");
  assert.equal(await page.$eval(".shortcuts", (element) => element.textContent.includes("SQL REPL")), false);
  await key("ArrowRight");
  assert.equal(await hash(), beforeNotes);
  await page.screenshot({ path: "test/shots/example-shortcuts.png" });
  await key("?");
  await key("g");
  await page.waitForSelector(".switcher-input");
  await page.type(".switcher-input", "connection");
  assert.equal(await page.$eval(".switcher-list", (element) => element.textContent.includes("Make the connection")), true);
  assert.equal(await page.$$eval(".switcher-sessions .active", (elements) => elements.length), 1);
  await key("Enter");
  await page.waitForFunction(() => location.hash === "#/example/s1/1/0");
  await key("`");
  assert.equal(await page.$$eval(".repl", (elements) => elements.length), 0);
  assert.equal(sockets.length, 0, "collection and example must never open a Lab socket");
  console.log("ok collection, example, scoped finder, notes and help without a Lab");

  await visit("s1/1/9");
  await page.waitForFunction(() => location.hash === "#/postgres/s1/1/4");
  await page.waitForSelector(".runnable");
  assert.ok(sockets.length > 0);
  if (noDatabase) {
    await page.waitForSelector(".fatal");
    console.log("ok unavailable PostgreSQL surfaces only in its own talk");
  } else {
    await key("?");
    await page.waitForSelector("dialog[open]");
    assert.equal(await page.$eval(".shortcuts", (element) => element.textContent.includes("SQL REPL")), true);
    const beforeHelp = await hash();
    const runCount = runs.length;
    await key("ArrowDown");
    assert.equal(await hash(), beforeHelp);
    await page.screenshot({ path: "test/shots/postgres-shortcuts-live.png" });
    // Enter may activate the modal's close button, but must never run SQL (F4d).
    await key("Enter");
    assert.equal(runs.length, runCount);
    await key("Escape");
    await key("Enter");
    await page.waitForSelector(".result table");
    await key("`");
    await page.waitForSelector(".repl-input");
    await page.type(".repl-input", "SELECT '?' AS question;");
    assert.equal(await page.$$eval("dialog[open]", (elements) => elements.length), 0);
    await page.click('button[aria-label="Show keyboard shortcuts"]');
    await page.waitForSelector("dialog[open]");
    await key("Escape");
    assert.equal(await page.$eval('button[aria-label="Show keyboard shortcuts"]', (element) => element === document.activeElement), true);
    await page.click(".repl-input");
    await key("Enter");
    await page.waitForFunction(() => document.querySelector(".repl")?.textContent.includes("question"));
    await key("Escape");
    console.log("ok legacy links, live SQL, PostgreSQL help, REPL typing and focus restoration");
    await key("g");
    await page.waitForSelector(".switcher-input");
    await key("ArrowRight");
    await page.type(".switcher-input", "12");
    await key("Enter");
    await page.waitForFunction(() => location.hash === "#/postgres/s2/11/0");
    await key("`");
    await page.waitForSelector(".repl-input");
    await page.type(".repl-input", "SELECT pg_sleep(10);");
    await key("Enter");
    await page.waitForSelector(".repl .elapsed");
    await page.click('a[aria-label="Choose a talk"]');
    await page.waitForSelector(".collection");
    await page.click('a[href="#/postgres/s1/0/0"]');
    await page.waitForSelector(".slide");
    await key("`");
    await page.waitForFunction(() => document.querySelector(".repl")?.textContent.includes("session was reset"));
    await key("Escape");
    console.log("ok session switching and interrupted REPL entries survive talk changes");
  }

  await page.click('a[aria-label="Choose a talk"]');
  await page.waitForSelector(".collection");
  const previousSockets = sockets.length;
  await page.click('a[href="#/example/s1/0/0"]');
  await page.waitForSelector(".slide");
  await page.waitForFunction(() => location.hash === "#/example/s1/0/0");
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(sockets.length, previousSockets, "leaving PostgreSQL must stop reconnects");
  assert.equal(await page.$$eval(".fatal", (elements) => elements.length), 0);
  assert.deepEqual(errors, []);
  console.log("ok leaving PostgreSQL clears Lab controls and reconnects");
} finally {
  await browser.close();
}
