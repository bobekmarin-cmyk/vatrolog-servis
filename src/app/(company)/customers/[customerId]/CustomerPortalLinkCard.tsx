"use client";

import { useState } from "react";

export default function CustomerPortalLinkCard({
  customerId,
  initialSecret,
}: {
  customerId: string;
  initialSecret: string | null;
}) {
  const [secret, setSecret] = useState<string | null>(initialSecret);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const url = secret ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${secret}` : null;

  async function call(action: "ensure" | "regenerate" | "revoke"): Promise<void> {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/portal-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok?: boolean; portalSecret?: string | null; error?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.error ?? "Greška.");
        return;
      }
      setSecret(data.portalSecret ?? null);
      setMsg(
        action === "revoke"
          ? "Portal link je povučen."
          : action === "regenerate"
            ? "Generiran novi portal link."
            : "Portal link je aktivan.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface">
      <div className="surface-header">
        <h2 className="h1">Customer portal</h2>
      </div>
      <div className="surface-body space-y-3">
        <p className="text-sm text-slate-600">
          Javni read-only link koji možete poslati kupcu. Prikazuje pregled aparata i rokove bez potrebe za prijavom.
        </p>

        {secret ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal URL</div>
              <div className="mt-1 break-all font-mono text-sm">{url}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline h-9"
                disabled={loading}
                onClick={async () => {
                  if (url) {
                    try {
                      await navigator.clipboard.writeText(url);
                      setMsg("Link kopiran u međuspremnik.");
                    } catch {
                      setMsg("Ne mogu kopirati — označite ručno.");
                    }
                  }
                }}
              >
                Kopiraj link
              </button>
              <button type="button" className="btn btn-outline h-9" disabled={loading} onClick={() => call("regenerate")}>
                Regeneriraj
              </button>
              <button
                type="button"
                className="btn h-9 border border-red-300 bg-white text-red-700 hover:bg-red-50"
                disabled={loading}
                onClick={() => call("revoke")}
              >
                Povuci pristup
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-primary h-9" disabled={loading} onClick={() => call("ensure")}>
            Generiraj portal link
          </button>
        )}

        {msg ? <div className="text-sm text-slate-700">{msg}</div> : null}
      </div>
    </section>
  );
}
