"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

export default function DeleteExtinguisherButton(props: {
  extinguisherId: string;
  internalCode: string;
  hasServiceHistory: boolean;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const historyNote = props.hasServiceHistory
      ? " Aparat ima evidentirane servise — stavke naloga ostaju, ali veza na ovaj aparat će biti uklonjena."
      : "";
    const ok = await dialog.confirm({
      title: "Trajno obrisati aparat?",
      message:
        `Brišete aparat ${props.internalCode}. Interni broj će se osloboditi za novi unos.${historyNote} Ova radnja se ne može poništiti.`,
      danger: true,
      confirmLabel: "Obriši aparat",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/extinguishers/${props.extinguisherId}/delete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await dialog.alert({
          title: "Brisanje nije uspjelo",
          message: data.error ?? "Greška pri brisanju aparata.",
          variant: "error",
        });
        return;
      }
      router.push("/extinguishers");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-outline px-4 text-rose-700 hover:bg-rose-50"
      onClick={onDelete}
      disabled={busy}
    >
      {busy ? "Brišem…" : "Obriši aparat"}
    </button>
  );
}
