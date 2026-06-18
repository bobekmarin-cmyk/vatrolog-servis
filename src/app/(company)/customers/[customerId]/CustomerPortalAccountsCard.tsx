"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "PENDING_INVITE" | "REQUESTED" | "ACTIVE" | "DECLINED" | "REVOKED" | null;

export type AccountRow = {
  ownerId: string;
  email: string;
  name: string | null;
  lastAccessAt: string | null;
  invitedByThisCompany: boolean;
};

export type PendingRow = {
  email: string;
  invitedByThisCompany: boolean;
};

const STATUS_LABEL: Record<NonNullable<Status>, { label: string; cls: string }> = {
  PENDING_INVITE: { label: "Pozvan (čeka aktivaciju)", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  REQUESTED: { label: "Zahtjev za pristup", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  ACTIVE: { label: "Aktivan", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  DECLINED: { label: "Odbijeno", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  REVOKED: { label: "Pristup povučen", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "nikad";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
}

export default function CustomerPortalAccountsCard({
  customerId,
  customerEmail,
  linkStatus,
  invitedEmail,
  existingPortalForOib = false,
  accounts,
  pendingInvites,
}: {
  customerId: string;
  customerEmail: string | null;
  linkStatus: Status;
  invitedEmail: string | null;
  existingPortalForOib?: boolean;
  accounts: AccountRow[];
  pendingInvites: PendingRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    action: "invite" | "revoke" | "share" | "approve" | "decline" | "cancelInvite" | "resetPassword",
    payload: { email?: string; ownerId?: string } = {},
    busyKey: string = action,
  ): Promise<boolean> {
    setBusy(busyKey);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/portal-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Greška.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const badge = linkStatus ? STATUS_LABEL[linkStatus] : null;
  const hasAny = accounts.length > 0 || pendingInvites.length > 0;

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
      <div className="surface-body space-y-4">
        <p className="text-sm text-slate-600">
          Pošaljite vlasniku pozivnice za prijavu u Korisnički portal (vlastiti račun s lozinkom). Možete dodati više
          računa za istu tvrtku. Računi su vezani uz vlasnika (OIB) pa su vidljivi i ostalim servisima koji mu
          servisiraju aparate.
        </p>

        {linkStatus === "REQUESTED" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-900">Vlasnik traži pristup vašim aparatima</div>
            <p className="mt-1 text-sm text-amber-800">
              Vlasnik{invitedEmail ? ` (${invitedEmail})` : ""} zatražio je da u svom Korisničkom portalu vidi i aparate
              koje vaš servis servisira za ovog kupca. Odobravanjem dajete privolu da se vaši aparati prikažu vlasniku.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary h-9" disabled={busy !== null} onClick={() => call("approve")}>
                {busy === "approve" ? "Obrada…" : "Odobri"}
              </button>
              <button
                type="button"
                className="btn h-9 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                disabled={busy !== null}
                onClick={() => call("decline")}
              >
                Odbij
              </button>
            </div>
          </div>
        ) : null}

        {existingPortalForOib && linkStatus !== "ACTIVE" && linkStatus !== "REQUESTED" ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-sm font-semibold text-blue-900">Ovaj kupac već koristi Korisnički portal</div>
            <p className="mt-1 text-sm text-blue-800">
              Za ovaj OIB postoji aktivan račun vlasnika (aktivirao ga je drugi servis). Možete povezati i svoje aparate
              s njegovim postojećim računom — vlasnik tada vidi i vaše aparate.
            </p>
            <button type="button" className="btn btn-primary mt-3 h-9" disabled={busy !== null} onClick={() => call("share")}>
              {busy === "share" ? "Povezivanje…" : "Poveži moje aparate"}
            </button>
          </div>
        ) : null}

        {/* Aktivni računi */}
        {hasAny ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Račun</th>
                  <th className="px-3 py-2">Zadnji pristup</th>
                  <th className="px-3 py-2">Pozvao</th>
                  <th className="px-3 py-2 text-right">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((a) => (
                  <tr key={a.ownerId}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{a.email}</div>
                      {a.name ? <div className="text-xs text-slate-500">{a.name}</div> : null}
                      <span className="mt-0.5 inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Aktivan
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(a.lastAccessAt)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {a.invitedByThisCompany ? "Vi" : "Drugi račun"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn h-8 border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                          disabled={busy !== null}
                          onClick={() => call("resetPassword", { ownerId: a.ownerId }, `reset-${a.ownerId}`)}
                        >
                          {busy === `reset-${a.ownerId}` ? "…" : "Reset lozinke"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingInvites.map((p) => (
                  <tr key={`pending-${p.email}`} className="bg-amber-50/40">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{p.email}</div>
                      <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        Pozvan
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 text-slate-600">
                      {p.invitedByThisCompany ? "Vi" : "Drugi račun"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn h-8 border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                          disabled={busy !== null}
                          onClick={() => call("invite", { email: p.email }, `resend-${p.email}`)}
                        >
                          {busy === `resend-${p.email}` ? "…" : "Pošalji ponovno"}
                        </button>
                        <button
                          type="button"
                          className="btn h-8 border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
                          disabled={busy !== null}
                          onClick={() => call("cancelInvite", { email: p.email }, `cancel-${p.email}`)}
                        >
                          {busy === `cancel-${p.email}` ? "…" : "Otkaži"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Još nema dodanih korisničkih računa za ovog vlasnika.</p>
        )}

        {/* Dodaj novi račun */}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="portal-invite-email">Dodaj račun (e-mail)</label>
            <input
              id="portal-invite-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={customerEmail ?? "npr. vlasnik@tvrtka.hr"}
              disabled={busy !== null}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary h-10"
            disabled={busy !== null || !email}
            onClick={async () => {
              const ok = await call("invite", { email }, "invite");
              if (ok) {
                setEmail("");
                setMsg("Pozivnica je poslana.");
              }
            }}
          >
            {busy === "invite" ? "Slanje…" : "Pošalji pozivnicu"}
          </button>
        </div>

        {linkStatus === "ACTIVE" || linkStatus === "PENDING_INVITE" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-800">Povuci pristup mojim aparatima</div>
            <p className="mt-1 text-xs text-slate-600">
              Vlasnik više neće vidjeti aparate, naloge i dokumente koje servisira <strong>vaš</strong> servis. Aparati
              drugih servisa i korisnički računi ostaju aktivni — ovo utječe samo na vaše podatke.
            </p>
            <button
              type="button"
              className="btn mt-2 h-9 border border-red-300 bg-white text-red-700 hover:bg-red-50"
              disabled={busy !== null}
              onClick={() => {
                if (confirm("Povući pristup vašim aparatima iz portala ovog vlasnika? Aparati drugih servisa ostaju vidljivi.")) {
                  void call("revoke");
                }
              }}
            >
              {busy === "revoke" ? "Povlačenje…" : "Povuci pristup mojim aparatima"}
            </button>
          </div>
        ) : null}

        {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </div>
    </section>
  );
}
