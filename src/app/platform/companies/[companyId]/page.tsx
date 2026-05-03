import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlatformSubscriptionManager from "@/components/PlatformSubscriptionManager";
import PlatformCompanyTabs from "@/components/PlatformCompanyTabs";
import PlatformFeatureToggles from "@/components/PlatformFeatureToggles";
import { getCompanyFeatures } from "@/lib/companyFeatures";
import { requirePlatformSession } from "@/lib/platformAuth";
import CopySetupLinkButton from "./CopySetupLinkButton";
import AddAccountButton from "./AddAccountButton";
import RenameUsernameButton from "./RenameUsernameButton";
import RenameLocationButton from "./RenameLocationButton";
import { buildLocationLabel } from "@/lib/companyAccountNaming";

type AccountStatus = "ACTIVE" | "PENDING_ACTIVATION" | "INACTIVE";

function dt(d: Date): string {
  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(d: Date): string {
  const diffMs = d.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = Math.floor(abs / (1000 * 60));
  const h = Math.floor(min / 60);
  const day = Math.floor(h / 24);

  let body: string;
  if (min < 1) body = "manje od minute";
  else if (min < 60) body = `${min} min`;
  else if (h < 24) body = `${h} h`;
  else body = `${day} d`;
  return past ? `prije ${body}` : `za ${body}`;
}

export default async function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePlatformSession();
  const { companyId } = await params;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      accounts: {
        orderBy: { username: "asc" },
        include: {
          serviceLocation: { select: { id: true, kind: true, ordinal: true, label: true } },
        },
      },
      serviceLocations: { orderBy: [{ kind: "asc" }, { ordinal: "asc" }] },
    },
  });

  if (!company) notFound();

  const stationaryCount = company.serviceLocations.filter((l) => l.kind === "STATIONARY").length;
  const vehicleCount = company.serviceLocations.filter((l) => l.kind === "VEHICLE").length;
  const activeAccountCount = company.accounts.filter((a) => a.active).length;
  const nextStationaryLabel = buildLocationLabel("STATIONARY", stationaryCount + 1);
  const nextVehicleLabel = buildLocationLabel("VEHICLE", vehicleCount + 1);

  // Najnoviji invite/reset/setup tokeni po računu (za prikaz "zadnji reset prije X")
  const accountIds = company.accounts.map((a) => a.id);
  const recentTokens = accountIds.length
    ? await prisma.authToken.findMany({
        where: {
          accountUserId: { in: accountIds },
          type: { in: ["ACCOUNT_INVITE", "PASSWORD_RESET", "SUBACCOUNT_PASSWORD_SETUP"] },
        },
        select: {
          accountUserId: true,
          type: true,
          createdAt: true,
          expiresAt: true,
          usedAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  type LatestEntry = {
    type: "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP";
    createdAt: Date;
    expiresAt: Date;
    usedAt: Date | null;
  };
  const latestByAccount = new Map<string, LatestEntry>();
  const activeTokenByAccount = new Map<string, LatestEntry>();
  for (const t of recentTokens) {
    if (!t.accountUserId) continue;
    if (!latestByAccount.has(t.accountUserId)) {
      latestByAccount.set(t.accountUserId, t as LatestEntry);
    }
    if (
      !t.usedAt &&
      t.expiresAt > new Date() &&
      !activeTokenByAccount.has(t.accountUserId)
    ) {
      activeTokenByAccount.set(t.accountUserId, t as LatestEntry);
    }
  }

  const features = await getCompanyFeatures(companyId);

  const tabs = [
    { id: "details", label: "Detalji" },
    { id: "modules", label: "Moduli" },
  ];

  function statusOf(active: boolean, lastLoginAt: Date | null): AccountStatus {
    if (active) return "ACTIVE";
    if (lastLoginAt) return "INACTIVE";
    return "PENDING_ACTIVATION";
  }

  function statusChip(s: AccountStatus) {
    if (s === "ACTIVE") {
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          Aktivan
        </span>
      );
    }
    if (s === "PENDING_ACTIVATION") {
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          Čeka aktivaciju
        </span>
      );
    }
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
        Neaktivan
      </span>
    );
  }

  function tokenLabel(type: LatestEntry["type"]): string {
    if (type === "ACCOUNT_INVITE") return "Pozivnica";
    if (type === "PASSWORD_RESET") return "Reset";
    return "Setup link";
  }

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{company.name}</h1>
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">OIB:</span>{" "}
            <span className="font-mono">{company.oib}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-medium">Šifra:</span>{" "}
            <span className="font-mono">{company.serviceCode}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-outline px-4" href="/platform/companies">
            ← Tvrtke
          </Link>
          <form action={`/api/platform/companies/${company.id}/impersonate`} method="post">
            <button className="btn btn-outline px-4" type="submit">
              Pristupi kao tvrtka
            </button>
          </form>
          <Link className="btn btn-primary px-4" href={`/platform/companies/${company.id}/edit`}>
            Uredi podatke
          </Link>
        </div>
      </div>

      <PlatformCompanyTabs tabs={tabs}>
        {/* Tab: Detalji */}
        <div className="space-y-6">
          <section className="surface">
            <div className="surface-header">
              <h2 className="h1">Podaci o tvrtki</h2>
            </div>
            <div className="h-px bg-black/10" />
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="font-medium text-slate-500">Adresa</dt>
                  <dd>{company.street}, {company.postalCode} {company.city}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">IBAN</dt>
                  <dd className="font-mono">{company.iban}</dd>
                </div>
                {company.email && (
                  <div>
                    <dt className="font-medium text-slate-500">Email</dt>
                    <dd>{company.email}</dd>
                  </div>
                )}
                {company.phone && (
                  <div>
                    <dt className="font-medium text-slate-500">Telefon</dt>
                    <dd>{company.phone}</dd>
                  </div>
                )}
                {company.contactName && (
                  <div>
                    <dt className="font-medium text-slate-500">Kontakt osoba</dt>
                    <dd>{company.contactName}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          <section className="surface">
            <div className="surface-header">
              <h2 className="h1">Pretplata i pristup</h2>
            </div>
            <div className="h-px bg-black/10" />
            <div className="p-4">
              <PlatformSubscriptionManager
                companyId={company.id}
                activeUntil={company.activeUntil?.toISOString() ?? null}
                blocked={company.blocked}
              />
            </div>
          </section>

          <section className="surface">
            <div className="surface-header">
              <div>
                <h2 className="h1">Računi</h2>
                <p className="mt-1 subtle">
                  Admin postavlja lozinke putem pozivnice. Sub-računi (workshop) dobiju setup link na admin email.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="subtle">Aktivni računi: {activeAccountCount}</span>
                <span className="subtle">Ukupno: {company.accounts.length}</span>
                <AddAccountButton
                  companyId={company.id}
                  defaultLabelStationary={nextStationaryLabel}
                  defaultLabelVehicle={nextVehicleLabel}
                />
              </div>
            </div>
            <div className="h-px bg-black/10" />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-600">
                    <th className="p-3">Username</th>
                    <th className="p-3">Uloga</th>
                    <th className="p-3">Lokacija</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Zadnja prijava</th>
                    <th className="p-3">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {company.accounts.map((a) => {
                    const status = statusOf(a.active, a.lastLoginAt);
                    const isAdmin = a.role === "ADMIN";
                    const latest = latestByAccount.get(a.id);
                    const activeTok = activeTokenByAccount.get(a.id);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 align-top">
                        <td className="p-3 font-mono text-xs whitespace-nowrap">{a.username}</td>
                        <td className="p-3 whitespace-nowrap">{isAdmin ? "Admin" : "User/Workshop"}</td>
                        <td className="p-3 whitespace-nowrap">
                          {a.serviceLocation ? (
                            <div className="flex items-center gap-1">
                              <span
                                className={`badge badge-tight ${
                                  a.serviceLocation.kind === "STATIONARY"
                                    ? "badge-info"
                                    : "badge-success"
                                }`}
                              >
                                {a.serviceLocation.kind === "STATIONARY" ? "S" : "V"}
                              </span>
                              <span className="text-xs text-slate-700">
                                {a.serviceLocation.label}
                              </span>
                            </div>
                          ) : isAdmin ? (
                            <span className="text-xs text-slate-400">— (svi)</span>
                          ) : (
                            <span className="text-xs text-rose-600">bez lokacije</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {statusChip(status)}
                            {activeTok ? (
                              <span className="text-[11px] text-slate-500" title={dt(activeTok.expiresAt)}>
                                {tokenLabel(activeTok.type)} aktivan ·{" "}
                                vrijedi do {dt(activeTok.expiresAt)}
                              </span>
                            ) : latest ? (
                              <span className="text-[11px] text-slate-500" title={dt(latest.createdAt)}>
                                {tokenLabel(latest.type)} {relative(latest.createdAt)}
                                {latest.usedAt ? " · iskorišten" : ""}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-700">{a.email ?? "—"}</td>
                        <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                          {a.lastLoginAt ? dt(a.lastLoginAt) : "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {isAdmin ? (
                              <>
                                {!a.active ? (
                                  <form
                                    action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-invite`}
                                    method="post"
                                  >
                                    <button
                                      className="btn btn-primary h-8 px-3 text-xs"
                                      type="submit"
                                      title="Pošalji onboarding pozivnicu adminu (postavlja lozinke za sve račune)"
                                    >
                                      Pošalji pozivnicu
                                    </button>
                                  </form>
                                ) : (
                                  <form
                                    action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-reset`}
                                    method="post"
                                  >
                                    <button
                                      className="btn btn-outline h-8 px-3 text-xs"
                                      type="submit"
                                      title="Pošalji password reset link na email računa"
                                    >
                                      Pošalji reset
                                    </button>
                                  </form>
                                )}
                              </>
                            ) : (
                              <>
                                {a.active ? (
                                  <form
                                    action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-reset`}
                                    method="post"
                                  >
                                    <button
                                      className="btn btn-outline h-8 px-3 text-xs"
                                      type="submit"
                                      title="Pošalji password reset link na email računa"
                                    >
                                      Pošalji reset
                                    </button>
                                  </form>
                                ) : (
                                  <>
                                    <form
                                      action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-setup`}
                                      method="post"
                                    >
                                      <button
                                        className="btn btn-primary h-8 px-3 text-xs"
                                        type="submit"
                                        title="Šalje admin tvrtke link za postavljanje lozinke ovog sub-računa"
                                      >
                                        Pošalji setup mail
                                      </button>
                                    </form>
                                    <CopySetupLinkButton
                                      companyId={company.id}
                                      accountUserId={a.id}
                                      username={a.username}
                                    />
                                  </>
                                )}
                              </>
                            )}
                            <form
                              action={`/api/platform/companies/${company.id}/accounts/${a.id}/force-logout`}
                              method="post"
                            >
                              <button
                                className="btn btn-outline h-8 px-3 text-xs text-amber-700"
                                type="submit"
                                title="Invalidira sve postojeće sesije za ovaj račun"
                              >
                                Force logout
                              </button>
                            </form>
                            <form
                              action={`/api/platform/companies/${company.id}/accounts/${a.id}/toggle-active`}
                              method="post"
                            >
                              <button
                                className={`btn h-8 px-3 text-xs ${a.active ? "btn-outline text-red-600" : "btn-primary"}`}
                                type="submit"
                              >
                                {a.active ? "Deaktiviraj" : "Aktiviraj"}
                              </button>
                            </form>
                            <details className="text-xs">
                              <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                                Više…
                              </summary>
                              <div className="mt-2 space-y-2">
                                <RenameUsernameButton
                                  companyId={company.id}
                                  accountUserId={a.id}
                                  currentUsername={a.username}
                                />
                                {a.serviceLocation ? (
                                  <RenameLocationButton
                                    companyId={company.id}
                                    locationId={a.serviceLocation.id}
                                    currentLabel={a.serviceLocation.label}
                                  />
                                ) : null}
                                <form
                                  className="flex items-center gap-2"
                                  action={`/api/platform/companies/${company.id}/accounts/${a.id}/reset-password`}
                                  method="post"
                                >
                                  <input
                                    name="newPassword"
                                    type="password"
                                    className="input w-40 h-8 text-xs"
                                    placeholder="Ručna lozinka"
                                    required
                                  />
                                  <button className="btn btn-outline h-8 px-3 text-xs" type="submit">
                                    Postavi
                                  </button>
                                </form>
                                <p className="text-[11px] text-slate-500">
                                  Koristi ručnu lozinku samo iznimno — radije pošalji reset/setup link.
                                </p>
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {company.accounts.length === 0 && (
                    <tr>
                      <td className="p-6 text-gray-500" colSpan={7}>
                        Nema računa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Tab: Moduli */}
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Odaberite koje module želite omogućiti za Admin i Workshop korisnike ove tvrtke.
          </p>
          <PlatformFeatureToggles companyId={company.id} features={features} />
        </div>
      </PlatformCompanyTabs>
    </main>
  );
}
