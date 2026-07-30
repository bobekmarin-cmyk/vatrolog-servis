#!/usr/bin/env node
/**
 * Sprjecava da `"use client"` component (tranzitivno) importa serverski modul.
 *
 * Zasto: ako klijentski graf uvuce `@/lib/prisma`, Prisma zavrsi u browser
 * bundleu i stranica pukne u pregledniku ("PrismaClient is unable to run in
 * this browser environment"). Takva greska ne pada ni na lintu ni na
 * typechecku ni na `next build` — vidi se tek kad korisnik otvori stranicu.
 *
 * Pokretanje: npm run check:client-imports
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** Moduli koji smiju postojati samo na serveru. */
const SERVER_ONLY = ["lib/prisma.ts"];

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p);
  }
})(SRC);

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;

  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

const importCache = new Map();

/** Runtime importi datoteke — `import type` se brise pri kompilaciji pa ga preskacemo. */
function runtimeImports(file) {
  if (importCache.has(file)) return importCache.get(file);

  const source = fs.readFileSync(file, "utf8");
  const found = [];
  const re = /import\s+(type\s+)?([^'"]*?)from\s*['"]([^'"]+)['"]/g;

  let m;
  while ((m = re.exec(source))) {
    if (m[1]) continue; // import type { ... } from "..."

    const clause = m[2] ?? "";
    const named = clause.match(/\{([^}]*)\}/);
    if (named && !clause.replace(named[0], "").trim()) {
      const specifiers = named[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      // { type A, type B } je takoder samo tip
      if (specifiers.length > 0 && specifiers.every((s) => s.startsWith("type "))) continue;
    }

    const resolved = resolveImport(m[3], file);
    if (resolved) found.push(resolved);
  }

  importCache.set(file, found);
  return found;
}

const serverOnlyPaths = new Set(SERVER_ONLY.map((rel) => path.join(SRC, rel)));

function pathToServerModule(start) {
  const seen = new Set();
  const queue = [[start, [start]]];

  while (queue.length > 0) {
    const [current, trail] = queue.shift();
    if (serverOnlyPaths.has(current)) return trail;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of runtimeImports(current)) queue.push([next, [...trail, next]]);
  }
  return null;
}

const clientFiles = files.filter((f) =>
  /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8").slice(0, 200)),
);

const violations = [];
for (const file of clientFiles) {
  const trail = pathToServerModule(file);
  if (trail) violations.push(trail);
}

if (violations.length === 0) {
  console.log(
    `OK — provjereno ${clientFiles.length} "use client" datoteka, nijedna ne uvlaci serverski modul.`,
  );
  process.exit(0);
}

console.error(
  `\nGRESKA: ${violations.length} "use client" datoteka uvlaci serverski modul u browser bundle.\n`,
);
for (const trail of violations) {
  console.error("  " + trail.map((p) => path.relative(ROOT, p)).join("\n    -> "));
  console.error("");
}
console.error(
  "Rjesenje: premjesti ciste helpere/tipove u zaseban modul bez Prisme\n" +
    "(npr. lib/partsDisplay.ts) pa ga importaj iz klijentske komponente.\n",
);
process.exit(1);
