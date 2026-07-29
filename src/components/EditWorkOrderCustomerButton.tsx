"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import ReceiptCustomerDepartmentPicker from "@/components/ReceiptCustomerDepartmentPicker";
import { useDialog } from "@/components/ui/useDialog";

type CustomerDTO = {
  id: string;
  name: string;
  shortName?: string | null;
  oib: string;
  address: string;
  contactPerson: string | null;
  phone: string | null;
};

export default function EditWorkOrderCustomerButton({
  orderId,
  customer,
  departmentId,
  note,
}: {
  orderId: string;
  customer: CustomerDTO;
  departmentId: string;
  note: string;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteValue, setNoteValue] = useState(note);

  function openModal() {
    setNoteValue(note);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch(`/api/work-orders/${orderId}/update-customer`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        await dialog.alert({
          title: "Spremanje nije uspjelo",
          message: data?.error ?? "Greška kod izmjene kupca.",
          variant: "error",
        });
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      await dialog.alert({
        title: "Spremanje nije uspjelo",
        message: "Greška kod izmjene kupca.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-700"
        onClick={openModal}
        title="Promijeni kupca / odjeljenje / napomenu"
        aria-label="Promijeni kupca / odjeljenje / napomenu"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => (saving ? undefined : setOpen(false))}
        title="Izmijeni kupca"
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Odustani
            </button>
            <button type="submit" form="edit-wo-customer-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Spremam…" : "Spremi"}
            </button>
          </div>
        }
      >
        <form id="edit-wo-customer-form" className="space-y-4" onSubmit={handleSubmit}>
          <ReceiptCustomerDepartmentPicker
            defaultCustomer={customer}
            defaultDepartmentId={departmentId}
          />
          <div>
            <label className="label" htmlFor="edit-wo-note">
              Napomena
            </label>
            <textarea
              id="edit-wo-note"
              name="note"
              className="textarea mt-1 min-h-[100px] w-full"
              rows={4}
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              maxLength={4000}
              placeholder="Opcionalno — npr. posebne upute za isporuku"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
