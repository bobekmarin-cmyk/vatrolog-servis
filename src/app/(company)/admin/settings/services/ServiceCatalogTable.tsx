"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useDialog } from "@/components/ui/useDialog";
import {
  MIN_TABLE_TD,
  MIN_TABLE_TH,
  MinimalRowAction,
  MinimalSearchInput,
  MinimalTableShell,
} from "@/components/admin/minimalSettingsTable";

export type ServiceCatalogRow = {
  id: string;
  kindLabel: string;
  kind: "PERIODIC" | "INTERNAL";
  itemLabel: string;
  code: string | null;
  price: number | null;
};

function formatHrPrice(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return "—";
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p);
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export default function ServiceCatalogTable({ rows }: { rows: ServiceCatalogRow[] }) {
  const router = useRouter();
  const dialog = useDialog();
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [saving, setSaving] = useState(false);

  const editingRow = useMemo(
    () => (editingId ? rows.find((r) => r.id === editingId) ?? null : null),
    [rows, editingId],
  );

  useEffect(() => {
    if (!editingRow) return;
    setCode(editingRow.code ?? "");
    setPriceStr(
      editingRow.price != null
        ? new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
            editingRow.price,
          )
        : "",
    );
  }, [editingRow]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.kindLabel} ${r.itemLabel} ${r.code ?? ""} ${r.price ?? ""}`.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  async function saveModal() {
    if (!editingRow) return;
    const newCode = code.trim().length ? code.trim() : null;
    const newPrice = parsePriceInput(priceStr);
    const codeSame = (editingRow.code ?? null) === newCode;
    const priceSame = (editingRow.price ?? null) === newPrice;
    if (codeSame && priceSame) {
      setEditingId(null);
      return;
    }

    const body: Record<string, unknown> = {};
    if (!codeSame) body.code = newCode;
    if (!priceSame) body.price = newPrice;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/service-catalog/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Greška pri spremanju.");
      setEditingId(null);
      router.refresh();
    } catch (e) {
      await dialog.alert({
        title: "Spremanje nije uspjelo",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <MinimalSearchInput
        value={filter}
        onChange={setFilter}
        placeholder="Pretraži po šifri, usluzi ili aparatu…"
        endSlot={
          <span className="subtle shrink-0 tabular-nums">
            Ukupno: {rows.length}
          </span>
        }
      />

      <MinimalTableShell className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={MIN_TABLE_TH + " w-[140px]"}>Šifra</th>
              <th className={MIN_TABLE_TH}>Usluga</th>
              <th className={MIN_TABLE_TH}>Aparat</th>
              <th className={MIN_TABLE_TH + " w-[120px] text-right"}>Cijena</th>
              <th className={MIN_TABLE_TH + " w-[100px] text-right"}>Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className={MIN_TABLE_TD + " font-mono text-xs text-slate-900"}>
                  {(r.code ?? "").length > 0 ? r.code : <span className="text-slate-400">—</span>}
                </td>
                <td className={MIN_TABLE_TD + " whitespace-nowrap font-medium text-slate-900"}>
                  {r.kindLabel}
                </td>
                <td className={MIN_TABLE_TD + " text-slate-700"}>{r.itemLabel}</td>
                <td className={MIN_TABLE_TD + " text-right tabular-nums text-slate-700"}>
                  {formatHrPrice(r.price)}
                </td>
                <td className={MIN_TABLE_TD + " text-right"}>
                  <div className="flex flex-wrap justify-end gap-3">
                    <MinimalRowAction onClick={() => setEditingId(r.id)}>Uredi</MinimalRowAction>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={5}>
                  Nema redaka koji odgovaraju pretrazi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MinimalTableShell>

      <p className="text-xs text-slate-500">
        Savjet: ista šifra može se koristiti za više medija (npr. prah i pjena) kod istog aparata — ali
        samo kad se poklapaju izvedba, kapacitet i tip pregleda.
      </p>

      <Modal
        open={!!editingRow}
        title="Uredi šifru i cijenu"
        variant="neutral"
        size="md"
        onClose={() => !saving && setEditingId(null)}
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline px-4"
              disabled={saving}
              onClick={() => setEditingId(null)}
            >
              Odustani
            </button>
            <button type="button" className="btn btn-primary px-4" disabled={saving} onClick={saveModal}>
              {saving ? "Spremam…" : "Spremi"}
            </button>
          </>
        }
      >
        {editingRow ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Usluga</div>
              <div className="font-medium text-slate-900">{editingRow.kindLabel}</div>
              <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Aparat</div>
              <div className="text-slate-800">{editingRow.itemLabel}</div>
            </div>
            <div>
              <label className="label" htmlFor="catalog-edit-code">
                Šifra
              </label>
              <input
                id="catalog-edit-code"
                className="input font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={50}
                placeholder="—"
              />
            </div>
            <div>
              <label className="label" htmlFor="catalog-edit-price">
                Cijena
              </label>
              <input
                id="catalog-edit-price"
                className="input text-right tabular-nums"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="npr. 12,50"
                inputMode="decimal"
                autoComplete="off"
              />
              <p className="help">Prazno = bez cijene u evidenciji.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
