/**
 * Idempotentni seed PUCZ proizvođača + 3 servisne naljepnice po proizvođaču.
 *
 * Sigurno za produkciju: ništa ne briše, koristi `upsert` po unique key-evima
 * (`Manufacturer.name`, `ServiceLabel(manufacturerId, kind)`). Postavlja i
 * ažurira `sortOrder` prema PUCZ redoslijedu iz `manufacturers-data.js`.
 *
 * Pokretanje:
 *   PowerShell:  $env:DATABASE_URL = "<Railway DATABASE_PUBLIC_URL>"; npm run seed:mfr
 *   bash/zsh:    DATABASE_URL="<Railway DATABASE_PUBLIC_URL>" npm run seed:mfr
 */
const { PrismaClient } = require("@prisma/client");
const { MANUFACTURERS, LABEL_KINDS } = require("./manufacturers-data");

const prisma = new PrismaClient();

async function main() {
  let inserted = 0;
  let updated = 0;
  let labelsInserted = 0;

  for (const { name, sortOrder } of MANUFACTURERS) {
    const before = await prisma.manufacturer.findUnique({
      where: { name },
      select: { id: true, sortOrder: true },
    });
    const m = await prisma.manufacturer.upsert({
      where: { name },
      create: { name, sortOrder },
      update: { sortOrder },
      select: { id: true },
    });
    if (before) {
      if (before.sortOrder !== sortOrder) updated += 1;
    } else {
      inserted += 1;
    }

    for (const kind of LABEL_KINDS) {
      const r = await prisma.serviceLabel.upsert({
        where: { manufacturerId_kind: { manufacturerId: m.id, kind } },
        create: { manufacturerId: m.id, kind },
        update: {},
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (r.createdAt.getTime() === r.updatedAt.getTime()) labelsInserted += 1;
    }
  }

  const total = await prisma.manufacturer.count();
  console.log(
    `Manufacturer upsert: ${inserted} novih, ${updated} ažuriranih sortOrder-a, ukupno u bazi: ${total}.`,
  );
  console.log(`ServiceLabel: ${labelsInserted} novih (3 po proizvođaču ako ih nije bilo).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
