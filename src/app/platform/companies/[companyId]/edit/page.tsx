import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/platformAuth";

export default async function PlatformCompanyEditPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePlatformSession();
  const { companyId } = await params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      accounts: { orderBy: { username: "asc" } },
      serviceLocations: { orderBy: [{ kind: "asc" }, { ordinal: "asc" }] },
    },
  });
  if (!company) notFound();
  const adminAccount = company.accounts.find((a) => a.role === "ADMIN") ?? null;
  const accountEmailDefault = adminAccount?.email ?? company.email ?? "";
  const accountEmailMismatch =
    !!adminAccount?.email && !!company.email && adminAccount.email !== company.email;
  const stationaryCount = company.serviceLocations.filter((l) => l.kind === "STATIONARY").length;
  const vehicleCount = company.serviceLocations.filter((l) => l.kind === "VEHICLE").length;

  return (
    <main className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Uredi tvrtku</h1>
          <p className="mt-1 text-sm text-slate-600">
            OIB: <span className="font-mono">{company.oib}</span> (ne može se mijenjati)
          </p>
        </div>
        <Link className="btn btn-outline px-4" href={`/platform/companies/${companyId}`}>
          ← Natrag
        </Link>
      </div>

      {accountEmailMismatch && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>Napomena:</strong> trenutni email admin računa
          (<span className="font-mono">{adminAccount?.email}</span>) razlikuje se od kontakt emaila tvrtke
          (<span className="font-mono">{company.email}</span>). Pozivnice i password reset šalju se na
          email admin računa.
        </div>
      )}

      <form
        className="surface p-4 space-y-4"
        action={`/api/platform/companies/${companyId}/update`}
        method="post"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Naziv</label>
            <input name="name" className="input" defaultValue={company.name} required />
          </div>
          <div>
            <label className="label">OIB</label>
            <input className="input font-mono bg-slate-100 cursor-not-allowed" value={company.oib} disabled />
          </div>
          <div>
            <label className="label">Šifra servisa</label>
            <input
              name="serviceCode"
              className="input font-mono"
              defaultValue={company.serviceCode}
              pattern="\d{2}"
              maxLength={2}
              inputMode="numeric"
              required
            />
            <p className="help">
              Dvoznamenkasti broj. Promjenom se preimenuju svi povezani računi.
            </p>
          </div>
          <div>
            <label className="label">Slug username-a</label>
            <input
              name="usernameSlug"
              className="input font-mono"
              defaultValue={company.usernameSlug}
              pattern="[a-z0-9]{2,15}"
              minLength={2}
              maxLength={15}
              required
            />
            <p className="help">
              Slova/brojevi (2–15). Promjenom se preimenuju sva korisnička imena
              (npr. <span className="font-mono">{company.serviceCode}-{company.usernameSlug}</span>,{" "}
              <span className="font-mono">{company.serviceCode}-{company.usernameSlug}V1</span>).
            </p>
          </div>
          <div>
            <label className="label">Email admin računa (za pozivnice / reset)</label>
            <input
              name="accountEmail"
              className="input"
              type="email"
              defaultValue={accountEmailDefault}
              placeholder="npr. marin@vatrobran.hr"
            />
            <p className="help">
              Postavlja se na sve račune (admin + workshop). Pozivnica i password reset link idu
              na ovaj email.
            </p>
          </div>
          <div>
            <label className="label">Servisne lokacije (info)</label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1">
              <div>
                Stacionarne: <strong>{stationaryCount}</strong>
              </div>
              <div>
                Vozila: <strong>{vehicleCount}</strong>
              </div>
              <div className="text-slate-500">
                Lokacije se dodaju i mijenjaju na stranici tvrtke (gumb „+ Dodaj novi račun“).
              </div>
            </div>
          </div>
          <div>
            <label className="label">Ulica</label>
            <input name="street" className="input" defaultValue={company.street} required />
          </div>
          <div>
            <label className="label">Grad</label>
            <input name="city" className="input" defaultValue={company.city} required />
          </div>
          <div>
            <label className="label">Poštanski broj</label>
            <input name="postalCode" className="input" defaultValue={company.postalCode} required />
          </div>
          <div>
            <label className="label">IBAN</label>
            <input name="iban" className="input" defaultValue={company.iban} required />
          </div>
          <div>
            <label className="label">Kontakt osoba</label>
            <input name="contactName" className="input" defaultValue={company.contactName ?? ""} />
          </div>
          <div>
            <label className="label">Email tvrtke (kontakt)</label>
            <input name="email" className="input" type="email" defaultValue={company.email ?? ""} />
            <p className="help">Prikazuje se na PDF zaglavlju, footeru i dokumentima kupcima.</p>
          </div>
          <div>
            <label className="label">Telefon</label>
            <input name="phone" className="input" defaultValue={company.phone ?? ""} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn btn-primary px-4" type="submit">
            Spremi promjene
          </button>
          <Link className="btn btn-outline px-4" href={`/platform/companies/${companyId}`}>
            Odustani
          </Link>
        </div>
      </form>
    </main>
  );
}
