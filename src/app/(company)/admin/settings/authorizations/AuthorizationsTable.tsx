"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";
import {
  MIN_TABLE_TD,
  MIN_TABLE_TH,
  MinimalSearchInput,
  MinimalTableShell,
} from "@/components/admin/minimalSettingsTable";
import PerManufacturerCodesModal from "./PerManufacturerCodesModal";
import type { AuthorizationRow, LabelCodeStrategy } from "./AuthorizationsClient";

type RowStatus = "idle" | "saving" | "saved" | "error";
type RowState = AuthorizationRow & {
  status: RowStatus;
  error?: string;
};

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isExpired(iso: string): boolean {
  if (!iso) return false;
  return iso < today();
}

export default function AuthorizationsTable(props: {
  strategy: LabelCodeStrategy;
  rows: AuthorizationRow[];
  activeCount: number;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [states, setStates] = useState<Record<string, RowState>>(() => {
    const m: Record<string, RowState> = {};
    for (const r of props.rows) {
      m[r.manufacturerId] = { ...r, status: "idle" };
    }
    return m;
  });
  const [filter, setFilter] = useState("");
  const [modalManuId, setModalManuId] = useState<string | null>(null);

  function setRow(id: string, patch: Partial<RowState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(id: string, changes: Partial<RowState> = {}) {
    const current = states[id];
    if (!current) return;
    const next: RowState = { ...current, ...changes };

    setRow(id, { status: "saving", error: undefined, ...changes });

    try {
      const res = await fetch(`/api/admin/authorizations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: next.active,
          expiresAt: next.expiresAt || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error ?? "Greška pri spremanju.");
      }

      setRow(id, { status: "saved" });

      if (savedTimers.current[id]) clearTimeout(savedTimers.current[id]);
      savedTimers.current[id] = setTimeout(() => {
        setStates((prev) =>
          prev[id]?.status === "saved" ? { ...prev, [id]: { ...prev[id], status: "idle" } } : prev,
        );
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      // rollback: vrati original za ovaj red
      setStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...current, status: "error", error: msg },
      }));
      await dialog.alert({
        title: "Nije moguće spremiti ovlaštenje",
        message: msg,
        variant: "error",
      });
    }
  }

  const visible = useMemo(() => {
    const all = Object.values(states);
    if (filter.trim().length === 0) return all;
    return all.filter((r) =>
      r.manufacturerName.toLowerCase().includes(filter.trim().toLowerCase()),
    );
  }, [states, filter]);

  function StatusIndicator({ s }: { s: RowStatus }) {
    if (s === "saving") return <span className="text-xs text-slate-500">spremam…</span>;
    if (s === "saved") return <span className="text-xs font-medium text-emerald-700">spremljeno</span>;
    if (s === "error") return <span className="text-xs font-medium text-rose-700">greška</span>;
    return <span className="text-xs text-slate-400">&nbsp;</span>;
  }

  const isPerManu = props.strategy === "PER_MANUFACTURER";
  const modalRow = modalManuId ? states[modalManuId] : null;

  function rowHasCodes(r: RowState): boolean {
    return (
      r.periodicLabelCode.trim().length > 0 ||
      r.apparatusMassLabelCode.trim().length > 0 ||
      r.cylinderMassLabelCode.trim().length > 0
    );
  }

  function codesSummary(r: RowState): string {
    const parts: string[] = [];
    if (r.periodicLabelCode) parts.push(`PP ${r.periodicLabelCode}`);
    if (r.apparatusMassLabelCode) parts.push(`AP ${r.apparatusMassLabelCode}`);
    if (r.cylinderMassLabelCode) parts.push(`BO ${r.cylinderMassLabelCode}`);
    return parts.join(" · ");
  }

  return (
    <div className="space-y-3">
      <MinimalSearchInput
        value={filter}
        onChange={setFilter}
        placeholder="Pretraži proizvođača…"
        endSlot={
          <div className="subtle shrink-0">
            Proizvođači: {props.rows.length} · Aktivnih ovlaštenja: {props.activeCount}
          </div>
        }
      />

      <MinimalTableShell>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={MIN_TABLE_TH + " w-[260px]"}>Proizvođač</th>
              <th className={MIN_TABLE_TH + " w-[120px]"}>Aktivno</th>
              <th className={MIN_TABLE_TH + " w-[180px]"}>Vrijedi do</th>
              {isPerManu ? (
                <th className={MIN_TABLE_TH}>Šifre naljepnica</th>
              ) : null}
              <th className={MIN_TABLE_TH + " w-[110px]"}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => {
              const expired = r.active && isExpired(r.expiresAt);
              const hasCodes = rowHasCodes(r);
              return (
                <tr key={r.manufacturerId} className="hover:bg-slate-50/60">
                  <td className={MIN_TABLE_TD + " font-medium text-slate-900"}>{r.manufacturerName}</td>
                  <td className={MIN_TABLE_TD}>
                    <div className="inline-flex overflow-hidden rounded-md ring-1 ring-slate-200">
                      <button
                        type="button"
                        className={
                          "px-3 py-1.5 text-xs font-semibold transition-colors " +
                          (r.active
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-500 hover:bg-slate-50")
                        }
                        aria-pressed={r.active}
                        onClick={() => {
                          if (!r.active) save(r.manufacturerId, { active: true });
                        }}
                      >
                        DA
                      </button>
                      <button
                        type="button"
                        className={
                          "px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 " +
                          (!r.active
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-500 hover:bg-slate-50")
                        }
                        aria-pressed={!r.active}
                        onClick={() => {
                          if (r.active) save(r.manufacturerId, { active: false });
                        }}
                      >
                        NE
                      </button>
                    </div>
                  </td>
                  <td className={MIN_TABLE_TD}>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        className={
                          "input h-9 text-sm " + (expired ? "border-rose-400 text-rose-700" : "")
                        }
                        value={r.expiresAt}
                        onChange={(e) => setRow(r.manufacturerId, { expiresAt: e.target.value })}
                        onBlur={() => save(r.manufacturerId)}
                        disabled={!r.active}
                      />
                      {r.expiresAt ? (
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-700"
                          title="Ukloni datum"
                          onClick={() => save(r.manufacturerId, { expiresAt: "" })}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                    {expired ? (
                      <div className="mt-1 text-xs text-rose-700">Isteklo!</div>
                    ) : null}
                  </td>
                  {isPerManu ? (
                    <td className={MIN_TABLE_TD}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!r.active}
                          onClick={() => setModalManuId(r.manufacturerId)}
                          className={
                            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors " +
                            (hasCodes
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50") +
                            (!r.active ? " cursor-not-allowed opacity-50" : "")
                          }
                          title={
                            !r.active
                              ? "Prvo aktiviraj ovlaštenje da bi unio šifre."
                              : hasCodes
                                ? "Uredi šifre"
                                : "Unesi šifre"
                          }
                        >
                          {hasCodes ? "Uredi šifre" : "Unesi šifre"}
                        </button>
                        {hasCodes ? (
                          <span className="truncate font-mono text-xs text-slate-600">
                            {codesSummary(r)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">— bez šifri —</span>
                        )}
                      </div>
                    </td>
                  ) : null}
                  <td className={MIN_TABLE_TD}>
                    <StatusIndicator s={r.status} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={isPerManu ? 5 : 4}>
                  Nema proizvođača za prikaz.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MinimalTableShell>

      {modalRow ? (
        <PerManufacturerCodesModal
          manufacturerId={modalRow.manufacturerId}
          manufacturerName={modalRow.manufacturerName}
          initial={{
            periodicLabelCode: modalRow.periodicLabelCode,
            apparatusMassLabelCode: modalRow.apparatusMassLabelCode,
            cylinderMassLabelCode: modalRow.cylinderMassLabelCode,
          }}
          onClose={() => setModalManuId(null)}
          onSaved={(saved) => {
            setRow(modalRow.manufacturerId, {
              periodicLabelCode: saved.periodicLabelCode,
              apparatusMassLabelCode: saved.apparatusMassLabelCode,
              cylinderMassLabelCode: saved.cylinderMassLabelCode,
              status: "saved",
            });
            if (savedTimers.current[modalRow.manufacturerId])
              clearTimeout(savedTimers.current[modalRow.manufacturerId]);
            savedTimers.current[modalRow.manufacturerId] = setTimeout(() => {
              setStates((prev) =>
                prev[modalRow.manufacturerId]?.status === "saved"
                  ? {
                      ...prev,
                      [modalRow.manufacturerId]: {
                        ...prev[modalRow.manufacturerId],
                        status: "idle",
                      },
                    }
                  : prev,
              );
            }, 1500);
            setModalManuId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
