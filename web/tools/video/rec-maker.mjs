// Real-time screen recording of the seal maker (maker.html) driven by Playwright.
// node tools/video/rec-maker.mjs <scenario: cached|text|photo> <outDir> [w=1600] [h=900] [dpr=2]
// text/photo start a real Lux3D generation through the local backend (pipeline/scripts/serve_seals.py).
// Frames come from the CDP screencast (JPEG + timestamp); markers.json records the key moments.
import { chromium } from "playwright-core";
import fs from "node:fs";

const [scenario, outDir, w = "1600", h = "900", dpr = "2"] = process.argv.slice(2);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const BASE = process.env.MAKER_URL ?? "http://127.0.0.1:5199/maker.html";
// Met Museum Open Access (CC0) photo; it is in the snapshot-2026-11-11 Release under pipeline/out/inputs/met_bell/
const PHOTO = process.env.PHOTO ?? new URL("../../../pipeline/out/inputs/met_bell/DP155212.jpg", import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-device-scale-factor=2"],
});
const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, locale: "zh-CN" });
// A visible cursor: headless screencasts have none, and viewers need to see what is clicked.
await context.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6.9 3.9 7.4-3 1.5-3.8-7.5L4 20z" fill="#1d2125" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none",
      transform: "translate(-200px,-200px)", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" });
    document.documentElement.append(c);
    const ring = document.createElement("div");
    Object.assign(ring.style, { position: "fixed", left: "0", top: "0", width: "44px", height: "44px", marginLeft: "-22px", marginTop: "-22px",
      borderRadius: "50%", border: "3px solid rgba(201,76,19,.85)", zIndex: "2147483646", pointerEvents: "none", opacity: "0", transition: "opacity .35s, transform .35s" });
    document.documentElement.append(ring);
    addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`; }, true);
    addEventListener("mousedown", (e) => {
      ring.style.transition = "none"; ring.style.opacity = "1"; ring.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(.4)`;
      requestAnimationFrame(() => { ring.style.transition = "opacity .45s, transform .45s"; ring.style.opacity = "0"; ring.style.transform = `translate(${e.clientX}px,${e.clientY}px) scale(1.25)`; });
    }, true);
  });
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));

const client = await context.newCDPSession(page);
const frames = [], markers = [];
let keepEvery = 0, lastKept = -1;
client.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  client.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  const t = metadata.timestamp;
  if (keepEvery && lastKept >= 0 && t - lastKept < keepEvery) return;
  lastKept = t;
  const file = `f_${String(frames.length).padStart(6, "0")}.jpg`;
  fs.writeFileSync(`${outDir}/${file}`, Buffer.from(data, "base64"));
  frames.push({ file, t });
});
const mark = (name, extra = {}) => { const t = Date.now() / 1000; markers.push({ name, t, ...extra }); console.log(new Date().toISOString(), name, JSON.stringify(extra)); };
const pause = (ms) => page.waitForTimeout(ms);
let mouse = { x: +w * 0.62, y: +h * 0.55 };
async function moveTo(selector, dx = 0, dy = 0) {
  let box = await page.locator(selector).first().boundingBox();
  if (box && (box.y < 8 || box.y + box.height > +h - 8)) {
    // bring it into view the way a person would: a smooth scroll, then aim
    await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), Math.max(0, (await page.evaluate(() => scrollY)) + box.y - +h * 0.35));
    await pause(900);
    box = await page.locator(selector).first().boundingBox();
  }
  if (!box) throw new Error(`no box for ${selector}`);
  const x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
  const steps = Math.max(12, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 18));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}
async function click(selector, dx = 0, dy = 0) {
  await moveTo(selector, dx, dy);
  await pause(220);
  await page.mouse.down(); await pause(70); await page.mouse.up();
}
async function type(text, delay = 170) { for (const ch of text) { await page.keyboard.type(ch); await pause(delay + Math.random() * 60); } }

await page.goto(BASE);
await page.waitForFunction(() => document.documentElement.dataset.makerReady === "true", null, { timeout: 60000 });
await page.evaluate(() => { localStorage.clear(); window.scrollTo({ top: 0, behavior: "instant" }); });
await page.mouse.move(mouse.x, mouse.y);
await pause(2500); // let the elephant settle on the stage
await client.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: +w * +dpr, maxHeight: +h * +dpr, everyNthFrame: 1 });
mark("start");
await pause(1600);
await page.evaluate(() => { const y = document.getElementById("workbench").getBoundingClientRect().top + scrollY - 12; window.scrollTo({ top: y, behavior: "smooth" }); });
await pause(1400);
mark("workbench");

const story = page.locator("details.detail-fields", { hasText: "再写一点它的故事" });
if (scenario === "photo") {
  await click("#photo-tab"); await pause(700);
  mark("photo_pick");
  await moveTo(".photo-drop"); await pause(300);
  await page.setInputFiles("#photo", PHOTO);
  await pause(1300);
  await click("#seal-name"); await type("青铜钟");
} else {
  await click("#prompt");
  mark("typing");
  await type(scenario === "cached" ? "我想摸摸大象" : "我想摸摸长颈鹿", 190);
}
await pause(700);
if (scenario !== "cached") {
  await click("details.detail-fields:has-text('再写一点它的故事') summary"); await pause(500);
  await moveTo("#why"); await page.selectOption("#why", scenario === "photo" ? "隔着展柜" : "太高"); await pause(500);
  await click("#real-size"); await type(scenario === "photo" ? "两千四百多岁" : "高约五米", 150);
  await pause(600);
}
mark("submit");
await click("#submit-seal");
if (scenario !== "cached") {
  await page.waitForSelector("#task-status:not([hidden])", { timeout: 30000 });
  mark("waiting");
  await pause(4000);
  keepEvery = 0.5; // the long wait is sped up in the edit, so half a second per frame is plenty
  const t0 = Date.now();
  let lastTitle = "";
  for (;;) {
    const s = await page.evaluate(() => ({ title: document.getElementById("status-title").textContent, badge: document.getElementById("source-badge").textContent, err: document.getElementById("message").hidden ? "" : document.getElementById("message").textContent }));
    if (s.title !== lastTitle) { mark("status", { title: s.title }); lastTitle = s.title; }
    if (s.err) { mark("error", { err: s.err }); break; }
    if (s.title === "正把它带到你的桌上" || s.title === "你的印，做好了" || s.badge === "刚铸好的印") { keepEvery = 0; break; }
    if (Date.now() - t0 > 14 * 60 * 1000) { mark("timeout"); break; }
    await pause(250);
  }
  keepEvery = 0;
  await page.waitForFunction(() => document.getElementById("source-badge").textContent === "刚铸好的印" && !document.getElementById("flip").disabled, null, { timeout: 5 * 60 * 1000 });
  mark("landed");
} else {
  await page.waitForFunction(() => !document.getElementById("flip").disabled, null, { timeout: 30000 });
  mark("landed");
}
await pause(1800);
mark("flip");
await click("#flip");
await page.waitForFunction(() => !document.getElementById("rub").disabled, null, { timeout: 30000 });
await pause(1600);
mark("rub");
await click("#rub");
await page.waitForFunction(() => document.getElementById("rub").classList.contains("is-current") && !document.getElementById("touch").disabled, null, { timeout: 60000 });
mark("rubbed");
await pause(2200);
if (scenario !== "photo") {
  await moveTo("#collect"); await pause(300);
  if (!(await page.locator("#collect").isDisabled())) { await click("#collect"); }
  await pause(900);
  mark("collection");
  await page.evaluate(() => document.getElementById("collection").scrollIntoView({ behavior: "smooth", block: "center" }));
  await pause(2600);
}
mark("end");
await client.send("Page.stopScreencast");
await pause(300);
const result = await page.evaluate(() => ({ label: document.getElementById("result-label").textContent, story: document.getElementById("result-story").textContent, braille: document.getElementById("result-braille").textContent }));
fs.writeFileSync(`${outDir}/frames.json`, JSON.stringify(frames));
fs.writeFileSync(`${outDir}/markers.json`, JSON.stringify({ markers, result, w: +w, h: +h, dpr: +dpr }, null, 1));
console.log("frames", frames.length, "result", JSON.stringify(result));
await browser.close();
