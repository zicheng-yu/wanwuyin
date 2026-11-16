import { chromium } from "playwright-core";
import fs from "node:fs";
const [imgPath, out16, out34, heroPath] = process.argv.slice(2);
const hero = "data:image/jpeg;base64," + fs.readFileSync(heroPath).toString("base64");
const img = "data:image/jpeg;base64," + fs.readFileSync(imgPath).toString("base64");
const dots = (cells) => [...cells].map((ch) => { const b = ch.codePointAt(0) - 0x2800; return `<div class="cell">${[0,3,1,4,2,5].map((k) => `<i class="${(b >> k) & 1 ? "on" : ""}"></i>`).join("")}</div>`; }).join("");
const css = `*{margin:0;padding:0;box-sizing:border-box} body{font-family:"PingFang SC";background:#efe9dd;color:#2b2620;overflow:hidden}
.cell{display:grid;grid-template-columns:repeat(2,16px);grid-template-rows:repeat(3,16px);gap:8px 10px} .cell i{width:16px;height:16px;border-radius:50%;background:rgba(43,38,32,.08)} .cell i.on{background:#9b2718}
.br{display:flex;gap:36px;margin:26px 0 30px}
.t{font-weight:600;letter-spacing:.2em} .s{color:#3f392f;letter-spacing:.08em} .m{color:#776d60;letter-spacing:.06em;line-height:1.7}
.tag{display:inline-block;background:#2c4a41;color:#f4efe6;border-radius:999px;padding:8px 22px;letter-spacing:.06em}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(`<style>${css}
.wrap{position:relative;width:1920px;height:1080px} .pic{position:absolute;right:-40px;top:40px;width:1300px;height:auto} .txt{position:absolute;left:110px;top:250px;width:640px}
.t{font-size:150px} .s{font-size:46px;line-height:1.5} .m{font-size:28px;margin-top:26px} .tag{font-size:26px;margin-bottom:34px}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,#efe9dd 0%,#efe9dd 38%,rgba(239,233,221,0) 52%)}</style>
<div class="wrap"><img class="pic" src="${img}"><div class="fade"></div><div class="txt"><div class="tag">给盲童的 3D 印章</div><div class="t">万物印</div><div class="br">${dots("⠻⠥⠣")}</div>
<div class="s">把摸不到的世界，<br>做成摸得到的印章</div><div class="m">印钮由 Aholo Lux3D 生成　·　盼盼法式小面包</div></div></div>`);
await page.waitForTimeout(500);
await page.screenshot({ path: out16 });
await page.setViewportSize({ width: 1242, height: 1656 });
await page.setContent(`<style>${css}
.wrap{position:relative;width:1242px;height:1656px;text-align:center} .txt{padding-top:120px} .t{font-size:150px;padding-left:.2em} .br{justify-content:center}
.s{font-size:50px;line-height:1.5} .m{font-size:30px;margin-top:22px} .tag{font-size:30px;margin-bottom:34px}
.hero{position:absolute;left:41px;bottom:150px;width:1160px;border-radius:28px;box-shadow:0 18px 50px rgba(60,40,20,.18)} .cap{position:absolute;left:0;right:0;bottom:70px;font-size:30px;color:#776d60;letter-spacing:.08em}</style>
<div class="wrap"><div class="txt"><div class="tag">给盲童的 3D 印章</div><div class="t">万物印</div><div class="br">${dots("⠻⠥⠣")}</div>
<div class="s">把摸不到的世界，做成摸得到的印章</div><div class="m">先摸形状 · 翻面读盲文 · 拓出一页书</div></div><img class="hero" src="${hero}"><div class="cap">说一句"我想摸摸长颈鹿"，Aholo Lux3D 现场铸成一枚印</div></div>`);
await page.waitForTimeout(500);
await page.screenshot({ path: out34 });
await browser.close();
console.log("covers written");
