/**
 * Preflight provjera produkcijskog .env-a.
 *
 * Forsira NODE_ENV=production pa pozove `validateLaunchEnv()` iz
 * `src/lib/envChecks.ts`. Ne pokrece Next ni Prisma — samo cita `process.env`.
 *
 * Primjer (lokalno, s .env.production fajlom):
 *   npx ts-node -P tsconfig.seed.json --require dotenv/config scripts/verify-prod-env.ts
 *     DOTENV_CONFIG_PATH=.env.production
 *
 * U CI/Railway-u, kad su secret-i vec u procesnom okruzenju:
 *   npm run verify:prod-env
 */
(process.env as Record<string, string>).NODE_ENV = "production";

import { validateLaunchEnv } from "../src/lib/envChecks";

const issues = validateLaunchEnv();

const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
const infos = issues.filter((i) => i.severity === "info");

const fmt = (i: { severity: string; key: string; message: string }): string =>
  `  - [${i.severity.toUpperCase()}] ${i.key}: ${i.message}`;

if (errors.length > 0) {
  console.error("Production env CHECK FAILED:");
  console.error(errors.map(fmt).join("\n"));
}
if (warns.length > 0) {
  console.warn("Warnings:");
  console.warn(warns.map(fmt).join("\n"));
}
if (infos.length > 0) {
  console.info("Info:");
  console.info(infos.map(fmt).join("\n"));
}

if (errors.length > 0) {
  process.exit(1);
} else {
  console.log("Production env OK (no blocking issues).");
}
