import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hard delete demo proizvođača Pastor / Total / Klaleda (točno ime, NE PUCZ
 * verzije s ".d.o.o.") + sve povezane podatke u jednoj transakciji.
 *
 * GET   -> dry-run, vraća sažetak što bi se obrisalo
 * POST  ?confirm=true -> stvarno briše + audit log
 *
 * Endpoint je platform-only (requirePlatformSession). Replikacija logike
 * skripte scripts/cleanup-demo-manufacturers.mjs za pokretanje iz browser
 * konzole bez ulaska u Railway CLI.
 */

const DEMO_NAMES = ["Pastor", "Total", "Klaleda"];

async function collect() {
  const manus = await prisma.manufacturer.findMany({
    where: { name: { in: DEMO_NAMES } },
    select: { id: true, name: true },
  });
  const manuIds = manus.map((m) => m.id);

  if (manuIds.length === 0) {
    return {
      manus,
      manuIds,
      serviceLabels: [] as { id: string }[],
      parts: [] as { id: string }[],
      extinguishers: [] as { id: string }[],
      supportedTypes: [] as { manufacturerId: string }[],
      catalogSettings: [] as { id: string }[],
      authorizations: [] as { id: string }[],
      workOrderItems: [] as { id: string }[],
      stockReceiptItems: [] as { id: string }[],
      stockAdjustments: [] as { id: string }[],
      labelConsumptions: [] as { workOrderId: string }[],
      labelReceiptItems: [] as { id: string }[],
      labelAdjustments: [] as { id: string }[],
      serviceLabelStocks: [] as { id: string }[],
    };
  }

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
      select: { id: true },
    }),
    prisma.part.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true },
    }),
    prisma.extinguisher.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true },
    }),
    prisma.manufacturerExtinguisherType.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { manufacturerId: true },
    }),
    prisma.companyPartCatalogSetting.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true },
    }),
    prisma.companyManufacturerAuthorization.findMany({
      where: { manufacturerId: { in: manuIds } },
      select: { id: true },
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
      ? Promise.resolve([] as { id: string }[])
      : prisma.workOrderItem.findMany({
          where: { extinguisherId: { in: extinguisherIds } },
          select: { id: true },
        }),
    partIds.length === 0
      ? Promise.resolve([] as { id: string }[])
      : prisma.stockReceiptItem.findMany({
          where: { partId: { in: partIds } },
          select: { id: true },
        }),
    partIds.length === 0
      ? Promise.resolve([] as { id: string }[])
      : prisma.stockAdjustment.findMany({
          where: { partId: { in: partIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([] as { workOrderId: string }[])
      : prisma.workOrderLabelConsumption.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { workOrderId: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([] as { id: string }[])
      : prisma.serviceLabelReceiptItem.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([] as { id: string }[])
      : prisma.serviceLabelAdjustment.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
    serviceLabelIds.length === 0
      ? Promise.resolve([] as { id: string }[])
      : prisma.serviceLabelStock.findMany({
          where: { serviceLabelId: { in: serviceLabelIds } },
          select: { id: true },
        }),
  ]);

  return {
    manus,
    manuIds,
    serviceLabels,
    parts,
    extinguishers,
    supportedTypes,
    catalogSettings,
    authorizations,
    workOrderItems,
    stockReceiptItems,
    stockAdjustments,
    labelConsumptions,
    labelReceiptItems,
    labelAdjustments,
    serviceLabelStocks,
  };
}

export async function GET() {
  await requirePlatformSession();
  const c = await collect();
  return NextResponse.json({
    mode: "dry-run",
    demoNames: DEMO_NAMES,
    foundManufacturers: c.manus,
    counts: {
      serviceLabels: c.serviceLabels.length,
      serviceLabelStocks: c.serviceLabelStocks.length,
      serviceLabelReceiptItems: c.labelReceiptItems.length,
      serviceLabelAdjustments: c.labelAdjustments.length,
      workOrderLabelConsumptions: c.labelConsumptions.length,
      parts: c.parts.length,
      stockReceiptItems: c.stockReceiptItems.length,
      stockAdjustments: c.stockAdjustments.length,
      extinguishers: c.extinguishers.length,
      workOrderItems: c.workOrderItems.length,
      manufacturerExtinguisherTypes: c.supportedTypes.length,
      companyPartCatalogSettings: c.catalogSettings.length,
      companyManufacturerAuthorizations: c.authorizations.length,
    },
    note:
      c.manuIds.length === 0
        ? "Nema demo proizvođača za brisanje."
        : "POST ?confirm=true za stvarno brisanje. Operacija je nepovratna.",
  });
}

export async function POST(req: Request) {
  const session = await requirePlatformSession();
  const url = new URL(req.url);
  const confirmed = url.searchParams.get("confirm") === "true";
  const audit = extractAuditMeta(req);

  if (!confirmed) {
    return NextResponse.json(
      { error: "Dodaj ?confirm=true u URL za stvarno brisanje." },
      { status: 400 },
    );
  }

  const c = await collect();
  if (c.manuIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: "Nema demo proizvođača za brisanje." });
  }

  const serviceLabelIds = c.serviceLabels.map((s) => s.id);
  const partIds = c.parts.map((p) => p.id);
  const extinguisherIds = c.extinguishers.map((e) => e.id);
  const workOrderItemIds = c.workOrderItems.map((w) => w.id);

  const counts = await prisma.$transaction(
    async (tx) => {
      const r = {
        workOrderLabelConsumption: 0,
        serviceLabelReceiptItem: 0,
        serviceLabelAdjustment: 0,
        serviceLabelStock: 0,
        serviceLabel: 0,
        workOrderItem: 0,
        extinguisher: 0,
        stockReceiptItem: 0,
        stockAdjustment: 0,
        part: 0,
        manufacturerExtinguisherType: 0,
        companyPartCatalogSetting: 0,
        companyManufacturerAuthorization: 0,
        manufacturer: 0,
      };

      if (serviceLabelIds.length > 0) {
        r.workOrderLabelConsumption = (
          await tx.workOrderLabelConsumption.deleteMany({
            where: { serviceLabelId: { in: serviceLabelIds } },
          })
        ).count;
        r.serviceLabelReceiptItem = (
          await tx.serviceLabelReceiptItem.deleteMany({
            where: { serviceLabelId: { in: serviceLabelIds } },
          })
        ).count;
        r.serviceLabelAdjustment = (
          await tx.serviceLabelAdjustment.deleteMany({
            where: { serviceLabelId: { in: serviceLabelIds } },
          })
        ).count;
        r.serviceLabelStock = (
          await tx.serviceLabelStock.deleteMany({
            where: { serviceLabelId: { in: serviceLabelIds } },
          })
        ).count;
        r.serviceLabel = (
          await tx.serviceLabel.deleteMany({
            where: { id: { in: serviceLabelIds } },
          })
        ).count;
      }

      if (workOrderItemIds.length > 0) {
        r.workOrderItem = (
          await tx.workOrderItem.deleteMany({
            where: { id: { in: workOrderItemIds } },
          })
        ).count;
      }

      if (extinguisherIds.length > 0) {
        r.extinguisher = (
          await tx.extinguisher.deleteMany({
            where: { id: { in: extinguisherIds } },
          })
        ).count;
      }

      if (partIds.length > 0) {
        r.stockReceiptItem = (
          await tx.stockReceiptItem.deleteMany({ where: { partId: { in: partIds } } })
        ).count;
        r.stockAdjustment = (
          await tx.stockAdjustment.deleteMany({ where: { partId: { in: partIds } } })
        ).count;
        r.part = (
          await tx.part.deleteMany({ where: { id: { in: partIds } } })
        ).count;
      }

      r.manufacturerExtinguisherType = (
        await tx.manufacturerExtinguisherType.deleteMany({
          where: { manufacturerId: { in: c.manuIds } },
        })
      ).count;
      r.companyPartCatalogSetting = (
        await tx.companyPartCatalogSetting.deleteMany({
          where: { manufacturerId: { in: c.manuIds } },
        })
      ).count;
      r.companyManufacturerAuthorization = (
        await tx.companyManufacturerAuthorization.deleteMany({
          where: { manufacturerId: { in: c.manuIds } },
        })
      ).count;

      r.manufacturer = (
        await tx.manufacturer.deleteMany({ where: { id: { in: c.manuIds } } })
      ).count;

      return r;
    },
    { timeout: 60_000 },
  );

  await logAudit({
    actorId: session.platformUserId,
    actorType: "PLATFORM_USER",
    action: "platform.manufacturer.demoCleanup",
    entity: "Manufacturer",
    meta: {
      deletedManufacturers: c.manus,
      counts,
    },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({ ok: true, deletedManufacturers: c.manus, counts });
}
