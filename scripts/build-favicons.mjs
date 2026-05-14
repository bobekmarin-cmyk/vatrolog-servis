import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "public", "branding", "favicon-source.png");

async function run() {
  if (!existsSync(src)) {
    console.error("Missing favicon source:", src);
    process.exit(1);
  }

  await sharp(src).resize(48, 48).png({ compressionLevel: 9 }).toFile(join(root, "src", "app", "icon.png"));
  await sharp(src).resize(180, 180).png({ compressionLevel: 9 }).toFile(join(root, "src", "app", "apple-icon.png"));
  await sharp(src).resize(512, 512).png({ compressionLevel: 9 }).toFile(join(root, "public", "icon-512.png"));

  console.log("icons:build → src/app/icon.png (48×48), src/app/apple-icon.png (180×180), public/icon-512.png (512×512)");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
