import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatMergedVariantName,
  serviceKindLabel,
  type ServiceKindValue,
} from "@/lib/formatServiceItem";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import { buildVariantSnapshot, type VariantSnapshot } from "@/lib/serviceVariant";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";
import DeliveryNotePdfDocument, {
  type DeliveryNotePdfData,
  type DeliveryNoteServiceRow,
  type DeliveryNotePartAggregated,
  type DeliveryNoteLabelRow,
} from "@/pdf/DeliveryNotePdfDocument";
import { collectLabelRowsForDeliveryNote } from "@/lib/serviceLabels";
import React, { type ComponentProps } from "react";
import { customerDisplayName } from "@/lib/customerDisplay";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { savePdf } from "@/lib/pdfStorage";
import QRCode from "qrcode";
import { APP_VERSION } from "@/lib/appVersion";
import { describeWorkOrderServiceContext } from "@/lib/workOrderDeliveryDisplay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentLite = { code: string; label: string; symbol: string | null } | null;
type ConstructionLite = {
  code: string;
  label: string;
  prefix: string | null;
  sortOrder: number;
} | null;

type ServiceBucketKey = string; // `${variantKey}|${kind}`

type ServiceBucket = {
  variantKey: string;
  snap: VariantSnapshot;
  kind: ServiceKindValue;
  count: number;
  agent: AgentLite;
  construction: ConstructionLite;
  sortCapacity: number;
  sortConstruction: number;
  sortAgent: number;
  sortFallback: string;
};

type MergedRow = {
  kind: ServiceKindValue;
  code: string | null;
  count: number;
  /** null kada je u ovaj red spojeno više varijanti s različitim agentima. */
  agent: AgentLite;
  construction: ConstructionLite;
  capacity: number | null;
  fallbackLabel: string | null;
  sortConstruction: number;
  sortAgent: number; // -1 = spojeno (sortira se prvo u grupi)
  sortCapacity: number;
  sortFallback: string;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      company: true,
      customer: true,
      department: true,
      serviceLocation: { select: { kind: true, label: true } },
      items: {
        orderBy: [{ isPlaceholder: "asc" }, { createdAt: "asc" }],
        include: {
          parts: { include: { part: true } },
          customServices: { include: { customService: true } },
          extinguisher: {
            include: { type: { include: { agent: true, construction: true } }, manufacturer: true },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const realItems = order.items.filter((i) => !i.isPlaceholder && i.extinguisher);

  // ── 1) Buckets po (variantKey, kind) ─────────────────────────────────────
  const buckets = new Map<ServiceBucketKey, ServiceBucket>();
  const variantKeysNeedingCodes = new Set<string>();
  let sawAnyItem = false;

  for (const it of realItems) {
    const type = it.extinguisher?.type;
    if (!type) continue;
    sawAnyItem = true;

    const snap = buildVariantSnapshot({
      code: type.code,
      agentId: type.agentId,
      constructionId: type.constructionId,
      capacity: type.capacity,
      capacityUnit: type.capacityUnit,
      construction: type.construction,
    });

    variantKeysNeedingCodes.add(snap.variantKey);

    const agent: AgentLite = type.agent
      ? { code: type.agent.code, label: type.agent.label, symbol: type.agent.symbol }
      : null;
    const construction: ConstructionLite = type.construction
      ? {
          code: type.construction.code,
          label: type.construction.label,
          prefix: type.construction.prefix,
          sortOrder: type.construction.sortOrder ?? 999,
        }
      : null;

    const commonSort = {
      sortCapacity: type.capacity ?? 0,
      sortConstruction: type.construction?.sortOrder ?? 999,
      sortAgent: type.agent?.sortOrder ?? 999,
      sortFallback: snap.fallbackLabel ?? type.code,
    };

    const kinds: ServiceKindValue[] = ["PERIODIC"];
    if (it.internalDone) kinds.push("INTERNAL");

    for (const kind of kinds) {
      const key = `${snap.variantKey}|${kind}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, {
          variantKey: snap.variantKey,
          snap,
          kind,
          count: 1,
          agent,
          construction,
          ...commonSort,
        });
      }
    }
  }

  // Self-heal: osiguraj da katalog ima redove za sve varijante koje se pojavljuju.
  if (sawAnyItem) {
    await syncCompanyServiceCatalog(null, { companyId: session.companyId });
  }

  // ── 2) Lookup šifri po (variantKey, kind) ───────────────────────────────
  const catalogRows =
    variantKeysNeedingCodes.size === 0
      ? []
      : await prisma.companyServiceCatalog.findMany({
          where: {
            companyId: session.companyId,
            variantKey: { in: Array.from(variantKeysNeedingCodes) },
          },
          select: { variantKey: true, kind: true, code: true },
        });
  const codeMap = new Map<string, string | null>();
  for (const r of catalogRows) {
    codeMap.set(`${r.variantKey}|${r.kind}`, r.code);
  }

  // ── 3) Spoji buckete s istom ne-null šifrom i (construction, capacity, ──
  //      capacityUnit, kind). Različiti agenti se u tom slučaju gube iz
  //      labele (prikazuje se "P9 (ST)" umjesto "P9 (ST, prah)").
  const merged = new Map<string, MergedRow>();
  for (const b of buckets.values()) {
    const code = codeMap.get(`${b.variantKey}|${b.kind}`) ?? null;
    const mergeKey = code
      ? `coded|${code}|${b.kind}|${b.snap.constructionId ?? ""}|${b.snap.capacity ?? ""}|${b.snap.capacityUnit ?? ""}|${b.snap.fallbackLabel ?? ""}`
      : `single|${b.variantKey}|${b.kind}`;

    const existing = merged.get(mergeKey);
    if (existing) {
      existing.count += b.count;
      existing.agent = null; // različiti agenti spojeni → meta bez medija
      existing.sortAgent = -1;
    } else {
      merged.set(mergeKey, {
        kind: b.kind,
        code,
        count: b.count,
        agent: b.agent,
        construction: b.construction,
        capacity: b.snap.capacity,
        fallbackLabel: b.snap.fallbackLabel,
        sortConstruction: b.sortConstruction,
        sortAgent: b.sortAgent,
        sortCapacity: b.sortCapacity,
        sortFallback: b.sortFallback,
      });
    }
  }

  const services: DeliveryNoteServiceRow[] = Array.from(merged.values())
    .sort((a, b) => {
      const ak = a.kind === "PERIODIC" ? 0 : 1;
      const bk = b.kind === "PERIODIC" ? 0 : 1;
      if (ak !== bk) return ak - bk;
      if (a.sortConstruction !== b.sortConstruction) return a.sortConstruction - b.sortConstruction;
      if (a.sortCapacity !== b.sortCapacity) return a.sortCapacity - b.sortCapacity;
      if (a.sortAgent !== b.sortAgent) return a.sortAgent - b.sortAgent;
      return a.sortFallback.localeCompare(b.sortFallback, "hr");
    })
    .map((m) => ({
      kindLabel: serviceKindLabel(m.kind),
      itemLabel: formatMergedVariantName({
        agent: m.agent,
        construction: m.construction,
        capacity: m.capacity,
        fallbackLabel: m.fallbackLabel,
      }),
      code: m.code,
      quantity: m.count,
    }));

  // ── 3b) Vlastite (slobodne) usluge tenanta ──────────────────────────────
  // Agregiramo po `customServiceId`, count = broj serviceiranih stavki na
  // kojima je usluga prisutna (qty po vezi je uvijek 1).
  type CustomAgg = { id: string; name: string; code: string | null; quantity: number };
  const customByName = new Map<string, CustomAgg>();
  for (const it of realItems) {
    for (const cs of it.customServices ?? []) {
      const csv = cs.customService;
      if (!csv) continue;
      const existing = customByName.get(csv.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        customByName.set(csv.id, {
          id: csv.id,
          name: csv.name,
          code: csv.code ?? null,
          quantity: 1,
        });
      }
    }
  }
  for (const c of [...customByName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "hr"),
  )) {
    services.push({
      kindLabel: "Dodatna usluga",
      itemLabel: c.name,
      code: c.code,
      quantity: c.quantity,
    });
  }

  // ── 4) Agregacija dijelova po identitetu dijela ────────────────────────
  // Pravila prikaza (otpremnica):
  //  · Stupac "Šifra" = isključivo tenantova računovodstvena šifra. Za
  //    platform dijelove to je tenantov override (snapshotCode ako se
  //    razlikuje od snapshotManufacturerCode), za vlastite dijelove je to
  //    snapshotCode (inače part.code). Ako ne postoji tenantova šifra,
  //    pokazujemo "—".
  //  · Stupac "Naziv" = naziv dijela; za platform dijelove uz naziv stoji
  //    zasivljena tvornička šifra (renderirano u PDF komponenti).
  //  · Snapshot polja imaju prednost (povijesna stabilnost).
  type PartAgg = {
    code: string;
    name: string;
    manufacturerCode: string | null;
    quantity: number;
  };
  const partsByKey = new Map<string, PartAgg>();
  for (const it of realItems) {
    for (const p of it.parts ?? []) {
      const isCustom = p.snapshotIsCustom ?? !!p.part.companyId;
      const name = (p.snapshotName ?? p.part.name).trim();
      const manuCode = isCustom
        ? null
        : ((p.snapshotManufacturerCode ?? p.part.manufacturerCode ?? "").trim() || null);
      const display = (p.snapshotCode ?? p.part.code).trim();
      let accountingCode = "—";
      if (isCustom) {
        accountingCode = display || "—";
      } else if (display && display !== manuCode) {
        accountingCode = display;
      }
      const key = `${p.partId}|${accountingCode}|${manuCode ?? ""}|${name}`;
      const existing = partsByKey.get(key);
      if (existing) {
        existing.quantity += p.quantity;
      } else {
        partsByKey.set(key, {
          code: accountingCode,
          name,
          manufacturerCode: manuCode,
          quantity: p.quantity,
        });
      }
    }
  }
  const partsAggregated: DeliveryNotePartAggregated[] = [
    ...[...partsByKey.values()]
      .sort(
        (a, b) =>
          (a.manufacturerCode ?? "").localeCompare(b.manufacturerCode ?? "", "hr") ||
          a.code.localeCompare(b.code, "hr") ||
          a.name.localeCompare(b.name, "hr"),
      )
      .map((v) => ({
        code: v.code,
        name: v.name,
        manufacturerCode: v.manufacturerCode,
        quantity: v.quantity,
      })),
    ...realItems
      .filter(
        (i) =>
          (i.partsText ?? "").trim().length > 0 &&
          (i.parts ?? []).length === 0,
      )
      .map((i) => ({
        code: "—",
        name: i.partsText!.trim(),
        manufacturerCode: null as string | null,
        quantity: null as number | null,
      })),
  ];

  // ── 5) Potrošnja servisnih naljepnica ───────────────────────────────────
  const labelDeliveryRows = await collectLabelRowsForDeliveryNote(prisma, {
    companyId: session.companyId,
    workOrderId: order.id,
    locked: order.status === "LOCKED",
  });
  const labels: DeliveryNoteLabelRow[] = labelDeliveryRows.map((r) => ({
    code: r.code,
    name: r.kindLabel,
    quantity: r.quantity,
  }));

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const generatedAtLabel = `${formatDateDdMmYyyy(now)} ${hh}:${mm}`;
  const docId = `otpremnica-${order.orderNumber.replaceAll("/", "-")}`;

  const qrPayload = `VATROLOG:OTPREMNICA:${order.orderNumber}:${order.company.oib}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: "M",
    });
  } catch {
    qrDataUrl = null;
  }

  const dep = order.department;
  const cust = order.customer;
  const locationText = order.serviceLocation
    ? `${order.serviceLocation.kind === "STATIONARY" ? "S" : "V"} ${order.serviceLocation.label}`
    : "—";
  const serviceModeText = describeWorkOrderServiceContext({
    deliveryMode: order.deliveryMode,
    serviceLocationKind: order.serviceLocation?.kind,
  });

  const data: DeliveryNotePdfData = {
    company: {
      name: order.company.name,
      oib: order.company.oib,
      street: order.company.street,
      city: order.company.city,
      postalCode: order.company.postalCode,
      iban: order.company.iban,
      contactName: order.company.contactName ?? null,
      phone: order.company.phone ?? null,
      email: order.company.email ?? null,
    },
    orderNumber: order.orderNumber,
    customer: {
      displayName: customerDisplayName(cust),
      fullName: cust.name,
      oib: cust.oib,
      address: cust.address,
      street: cust.street,
      postalCode: cust.postalCode,
      city: cust.city,
      contactPerson: dep?.contactPerson ?? cust.contactPerson ?? null,
      phone: dep?.phone ?? cust.phone ?? null,
      email: dep?.email ?? cust.email ?? null,
      department: dep?.name ?? null,
    },
    dates: {
      receiptDate: formatDateDdMmYyyy(order.receivedAt ?? null),
      orderDate: formatDateDdMmYyyy(order.receivedAt ?? order.createdAt),
      deliveryNoteDate: formatDateDdMmYyyy(now),
    },
    serviceFooterLine: `Lokacija: ${locationText}  ·  Način servisa: ${serviceModeText}`,
    status: order.status,
    docId,
    generatedAtLabel,
    appVersion: APP_VERSION,
    qrDataUrl,
    services,
    partsAggregated,
    labels,
  };

  await prisma.documentLog.create({
    data: { companyId: session.companyId, workOrderId: order.id, docType: "DELIVERY_NOTE_PDF" },
  });

  const props = { data } satisfies ComponentProps<typeof DeliveryNotePdfDocument>;
  const element = React.createElement(DeliveryNotePdfDocument, props);
  const body = await renderPdfToBuffer(element);
  const filename = `otpremnica_${order.orderNumber.replaceAll("/", "-")}.pdf`;

  savePdf(session.companyId, "delivery-note", order.orderNumber, Buffer.from(body)).catch(() => {});

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
