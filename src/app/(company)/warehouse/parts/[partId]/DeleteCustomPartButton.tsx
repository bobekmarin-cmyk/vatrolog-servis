"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

export default function DeleteCustomPartButton({
  partId,
  manufacturerId,
}: {
  partId: string;
  manufacturerId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouse/parts/${partId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Brisanje nije uspjelo.");
      }
      router.push(`/warehouse/manufacturer/${manufacturerId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full rounded-md border border-rose-300 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        Obriši vlastiti dio
      </button>

      <Modal
        open={open}
        title="Brisanje vlastitog dijela"
        variant="danger"
        size="md"
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setError(null);
          }
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => !busy && setOpen(false)}
              disabled={busy}
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Odustani
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy ? "Brišem…" : "Potvrdi brisanje"}
            </button>
          </>
        }
      >
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>
            Jeste li sigurni da želite obrisati ovaj vlastiti dio? Ovu radnju nije moguće poništiti.
          </p>
          <p className="text-xs text-slate-500">
            Brisanje nije moguće ako je dio već korišten u radnim nalozima, primkama ili korekcijama.
            U tom slučaju ga možete samo deaktivirati.
          </p>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-700">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
