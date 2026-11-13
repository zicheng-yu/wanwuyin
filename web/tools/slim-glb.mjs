// Slim one seal GLB for the web demo.
//
//   npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024
//
// Full-size originals for the eight seals are in Release snapshot-2026-11-11.
// Elephant material variants and yongzhong_mv were added later; their full-size
// blobs are in git history before the slim commit. Do not run this on a file
// that is already slim — it will compress the textures a second time.
//
// Yongzhong is special. web/public/objects/yongzhong/model.glb stays full size
// because 万物有声 lines modes.bin up with those vertices. The seal page uses
// objects/yongzhong/seal.glb, produced from that same full-size model:
//
//   node tools/slim-glb.mjs public/objects/yongzhong/model.glb public/objects/yongzhong/seal.glb
//
// From web/:
//   node tools/slim-glb.mjs <in.glb> <out.glb>
import { spawnSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error("usage: node tools/slim-glb.mjs <in.glb> <out.glb>");
  process.exit(1);
}
const input = resolve(inputArg);
const output = resolve(outputArg);
const before = statSync(input).size;
const dir = mkdtempSync(join(tmpdir(), "slim-glb-"));
const temp = join(dir, "out.glb");
const result = spawnSync("npx", [
  "--yes", "@gltf-transform/cli@4", "optimize", input, temp,
  "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024",
], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
renameSync(temp, output);
rmSync(dir, { recursive: true, force: true });
const after = statSync(output).size;
console.log(`${before} -> ${after}  (${(after / before * 100).toFixed(1)}%)  ${output}`);
