"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Org = { ownerOrgId: string; oib: string; name: string | null };

export default function OwnerOrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: Org[];
  activeOrgId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchOrg(ownerOrgId: string) {
    if (ownerOrgId === activeOrgId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/portal/active-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerOrgId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (orgs.length <= 1) return null;

  return (
    <select
      aria-label="Promijeni tvrtku"
      value={activeOrgId ?? ""}
      disabled={busy}
      onChange={(e) => switchOrg(e.target.value)}
      className="h-9 max-w-[200px] rounded-md border border-white/30 bg-white/10 px-2 text-sm font-medium text-white outline-none transition hover:bg-white/20 disabled:opacity-60"
    >
      {orgs.map((o) => (
        <option key={o.ownerOrgId} value={o.ownerOrgId} className="text-slate-900">
          {o.name ?? o.oib}
        </option>
      ))}
    </select>
  );
}
