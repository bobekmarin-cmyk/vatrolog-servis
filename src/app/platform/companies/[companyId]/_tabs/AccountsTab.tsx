import { prisma } from "@/lib/prisma";
import { getServiceLocationStats } from "@/lib/companyDetailStats";
import { buildLocationLabel } from "@/lib/companyAccountNaming";
import CopySetupLinkButton from "../CopySetupLinkButton";
import AddAccountButton from "../AddAccountButton";
import RenameUsernameButton from "../RenameUsernameButton";
import RenameLocationButton from "../RenameLocationButton";
import { Section, fmtDateTime } from "./shared";

type AccountStatus = "ACTIVE" | "PENDING_ACTIVATION" | "INACTIVE";

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
        Ceka aktivaciju
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
      Neaktivan
    </span>
  );
}

function tokenLabel(type: "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP"): string {
  if (type === "ACCOUNT_INVITE") return "Pozivnica";
  if (type === "PASSWORD_RESET") return "Reset";
  return "Setup link";
}

export default async function AccountsTab({ companyId }: { companyId: string }) {
  const [company, locationStats] = await Promise.all([
    prisma.company.findUnique({
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
    }),
    getServiceLocationStats(companyId),
  ]);
  if (!company) return null;

  const stationaryCount = company.serviceLocations.filter((l) => l.kind === "STATIONARY").length;
  const vehicleCount = company.serviceLocations.filter((l) => l.kind === "VEHICLE").length;
  const activeAccountCount = company.accounts.filter((a) => a.active).length;
  const nextStationaryLabel = buildLocationLabel("STATIONARY", stationaryCount + 1);
  const nextVehicleLabel = buildLocationLabel("VEHICLE", vehicleCount + 1);

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
    if (!t.usedAt && t.expiresAt > new Date() && !activeTokenByAccount.has(t.accountUserId)) {
      activeTokenByAccount.set(t.accountUserId, t as LatestEntry);
    }
  }

  return (
    <div className="space-y-4">
      <Section
        title="Racuni"
        right={
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Aktivni: {activeAccountCount}</span>
            <span>Ukupno: {company.accounts.length}</span>
            <AddAccountButton
              companyId={company.id}
              defaultLabelStationary={nextStationaryLabel}
              defaultLabelVehicle={nextVehicleLabel}
            />
          </div>
        }
      >
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
                    <td className="p-3 whitespace-nowrap">
                      {isAdmin ? "Admin" : "User/Workshop"}
                    </td>
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
                          <span className="text-xs text-slate-700">{a.serviceLocation.label}</span>
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
                          <span
                            className="text-[11px] text-slate-500"
                            title={fmtDateTime(activeTok.expiresAt)}
                          >
                            {tokenLabel(activeTok.type)} aktivan · vrijedi do{" "}
                            {fmtDateTime(activeTok.expiresAt)}
                          </span>
                        ) : latest ? (
                          <span
                            className="text-[11px] text-slate-500"
                            title={fmtDateTime(latest.createdAt)}
                          >
                            {tokenLabel(latest.type)} {relative(latest.createdAt)}
                            {latest.usedAt ? " · iskoristen" : ""}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-slate-700">{a.email ?? "—"}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                      {a.lastLoginAt ? fmtDateTime(a.lastLoginAt) : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {isAdmin ? (
                          !a.active ? (
                            <form
                              action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-invite`}
                              method="post"
                            >
                              <button
                                className="btn btn-primary h-8 px-3 text-xs"
                                type="submit"
                                title="Posalji onboarding pozivnicu adminu"
                              >
                                Posalji pozivnicu
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
                                title="Posalji password reset link"
                              >
                                Posalji reset
                              </button>
                            </form>
                          )
                        ) : a.active ? (
                          <form
                            action={`/api/platform/companies/${company.id}/accounts/${a.id}/send-reset`}
                            method="post"
                          >
                            <button
                              className="btn btn-outline h-8 px-3 text-xs"
                              type="submit"
                              title="Posalji password reset link"
                            >
                              Posalji reset
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
                                title="Posalji setup mail adminu za ovaj sub-racun"
                              >
                                Posalji setup mail
                              </button>
                            </form>
                            <CopySetupLinkButton
                              companyId={company.id}
                              accountUserId={a.id}
                              username={a.username}
                            />
                          </>
                        )}
                        <form
                          action={`/api/platform/companies/${company.id}/accounts/${a.id}/force-logout`}
                          method="post"
                        >
                          <button
                            className="btn btn-outline h-8 px-3 text-xs text-amber-700"
                            type="submit"
                            title="Invalidira sve postojece sesije za ovaj racun"
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
                            Vise…
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
                                placeholder="Rucna lozinka"
                                required
                              />
                              <button className="btn btn-outline h-8 px-3 text-xs" type="submit">
                                Postavi
                              </button>
                            </form>
                            <p className="text-[11px] text-slate-500">
                              Koristi rucnu lozinku samo iznimno — radije posalji reset/setup link.
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
                    Nema racuna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Servisne lokacije">
        {locationStats.length === 0 ? (
          <p className="text-sm text-slate-500">Nema definiranih servisnih lokacija.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600">
                  <th className="p-3">Tip</th>
                  <th className="p-3">Naziv</th>
                  <th className="p-3">Redni br.</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Racuni</th>
                  <th className="p-3">Nalozi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {locationStats.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`badge badge-tight ${l.kind === "STATIONARY" ? "badge-info" : "badge-success"}`}
                      >
                        {l.kind === "STATIONARY" ? "Stacionar" : "Vozilo"}
                      </span>
                    </td>
                    <td className="p-3">{l.label}</td>
                    <td className="p-3 tabular-nums">{l.ordinal}</td>
                    <td className="p-3">
                      {l.active ? (
                        <span className="text-xs text-emerald-700">Aktivna</span>
                      ) : (
                        <span className="text-xs text-slate-400">Neaktivna</span>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">{l.accountCount}</td>
                    <td className="p-3 tabular-nums">{l.workOrderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
