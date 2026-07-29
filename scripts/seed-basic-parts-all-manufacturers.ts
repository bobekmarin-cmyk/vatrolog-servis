/**
 * Idempotentni seed osnovnih platform dijelova za sve proizvođače osim Pastora.
 *
 * Bez šifre proizvođača i bez cijene — tehnički `code` je intern (obavezan u shemi),
 * a UI prikazuje praznu šifru dok je `manufacturerCode` null.
 * Bez tip-veza (PartExtinguisherType) — picker ih tretira kao univerzalne
 * za sve tipove aparata tog proizvođača.
 *
 * Pokretanje:
 *   DATABASE_URL="..." npx ts-node -P tsconfig.seed.json scripts/seed-basic-parts-all-manufacturers.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASIC_PARTS: Array<{ code: string; name: string }> = [
  { code: "VL-BASIC-BRTVA-VENTILA", name: "Brtva ventila" },
  { code: "VL-BASIC-OSIGURAC-VENTILA", name: "Osigurač ventila" },
  { code: "VL-BASIC-NALJEPNICA-APARATA", name: "Naljepnica aparata" },
  { code: "VL-BASIC-MLAZNICA-APARATA", name: "Mlaznica aparata" },
];

function isPastor(name: string): boolean {
  return name.trim().toLowerCase().includes("pastor");
}

async function main() {
  const manufacturers = await prisma.manufacturer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const targets = manufacturers.filter((m) => !isPastor(m.name));
  const skippedPastor = manufacturers.filter((m) => isPastor(m.name));

  console.log(`Proizvođača ukupno: ${manufacturers.length}`);
  console.log(`Preskočeno (Pastor): ${skippedPastor.map((m) => m.name).join(" | ") || "(nema)"}`);
  console.log(`Cilj: ${targets.length} × ${BASIC_PARTS.length} dijelova`);

  let created = 0;
  let skippedExisting = 0;

  for (const m of targets) {
    for (const part of BASIC_PARTS) {
      const existing = await prisma.part.findFirst({
        where: {
          manufacturerId: m.id,
          companyId: null,
          OR: [
            { code: part.code },
            { name: { equals: part.name, mode: "insensitive" } },
          ],
        },
        select: { id: true, code: true, name: true },
      });

      if (existing) {
        skippedExisting += 1;
        continue;
      }

      await prisma.part.create({
        data: {
          manufacturerId: m.id,
          companyId: null,
          code: part.code,
          manufacturerCode: null,
          name: part.name,
          unit: "KOM",
          defaultPrice: null,
          common: true,
          active: true,
        },
      });
      created += 1;
      console.log(`  + ${m.name}: ${part.name}`);
    }
  }

  console.log(`\nGotovo. Kreirano: ${created}, već postojalo: ${skippedExisting}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
