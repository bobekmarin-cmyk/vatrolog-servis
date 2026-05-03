"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Workshop = {
  id: string;
  username: string;
  alreadyActive: boolean;
  location: { kind: "STATIONARY" | "VEHICLE"; label: string } | null;
};

type WorkshopState = {
  enabled: boolean;
  password: string;
  confirm: string;
};

const MIN_PASSWORD_LENGTH = 10;

export default function InviteAcceptForm({
  token,
  adminUsername,
  workshops,
  companyName,
}: {
  token: string;
  adminUsername: string;
  workshops: Workshop[];
  companyName: string;
}) {
  const router = useRouter();
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [workshopState, setWorkshopState] = useState<Record<string, WorkshopState>>(() => {
    const o: Record<string, WorkshopState> = {};
    for (const w of workshops) {
      o[w.id] = { enabled: !w.alreadyActive, password: "", confirm: "" };
    }
    return o;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function setWorkshop(id: string, patch: Partial<WorkshopState>) {
    setWorkshopState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Admin lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`);
      return;
    }
    if (adminPassword !== adminConfirm) {
      setError("Admin lozinka i potvrda se ne podudaraju.");
      return;
    }

    const workshopsPayload: { accountUserId: string; password: string }[] = [];
    for (const w of workshops) {
      const state = workshopState[w.id];
      if (!state || !state.enabled) continue;
      if (state.password.length < MIN_PASSWORD_LENGTH) {
        setError(`Lozinka za ${w.username} mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova (ili isključi taj račun).`);
        return;
      }
      if (state.password !== state.confirm) {
        setError(`Lozinka i potvrda za ${w.username} se ne podudaraju.`);
        return;
      }
      workshopsPayload.push({ accountUserId: w.id, password: state.password });
    }

    setBusy(true);
    const res = await fetch("/api/auth/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: adminPassword, workshops: workshopsPayload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Greška kod prihvaćanja pozivnice.");
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (ok) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        Pristup za <strong>{companyName}</strong> je postavljen. Preusmjeravamo vas na prijavu…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Admin račun</div>
            <div className="font-mono text-base font-semibold">{adminUsername}</div>
          </div>
          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">obavezno</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Lozinka</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <div>
            <label className="label">Potvrdi lozinku</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={adminConfirm}
              onChange={(e) => setAdminConfirm(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
        </div>
      </section>

      {workshops.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              User / workshop računi
            </h2>
            <p className="text-xs text-slate-500">
              Postavite lozinke za radne stanice. Račune koje sad ne postavljate možete kasnije
              aktivirati iz <span className="font-mono">/admin/users</span>.
            </p>
          </div>
          {workshops.map((w) => {
            const state = workshopState[w.id];
            const enabled = state?.enabled ?? true;
            return (
              <div
                key={w.id}
                className={`rounded-lg border p-4 transition ${
                  enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-base font-semibold">{w.username}</div>
                    {w.location ? (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <span
                          className={`badge badge-tight ${
                            w.location.kind === "STATIONARY" ? "badge-info" : "badge-success"
                          }`}
                        >
                          {w.location.kind === "STATIONARY" ? "Stacionarni" : "Vozilo"}
                        </span>
                        <span className="text-slate-600">{w.location.label}</span>
                      </div>
                    ) : null}
                    {w.alreadyActive && (
                      <div className="mt-1 text-xs text-emerald-700">
                        Račun je već aktiviran. Ako unesete lozinku, prepisat ćete postojeću.
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setWorkshop(w.id, { enabled: e.target.checked })}
                    />
                    Postavi lozinku sad
                  </label>
                </div>
                {enabled && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Lozinka</label>
                      <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={state?.password ?? ""}
                        onChange={(e) => setWorkshop(w.id, { password: e.target.value })}
                        minLength={MIN_PASSWORD_LENGTH}
                      />
                    </div>
                    <div>
                      <label className="label">Potvrdi lozinku</label>
                      <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={state?.confirm ?? ""}
                        onChange={(e) => setWorkshop(w.id, { confirm: e.target.value })}
                        minLength={MIN_PASSWORD_LENGTH}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <button className="btn btn-primary px-4" type="submit" disabled={busy}>
        {busy ? "Aktiviram pristup…" : "Aktiviraj pristup"}
      </button>
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</div>
      )}
    </form>
  );
}
