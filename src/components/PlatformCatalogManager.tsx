"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AgentRow = {
  id: string;
  code: string;
  label: string;
  symbol: string | null;
  active: boolean;
  sortOrder: number;
};

type ConstructionRow = {
  id: string;
  code: string;
  label: string;
  prefix: string | null;
  active: boolean;
  sortOrder: number;
};

type Mode = "agents" | "constructions";

export default function PlatformCatalogManager(props: {
  mode: Mode;
  agents?: AgentRow[];
  constructions?: ConstructionRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [extra, setExtra] = useState(""); // symbol for agent, prefix for construction
  const [sortOrder, setSortOrder] = useState<number>(0);

  function resetForm() {
    setEditing(null);
    setCode("");
    setLabel("");
    setExtra("");
    setSortOrder(0);
    setError(null);
  }

  function startEdit(row: AgentRow | ConstructionRow) {
    setEditing(row.id);
    setCode(row.code);
    setLabel(row.label);
    setExtra("symbol" in row ? row.symbol ?? "" : row.prefix ?? "");
    setSortOrder(row.sortOrder);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const url =
      props.mode === "agents"
        ? "/api/platform/catalog/agents/upsert"
        : "/api/platform/catalog/constructions/upsert";

    const payload =
      props.mode === "agents"
        ? { id: editing ?? undefined, code, label, symbol: extra || null, sortOrder }
        : { id: editing ?? undefined, code, label, prefix: extra || null, sortOrder };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
    const url =
      props.mode === "agents"
        ? "/api/platform/catalog/agents/toggle"
        : "/api/platform/catalog/constructions/toggle";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: next }),
    });
    setBusy(false);
    router.refresh();
  }

  const rows: Array<AgentRow | ConstructionRow> =
    props.mode === "agents" ? props.agents ?? [] : props.constructions ?? [];

  const columnExtraLabel = props.mode === "agents" ? "Simbol" : "Prefiks";
  const extraPlaceholder =
    props.mode === "agents" ? "npr. ABC, F, CO2" : "npr. P, S, CO2";

  return (
    <div className="space-y-6">
      <section className="surface p-4">
        <h3 className="text-base font-semibold mb-3">
          {editing ? "Uredi zapis" : props.mode === "agents" ? "Dodaj sredstvo gašenja" : "Dodaj izvedbu"}
        </h3>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <label className="label">Code</label>
            <input
              className="input font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={props.mode === "agents" ? "PRAH, CO2, F500" : "STORED_PRESSURE, CARTRIDGE"}
              required
            />
          </div>
          <div className="sm:col-span-4">
            <label className="label">Label</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={props.mode === "agents" ? "Prah" : "Stalni tlak"}
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="label">{columnExtraLabel}</label>
            <input
              className="input"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={extraPlaceholder}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Redoslijed</label>
            <input
              type="number"
              className="input"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-12 flex gap-2">
            <button className="btn btn-primary px-4" type="submit" disabled={busy}>
              {editing ? "Spremi promjene" : "Dodaj"}
            </button>
            {editing && (
              <button type="button" className="btn btn-outline px-4" onClick={resetForm} disabled={busy}>
                Odustani
              </button>
            )}
          </div>
          {error && <div className="sm:col-span-12 text-sm text-red-600">{error}</div>}
        </form>
      </section>

      <section className="surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Label</th>
                <th className="p-3">{columnExtraLabel}</th>
                <th className="p-3">Red.</th>
                <th className="p-3">Status</th>
                <th className="p-3">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const extraVal = "symbol" in r ? r.symbol : r.prefix;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{r.code}</td>
                    <td className="p-3">{r.label}</td>
                    <td className="p-3 text-slate-600">{extraVal ?? "—"}</td>
                    <td className="p-3">{r.sortOrder}</td>
                    <td className="p-3">
                      {r.active ? (
                        <span className="badge badge-success">Aktivno</span>
                      ) : (
                        <span className="badge badge-neutral">Neaktivno</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => startEdit(r)}
                          disabled={busy}
                        >
                          Uredi
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline h-8 px-3 text-xs"
                          onClick={() => toggleActive(r.id, !r.active)}
                          disabled={busy}
                        >
                          {r.active ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-500 text-center" colSpan={6}>
                    Nema zapisa.
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
