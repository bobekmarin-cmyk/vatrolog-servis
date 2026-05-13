/**
 * Generira PNG screenshotove svih landing mockupa.
 *
 * Predupvjet: dev server radi na http://localhost:3000 (npm run dev).
 * Pokretanje:  node scripts/generate-mockup-pngs.mjs
 *
 * Output: public/landing/mockups/<slug>.png
 *
 * Da se mockup promijeni: uredi pripadni JSX u src/app/_landing/Hero.tsx
 * ili src/app/_landing/Screenshots.tsx i ponovo pokreni ovu skriptu.
 */

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public/landing/mockups");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.MOCKUP_CAPTURE_URL ?? "http://localhost:3000";

const targets = [
  { slug: "hero", width: 1100 },
  { slug: "work-order", width: 1100 },
  { slug: "service", width: 1100 },
  { slug: "delivery", width: 820 },
  { slug: "register", width: 820 },
];

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server na ${url} nije odgovorio u ${timeoutMs / 1000}s`);
}

async function main() {
  console.log(`> Provjeravam dev server na ${baseUrl} ...`);
  await waitForServer(baseUrl);

  console.log(`> Pokrecem Chromium ...`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1600, height: 1200 },
  });
  const page = await ctx.newPage();

  for (const t of targets) {
    const url = `${baseUrl}/capture/${t.slug}?w=${t.width}`;
    console.log(`> ${t.slug}: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });
    // dodatna pauza da se reactCompiler / fonts smire
    await page.waitForTimeout(400);

    const el = await page.$("[data-capture-target]");
    if (!el) {
      console.error(`  (greska) nije pronaden [data-capture-target] za ${t.slug}`);
      continue;
    }
    const file = resolve(outDir, `${t.slug}.png`);
    await el.screenshot({ path: file, omitBackground: false });
    console.log(`  -> ${file}`);
  }

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
