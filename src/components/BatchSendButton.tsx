"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CustomerItem {
  id: string;
  name: string;
  email: string;
  count: number;
  type: "due" | "overdue";
}

interface Props {
  month: string;
  customers: CustomerItem[];
}

export default function BatchSendButton({ month, customers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ id: string; ok: boolean; error?: string }[] | null>(null);

  async function handleSend() {
    setSending(true);
    setResults(null);
    try {
      const res = await fetch("/api/gmail/send-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          customers: customers.map((c) => ({
            customerId: c.id,
            itemCount: c.count,
            templateType: c.type === "overdue" ? "AFTER_EXPIRY" : "BEGINNING",
          })),
        }),
      });

      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }
      router.refresh();
    } catch {
      setResults([{ id: "error", ok: false, error: "Mrežna greška" }]);
    } finally {
      setSending(false);
    }
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <>
      <button className="btn btn-primary px-4" onClick={() => setOpen(true)}>
        Pošalji svima ({customers.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold">Slanje automatskih obavijesti</h3>

            {!results ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Sljedeći kupci s uključenim automatskim obavijestima dobit će email:
                </p>
                <div className="mt-3 max-h-60 overflow-y-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-1.5">Kupac</th>
                        <th className="px-3 py-1.5">Email</th>
                        <th className="px-3 py-1.5 text-right">Kom</th>
                        <th className="px-3 py-1.5">Vrsta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customers.map((c) => (
                        <tr key={c.id + c.type}>
                          <td className="px-3 py-1.5 font-medium">{c.name}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">{c.email}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{c.count}</td>
                          <td className="px-3 py-1.5 text-xs">{c.type === "overdue" ? "Zaostatak" : "Istek"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn btn-outline px-4" onClick={() => setOpen(false)} disabled={sending}>
                    Odustani
                  </button>
                  <button className="btn btn-primary px-4" onClick={handleSend} disabled={sending}>
                    {sending ? "Šaljem…" : `Pošalji (${customers.length})`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 space-y-2">
                  {successCount > 0 && (
                    <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      Uspješno poslano: {successCount}
                    </div>
                  )}
                  {failCount > 0 && (
                    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                      Neuspješno: {failCount}
                      <ul className="mt-1 text-xs">
                        {results.filter((r) => !r.ok).map((r) => (
                          <li key={r.id}>{r.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button className="btn btn-primary px-4" onClick={() => { setOpen(false); setResults(null); }}>
                    Zatvori
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
