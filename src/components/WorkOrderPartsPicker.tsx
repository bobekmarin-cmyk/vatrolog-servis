"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useServiceScrapMode } from "@/components/ServiceScrapModeContext";
import { formatPartUnit } from "@/lib/partsCatalog";
import type { PartUnit } from "@prisma/client";

export type PickerPart = {
  id: string;
  /** Vlastita / prikazna šifra (tenantova ili manufacturerCode fallback). */
  code: string;
  /** Šifra proizvođača — null za vlastite dijelove. */
  manufacturerCode: string | null;
  name: string;
  unit: PartUnit;
  isCustom: boolean;
  isCommon: boolean;
};

type SelectedRow = {
  id: string;
  qty: number;
};

const DEFAULT_QTY = 1;

function comparePartsByName(a: PickerPart, b: PickerPart): number {
  return a.name.localeCompare(b.name, "hr") || a.code.localeCompare(b.code, "hr");
}

function filterParts(source: PickerPart[], term: string): PickerPart[] {
  const q = term.trim().toLocaleLowerCase("hr");
  if (!q) return source;
  return source.filter((p) => {
    const haystack = [p.name, p.code, p.manufacturerCode ?? ""].join(" ").toLocaleLowerCase("hr");
    return haystack.includes(q);
  });
}

export default function WorkOrderPartsPicker(props: {
  kind: string;
  parts: PickerPart[];
  initialSelected: Array<{ id: string; quantity: number }>;
}) {
  const { parts } = props;
  const scrapMode = useServiceScrapMode();
  const selectionBackupRef = useRef<Map<string, number> | null>(null);

  const partsById = useMemo(() => {
    const m = new Map<string, PickerPart>();
    for (const p of parts) m.set(p.id, p);
    return m;
  }, [parts]);

  const [selected, setSelected] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const row of props.initialSelected) {
      const q = Math.max(1, Math.floor(row.quantity || DEFAULT_QTY));
      m.set(row.id, q);
    }
    return m;
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingQty, setEditingQty] = useState<SelectedRow | null>(null);

  useEffect(() => {
    if (scrapMode) {
      queueMicrotask(() => {
        setSelected((prev) => {
          if (prev.size > 0) {
            selectionBackupRef.current = new Map(prev);
          }
          return new Map();
        });
      });
      return;
    }
    if (selectionBackupRef.current !== null) {
      queueMicrotask(() => {
        setSelected(selectionBackupRef.current!);
        selectionBackupRef.current = null;
      });
    }
  }, [scrapMode]);

  const selectedRows = useMemo<Array<SelectedRow & { part: PickerPart }>>(() => {
    const list: Array<SelectedRow & { part: PickerPart }> = [];
    for (const [id, qty] of selected) {
      const p = partsById.get(id);
      if (p) list.push({ id, qty, part: p });
    }
    return list.sort((a, b) => comparePartsByName(a.part, b.part));
  }, [selected, partsById]);

  const commonParts = useMemo(
    () => parts.filter((p) => p.isCommon).sort(comparePartsByName),
    [parts],
  );

  function commitQty(id: string, qty: number) {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Map(prev);
      n.set(id, Math.max(1, Math.floor(qty || DEFAULT_QTY)));
      return n;
    });
    setEditingQty(null);
  }

  function remove(id: string) {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Map(prev);
      n.delete(id);
      return n;
    });
  }

  return (
    <div className="surface p-4">
      {Array.from(selected).map(([id, qty]) => (
        <div key={id} className="hidden">
          <input type="hidden" name="partIds" value={id} />
          <input type="hidden" name={`partQty_${id}`} value={String(qty)} />
        </div>
      ))}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-900">Rezervni dijelovi</div>
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
            title="Rezervni dijelovi ugrađeni na ovoj stavki servisa. Količina i jedinica spremaju se za otpremnicu i kasniji obračun."
            aria-label="Informacija o rezervnim dijelovima."
          >
            i
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="subtle">Odabrano: {selected.size}</div>
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={() => setPickerOpen(true)}
          >
            Dodaj dio
          </button>
        </div>
      </div>

      {selectedRows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nema odabranih dijelova.</p>
      ) : (
        <div className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Šifra</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Šifra proizvođača</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left">Naziv</th>
                <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Količina</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {selectedRows.map(({ id, qty, part }) => (
                <tr key={id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap text-slate-900">
                    {part.code}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-slate-600">
                    {part.manufacturerCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-900">
                    <div className="clamp-2 max-w-[520px]" title={part.name}>
                      {part.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                    <span className="font-medium text-slate-900">{qty}</span>{" "}
                    <span className="text-xs text-slate-500">{formatPartUnit(part.unit)}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      onClick={() => setEditingQty({ id, qty })}
                      aria-label={`Uredi količinu za ${part.name}`}
                      title="Uredi količinu"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => remove(id)}
                      aria-label={`Ukloni ${part.name}`}
                      title="Ukloni"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PartsSelectionModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        parts={parts}
        commonParts={commonParts}
        initialSelected={selected}
        onSave={(next) => {
          setSelected(next);
          setPickerOpen(false);
        }}
      />

      <EditQuantityModal
        key={editingQty?.id ?? "__closed__"}
        row={editingQty}
        part={editingQty ? partsById.get(editingQty.id) ?? null : null}
        onClose={() => setEditingQty(null)}
        onSave={commitQty}
      />
    </div>
  );
}

function PartsSelectionModal(props: {
  open: boolean;
  onClose: () => void;
  parts: PickerPart[];
  commonParts: PickerPart[];
  initialSelected: Map<string, number>;
  onSave: (next: Map<string, number>) => void;
}) {
  const { open, onClose, parts, commonParts, initialSelected, onSave } = props;
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Map<string, number>>(() => new Map(initialSelected));
  const [quantities, setQuantities] = useState<Map<string, number>>(() => new Map(initialSelected));
  const commonIds = useMemo(() => new Set(commonParts.map((p) => p.id)), [commonParts]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setSearch("");
        setDraft(new Map(initialSelected));
        setQuantities(new Map(initialSelected));
      });
    }
  }, [open, initialSelected]);

  function getQty(id: string): number {
    return quantities.get(id) ?? draft.get(id) ?? DEFAULT_QTY;
  }

  function setModalQty(id: string, raw: string) {
    const next = Math.max(1, Math.floor(Number(raw) || DEFAULT_QTY));
    setQuantities((prev) => {
      const n = new Map(prev);
      n.set(id, next);
      return n;
    });
    setDraft((prev) => {
      const n = new Map(prev);
      if (n.has(id)) n.set(id, next);
      return n;
    });
  }

  function add(id: string) {
    setDraft((prev) => {
      if (prev.has(id)) return prev;
      const n = new Map(prev);
      n.set(id, getQty(id));
      return n;
    });
  }

  function removeFromDraft(id: string) {
    setDraft((prev) => {
      const n = new Map(prev);
      n.delete(id);
      return n;
    });
  }

  const otherParts = useMemo(
    () => parts.filter((p) => !commonIds.has(p.id)).sort(comparePartsByName),
    [parts, commonIds],
  );

  const filteredCommon = useMemo(() => filterParts(commonParts, search), [commonParts, search]);
  const filteredOther = useMemo(() => filterParts(otherParts, search), [otherParts, search]);

  function renderRows(rows: PickerPart[], emptyText: string) {
    if (rows.length === 0) {
      return (
        <tr>
          <td className="p-4 text-slate-500" colSpan={6}>
            {emptyText}
          </td>
        </tr>
      );
    }

    return rows.map((p) => {
      const already = draft.has(p.id);
      return (
        <tr key={p.id} className="hover:bg-slate-50">
          <td className="table-cell font-mono text-xs whitespace-nowrap font-semibold text-slate-900">
            {p.code}
          </td>
          <td className="table-cell font-mono text-xs whitespace-nowrap text-slate-600">
            {p.manufacturerCode ?? "—"}
          </td>
          <td className="table-cell">
            <div className="clamp-2 max-w-[460px]" title={p.name}>
              {p.name}
            </div>
          </td>
          <td className="table-cell whitespace-nowrap text-xs">
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 font-medium " +
                (p.isCustom ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700")
              }
            >
              {p.isCustom ? "Vlastiti" : "Proizvođački"}
            </span>
          </td>
          <td className="table-cell whitespace-nowrap">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                step={1}
                value={getQty(p.id)}
                onChange={(e) => setModalQty(p.id, e.target.value)}
                className="input h-8 w-16 px-2 text-right text-sm"
                aria-label={`Količina za ${p.name}`}
              />
              <span className="text-xs text-slate-500">{formatPartUnit(p.unit)}</span>
            </div>
          </td>
          <td className="table-cell text-right whitespace-nowrap">
            {already ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                onClick={() => removeFromDraft(p.id)}
                aria-label={`Ukloni ${p.name}`}
                title="Ukloni"
              >
                <TrashIcon />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline h-8 px-3 text-xs"
                onClick={() => add(p.id)}
              >
                Dodaj
              </button>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <Modal
      open={open}
      title="Dodaj dio"
      variant="neutral"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={onClose}
          >
            Odustani
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => onSave(new Map(draft))}
          >
            Spremi odabir ({draft.size})
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po nazivu ili šifri…"
          className="input w-full"
          autoFocus
        />

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-900">
            Uobičajeni dijelovi
          </div>
          <div className="max-h-[28vh] overflow-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <table className="table">
              <thead className="table-head sticky top-0 bg-white">
                <tr>
                  <th className="table-cell whitespace-nowrap">Šifra (vlastita)</th>
                  <th className="table-cell whitespace-nowrap">Šifra proizv.</th>
                  <th className="table-cell">Naziv</th>
                  <th className="table-cell whitespace-nowrap">Izvor</th>
                  <th className="table-cell whitespace-nowrap">Količina</th>
                  <th className="table-cell text-right">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {renderRows(
                  filteredCommon,
                  "Nema uobičajenih dijelova za ovaj aparat. Označite ih zvjezdicom u Postavke → Rezervni dijelovi.",
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-900">Ostali dijelovi</div>
          <div className="max-h-[34vh] overflow-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="table">
            <thead className="table-head sticky top-0 bg-white">
              <tr>
                <th className="table-cell whitespace-nowrap">Šifra (vlastita)</th>
                <th className="table-cell whitespace-nowrap">Šifra proizv.</th>
                <th className="table-cell">Naziv</th>
                <th className="table-cell whitespace-nowrap">Izvor</th>
                <th className="table-cell whitespace-nowrap">Količina</th>
                <th className="table-cell text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {renderRows(filteredOther, "Nema rezultata.")}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditQuantityModal(props: {
  row: SelectedRow | null;
  part: PickerPart | null;
  onClose: () => void;
  onSave: (id: string, qty: number) => void;
}) {
  const { row, part, onClose, onSave } = props;
  const [qty, setQtyLocal] = useState(() => row?.qty ?? DEFAULT_QTY);

  return (
    <Modal
      open={row !== null}
      title="Uredi količinu"
      variant="neutral"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={onClose}
          >
            Odustani
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => row && onSave(row.id, qty)}
            disabled={!row}
          >
            Spremi
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {part && (
          <div className="text-sm text-slate-700">
            <div className="font-medium text-slate-900">{part.name}</div>
            <div className="mt-1 font-mono text-xs text-slate-500">{part.code}</div>
          </div>
        )}
        <label className="block">
          <span className="label">Količina</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQtyLocal(Math.max(1, Math.floor(Number(e.target.value) || DEFAULT_QTY)))}
              className="input w-24 text-right"
              autoFocus
            />
            {part && <span className="text-sm text-slate-500">{formatPartUnit(part.unit)}</span>}
          </div>
        </label>
      </div>
    </Modal>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 13.5V16h2.5L14 8.5 11.5 6 4 13.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12 5.5 1-1a1.4 1.4 0 0 1 2 2l-1 1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
