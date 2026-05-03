"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

type Agent = {
  id: string;
  code: string;
  label: string;
  symbol: string | null;
};

type Construction = {
  id: string;
  code: string;
  label: string;
  prefix: string | null;
  sortOrder?: number;
};

type RuleMode = "FIXED" | "AGE_BASED";

type ExType = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  capacityUnit: "KG" | "L" | null;
  agent: { id: string; code: string; label: string; symbol: string | null } | null;
  construction:
    | { id: string; code: string; label: string; prefix: string | null; sortOrder?: number }
    | null;
  internalRuleMode: RuleMode;
  internalIntervalYears: number;
  internalOldThresholdYears: number | null;
  internalOldIntervalYears: number | null;
  internalYoungIntervalYears: number | null;
};

type Row = {
  manufacturerId: string;
  extinguisherType: ExType;
};

type DraftState = {
  code: string;
  agentId: string;
  constructionId: string;
  capacity: string;
  capacityUnit: "KG" | "L";
  ruleMode: RuleMode;
  intervalYears: string;
  oldThreshold: string;
  oldInterval: string;
  youngInterval: string;
};

function ruleSummary(t: ExType): string {
  if (t.internalRuleMode === "FIXED") {
    return `Fiksno ${t.internalIntervalYears} god`;
  }
  return `Ovisno o starosti (${t.internalYoungIntervalYears ?? "—"}/${t.internalOldIntervalYears ?? "—"} g, prag ${t.internalOldThresholdYears ?? "—"})`;
}

function emptyDraft(agents: Agent[], constructions: Construction[]): DraftState {
  return {
    code: "",
    agentId: agents[0]?.id ?? "",
    constructionId: constructions[0]?.id ?? "",
    capacity: "",
    capacityUnit: "KG",
    ruleMode: "FIXED",
    intervalYears: "4",
    oldThreshold: "",
    oldInterval: "",
    youngInterval: "",
  };
}

function draftFromType(t: ExType, agents: Agent[], constructions: Construction[]): DraftState {
  return {
    code: t.code,
    agentId: t.agent?.id ?? agents[0]?.id ?? "",
    constructionId: t.construction?.id ?? constructions[0]?.id ?? "",
    capacity: t.capacity?.toString() ?? "",
    capacityUnit: t.capacityUnit ?? "KG",
    ruleMode: t.internalRuleMode,
    intervalYears: t.internalIntervalYears?.toString() ?? "",
    oldThreshold: t.internalOldThresholdYears?.toString() ?? "",
    oldInterval: t.internalOldIntervalYears?.toString() ?? "",
    youngInterval: t.internalYoungIntervalYears?.toString() ?? "",
  };
}

function buildPayload(draft: DraftState, editingId: string | null) {
  return {
    id: editingId ?? undefined,
    code: draft.code,
    agentId: draft.agentId,
    constructionId: draft.constructionId,
    capacity: draft.capacity ? Number(draft.capacity) : null,
    capacityUnit: draft.capacity ? draft.capacityUnit : null,
    internalRuleMode: draft.ruleMode,
    internalIntervalYears: draft.intervalYears ? Number(draft.intervalYears) : null,
    internalOldThresholdYears:
      draft.ruleMode === "AGE_BASED" && draft.oldThreshold ? Number(draft.oldThreshold) : null,
    internalOldIntervalYears:
      draft.ruleMode === "AGE_BASED" && draft.oldInterval ? Number(draft.oldInterval) : null,
    internalYoungIntervalYears:
      draft.ruleMode === "AGE_BASED" && draft.youngInterval ? Number(draft.youngInterval) : null,
  };
}

export default function ManufacturerTypesTab(props: {
  manufacturerId: string;
  agents: Agent[];
  constructions: Construction[];
  rows: Row[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(() =>
    emptyDraft(props.agents, props.constructions),
  );

  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftState>(() =>
    emptyDraft(props.agents, props.constructions),
  );

  const grouped = useMemo(() => {
    const byConstruction = new Map<
      string,
      { construction: Construction | null; rows: ExType[] }
    >();
    for (const row of props.rows) {
      const t = row.extinguisherType;
      const cId = t.construction?.id ?? "__none__";
      const bucket = byConstruction.get(cId);
      if (bucket) {
        bucket.rows.push(t);
      } else {
        byConstruction.set(cId, {
          construction: t.construction
            ? {
                id: t.construction.id,
                code: t.construction.code,
                label: t.construction.label,
                prefix: t.construction.prefix,
                sortOrder: t.construction.sortOrder,
              }
            : null,
          rows: [t],
        });
      }
    }
    const groups = Array.from(byConstruction.values());
    groups.sort((a, b) => {
      const sa = a.construction?.sortOrder ?? (a.construction ? 998 : 999);
      const sb = b.construction?.sortOrder ?? (b.construction ? 998 : 999);
      if (sa !== sb) return sa - sb;
      return (a.construction?.label ?? "Bez izvedbe").localeCompare(
        b.construction?.label ?? "Bez izvedbe",
      );
    });
    for (const g of groups) {
      g.rows.sort((a, b) => {
        const ca = a.capacity ?? 0;
        const cb = b.capacity ?? 0;
        if (ca !== cb) return ca - cb;
        return a.code.localeCompare(b.code);
      });
    }
    return groups;
  }, [props.rows]);

  function startEdit(t: ExType) {
    setEditingTypeId(t.id);
    setEditDraft(draftFromType(t, props.agents, props.constructions));
    setError(null);
  }

  function cancelEdit() {
    setEditingTypeId(null);
    setEditDraft(emptyDraft(props.agents, props.constructions));
    setError(null);
  }

  function startAdd() {
    setAddingNew(true);
    setNewDraft(emptyDraft(props.agents, props.constructions));
    setError(null);
  }

  function cancelAdd() {
    setAddingNew(false);
    setNewDraft(emptyDraft(props.agents, props.constructions));
    setError(null);
  }

  async function save(draft: DraftState, editingId: string | null) {
    setBusy(true);
    setError(null);
    const payload = buildPayload(draft, editingId);
    const res = await fetch(
      `/api/platform/manufacturers/${props.manufacturerId}/types/upsert`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška.");
      return false;
    }
    return true;
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTypeId) return;
    const ok = await save(editDraft, editingTypeId);
    if (ok) {
      cancelEdit();
      router.refresh();
    }
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const ok = await save(newDraft, null);
    if (ok) {
      cancelAdd();
      router.refresh();
    }
  }

  async function removeType(extinguisherTypeId: string) {
    const ok = await dialog.confirm({
      title: "Ukloniti tip s popisa?",
      message:
        "Tip će biti uklonjen iz kataloga ovog proizvođača. Ako je ovo posljednji proizvođač " +
        "tog tipa, tip se briše iz baze i sve aparate koji ga koriste također (cascade).",
      danger: true,
      confirmLabel: "Ukloni",
    });
    if (!ok) return;
    setBusy(true);
    const form = new FormData();
    form.set("extinguisherTypeId", extinguisherTypeId);
    const res = await fetch(
      `/api/platform/manufacturers/${props.manufacturerId}/types/remove`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: form,
      },
    );
    setBusy(false);
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { warning?: string | null; cascadedExtinguishers?: number }
        | null;
      if (data?.warning) {
        await dialog.alert({
          title: "Tip uklonjen uz cascade",
          message: data.warning,
        });
      }
    }
    router.refresh();
  }

  const totalCount = props.rows.length;

  return (
    <div className="space-y-4">
      <section className="surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Tipovi aparata</h3>
            <p className="mt-1 text-xs text-slate-500">
              Ukupno {totalCount} {totalCount === 1 ? "tip" : "tipova"} · grupirano po izvedbi.
              Pravilo unutarnjeg pregleda (UP) je obavezno za svaki tip.
            </p>
          </div>
          {!addingNew && (
            <button
              type="button"
              className="btn btn-primary h-8 px-3 text-xs"
              onClick={startAdd}
              disabled={busy || editingTypeId !== null}
              title={editingTypeId ? "Završi uređivanje retka prije dodavanja novog tipa" : ""}
            >
              + Dodaj novi tip
            </button>
          )}
        </div>

        {addingNew && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Novi tip aparata</h4>
            <DraftForm
              draft={newDraft}
              setDraft={setNewDraft}
              agents={props.agents}
              constructions={props.constructions}
              onSubmit={submitNew}
              busy={busy}
              error={error}
              submitLabel="Dodaj tip"
              onCancel={cancelAdd}
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        {grouped.length === 0 && (
          <div className="surface p-6 text-center text-sm text-slate-500">
            Nema tipova. Klikni „+ Dodaj novi tip“ gore.
          </div>
        )}
        {grouped.map((group) => {
          const groupKey = group.construction?.id ?? "none";
          const groupLabel = group.construction?.label ?? "Bez izvedbe";
          return (
            <div key={groupKey} className="surface">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h4 className="text-sm font-semibold text-slate-800">
                  {groupLabel}{" "}
                  <span className="font-normal text-slate-500">({group.rows.length})</span>
                </h4>
                {group.construction
                  && (!group.construction.prefix
                    || group.construction.prefix.trim().length === 0) && (
                    <span className="text-xs text-amber-700">⚠ izvedba bez prefiksa</span>
                  )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white text-left">
                    <tr className="border-b border-slate-200">
                      <th className="p-3">Code</th>
                      <th className="p-3">Sredstvo</th>
                      <th className="p-3">Količina</th>
                      <th className="p-3">Pravilo UP</th>
                      <th className="p-3 text-right">Akcije</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((t) => {
                      const isEditing = editingTypeId === t.id;
                      const editDisabled = !isEditing && (busy || editingTypeId !== null || addingNew);
                      if (isEditing) {
                        return (
                          <tr key={t.id} className="bg-amber-50/40">
                            <td colSpan={5} className="p-3">
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
                                  Uredi tip: {t.code}
                                </h5>
                                <DraftForm
                                  draft={editDraft}
                                  setDraft={setEditDraft}
                                  agents={props.agents}
                                  constructions={props.constructions}
                                  onSubmit={submitEdit}
                                  busy={busy}
                                  error={error}
                                  submitLabel="Spremi"
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs">{t.code}</td>
                          <td className="p-3">{t.agent?.label ?? "—"}</td>
                          <td className="p-3">
                            {t.capacity != null
                              ? `${t.capacity} ${t.capacityUnit === "L" ? "L" : "kg"}`
                              : "—"}
                          </td>
                          <td className="p-3 text-xs text-slate-600">{ruleSummary(t)}</td>
                          <td className="p-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                className="btn btn-outline h-8 px-3 text-xs"
                                onClick={() => startEdit(t)}
                                disabled={editDisabled}
                                title={
                                  editingTypeId
                                    ? "Završi trenutno uređivanje prvo"
                                    : addingNew
                                      ? "Završi dodavanje novog tipa prvo"
                                      : ""
                                }
                              >
                                Uredi
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline h-8 px-3 text-xs"
                                onClick={() => removeType(t.id)}
                                disabled={editDisabled}
                              >
                                Ukloni
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function DraftForm(props: {
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  agents: Agent[];
  constructions: Construction[];
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onCancel: () => void;
}) {
  const { draft, setDraft } = props;
  const set = (patch: Partial<DraftState>) => setDraft({ ...draft, ...patch });

  return (
    <form onSubmit={props.onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
      <div className="sm:col-span-3">
        <label className="label">Code</label>
        <input
          className="input font-mono"
          value={draft.code}
          onChange={(e) => set({ code: e.target.value.toUpperCase() })}
          placeholder="P6, S9, CO2-5"
          required
        />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Sredstvo gašenja</label>
        <select
          className="select"
          value={draft.agentId}
          onChange={(e) => set({ agentId: e.target.value })}
          required
        >
          {props.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {a.symbol ? ` (${a.symbol})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <label className="label">Izvedba</label>
        <select
          className="select"
          value={draft.constructionId}
          onChange={(e) => set({ constructionId: e.target.value })}
          required
        >
          {props.constructions.map((c) => {
            const noPrefix = !c.prefix || c.prefix.trim().length === 0;
            return (
              <option key={c.id} value={c.id}>
                {c.label}
                {noPrefix ? "  ⚠ bez prefiksa" : ""}
              </option>
            );
          })}
        </select>
        {(() => {
          const selected = props.constructions.find((c) => c.id === draft.constructionId);
          const noPrefix =
            !!selected && (!selected.prefix || selected.prefix.trim().length === 0);
          if (!noPrefix) return null;
          return (
            <p className="mt-1 text-xs text-amber-700">
              Odabrana izvedba nema prefiks. Spremanje će biti odbijeno (osim za CO2). Postavi prefiks u
              postavkama izvedbi.
            </p>
          );
        })()}
      </div>
      <div className="sm:col-span-2">
        <label className="label">Količina</label>
        <input
          type="number"
          className="input"
          value={draft.capacity}
          onChange={(e) => set({ capacity: e.target.value })}
          placeholder="6"
          min={0}
        />
      </div>
      <div className="sm:col-span-1">
        <label className="label">Jed.</label>
        <select
          className="select"
          value={draft.capacityUnit}
          onChange={(e) => set({ capacityUnit: e.target.value as "KG" | "L" })}
        >
          <option value="KG">kg</option>
          <option value="L">L</option>
        </select>
      </div>

      <div className="sm:col-span-12 mt-1 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">
            Pravila unutarnjeg pregleda (UP)
          </h4>
          <span className="text-xs text-slate-500">UP je obavezan za svaki tip aparata.</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label className="label">Način izračuna</label>
            <select
              className="select"
              value={draft.ruleMode}
              onChange={(e) => set({ ruleMode: e.target.value as RuleMode })}
            >
              <option value="FIXED">Fiksni interval (npr. Total = 4)</option>
              <option value="AGE_BASED">Ovisno o starosti (npr. Pastor)</option>
            </select>
          </div>
          {draft.ruleMode === "FIXED" && (
            <div className="sm:col-span-3">
              <label className="label">Interval (god)</label>
              <input
                type="number"
                className="input"
                value={draft.intervalYears}
                onChange={(e) => set({ intervalYears: e.target.value })}
                placeholder="npr. 4"
                min={1}
                required
              />
            </div>
          )}
          {draft.ruleMode === "AGE_BASED" && (
            <>
              <div className="sm:col-span-3">
                <label className="label">Granica starosti (god)</label>
                <input
                  type="number"
                  className="input"
                  value={draft.oldThreshold}
                  onChange={(e) => set({ oldThreshold: e.target.value })}
                  placeholder="npr. 14"
                  min={1}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Mladi (god)</label>
                <input
                  type="number"
                  className="input"
                  value={draft.youngInterval}
                  onChange={(e) => set({ youngInterval: e.target.value })}
                  placeholder="npr. 5"
                  min={1}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Stari (god)</label>
                <input
                  type="number"
                  className="input"
                  value={draft.oldInterval}
                  onChange={(e) => set({ oldInterval: e.target.value })}
                  placeholder="npr. 2"
                  min={1}
                  required
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="sm:col-span-12 flex gap-2">
        <button className="btn btn-primary px-4" type="submit" disabled={props.busy}>
          {props.submitLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline px-4"
          onClick={props.onCancel}
          disabled={props.busy}
        >
          Odustani
        </button>
      </div>
      {props.error && (
        <div className="sm:col-span-12 text-sm text-red-600">{props.error}</div>
      )}
    </form>
  );
}
