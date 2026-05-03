"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ExtinguisherStatusIcon from "@/components/ExtinguisherStatusIcon";
import { type ExtStatus } from "@/lib/extinguisherStatus";

type RowData = {
  id: string;
  internalCode: string;
  manufacturer: string;
  typeName: string;
  serial: string;
  year: number;
  labelNumber: string;
  servicedAt: string;
  ppDue: string;
  ppStatus: "valid" | "expired" | "soon" | "none";
  upDue: string;
  upStatus: "valid" | "expired" | "soon" | "none";
  status: ExtStatus;
  statusLabel: string;
  workOrderId: string;
  orderNumber: string;
};

const DUE_BADGE: Record<RowData["ppStatus"], { cls: string; label: string }> = {
  valid: { cls: "badge-success", label: "Vrijedi" },
  expired: { cls: "badge-danger", label: "Istekao" },
  soon: { cls: "badge-warning", label: "Uskoro" },
  none: { cls: "badge-neutral", label: "Nema" },
};

export default function CustomerExtinguisherTable({ rows }: { rows: RowData[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.internalCode.toLowerCase().includes(q) ||
        r.manufacturer.toLowerCase().includes(q) ||
        r.typeName.toLowerCase().includes(q) ||
        r.serial.toLowerCase().includes(q) ||
        r.labelNumber.toLowerCase().includes(q) ||
        r.orderNumber.toLowerCase().includes(q) ||
        r.statusLabel.toLowerCase().includes(q) ||
        String(r.year).includes(q),
    );
  }, [rows, query]);

  return (
    <section className="surface">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold">
          Aparati ({filtered.length}{query.trim() ? ` / ${rows.length}` : ""})
        </h2>
        <div className="flex items-center gap-1">
          {searchOpen ? (
            <>
              <input
                type="text"
                className="input h-8 w-48 text-xs"
                placeholder="Interni kod, serijski, naljepnica..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-outline h-8 w-8 p-0 text-xs"
                title="Zatvori pretragu"
                onClick={() => { setSearchOpen(false); setQuery(""); }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-outline h-8 w-8 p-0 text-base"
              title="Pretraži"
              onClick={() => setSearchOpen(true)}
            >
              🔍
            </button>
          )}
        </div>
      </div>
      <div className="h-px bg-black/10" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Interni kod</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Proizvođač</th>
              <th className="px-3 py-2">Tip</th>
              <th className="px-3 py-2">Serijski</th>
              <th className="px-3 py-2">God.</th>
              <th className="px-3 py-2">Naljepnica</th>
              <th className="px-3 py-2">Zadnji servis</th>
              <th className="px-3 py-2">PP rok</th>
              <th className="px-3 py-2">UP rok</th>
              <th className="px-3 py-2">Nalog</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const ppb = DUE_BADGE[r.ppStatus];
              const upb = DUE_BADGE[r.upStatus];
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-mono font-medium">{r.internalCode}</td>
                  <td className="px-3 py-2">
                    <ExtinguisherStatusIcon status={r.status} />
                  </td>
                  <td className="px-3 py-2">{r.manufacturer}</td>
                  <td className="px-3 py-2">{r.typeName}</td>
                  <td className="px-3 py-2">{r.serial}</td>
                  <td className="px-3 py-2 tabular-nums">{r.year}</td>
                  <td className="px-3 py-2">{r.labelNumber}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.servicedAt}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className={`badge badge-tight ${ppb.cls}`}>{ppb.label}</span>
                      <span className="text-slate-500">{r.ppDue}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className={`badge badge-tight ${upb.cls}`}>{upb.label}</span>
                      <span className="text-slate-500">{r.upDue}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/work-orders/${r.workOrderId}`} className="text-blue-600 hover:underline">
                      {r.orderNumber}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-400 text-center" colSpan={11}>
                  {query.trim() ? "Nema rezultata za zadanu pretragu." : "Nema aparata za ovog kupca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
