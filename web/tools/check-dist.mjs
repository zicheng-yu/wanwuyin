// Fails the production build if dist still contains 万物有声 payloads or oversized seal GLBs.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const limit = 2 * 1024 * 1024;
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else files.push(file);
  }
}
walk(dist);
const rels = files.map((file) => relative(dist, file).split("\\").join("/"));
const fail = [];
for (const rel of rels) {
  if (rel.endsWith("modes.bin") || rel === "materials.json" || rel === "objects/manifest.json" || rel.endsWith("listen.html")) {
    fail.push(`listen-mode file in dist: ${rel}`);
  }
  if (rel.startsWith("objects/cup/") || rel.startsWith("objects/bar/") || rel.startsWith("objects/bowl/") || rel.endsWith("/meta.json")) {
    fail.push(`listen-only object in dist: ${rel}`);
  }
  if (rel.endsWith(".glb") && statSync(join(dist, rel)).size > limit) {
    fail.push(`${rel} is larger than 2 MB`);
  }
}
const index = readFileSync(join(dist, "index.html"), "utf8");
if (!index.includes("seal.html?view=set") || !index.includes("materials=1") || !index.includes("maker.html")) {
  fail.push("dist/index.html is not the 万物印 landing page");
}
if (!rels.includes("objects/yongzhong/seal.glb")) fail.push("missing slim yongzhong seal.glb");
if (rels.includes("objects/yongzhong/model.glb")) fail.push("full-size yongzhong model.glb was shipped");
const sealHtml = readFileSync(join(dist, "seal.html"), "utf8");
if (!sealHtml.includes("/wanwuyin/")) fail.push("seal.html is missing the /wanwuyin/ base");
const seals = JSON.parse(readFileSync(join(dist, "seals.json"), "utf8"));
for (const seal of seals) if (!rels.includes(seal.glb)) fail.push(`missing ${seal.glb}`);
if (fail.length) {
  console.error(fail.join("\n"));
  process.exit(1);
}
const glbs = rels.filter((rel) => rel.endsWith(".glb"));
const bytes = glbs.reduce((sum, rel) => sum + statSync(join(dist, rel)).size, 0);
console.log(`dist ok: ${glbs.length} glbs, ${(bytes / 1024 / 1024).toFixed(2)} MB, no modes.bin`);
