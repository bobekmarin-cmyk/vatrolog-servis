"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceLabelKind } from "@prisma/client";

type LabelItem = { id: string; kind: ServiceLabelKind; label: string };
export type LabelManufacturer = {
  id: string;
  name: string;
  sortOrder?: number;
  labels: LabelItem[];
};

type Item = {
  key: string;
  manufacturerId: string;
  serviceLabelId: string;
  quantity: string;
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function LabelReceiptForm({
  manufacturers,
  prefillManufacturerId,
  prefillLabelId,
}: {
  manufacturers: LabelManufacturer[];
  prefillManufacturerId: string | null;
  prefillLabelId: string | null;
}) {
  const router = useRouter();

  const manuById = useMemo(() => {
    const map = new Map<string, LabelManufacturer>();
    for (const m of manufacturers) map.set(m.id, m);
    return map;
  }, [manufacturers]);

  const [receiptDate, setReceiptDate] = useState<string>(todayIso());
  const [reference, setReference] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [items, setItems] = useState<Item[]>(() => [
    {
      key: newKey(),
      manufacturerId: prefillManufacturerId ?? "",
      serviceLabelId: prefillLabelId ?? "",
      quantity: "",
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: newKey(), manufacturerId: "", serviceLabelId: "", quantity: "" },
    ]);
  }

  async function submit() {
    setError(null);
    if (!receiptDate) {
      setError("Datum primke je obavezan.");
      return;
    }
    const cleaned: { serviceLabelId: string; quantity: number }[] = [];
    for (const it of items) {
      if (!it.serviceLabelId) {
        setError("Svaka stavka mora imati odabranu naljepnicu.");
        return;
      }
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) {
        setError("Količina mora biti cijeli broj > 0.");
        return;
      }
      cleaned.push({ serviceLabelId: it.serviceLabelId, quantity: q });
    }
    if (cleaned.length === 0) {
      setError("Dodajte barem jednu stavku.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/warehouse/labels/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptDate,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
          items: cleaned,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Spremanje nije uspjelo.");
      }
      router.push(`/warehouse/labels/receipts/${j.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  const totalQty = items.reduce((s, i) => {
    const q = Number(i.quantity);
    return s + (Number.isFinite(q) ? q : 0);
  }, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Podaci primke</h2>
          <span className="text-xs text-slate-500">
            Dobavljač: <strong className="font-semibold text-slate-700">MUP RH</strong>
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Datum primke *</label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="input h-10 w-full"
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Referenca</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="npr. broj narudžbe / dostavnice MUP-a"
              className="input h-10 w-full"
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Napomena</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input h-10 w-full"
              disabled={saving}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Stavke</h2>
          <div className="text-sm text-slate-600">
            Ukupno komada: <strong className="tabular-nums">{totalQty}</strong>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {items.map((it, idx) => {
            const manu = it.manufacturerId ? manuById.get(it.manufacturerId) : null;
            const labels = manu?.labels ?? [];
            return (
              <div
                key={it.key}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-12"
              >
                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    #{idx + 1} Proizvođač
                  </label>
                  <select
                    value={it.manufacturerId}
                    onChange={(e) =>
                      updateItem(it.key, { manufacturerId: e.target.value, serviceLabelId: "" })
                    }
                    className="input h-9 w-full"
                    disabled={saving}
                  >
                    <option value="">— odaberi —</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Tip naljepnice
                  </label>
                  <select
                    value={it.serviceLabelId}
                    onChange={(e) => updateItem(it.key, { serviceLabelId: e.target.value })}
                    className="input h-9 w-full"
                    disabled={saving || !it.manufacturerId}
                  >
                    <option value="">
                      {it.manufacturerId ? "— odaberi naljepnicu —" : "najprije odaberi proizvođača"}
                    </option>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Količina *</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                    className="input h-9 w-full"
                    disabled={saving}
                  />
                </div>
                <div className="flex items-end md:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    disabled={saving || items.length <= 1}
                    className="h-9 w-full rounded-md border border-rose-200 bg-white text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    title="Ukloni stavku"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addItem}
          disabled={saving}
          className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Dodaj red
        </button>
      </section>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/warehouse/labels/receipts")}
          disabled={saving}
          className="btn btn-outline h-10"
        >
          Odustani
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="btn btn-primary h-10"
        >
          {saving ? "Spremam…" : "Spremi primku"}
        </button>
      </div>
    </div>
  );
}
