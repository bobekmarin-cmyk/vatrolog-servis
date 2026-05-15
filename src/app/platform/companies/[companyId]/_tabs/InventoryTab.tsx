import { getInventoryStats } from "@/lib/companyDetailStats";
import { Section, KpiTile, StatusPill, fmtDate } from "./shared";

export default async function InventoryTab({ companyId }: { companyId: string }) {
  const inv = await getInventoryStats(companyId);

  return (
    <div className="space-y-4">
      <Section title="Aparati — brojaci">
        <div className="grid gap-2.5 sm:grid-cols-4">
          <KpiTile label="Ukupno" value={inv.extinguisherCounts.total} />
          <KpiTile label="Aktivni" value={inv.extinguisherCounts.active} tone="success" />
          <KpiTile label="Otpisani" value={inv.extinguisherCounts.scrapped} tone="neutral" />
          <KpiTile label="Izgubljeni" value={inv.extinguisherCounts.lost} tone={inv.extinguisherCounts.lost > 0 ? "warning" : "neutral"} />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Po proizvodjacu (top 10)">
          <DistributionBars
            rows={inv.byManufacturer.map((m) => ({ key: m.manufacturerId, label: m.manufacturerName, count: m.count }))}
            color="bg-sky-500"
            emptyLabel="Nema aparata"
          />
        </Section>
        <Section title="Po tipu (top 10)">
          <DistributionBars
            rows={inv.byType.map((t) => ({ key: t.extinguisherTypeId, label: `${t.typeCode} — ${t.typeName}`, count: t.count }))}
            color="bg-emerald-500"
            emptyLabel="Nema aparata"
          />
        </Section>
      </div>

      <Section title="Zadnjih 20 dodanih aparata">
        {inv.latestExtinguishers.length === 0 ? (
          <p className="text-sm text-slate-500">Nema dodanih aparata.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600">
                  <th className="p-2">Sifra</th>
                  <th className="p-2">Ser. broj</th>
                  <th className="p-2">Tip</th>
                  <th className="p-2">Proizvodjac</th>
                  <th className="p-2">Godina</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Dodano</th>
                  <th className="p-2">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inv.latestExtinguishers.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{e.internalCode}</td>
                    <td className="p-2 font-mono text-xs">{e.serialNumber}</td>
                    <td className="p-2 text-xs">{e.typeName}</td>
                    <td className="p-2 text-xs">{e.manufacturerName}</td>
                    <td className="p-2 tabular-nums text-xs">{e.productionYear}</td>
                    <td className="p-2">
                      <StatusPill status={e.status} />
                    </td>
                    <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="p-2">
                      <form
                        action={`/api/platform/companies/${companyId}/extinguishers/${e.id}/soft-delete`}
                        method="post"
                        onSubmit={undefined}
                      >
                        <button
                          className="btn btn-outline h-7 px-2 text-[11px] text-red-700"
                          type="submit"
                          title="Soft-delete: aparat se sakriva ali se ne brise iz baze. Audit zapis se kreira."
                        >
                          Soft-delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Kupci — brojaci">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <KpiTile label="Ukupno" value={inv.customerCounts.total} />
          <KpiTile label="Pravne osobe" value={inv.customerCounts.legal} />
          <KpiTile label="Fizicke osobe" value={inv.customerCounts.person} />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top 10 kupaca (po broju naloga)">
          {inv.topCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">Jos nema zabiljezenih naloga.</p>
          ) : (
            <ol className="space-y-1.5">
              {inv.topCustomers.map((c, i) => (
                <li
                  key={c.customerId}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-1.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      #{i + 1}
                    </span>
                    <span className="truncate text-slate-800">{c.name}</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {c.workOrderCount}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
        <Section title="Zadnjih 15 dodanih kupaca">
          {inv.recentCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">Nema dodanih kupaca.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-600">
                    <th className="p-2">Naziv</th>
                    <th className="p-2">Tip</th>
                    <th className="p-2">OIB</th>
                    <th className="p-2">Grad</th>
                    <th className="p-2">Dodano</th>
                    <th className="p-2">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inv.recentCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-2 text-xs">{c.name}</td>
                      <td className="p-2 text-xs">
                        <span className="text-[10px] uppercase font-semibold text-slate-500">
                          {c.type === "LEGAL" ? "Pravna" : "Fizicka"}
                        </span>
                      </td>
                      <td className="p-2 font-mono text-xs">{c.oib}</td>
                      <td className="p-2 text-xs text-slate-600">{c.city ?? "—"}</td>
                      <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                      <td className="p-2">
                        <form
                          action={`/api/platform/companies/${companyId}/customers/${c.id}/soft-delete`}
                          method="post"
                        >
                          <button
                            className="btn btn-outline h-7 px-2 text-[11px] text-red-700"
                            type="submit"
                            title="Soft-delete kupca. Audit zapis se kreira."
                          >
                            Soft-delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function DistributionBars({
  rows,
  color,
  emptyLabel,
}: {
  rows: { key: string; label: string; count: number }[];
  color: string;
  emptyLabel: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = (r.count / max) * 100;
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-slate-700">{r.label}</span>
              <span className="tabular-nums text-slate-600">{r.count}</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded bg-slate-100">
              <div className={`h-1.5 rounded ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
