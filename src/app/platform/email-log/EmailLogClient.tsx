"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Company = { id: string; name: string; serviceCode: string };
type Row = {
  id: string;
  sentAt: string;
  company: { id: string; name: string; serviceCode: string } | null;
  customer: { id: string; name: string } | null;
  accountUser: { id: string; username: string } | null;
  toEmail: string;
  subject: string;
  kind: string;
  transport: string | null;
  status: string;
  error: string | null;
};

const TRANSPORTS = ["VENDOR_GMAIL", "TENANT_GMAIL", "SMTP", "DEV_LOG"] as const;
const KINDS = [
  "CUSTOMER_NOTIFICATION",
  "PASSWORD_RESET",
  "ACCOUNT_INVITE",
  "EMAIL_VERIFY",
  "SUBSCRIPTION_EXPIRY",
  "MONTHLY_REMINDER",
  "VENDOR_TEST",
  "OTHER",
] as const;

export default function EmailLogClient({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState("");
  const [transport, setTransport] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
      if (companyId) params.set("companyId", companyId);
      if (transport) params.set("transport", transport);
      if (kind) params.set("kind", kind);
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      const res = await fetch(`/api/platform/email-log?${params.toString()}`, { cache: "no-store" });
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            <label className="text-xs uppercase text-slate-500">Transport</label>
            <select className="input mt-1 w-full" value={transport} onChange={(e) => setTransport(e.target.value)}>
              <option value="">— Svi —</option>
              {TRANSPORTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Vrsta</label>
            <select className="input mt-1 w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">— Sve —</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Status</label>
            <select className="input mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">— Svi —</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs uppercase text-slate-500">Pretraga (email/predmet)</label>
            <input className="input mt-1 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="dio email-a ili subjecta" />
          </div>
          <div>
            <label htmlFor="emaillog-from" className="text-xs uppercase text-slate-500">Od</label>
            <input id="emaillog-from" type="date" className="input mt-1 w-full" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Datum od" />
          </div>
          <div>
            <label htmlFor="emaillog-to" className="text-xs uppercase text-slate-500">Do</label>
            <input id="emaillog-to" type="date" className="input mt-1 w-full" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Datum do" />
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
              setTransport("");
              setKind("");
              setStatus("");
              setQ("");
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
              <th className="px-3 py-2">Primatelj</th>
              <th className="px-3 py-2">Predmet</th>
              <th className="px-3 py-2">Vrsta</th>
              <th className="px-3 py-2">Transport</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {new Date(r.sentAt).toLocaleString("hr-HR")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {r.company ? (
                    <Link href={`/platform/companies/${r.company.id}`} className="text-blue-700 hover:underline">
                      {r.company.serviceCode} · {r.company.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">platforma</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="font-mono">{r.toEmail}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.customer ? `Kupac: ${r.customer.name}` : r.accountUser ? `User: ${r.accountUser.username}` : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs max-w-[220px] truncate" title={r.subject}>{r.subject}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{r.kind}</span>
                </td>
                <td className="px-3 py-2 text-xs">{r.transport ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.status === "SENT" ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">SENT</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700" title={r.error ?? ""}>
                      FAILED
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nema zapisa za odabrane filtere.
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
