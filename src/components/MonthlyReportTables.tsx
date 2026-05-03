"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface CustRow {
  id: string;
  name: string;
  email: string | null;
  totalDue: number;
  alreadyServiced: number;
  pickedUp: number;
  autoNotify: boolean;
  departmentId?: string;
}

interface SentEntry {
  customerId: string;
  sentAt: string;
}

interface Props {
  month: string;
  customersDue: CustRow[];
  customersOverdue: CustRow[];
  totalDueItems: number;
  totalOverdueItems: number;
  gmailConnected: boolean;
  sentEntries: SentEntry[];
}

const OVERDUE_LIMIT = 20;

function formatDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
}

function TotalCell({ totalDue }: { totalDue: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums font-semibold text-slate-700">
      {totalDue}
    </span>
  );
}

function DoneCell({
  totalDue,
  alreadyServiced,
  pickedUp,
}: {
  totalDue: number;
  alreadyServiced: number;
  pickedUp: number;
}) {
  const allDone = alreadyServiced > 0 && alreadyServiced >= totalDue;
  const partialDone = alreadyServiced > 0 && alreadyServiced < totalDue;
  const colorClass = allDone
    ? "text-emerald-700"
    : partialDone
      ? "text-amber-700"
      : "text-slate-300";
  return (
    <span className={`whitespace-nowrap tabular-nums font-semibold ${colorClass}`}>
      {alreadyServiced > 0 ? alreadyServiced : "—"}
      {pickedUp > 0 && (
        <span
          className="ml-1 text-[10px] font-normal text-slate-400"
          title="preuzeto na otvoreni nalog (čekaju servis)"
        >
          ({pickedUp} u radu)
        </span>
      )}
    </span>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total <= 0) return null;
  const pct = Math.min(100, Math.round((done / total) * 100));
  const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-blue-400";
  return (
    <div className="px-4 pb-3">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          Odrađeno{" "}
          <span className="font-semibold tabular-nums text-slate-700">
            {done} od {total}
          </span>
        </span>
        <span className="font-semibold tabular-nums text-slate-600">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MonthlyReportTables({
  month,
  customersDue,
  customersOverdue,
  totalDueItems,
  totalOverdueItems,
  gmailConnected,
  sentEntries,
}: Props) {
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const sentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of sentEntries) {
      if (!m.has(e.customerId)) m.set(e.customerId, e.sentAt);
    }
    return m;
  }, [sentEntries]);

  const pending = (c: CustRow) => c.alreadyServiced < c.totalDue;

  const filteredDue = useMemo(() => {
    if (filter === "all") return customersDue;
    return customersDue.filter(pending);
  }, [customersDue, filter]);

  const totalDoneDue = useMemo(
    () => customersDue.reduce((sum, c) => sum + c.alreadyServiced, 0),
    [customersDue],
  );

  const filteredOverdue = useMemo(() => {
    const base = filter === "all" ? customersOverdue : customersOverdue.filter(pending);
    return base.slice(0, OVERDUE_LIMIT);
  }, [customersOverdue, filter]);

  const overdueHidden = useMemo(() => {
    const base = filter === "all" ? customersOverdue : customersOverdue.filter(pending);
    return Math.max(0, base.length - OVERDUE_LIMIT);
  }, [customersOverdue, filter]);

  const totalOverdueCustomers = filter === "all"
    ? customersOverdue.length
    : customersOverdue.filter(pending).length;

  function composeUrl(c: CustRow, type: "due" | "overdue") {
    let url = `/reports/monthly/compose?customerId=${c.id}&month=${month}&type=${type}`;
    if (c.departmentId) url += `&departmentId=${c.departmentId}`;
    if (c.email) url += `&email=${encodeURIComponent(c.email)}`;
    return url;
  }

  return (
    <div className="space-y-6">
      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Prikaži:</span>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setFilter("all")}
          >
            Svi
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filter === "pending" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setFilter("pending")}
          >
            Neodrađeni
          </button>
        </div>
      </div>

      {/* Table 1: Due this month */}
      <section className="surface">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-2">
          <h2 className="text-sm font-semibold">
            Ističe ovaj mjesec
            <span className="ml-1.5 font-normal text-slate-400">
              ({totalDueItems} aparata, {filteredDue.length} kupaca)
            </span>
          </h2>
        </div>
        <ProgressBar done={totalDoneDue} total={totalDueItems} />
        <div className="h-px bg-black/10" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium text-slate-500">
                <th className="w-10 px-3 py-1.5 text-center">#</th>
                <th className="px-3 py-1.5">Kupac</th>
                <th className="w-24 whitespace-nowrap px-3 py-1.5 text-right">Ukupno</th>
                <th className="w-24 whitespace-nowrap px-3 py-1.5 text-right">Servisirano</th>
                <th className="w-44 px-3 py-1.5 text-right">Obavijest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDue.map((c, idx) => {
                const rowKey = c.departmentId ? `${c.id}::${c.departmentId}` : c.id;
                const sentAt = sentMap.get(c.id);
                return (
                  <tr key={rowKey} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1 text-center text-xs text-slate-300">{idx + 1}</td>
                    <td className="px-3 py-1">
                      <span className="font-medium text-slate-800">{c.name}</span>
                      {c.autoNotify && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-px text-[10px] font-medium text-blue-700" title="Automatske obavijesti">AUTO</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right">
                      <TotalCell totalDue={c.totalDue} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right">
                      <DoneCell
                        totalDue={c.totalDue}
                        alreadyServiced={c.alreadyServiced}
                        pickedUp={c.pickedUp}
                      />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sentAt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            {formatDate(sentAt)}
                          </span>
                        )}
                        {c.email && gmailConnected ? (
                          <Link
                            href={composeUrl(c, "due")}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            Mail
                          </Link>
                        ) : (
                          !sentAt && (
                            <span className="text-[11px] text-slate-300">{!c.email ? "Nema emaila" : ""}</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDue.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-400" colSpan={5}>
                    {filter === "pending" ? "Svi aparati su servisirani." : "Nema aparata koji ističu u ovom mjesecu."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Table 2: Overdue */}
      <section className="surface">
        <div className="px-4 pt-2.5 pb-2">
          <h2 className="text-sm font-semibold">
            Zaostaci — isteklo ranije
            <span className="ml-1.5 font-normal text-slate-400">
              ({totalOverdueItems} aparata, {totalOverdueCustomers} kupaca)
            </span>
          </h2>
        </div>
        <div className="h-px bg-black/10" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium text-slate-500">
                <th className="w-10 px-3 py-1.5 text-center">#</th>
                <th className="px-3 py-1.5">Kupac</th>
                <th className="w-24 whitespace-nowrap px-3 py-1.5 text-right">Količina</th>
                <th className="w-44 px-3 py-1.5 text-right">Obavijest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOverdue.map((c, idx) => {
                const rowKey = c.departmentId ? `${c.id}::${c.departmentId}` : c.id;
                const sentAt = sentMap.get(c.id);
                return (
                  <tr key={rowKey} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1 text-center text-xs text-slate-300">{idx + 1}</td>
                    <td className="px-3 py-1">
                      <span className="font-medium text-slate-800">{c.name}</span>
                      {c.autoNotify && (
                        <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-px text-[10px] font-medium text-blue-700" title="Automatske obavijesti">AUTO</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right">
                      <TotalCell totalDue={c.totalDue} />
                    </td>
                    <td className="px-3 py-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sentAt && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            {formatDate(sentAt)}
                          </span>
                        )}
                        {c.email && gmailConnected ? (
                          <Link
                            href={composeUrl(c, "overdue")}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            Mail
                          </Link>
                        ) : (
                          !sentAt && (
                            <span className="text-[11px] text-slate-300">{!c.email ? "Nema emaila" : ""}</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOverdue.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-400" colSpan={4}>
                    {filter === "pending" ? "Svi zaostali aparati su preuzeti ili servisirani." : "Nema zaostataka."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {overdueHidden > 0 && (
          <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-400">
            i još {overdueHidden} kupaca…
          </div>
        )}
      </section>
    </div>
  );
}
