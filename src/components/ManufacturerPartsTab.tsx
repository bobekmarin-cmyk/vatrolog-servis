"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
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

type Draft = {
  id: string | null;
  code: string;
  name: string;
  common: boolean;
  unit: PartUnit;
  defaultPrice: string;
  typeIds: string[];
};

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function emptyDraft(): Draft {
  return {
    id: null,
    code: "",
    name: "",
    common: false,
    unit: "KOM",
    defaultPrice: "",
    typeIds: [],
  };
}

function summarizeTypes(
  typeIds: string[],
  availableTypes: ExType[],
): { label: string; title: string } {
  if (typeIds.length === 0) return { label: "—", title: "Nema pridruženih tipova" };
  if (typeIds.length === availableTypes.length && availableTypes.length > 0) {
    return { label: "Svi tipovi", title: availableTypes.map((t) => t.code).join(", ") };
  }
  const codes = typeIds
    .map((id) => availableTypes.find((t) => t.id === id)?.code)
    .filter(Boolean) as string[];
  if (codes.length <= 3) {
    return { label: codes.join(", "), title: codes.join(", ") };
  }
  return {
    label: `${codes.length} tipova`,
    title: codes.join(", "),
  };
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
  const [filter, setFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [typeFilter, setTypeFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const typeGroups = useMemo(() => {
    const order: Array<{ key: string; label: string; sortOrder: number }> = [];
    const map = new Map<string, { label: string; sortOrder: number; types: ExType[] }>();
    for (const t of props.availableTypes) {
      const key = t.construction?.code ?? "__OTHER__";
      const label = t.construction?.label ?? "Ostalo";
      const sortOrder = t.construction?.sortOrder ?? 9999;
      if (!map.has(key)) {
        map.set(key, { label, sortOrder, types: [] });
        order.push({ key, label, sortOrder });
      }
      map.get(key)!.types.push(t);
    }
    order.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "hr"));
    for (const g of map.values()) {
      g.types.sort((a, b) => a.code.localeCompare(b.code, "hr"));
    }
    return { order, map };
  }, [props.availableTypes]);

  const visibleParts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return props.parts;
    return props.parts.filter((p) =>
      `${p.code} ${p.name}`.toLowerCase().includes(q),
    );
  }, [props.parts, filter]);

  function openCreate() {
    setDraft(emptyDraft());
    setTypeFilter("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: PartRow) {
    setDraft({
      id: p.id,
      code: p.code,
      name: p.name,
      common: p.common,
      unit: p.unit,
      defaultPrice: p.defaultPrice != null ? String(p.defaultPrice) : "",
      typeIds: [...p.typeIds],
    });
    setTypeFilter("");
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setModalOpen(false);
    setError(null);
    setDraft(emptyDraft());
    setTypeFilter("");
  }

  function toggleType(id: string) {
    setDraft((prev) => ({
      ...prev,
      typeIds: prev.typeIds.includes(id)
        ? prev.typeIds.filter((x) => x !== id)
        : [...prev.typeIds, id],
    }));
  }

  function selectAllTypes() {
    setDraft((prev) => ({
      ...prev,
      typeIds: props.availableTypes.map((t) => t.id),
    }));
  }

  function clearTypes() {
    setDraft((prev) => ({ ...prev, typeIds: [] }));
  }

  function selectGroup(types: ExType[]) {
    const ids = types.map((t) => t.id);
    setDraft((prev) => ({
      ...prev,
      typeIds: Array.from(new Set([...prev.typeIds, ...ids])),
    }));
  }

  function clearGroup(types: ExType[]) {
    const ids = new Set(types.map((t) => t.id));
    setDraft((prev) => ({
      ...prev,
      typeIds: prev.typeIds.filter((id) => !ids.has(id)),
    }));
  }

  function toggleGroupCollapse(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
          id: draft.id ?? undefined,
          code: draft.code,
          name: draft.name,
          common: draft.common,
          unit: draft.unit,
          defaultPrice: draft.defaultPrice.trim() === "" ? null : draft.defaultPrice.trim(),
          typeIds: draft.typeIds,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška.");
      return;
    }
    setModalOpen(false);
    setDraft(emptyDraft());
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

  const selectedCount = draft.typeIds.length;
  const totalTypes = props.availableTypes.length;
  const typeQ = typeFilter.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <section className="surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Dijelovi</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {props.parts.length} u katalogu · uređivanje u modalu
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={openCreate}
            disabled={busy}
          >
            + Dodaj dio
          </button>
        </div>

        <div className="mt-4">
          <input
            type="search"
            className="input max-w-md"
            placeholder="Pretraži šifru ili naziv…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
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
              {visibleParts.map((p) => {
                const summary = summarizeTypes(p.typeIds, props.availableTypes);
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
                    <td className="p-3 text-xs text-slate-600" title={summary.title}>
                      {summary.label}
                    </td>
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
                          onClick={() => openEdit(p)}
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
              {visibleParts.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500 text-center" colSpan={8}>
                    {props.parts.length === 0
                      ? "Nema dijelova."
                      : "Nema dijelova koji odgovaraju pretrazi."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={draft.id ? "Uredi dio" : "Dodaj novi dio"}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline px-4"
              onClick={closeModal}
              disabled={busy}
            >
              Odustani
            </button>
            <button
              type="submit"
              form="platform-part-form"
              className="btn btn-primary px-4"
              disabled={busy}
            >
              {busy ? "Spremam…" : draft.id ? "Spremi" : "Dodaj dio"}
            </button>
          </>
        }
      >
        <form id="platform-part-form" onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="label">Šifra</label>
              <input
                className="input font-mono"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                placeholder="BRT-01"
                required
              />
            </div>
            <div className="sm:col-span-4">
              <label className="label">Naziv</label>
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Brtva ventila"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Jedinica</label>
              <select
                className="select"
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value as PartUnit }))}
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
                value={draft.defaultPrice}
                onChange={(e) => setDraft((d) => ({ ...d, defaultPrice: e.target.value }))}
                placeholder="npr. 26.60"
              />
            </div>
            <div className="sm:col-span-2 flex items-end pb-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.common}
                  onChange={(e) => setDraft((d) => ({ ...d, common: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">Uobičajen (brzi izbornik)</span>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Tipovi aparata</div>
                <div className="text-xs text-slate-500">
                  Odabrano {selectedCount}
                  {totalTypes > 0 ? ` / ${totalTypes}` : ""}
                  {selectedCount === totalTypes && totalTypes > 0 ? " · svi tipovi" : ""}
                  {" · opcionalno"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline h-7 px-3 text-xs"
                  onClick={selectAllTypes}
                  disabled={totalTypes === 0}
                >
                  Svi tipovi
                </button>
                <button
                  type="button"
                  className="btn btn-outline h-7 px-3 text-xs"
                  onClick={clearTypes}
                  disabled={selectedCount === 0}
                >
                  Nijedan
                </button>
              </div>
            </div>

            {totalTypes === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Ovaj proizvođač još nema tipova aparata. Prvo ih dodaj u tabu Aparati.
              </p>
            ) : (
              <>
                <input
                  type="search"
                  className="input mt-3 bg-white"
                  placeholder="Filtriraj tipove (npr. P6, prah)…"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                />

                <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                  {typeGroups.order.map((g) => {
                    const group = typeGroups.map.get(g.key)!;
                    const filteredTypes = typeQ
                      ? group.types.filter((t) =>
                          `${t.code} ${t.name} ${t.agent?.label ?? ""}`
                            .toLowerCase()
                            .includes(typeQ),
                        )
                      : group.types;
                    if (filteredTypes.length === 0) return null;

                    const groupSelected = filteredTypes.filter((t) =>
                      draft.typeIds.includes(t.id),
                    ).length;
                    const collapsed = !!collapsedGroups[g.key] && !typeQ;

                    return (
                      <div
                        key={g.key}
                        className="rounded-md border border-slate-200 bg-white"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            onClick={() => toggleGroupCollapse(g.key)}
                          >
                            <span className="text-slate-400 text-xs w-3">
                              {collapsed ? "▸" : "▾"}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                              {group.label}
                            </span>
                            <span className="text-xs text-slate-400">
                              {groupSelected}/{filteredTypes.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                            onClick={() => selectGroup(filteredTypes)}
                          >
                            Sve
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                            onClick={() => clearGroup(filteredTypes)}
                          >
                            Ništa
                          </button>
                        </div>
                        {!collapsed && (
                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5">
                            {filteredTypes.map((t) => {
                              const checked = draft.typeIds.includes(t.id);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleType(t.id)}
                                  title={t.name}
                                  className={[
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                                    checked
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                                  ].join(" ")}
                                >
                                  <span className="font-mono font-medium">{t.code}</span>
                                  {t.agent?.label ? (
                                    <span
                                      className={
                                        checked ? "text-slate-300" : "text-slate-400"
                                      }
                                    >
                                      {t.agent.label.toLowerCase()}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>
      </Modal>
    </div>
  );
}
