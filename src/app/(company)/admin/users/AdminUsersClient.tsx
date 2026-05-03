"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLocationLabelEditor from "./AdminLocationLabelEditor";

type Role = "ADMIN" | "WORKSHOP";
type TokenType = "ACCOUNT_INVITE" | "PASSWORD_RESET" | "SUBACCOUNT_PASSWORD_SETUP";

type LocationKind = "STATIONARY" | "VEHICLE";

type AccountRow = {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  email: string | null;
  lastLoginAt: string | null;
  location: { id: string; kind: LocationKind; label: string } | null;
  latestToken: { type: TokenType; createdAt: string; used: boolean } | null;
  activeToken: { type: TokenType; expiresAt: string } | null;
};

const MIN_PASSWORD_LENGTH = 10;

function dt(iso: string): string {
  return new Date(iso).toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function relative(iso: string): string {
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = Math.floor(abs / (1000 * 60));
  const h = Math.floor(min / 60);
  const day = Math.floor(h / 24);

  let body: string;
  if (min < 1) body = "manje od minute";
  else if (min < 60) body = `${min} min`;
  else if (h < 24) body = `${h} h`;
  else body = `${day} d`;
  return past ? `prije ${body}` : `za ${body}`;
}

function tokenLabel(t: TokenType): string {
  if (t === "ACCOUNT_INVITE") return "Pozivnica";
  if (t === "PASSWORD_RESET") return "Reset";
  return "Setup link";
}

function statusOf(active: boolean, lastLoginAt: string | null): "ACTIVE" | "PENDING_ACTIVATION" | "INACTIVE" {
  if (active) return "ACTIVE";
  if (lastLoginAt) return "INACTIVE";
  return "PENDING_ACTIVATION";
}

export default function AdminUsersClient({
  currentAccountId,
  accounts,
}: {
  currentAccountId: string;
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "ADMIN" ? -1 : 1)),
    [accounts],
  );

  function openEdit(account: AccountRow) {
    setEditing(account);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`);
      return;
    }
    if (password !== confirm) {
      setError("Lozinke se ne podudaraju.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/users/${editing.id}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Greška kod postavljanja lozinke.");
      return;
    }
    setInfo(`Lozinka za ${editing.username} je postavljena.`);
    setEditing(null);
    router.refresh();
  }

  async function resendSetup(account: AccountRow) {
    setError(null);
    setInfo(null);
    setResendingId(account.id);
    const res = await fetch(`/api/admin/users/${account.id}/resend-setup`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setResendingId(null);
    if (!res.ok) {
      setError(data.error ?? "Setup mail nije poslan.");
      return;
    }
    setInfo(`Setup mail za ${account.username} je poslan na ${data.to ?? "admin email"}.`);
    router.refresh();
  }

  return (
    <>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}
      {info && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {info}
        </div>
      )}

      <section className="surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3">Username</th>
                <th className="p-3">Uloga</th>
                <th className="p-3">Lokacija</th>
                <th className="p-3">Status</th>
                <th className="p-3">Email</th>
                <th className="p-3">Zadnja prijava</th>
                <th className="p-3">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((a) => {
                const status = statusOf(a.active, a.lastLoginAt);
                const isCurrent = a.id === currentAccountId;
                return (
                  <tr key={a.id} className="hover:bg-gray-50 align-top">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">
                      {a.username}
                      {isCurrent && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          vi
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">{a.role === "ADMIN" ? "Admin" : "User/Workshop"}</td>
                    <td className="p-3 whitespace-nowrap">
                      {a.location ? (
                        <div className="flex items-center gap-1">
                          <span
                            className={`badge badge-tight ${
                              a.location.kind === "STATIONARY" ? "badge-info" : "badge-success"
                            }`}
                          >
                            {a.location.kind === "STATIONARY" ? "S" : "V"}
                          </span>
                          <AdminLocationLabelEditor
                            locationId={a.location.id}
                            currentLabel={a.location.label}
                          />
                        </div>
                      ) : a.role === "ADMIN" ? (
                        <span className="text-xs text-slate-400">— (svi)</span>
                      ) : (
                        <span className="text-xs text-rose-600">bez lokacije</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {status === "ACTIVE" && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            Aktivan
                          </span>
                        )}
                        {status === "PENDING_ACTIVATION" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Čeka aktivaciju
                          </span>
                        )}
                        {status === "INACTIVE" && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            Neaktivan
                          </span>
                        )}
                        {a.activeToken ? (
                          <span className="text-[11px] text-slate-500">
                            {tokenLabel(a.activeToken.type)} aktivan · vrijedi do {dt(a.activeToken.expiresAt)}
                          </span>
                        ) : a.latestToken ? (
                          <span className="text-[11px] text-slate-500">
                            {tokenLabel(a.latestToken.type)} {relative(a.latestToken.createdAt)}
                            {a.latestToken.used ? " · iskorišten" : ""}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-slate-700">{a.email ?? "—"}</td>
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                      {a.lastLoginAt ? dt(a.lastLoginAt) : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => openEdit(a)}
                        >
                          {isCurrent ? "Promijeni svoju lozinku" : "Postavi/promijeni lozinku"}
                        </button>
                        {a.role !== "ADMIN" && !a.active && (
                          <button
                            type="button"
                            className="btn btn-primary h-8 px-3 text-xs"
                            onClick={() => resendSetup(a)}
                            disabled={resendingId === a.id}
                          >
                            {resendingId === a.id ? "Šaljem…" : "Pošalji setup mail"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nema računa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3">
              <h3 className="text-lg font-bold">Promjena lozinke</h3>
              <p className="mt-1 text-xs text-slate-500">
                Račun: <span className="font-mono">{editing.username}</span>
                {editing.id === currentAccountId && (
                  <span className="ml-2 text-slate-400">(vaš račun)</span>
                )}
              </p>
            </div>
            <form onSubmit={submitPassword} className="space-y-3">
              <div>
                <label className="label">Nova lozinka</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Potvrdi lozinku</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-outline px-4"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Odustani
                </button>
                <button className="btn btn-primary px-4" type="submit" disabled={busy}>
                  {busy ? "Spremam…" : "Postavi lozinku"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
