"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PendingSubmitForm from "@/components/PendingSubmitForm";
import ConfirmForm from "@/components/ConfirmForm";
import { useDialog } from "@/components/ui/useDialog";

type DocKind = "primka" | "register" | "delivery-note";

type PrimkaIssue = {
  id: string;
  version: number;
  issuedAtLabel: string;
  hasPdf: boolean;
};

type Props = {
  workOrderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  mailConnected: boolean;
  mailDisabledTitle?: string;
  isLocked: boolean;
  isAdmin: boolean;
  deliveryNoteIssued: boolean;
};

const DOC_LABELS: Record<DocKind, string> = {
  primka: "Primka",
  register: "Upisnik",
  "delivery-note": "Otpremnica",
};

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export default function WorkOrderDocumentsMenu({
  workOrderId,
  orderNumber,
  customerName,
  customerEmail,
  mailConnected,
  mailDisabledTitle,
  isLocked,
  isAdmin,
  deliveryNoteIssued,
}: Props) {
  const router = useRouter();
  const dialog = useDialog();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [mailKind, setMailKind] = useState<DocKind | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(customerEmail ?? "");

  const [primkaIssues, setPrimkaIssues] = useState<PrimkaIssue[]>([]);
  const [canIssueNewPrimka, setCanIssueNewPrimka] = useState(false);
  const [primkaLoading, setPrimkaLoading] = useState(false);
  const [issuingPrimka, setIssuingPrimka] = useState(false);

  const loadPrimkaStatus = useCallback(async () => {
    setPrimkaLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/primka/issues`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrimkaIssues(data.issues ?? []);
        setCanIssueNewPrimka(!!data.canIssueNew);
      }
    } finally {
      setPrimkaLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    void loadPrimkaStatus();
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, loadPrimkaStatus]);

  const dnAvailable = isLocked && deliveryNoteIssued;
  const dnDisabledTitle = !isLocked
    ? "Zaključaj radni nalog prije izdavanja otpremnice."
    : "Prvo izdajte otpremnicu (opcija ispod).";

  const docUrl: Record<DocKind, string> = {
    primka: `/work-orders/${workOrderId}/primka/pdf`,
    register: `/work-orders/${workOrderId}/register/pdf`,
    "delivery-note": `/work-orders/${workOrderId}/delivery-note/pdf`,
  };

  function openPdf(kind: DocKind, issueId?: string) {
    const url =
      kind === "primka" && issueId
        ? `${docUrl.primka}?issue=${encodeURIComponent(issueId)}`
        : docUrl[kind];
    window.open(url, "_blank", "noopener,noreferrer");
    setMenuOpen(false);
  }

  async function issueNewPrimka() {
    if (!canIssueNewPrimka || issuingPrimka) return;
    setIssuingPrimka(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/primka/issues`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await dialog.alert({
          title: "Nova primka",
          message: data.error || "Izdavanje nije uspjelo.",
          variant: res.status === 409 ? "warning" : "error",
        });
        if (data.latestIssueId) {
          openPdf("primka", data.latestIssueId);
        }
        await loadPrimkaStatus();
        return;
      }
      openPdf("primka", data.issueId);
      await loadPrimkaStatus();
      router.refresh();
    } finally {
      setIssuingPrimka(false);
    }
  }

  function openMailModal(kind: DocKind) {
    setEmailInput(customerEmail ?? "");
    setError(null);
    setMailKind(kind);
    setMenuOpen(false);
  }

  async function handleSend() {
    if (!mailKind) return;
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
        body: JSON.stringify({ workOrderId, kind: mailKind, toEmail: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Greška ${res.status}`);
      }
      setMailKind(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepoznata greška");
    } finally {
      setSending(false);
    }
  }

  function DocRow({ kind, disabled, disabledTitle }: { kind: DocKind; disabled?: boolean; disabledTitle?: string }) {
    const mailDisabled = disabled || !mailConnected;
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className={`text-sm ${disabled ? "text-slate-400" : "text-slate-800"}`}>
          {DOC_LABELS[kind]}
        </span>
        <span className="flex gap-1">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => openPdf(kind)}
            disabled={disabled}
            title={disabled ? disabledTitle : `Otvori ${DOC_LABELS[kind].toLowerCase()} PDF`}
            aria-label={`Otvori ${DOC_LABELS[kind]} PDF`}
          >
            <PdfIcon />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => openMailModal(kind)}
            disabled={mailDisabled}
            title={
              disabled
                ? disabledTitle
                : !mailConnected
                  ? (mailDisabledTitle ?? "Mail nije konfiguriran (Postavke → Postavke maila)")
                  : `Pošalji ${DOC_LABELS[kind].toLowerCase()} na mail`
            }
            aria-label={`Pošalji ${DOC_LABELS[kind]} na mail`}
          >
            <MailIcon />
          </button>
        </span>
      </div>
    );
  }

  return (
    <>
      <div ref={wrapRef} className="relative inline-flex">
        <button
          type="button"
          className="btn btn-outline px-4"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          Dokumenti
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-1.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg"
          >
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Primke
            </div>
            {primkaLoading ? (
              <div className="px-3 py-2 text-xs text-slate-400">Učitavam…</div>
            ) : primkaIssues.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-slate-500">Još nema izdane primke.</div>
            ) : (
              primkaIssues.map((issue) => (
                <div key={issue.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="text-sm text-slate-800">
                    Primka #{issue.version}
                    <span className="ml-1.5 text-[11px] text-slate-400">{issue.issuedAtLabel}</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    onClick={() => openPdf("primka", issue.id)}
                    title="Otvori izdanu primku"
                    aria-label={`Otvori primku ${issue.version}`}
                  >
                    <PdfIcon />
                  </button>
                </div>
              ))
            )}
            <div className="px-3 pb-2 pt-1 space-y-1.5">
              <button
                type="button"
                className="btn btn-primary w-full text-sm"
                disabled={!canIssueNewPrimka || issuingPrimka}
                title={
                  canIssueNewPrimka
                    ? "Izdaj novu primku jer su dodane nove količine / aparati"
                    : "Nema novih podataka — otvori postojeću primku"
                }
                onClick={issueNewPrimka}
              >
                {issuingPrimka
                  ? "Izdajem…"
                  : primkaIssues.length === 0
                    ? "Izdaj primku"
                    : "Izdaj novu primku"}
              </button>
              {primkaIssues.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-outline w-full text-sm"
                  disabled={!mailConnected}
                  title={
                    mailConnected
                      ? "Pošalji zadnju izdanu primku na mail"
                      : (mailDisabledTitle ?? "Mail nije konfiguriran")
                  }
                  onClick={() => openMailModal("primka")}
                >
                  Pošalji zadnju primku
                </button>
              ) : null}
              {!canIssueNewPrimka && primkaIssues.length > 0 ? (
                <p className="text-[11px] text-slate-400">
                  Trenutne količine već imaju izdanu primku.
                </p>
              ) : null}
            </div>

            <div className="my-1 h-px bg-slate-100" />
            <DocRow kind="register" />
            <div className="my-1 h-px bg-slate-100" />
            <DocRow kind="delivery-note" disabled={!dnAvailable} disabledTitle={dnDisabledTitle} />

            {isLocked && !deliveryNoteIssued ? (
              <div className="px-3 pt-1 pb-1.5">
                <PendingSubmitForm
                  action={`/api/work-orders/${workOrderId}/delivery-notes/issue`}
                  method="post"
                  pendingTitle="Izdajem otpremnicu..."
                  pendingMessage="Molimo pričekajte, generira se PDF i broj otpremnice."
                >
                  <button type="submit" className="btn btn-primary w-full text-sm">
                    Izdaj otpremnicu
                  </button>
                </PendingSubmitForm>
              </div>
            ) : null}

            {isLocked && deliveryNoteIssued && isAdmin ? (
              <div className="px-3 pt-1 pb-1.5">
                <ConfirmForm
                  action={`/api/work-orders/${workOrderId}/delivery-notes/reissue`}
                  method="post"
                  confirmTitle="Nova otpremnica (zamjena)"
                  confirmMessage="Dodijelit će se novi službeni broj. Stara otpremnica ostaje u arhivi. Nastaviti?"
                  confirmLabel="Izdaj novu"
                  danger
                >
                  <button type="submit" className="btn btn-outline w-full text-sm text-amber-800 border-amber-300">
                    Nova otpremnica
                  </button>
                </ConfirmForm>
              </div>
            ) : null}

            {!isLocked ? (
              <p className="px-3 pb-1 pt-0.5 text-[11px] text-slate-400">
                Otpremnica je dostupna nakon zaključavanja naloga.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {mailKind ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-bold">Slanje — {DOC_LABELS[mailKind]}</h3>
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
              {DOC_LABELS[mailKind]} će biti poslan kao PDF prilog na navedene adrese.
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
                onClick={() => setMailKind(null)}
                disabled={sending}
              >
                Odustani
              </button>
              <button type="button" className="btn btn-primary px-4" onClick={handleSend} disabled={sending}>
                {sending ? "Šaljem…" : "Pošalji"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
