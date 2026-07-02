import { prisma } from "@/lib/prisma";
import {
  formatMergedVariantName,
  serviceKindLabel,
  type ServiceKindValue,
} from "@/lib/formatServiceItem";
import { buildVariantSnapshot } from "@/lib/serviceVariant";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import { formatPartUnit } from "@/lib/partsCatalog";
import { getActiveDeliveryNote } from "@/lib/deliveryNoteIssue";
import type { ERacuniSettingsResolved, InvoiceLine } from "@/lib/eracuni";
import { PartUnit } from "@prisma/client";

/**
 * Slaganje stavki računa za e-računi iz zaključanog radnog naloga.
 *
 * Redoslijed stavki prati postojeći račun korisnika:
 *   1. periodični pregledi (po varijanti aparata)
 *   2. komplet naljepnica (1 po pregledanom aparatu)
 *   3. unutarnji pregledi
 *   4. dodatne (custom) usluge
 *   5. rezervni dijelovi
 *
 * Cijene: VatroLog šifrarnik je izvor istine. Rabat: postoci po kategorijama
 * s kupca (usluge / naljepnice / dijelovi), šalju se kao discountPercentage.
 */

export type EracuniInvoiceBuild =
  | {
      ok: true;
      lines: InvoiceLine[];
      warnings: string[];
      buyer: {
        name: string;
        oib: string;
        street: string | null;
        postalCode: string | null;
        city: string | null;
        email: string | null;
        phone: string | null;
      };
      dateOfSupply: Date;
      remark: string | null;
    }
  | { ok: false; problems: string[] };

function pct(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

export async function buildEracuniInvoice(
  companyId: string,
  workOrderId: string,
  settings: ERacuniSettingsResolved,
): Promise<EracuniInvoiceBuild> {
  const order = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId },
    include: {
      customer: true,
      items: {
        include: {
          parts: { include: { part: true } },
          customServices: { include: { customService: true } },
          extinguisher: {
            include: { type: { include: { agent: true, construction: true } } },
          },
        },
      },
    },
  });
  if (!order) return { ok: false, problems: ["Radni nalog nije pronađen."] };
  if (order.status !== "LOCKED") {
    return { ok: false, problems: ["Radni nalog mora biti zaključan prije kreiranja računa."] };
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  const realItems = order.items.filter((i) => !i.isPlaceholder && i.extinguisher);

  if (realItems.length === 0) {
    return { ok: false, problems: ["Nalog nema niti jedan servisirani aparat."] };
  }

  // --- Usluge (periodični + unutarnji pregledi) po varijanti ---
  type Bucket = {
    variantKey: string;
    kind: ServiceKindValue;
    label: string;
    count: number;
    sortConstruction: number;
    sortCapacity: number;
  };
  const buckets = new Map<string, Bucket>();
  const variantKeys = new Set<string>();

  for (const it of realItems) {
    const type = it.extinguisher?.type;
    if (!type) continue;

    const snap = buildVariantSnapshot({
      code: type.code,
      agentId: type.agentId,
      constructionId: type.constructionId,
      capacity: type.capacity,
      capacityUnit: type.capacityUnit,
      construction: type.construction,
    });
    variantKeys.add(snap.variantKey);

    const label = formatMergedVariantName({
      agent: type.agent
        ? { code: type.agent.code, label: type.agent.label, symbol: type.agent.symbol }
        : null,
      construction: type.construction
        ? {
            code: type.construction.code,
            label: type.construction.label,
            prefix: type.construction.prefix,
          }
        : null,
      capacity: snap.capacity,
      fallbackLabel: snap.fallbackLabel,
    });

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
          kind,
          label,
          count: 1,
          sortConstruction: type.construction?.sortOrder ?? 999,
          sortCapacity: type.capacity ?? 0,
        });
      }
    }
  }

  await syncCompanyServiceCatalog(null, { companyId });
  const catalogRows = await prisma.companyServiceCatalog.findMany({
    where: { companyId, variantKey: { in: Array.from(variantKeys) } },
    select: { variantKey: true, kind: true, code: true, price: true },
  });
  const catalogMap = new Map<string, { code: string | null; price: number | null }>();
  for (const r of catalogRows) {
    catalogMap.set(`${r.variantKey}|${r.kind}`, {
      code: r.code?.trim() || null,
      price: r.price !== null ? Number(r.price) : null,
    });
  }

  // Spajanje po šifri+vrsti+cijeni (iste varijante s istom šifrom = jedan red).
  type ServiceLineAgg = {
    kind: ServiceKindValue;
    code: string;
    price: number;
    label: string;
    quantity: number;
    sortConstruction: number;
    sortCapacity: number;
  };
  const serviceLines = new Map<string, ServiceLineAgg>();

  for (const b of buckets.values()) {
    const cat = catalogMap.get(`${b.variantKey}|${b.kind}`);
    const kindText = serviceKindLabel(b.kind);
    if (!cat?.code) {
      problems.push(`Usluga „${kindText} ${b.label}” nema šifru u šifrarniku (Postavke → Usluge).`);
      continue;
    }
    if (cat.price === null) {
      problems.push(`Usluga „${kindText} ${b.label}” nema cijenu u šifrarniku (Postavke → Usluge).`);
      continue;
    }
    const key = `${b.kind}|${cat.code}|${cat.price}`;
    const existing = serviceLines.get(key);
    if (existing) {
      existing.quantity += b.count;
      // Kod spojenih varijanti zadrži kraću (opću) oznaku sortiranja.
      existing.sortConstruction = Math.min(existing.sortConstruction, b.sortConstruction);
    } else {
      serviceLines.set(key, {
        kind: b.kind,
        code: cat.code,
        price: cat.price,
        label: b.label,
        quantity: b.count,
        sortConstruction: b.sortConstruction,
        sortCapacity: b.sortCapacity,
      });
    }
  }

  // --- Dodatne (custom) usluge ---
  type CustomAgg = { name: string; code: string | null; price: number | null; quantity: number };
  const customById = new Map<string, CustomAgg>();
  for (const it of realItems) {
    for (const cs of it.customServices ?? []) {
      const csv = cs.customService;
      if (!csv) continue;
      const existing = customById.get(csv.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        customById.set(csv.id, {
          name: csv.name,
          code: csv.code?.trim() || null,
          price: csv.price !== null ? Number(csv.price) : null,
          quantity: 1,
        });
      }
    }
  }
  for (const c of customById.values()) {
    if (!c.code) problems.push(`Dodatna usluga „${c.name}” nema šifru (Postavke → Usluge).`);
    if (c.price === null) problems.push(`Dodatna usluga „${c.name}” nema cijenu (Postavke → Usluge).`);
  }

  // --- Naljepnice: komplet po pregledanom aparatu ---
  const kompletQty = realItems.length;
  if (!settings.labelKompletCode) {
    problems.push("Nedostaje šifra za „Komplet naljepnica” (Postavke → Integracije → e-računi).");
  }
  if (settings.labelKompletPrice === null) {
    problems.push("Nedostaje cijena za „Komplet naljepnica” (Postavke → Integracije → e-računi).");
  }

  // --- Rezervni dijelovi (snapshot s naloga) ---
  type PartAgg = {
    code: string | null;
    name: string;
    unit: PartUnit;
    price: number | null;
    quantity: number;
  };
  const partsByKey = new Map<string, PartAgg>();
  for (const it of realItems) {
    for (const p of it.parts ?? []) {
      const name = (p.snapshotName ?? p.part.name).trim();
      const code = (p.snapshotCode ?? p.part.code).trim() || null;
      const price = p.unitPrice !== null ? Number(p.unitPrice) : null;
      const unit: PartUnit = p.snapshotUnit ?? p.part.unit ?? PartUnit.KOM;
      const key = `${code ?? name}|${price ?? "x"}|${unit}`;
      const existing = partsByKey.get(key);
      if (existing) {
        existing.quantity += p.quantity;
      } else {
        partsByKey.set(key, { code, name, unit, price, quantity: p.quantity });
      }
    }
    if ((it.partsText ?? "").trim() && (it.parts ?? []).length === 0) {
      warnings.push(
        `Dio upisan slobodnim tekstom („${it.partsText!.trim()}”) nije uključen u račun — nema šifru ni cijenu.`,
      );
    }
  }
  for (const p of partsByKey.values()) {
    if (!p.code) problems.push(`Dio „${p.name}” nema šifru (Postavke → Rezervni dijelovi).`);
    if (p.price === null) problems.push(`Dio „${p.name}” nema cijenu (Postavke → Rezervni dijelovi).`);
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  // --- Sastavljanje redoslijedom: periodični → komplet → unutarnji → custom → dijelovi ---
  const discServices = pct(order.customer.discountServicesPct);
  const discLabels = pct(order.customer.discountLabelsPct);
  const discParts = pct(order.customer.discountPartsPct);

  const sortedServices = Array.from(serviceLines.values()).sort(
    (a, b) => a.sortConstruction - b.sortConstruction || a.sortCapacity - b.sortCapacity,
  );

  const lines: InvoiceLine[] = [];

  for (const s of sortedServices.filter((s) => s.kind === "PERIODIC")) {
    lines.push({
      code: s.code,
      description: `${serviceKindLabel(s.kind)} ${s.label} aparata`,
      quantity: s.quantity,
      unit: "kom",
      netPrice: s.price,
      discountPercentage: discServices,
    });
  }

  lines.push({
    code: settings.labelKompletCode,
    description: settings.labelKompletName,
    quantity: kompletQty,
    unit: "kom",
    netPrice: settings.labelKompletPrice!,
    discountPercentage: discLabels,
  });

  for (const s of sortedServices.filter((s) => s.kind === "INTERNAL")) {
    lines.push({
      code: s.code,
      description: `${serviceKindLabel(s.kind)} ${s.label} aparata`,
      quantity: s.quantity,
      unit: "kom",
      netPrice: s.price,
      discountPercentage: discServices,
    });
  }

  for (const c of [...customById.values()].sort((a, b) => a.name.localeCompare(b.name, "hr"))) {
    lines.push({
      code: c.code,
      description: c.name,
      quantity: c.quantity,
      unit: "kom",
      netPrice: c.price!,
      discountPercentage: discServices,
    });
  }

  for (const p of [...partsByKey.values()].sort((a, b) => a.name.localeCompare(b.name, "hr"))) {
    lines.push({
      code: p.code,
      description: p.name,
      quantity: p.quantity,
      unit: formatPartUnit(p.unit),
      netPrice: p.price!,
      discountPercentage: discParts,
    });
  }

  const deliveryNote = await getActiveDeliveryNote(prisma, companyId, order.id);
  const remarkParts = [`Radni nalog: ${order.orderNumber}`];
  if (deliveryNote) remarkParts.push(`Otpremnica: ${deliveryNote.number}`);

  return {
    ok: true,
    lines,
    warnings,
    buyer: {
      name: order.customer.name,
      oib: order.customer.oib,
      street: order.customer.street,
      postalCode: order.customer.postalCode,
      city: order.customer.city,
      email: order.customer.email,
      phone: order.customer.phone,
    },
    dateOfSupply: order.lockedAt ?? new Date(),
    remark: remarkParts.join("  ·  "),
  };
}
