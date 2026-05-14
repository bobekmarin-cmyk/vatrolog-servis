import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "assets");
const base = process.env.ICON_PREVIEW_URL ?? "http://localhost:3000";

async function grab(path, filename) {
  const url = `${base}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("image/png")) {
    throw new Error(`${url} -> content-type: ${ct} (očekivam image/png; provjeri middleware /icon.png)`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(outDir, { recursive: true });
  const fp = join(outDir, filename);
  writeFileSync(fp, buf);
  console.log("wrote", fp, buf.length, "bytes");
}

try {
  await grab("/icon.png", "favicon-preview-32.png");
  await grab("/apple-icon.png", "apple-touch-preview-180.png");
} catch (e) {
  console.error(e.message);
  console.error("\nPokreni dev server: npm run dev\nZatim: node scripts/fetch-icon-previews.mjs");
  process.exit(1);
}
