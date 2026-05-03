import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ action?: string; entity?: string; page?: string }>;

type ActionDef = {
  key: string;
  label: string;
  description: string;
  entity?: string;
};

type QuickFilter = {
  label: string;
  action?: string;
  entity?: string;
};

const ACTION_CATALOG: { group: string; actions: ActionDef[] }[] = [
  {
    group: "Kupci",
    actions: [
      {
        key: "customer.create",
        label: "Dodan kupac",
        description: "Administrator ili serviser dodao novog kupca.",
        entity: "Customer",
      },
      {
        key: "customer.portal.ensure",
        label: "Aktiviran portal kupca",
        description: "Generiran tajni link za pristup portalu kupca.",
        entity: "Customer",
      },
      {
        key: "customer.portal.regenerate",
        label: "Regeneriran link portala",
        description: "Stari tajni link poništen, novi je izdan.",
        entity: "Customer",
      },
      {
        key: "customer.portal.revoke",
        label: "Ukinut pristup portalu",
        description: "Tajni link za portal je ukinut i više ne vrijedi.",
        entity: "Customer",
      },
    ],
  },
  {
    group: "Servis i skladište",
    actions: [
      {
        key: "workOrder.create",
        label: "Novi radni nalog",
        description: "Kreiran je novi radni nalog; primljeni aparati se vode u istom dokumentu.",
        entity: "WorkOrder",
      },
      {
        key: "workOrder.lock",
        label: "Zaključan radni nalog",
        description: "Radni nalog je finaliziran, skladište umanjeno.",
        entity: "WorkOrder",
      },
      {
        key: "workOrderItem.scanAdd",
        label: "Dodavanje aparata skenom QR koda",
        description: "Serviser je skenirao QR kod postojećeg aparata i dodao ga u radni nalog.",
        entity: "WorkOrderItem",
      },
      {
        key: "partStock.update",
        label: "Izmjena min. zalihe dijela",
        description: "Promjena minimalne zalihe za dio (prag upozorenja).",
        entity: "PartStock",
      },
      {
        key: "stockReceipt.create",
        label: "Nova skladišna primka",
        description: "Ulazni dokument — zaprimanje dijelova od dobavljača.",
        entity: "StockReceipt",
      },
      {
        key: "stockAdjustment.create",
        label: "Korekcija stanja dijela",
        description: "Ručna korekcija stanja (+/-) s obaveznim razlogom.",
        entity: "StockAdjustment",
      },
      {
        key: "part.customCreate",
        label: "Novi vlastiti dio",
        description: "Tvrtka je dodala vlastiti (tenant-specific) dio izvan platform kataloga.",
        entity: "Part",
      },
      {
        key: "part.customDelete",
        label: "Obrisan vlastiti dio",
        description: "Tvrtka je obrisala svoj vlastiti dio.",
        entity: "Part",
      },
      {
        key: "partStock.visibility",
        label: "Promjena vidljivosti dijela",
        description: "Tvrtka je aktivirala/deaktivirala dio u svojim popisima.",
        entity: "PartStock",
      },
      {
        key: "serviceCatalog.update",
        label: "Izmjena šifre usluge",
        description: "Tvrtka je upisala ili promijenila računovodstvenu šifru za uslugu (periodični/unutarnji pregled).",
        entity: "CompanyServiceCatalog",
      },
    ],
  },
  {
    group: "GDPR / privatnost",
    actions: [
      {
        key: "dsar.export",
        label: "Izvoz podataka (DSAR)",
        description: "Administrator je preuzeo JSON izvoz tvrtkinih podataka.",
        entity: "Company",
      },
      {
        key: "dsar.delete_request",
        label: "Zahtjev za brisanjem",
        description: "Tvrtka je označena za soft-delete (28-dnevni cooldown).",
        entity: "Company",
      },
    ],
  },
  {
    group: "Račun i pretplata",
    actions: [
      {
        key: "company.signup",
        label: "Registracija tvrtke",
        description: "Kreiran novi tenant kroz self-service registraciju.",
        entity: "Company",
      },
      {
        key: "subscription.updated",
        label: "Promjena pretplate",
        description: "Stripe webhook je osvježio status ili datum isteka.",
        entity: "Company",
      },
      {
        key: "password.reset",
        label: "Reset lozinke",
        description: "Korisnik je postavio novu lozinku kroz recovery tok.",
        entity: "AccountUser",
      },
    ],
  },
];

const QUICK_FILTERS: QuickFilter[] = [
  { label: "Svi zapisi" },
  { label: "Kupci", action: "customer" },
  { label: "Radni nalozi", action: "workOrder" },
  { label: "Skladište", action: "partStock" },
  { label: "Primke", action: "stockReceipt" },
  { label: "Korekcije stanja", action: "stockAdjustment" },
  { label: "GDPR", action: "dsar" },
  { label: "Pretplata", action: "subscription" },
];

function buildQuery(params: { action?: string; entity?: string }): string {
  const qs = new URLSearchParams();
  if (params.action) qs.set("action", params.action);
  if (params.entity) qs.set("entity", params.entity);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function SettingsAuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const { action, entity, page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? "1") || 1);
  const perPage = 50;

  const where = {
    companyId: session.companyId,
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entity ? { entity } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (pageNum - 1) * perPage,
      include: { actor: { select: { username: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const basePath = "/admin/settings/audit";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Audit log</h2>
          <p className="text-sm text-slate-600">
            Popis svih osjetljivih akcija u vašoj tvrtki — tko, što, kad i s kojeg IP-a.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          Ukupno zapisa: <strong>{total}</strong>
        </div>
      </div>

      {/* Brzi filteri */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((q) => {
          const active = (action ?? "") === (q.action ?? "") && (entity ?? "") === (q.entity ?? "");
          return (
            <Link
              key={q.label}
              href={`${basePath}${buildQuery({ action: q.action, entity: q.entity })}`}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {q.label}
            </Link>
          );
        })}
      </div>

      {/* Forma pretrage */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-500">Akcija (sadrži)</label>
          <input
            name="action"
            defaultValue={action ?? ""}
            placeholder="npr. customer.create"
            className="input h-9 w-60"
            list="audit-actions"
          />
          <datalist id="audit-actions">
            {ACTION_CATALOG.flatMap((g) => g.actions).map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Entitet</label>
          <input
            name="entity"
            defaultValue={entity ?? ""}
            placeholder="npr. Customer"
            className="input h-9 w-40"
            list="audit-entities"
          />
          <datalist id="audit-entities">
            <option value="Customer" />
            <option value="WorkOrder" />
            <option value="PartStock" />
            <option value="Company" />
            <option value="AccountUser" />
          </datalist>
        </div>
        <button type="submit" className="btn btn-primary h-9">
          Filtriraj
        </button>
        <Link href={basePath} className="btn btn-outline h-9">
          Poništi
        </Link>
      </form>

      {/* Pomoćnik: popis akcija */}
      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <summary className="cursor-pointer select-none font-semibold text-slate-800">
          Popis akcija koje se mogu pretraživati
        </summary>
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-600">
            Kliknite na akciju da primijenite kao filter. Pretraga radi po <em>sadržaju</em> — npr. upis{" "}
            <code className="rounded bg-white px-1">customer</code> pronalazi sve akcije vezane za kupce.
          </p>
          {ACTION_CATALOG.map((group) => (
            <div key={group.group}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.group}
              </div>
              <ul className="space-y-1.5">
                {group.actions.map((a) => (
                  <li key={a.key} className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`${basePath}${buildQuery({ action: a.key })}`}
                      className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-white hover:bg-slate-700"
                    >
                      {a.key}
                    </Link>
                    <span className="font-medium text-slate-800">{a.label}</span>
                    <span className="text-slate-600">— {a.description}</span>
                    {a.entity ? (
                      <span className="text-xs text-slate-400">(entitet: {a.entity})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* Tablica */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Vrijeme</th>
                <th className="px-3 py-2">Korisnik</th>
                <th className="px-3 py-2">Akcija</th>
                <th className="px-3 py-2">Entitet</th>
                <th className="px-3 py-2">ID entiteta</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">
                    {it.createdAt.toLocaleString("hr-HR")}
                  </td>
                  <td className="px-3 py-2">
                    {it.actor?.username ?? it.actor?.email ?? <span className="text-slate-400">—</span>}
                    <span className="ml-1 text-xs text-slate-400">({it.actorType})</span>
                  </td>
                  <td className="px-3 py-2 font-medium">{it.action}</td>
                  <td className="px-3 py-2">{it.entity ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.entityId ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.ip ?? "—"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Nema zapisa za zadani filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div>
            Stranica {pageNum} od {totalPages}
          </div>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...(action ? { action } : {}),
                  ...(entity ? { entity } : {}),
                  page: String(pageNum - 1),
                }).toString()}`}
                className="btn btn-outline h-9"
              >
                ← Prethodna
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...(action ? { action } : {}),
                  ...(entity ? { entity } : {}),
                  page: String(pageNum + 1),
                }).toString()}`}
                className="btn btn-outline h-9"
              >
                Sljedeća →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
