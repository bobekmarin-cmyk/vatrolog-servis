import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { customerDisplayName } from "@/lib/customerDisplay";
import { displayManufacturer } from "@/lib/manufacturerDisplay";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { formatDateDdMmYyyy } from "@/lib/dateFormat";
import { calcValidUntil } from "@/lib/validity";
import { resolveExtStatus } from "@/lib/extinguisherStatus";
import CustomerExtinguisherTable from "@/components/CustomerExtinguisherTable";

export default async function CustomerAnalyticsPage({ params }: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { customerId } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
  });
  if (!customer) notFound();

  const items = await prisma.workOrderItem.findMany({
    where: {
      workOrder: { customerId, companyId: session.companyId },
      extinguisherId: { not: null },
      servicedAt: { not: null },
    },
    orderBy: { servicedAt: "desc" },
    include: {
      extinguisher: { include: { manufacturer: true, type: { include: { agent: true, construction: true } } } },
      workOrder: { select: { id: true, orderNumber: true } },
    },
  });

  const extMap = new Map<string, typeof items[number]>();
  for (const item of items) {
    if (!item.extinguisherId) continue;
    if (!extMap.has(item.extinguisherId)) {
      extMap.set(item.extinguisherId, item);
    }
  }

  const uniqueItems = Array.from(extMap.values());

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const totalCount = uniqueItems.length;
  let validCount = 0;
  let expiredCount = 0;
  let scrappedCount = 0;
  let due30Count = 0;
  let due90Count = 0;

  type RowData = {
    id: string;
    internalCode: string;
    manufacturer: string;
    typeName: string;
    serial: string;
    year: number;
    labelNumber: string;
    servicedAt: string;
    ppDue: string;
    ppStatus: "valid" | "expired" | "soon" | "none";
    upDue: string;
    upStatus: "valid" | "expired" | "soon" | "none";
    status: "serviced" | "expired" | "scrapped";
    statusLabel: string;
    workOrderId: string;
    orderNumber: string;
  };

  function dueStat(d: Date | null | undefined): "valid" | "expired" | "soon" | "none" {
    if (!d) return "none";
    if (d < now) return "expired";
    if (d < in30) return "soon";
    return "valid";
  }

  const STATUS_LABELS: Record<string, string> = {
    serviced: "Servisiran",
    expired: "Istekao servis",
    scrapped: "Rashodovan",
  };

  const rows: RowData[] = [];
  for (const item of uniqueItems) {
    const ex = item.extinguisher!;
    const isScrapped = ex.status === "SCRAPPED" || !!ex.scrapReason || !!ex.scrappedAt;

    const pp = item.nextPeriodicDue ?? ex.nextPeriodicDue ?? (item.servicedAt ? calcValidUntil(item.servicedAt) : null);
    const up = item.nextInternalDue ?? ex.nextInternalDue;

    if (isScrapped) {
      scrappedCount++;
    } else if (!pp || pp < now) {
      expiredCount++;
    } else {
      validCount++;
      if (pp < in30) due30Count++;
      if (pp < in90) due90Count++;
    }

    const status = resolveExtStatus(isScrapped, !pp || pp < now);

    rows.push({
      id: ex.id,
      internalCode: ex.internalCode,
      manufacturer: displayManufacturer(ex.manufacturer),
      typeName: ex.type ? formatExtinguisherTypeName(ex.type) : "-",
      serial: ex.serialNumber,
      year: ex.productionYear,
      labelNumber: item.labelNumber ?? "-",
      status,
      statusLabel: STATUS_LABELS[status] ?? status,
      servicedAt: formatDateDdMmYyyy(item.servicedAt) ?? "-",
      ppDue: formatDateDdMmYyyy(pp) ?? "-",
      ppStatus: dueStat(pp),
      upDue: formatDateDdMmYyyy(up) ?? "-",
      upStatus: dueStat(up),
      workOrderId: item.workOrder.id,
      orderNumber: item.workOrder.orderNumber,
    });
  }

  rows.sort((a, b) => {
    const statusOrder = { scrapped: 9, expired: 0, soon: 1, none: 2, valid: 3 };
    if (a.status === "scrapped" && b.status !== "scrapped") return 1;
    if (b.status === "scrapped" && a.status !== "scrapped") return -1;
    return (statusOrder[a.ppStatus] ?? 9) - (statusOrder[b.ppStatus] ?? 9);
  });

  return (
    <main className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{customerDisplayName(customer)}</h1>
          <p className="text-sm text-slate-500">Analitika aparata</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-4" href={`/customers/${customerId}`}>Uredi kupca</Link>
          <Link className="btn btn-outline px-4" href="/customers">← Kupci</Link>
        </div>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="surface p-4 text-center">
          <div className="text-xs text-slate-500">Ukupno aparata</div>
          <div className="text-2xl font-bold tabular-nums text-slate-800">{totalCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-emerald-600">Ispravan servis</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-700">{validCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-amber-600">Istekao servis</div>
          <div className="text-2xl font-bold tabular-nums text-amber-700">{expiredCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-rose-600">Rashodovano</div>
          <div className="text-2xl font-bold tabular-nums text-rose-700">{scrappedCount}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-orange-600">Dospijeva (30d)</div>
          <div className="text-2xl font-bold tabular-nums text-orange-700">{due30Count}</div>
        </div>
        <div className="surface p-4 text-center">
          <div className="text-xs text-orange-600">Dospijeva (90d)</div>
          <div className="text-2xl font-bold tabular-nums text-orange-700">{due90Count}</div>
        </div>
      </section>

      <CustomerExtinguisherTable rows={rows} />
    </main>
  );
}
