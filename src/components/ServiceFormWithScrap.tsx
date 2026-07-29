"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDialog } from "@/components/ui/useDialog";
import Modal from "@/components/ui/Modal";
import { ServiceScrapModeContext } from "@/components/ServiceScrapModeContext";
import { showLoadingOverlay } from "@/lib/showLoadingOverlay";

export default function ServiceFormWithScrap(props: {
  action: string;
  workOrderId: string;
  /** Serija/godina, proizvođač i tip aparata. */
  extinguisherSummaryLeft?: ReactNode;
  /** Broj naljepnice — zasivi se u načinu rashoda. */
  labelLeft: ReactNode;
  /** Serviser i lokacija — ostaju aktivni i u načinu rashoda. */
  servicerLocationLeft: ReactNode;
  /** Unutarnji pregled — zasivi se u načinu rashoda. */
  internalInspectionLeft?: ReactNode;
  rightContent: ReactNode;
  resetAction?: string;
  canReset?: boolean;
  /** Forma živi u draweru: jedan stupac, bez navigacije, glavni gumbi su u footeru drawera. */
  embedded?: boolean;
  /** Id forme da je submit gumb iz footera drawera može poslati. */
  formId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onScrapModeChange?: (scrap: boolean) => void;
}) {
  const {
    action,
    workOrderId,
    extinguisherSummaryLeft,
    labelLeft,
    servicerLocationLeft,
    internalInspectionLeft,
    rightContent,
    resetAction,
    canReset,
    embedded = false,
    formId,
    onSuccess,
    onCancel,
    onSubmittingChange,
    onScrapModeChange,
  } = props;
  const dialog = useDialog();
  const [scrap, setScrap] = useState(false);
  const [scrapReason, setScrapReason] = useState("");
  const [scrapModalOpen, setScrapModalOpen] = useState(false);
  const [modalDraftReason, setModalDraftReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    onScrapModeChange?.(scrap);
  }, [scrap, onScrapModeChange]);

  useEffect(() => {
    onSubmittingChange?.(submitting || resetting);
  }, [submitting, resetting, onSubmittingChange]);

  function finish() {
    if (embedded) {
      onSuccess?.();
      return;
    }
    window.location.href = `/work-orders/${workOrderId}`;
  }

  function openScrapModal() {
    setModalDraftReason("");
    setScrapModalOpen(true);
  }

  function closeScrapModal() {
    setScrapModalOpen(false);
    setModalDraftReason("");
  }

  async function confirmScrapFromModal() {
    const reason = modalDraftReason.trim();
    if (!reason) {
      await dialog.alert({
        title: "Razlog je obavezan",
        message: "Upišite razlog rashoda prije nastavka.",
        variant: "warning",
      });
      return;
    }
    setScrapReason(reason);
    setScrap(true);
    closeScrapModal();
  }

  function cancelScrapMode() {
    setScrap(false);
    setScrapReason("");
  }

  async function handleReset() {
    if (!resetAction || resetting || submittingRef.current) return;
    const ok = await dialog.confirm({
      title: "Reset servisa",
      message:
        "Ovim se brišu svi unosi servisa za ovaj aparat (serviser, naljepnica, dijelovi, UP i PP rokovi) i aparat se vraća u stanje prije servisa. Nastaviti?",
      danger: true,
      confirmLabel: "Resetiraj",
    });
    if (!ok) return;
    setResetting(true);
    try {
      const res = await fetch(resetAction, { method: "POST" });
      if (res.ok) {
        finish();
        return;
      }
      const data = (await res.json().catch(() => null)) as null | { error?: string };
      await dialog.alert({
        title: "Reset nije uspio",
        message: data?.error ?? "Greška pri resetiranju. Pokušaj ponovno.",
        variant: "error",
      });
    } catch {
      await dialog.alert({
        title: "Greška",
        message: "Mrežna greška pri resetiranju. Pokušaj ponovno.",
        variant: "error",
      });
    } finally {
      setResetting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    if (scrap) {
      const reason = scrapReason.trim();
      if (!reason) {
        await dialog.alert({
          title: "Razlog rashoda je obavezan",
          message: "Ponovno otvorite rashod i upišite razlog, ili poništite rashod.",
          variant: "warning",
        });
        return;
      }
    } else if (!String(fd.get("servicerId") ?? "").trim()) {
      await dialog.alert({
        title: "Serviser nije odabran",
        message: "Odaberite servisera prije spremanja servisa.",
        variant: "warning",
      });
      return;
    }

    if (scrap) {
      fd.set("scrap", "on");
      fd.set("scrapReason", scrapReason.trim());
    }

    submittingRef.current = true;
    setSubmitting(true);
    const removePendingOverlay = embedded
      ? () => {}
      : showLoadingOverlay({
          title: scrap ? "Rashodujem aparat..." : "Spremam servis...",
          message: "Molimo pričekajte, otvara se servisni nalog.",
        });
    try {
      const res = await fetch(action, {
        method: "POST",
        body: fd,
        redirect: "manual",
      });

      if (res.type === "opaqueredirect" || res.ok) {
        finish();
        return;
      }

      const data = (await res.json().catch(() => null)) as null | { error?: string };
      await dialog.alert({
        title: scrap ? "Rashod nije spremljen" : "Servis nije spremljen",
        message: data?.error ?? "Greška pri spremanju. Provjeri unesene podatke i pokušaj ponovno.",
        variant: "error",
      });
    } catch {
      await dialog.alert({
        title: "Greška",
        message: "Mrežna greška pri spremanju. Pokušaj ponovno.",
        variant: "error",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      removePendingOverlay();
    }
  }

  return (
    <ServiceScrapModeContext.Provider value={scrap}>
      <form
        ref={formRef}
        id={formId}
        className={embedded ? "grid gap-4" : "grid gap-4 xl:grid-cols-3"}
        action={action}
        method="post"
        onSubmit={handleSubmit}
      >
        <Modal
          open={scrapModalOpen}
          title="Rashod vatrogasnog aparata"
          variant="danger"
          onClose={closeScrapModal}
          closeOnBackdrop
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={closeScrapModal}
              >
                Odustani
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
                onClick={() => {
                  void confirmScrapFromModal();
                }}
              >
                Nastavi u rashod
              </button>
            </>
          }
        >
          <p className="text-slate-700">
            Ovime pripremate <span className="font-semibold">rashod</span> ovog aparata na ovom nalogu. Nakon
            spremanja aparat se označava rashodovanim — akcija se ne može poništiti. Ostaju dostupni samo{" "}
            <span className="font-medium">serviser</span> i <span className="font-medium">lokacija/napomena</span>;
            naljepnica, unutarnji pregled, rezervni dijelovi i dodatne usluge bit će onemogućeni, a odabir dijelova i
            usluga uklonjen.
          </p>
          <div>
            <label className="label" htmlFor="scrap-reason-modal">
              Razlog rashoda (obavezno)
            </label>
            <textarea
              id="scrap-reason-modal"
              className="textarea w-full"
              rows={4}
              value={modalDraftReason}
              onChange={(e) => setModalDraftReason(e.target.value)}
              placeholder="npr. stari aparat, korozija posude, oštećenje…"
              autoFocus
            />
          </div>
        </Modal>

        <div className={embedded ? "grid gap-4" : "xl:col-span-3 grid gap-4 xl:grid-cols-3"}>
          <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-6 xl:col-span-1"}>
            {extinguisherSummaryLeft ? (
              <section className="surface p-4">
                {extinguisherSummaryLeft}
              </section>
            ) : null}

            <section className={`surface flex flex-col p-4 ${embedded ? "gap-5" : "gap-8"}`}>
              <fieldset
                className="min-w-0 border-0 p-0 m-0 disabled:opacity-55"
                disabled={scrap}
              >
                {labelLeft}
              </fieldset>

              <fieldset
                className={`flex min-w-0 flex-col border-0 p-0 m-0 ${embedded ? "gap-5" : "gap-8"}`}
              >
                {servicerLocationLeft}
              </fieldset>
            </section>

            {internalInspectionLeft ? (
              <fieldset
                className="min-w-0 border-0 p-0 m-0 disabled:opacity-55"
                disabled={scrap}
              >
                {internalInspectionLeft}
              </fieldset>
            ) : null}
          </div>

          <fieldset
            className={`min-w-0 border-0 p-0 m-0 disabled:opacity-55 ${embedded ? "" : "xl:col-span-2"}`}
            disabled={scrap}
          >
            <div className={embedded ? "space-y-4" : "space-y-6"}>{rightContent}</div>
          </fieldset>
        </div>

        <div
          className={`flex flex-wrap items-start gap-2 pt-2 ${embedded ? "" : "xl:col-span-3"}`}
        >
          {embedded ? null : (
            <>
              <button
                type="submit"
                disabled={resetting || submitting}
                className={
                  scrap
                    ? "btn bg-rose-600 px-4 text-white hover:bg-rose-700 disabled:opacity-60"
                    : "btn btn-primary px-4 disabled:opacity-60"
                }
              >
                {submitting
                  ? scrap
                    ? "Rashodujem..."
                    : "Spremam..."
                  : scrap
                    ? "Rashoduj aparat"
                    : "Spremi servis"}
              </button>
              {onCancel ? (
                <button type="button" className="btn btn-outline px-4" onClick={onCancel}>
                  Odustani
                </button>
              ) : (
                <Link className="btn btn-outline px-4" href={`/work-orders/${workOrderId}`}>
                  Odustani
                </Link>
              )}
            </>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {scrap ? (
              <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
                <p className="font-semibold text-rose-900">Rashod je pripremljen</p>
                <p className="text-slate-700">
                  <span className="font-medium text-slate-800">Razlog: </span>
                  <span className="whitespace-pre-wrap">{scrapReason}</span>
                </p>
                <button
                  type="button"
                  className="text-sm font-medium text-rose-800 underline decoration-rose-400 underline-offset-2 hover:text-rose-950"
                  onClick={cancelScrapMode}
                >
                  Poništi rashod
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openScrapModal}
                disabled={resetting || submitting}
                className="btn border-rose-300 bg-white text-rose-900 hover:bg-rose-50 disabled:opacity-60"
              >
                Rashod vatrogasnog aparata…
              </button>
            )}
          {canReset && resetAction && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || submitting || scrap}
              className="btn border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              title="Vraća aparat u stanje prije servisa"
            >
              {resetting ? "Resetiram..." : "Resetiraj servis"}
            </button>
          )}
          </div>
        </div>
      </form>
    </ServiceScrapModeContext.Provider>
  );
}
