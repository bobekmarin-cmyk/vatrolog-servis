"use client";

import { useState } from "react";

type Status = "PENDING_INVITE" | "ACTIVE" | "DECLINED" | "REVOKED" | null;

const STATUS_LABEL: Record<NonNullable<Status>, { label: string; cls: string }> = {
  PENDING_INVITE: { label: "Pozvan (čeka aktivaciju)", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  ACTIVE: { label: "Aktivan", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  DECLINED: { label: "Odbijeno", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  REVOKED: { label: "Pristup povučen", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

export default function CustomerPortalInviteCard({
  customerId,
  customerEmail,
  initialStatus,
  initialInvitedEmail,
  existingPortalForOib = false,
}: {
  customerId: string;
  customerEmail: string | null;
  initialStatus: Status;
  initialInvitedEmail: string | null;
  existingPortalForOib?: boolean;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [email, setEmail] = useState(initialInvitedEmail ?? customerEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "invite" | "revoke" | "share") {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/portal-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: Status; email?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Greška.");
        return;
      }
      setStatus(data.status ?? null);
      setMsg(
        action === "revoke"
          ? "Pristup je povučen."
          : action === "share"
            ? "Vaši aparati su povezani s postojećim računom vlasnika."
            : `Pozivnica poslana na ${data.email}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const badge = status ? STATUS_LABEL[status] : null;

  return (
    <section className="surface">
      <div className="surface-header flex items-center justify-between">
        <h2 className="h1">Korisnički portal</h2>
        {badge ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            Nije pozvan
          </span>
        )}
      </div>
      <div className="surface-body space-y-3">
        <p className="text-sm text-slate-600">
          Pošaljite vlasniku pozivnicu za prijavu u Korisnički portal (vlastiti račun s lozinkom). U portalu vidi svoje
          aparate, naloge i otpremnice te vodi evidenciju redovnih pregleda.
        </p>

        {existingPortalForOib && status !== "ACTIVE" ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-sm font-semibold text-blue-900">Ovaj kupac već koristi Korisnički portal</div>
            <p className="mt-1 text-sm text-blue-800">
              Za ovaj OIB postoji aktivan račun vlasnika (aktivirao ga je drugi servis). Možete povezati i svoje aparate
              s njegovim postojećim računom — vlasnik tada vidi i vaše aparate. Time dajete privolu da se vaši aparati
              prikažu vlasniku.
            </p>
            <button type="button" className="btn btn-primary mt-3 h-9" disabled={busy} onClick={() => call("share")}>
              {busy ? "Povezivanje…" : "Poveži moje aparate"}
            </button>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="portal-invite-email">E-mail vlasnika</label>
            <input
              id="portal-invite-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="npr. vlasnik@tvrtka.hr"
              disabled={busy}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary h-10" disabled={busy || !email} onClick={() => call("invite")}>
              {status === "PENDING_INVITE" || status === "ACTIVE" ? "Pošalji ponovno" : "Pošalji pozivnicu"}
            </button>
            {status === "ACTIVE" || status === "PENDING_INVITE" ? (
              <button
                type="button"
                className="btn h-10 border border-red-300 bg-white text-red-700 hover:bg-red-50"
                disabled={busy}
                onClick={() => call("revoke")}
              >
                Povuci
              </button>
            ) : null}
          </div>
        </div>

        {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </div>
    </section>
  );
}
