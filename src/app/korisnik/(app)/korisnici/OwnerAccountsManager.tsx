"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = {
  ownerId: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  lastAccessAt: string | null;
  isSelf: boolean;
};

type Pending = {
  email: string;
  role: "ADMIN" | "MEMBER";
  invitedAt: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

const ROLE_LABEL: Record<"ADMIN" | "MEMBER", string> = { ADMIN: "Administrator", MEMBER: "Član" };

export default function OwnerAccountsManager({
  accounts,
  pending,
}: {
  accounts: Account[];
  pending: Pending[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    action: "invite" | "revoke" | "resetPassword" | "setRole",
    payload: Record<string, unknown>,
    busyKey: string,
  ): Promise<boolean> {
    setBusy(busyKey);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/portal/accounts", {
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

  return (
    <div className="space-y-6">
      {/* Pozivnica */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Pozovi korisnika</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pozivnica se šalje s naše adrese. Primatelj klikom postavlja lozinku i dobiva pristup portalu vaše tvrtke.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="invite-email">E-mail</label>
            <input
              id="invite-email"
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kolega@tvrtka.hr"
              disabled={busy !== null}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="invite-role">Uloga</label>
            <select
              id="invite-role"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              value={role}
              onChange={(e) => setRole(e.target.value === "ADMIN" ? "ADMIN" : "MEMBER")}
              disabled={busy !== null}
            >
              <option value="MEMBER">Član</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <button
            type="button"
            className="h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
            disabled={busy !== null || !email}
            onClick={async () => {
              const ok = await call("invite", { email, role }, "invite");
              if (ok) {
                setMsg("Pozivnica je poslana.");
                setEmail("");
                setRole("MEMBER");
              }
            }}
          >
            {busy === "invite" ? "Slanje…" : "Pošalji pozivnicu"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <strong>Administrator</strong> može upravljati računima (pozivati, povlačiti, mijenjati uloge).{" "}
          <strong>Član</strong> koristi portal, ali ne upravlja računima.
        </p>
      </section>

      {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {/* Aktivni računi */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Aktivni računi</h2>
        {accounts.map((a) => (
          <div
            key={a.ownerId}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{a.email}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.role === "ADMIN" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {ROLE_LABEL[a.role]}
                </span>
                {a.isSelf ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Vi</span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {a.name ? `${a.name} · ` : ""}Zadnji pristup: {formatDate(a.lastAccessAt)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {!a.isSelf ? (
                <>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() =>
                      call("setRole", { ownerId: a.ownerId, role: a.role === "ADMIN" ? "MEMBER" : "ADMIN" }, `role-${a.ownerId}`)
                    }
                  >
                    {busy === `role-${a.ownerId}` ? "…" : a.role === "ADMIN" ? "Postavi kao člana" : "Postavi kao admina"}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      const ok = await call("resetPassword", { ownerId: a.ownerId }, `reset-${a.ownerId}`);
                      if (ok) setMsg("E-mail za reset lozinke je poslan.");
                    }}
                  >
                    {busy === `reset-${a.ownerId}` ? "…" : "Reset lozinke"}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => {
                      if (confirm(`Povući pristup za ${a.email}?`)) {
                        void call("revoke", { ownerId: a.ownerId }, `revoke-${a.ownerId}`);
                      }
                    }}
                  >
                    {busy === `revoke-${a.ownerId}` ? "…" : "Povuci pristup"}
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400">Vlastiti račun</span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Pozivnice na čekanju */}
      {pending.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">Pozivnice na čekanju</h2>
          {pending.map((p) => (
            <div
              key={p.email}
              className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-amber-900">{p.email}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    {ROLE_LABEL[p.role]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-amber-700">Pozvan: {formatDate(p.invitedAt)} · čeka aktivaciju</div>
              </div>
              <button
                type="button"
                className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                disabled={busy !== null}
                onClick={async () => {
                  const ok = await call("invite", { email: p.email, role: p.role }, `resend-${p.email}`);
                  if (ok) setMsg("Pozivnica je ponovno poslana.");
                }}
              >
                {busy === `resend-${p.email}` ? "…" : "Pošalji ponovno"}
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
