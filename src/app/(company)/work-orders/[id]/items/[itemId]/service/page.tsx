import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalInspectionSection from "@/components/InternalInspectionSection";
import WorkOrderPartsPicker from "@/components/WorkOrderPartsPicker";
import WorkOrderCustomServicesPicker, {
  type CustomServiceLite,
} from "@/components/WorkOrderCustomServicesPicker";
import ServiceFormWithScrap from "@/components/ServiceFormWithScrap";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { todayStart } from "@/lib/servicerStatus";
import {
  computeUpInterval,
  computeFirstUpYear,
  computeNextUpYear,
} from "@/lib/internalUpRule";

export default async function ServiceItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id, itemId } = await params;

  const [order, item, servicers] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { id, companyId: session.companyId },
      include: { customer: true },
    }),
    prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: {
        extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
        servicer: true,
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: session.companyId,
        active: true,
        role: "SERVISER",
        activatedAt: { gte: todayStart() },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  if (!order) notFound();
  if (!item) notFound();
  if (item.workOrderId !== order.id) notFound();
  if (item.companyId !== session.companyId) notFound();

  if (order.status === "LOCKED") {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Nalog je zaključan</h1>
        <p className="text-gray-600">Nije moguće mijenjati podatke.</p>
        <Link className="inline-block underline" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  const ex = item.extinguisher;
  const serviceYear = (order.receivedAt ?? new Date()).getFullYear();

  if (!ex) {
    return (
      <main className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">Stavka nije popunjena</h1>
        <p className="text-gray-600">Prvo klikni “Popuni” da se unesu podaci aparata.</p>
        <Link className="inline-block underline" href={`/work-orders/${order.id}`}>
          ← Povratak na Servisni nalog
        </Link>
      </main>
    );
  }

  // Globalni dijelovi filtrirani po proizvođaču + tipu aparata
  const typeLabel = ex.type ? formatExtinguisherTypeName(ex.type) : "—";
  const [commonParts, otherParts, selectedRows, customServicesDb, selectedCustomRows] =
    await Promise.all([
    prisma.part.findMany({
      where: {
        active: true,
        common: true,
        manufacturerId: ex.manufacturerId,
        types: { some: { extinguisherTypeId: ex.extinguisherTypeId } },
        OR: [{ companyId: null }, { companyId: session.companyId }],
        NOT: { stocks: { some: { companyId: session.companyId, hidden: true } } },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.part.findMany({
      where: {
        active: true,
        common: false,
        manufacturerId: ex.manufacturerId,
        types: { some: { extinguisherTypeId: ex.extinguisherTypeId } },
        OR: [{ companyId: null }, { companyId: session.companyId }],
        NOT: { stocks: { some: { companyId: session.companyId, hidden: true } } },
      },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.workOrderItemPart.findMany({
      where: { workOrderItemId: item.id, companyId: session.companyId },
      include: { part: { select: { id: true, code: true, name: true, active: true } } },
    }),
    prisma.companyCustomService.findMany({
      where: { companyId: session.companyId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, price: true },
    }),
    prisma.workOrderItemCustomService.findMany({
      where: { workOrderItemId: item.id, companyId: session.companyId },
      include: {
        customService: {
          select: {
            id: true,
            name: true,
            code: true,
            price: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    }),
  ]);

  const initialSelectedIds = Array.from(new Set(selectedRows.map((r) => r.partId)));

  const initialSelectedCustomServiceIds = Array.from(
    new Set(selectedCustomRows.map((r) => r.customServiceId)),
  );
  const customServicesAvailable: CustomServiceLite[] = customServicesDb.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code ?? null,
    price: s.price ? Number(s.price) : null,
  }));
  // Ako je već povezana usluga u međuvremenu deaktivirana ili soft-deletana,
  // uključi je ipak u dropdown (read-only seed) kako se ne bi izgubila iz selekcije.
  for (const r of selectedCustomRows) {
    const cs = r.customService;
    if (!cs) continue;
    const isUnavailable = !cs.isActive || !!cs.deletedAt;
    if (isUnavailable && !customServicesAvailable.some((s) => s.id === r.customServiceId)) {
      customServicesAvailable.push({
        id: r.customServiceId,
        name: cs.name,
        code: cs.code ?? null,
        price: cs.price ? Number(cs.price) : null,
      });
    }
  }
  const extraSelected = selectedRows
    .map((r) => r.part)
    .filter((p) => !!p && !p.active)
    .map((p) => ({ id: p.id, code: p.code, name: p.name }));

  const upRule = ex.type
    ? computeUpInterval({
        extinguisherType: {
          internalRuleMode: ex.type.internalRuleMode,
          internalIntervalYears: ex.type.internalIntervalYears,
          internalOldThresholdYears: ex.type.internalOldThresholdYears,
          internalOldIntervalYears: ex.type.internalOldIntervalYears,
          internalYoungIntervalYears: ex.type.internalYoungIntervalYears,
        },
        agentCode: ex.type.agent?.code ?? null,
        productionYear: ex.productionYear,
        baseYear: serviceYear,
      })
    : ({
        years: 4,
        ruleLabel: "Fallback fiksni interval 4 god (aparat nema definirani tip)",
        source: "FALLBACK" as const,
        origin: "fallback" as const,
      });
  const computedFirstUpYear = computeFirstUpYear(ex.productionYear, upRule.years);
  const computedNextIfDone = computeNextUpYear(serviceYear, upRule.years);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Servisiraj aparat</h1>
        <p className="mt-1 text-sm text-gray-600">
          Nalog: <span className="font-medium">{order.orderNumber}</span> — {customerDisplayName(order.customer)}
        </p>
        <div className="mt-2">
          <Link className="btn btn-outline px-3 py-1 text-xs" href={`/extinguishers/${ex.id}/qr-label`} target="_blank" rel="noreferrer">
            Ispiši QR naljepnicu
          </Link>
        </div>
      </div>

      <ServiceFormWithScrap
        action={`/api/work-orders/${order.id}/items/${item.id}/service`}
        resetAction={`/api/work-orders/${order.id}/items/${item.id}/reset`}
        canReset={!!(item.periodicDone || item.servicedAt || item.internalDone)}
        workOrderId={order.id}
        leftContent={
          <>
            <div>
              <div className="text-sm font-semibold">Aparat</div>
              <div className="mt-2 space-y-1">
                <div className="text-sm font-medium text-slate-900">
                  {ex.type ? formatExtinguisherTypeName(ex.type) : "-"}{" "}
                  <span className="text-slate-500">·</span>{" "}
                  {displayManufacturer(ex.manufacturer)}
                </div>
                <div className="font-mono text-base font-semibold text-slate-900">
                  {ex.serialNumber}/{ex.productionYear}
                </div>
              </div>
            </div>

            <div className="h-px bg-black/10" />

            <div>
              <label className="label">Broj naljepnice (unikatan)</label>
              <input name="labelNumber" className="input" defaultValue={item.labelNumber ?? ""} required />
              <p className="help">Naljepnica mora biti jedinstvena kroz cijelu bazu.</p>
            </div>

            <div>
              <label className="label">Serviser</label>
              {servicers.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nema aktivnih servisera za danas. Aktivirajte servisere u gornjem izborniku.
                </div>
              ) : (
                <select name="servicerId" className="select" defaultValue={item.servicerId ?? ""} required>
                  <option value="">-- odaberi --</option>
                  {servicers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="label">Lokacija / napomena (na upisniku)</label>
              <input name="serviceLocationText" className="input" defaultValue={item.serviceLocationText ?? ""} />
            </div>
          </>
        }
        rightContent={
          <>
            <InternalInspectionSection
              agentCode={ex.type?.agent?.code ?? null}
              manufacturerName={displayManufacturer(ex.manufacturer)}
              productionYear={ex.productionYear}
              serviceYear={serviceYear}
              existingNextInternalYear={ex.nextInternalDue ? ex.nextInternalDue.getFullYear() : null}
              defaultInternalDone={!!item.internalDone}
              intervalYears={upRule.years}
              ruleLabel={upRule.ruleLabel}
              computedFirstUpYear={computedFirstUpYear}
              computedNextIfDone={computedNextIfDone}
            />

            <WorkOrderPartsPicker
              kind={typeLabel}
              commonParts={commonParts}
              otherParts={[...otherParts, ...extraSelected]}
              initialSelectedIds={initialSelectedIds}
            />

            <WorkOrderCustomServicesPicker
              available={customServicesAvailable}
              initialSelectedIds={initialSelectedCustomServiceIds}
            />
          </>
        }
      />
    </main>
  );
}

