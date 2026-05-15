/**
 * Hard delete demo proizvođača (Pastor, Total, Klaleda) iz dev seed-a koji su
 * ostali u produkciji, plus svi povezani podaci.
 *
 * Pažnja: NE briše PUCZ "PASTOR T.V.A. d.o.o." ili "KLALEDA d.o.o." - samo
 * točna imena bez ".d.o.o." iz starog dev seed-a.
 *
 * Pokretanje:
 *   PowerShell (dry-run):   $env:DATABASE_URL="..."; node scripts/cleanup-demo-manufacturers.mjs
 *   PowerShell (izvedi):    $env:DATABASE_URL="..."; node scripts/cleanup-demo-manufacturers.mjs --confirm
 *   bash:                   DATABASE_URL="..." node scripts/cleanup-demo-manufacturers.mjs --confirm
 *
 * Default je dry-run (samo broji povezane podatke i ne mijenja ništa). Tek s
 * `--confirm` flag-om izvršava brisanje u jednoj DB transakciji.
 */
import { PrismaClient } from "@prisma/client";

const DEMO_NAMES = ["Pastor", "Total", "Klaleda"];

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirm");
const VERBOSE = args.has("--verbose");

const prisma = new PrismaClient();

function log(...a) {
  console.log(...a);
}

function debug(...a) {
  if (VERBOSE) console.log("[debug]", ...a);
}

async function main() {
  const mode = CONFIRM ? "EXECUTE" : "DRY-RUN";
  log(`\n=== cleanup-demo-manufacturers (${mode}) ===\n`);

  const manus = await prisma.manufacturer.findMany({
    where: { name: { in: DEMO_NAMES } },
    select: { id: true, name: true },
  });

  if (manus.length === 0) {
    log(`Nema demo proizvođača za brisanje (traženo: ${DEMO_NAMES.join(", ")}).`);
    return;
  }

  const manuIds = manus.map((m) => m.id);
  log("Pronađeni demo proizvođači:");
  for (const m of manus) log(`  - ${m.name} (${m.id})`);
  log("");

  const [
    serviceLabels,
    parts,
    extinguishers,
    supportedTypes,
    catalogSettings,
    authorizations,
  ] = await Promise.all([
    prisma.serviceLabel.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true, kind: true, manufacturerId: true },
    }),
    prisma.part.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true, manufacturerId: true },
    }),
    prisma.extinguisher.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true, companyId: true, internalCode: true },
    }),
    prisma.manufacturerExtinguisherType.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { manufacturerId: true, extinguisherTypeId: true },
    }),
    prisma.companyPartCatalogSetting.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true, companyId: true },
    }),
    prisma.companyManufacturerAuthorization.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true, companyId: true },
    }),
  ]);

  const serviceLabelIds = serviceLabels.map((s) => s.id);
  const partIds = parts.map((p) => p.id);
  const extinguisherIds = extinguishers.map((e) => e.id);

  const [
    workOrderItems,
    stockReceiptItems,
    stockAdjustments,
    labelConsumptions,
    labelReceiptItems,
    labelAdjustments,
    serviceLabelStocks,
  ] = await Promise.all([
    extinguisherIds.length === 0
      ? Promise.resolve([])
      : prisma.workOrderItem.findMany({
          where: { extinguisherId: { in: extinguisherIds } },
          select: { id: true, workOrderId: true },
        }),
    partIds.length === 0
      ? Promise.resolve([])
      : prisma.stockReceiptItem.findMany({
          where: { partId: { in: partIds } },
          select: { id: true },
        }),
    partIds.length === 0
      ? Promise.resolve([])
      : prisma.stockAdjustment.findMany({
          where: { partId: { in: partIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([])
      : prisma.workOrderLabelConsumption.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { workOrderId: true, serviceLabelId: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([])
      : prisma.serviceLabelReceiptItem.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([])
      : prisma.serviceLabelAdjustment.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([])
      : prisma.serviceLabelStock.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
  ]);

  log("Povezani podaci (bit će počišćeni):");
  log(`  ServiceLabel:                ${serviceLabels.length}`);
  log(`  ServiceLabelStock:           ${serviceLabelStocks.length}`);
  log(`  ServiceLabelReceiptItem:     ${labelReceiptItems.length}`);
  log(`  ServiceLabelAdjustment:      ${labelAdjustments.length}`);
  log(`  WorkOrderLabelConsumption:   ${labelConsumptions.length}`);
  log(`  Part:                        ${parts.length}`);
  log(`  StockReceiptItem (na Part):  ${stockReceiptItems.length}`);
  log(`  StockAdjustment (na Part):   ${stockAdjustments.length}`);
  log(`  Extinguisher:                ${extinguishers.length}`);
  log(`  WorkOrderItem (na aparatu):  ${workOrderItems.length}`);
  log(`  ManufacturerExtinguisherType:${supportedTypes.length}`);
  log(`  CompanyPartCatalogSetting:   ${catalogSettings.length}`);
  log(`  CompanyManufacturerAuthorization: ${authorizations.length}`);
  log("");

  if (!CONFIRM) {
    log("DRY-RUN: ništa nije obrisano. Za izvršenje pokreni ponovo s --confirm.");
    return;
  }

  const workOrderItemIds = workOrderItems.map((w) => w.id);

  const result = await prisma.$transaction(
    async (tx) => {
      const counts = {
        workOrderLabelConsumption: 0,
        serviceLabelReceiptItem: 0,
        serviceLabelAdjustment: 0,
        workOrderItem: 0,
        extinguisher: 0,
        stockReceiptItem: 0,
        stockAdjustment: 0,
        manufacturer: 0,
      };

      if (serviceLabelIds.length > 0) {
        const r1 = await tx.workOrderLabelConsumption.deleteMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
        });
        counts.workOrderLabelConsumption = r1.count;
        debug(`  deleted WorkOrderLabelConsumption x ${r1.count}`);

        const r2 = await tx.serviceLabelReceiptItem.deleteMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
        });
        counts.serviceLabelReceiptItem = r2.count;
        debug(`  deleted ServiceLabelReceiptItem x ${r2.count}`);

        const r3 = await tx.serviceLabelAdjustment.deleteMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
        });
        counts.serviceLabelAdjustment = r3.count;
        debug(`  deleted ServiceLabelAdjustment x ${r3.count}`);
      }

      if (workOrderItemIds.length > 0) {
        const r4 = await tx.workOrderItem.deleteMany({
          where: { id: { in: workOrderItemIds } },
        });
        counts.workOrderItem = r4.count;
        debug(`  deleted WorkOrderItem x ${r4.count}`);
      }

      if (extinguisherIds.length > 0) {
        const r5 = await tx.extinguisher.deleteMany({
          where: { id: { in: extinguisherIds } },
        });
        counts.extinguisher = r5.count;
        debug(`  deleted Extinguisher x ${r5.count}`);
      }

      if (partIds.length > 0) {
        const r6 = await tx.stockReceiptItem.deleteMany({
          where: { partId: { in: partIds } },
        });
        counts.stockReceiptItem = r6.count;
        debug(`  deleted StockReceiptItem x ${r6.count}`);

        const r7 = await tx.stockAdjustment.deleteMany({
          where: { partId: { in: partIds } },
        });
        counts.stockAdjustment = r7.count;
        debug(`  deleted StockAdjustment x ${r7.count}`);
      }

      const r8 = await tx.manufacturer.deleteMany({
        where: { id: { in: manuIds } },
      });
      counts.manufacturer = r8.count;
      debug(`  deleted Manufacturer x ${r8.count}`);

      await tx.auditLog.create({
        data: {
          companyId: null,
          actorId: null,
          actorType: "SYSTEM",
          action: "platform.manufacturer.demoCleanup",
          entity: "Manufacturer",
          entityId: null,
          meta: {
            deletedManufacturers: manus.map((m) => ({ id: m.id, name: m.name })),
            counts,
          },
        },
      });

      return counts;
    },
    { timeout: 60_000 },
  );

  log("Brisanje uspješno. Sažetak:");
  for (const [k, v] of Object.entries(result)) {
    log(`  ${k.padEnd(28)} ${v}`);
  }
  log("");
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
