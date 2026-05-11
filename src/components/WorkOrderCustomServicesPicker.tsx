"use client";

import { useMemo, useState } from "react";

export type CustomServiceLite = {
  id: string;
  name: string;
  code: string | null;
  price: number | null;
};

function formatLabel(s: CustomServiceLite): string {
  const parts: string[] = [s.name];
  if (s.code) parts.push(`(${s.code})`);
  if (s.price !== null) parts.push(`— ${s.price.toFixed(2)} €`);
  return parts.join(" ");
}

export default function WorkOrderCustomServicesPicker(props: {
  available: CustomServiceLite[];
  initialSelectedIds: string[];
}) {
  const { available } = props;

  const allById = useMemo(() => {
    const m = new Map<string, CustomServiceLite>();
    for (const s of available) m.set(s.id, s);
    return m;
  }, [available]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(props.initialSelectedIds),
  );
  const [toAdd, setToAdd] = useState<string>("");

  const selected = useMemo(() => {
    const list: CustomServiceLite[] = [];
    for (const id of selectedIds) {
      const s = allById.get(id);
      if (s) list.push(s);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "hr"));
  }, [selectedIds, allById]);

  const availableForDropdown = useMemo(() => {
    return available
      .filter((s) => !selectedIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name, "hr"));
  }, [available, selectedIds]);

  function add() {
    if (!toAdd) return;
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.add(toAdd);
      return n;
    });
    setToAdd("");
  }

  function remove(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name="customServiceIds" value={id} />
      ))}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Dodatne usluge</div>
          <div className="mt-1 text-xs text-slate-600">
            Slobodne usluge tenanta — dodaju se po stavki, količina je{" "}
            <span className="font-medium">1</span>. Na otpremnici se ispisuju u tablici „Izvršene
            usluge“ s računovodstvenom šifrom.
          </div>
        </div>
        <div className="subtle">Odabrano: {selectedIds.size}</div>
      </div>

      <div className="mt-3 max-h-[200px] overflow-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="table">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Naziv</th>
              <th className="table-cell whitespace-nowrap">Šifra</th>
              <th className="table-cell whitespace-nowrap">Cijena</th>
              <th className="table-cell text-right">Akcija</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {selected.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="table-cell">{s.name}</td>
                <td className="table-cell font-mono text-xs whitespace-nowrap">
                  {s.code ?? "—"}
                </td>
                <td className="table-cell whitespace-nowrap">
                  {s.price !== null ? `${s.price.toFixed(2)} €` : "—"}
                </td>
                <td className="table-cell text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="btn btn-outline h-9 px-3"
                    onClick={() => remove(s.id)}
                  >
                    Ukloni
                  </button>
                </td>
              </tr>
            ))}
            {selected.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={4}>
                  Nema odabranih dodatnih usluga.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <label className="label">Odaberi uslugu</label>
          <select
            className="select"
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            disabled={availableForDropdown.length === 0}
          >
            <option value="">
              {availableForDropdown.length === 0
                ? "-- nema dostupnih usluga --"
                : "-- odaberi --"}
            </option>
            {availableForDropdown.map((s) => (
              <option key={s.id} value={s.id}>
                {formatLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary h-10 px-4"
          onClick={add}
          disabled={!toAdd}
        >
          Dodaj
        </button>
      </div>
      <div className="help">
        Odaberi uslugu iz padajućeg izbornika i klikni „Dodaj“. Vlastite usluge dodaješ u{" "}
        <i>Postavke → Usluge → Vlastite usluge</i>.
      </div>
    </div>
  );
}
