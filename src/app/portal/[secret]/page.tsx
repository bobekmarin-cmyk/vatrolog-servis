import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import VatroLogLogo from "@/components/VatroLogLogo";
import { displayManufacturer } from "@/lib/manufacturerDisplay";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ secret: string }> };

export default async function CustomerPortalPage({ params }: PageProps) {
  const { secret } = await params;
  if (!secret || secret.length < 20) notFound();

  const customer = await prisma.customer.findFirst({
    where: { portalSecret: secret, deletedAt: null },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          blocked: true,
          activeUntil: true,
        },
      },
    },
  });
  if (!customer || customer.company.deletedAt) notFound();
  if (customer.company.blocked) notFound();
  if (customer.company.activeUntil && customer.company.activeUntil < new Date()) notFound();

  const now = new Date();
  const inOneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Aparati ovog kupca: svi oni za koje postoji bar jedna stavka radnog naloga
  // pod ovim kupcem. Dohvaćamo distinct extinguisherId preko work-order stavki.
  const itemsForCustomer = await prisma.workOrderItem.findMany({
    where: {
      companyId: customer.companyId,
      workOrder: { customerId: customer.id },
    },
    select: { extinguisherId: true },
    distinct: ["extinguisherId"],
    take: 1000,
  });
  const extIds = itemsForCustomer.map((x) => x.extinguisherId).filter((x): x is string => !!x);

  const extinguishers = extIds.length
    ? await prisma.extinguisher.findMany({
        where: {
          id: { in: extIds },
          companyId: customer.companyId,
          deletedAt: null,
        },
        orderBy: [{ nextPeriodicDue: "asc" }, { internalCode: "asc" }],
        include: {
          manufacturer: { select: { name: true, displayName: true } },
          type: { select: { code: true } },
        },
        take: 500,
      })
    : [];

  const recentWorkOrders = await prisma.workOrder.findMany({
    where: { companyId: customer.companyId, customerId: customer.id },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      receivedAt: true,
      finishedAt: true,
      status: true,
      items: { select: { id: true, extinguisherId: true, servicedAt: true } },
    },
    take: 10,
  });

  const overdue = extinguishers.filter((e) => e.nextPeriodicDue && e.nextPeriodicDue < now);
  const dueSoon = extinguishers.filter(
    (e) => e.nextPeriodicDue && e.nextPeriodicDue >= now && e.nextPeriodicDue <= inOneMonth,
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <VatroLogLogo size="md" />
          <div className="text-right text-sm text-slate-600">
            <div className="font-semibold text-slate-900">{customer.company.name}</div>
            <div>Servisni portal</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 py-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold">{customer.shortName ?? customer.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            OIB: <span className="font-mono">{customer.oib}</span>
            {customer.address ? <> · {customer.address}</> : null}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Ukupno aparata" value={extinguishers.length} tone="neutral" />
          <StatCard label="Istekao rok" value={overdue.length} tone={overdue.length > 0 ? "danger" : "success"} />
          <StatCard label="Ističe ovaj mjesec" value={dueSoon.length} tone={dueSoon.length > 0 ? "warning" : "success"} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Popis aparata</h2>
            <div className="text-xs text-slate-500">Prikaz je read-only.</div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Oznaka</th>
                  <th className="px-3 py-2">Tip</th>
                  <th className="px-3 py-2">Proizvođač</th>
                  <th className="px-3 py-2">Serijski br.</th>
                  <th className="px-3 py-2">Idući pregled</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {extinguishers.map((e) => {
                  const due = e.nextPeriodicDue;
                  const isOverdue = due && due < now;
                  const isSoon = due && !isOverdue && due <= inOneMonth;
                  return (
                    <tr key={e.id} className={isOverdue ? "bg-red-50" : isSoon ? "bg-amber-50" : ""}>
                      <td className="px-3 py-2 font-medium">{e.internalCode}</td>
                      <td className="px-3 py-2">{e.type?.code ?? "—"}</td>
                      <td className="px-3 py-2">{displayManufacturer(e.manufacturer)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{e.serialNumber ?? "—"}</td>
                      <td className="px-3 py-2">
                        {due ? due.toLocaleDateString("hr-HR") : "—"}
                        {isOverdue ? <span className="ml-1 text-xs font-semibold text-red-600">istekao</span> : null}
                        {isSoon ? <span className="ml-1 text-xs font-semibold text-amber-700">uskoro</span> : null}
                      </td>
                    </tr>
                  );
                })}
                {extinguishers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                      Nema evidentiranih aparata.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Zadnji servisni nalozi</h2>
            <div className="text-xs text-slate-500">Pregled povijesti</div>
          </header>
          <div className="divide-y divide-slate-200">
            {recentWorkOrders.map((order) => (
              <div key={order.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="font-semibold text-slate-900">{order.orderNumber}</div>
                  <div className="text-sm text-slate-600">
                    Zaprimljeno {order.receivedAt.toLocaleDateString("hr-HR")}
                    {order.finishedAt ? ` · završeno ${order.finishedAt.toLocaleDateString("hr-HR")}` : ""}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  {order.items.filter((item) => item.servicedAt).length}/{order.items.length} stavki servisirano
                </div>
              </div>
            ))}
            {recentWorkOrders.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">Još nema servisnih naloga.</div>
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500">
          Poveznica je generirana za kupca i može se povući u svakom trenutku.
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
