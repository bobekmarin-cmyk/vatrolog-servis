/**
 * Privremeno: svi platform dijelovi PASTOR T.V.A. vrijede za SVE tipove
 * aparata tog proizvođača (da se mogu birati na upisniku).
 * Kasnije se veze mogu suziti po tipu.
 *
 *   DATABASE_URL="..." npm run seed:pastor-parts-all-types
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PASTOR_NAME = "PASTOR T.V.A. d.o.o.";
const BATCH = 1000;

async function main() {
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { name: PASTOR_NAME },
    select: { id: true, name: true },
  });
  if (!manufacturer) throw new Error(`Proizvođač nije pronađen: ${PASTOR_NAME}`);

  const typeIds = (
    await prisma.manufacturerExtinguisherType.findMany({
      where: { manufacturerId: manufacturer.id },
      select: { extinguisherTypeId: true },
    })
  ).map((r) => r.extinguisherTypeId);

  const parts = await prisma.part.findMany({
    where: { manufacturerId: manufacturer.id, companyId: null },
    select: { id: true },
  });

  console.log(
    `${manufacturer.name}: ${parts.length} dijelova × ${typeIds.length} tipova = ${parts.length * typeIds.length} potencijalnih veza`,
  );

  if (typeIds.length === 0) {
    throw new Error("Pastor nema tipova aparata — prvo pokreni seed:pastor-types.");
  }
  if (parts.length === 0) {
    throw new Error("Pastor nema dijelova — prvo pokreni seed:pastor-parts.");
  }

  const rows: Array<{ partId: string; extinguisherTypeId: string }> = [];
  for (const p of parts) {
    for (const tid of typeIds) {
      rows.push({ partId: p.id, extinguisherTypeId: tid });
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const r = await prisma.partExtinguisherType.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += r.count;
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: +${r.count} (do ${Math.min(i + BATCH, rows.length)}/${rows.length})`);
  }

  const total = await prisma.partExtinguisherType.count({
    where: { part: { manufacturerId: manufacturer.id, companyId: null } },
  });
  console.log(`\nNovo umetnuto: ${inserted}. Ukupno veza Pastor dijelova↔tipovi: ${total}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
