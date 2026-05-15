#!/usr/bin/env node
/**
 * Backfill ServiceLabel zapisa: svaki Manufacturer mora imati 3 ServiceLabel-a
 * (PERIODIC, APPARATUS_MASS, CYLINDER_MASS). Idempotentno.
 *
 * Pokretanje:
 *   node scripts/backfill-service-labels.mjs              # dry-run
 *   node scripts/backfill-service-labels.mjs --confirm    # stvarno zapise kreira
 *
 * Na Railway-u: `railway run node scripts/backfill-service-labels.mjs --confirm`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KINDS = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"];

async function main() {
  const confirm = process.argv.includes("--confirm");
  console.log(`[backfill-service-labels] start (confirm=${confirm})`);

  const manufacturers = await prisma.manufacturer.findMany({
    select: {
      id: true,
      name: true,
      serviceLabels: { select: { kind: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  console.log(`Pronađeno ${manufacturers.length} proizvođača.`);

  const toCreate = [];
  for (const m of manufacturers) {
    const have = new Set(m.serviceLabels.map((l) => l.kind));
    const missing = KINDS.filter((k) => !have.has(k));
    if (missing.length > 0) {
      console.log(`  ${m.name}: nedostaje ${missing.join(", ")}`);
      for (const k of missing) {
        toCreate.push({ manufacturerId: m.id, kind: k });
      }
    }
  }

  if (toCreate.length === 0) {
    console.log("Svi proizvođači imaju kompletan ServiceLabel set. Ništa za napraviti.");
    return;
  }

  console.log(`Ukupno za kreirati: ${toCreate.length} ServiceLabel zapisa.`);

  if (!confirm) {
    console.log("DRY RUN — dodaj --confirm da bi stvarno upisao.");
    return;
  }

  const result = await prisma.serviceLabel.createMany({
    data: toCreate,
    skipDuplicates: true,
  });
  console.log(`Kreirano ${result.count} ServiceLabel zapisa.`);
}

main()
  .catch((e) => {
    console.error("[backfill-service-labels] FAIL", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
