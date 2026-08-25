import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDirectory = path.join(root, "src/static/icons");
const source = await readFile(path.join(iconsDirectory, "icon.svg"));

await mkdir(iconsDirectory, { recursive: true });
await Promise.all([16, 32, 48, 128].map((size) =>
  sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(iconsDirectory, `icon${size}.png`)),
));
