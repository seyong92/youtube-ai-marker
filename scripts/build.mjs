import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(root, "src/content/index.ts")],
    bundle: true,
    outfile: path.join(dist, "content.js"),
    format: "iife",
    target: "chrome120",
    minify: false,
    sourcemap: false,
  }),
  build({
    entryPoints: [path.join(root, "src/popup/index.ts")],
    bundle: true,
    outfile: path.join(dist, "popup.js"),
    format: "iife",
    target: "chrome120",
    minify: false,
    sourcemap: false,
  }),
]);

for (const item of ["manifest.json", "content.css", "popup.html", "popup.css", "_locales", "icons"]) {
  await cp(path.join(root, "src/static", item), path.join(dist, item), { recursive: true });
}
