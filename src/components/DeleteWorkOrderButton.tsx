"use client";

import { useState } from "react";
import { useDialog } from "@/components/ui/useDialog";

export default function DeleteWorkOrderButton({
  workOrderId,
  orderNumber,
  disabled = false,
  disabledReason,
}: {
  workOrderId: string;
  orderNumber: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const dialog = useDialog();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (disabled || loading) return;

    const ok = await dialog.confirm({
      title: `Obrisati nalog ${orderNumber}?`,
      message: (
        <div className="space-y-2">
          <p>
            Brisanje je moguće samo ako <b>nijedan</b> aparat u nalogu nije servisiran
            (nema naljepnice/servisa).
          </p>
          <p>Ako nalog ima primku, obrisat će se i primka.</p>
        </div>
      ),
      danger: true,
      confirmLabel: "Obriši nalog",
    });
    if (!ok) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/work-orders/${workOrderId}/delete`, {
        method: "POST",
      });

      if (!res.ok) {
        const txt = await res.text();
        await dialog.alert({
          title: "Brisanje nije uspjelo",
          message: txt || `Greška ${res.status}.`,
          variant: "error",
        });
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  const title = disabled
    ? disabledReason ?? "Nije moguće obrisati: u nalogu postoji servisirana stavka / naljepnica."
    : "Obriši nalog";

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={disabled || loading}
      title={title}
      className="btn btn-outline px-2 py-1 text-xs text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Obriši
    </button>
  );
}
