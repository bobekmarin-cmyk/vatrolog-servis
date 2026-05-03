import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";
import { customerDisplayName } from "@/lib/customerDisplay";

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

  const [distinctExtinguishers, lastWorkOrder] = await Promise.all([
    prisma.workOrderItem.findMany({
      where: { workOrder: { customerId: c.id } },
      select: { extinguisherId: true },
      distinct: ["extinguisherId"],
    }),
    prisma.workOrder.findFirst({
      where: { customerId: c.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, status: true, createdAt: true, lockedAt: true },
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

      {lastWorkOrder && (
        <section className="surface p-4">
          <div className="text-sm font-semibold">Zadnji radni nalog</div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Šifra</dt>
              <dd className="font-mono">{lastWorkOrder.orderNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>{lastWorkOrder.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Kreiran</dt>
              <dd>{lastWorkOrder.createdAt.toLocaleString("hr-HR")}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Zaključan</dt>
              <dd>{lastWorkOrder.lockedAt ? lastWorkOrder.lockedAt.toLocaleString("hr-HR") : "—"}</dd>
            </div>
          </dl>
        </section>
      )}

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
