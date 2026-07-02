"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

export type LabelPrices = {
  labelPeriodicPrice: string;
  labelApparatusMassPrice: string;
  labelCylinderMassPrice: string;
};

function parsePrice(v: string): number | null | undefined {
  const t = v.trim().replace(",", ".");
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export default function LabelPricesPanel(props: { initial: LabelPrices }) {
  const router = useRouter();
  const dialog = useDialog();
  const [prices, setPrices] = useState<LabelPrices>(props.initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function setField(k: keyof LabelPrices, v: string) {
    setPrices((p) => ({ ...p, [k]: v }));
    setDirty(true);
  }

  async function save() {
    const payload = {
      labelPeriodicPrice: parsePrice(prices.labelPeriodicPrice),
      labelApparatusMassPrice: parsePrice(prices.labelApparatusMassPrice),
      labelCylinderMassPrice: parsePrice(prices.labelCylinderMassPrice),
    };
    if (Object.values(payload).some((v) => v === undefined)) {
      await dialog.alert({
        title: "Neispravna cijena",
        message: "Cijena mora biti broj veći ili jednak 0 (npr. 2.50). Prazno polje briše cijenu.",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/authorizations/label-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Greška pri spremanju.");
      }
      setDirty(false);
      setSavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      await dialog.alert({
        title: "Nije moguće spremiti cijene",
        message: msg,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">Cijene naljepnica</div>
      <div className="text-xs text-slate-500">
        Neto cijene (bez PDV-a) po vrsti naljepnice — primjenjuju se neovisno o proizvođaču.
        Koriste se za stavke naljepnica na e-računu; svaka vrsta je zasebna stavka.
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <PriceField
          label="Cijena PP naljepnice (€)"
          value={prices.labelPeriodicPrice}
          onChange={(v) => setField("labelPeriodicPrice", v)}
          disabled={saving}
        />
        <PriceField
          label="Cijena naljepnice mase aparata (€)"
          value={prices.labelApparatusMassPrice}
          onChange={(v) => setField("labelApparatusMassPrice", v)}
          disabled={saving}
        />
        <PriceField
          label="Cijena naljepnice mase bočice (€)"
          value={prices.labelCylinderMassPrice}
          onChange={(v) => setField("labelCylinderMassPrice", v)}
          disabled={saving}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={save}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Spremam…" : "Spremi cijene"}
        </button>
        {dirty && !saving ? (
          <button
            type="button"
            onClick={() => {
              setPrices(props.initial);
              setDirty(false);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Odustani
          </button>
        ) : null}
        {savedAt ? <span className="text-xs font-medium text-emerald-700">Spremljeno ✓</span> : null}
      </div>
    </div>
  );
}

function PriceField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{props.label}</span>
      <input
        type="text"
        inputMode="decimal"
        className={
          "input h-9 text-sm " +
          (props.disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "")
        }
        value={props.value}
        placeholder="npr. 2.50"
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        maxLength={12}
      />
    </label>
  );
}
