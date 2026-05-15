/**
 * PUCZ: „Zahtjev za izdavanje naljepnica za održavanje vatrogasnih aparata“
 * (verzija iz PDF-a od 15.4.2024.).
 *
 * Briše sve proizvođače i povezane podatke koji blokiraju brisanje (aparati, dijelovi,
 * skladišne primke, servisne naljepnice), zatim unosi popis iz obrasca s
 * ručnim `sortOrder`-om iz centralnog `scripts/manufacturers-data.js`.
 *
 * Pokretanje: npm run seed:pucz-mfr
 */
import { PrismaClient, type ServiceLabelKind } from "@prisma/client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MANUFACTURERS, LABEL_KINDS } = require("../scripts/manufacturers-data.js") as {
  MANUFACTURERS: { name: string; sortOrder: number }[];
  LABEL_KINDS: ServiceLabelKind[];
};

const prisma = new PrismaClient();

async function main() {
  console.warn(
    "PUCZ seed: brišem sve proizvođače i povezane aparate/dijelove/skladišne i naljepničke zapise.",
  );

  await prisma.$transaction(async (tx) => {
    await tx.workOrderLabelConsumption.deleteMany();
    await tx.serviceLabelAdjustment.deleteMany();
    await tx.serviceLabelReceipt.deleteMany();
    await tx.serviceLabel.deleteMany();
    await tx.companyManufacturerAuthorization.deleteMany();
    await tx.manufacturerExtinguisherType.deleteMany();
    await tx.stockAdjustment.deleteMany();
    await tx.stockReceipt.deleteMany();
    await tx.extinguisher.deleteMany();
    await tx.manufacturer.deleteMany();
  });

  const create = await prisma.manufacturer.createMany({
    data: MANUFACTURERS.map(({ name, sortOrder }) => ({ name, sortOrder })),
  });
  console.log(`PUCZ: upisano ${create.count} proizvođača/uvoznika.`);

  const rows = await prisma.manufacturer.findMany({
    where: { name: { in: MANUFACTURERS.map((m) => m.name) } },
    select: { id: true },
  });
  await prisma.serviceLabel.createMany({
    data: rows.flatMap((m) =>
      LABEL_KINDS.map((kind) => ({ manufacturerId: m.id, kind })),
    ),
    skipDuplicates: true,
  });
  console.log(`ServiceLabel: ${rows.length * LABEL_KINDS.length} redaka (3 × proizvođač).`);

  const total = await prisma.manufacturer.count();
  console.log(`Manufacturer ukupno: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
