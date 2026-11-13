import { readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";

// Dev keeps every page, including 万物有声, at the site root.
// Production is the GitHub Pages project site: https://zicheng-yu.github.io/wanwuyin/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/wanwuyin/" : "/",
  define: { __WANWUYIN_STATIC__: JSON.stringify(mode === "production") },
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  plugins: [pruneListenAssets()],
  build: {
    rolldownOptions: { input: { index: "home.html", seal: "seal.html", maker: "maker.html" } },
    chunkSizeWarningLimit: 900,
  },
}));

/** GLBs the seal and maker pages actually request. Listen-only files are not in this set. */
function referencedGlbs(root: string): Set<string> {
  const keep = new Set<string>();
  const seals = JSON.parse(readFileSync(join(root, "public/seals.json"), "utf8")) as { glb?: string }[];
  for (const seal of seals) if (seal.glb) keep.add(seal.glb);
  const src = join(root, "src");
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".ts")) continue;
    const text = readFileSync(join(src, name), "utf8");
    for (const match of text.matchAll(/objects\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.glb/g)) keep.add(match[0]);
    if (name === "seal-materials.ts") {
      for (const match of text.matchAll(/name:\s*"([A-Za-z0-9_-]+)"/g)) keep.add(`objects/${match[1]}/model.glb`);
    }
  }
  return keep;
}

// Vite copies all of public/ into dist. Drop 万物有声 modes.bin and other listen-only
// objects after that copy so local dev can still serve them. See docs/静态演示.md.
function pruneListenAssets(): Plugin {
  let outDir = "";
  let root = "";
  return {
    name: "wanwuyin-static",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    closeBundle() {
      const keep = referencedGlbs(root);
      const objects = join(outDir, "objects");
      let removed = 0;
      let bytes = 0;
      const drop = (file: string) => {
        bytes += statSync(file).size;
        rmSync(file);
        removed++;
      };
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const file = join(dir, name);
          if (statSync(file).isDirectory()) walk(file);
          else if (!keep.has(relative(outDir, file).split("\\").join("/"))) drop(file);
        }
      };
      if (statSync(objects, { throwIfNoEntry: false })?.isDirectory()) walk(objects);
      for (const name of ["materials.json", "generated.json"]) {
        const file = join(outDir, name);
        if (statSync(file, { throwIfNoEntry: false })?.isFile()) drop(file);
      }
      const pruneEmpty = (dir: string) => {
        if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
        for (const name of readdirSync(dir)) pruneEmpty(join(dir, name));
        if (dir !== objects && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
      };
      pruneEmpty(objects);
      const home = join(outDir, "home.html");
      if (statSync(home, { throwIfNoEntry: false })?.isFile()) renameSync(home, join(outDir, "index.html"));
      this.info(`excluded ${removed} listen-mode files (${(bytes / 1024 / 1024).toFixed(1)} MB) from the static demo`);
    },
  };
}
