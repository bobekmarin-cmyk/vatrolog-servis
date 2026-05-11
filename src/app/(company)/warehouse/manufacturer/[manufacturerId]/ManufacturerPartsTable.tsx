"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  partId: string;
  displayCode: string;
  manufacturerCode: string | null;
  name: string;
  stockQty: number;
  minStockQty: number;
  hasStockRow: boolean;
  active: boolean;
  partActive: boolean;
  isCustom: boolean;
};

function statusFor(r: Row): { label: string; className: string } {
  if (!r.partActive || !r.active) {
    return { label: "Neaktivan", className: "bg-slate-200 text-slate-600" };
  }
  if (r.stockQty < 0) return { label: "U minusu", className: "bg-rose-100 text-rose-900" };
  if (r.minStockQty > 0 && r.stockQty <= r.minStockQty) {
    return { label: "Ispod min.", className: "bg-amber-100 text-amber-900" };
  }
  if (r.stockQty === 0) return { label: "Prazno", className: "bg-slate-100 text-slate-600" };
  return { label: "OK", className: "bg-emerald-100 text-emerald-900" };
}

export default function ManufacturerPartsTable({
  manufacturerId,
  rows,
  returnTo,
}: {
  manufacturerId: string;
  rows: Row[];
  returnTo: string;
}) {
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter((r) => {
      const inactive = !r.partActive || !r.active;
      if (!showInactive && inactive) return false;
      if (!f) return true;
      return (
        r.displayCode.toLowerCase().includes(f) ||
        (r.manufacturerCode ?? "").toLowerCase().includes(f) ||
        r.name.toLowerCase().includes(f)
      );
    });
  }, [rows, filter, showInactive]);

  const inactiveCount = rows.filter((r) => !r.partActive || !r.active).length;

  const settingsLink =
    `/admin/settings/parts?manufacturerId=${encodeURIComponent(manufacturerId)}` +
    `&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Pretraži šifru ili naziv…"
          className="input h-9 w-full max-w-md flex-1"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Prikaži neaktivne{inactiveCount > 0 ? ` (${inactiveCount})` : ""}
        </label>
        <Link href={settingsLink} className="btn btn-primary h-9">
          + Dodaj vlastiti dio
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Izvor</th>
                <th className="px-3 py-2">Šifra</th>
                <th className="px-3 py-2">Šifra proizvođača</th>
                <th className="px-3 py-2">Naziv</th>
                <th className="px-3 py-2 text-right">Stanje</th>
                <th className="px-3 py-2 text-right">Min.</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const st = statusFor(r);
                const inactive = !r.partActive || !r.active;
                return (
                  <tr key={r.partId} className={`hover:bg-slate-50 ${inactive ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      {r.isCustom ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                          Vlastiti
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          Dijelovi proizvođača
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.displayCode || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {r.manufacturerCode ? r.manufacturerCode : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/warehouse/parts/${r.partId}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.stockQty < 0 ? "font-bold text-rose-700" : ""
                      }`}
                    >
                      {r.stockQty}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {r.minStockQty}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/warehouse/parts/${r.partId}`}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        Kartica →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    Nema dijelova za prikaz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
