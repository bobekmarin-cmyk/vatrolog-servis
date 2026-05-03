"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useDialog } from "@/components/ui/useDialog";

export default function ServiceFormWithScrap(props: {
  action: string;
  workOrderId: string;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  resetAction?: string;
  canReset?: boolean;
}) {
  const { action, workOrderId, leftContent, rightContent, resetAction, canReset } = props;
  const dialog = useDialog();
  const [scrap, setScrap] = useState(false);
  const [scrapReason, setScrapReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleReset() {
    if (!resetAction || resetting || submitting) return;
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
        window.location.href = `/work-orders/${workOrderId}`;
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
    if (submitting) return;

    const form = formRef.current;
    if (!form) return;

    if (scrap) {
      const reason = scrapReason.trim();
      if (!reason) {
        await dialog.alert({
          title: "Razlog rashoda je obavezan",
          message: "Upiši razlog rashoda (npr. stari aparat, korozija posude, oštećenje).",
          variant: "warning",
        });
        return;
      }
      const ok = await dialog.confirm({
        title: "Rashod vatrogasnog aparata",
        message: "Sigurno želite rashodovati ovaj vatrogasni aparat? Ova akcija se ne može poništiti.",
        danger: true,
        confirmLabel: "Rashoduj",
      });
      if (!ok) return;
    }

    const fd = new FormData(form);
    if (scrap) {
      fd.set("scrap", "on");
      fd.set("scrapReason", scrapReason.trim());
    }

    setSubmitting(true);
    try {
      const res = await fetch(action, {
        method: "POST",
        body: fd,
        redirect: "manual",
      });

      if (res.type === "opaqueredirect" || res.ok) {
        window.location.href = `/work-orders/${workOrderId}`;
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
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      className="grid gap-4 xl:grid-cols-3"
      action={action}
      method="post"
      onSubmit={handleSubmit}
    >
      <div className="xl:col-span-3 grid gap-4 xl:grid-cols-3">
        {/* Lijevo (1/3): sadržaj + rashod na dnu */}
        <section className="surface p-4 space-y-4 xl:col-span-1 flex flex-col">
          <fieldset className="min-w-0 border-0 p-0 m-0" disabled={scrap} aria-hidden={scrap}>
            {leftContent}
          </fieldset>
          <div className="mt-auto pt-4 rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={scrap}
                onChange={(e) => setScrap(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-sm font-semibold text-rose-900">
                RASHODUJ VATROGASNI APARAT
              </span>
            </label>
            {scrap && (
              <div className="mt-3">
                <label className="label">Razlog rashoda (obavezno)</label>
                <textarea
                  value={scrapReason}
                  onChange={(e) => setScrapReason(e.target.value)}
                  className="textarea w-full"
                  rows={3}
                  placeholder="npr. stari aparat, korozija posude, oštećenje..."
                  required={scrap}
                />
              </div>
            )}
          </div>
        </section>
        {/* Desno (2/3) */}
        <fieldset className="xl:col-span-2 border-0 p-0 m-0 min-w-0" disabled={scrap} aria-hidden={scrap}>
          <section className="surface p-4 space-y-4">
            {rightContent}
          </section>
        </fieldset>
      </div>

      <div className="flex flex-wrap gap-2 xl:col-span-3 pt-2">
        <button
          type="submit"
          disabled={submitting || resetting}
          className={scrap ? "btn bg-rose-600 text-white hover:bg-rose-700 px-4 disabled:opacity-60" : "btn btn-primary px-4 disabled:opacity-60"}
        >
          {submitting ? "Spremam..." : scrap ? "Rashoduj aparat" : "Spremi servis"}
        </button>
        <Link className="btn btn-outline px-4" href={`/work-orders/${workOrderId}`}>
          Odustani
        </Link>
        {canReset && resetAction && (
          <button
            type="button"
            onClick={handleReset}
            disabled={submitting || resetting || scrap}
            className="btn ml-auto border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            title="Vraća aparat u stanje prije servisa"
          >
            {resetting ? "Resetiram..." : "Resetiraj servis"}
          </button>
        )}
      </div>
    </form>
  );
}
