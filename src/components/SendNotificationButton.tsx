"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

interface Props {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  month: string;
  itemCount: number;
  gmailConnected: boolean;
  alreadySentAt: string | null;
}

export default function SendNotificationButton({
  customerId,
  customerName,
  customerEmail,
  month,
  itemCount,
  gmailConnected,
  alreadySentAt,
}: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNow, setSentNow] = useState(false);

  if (sentNow || alreadySentAt) {
    const date = sentNow
      ? new Date().toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : alreadySentAt
        ? new Date(alreadySentAt).toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title={`Poslano: ${date}`}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {date}
      </span>
    );
  }

  if (!gmailConnected) {
    return (
      <span className="text-xs text-slate-400" title="Povežite Gmail u postavkama">
        Gmail nije povezan
      </span>
    );
  }

  if (!customerEmail) {
    return (
      <span className="text-xs text-slate-400" title="Kupac nema email adresu">
        Nema emaila
      </span>
    );
  }

  async function handleSend() {
    const ok = await dialog.confirm({
      title: "Poslati obavijest?",
      message: (
        <div className="space-y-1">
          <div>
            Kupac: <b>{customerName}</b>
          </div>
          <div>
            Email: <b>{customerEmail}</b>
          </div>
          <div>
            Broj aparata: <b>{itemCount}</b>
          </div>
        </div>
      ),
      confirmLabel: "Pošalji",
    });
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, month, itemCount }),
      });
      if (res.ok) {
        setSentNow(true);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Greška");
      }
    } catch {
      setError("Mrežna greška");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-outline px-2 py-1 text-xs"
        onClick={handleSend}
        disabled={sending}
        title={`Pošalji obavijest na ${customerEmail}`}
      >
        {sending ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Šaljem...
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Pošalji
          </span>
        )}
      </button>
      {error && <span className="text-xs text-red-600" title={error}>!</span>}
    </div>
  );
}
