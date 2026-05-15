/**
 * Idempotentni seed proizvođača + 3 servisne naljepnice po proizvođaču.
 *
 * Sigurno za produkciju: ništa ne briše, koristi `upsert` po unique key-evima
 * (`Manufacturer.name`, `ServiceLabel(manufacturerId, kind)`).
 *
 * Pokretanje:
 *   PowerShell:  $env:DATABASE_URL = "<Railway DATABASE_PUBLIC_URL>"; npm run seed:mfr
 *   bash/zsh:    DATABASE_URL="<Railway DATABASE_PUBLIC_URL>" npm run seed:mfr
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const LABEL_KINDS = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"];

const MANUFACTURERS = [
  // Proizvođači
  "PASTOR T.V.A. d.o.o.",
  "PASTOR INŽENJERING d.d.",
  "IV-ER KVC d.o.o. (proizvođač)",
  "MG-RIJEKA d.o.o. (PRAVNI SLIJEDNIK DIOXA d.o.o.)",
  "M. G. S. GRUPA d.o.o.",
  "ZOP- TEHNOLOŠKE USLUGE d.o.o.",
  "VATROSERVIS d.o.o.",
  "MALA GORSKA RIJEKA d.o.o.",
  // Uvoznici
  "ZIEGLER d.o.o.",
  "ZIS OPREMA d.o.o.",
  "IV-ER KVC d.o.o. (uvoznik)",
  "VATROMAX K.M.B.",
  "KLALEDA d.o.o.",
  "MI-STAR d.o.o.",
  "LUVETI d.o.o.",
  "JURING d.o.o.",
  "PRO MIMATO d.o.o.",
  "KOTING d.o.o.",
  "TORNADO VALIDUS d.o.o.",
  "ELKRON d.o.o.",
  "TDS d.o.o.",
  "SPERONE TRGOVINA - DUBRAVA d.o.o.",
  "FIRE INSPECT d.o.o.",
  "EUROCERTUS d.o.o.",
  "LOSTURA d.o.o.",
  "VATROMEHANIKA – DUBRAVA d.o.o.",
  "EMPRESA VENTA d.o.o.",
  "PREVENTA PLUS d.o.o.",
];

async function main() {
  let inserted = 0;
  let existed = 0;
  let labelsInserted = 0;

  for (const name of MANUFACTURERS) {
    const before = await prisma.manufacturer.findUnique({ where: { name }, select: { id: true } });
    const m = await prisma.manufacturer.upsert({
      where: { name },
      create: { name },
      update: {},
      select: { id: true },
    });
    if (before) existed += 1;
    else inserted += 1;

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
    `Manufacturer upsert: ${inserted} novih, ${existed} postojećih, ukupno u bazi: ${total}.`,
  );
  console.log(`ServiceLabel: ${labelsInserted} novih (3 po proizvođaču ako ih nije bilo).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
