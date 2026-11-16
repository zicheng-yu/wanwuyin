// Frame-accurate render of a seal.html view (&capture) to JPEG frames.
// node tools/video/render-seal.mjs '<json spec>'  spec: {url, out, fps, w, h, dpr, ranges: [[a, b]], speed, css}
// speed < 1 renders slow motion (more frames per second of animation time).
import { chromium } from "playwright-core";
import fs from "node:fs";

const spec = { fps: 30, w: 1920, h: 1080, dpr: 1.5, speed: 1, css: "", ...JSON.parse(process.argv[2]) };
fs.rmSync(spec.out, { recursive: true, force: true });
fs.mkdirSync(spec.out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: spec.dpr });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(spec.url);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 120000 });
if (spec.css) await page.addStyleTag({ content: spec.css });
const dur = await page.evaluate(() => window.duration);
const ranges = spec.ranges ?? [[0, dur]];
const times = [];
for (const [a, b] of ranges) {
  const n = Math.round(((b - a) / spec.speed) * spec.fps);
  for (let k = 0; k < n; k++) times.push(a + (k * spec.speed) / spec.fps);
}
for (let i = 0; i < times.length; i++) {
  await page.evaluate((t) => window.seek(t), times[i]);
  if (i === 0 || i === times.length - 1) {
    const b = await page.evaluate(() => window.boxes?.());
    console.log(`t=${times[i].toFixed(2)}`, JSON.stringify(b));
  }
  await page.screenshot({ path: `${spec.out}/f_${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
}
await browser.close();
fs.writeFileSync(`${spec.out}/spec.json`, JSON.stringify({ ...spec, frames: times.length }));
console.log("wrote", spec.out, times.length, "frames");
