"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Company = { id: string; name: string; serviceCode: string };

type Row = {
  id: string;
  createdAt: string;
  company: { id: string; name: string; serviceCode: string } | null;
  actor: { id: string; username: string } | null;
  actorType: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
};

export default function AuditClient({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openMeta, setOpenMeta] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      const res = await fetch(`/api/platform/audit?${params.toString()}`, { cache: "no-store" });
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          <div>
            <label className="text-xs uppercase text-slate-500">Akcija (contains)</label>
            <input className="input mt-1 w-full" value={action} onChange={(e) => setAction(e.target.value)} placeholder="npr. company.impersonate" />
          </div>
          <div>
            <label htmlFor="audit-from" className="text-xs uppercase text-slate-500">Od</label>
            <input id="audit-from" type="date" className="input mt-1 w-full" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Datum od" />
          </div>
          <div>
            <label htmlFor="audit-to" className="text-xs uppercase text-slate-500">Do</label>
            <input id="audit-to" type="date" className="input mt-1 w-full" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Datum do" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={() => {
              setPage(1);
              load();
            }}
            disabled={loading}
          >
            {loading ? "Učitavam…" : "Filtriraj"}
          </button>
          <button
            type="button"
            className="btn btn-outline px-3"
            onClick={() => {
              setCompanyId("");
              setAction("");
              setFrom("");
              setTo("");
              setPage(1);
              setTimeout(load, 0);
            }}
          >
            Resetiraj
          </button>
          <span className="ml-auto text-sm text-slate-500">{total} zapisa</span>
        </div>
      </section>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <section className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Tvrtka</th>
              <th className="px-3 py-2">Akter</th>
              <th className="px-3 py-2">Akcija</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const isImp = r.action.startsWith("company.impersonate");
              return (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(r.createdAt).toLocaleString("hr-HR")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {r.company ? (
                      <Link href={`/platform/companies/${r.company.id}`} className="text-blue-700 hover:underline">
                        {r.company.serviceCode} · {r.company.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.actor ? r.actor.username : <span className="text-slate-400">{r.actorType}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-mono">{r.action}</span>
                    {isImp && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        IMPERSONATION
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.entity ? `${r.entity}${r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:underline"
                      onClick={() => setOpenMeta(openMeta === r.id ? null : r.id)}
                    >
                      {openMeta === r.id ? "Sakrij" : "Detalji"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nema zapisa za odabrane filtere.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {openMeta && (() => {
        const r = rows.find((x) => x.id === openMeta);
        if (!r) return null;
        return (
          <section className="surface space-y-2 p-4 text-xs">
            <div className="font-semibold">Meta · {r.action}</div>
            <pre className="whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
              {JSON.stringify(r.meta, null, 2)}
            </pre>
            {r.ip && <div className="text-slate-500">IP: {r.ip}</div>}
          </section>
        );
      })()}

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
