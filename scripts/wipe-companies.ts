/**
 * FULL RESET: briše sve tvrtke + tenant-bound podatke + sve korisnike (tenant + servisere).
 *
 * KEEPS:
 *   - PlatformUser, PlatformIntegration, PlatformSettings
 *   - Globalni katalog: Manufacturer, ManufacturerExtinguisherType, AgentType,
 *     Construction, ExtinguisherType, ServiceLabel
 *   - Globalni dijelovi (Part s companyId = null) i njihova PartExtinguisherType veza
 *
 * Default je dry-run. Pokretanje:
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-companies.ts
 *   npx ts-node -P tsconfig.seed.json scripts/wipe-companies.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

const APPLY = process.argv.includes("--apply");

type CountStep = {
  label: string;
  count: () => Promise<number>;
  apply: () => Promise<number>;
};

function header(title: string) {
  const line = "═".repeat(Math.max(8, title.length + 4));
  console.log(`\n${line}\n  ${title}\n${line}`);
}
function sub(title: string) {
  console.log(`\n──── ${title} ────`);
}

async function main() {
  header(APPLY ? "FULL RESET (apply mode)" : "FULL RESET (dry-run)");
  if (!APPLY) {
    console.log("Dry-run: prikazujem broj redova koji bi se obrisali. Pokreni s `--apply` da izvršiš.");
  } else {
    console.log("APPLY: brišem SVE tvrtke + sve tenant-bound podatke + sve korisnike.");
  }

  // Redoslijed je važan zbog FK ovisnosti.
  const steps: CountStep[] = [
    {
      label: "WorkOrderLabelConsumption",
      count: () => prisma.workOrderLabelConsumption.count(),
      apply: () => prisma.workOrderLabelConsumption.deleteMany({}).then((r) => r.count),
    },
    {
      label: "WorkOrderItemPart",
      count: () => prisma.workOrderItemPart.count(),
      apply: () => prisma.workOrderItemPart.deleteMany({}).then((r) => r.count),
    },
    {
      label: "WorkOrderItemCustomService",
      count: () => prisma.workOrderItemCustomService.count(),
      apply: () => prisma.workOrderItemCustomService.deleteMany({}).then((r) => r.count),
    },
    {
      label: "WorkOrderItem",
      count: () => prisma.workOrderItem.count(),
      apply: () => prisma.workOrderItem.deleteMany({}).then((r) => r.count),
    },
    {
      label: "DocumentLog",
      count: () => prisma.documentLog.count(),
      apply: () => prisma.documentLog.deleteMany({}).then((r) => r.count),
    },
    {
      label: "WorkOrder",
      count: () => prisma.workOrder.count(),
      apply: () => prisma.workOrder.deleteMany({}).then((r) => r.count),
    },
    {
      label: "ServiceLabelReceiptItem",
      count: () => prisma.serviceLabelReceiptItem.count(),
      apply: () => prisma.serviceLabelReceiptItem.deleteMany({}).then((r) => r.count),
    },
    {
      label: "ServiceLabelReceipt",
      count: () => prisma.serviceLabelReceipt.count(),
      apply: () => prisma.serviceLabelReceipt.deleteMany({}).then((r) => r.count),
    },
    {
      label: "ServiceLabelAdjustment",
      count: () => prisma.serviceLabelAdjustment.count(),
      apply: () => prisma.serviceLabelAdjustment.deleteMany({}).then((r) => r.count),
    },
    {
      label: "ServiceLabelStock",
      count: () => prisma.serviceLabelStock.count(),
      apply: () => prisma.serviceLabelStock.deleteMany({}).then((r) => r.count),
    },
    {
      label: "CompanyManufacturerAuthorization",
      count: () => prisma.companyManufacturerAuthorization.count(),
      apply: () => prisma.companyManufacturerAuthorization.deleteMany({}).then((r) => r.count),
    },
    {
      label: "StockReceiptItem",
      count: () => prisma.stockReceiptItem.count(),
      apply: () => prisma.stockReceiptItem.deleteMany({}).then((r) => r.count),
    },
    {
      label: "StockReceipt",
      count: () => prisma.stockReceipt.count(),
      apply: () => prisma.stockReceipt.deleteMany({}).then((r) => r.count),
    },
    {
      label: "StockAdjustment",
      count: () => prisma.stockAdjustment.count(),
      apply: () => prisma.stockAdjustment.deleteMany({}).then((r) => r.count),
    },
    {
      label: "PartStock",
      count: () => prisma.partStock.count(),
      apply: () => prisma.partStock.deleteMany({}).then((r) => r.count),
    },
    {
      label: "CompanyServiceCatalog",
      count: () => prisma.companyServiceCatalog.count(),
      apply: () => prisma.companyServiceCatalog.deleteMany({}).then((r) => r.count),
    },
    {
      label: "CompanyCustomService",
      count: () => prisma.companyCustomService.count(),
      apply: () => prisma.companyCustomService.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Extinguisher",
      count: () => prisma.extinguisher.count(),
      apply: () => prisma.extinguisher.deleteMany({}).then((r) => r.count),
    },
    {
      label: "CustomerBacklogSnooze",
      count: () => prisma.customerBacklogSnooze.count(),
      apply: () => prisma.customerBacklogSnooze.deleteMany({}).then((r) => r.count),
    },
    {
      label: "CustomerDepartment",
      count: () => prisma.customerDepartment.count(),
      apply: () => prisma.customerDepartment.deleteMany({}).then((r) => r.count),
    },
    {
      label: "EmailLog (cijeli)",
      count: () => prisma.emailLog.count(),
      apply: () => prisma.emailLog.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Customer",
      count: () => prisma.customer.count(),
      apply: () => prisma.customer.deleteMany({}).then((r) => r.count),
    },
    {
      label: "InvoiceItem",
      count: () => prisma.invoiceItem.count(),
      apply: () => prisma.invoiceItem.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Invoice",
      count: () => prisma.invoice.count(),
      apply: () => prisma.invoice.deleteMany({}).then((r) => r.count),
    },
    {
      label: "EmailTemplate",
      count: () => prisma.emailTemplate.count(),
      apply: () => prisma.emailTemplate.deleteMany({}).then((r) => r.count),
    },
    {
      label: "ApiKey",
      count: () => prisma.apiKey.count(),
      apply: () => prisma.apiKey.deleteMany({}).then((r) => r.count),
    },
    {
      label: "UserInvite",
      count: () => prisma.userInvite.count(),
      apply: () => prisma.userInvite.deleteMany({}).then((r) => r.count),
    },
    {
      label: "AuthToken (cijeli)",
      count: () => prisma.authToken.count(),
      apply: () => prisma.authToken.deleteMany({}).then((r) => r.count),
    },
    {
      label: "AuditLog (samo company-bound)",
      count: () => prisma.auditLog.count({ where: { companyId: { not: null } } }),
      apply: () =>
        prisma.auditLog
          .deleteMany({ where: { companyId: { not: null } } })
          .then((r) => r.count),
    },
    {
      label: "InternalCodeCounter",
      count: () => prisma.internalCodeCounter.count(),
      apply: () => prisma.internalCodeCounter.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Part (tenant: companyId NOT NULL)",
      count: () => prisma.part.count({ where: { companyId: { not: null } } }),
      apply: () =>
        prisma.part.deleteMany({ where: { companyId: { not: null } } }).then((r) => r.count),
    },
    {
      label: "CompanyFeature",
      count: () => prisma.companyFeature.count(),
      apply: () => prisma.companyFeature.deleteMany({}).then((r) => r.count),
    },
    {
      label: "AccountUser",
      count: () => prisma.accountUser.count(),
      apply: () => prisma.accountUser.deleteMany({}).then((r) => r.count),
    },
    {
      label: "User (tenant serviser)",
      count: () => prisma.user.count(),
      apply: () => prisma.user.deleteMany({}).then((r) => r.count),
    },
    {
      label: "Company",
      count: () => prisma.company.count(),
      apply: () => prisma.company.deleteMany({}).then((r) => r.count),
    },
  ];

  // 1) Dry-run pregled
  sub("Pregled");
  let totalToDelete = 0;
  for (const s of steps) {
    const c = await s.count();
    totalToDelete += c;
    console.log(`  • ${s.label.padEnd(45)} ${String(c).padStart(8)}`);
  }
  console.log(`\n  UKUPNO za brisanje: ${totalToDelete}`);

  if (!APPLY) {
    sub("Što ostaje");
    const keep = [
      ["PlatformUser", await prisma.platformUser.count()],
      ["PlatformIntegration", await prisma.platformIntegration.count()],
      ["PlatformSettings", await prisma.platformSettings.count()],
      ["Manufacturer", await prisma.manufacturer.count()],
      ["ExtinguisherType", await prisma.extinguisherType.count()],
      ["Construction", await prisma.construction.count()],
      ["AgentType", await prisma.agentType.count()],
      ["Part (globalni: companyId NULL)", await prisma.part.count({ where: { companyId: null } })],
      ["ServiceLabel", await prisma.serviceLabel.count()],
      ["AuditLog (platform-only)", await prisma.auditLog.count({ where: { companyId: null } })],
    ] as const;
    for (const [label, n] of keep) {
      console.log(`  • ${label.padEnd(45)} ${String(n).padStart(8)}`);
    }
    console.log(`\nPokreni s --apply za izvršenje.`);
    return;
  }

  // 2) Apply — sve unutar jedne transakcije
  header("APPLY: brišem unutar transakcije");
  let totalDeleted = 0;
  await prisma.$transaction(async () => {
    for (const s of steps) {
      const n = await s.apply();
      totalDeleted += n;
      console.log(`  ✓ ${s.label.padEnd(45)} obrisano: ${String(n).padStart(8)}`);
    }
  });

  sub("Sažetak");
  console.log(`  Ukupno obrisano: ${totalDeleted}`);
  console.log(`  Tvrtke i tenant podaci su pobrisani. Platform i katalog ostaju.`);
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
