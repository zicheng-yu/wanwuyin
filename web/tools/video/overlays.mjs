// Render text overlays / title cards for the video as 1920x1080 PNGs (transparent unless a card).
// node overlays.mjs <specs.json> <outDir>
import { chromium } from "playwright-core";
import fs from "node:fs";

const [specFile, outDir] = process.argv.slice(2);
const specs = JSON.parse(fs.readFileSync(specFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1920px; height: 1080px; background: transparent; font-family: "PingFang SC", sans-serif; -webkit-font-smoothing: antialiased; }
.full { position: absolute; inset: 0; }
.caption { position: absolute; left: 50%; transform: translateX(-50%); bottom: 62px; max-width: 1560px; text-align: center;
  background: rgba(28, 24, 20, .76); color: #fbf7f0; border-radius: 18px; padding: 16px 38px 18px; font-size: 42px; font-weight: 500; letter-spacing: .04em; line-height: 1.45; white-space: nowrap; }
.caption small { display: block; font-size: 27px; font-weight: 400; opacity: .78; letter-spacing: .03em; margin-top: 2px; }
.caption.top { bottom: auto; top: 54px; }
.big { position: absolute; left: 0; right: 0; bottom: 104px; text-align: center; color: #2b2620; }
.big b { display: block; font-size: 104px; font-weight: 600; letter-spacing: .28em; padding-left: .28em; line-height: 1.1; }
.big span { display: block; margin-top: 14px; font-size: 36px; font-weight: 400; color: #5f574c; letter-spacing: .08em; }
.big i { display: block; width: 72px; height: 4px; background: #9b2718; margin: 0 auto 22px; border-radius: 2px; }
.black { position: absolute; inset: 0; background: #0b0a09; display: grid; place-items: center; color: #f3eee6; text-align: center; }
.black p { font-size: 62px; font-weight: 300; letter-spacing: .12em; line-height: 1.6; }
.black p small { display: block; font-size: 30px; opacity: .6; letter-spacing: .1em; margin-top: 18px; }
.card { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 42%, #f6f1e7 0%, #efe9dd 55%, #e6dece 100%); color: #2b2620; text-align: center; }
.stamp { width: 96px; height: 96px; margin: 0 auto 30px; border-radius: 14px; background: #9b2718; color: #fbf3ea; display: grid; place-items: center; font-size: 60px; font-weight: 600; box-shadow: 0 6px 18px rgba(155,39,24,.25); }
.title { font-size: 170px; font-weight: 600; letter-spacing: .32em; padding-left: .32em; line-height: 1.05; }
.sub { font-size: 48px; font-weight: 400; color: #3f392f; letter-spacing: .12em; margin-top: 30px; }
.small { font-size: 29px; color: #776d60; letter-spacing: .08em; margin-top: 20px; line-height: 1.7; }
.braille { display: flex; justify-content: center; gap: 46px; margin-top: 30px; }
.cell { display: grid; grid-template-columns: repeat(2, 18px); grid-template-rows: repeat(3, 18px); gap: 10px 12px; }
.dot { width: 18px; height: 18px; border-radius: 50%; }
.dot.on { background: #9b2718; box-shadow: inset -2px -3px 4px rgba(0,0,0,.25), 0 2px 3px rgba(0,0,0,.15); }
.dot.off { background: rgba(43,38,32,.08); }
.badge { position: absolute; top: 34px; left: 38px; display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,.86); color: #2b2620; border: 1px solid rgba(0,0,0,.08);
  border-radius: 999px; padding: 9px 22px 10px 18px; font-size: 25px; font-weight: 500; letter-spacing: .04em; box-shadow: 0 4px 14px rgba(0,0,0,.08); }
.badge i { width: 14px; height: 14px; border-radius: 50%; background: #d23b20; display: block; }
.badge.render i { background: #2c4a41; }
.speed { position: absolute; top: 34px; right: 38px; background: rgba(28,24,20,.8); color: #fbf7f0; border-radius: 999px; padding: 10px 24px 11px; font-size: 26px; font-weight: 500; letter-spacing: .05em; }
.endgrid { margin-top: 44px; font-size: 30px; color: #4a4338; line-height: 1.85; letter-spacing: .05em; }
.endgrid b { color: #2c4a41; font-weight: 600; }
.foot { position: absolute; left: 0; right: 0; bottom: 46px; font-size: 24px; color: #8a7f71; letter-spacing: .06em; }
`;

function brailleHTML(cells) {
  return `<div class="braille">${[...cells].map((ch) => {
    const bits = ch.codePointAt(0) - 0x2800;
    // dot order: 1 2 3 left column top→bottom, 4 5 6 right column; grid fills row by row
    const order = [0, 3, 1, 4, 2, 5];
    return `<div class="cell">${order.map((b) => `<div class="dot ${(bits >> b) & 1 ? "on" : "off"}"></div>`).join("")}</div>`;
  }).join("")}</div>`;
}

function html(s) {
  switch (s.kind) {
    case "caption": return `<div class="caption${s.top ? " top" : ""}">${s.text}${s.small ? `<small>${s.small}</small>` : ""}</div>`;
    case "big": return `<div class="big"><i></i><b>${s.word}</b><span>${s.detail}</span></div>`;
    case "black": return `<div class="black"><p>${s.text}${s.small ? `<small>${s.small}</small>` : ""}</p></div>`;
    case "badge": return `<div class="badge${s.render ? " render" : ""}"><i></i>${s.text}</div>`;
    case "speed": return `<div class="speed">${s.text}</div>`;
    case "title": return `<div class="card" style="display:grid;place-items:center"><div>
      <div class="stamp">印</div><div class="title">万物印</div>${brailleHTML(s.cells)}
      <div class="sub">${s.sub}</div><div class="small">${s.small}</div></div></div>`;
    case "end": return `<div class="card" style="display:grid;place-items:center"><div>
      <div class="title" style="font-size:132px">万物印</div>${brailleHTML(s.cells)}
      <div class="sub">${s.sub}</div><div class="endgrid">${s.lines.join("<br>")}</div></div>
      <div class="foot">${s.foot}</div></div>`;
  }
  throw new Error(s.kind);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const s of specs) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html(s)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const opaque = ["black", "title", "end"].includes(s.kind);
  await page.screenshot({ path: `${outDir}/${s.name}.png`, omitBackground: !opaque });
}
await browser.close();
console.log("wrote", specs.length, "overlays to", outDir);
