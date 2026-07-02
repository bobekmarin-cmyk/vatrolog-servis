import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import EditCustomerFormWithLookup from "@/components/EditCustomerFormWithLookup";
import CustomerPortalAccountsCard from "./CustomerPortalAccountsCard";
import { findExistingPortalOwnerByOib } from "@/lib/ownerSharing";
import { getCustomerPortalStatus } from "@/lib/customerPortalAccounts";

export default async function CustomerEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { customerId } = await params;
  const { error, success } = await searchParams;
  if (!customerId) notFound();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    include: {
      departments: { orderBy: { name: "asc" } },
      ownerLink: { select: { status: true, invitedEmail: true, acceptedAt: true, invitedAt: true } },
    },
  });

  if (!customer) notFound();

  // Cross-serviser: ako ovaj kupac (po OIB-u) već ima aktivan portal kod drugog
  // servisera, a kod nas još nije aktivan, ponudi dijeljenje umjesto pozivnice.
  const existingPortalForOib =
    customer.ownerLink?.status === "ACTIVE"
      ? false
      : !!(await findExistingPortalOwnerByOib(customer.oib, session.companyId));

  const portalStatus = await getCustomerPortalStatus(customer.oib, customer.id);

  return (
    <main className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{customer.shortName ?? customer.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            OIB: <span className="font-mono">{customer.oib}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-outline px-4" href={`/customers/${customerId}/analytics`}>
            Analitika
          </Link>
          <Link className="btn btn-outline px-4" href="/customers">
            ← Kupci
          </Link>
        </div>
      </div>

      {/* Uredi kupca */}
      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Podaci kupca</h2>
        </div>
        <div className="surface-body">
          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}
          {success ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Kupac uspješno spremljen.
            </div>
          ) : null}
          <EditCustomerFormWithLookup
            customerId={customer.id}
            initial={{
              name: customer.name,
              shortName: customer.shortName,
              oib: customer.oib,
              street: customer.street,
              postalCode: customer.postalCode,
              city: customer.city,
              contactPerson: customer.contactPerson,
              phone: customer.phone,
              email: customer.email,
              note: customer.note,
              autoNotify: customer.autoNotify,
              discountServicesPct:
                customer.discountServicesPct != null ? String(customer.discountServicesPct) : "",
              discountLabelsPct:
                customer.discountLabelsPct != null ? String(customer.discountLabelsPct) : "",
              discountPartsPct:
                customer.discountPartsPct != null ? String(customer.discountPartsPct) : "",
            }}
          />
        </div>
      </section>

      {/* Odjeljenja */}
      <section className="surface">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50">
            <span>Odjeljenja (opcionalno)</span>
            <span className="text-slate-500 group-open:hidden">▸</span>
            <span className="hidden text-slate-500 group-open:inline">▾</span>
          </summary>
          <div className="surface-body space-y-4 border-t border-black/10">
            <div className="subtle">Ukupno: {customer.departments.length}</div>
            {/* Add */}
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" action={`/api/customers/${customer.id}/departments/create`} method="post">
              <div className="sm:col-span-1">
                <label className="label">Naziv odjela</label>
                <input name="name" className="input" placeholder="npr. Vozni park" required />
              </div>
              <div>
                <label className="label">Kontakt osoba</label>
                <input name="contactPerson" className="input" placeholder="npr. Ivan Ivić" />
              </div>
              <div>
                <label className="label">Kontakt broj</label>
                <input name="phone" className="input" placeholder="npr. 091 123 4567" />
              </div>
              <div>
                <label className="label">Kontakt email</label>
                <input name="email" type="email" className="input" placeholder="npr. vozni.park@colas.hr" />
              </div>
              <div className="sm:col-span-4">
                <button className="btn btn-primary px-4" type="submit">
                  + Dodaj odjel
                </button>
              </div>
            </form>

            <div className="h-px bg-black/10" />

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-600">
                    <th className="p-3">Naziv</th>
                    <th className="p-3">Kontakt osoba</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3">Email</th>
                    <th className="p-3 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customer.departments.map((d) => (
                    <tr key={d.id} className="align-top hover:bg-gray-50">
                      <td className="p-3">
                        <input form={`dept-${d.id}`} name="name" className="input" defaultValue={d.name} required />
                      </td>
                      <td className="p-3">
                        <input
                          form={`dept-${d.id}`}
                          name="contactPerson"
                          className="input"
                          defaultValue={d.contactPerson ?? ""}
                          placeholder="Kontakt osoba"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          form={`dept-${d.id}`}
                          name="phone"
                          className="input"
                          defaultValue={d.phone ?? ""}
                          placeholder="Telefon"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          form={`dept-${d.id}`}
                          name="email"
                          type="email"
                          className="input"
                          defaultValue={d.email ?? ""}
                          placeholder="Email"
                        />
                      </td>
                      <td className="p-3 text-right text-slate-500">
                        <div className="flex justify-end gap-2">
                          {/* Put the <form> inside <td> (valid HTML), and link inputs via form=... */}
                          <form
                            id={`dept-${d.id}`}
                            action={`/api/customers/${customer.id}/departments/${d.id}/update`}
                            method="post"
                          >
                            <button className="btn btn-outline" type="submit">
                              Spremi
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customer.departments.length === 0 && (
                    <tr>
                      <td className="p-6 text-slate-500" colSpan={5}>
                        Nema odjeljenja. Dodaj prvo gore.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <CustomerPortalAccountsCard
        customerId={customer.id}
        customerEmail={customer.email}
        linkStatus={customer.ownerLink?.status ?? null}
        invitedEmail={customer.ownerLink?.invitedEmail ?? null}
        existingPortalForOib={existingPortalForOib}
        portalActive={portalStatus.portalActive}
        hasPendingInvite={portalStatus.hasPendingInvite}
      />
    </main>
  );
}

