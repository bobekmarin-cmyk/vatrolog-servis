import { getOperationsStats } from "@/lib/companyDetailStats";
import { Section, KpiTile, StatusPill, fmtDate, fmtDateTime, fmtEur } from "./shared";
import WorkOrderStatusBadge from "@/components/WorkOrderStatusBadge";
import type { WorkOrderStatus } from "@prisma/client";

const DOC_TYPE_LABEL: Record<string, string> = {
  REGISTER_VIEW: "Upisnik (pregled)",
  REGISTER_PDF: "Upisnik (PDF)",
  DELIVERY_NOTE_PDF: "Otpremnica (PDF)",
};

export default async function OperationsTab({ companyId }: { companyId: string }) {
  const ops = await getOperationsStats(companyId);

  return (
    <div className="space-y-4">
      <Section title="Nalozi — brojaci">
        <div className="grid gap-2.5 sm:grid-cols-4">
          <KpiTile label="Ukupno" value={ops.workOrderCounts.total} />
          <KpiTile label="Otvoreno" value={ops.workOrderCounts.draft} tone="neutral" />
          <KpiTile label="U tijeku" value={ops.workOrderCounts.inProgress} tone="info" />
          <KpiTile label="Zakljucano" value={ops.workOrderCounts.locked} tone={ops.workOrderCounts.locked > 0 ? "warning" : "neutral"} />
        </div>
      </Section>

      <Section title="Nalozi po mjesecu (12 mj)">
        <MonthlyBars months={ops.workOrdersByMonth.months} counts={ops.workOrdersByMonth.counts} />
      </Section>

      <Section title="Zadnjih 20 naloga">
        {ops.latestWorkOrders.length === 0 ? (
          <p className="text-sm text-slate-500">Nema zabiljezenih naloga.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600">
                  <th className="p-2">Broj</th>
                  <th className="p-2">Kupac</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Primljen</th>
                  <th className="p-2">Zavrsen</th>
                  <th className="p-2">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ops.latestWorkOrders.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{w.orderNumber}</td>
                    <td className="p-2 text-xs">{w.customerName}</td>
                    <td className="p-2">
                      <WorkOrderStatusBadge
                        status={w.status as WorkOrderStatus}
                        hasShippedDeliveryNote={w.hasShippedDeliveryNote}
                      />
                    </td>
                    <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(w.receivedAt)}</td>
                    <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(w.finishedAt)}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {w.status === "LOCKED" ? (
                          <form
                            action={`/api/platform/companies/${companyId}/work-orders/${w.id}/unlock`}
                            method="post"
                          >
                            <button
                              className="btn btn-outline h-7 px-2 text-[11px] text-amber-700"
                              type="submit"
                              title="Otkljucaj nalog (resetira lock fields)."
                            >
                              Otkljucaj
                            </button>
                          </form>
                        ) : null}
                        {w.status === "DRAFT" ? (
                          <form
                            action={`/api/platform/companies/${companyId}/work-orders/${w.id}/delete`}
                            method="post"
                          >
                            <button
                              className="btn btn-outline h-7 px-2 text-[11px] text-red-700"
                              type="submit"
                              title="Trajno brisanje DRAFT naloga. Audit zapis se kreira."
                            >
                              Brisi
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Generirani dokumenti">
          {ops.documentLogCounts.length === 0 ? (
            <p className="text-sm text-slate-500">Niti jedan dokument nije generiran.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.documentLogCounts.map((d) => (
                <li
                  key={d.docType}
                  className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {DOC_TYPE_LABEL[d.docType] ?? d.docType}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {d.last30d} u zadnjih 30 dana
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {d.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Racuni — po statusu">
          {ops.invoiceCounts.total === 0 ? (
            <p className="text-sm text-slate-500">Nijedan racun nije izdan.</p>
          ) : (
            <ul className="space-y-1.5">
              {ops.invoiceCounts.byStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-1.5 text-sm"
                >
                  <StatusPill status={s.status} />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Zadnjih 20 racuna">
        {ops.latestInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">Nijedan racun nije izdan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-600">
                  <th className="p-2">Broj</th>
                  <th className="p-2">Kupac</th>
                  <th className="p-2">Iznos</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Izdano</th>
                  <th className="p-2">Placeno</th>
                  <th className="p-2">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ops.latestInvoices.map((i) => {
                  const canVoid = i.status === "DRAFT" || i.status === "ISSUED" || i.status === "OVERDUE";
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{i.number}</td>
                      <td className="p-2 text-xs text-slate-700">{i.customerName ?? "—"}</td>
                      <td className="p-2 tabular-nums text-xs">{fmtEur(i.total)}</td>
                      <td className="p-2">
                        <StatusPill status={i.status} />
                      </td>
                      <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(i.issuedAt)}</td>
                      <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(i.paidAt)}</td>
                      <td className="p-2">
                        {canVoid ? (
                          <form
                            action={`/api/platform/companies/${companyId}/invoices/${i.id}/void`}
                            method="post"
                          >
                            <button
                              className="btn btn-outline h-7 px-2 text-[11px] text-red-700"
                              type="submit"
                              title="Postavi racun u VOID status (storno)."
                            >
                              Void
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function MonthlyBars({ months, counts }: { months: string[]; counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {months.map((m, i) => {
        const c = counts[i] ?? 0;
        return (
          <div key={m} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-sky-500"
              style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? "2px" : "0" }}
              title={`${m}: ${c}`}
            />
            <span className="text-[9px] text-slate-500">{m.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
