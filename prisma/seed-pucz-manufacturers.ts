/**
 * PUCZ: „Zahtjev za izdavanje naljepnica za održavanje vatrogasnih aparata“
 * (verzija iz PDF-a od 15.4.2024.).
 *
 * Briše sve proizvođače i povezane podatke koji blokiraju brisanje (aparati, dijelovi,
 * skladišne primke, servisne naljepnice), zatom unosi popis iz obrasca.
 *
 * Pokretanje: npm run seed:pucz-mfr
 */
import { PrismaClient, type ServiceLabelKind } from "@prisma/client";

const prisma = new PrismaClient();

const LABEL_KINDS: ServiceLabelKind[] = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"];

/** Redoslijed kao u PDF-u: proizvođači (1–8), zatim uvoznici (1–20). IV-ER KVC dvaput. */
const PUCZ_STICKER_FORM_2024_04_MANUFACTURERS: string[] = [
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
    data: PUCZ_STICKER_FORM_2024_04_MANUFACTURERS.map((name) => ({ name })),
  });
  console.log(`PUCZ: upisano ${create.count} proizvođača/uvoznika.`);

  const rows = await prisma.manufacturer.findMany({
    where: { name: { in: [...PUCZ_STICKER_FORM_2024_04_MANUFACTURERS] } },
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
