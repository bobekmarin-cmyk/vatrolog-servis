"use client";

import { useMemo, useState } from "react";

type PartLite = { id: string; code: string; name: string };

export default function WorkOrderPartsPicker(props: {
  kind: string;
  commonParts: PartLite[];
  otherParts: PartLite[];
  initialSelectedIds: string[];
}) {
  const { kind, commonParts, otherParts } = props;

  const allParts = useMemo(() => {
    const m = new Map<string, PartLite>();
    for (const p of commonParts) m.set(p.id, p);
    for (const p of otherParts) m.set(p.id, p);
    return m;
  }, [commonParts, otherParts]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(props.initialSelectedIds));
  const [toAdd, setToAdd] = useState<string>("");

  const selectedParts = useMemo(() => {
    const list: PartLite[] = [];
    for (const id of selectedIds) {
      const p = allParts.get(id);
      if (p) list.push(p);
    }
    return list.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
  }, [selectedIds, allParts]);

  const availableOther = useMemo(() => {
    return otherParts.filter((p) => !selectedIds.has(p.id));
  }, [otherParts, selectedIds]);

  function toggle(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function addSelected() {
    if (!toAdd) return;
    toggle(toAdd, true);
    setToAdd("");
  }

  return (
    <div>
      {/* hidden fields sent to server */}
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name="partIds" value={id} />
      ))}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Rezervni dijelovi</div>
          <div className="mt-1 text-xs text-slate-600">
            Tip aparata: <span className="font-medium">{kind}</span> · Na otpremnici se prikazuju{" "}
            <span className="font-medium">šifre</span> odabranih dijelova.
          </div>
        </div>
        <div className="subtle">Odabrano: {selectedIds.size}</div>
      </div>

      {/* Selected table - ograničena visina */}
      <div className="mt-3 max-h-[200px] overflow-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="table">
          <thead className="table-head">
            <tr>
              <th className="table-cell whitespace-nowrap">Šifra</th>
              <th className="table-cell">Naziv</th>
              <th className="table-cell text-right">Akcija</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {selectedParts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="table-cell font-mono text-xs whitespace-nowrap">{p.code}</td>
                <td className="table-cell">
                  <div className="clamp-2 max-w-[720px]" title={p.name}>
                    {p.name}
                  </div>
                </td>
                <td className="table-cell text-right whitespace-nowrap">
                  <button type="button" className="btn btn-outline h-9 px-3" onClick={() => toggle(p.id, false)}>
                    Ukloni
                  </button>
                </td>
              </tr>
            ))}
            {selectedParts.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={3}>
                  Nema odabranih dijelova.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* common */}
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="text-xs font-semibold text-slate-600">Najčešće</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {commonParts.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="font-mono text-xs">{p.code}</span> <span className="text-slate-500">—</span>{" "}
                  <span className="clamp-2">{p.name}</span>
                </span>
              </label>
            ))}
            {commonParts.length === 0 ? <div className="text-sm text-slate-500">Nema najčešćih dijelova.</div> : null}
          </div>
        </div>

        {/* other */}
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="text-xs font-semibold text-slate-600">Ostali (rijetko)</div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className="label">Odaberi dio</label>
              <select className="select" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                <option value="">-- odaberi --</option>
                {availableOther.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary h-10 px-4" onClick={addSelected} disabled={!toAdd}>
              Dodaj
            </button>
          </div>
          <div className="help">Odaberi jedan dio i klikni “Dodaj”.</div>
        </div>
      </div>
    </div>
  );
}

