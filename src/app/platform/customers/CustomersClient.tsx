"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Company = { id: string; name: string; serviceCode: string };
type Row = {
  id: string;
  name: string;
  fullName: string;
  oib: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  deletedAt: string | null;
  type: string;
  company: { id: string; name: string; serviceCode: string };
};

export default function CustomersClient({ companies }: { companies: Company[] }) {
  const [q, setQ] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (companyId) params.set("companyId", companyId);
      if (includeDeleted) params.set("includeDeleted", "1");
      params.set("page", String(page));
      const res = await fetch(`/api/platform/customers?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška.");
      setRows(data.rows);
      setTotal(data.total);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 50)), [total]);

  return (
    <div className="space-y-4">
      <section className="surface space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs uppercase text-slate-500">Pretraga (ime / OIB / email / telefon)</label>
            <input
              className="input mt-1 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  load();
                }
              }}
              placeholder="npr. 12345678901 ili Marin"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Tvrtka</label>
            <select className="input mt-1 w-full" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">— Sve —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.serviceCode} · {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            Uključi obrisane
          </label>
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={() => {
              setPage(1);
              load();
            }}
            disabled={loading}
          >
            {loading ? "Učitavam…" : "Pretraži"}
          </button>
          <button
            type="button"
            className="btn btn-outline px-3"
            onClick={() => {
              setQ("");
              setCompanyId("");
              setIncludeDeleted(false);
              setPage(1);
              setTimeout(load, 0);
            }}
          >
            Resetiraj
          </button>
          <span className="ml-auto text-sm text-slate-500">{total} kupaca</span>
        </div>
      </section>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <section className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2">Tvrtka</th>
              <th className="px-3 py-2">Naziv</th>
              <th className="px-3 py-2">OIB</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Telefon</th>
              <th className="px-3 py-2">Grad</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={["hover:bg-slate-50/60", r.deletedAt ? "opacity-60" : ""].join(" ")}>
                <td className="px-3 py-2 text-xs">
                  <Link href={`/platform/companies/${r.company.id}`} className="text-blue-700 hover:underline">
                    {r.company.serviceCode} · {r.company.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs font-medium">
                  {r.name}
                  {r.deletedAt && (
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">obrisan</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.oib}</td>
                <td className="px-3 py-2 text-xs">{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.phone ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.city ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/platform/customers/${r.id}`}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Detalji →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nema kupaca za odabrane filtere.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn btn-outline px-3 py-1 text-xs"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prethodna
          </button>
          <span className="text-sm text-slate-500">Stranica {page} od {totalPages}</span>
          <button
            type="button"
            className="btn btn-outline px-3 py-1 text-xs"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Sljedeća →
          </button>
        </div>
      )}
    </div>
  );
}
