/**
 * Full reset of manufacturer domain while preserving core catalog:
 * - PRESERVE: AgentType, Construction, ExtinguisherType
 * - WIPE: Manufacturer, manufacturer mappings, manufacturer parts, apparatus,
 *   service labels + stocks/receipts/adjustments/consumption, and dependent
 *   stock/work-order part links tied to those entities.
 *
 * Usage:
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-manufacturer-domain.ts
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-manufacturer-domain.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });
const APPLY = process.argv.includes("--apply");

type Step = {
  label: string;
  count: () => Promise<number>;
  apply: () => Promise<number>;
};

function header(title: string) {
  const line = "═".repeat(Math.max(12, title.length + 4));
  console.log(`\n${line}\n  ${title}\n${line}`);
}

function sub(title: string) {
  console.log(`\n──── ${title} ────`);
}

async function main() {
  header(APPLY ? "WIPE MANUFACTURER DOMAIN (apply)" : "WIPE MANUFACTURER DOMAIN (dry-run)");
  if (!APPLY) {
    console.log("Dry-run: ispisujem što bi se obrisalo. Dodaj --apply za izvršenje.");
  } else {
    console.log("APPLY: brišem manufacturer domenu unutar transakcije.");
  }

  const manufacturerIds = (
    await prisma.manufacturer.findMany({ select: { id: true } })
  ).map((m) => m.id);

  const partIds = (
    await prisma.part.findMany({
      where: { manufacturerId: { in: manufacturerIds } },
      select: { id: true },
    })
  ).map((p) => p.id);

  const serviceLabelIds = (
    await prisma.serviceLabel.findMany({
      where: { manufacturerId: { in: manufacturerIds } },
      select: { id: true },
    })
  ).map((s) => s.id);

  const extinguisherIds = (
    await prisma.extinguisher.findMany({
      where: { manufacturerId: { in: manufacturerIds } },
      select: { id: true },
    })
  ).map((e) => e.id);

  const steps: Step[] = [
    {
      label: "WorkOrderLabelConsumption (by serviceLabel)",
      count: () =>
        prisma.workOrderLabelConsumption.count({
          where: { serviceLabelId: { in: serviceLabelIds } },
        }),
      apply: () =>
        prisma.workOrderLabelConsumption
          .deleteMany({ where: { serviceLabelId: { in: serviceLabelIds } } })
          .then((r) => r.count),
    },
    {
      label: "ServiceLabelReceiptItem (by serviceLabel)",
      count: () =>
        prisma.serviceLabelReceiptItem.count({
          where: { serviceLabelId: { in: serviceLabelIds } },
        }),
      apply: () =>
        prisma.serviceLabelReceiptItem
          .deleteMany({ where: { serviceLabelId: { in: serviceLabelIds } } })
          .then((r) => r.count),
    },
    {
      label: "ServiceLabelAdjustment (by serviceLabel)",
      count: () =>
        prisma.serviceLabelAdjustment.count({
          where: { serviceLabelId: { in: serviceLabelIds } },
        }),
      apply: () =>
        prisma.serviceLabelAdjustment
          .deleteMany({ where: { serviceLabelId: { in: serviceLabelIds } } })
          .then((r) => r.count),
    },
    {
      label: "ServiceLabelStock (by serviceLabel)",
      count: () =>
        prisma.serviceLabelStock.count({
          where: { serviceLabelId: { in: serviceLabelIds } },
        }),
      apply: () =>
        prisma.serviceLabelStock
          .deleteMany({ where: { serviceLabelId: { in: serviceLabelIds } } })
          .then((r) => r.count),
    },
    {
      label: "ServiceLabelReceipt (orphan after item delete)",
      count: () => prisma.serviceLabelReceipt.count(),
      apply: () => prisma.serviceLabelReceipt.deleteMany({}).then((r) => r.count),
    },
    {
      label: "StockReceiptItem (by part)",
      count: () => prisma.stockReceiptItem.count({ where: { partId: { in: partIds } } }),
      apply: () =>
        prisma.stockReceiptItem
          .deleteMany({ where: { partId: { in: partIds } } })
          .then((r) => r.count),
    },
    {
      label: "StockAdjustment (by part)",
      count: () => prisma.stockAdjustment.count({ where: { partId: { in: partIds } } }),
      apply: () =>
        prisma.stockAdjustment
          .deleteMany({ where: { partId: { in: partIds } } })
          .then((r) => r.count),
    },
    {
      label: "PartStock (by part)",
      count: () => prisma.partStock.count({ where: { partId: { in: partIds } } }),
      apply: () =>
        prisma.partStock
          .deleteMany({ where: { partId: { in: partIds } } })
          .then((r) => r.count),
    },
    {
      label: "WorkOrderItemPart (by part)",
      count: () => prisma.workOrderItemPart.count({ where: { partId: { in: partIds } } }),
      apply: () =>
        prisma.workOrderItemPart
          .deleteMany({ where: { partId: { in: partIds } } })
          .then((r) => r.count),
    },
    {
      label: "PartExtinguisherType (by part)",
      count: () => prisma.partExtinguisherType.count({ where: { partId: { in: partIds } } }),
      apply: () =>
        prisma.partExtinguisherType
          .deleteMany({ where: { partId: { in: partIds } } })
          .then((r) => r.count),
    },
    {
      label: "StockReceipt (orphan after item delete)",
      count: () => prisma.stockReceipt.count(),
      apply: () => prisma.stockReceipt.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Extinguisher (by manufacturer)",
      count: () =>
        prisma.extinguisher.count({ where: { manufacturerId: { in: manufacturerIds } } }),
      apply: () =>
        prisma.extinguisher
          .deleteMany({ where: { manufacturerId: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
    {
      label: "CompanyManufacturerAuthorization",
      count: () =>
        prisma.companyManufacturerAuthorization.count({
          where: { manufacturerId: { in: manufacturerIds } },
        }),
      apply: () =>
        prisma.companyManufacturerAuthorization
          .deleteMany({ where: { manufacturerId: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
    {
      label: "CompanyServiceCatalog (by manufacturer-bound variants)",
      count: () =>
        prisma.companyServiceCatalog.count({
          where: { variantKey: { startsWith: "v1c|" } },
        }),
      apply: () =>
        prisma.companyServiceCatalog
          .deleteMany({ where: { variantKey: { startsWith: "v1c|" } } })
          .then((r) => r.count),
    },
    {
      label: "ServiceLabel",
      count: () =>
        prisma.serviceLabel.count({ where: { manufacturerId: { in: manufacturerIds } } }),
      apply: () =>
        prisma.serviceLabel
          .deleteMany({ where: { manufacturerId: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
    {
      label: "Part (by manufacturer)",
      count: () => prisma.part.count({ where: { manufacturerId: { in: manufacturerIds } } }),
      apply: () =>
        prisma.part
          .deleteMany({ where: { manufacturerId: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
    {
      label: "ManufacturerExtinguisherType",
      count: () =>
        prisma.manufacturerExtinguisherType.count({
          where: { manufacturerId: { in: manufacturerIds } },
        }),
      apply: () =>
        prisma.manufacturerExtinguisherType
          .deleteMany({ where: { manufacturerId: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
    {
      label: "Manufacturer",
      count: () => prisma.manufacturer.count({ where: { id: { in: manufacturerIds } } }),
      apply: () =>
        prisma.manufacturer
          .deleteMany({ where: { id: { in: manufacturerIds } } })
          .then((r) => r.count),
    },
  ];

  sub("Pregled brisanja");
  let total = 0;
  for (const s of steps) {
    const c = await s.count();
    total += c;
    console.log(`  • ${s.label.padEnd(50)} ${String(c).padStart(8)}`);
  }
  console.log(`\n  UKUPNO: ${total}`);

  if (!APPLY) {
    sub("Ostaje netaknuto");
    console.log(`  • AgentType:       ${await prisma.agentType.count()}`);
    console.log(`  • Construction:    ${await prisma.construction.count()}`);
    console.log(`  • ExtinguisherType:${await prisma.extinguisherType.count()}`);
    console.log("\nPokreni s --apply za izvršenje.");
    return;
  }

  header("APPLY: izvršenje");
  let deletedTotal = 0;
  await prisma.$transaction(async () => {
    for (const s of steps) {
      const d = await s.apply();
      deletedTotal += d;
      console.log(`  ✓ ${s.label.padEnd(50)} ${String(d).padStart(8)}`);
    }
  });

  sub("Post-check");
  const post = {
    manufacturer: await prisma.manufacturer.count(),
    extinguisher: await prisma.extinguisher.count(),
    partByManu: await prisma.part.count({ where: { manufacturerId: { not: "" } } }),
    serviceLabel: await prisma.serviceLabel.count(),
    manufacturerTypeMap: await prisma.manufacturerExtinguisherType.count(),
  };
  console.log(`  obrisano ukupno: ${deletedTotal}`);
  console.log(`  Manufacturer: ${post.manufacturer}`);
  console.log(`  Extinguisher: ${post.extinguisher}`);
  console.log(`  Part(manufacturer-bound): ${post.partByManu}`);
  console.log(`  ServiceLabel: ${post.serviceLabel}`);
  console.log(`  ManufacturerExtinguisherType: ${post.manufacturerTypeMap}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
