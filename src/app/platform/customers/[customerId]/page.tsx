import Link from "next/link";
import { notFound } from "next/navigation";
import type { WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { customerDisplayName } from "@/lib/customerDisplay";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";

export const dynamic = "force-dynamic";

export default async function PlatformCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const ps = await requirePlatformSession();
  const { customerId } = await params;

  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      company: { select: { id: true, name: true, serviceCode: true } },
      _count: { select: { workOrders: true, emailLogs: true, backlogSnoozes: true } },
    },
  });
  if (!c) notFound();

  const [distinctExtinguishers, recentWorkOrders, siblingCustomers, ownerOrg] = await Promise.all([
    prisma.workOrderItem.findMany({
      where: { workOrder: { customerId: c.id } },
      select: { extinguisherId: true },
      distinct: ["extinguisherId"],
    }),
    prisma.workOrder.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        lockedAt: true,
        finishedAt: true,
        deliveryNotes: {
          where: { supersededAt: null, pdfStoragePath: { not: null } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    // Isti OIB kod drugih servisera — zapisi ostaju odvojeni (kontakti/odjeli),
    // ali vendor treba vidjeti da postoje povezani zapisi.
    prisma.customer.findMany({
      where: {
        oib: c.oib,
        id: { not: c.id },
        deletedAt: null,
      },
      orderBy: [{ company: { serviceCode: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        deletedAt: true,
        company: { select: { id: true, name: true, serviceCode: true } },
        ownerLink: { select: { status: true, hiddenByVendorAt: true } },
        _count: { select: { workOrders: true } },
      },
    }),
    prisma.ownerOrg.findUnique({
      where: { oib: c.oib },
      select: { id: true, name: true },
    }),
  ]);
  const extinguisherCount = distinctExtinguishers.filter((x) => !!x.extinguisherId).length;

  await prisma.auditLog.create({
    data: {
      companyId: c.companyId,
      actorType: "PLATFORM",
      action: "platform.customer.view",
      entity: "Customer",
      entityId: c.id,
      meta: { name: c.name, oib: c.oib, by: ps.platformUserId },
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{customerDisplayName(c)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tvrtka:{" "}
            <Link href={`/platform/companies/${c.company.id}`} className="text-blue-700 hover:underline">
              {c.company.serviceCode} · {c.company.name}
            </Link>
          </p>
        </div>
        <Link className="btn btn-outline px-3" href="/platform/customers">
          ← Natrag na pretragu
        </Link>
      </div>

      {siblingCustomers.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-950">
                Isti OIB kod {siblingCustomers.length === 1 ? "još jednog servisera" : `još ${siblingCustomers.length} servisera`}
              </div>
              <p className="mt-1 text-xs text-amber-900/80">
                Zapisi kupaca ostaju odvojeni po serviseru (kontakti, odjeli, nalozi). Ovo je samo
                informacija da isti vlasnik (OIB {c.oib}) postoji i drugdje.
              </p>
            </div>
            {ownerOrg ? (
              <Link
                href={`/platform/owners/${ownerOrg.id}`}
                className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                Portal vlasnika →
              </Link>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {siblingCustomers.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white/70 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/platform/companies/${s.company.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {s.company.serviceCode} · {s.company.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {customerDisplayName(s)} · {s._count.workOrders}{" "}
                    {s._count.workOrders === 1 ? "nalog" : "naloga"}
                    {s.ownerLink?.status ? (
                      <>
                        {" "}
                        · portal: {s.ownerLink.status}
                        {s.ownerLink.hiddenByVendorAt ? " (skriven)" : ""}
                      </>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/platform/customers/${s.id}`}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
                >
                  Otvori zapis →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <Field label="Pun naziv" value={c.name} />
        <Field label="Skraćeni naziv" value={c.shortName ?? "—"} />
        <Field label="OIB" value={c.oib} mono />
        <Field label="Tip" value={c.type} />
        <Field label="Adresa" value={c.address || "—"} />
        <Field label="Grad" value={[c.postalCode, c.city].filter(Boolean).join(" ") || "—"} />
        <Field label="Email" value={c.email ?? "—"} />
        <Field label="Telefon" value={c.phone ?? "—"} />
        <Field label="Auto-notify" value={c.autoNotify ? "Da" : "Ne"} />
        <Field label="Status" value={c.deletedAt ? `Obrisan ${c.deletedAt.toLocaleString("hr-HR")}` : "Aktivan"} />
      </section>

      <section className="surface grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Aparata" value={extinguisherCount} />
        <Stat label="Naloga" value={c._count.workOrders} />
        <Stat label="Email logova" value={c._count.emailLogs} />
        <Stat label="Backlog snooze" value={c._count.backlogSnoozes} />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold">Zadnjih 10 radnih naloga</div>
          <div className="text-xs text-slate-500">
            samo kod {c.company.serviceCode} · {c.company.name}
          </div>
        </div>
        {recentWorkOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nema radnih naloga za ovog kupca.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Šifra</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Kreiran</th>
                  <th className="px-4 py-2">Zaključan</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs">{wo.orderNumber}</td>
                    <td className="px-4 py-2.5">
                      <WorkOrderStatusBadge
                        status={wo.status as WorkOrderStatus}
                        hasShippedDeliveryNote={wo.deliveryNotes.length > 0}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                      {wo.createdAt.toLocaleString("hr-HR")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                      {wo.lockedAt ? wo.lockedAt.toLocaleString("hr-HR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Read-only pregled. Pristupi ovom kupcu se audit-loggiraju i vidljivi su u
        <Link className="ml-1 text-blue-700 hover:underline" href="/platform/audit">/platform/audit</Link>.
      </p>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={["mt-1 text-sm font-medium text-slate-800", mono ? "font-mono" : ""].join(" ")}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
