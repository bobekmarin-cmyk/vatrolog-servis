"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useServiceScrapMode } from "@/components/ServiceScrapModeContext";

export type CustomServiceLite = {
  id: string;
  name: string;
  code: string | null;
  price: number | null;
};

export default function WorkOrderCustomServicesPicker(props: {
  available: CustomServiceLite[];
  initialSelectedIds: string[];
}) {
  const { available } = props;
  const scrapMode = useServiceScrapMode();
  const selectionBackupRef = useRef<Set<string> | null>(null);

  const allById = useMemo(() => {
    const m = new Map<string, CustomServiceLite>();
    for (const s of available) m.set(s.id, s);
    return m;
  }, [available]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(props.initialSelectedIds),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (scrapMode) {
      setSelectedIds((prev) => {
        if (prev.size > 0) {
          selectionBackupRef.current = new Set(prev);
        }
        return new Set();
      });
      return;
    }
    if (selectionBackupRef.current !== null) {
      setSelectedIds(selectionBackupRef.current);
      selectionBackupRef.current = null;
    }
  }, [scrapMode]);

  const selected = useMemo(() => {
    const list: CustomServiceLite[] = [];
    for (const id of selectedIds) {
      const s = allById.get(id);
      if (s) list.push(s);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "hr"));
  }, [selectedIds, allById]);

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
          <span className="inline-flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Dodatne usluge</span>
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
              title="Slobodne usluge tenanta dodaju se po stavki, količina je 1 kom. Na otpremnici se ispisuju u tablici Izvršene usluge s računovodstvenom šifrom. Vlastite usluge dodaju se u Postavke → Usluge → Vlastite usluge."
              aria-label="Informacija o dodatnim uslugama."
            >
              i
            </button>
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary px-4"
          onClick={() => setPickerOpen(true)}
        >
          Dodaj uslugu
        </button>
      </div>

      <div className="mt-3 max-h-[200px] overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 text-left">Naziv</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Šifra</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Količina</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left whitespace-nowrap">Cijena</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                <td className="px-3 py-2 text-slate-900">{s.name}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-slate-600">
                  {s.code ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                  <span className="font-medium text-slate-900">1</span>{" "}
                  <span className="text-xs text-slate-500">kom</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {s.price !== null ? `${s.price.toFixed(2)} €` : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(s.id)}
                    aria-label={`Ukloni ${s.name}`}
                    title="Ukloni"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
            {selected.length === 0 && (
              <tr>
                <td className="p-4 text-slate-500" colSpan={5}>
                  Nema odabranih dodatnih usluga.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ServicesSelectionModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        available={available}
        initialSelected={selectedIds}
        onSave={(next) => {
          setSelectedIds(next);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function ServicesSelectionModal(props: {
  open: boolean;
  onClose: () => void;
  available: CustomServiceLite[];
  initialSelected: Set<string>;
  onSave: (next: Set<string>) => void;
}) {
  const { open, onClose, available, initialSelected, onSave } = props;
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set(initialSelected));

  useEffect(() => {
    if (open) {
      setSearch("");
      setDraft(new Set(initialSelected));
    }
  }, [open, initialSelected]);

  const filtered = useMemo(() => {
    const sorted = [...available].sort((a, b) => a.name.localeCompare(b.name, "hr"));
    const q = search.trim().toLocaleLowerCase("hr");
    if (!q) return sorted;
    return sorted.filter((s) => [s.name, s.code ?? ""].join(" ").toLocaleLowerCase("hr").includes(q));
  }, [available, search]);

  function add(id: string) {
    setDraft((prev) => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  function remove(id: string) {
    setDraft((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  return (
    <Modal
      open={open}
      title="Dodaj uslugu"
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
            onClick={() => onSave(new Set(draft))}
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
        <div className="max-h-[60vh] overflow-auto rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="table">
            <thead className="table-head sticky top-0 bg-white">
              <tr>
                <th className="table-cell">Naziv</th>
                <th className="table-cell whitespace-nowrap">Šifra</th>
                <th className="table-cell whitespace-nowrap">Količina</th>
                <th className="table-cell whitespace-nowrap">Cijena</th>
                <th className="table-cell text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s) => {
                const already = draft.has(s.id);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="table-cell">{s.name}</td>
                    <td className="table-cell font-mono text-xs whitespace-nowrap">
                      {s.code ?? "—"}
                    </td>
                    <td className="table-cell whitespace-nowrap">
                      <span className="font-medium text-slate-900">1</span>{" "}
                      <span className="text-xs text-slate-500">kom</span>
                    </td>
                    <td className="table-cell whitespace-nowrap">
                      {s.price !== null ? `${s.price.toFixed(2)} €` : "—"}
                    </td>
                    <td className="table-cell text-right whitespace-nowrap">
                      {already ? (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                          onClick={() => remove(s.id)}
                          aria-label={`Ukloni ${s.name}`}
                          title="Ukloni"
                        >
                          <TrashIcon />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => add(s.id)}
                        >
                          Dodaj
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={5}>
                    Nema rezultata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
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
