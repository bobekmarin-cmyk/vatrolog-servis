#!/usr/bin/env node
/**
 * Staticki audit tenant-IDOR rizika za sve tenant API rute.
 *
 * Pravilo: svaka ne-platform i ne-cron i ne-webhook ruta s dinamickim
 * segmentom u putanji (npr. [id], [partId]) mora:
 *  (a) imati barem jedan poziv `getSession()` / `requireSession()` /
 *      `requireActiveSession()` / `requireAdminSession()`, i
 *  (b) u istom fajlu spomenuti `companyId` (bilo kao filter ili eksplicitnu
 *      provjeru `entity.companyId !== session.companyId`).
 *
 * Skripta cita izvorne fajlove kao tekst (bez parsiranja); cilj nije savrsen
 * SAST, vec zaustaviti najocitije previde u code review-u / CI-u.
 *
 * Pokretanje:
 *   node scripts/audit-tenant-isolation.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readdir } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const apiRoot = join(repoRoot, "src", "app", "api");

/** @param {string} dir */
async function walkRoutes(dir) {
  /** @type {string[]} */
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...(await walkRoutes(p)));
    } else if (e.isFile() && e.name === "route.ts") {
      results.push(p);
    }
  }
  return results;
}

function pathUsesDynamicSegment(filePath) {
  return filePath.includes(`${sep}[`);
}

function relativePath(p) {
  return relative(repoRoot, p).split(sep).join("/");
}

function isExemptRoute(rel) {
  if (rel.includes("/api/platform/")) return true;
  if (rel.includes("/api/webhooks/")) return true;
  if (rel.includes("/api/cron/")) return true;
  if (rel.includes("/api/public/")) return true;
  if (rel.includes("/api/auth/")) return true;
  return false;
}

const SESSION_HELPERS = [
  "requireActiveSession",
  "requireAdminSession",
  "requireSession",
  "getSession",
];

async function main() {
  const files = await walkRoutes(apiRoot);
  const dynamicTenantRoutes = files
    .filter(pathUsesDynamicSegment)
    .filter((p) => !isExemptRoute(relativePath(p)));

  /** @type {{file: string; reason: string}[]} */
  const offenders = [];

  for (const file of dynamicTenantRoutes) {
    const src = await readFile(file, "utf8");
    const usesSession = SESSION_HELPERS.some((h) => src.includes(h));
    const mentionsCompanyId = /\bcompanyId\b/.test(src);

    if (!usesSession) {
      offenders.push({
        file: relativePath(file),
        reason: "ne poziva niti jedan session helper (getSession/requireActiveSession/...)",
      });
      continue;
    }
    if (!mentionsCompanyId) {
      offenders.push({
        file: relativePath(file),
        reason: "ne spominje companyId — provjeri tenant filter",
      });
    }
  }

  const total = dynamicTenantRoutes.length;
  if (offenders.length === 0) {
    console.log(`Tenant isolation audit OK (${total} dinamickih ruta provjereno).`);
    return;
  }

  console.error(
    `Tenant isolation audit FAILED — sumnjivih: ${offenders.length} / ${total}`,
  );
  for (const o of offenders) {
    console.error(`  - ${o.file}: ${o.reason}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
