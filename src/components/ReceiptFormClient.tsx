"use client";

import { useEffect, useRef, useState } from "react";
import { useDialog } from "@/components/ui/useDialog";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ReceiptFormClient({
  action,
  formId,
  className = "surface p-4 space-y-4",
  children,
}: {
  action: string;
  formId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const dialog = useDialog();
  const [saving, setSaving] = useState(false);

  // Synchroni guard: štiti od dvostrukog submita i kad React state još nije propagirao.
  const inFlight = useRef(false);

  // Eksterni submit gumbovi (oni s atributom form={formId} izvan forme) NISU
  // unutar fieldset-a, pa ih ovdje sinkroniziramo s `saving` stanjem da budu
  // vizualno disable-ani i da klikom ne mogu pokrenuti drugi submit.
  useEffect(() => {
    if (!formId) return;
    const externals = document.querySelectorAll<HTMLButtonElement>(
      `button[form="${CSS.escape(formId)}"][type="submit"]`,
    );
    externals.forEach((b) => {
      b.disabled = saving;
      b.setAttribute("aria-busy", saving ? "true" : "false");
    });
  }, [saving, formId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    const fd = new FormData(e.currentTarget);

    inFlight.current = true;
    setSaving(true);
    try {
      const res = await fetch(action, { method: "POST", headers: { Accept: "application/json" }, body: fd });
      const data = (await res.json().catch(() => null)) as null | {
        error?: string;
        redirectTo?: string;
        deduplicated?: boolean;
      };
      if (!res.ok) {
        await dialog.alert({
          title: "Spremanje nije uspjelo",
          message: data?.error ?? "Greška kod spremanja.",
          variant: "error",
        });
        return;
      }
      const redirectTo = String(data?.redirectTo ?? "").trim();
      if (redirectTo) window.location.href = redirectTo;
      else window.location.reload();
    } catch {
      await dialog.alert({
        title: "Spremanje nije uspjelo",
        message: "Greška kod spremanja.",
        variant: "error",
      });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      {saving ? (
        <LoadingOverlay
          title="Spremam radni nalog..."
          message="Molimo pričekajte, otvara se servisni nalog."
        />
      ) : null}
      <form id={formId} className={className} onSubmit={onSubmit} aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-4">
          {children}
        </fieldset>
      </form>
    </>
  );
}
