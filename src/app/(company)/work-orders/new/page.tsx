import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReceiptCustomerDepartmentPicker from "@/components/ReceiptCustomerDepartmentPicker";
import WorkOrderLocationDeliveryPicker from "@/components/WorkOrderLocationDeliveryPicker";
import ReceiptDatesFields from "@/components/ReceiptDatesFields";
import ReceiptQuantityField from "@/components/ReceiptQuantityField";
import ReceiptFormClient from "@/components/ReceiptFormClient";

function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; created?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const preselectId = (sp.customerId ?? "").trim();
  const justCreated = sp.created === "1";

  let defaultCustomer:
    | {
        id: string;
        name: string;
        shortName: string | null;
        oib: string;
        address: string;
        contactPerson: string | null;
        phone: string | null;
      }
    | null = null;

  if (preselectId) {
    const c = await prisma.customer.findFirst({
      where: { id: preselectId, companyId: session.companyId },
      select: {
        id: true,
        name: true,
        shortName: true,
        oib: true,
        address: true,
        contactPerson: true,
        phone: true,
      },
    });
    if (c) defaultCustomer = c;
  }

  const locations = await prisma.companyServiceLocation.findMany({
    where: {
      companyId: session.companyId,
      active: true,
      accounts: { some: { role: "WORKSHOP", active: true } },
    },
    orderBy: [{ kind: "asc" }, { ordinal: "asc" }],
    select: { id: true, kind: true, label: true },
  });

  const pickerLocations = locations.map((l) => ({
    id: l.id,
    kind: l.kind as "STATIONARY" | "VEHICLE",
    label: l.label,
  }));

  const isAdmin = session.role === "ADMIN";
  let initialLocationId = pickerLocations[0]?.id ?? "";
  if (!isAdmin && session.serviceLocationId) {
    if (pickerLocations.some((l) => l.id === session.serviceLocationId)) {
      initialLocationId = session.serviceLocationId;
    }
  }

  const workshopLocationMissing =
    session.role === "WORKSHOP" &&
    !!session.serviceLocationId &&
    !pickerLocations.some((l) => l.id === session.serviceLocationId);

  const now = new Date();
  const defaultReceivedAt = toInputDate(now);
  const defaultDueAt = toInputDate(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000));
  const formId = "work-order-form";

  return (
    <main className="max-w-none space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Novi radni nalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Kreiraj nalog s kupcem i brojem aparata. Stavke se popunjavaju na detalju naloga.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary px-4" type="submit" form={formId}>
            Spremi
          </button>
          <Link className="btn btn-outline px-4" href="/work-orders">
            Odustani
          </Link>
        </div>
      </div>

      {workshopLocationMissing ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Vaša servisna lokacija nije u aktivnoj listi (vjerojatno deaktivirana). Kontaktirajte
          podršku — bez toga radni nalozi za vašu lokaciju nisu dostupni.
        </div>
      ) : null}

      {justCreated && defaultCustomer ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Kupac <strong>{defaultCustomer.shortName || defaultCustomer.name}</strong> je uspješno
          kreiran i automatski odabran. Nastavi popunjavati radni nalog.
        </div>
      ) : null}

      <ReceiptFormClient action="/api/work-orders/create" formId={formId} className="surface p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="table-muted">Broj naloga</div>
              <div className="table-strong">Generira se nakon spremanja</div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-900">Odabir kupca</div>
                  <span className="badge badge-tight badge-info">Obavezno</span>
                </div>
                <Link
                  className="btn btn-outline px-3 py-1 text-xs"
                  href="/customers/new?from=work-order-new"
                >
                  + Novi kupac
                </Link>
              </div>
              <ReceiptCustomerDepartmentPicker defaultCustomer={defaultCustomer} />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <WorkOrderLocationDeliveryPicker
                  locations={pickerLocations}
                  sessionLocationId={
                    session.role === "ADMIN" ? null : session.serviceLocationId ?? null
                  }
                  isAdmin={isAdmin}
                  initialLocationId={initialLocationId}
                />
                <ReceiptDatesFields defaultReceivedAt={defaultReceivedAt} defaultDueAt={defaultDueAt} />
              </div>
              <div className="space-y-4">
                <ReceiptQuantityField defaultValue={1} min={0} />
                <div>
                  <label className="label">Napomena</label>
                  <textarea name="note" className="textarea min-h-[140px]" rows={6} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ReceiptFormClient>
    </main>
  );
}
