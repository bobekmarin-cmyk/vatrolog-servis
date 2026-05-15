import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";
import { computeLabelUsage, collectLabelRowsForDeliveryNote, consumeLabelsOnLock } from "@/lib/serviceLabels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dijagnostički + fix endpoint za platform.
 *
 * GET /api/platform/service-labels-doctor                   → global pregled (manufacturere bez ServiceLabel-a)
 * GET /api/platform/service-labels-doctor?workOrderId=...   → dijagnoza konkretnog naloga
 * POST /api/platform/service-labels-doctor                  → backfill (kreira ServiceLabel za sve proizvođače koji ih nemaju)
 * POST /api/platform/service-labels-doctor + ?workOrderId=...&recompute=1 → re-runa consumeLabelsOnLock za LOCKED nalog
 */

export async function GET(req: Request) {
  await requirePlatformSession();

  const url = new URL(req.url);
  const workOrderId = url.searchParams.get("workOrderId");

  if (!workOrderId) {
    return NextResponse.json(await globalReport());
  }

  return NextResponse.json(await workOrderReport(workOrderId));
}

export async function POST(req: Request) {
  const session = await requirePlatformSession();
  const url = new URL(req.url);
  const workOrderId = url.searchParams.get("workOrderId");
  const recompute = url.searchParams.get("recompute") === "1";
  const audit = extractAuditMeta(req);

  if (workOrderId && recompute) {
    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, companyId: true, status: true, orderNumber: true },
    });
    if (!wo) {
      return NextResponse.json({ error: "Radni nalog nije pronađen." }, { status: 404 });
    }
    if (wo.status !== "LOCKED") {
      return NextResponse.json(
        { error: "Re-compute je dostupan samo za LOCKED radne naloge." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return consumeLabelsOnLock(tx, { companyId: wo.companyId, workOrderId: wo.id });
    });

    await logAudit({
      companyId: wo.companyId,
      actorId: session.platformUserId,
      actorType: "PLATFORM_USER",
      action: "platform.workOrder.labels.recompute",
      entity: "WorkOrder",
      entityId: wo.id,
      meta: { consumed: result.consumed, rows: result.rows.length, orderNumber: wo.orderNumber },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    return NextResponse.json({
      ok: true,
      action: "recompute",
      workOrderId: wo.id,
      consumed: result.consumed,
      rows: result.rows,
      report: await workOrderReport(wo.id),
    });
  }

  // Global backfill: kreiraj ServiceLabel za sve manufacturere koji nemaju sva 3 kind-a.
  const manufacturers = await prisma.manufacturer.findMany({
    select: {
      id: true,
      name: true,
      serviceLabels: { select: { kind: true } },
    },
  });

  const KINDS = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"] as const;
  const toCreate: { manufacturerId: string; kind: (typeof KINDS)[number] }[] = [];
  const detail: Array<{ id: string; name: string; missing: string[] }> = [];

  for (const m of manufacturers) {
    const have = new Set(m.serviceLabels.map((l) => l.kind));
    const missing = KINDS.filter((k) => !have.has(k));
    if (missing.length > 0) {
      detail.push({ id: m.id, name: m.name, missing: missing.slice() });
      for (const k of missing) {
        toCreate.push({ manufacturerId: m.id, kind: k });
      }
    }
  }

  if (toCreate.length === 0) {
    return NextResponse.json({
      ok: true,
      action: "backfill",
      created: 0,
      manufacturersChecked: manufacturers.length,
      detail: [],
      message: "Svi proizvođači imaju kompletan ServiceLabel set.",
    });
  }

  const result = await prisma.serviceLabel.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  await logAudit({
    actorId: session.platformUserId,
    actorType: "PLATFORM_USER",
    action: "platform.serviceLabels.backfill",
    entity: "ServiceLabel",
    meta: { created: result.count, manufacturersAffected: detail.length },
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  return NextResponse.json({
    ok: true,
    action: "backfill",
    created: result.count,
    manufacturersAffected: detail.length,
    manufacturersChecked: manufacturers.length,
    detail,
  });
}

async function globalReport() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      displayName: true,
      sortOrder: true,
      serviceLabels: { select: { kind: true } },
    },
  });

  const KINDS = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"] as const;
  const incomplete = manufacturers
    .map((m) => {
      const have = new Set(m.serviceLabels.map((l) => l.kind));
      const missing = KINDS.filter((k) => !have.has(k));
      return { id: m.id, name: m.name, displayName: m.displayName, missing };
    })
    .filter((x) => x.missing.length > 0);

  return {
    totalManufacturers: manufacturers.length,
    incompleteCount: incomplete.length,
    incomplete,
    note:
      incomplete.length > 0
        ? "POST /api/platform/service-labels-doctor za backfill."
        : "Sve OK.",
  };
}

async function workOrderReport(workOrderId: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      companyId: true,
      company: { select: { name: true, labelCodeStrategy: true } },
      items: {
        where: { isPlaceholder: false, periodicDone: true, extinguisherId: { not: null } },
        select: {
          id: true,
          periodicDone: true,
          internalDone: true,
          extinguisher: {
            select: {
              id: true,
              manufacturerId: true,
              manufacturer: { select: { name: true } },
              type: { select: { construction: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!wo) return { error: "Radni nalog nije pronađen." } as const;

  const usage = await computeLabelUsage(prisma, {
    companyId: wo.companyId,
    workOrderId: wo.id,
  });

  const consumption = await prisma.workOrderLabelConsumption.findMany({
    where: { workOrderId: wo.id },
    select: {
      quantity: true,
      serviceLabel: {
        select: {
          kind: true,
          manufacturer: { select: { name: true } },
        },
      },
    },
  });

  const deliveryRows = await collectLabelRowsForDeliveryNote(prisma, {
    companyId: wo.companyId,
    workOrderId: wo.id,
    locked: wo.status === "LOCKED",
  });

  // Provjera ima li ServiceLabel za svaki manufacturer u items-ima.
  const manuIds = Array.from(
    new Set(
      wo.items
        .map((i) => i.extinguisher?.manufacturerId)
        .filter((x): x is string => !!x),
    ),
  );
  const labels = await prisma.serviceLabel.findMany({
    where: { manufacturerId: { in: manuIds } },
    select: { manufacturerId: true, kind: true },
  });
  const labelMap = new Map<string, Set<string>>();
  for (const l of labels) {
    const s = labelMap.get(l.manufacturerId) ?? new Set<string>();
    s.add(l.kind);
    labelMap.set(l.manufacturerId, s);
  }
  const manuLabelCoverage = manuIds.map((mid) => {
    const have = labelMap.get(mid) ?? new Set<string>();
    return {
      manufacturerId: mid,
      manufacturerName:
        wo.items.find((i) => i.extinguisher?.manufacturerId === mid)?.extinguisher?.manufacturer
          ?.name ?? "?",
      hasPERIODIC: have.has("PERIODIC"),
      hasAPPARATUS_MASS: have.has("APPARATUS_MASS"),
      hasCYLINDER_MASS: have.has("CYLINDER_MASS"),
    };
  });

  return {
    workOrder: {
      id: wo.id,
      orderNumber: wo.orderNumber,
      status: wo.status,
      companyName: wo.company.name,
      labelCodeStrategy: wo.company.labelCodeStrategy,
    },
    items: wo.items.map((i) => ({
      id: i.id,
      periodicDone: i.periodicDone,
      internalDone: i.internalDone,
      extinguisherId: i.extinguisher?.id ?? null,
      manufacturerId: i.extinguisher?.manufacturerId ?? null,
      manufacturerName: i.extinguisher?.manufacturer?.name ?? null,
      constructionCode: i.extinguisher?.type?.construction?.code ?? null,
    })),
    manuLabelCoverage,
    computeLabelUsage: usage,
    workOrderLabelConsumption: consumption,
    collectLabelRowsForDeliveryNote: deliveryRows,
    diagnosis:
      consumption.length === 0
        ? wo.status === "LOCKED"
          ? "Nalog je LOCKED ali WorkOrderLabelConsumption je prazan. Pokreni POST ?workOrderId=...&recompute=1 da popraviš."
          : "Nalog nije LOCKED — naljepnice se popunjavaju tek pri zaključavanju."
        : "OK — postoji potrošnja naljepnica.",
  };
}
