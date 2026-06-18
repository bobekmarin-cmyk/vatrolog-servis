"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "PENDING_INVITE" | "REQUESTED" | "ACTIVE" | "DECLINED" | "REVOKED" | null;

const STATUS_LABEL: Record<NonNullable<Status>, { label: string; cls: string }> = {
  PENDING_INVITE: { label: "Administrator pozvan", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  REQUESTED: { label: "Zahtjev za pristup", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  ACTIVE: { label: "Moji aparati dijeljeni", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  DECLINED: { label: "Odbijeno", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  REVOKED: { label: "Pristup povučen", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

export default function CustomerPortalAccountsCard({
  customerId,
  customerEmail,
  linkStatus,
  invitedEmail,
  existingPortalForOib = false,
  portalActive,
  hasPendingInvite,
}: {
  customerId: string;
  customerEmail: string | null;
  linkStatus: Status;
  invitedEmail: string | null;
  existingPortalForOib?: boolean;
  portalActive: boolean;
  hasPendingInvite: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(invitedEmail ?? customerEmail ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    action: "invite" | "revoke" | "share" | "approve" | "decline",
    payload: { email?: string } = {},
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
  // Serviser poziva admina samo kad portal još ne postoji niti je pozivnica poslana.
  const showInvite = !portalActive && !hasPendingInvite && linkStatus !== "REQUESTED";

  return (
    <section className="surface">
      <div className="surface-header flex items-center justify-between">
        <h2 className="h1">Korisnički portal</h2>
        {badge ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        ) : portalActive ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Portal aktivan
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            Nije aktiviran
          </span>
        )}
      </div>
      <div className="surface-body space-y-4">
        <p className="text-sm text-slate-600">
          Pošaljite vlasniku pozivnicu za administratora Korisničkog portala (jedan račun). Administrator zatim sam, u
          portalu, dodaje ostale korisničke račune svoje tvrtke i upravlja njihovim ovlastima — vi ne upravljate tuđim
          računima niti vidite njihov popis.
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
            <div className="text-sm font-semibold text-blue-900">Ovaj vlasnik već koristi Korisnički portal</div>
            <p className="mt-1 text-sm text-blue-800">
              Za ovaj OIB portal je već aktiviran. Možete povezati i svoje aparate s vlasnikovim portalom — vlasnik tada
              vidi i vaše aparate. Time dajete privolu da se vaši aparati prikažu vlasniku.
            </p>
            <button type="button" className="btn btn-primary mt-3 h-9" disabled={busy !== null} onClick={() => call("share")}>
              {busy === "share" ? "Povezivanje…" : "Poveži moje aparate"}
            </button>
          </div>
        ) : null}

        {portalActive ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Portal je aktivan. Administrator tvrtke upravlja korisničkim računima u portalu.
          </div>
        ) : hasPendingInvite ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Pozivnica administratoru{invitedEmail ? ` (${invitedEmail})` : ""} je poslana i čeka aktivaciju.
            </p>
            <button
              type="button"
              className="btn mt-2 h-9 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              disabled={busy !== null || !email}
              onClick={async () => {
                const ok = await call("invite", { email }, "resend");
                if (ok) setMsg("Pozivnica je ponovno poslana.");
              }}
            >
              {busy === "resend" ? "Slanje…" : "Pošalji ponovno"}
            </button>
          </div>
        ) : null}

        {showInvite ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="portal-invite-email">E-mail administratora (vlasnika)</label>
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
                if (ok) setMsg("Pozivnica administratoru je poslana.");
              }}
            >
              {busy === "invite" ? "Slanje…" : "Pošalji pozivnicu"}
            </button>
          </div>
        ) : null}

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
