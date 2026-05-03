"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PdfKind = "primka" | "register" | "delivery-note";

interface Props {
  label: string;
  kind: PdfKind;
  pdfUrl: string;
  workOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  gmailConnected: boolean;
}

export default function PdfActionButton({
  label,
  kind,
  pdfUrl,
  workOrderId,
  orderNumber,
  customerName,
  customerEmail,
  gmailConnected,
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [emailInput, setEmailInput] = useState(customerEmail ?? "");

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function openPdf() {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }

  function openMailModal() {
    setEmailInput(customerEmail ?? "");
    setError(null);
    setSent(false);
    setMailOpen(true);
    setMenuOpen(false);
  }

  async function handleSend() {
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setError("Unesite barem jednu email adresu");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send-work-order-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId, kind, toEmail: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Greška ${res.status}`);
      }
      setSent(true);
      setMailOpen(false);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nepoznata greška";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  const mailDisabled = !gmailConnected;
  const mailTitle = !gmailConnected ? "Gmail nije povezan" : undefined;

  return (
    <>
      <div ref={wrapRef} className="relative inline-flex">
        <button
          type="button"
          className="btn btn-outline rounded-r-none border-r-0 px-4"
          onClick={openPdf}
          title={`Otvori ${label.toLowerCase()} PDF`}
        >
          {label}
        </button>
        <button
          type="button"
          className="btn btn-outline rounded-l-none px-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Opcije za ${label}`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
              onClick={openPdf}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v8H6z" />
              </svg>
              Ispis PDF
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={mailDisabled}
              title={mailTitle}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
              onClick={openMailModal}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Pošalji na mail
            </button>
          </div>
        )}
      </div>

      {mailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-bold">Slanje — {label}</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <span className="text-slate-500">Nalog:</span>{" "}
                <span className="font-medium">{orderNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">Kupac:</span>{" "}
                <span className="font-medium">{customerName}</span>
              </div>
              <div>
                <label className="text-slate-500">Email:</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="email@primjer.hr, drugi@primjer.hr"
                />
                <p className="mt-1 text-[11px] text-slate-400">Više adresa odvojite zarezom</p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              {label} će biti poslan kao PDF prilog na navedene adrese.
            </p>

            {error && (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline px-4"
                onClick={() => setMailOpen(false)}
                disabled={sending}
              >
                Odustani
              </button>
              <button
                type="button"
                className="btn btn-primary px-4"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "Šaljem…" : "Pošalji"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sent && !mailOpen && (
        <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Poslano
        </span>
      )}
    </>
  );
}
