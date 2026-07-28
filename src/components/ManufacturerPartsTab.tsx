"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

type ExType = {
  id: string;
  code: string;
  name: string;
  agent: { label: string } | null;
  construction: { code: string; label: string; sortOrder: number } | null;
};

type PartUnit = "KOM" | "KG" | "L";

type PartRow = {
  id: string;
  code: string;
  name: string;
  common: boolean;
  unit: PartUnit;
  defaultPrice: number | null;
  active: boolean;
  typeIds: string[];
};

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default function ManufacturerPartsTab(props: {
  manufacturerId: string;
  availableTypes: ExType[];
  parts: PartRow[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [common, setCommon] = useState(false);
  const [unit, setUnit] = useState<PartUnit>("KOM");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [typeIds, setTypeIds] = useState<string[]>([]);

  function resetForm() {
    setEditingId(null);
    setCode("");
    setName("");
    setCommon(false);
    setUnit("KOM");
    setDefaultPrice("");
    setTypeIds([]);
    setError(null);
  }

  function startEdit(p: PartRow) {
    setEditingId(p.id);
    setCode(p.code);
    setName(p.name);
    setCommon(p.common);
    setUnit(p.unit);
    setDefaultPrice(p.defaultPrice != null ? String(p.defaultPrice) : "");
    setTypeIds([...p.typeIds]);
    setError(null);
  }

  function toggleType(id: string) {
    setTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAll() {
    setTypeIds(props.availableTypes.map((t) => t.id));
  }
  function clearAll() {
    setTypeIds([]);
  }

  function selectGroup(types: ExType[]) {
    const ids = types.map((t) => t.id);
    setTypeIds((prev) => Array.from(new Set([...prev, ...ids])));
  }

  // Grupiraj tipove po izvedbi (Stalni tlak → Bočica → CO2). Tipovi bez izvedbe
  // (rijetko, npr. nepotpuno popunjeni) idu na kraj pod „Ostalo".
  const groupOrder: Array<{ key: string; label: string; sortOrder: number }> = [];
  const groupsMap = new Map<string, { label: string; sortOrder: number; types: ExType[] }>();
  for (const t of props.availableTypes) {
    const key = t.construction?.code ?? "__OTHER__";
    const label = t.construction?.label ?? "Ostalo";
    const sortOrder = t.construction?.sortOrder ?? 9999;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { label, sortOrder, types: [] });
      groupOrder.push({ key, label, sortOrder });
    }
    groupsMap.get(key)!.types.push(t);
  }
  groupOrder.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(
      `/api/platform/manufacturers/${props.manufacturerId}/parts/upsert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          code,
          name,
          common,
          unit,
          defaultPrice: defaultPrice.trim() === "" ? null : defaultPrice.trim(),
          typeIds,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška.");
      return;
    }
    resetForm();
    router.refresh();
  }

  async function toggleActive(id: string, next: boolean) {
    setBusy(true);
    await fetch(`/api/platform/manufacturers/${props.manufacturerId}/parts/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: next }),
    });
    setBusy(false);
    router.refresh();
  }

  async function deletePart(id: string) {
    const ok = await dialog.confirm({
      title: "Obrisati dio iz kataloga?",
      message: "Dio će biti trajno uklonjen iz kataloga ovog proizvođača.",
      danger: true,
      confirmLabel: "Obriši",
    });
    if (!ok) return;
    setBusy(true);
    await fetch(`/api/platform/manufacturers/${props.manufacturerId}/parts/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="surface p-4">
        <h3 className="text-base font-semibold mb-3">
          {editingId ? "Uredi dio" : "Dodaj novi dio"}
        </h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-2">
              <label className="label">Šifra</label>
              <input
                className="input font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BRT-01"
                required
              />
            </div>
            <div className="sm:col-span-4">
              <label className="label">Naziv</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Brtva ventila"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Jedinica</label>
              <select
                className="select"
                value={unit}
                onChange={(e) => setUnit(e.target.value as PartUnit)}
              >
                <option value="KOM">kom</option>
                <option value="KG">kg</option>
                <option value="L">L</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Cijena (EUR)</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="npr. 26.60"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={common}
                  onChange={(e) => setCommon(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Uobičajen</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label">Za koje tipove aparata? (opcionalno)</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline h-7 px-3 text-xs"
                  onClick={selectAll}
                >
                  Označi sve
                </button>
                <button
                  type="button"
                  className="btn btn-outline h-7 px-3 text-xs"
                  onClick={clearAll}
                >
                  Očisti
                </button>
              </div>
            </div>
            {props.availableTypes.length === 0 ? (
              <div className="text-sm text-slate-500 mt-2">
                Ovaj proizvođač još nema dodanih tipova aparata. Prvo dodaj tipove.
              </div>
            ) : (
              <div className="mt-2 space-y-4">
                {groupOrder.map((g) => {
                  const group = groupsMap.get(g.key)!;
                  return (
                    <div key={g.key}>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {group.label}
                          <span className="ml-2 text-slate-400 normal-case font-normal">
                            ({group.types.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                          onClick={() => selectGroup(group.types)}
                        >
                          Označi sve u grupi
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {group.types.map((t) => {
                          const checked = typeIds.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={[
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition",
                                checked
                                  ? "border-slate-900 bg-slate-900/5"
                                  : "border-slate-200 hover:bg-slate-50",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleType(t.id)}
                                className="h-4 w-4"
                              />
                              <span className="font-mono text-xs">{t.code}</span>
                              <span className="text-slate-500 truncate">
                                {t.agent?.label ?? ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button className="btn btn-primary px-4" type="submit" disabled={busy}>
              {editingId ? "Spremi promjene" : "Dodaj dio"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-outline px-4"
                onClick={resetForm}
                disabled={busy}
              >
                Odustani
              </button>
            )}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>
      </section>

      <section className="surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Šifra</th>
                <th className="p-3">Naziv</th>
                <th className="p-3">Jed.</th>
                <th className="p-3 text-right">Cijena</th>
                <th className="p-3">Uobičajen</th>
                <th className="p-3">Tipovi</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {props.parts.map((p) => {
                const typeLabels = p.typeIds
                  .map((id) => props.availableTypes.find((t) => t.id === id)?.code)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{p.code}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3 text-xs text-slate-600">
                      {p.unit === "KG" ? "kg" : p.unit === "L" ? "L" : "kom"}
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs text-slate-700">
                      {fmtPrice(p.defaultPrice)}
                    </td>
                    <td className="p-3">
                      {p.common ? (
                        <span className="badge badge-success">DA</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600">{typeLabels || "—"}</td>
                    <td className="p-3">
                      {p.active ? (
                        <span className="badge badge-success">Aktivno</span>
                      ) : (
                        <span className="badge badge-neutral">Neaktivno</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => startEdit(p)}
                          disabled={busy}
                        >
                          Uredi
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => toggleActive(p.id, !p.active)}
                          disabled={busy}
                        >
                          {p.active ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs text-rose-600"
                          onClick={() => deletePart(p.id)}
                          disabled={busy}
                        >
                          Obriši
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {props.parts.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500 text-center" colSpan={8}>
                    Nema dijelova.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
