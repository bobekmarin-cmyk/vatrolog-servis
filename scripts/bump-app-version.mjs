/**
 * Povećava PATCH u src/lib/appVersion.ts (1.0.3 -> 1.0.4).
 * Pokreni prije git pusha na produkciju: npm run version:bump
 * MINOR/MAJOR mijenjaj ručno u appVersion.ts kad zatreba.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "..", "src", "lib", "appVersion.ts");
let s = fs.readFileSync(file, "utf8");
const m = s.match(/export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/);
if (!m) {
  console.error("APP_VERSION nije pronađen u appVersion.ts");
  process.exit(1);
}
const major = Number(m[1]);
const minor = Number(m[2]);
const patch = Number(m[3]) + 1;
const next = `${major}.${minor}.${patch}`;
s = s.replace(
  /export const APP_VERSION = "\d+\.\d+\.\d+"/,
  `export const APP_VERSION = "${next}"`,
);
fs.writeFileSync(file, s);
console.log(`APP_VERSION -> ${next}`);
