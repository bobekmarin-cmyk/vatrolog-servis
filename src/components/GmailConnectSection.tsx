"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

interface Props {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export default function GmailConnectSection({ connected, email, connectedAt }: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    const ok = await dialog.confirm({
      title: "Odspojiti Gmail račun?",
      message:
        "Nećete moći slati obavijesti kupcima dok ponovno ne povežete račun.",
      danger: true,
      confirmLabel: "Odspoji",
    });
    if (!ok) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <div className="surface p-4">
        <p className="text-sm text-slate-600 mb-3">
          Gmail račun nije povezan. Povežite ga da biste mogli slati obavijesti kupcima o isteku servisa vatrogasnih aparata.
        </p>
        <a href="/api/gmail/connect" className="btn btn-primary px-4">
          Poveži Gmail račun
        </a>
      </div>
    );
  }

  const fmtDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">Povezano</span>
          </div>
          <p className="mt-1 text-sm text-slate-700">{email}</p>
          {fmtDate && <p className="text-xs text-slate-400">Povezano: {fmtDate}</p>}
        </div>
        <button
          type="button"
          className="btn btn-outline px-4 text-red-600 border-red-300 hover:bg-red-50"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? "Odspajam..." : "Odspoji"}
        </button>
      </div>
    </div>
  );
}
