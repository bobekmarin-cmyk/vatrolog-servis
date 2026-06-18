"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerOrgServicer } from "@/lib/platformOwners";

function StatusBadge({ s }: { s: OwnerOrgServicer }) {
  if (s.status === "ACTIVE") {
    return s.hidden ? (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Skriveno</span>
    ) : (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Vidljivo{s.forced ? " (vendor)" : ""}
      </span>
    );
  }
  if (s.status === "REQUESTED")
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Zahtjev</span>;
  if (s.status === "PENDING_INVITE")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Pozvan</span>;
  if (s.linkedToOtherOrg)
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Drugi vlasnik</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Nije povezano</span>;
}

export function ServicerTable({ orgId, servicers }: { orgId: string; servicers: OwnerOrgServicer[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleVisibility(linkId: string, hidden: boolean) {
    setBusyId(linkId);
    setError(null);
    try {
      const res = await fetch(`/api/platform/owners/links/${linkId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Greška.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function force(customerId: string) {
    setBusyId(customerId);
    setError(null);
    try {
      const res = await fetch(`/api/platform/owners/${orgId}/force`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Greška.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Servis / kupac</th>
            <th className="px-3 py-2">Aparata</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Akcija</th>
          </tr>
        </thead>
        <tbody>
          {servicers.map((s) => {
            const busy = busyId === s.linkId || busyId === s.customerId;
            return (
              <tr key={s.customerId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{s.companyName}</div>
                  <div className="text-xs text-slate-500">{s.customerName}</div>
                </td>
                <td className="px-3 py-2">{s.apparatusCount}</td>
                <td className="px-3 py-2"><StatusBadge s={s} /></td>
                <td className="px-3 py-2 text-right">
                  {s.status === "ACTIVE" && s.linkId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleVisibility(s.linkId!, !s.hidden)}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {s.hidden ? "Prikaži" : "Sakrij"}
                    </button>
                  ) : !s.linkedToOtherOrg && s.status !== "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => force(s.customerId)}
                      className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                      Prisilno uključi
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {servicers.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-slate-500">Nema servisa za ovaj OIB.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AccountActions({
  orgId,
  ownerId,
  role,
}: {
  orgId: string;
  ownerId: string;
  role: "ADMIN" | "MEMBER";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "revoke" | "setRole", payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/platform/owners/${orgId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ownerId, ...payload }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? "Greška.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => call("setRole", { role: role === "ADMIN" ? "MEMBER" : "ADMIN" }, "role")}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "role" ? "…" : role === "ADMIN" ? "→ Član" : "→ Admin"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => {
          if (confirm("Povući pristup ovom računu?")) void call("revoke", {}, "revoke");
        }}
        className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {busy === "revoke" ? "…" : "Povuci"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

export function InviteAccountForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/platform/owners/${orgId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; email?: string; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? "Slanje nije uspjelo.");
        return;
      }
      setMsg(`Pozivnica poslana na ${d.email}.`);
      setEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="invite-email">E-mail za pozivnicu</label>
          <input
            id="invite-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vlasnik@tvrtka.hr"
            disabled={busy}
          />
        </div>
        <button
          type="button"
          disabled={busy || !email}
          onClick={send}
          className="btn btn-primary h-10"
        >
          {busy ? "Šaljem…" : "Pošalji pozivnicu"}
        </button>
      </div>
      {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
    </div>
  );
}
