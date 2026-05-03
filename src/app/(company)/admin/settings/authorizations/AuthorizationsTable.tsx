"use client";

import { useRef, useState } from "react";
import { useDialog } from "@/components/ui/useDialog";

export type AuthorizationRow = {
  manufacturerId: string;
  manufacturerName: string;
  active: boolean;
  expiresAt: string; // YYYY-MM-DD or ""
  periodicLabelCode: string;
  apparatusMassLabelCode: string;
  cylinderMassLabelCode: string;
};

type LabelField =
  | "periodicLabelCode"
  | "apparatusMassLabelCode"
  | "cylinderMassLabelCode";

type RowStatus = "idle" | "saving" | "saved" | "error";
type RowState = AuthorizationRow & {
  status: RowStatus;
  error?: string;
  locks: Record<LabelField, boolean>;
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

const LABEL_FIELDS: LabelField[] = [
  "periodicLabelCode",
  "apparatusMassLabelCode",
  "cylinderMassLabelCode",
];

export default function AuthorizationsTable({ rows }: { rows: AuthorizationRow[] }) {
  const dialog = useDialog();
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [states, setStates] = useState<Record<string, RowState>>(() => {
    const m: Record<string, RowState> = {};
    for (const r of rows) {
      m[r.manufacturerId] = {
        ...r,
        status: "idle",
        locks: {
          periodicLabelCode: (r.periodicLabelCode ?? "").length > 0,
          apparatusMassLabelCode: (r.apparatusMassLabelCode ?? "").length > 0,
          cylinderMassLabelCode: (r.cylinderMassLabelCode ?? "").length > 0,
        },
      };
    }
    return m;
  });
  const [originalCodes, setOriginalCodes] = useState<
    Record<string, Record<LabelField, string>>
  >(() => {
    const m: Record<string, Record<LabelField, string>> = {};
    for (const r of rows) {
      m[r.manufacturerId] = {
        periodicLabelCode: r.periodicLabelCode ?? "",
        apparatusMassLabelCode: r.apparatusMassLabelCode ?? "",
        cylinderMassLabelCode: r.cylinderMassLabelCode ?? "",
      };
    }
    return m;
  });
  const [filter, setFilter] = useState("");

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
          periodicLabelCode: next.periodicLabelCode.trim() || null,
          apparatusMassLabelCode: next.apparatusMassLabelCode.trim() || null,
          cylinderMassLabelCode: next.cylinderMassLabelCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data?.error ?? "Greška pri spremanju.");
      }

      setOriginalCodes((prev) => ({
        ...prev,
        [id]: {
          periodicLabelCode: next.periodicLabelCode.trim(),
          apparatusMassLabelCode: next.apparatusMassLabelCode.trim(),
          cylinderMassLabelCode: next.cylinderMassLabelCode.trim(),
        },
      }));

      setStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          ...changes,
          periodicLabelCode: next.periodicLabelCode.trim(),
          apparatusMassLabelCode: next.apparatusMassLabelCode.trim(),
          cylinderMassLabelCode: next.cylinderMassLabelCode.trim(),
          status: "saved",
          locks: {
            periodicLabelCode: next.periodicLabelCode.trim().length > 0,
            apparatusMassLabelCode: next.apparatusMassLabelCode.trim().length > 0,
            cylinderMassLabelCode: next.cylinderMassLabelCode.trim().length > 0,
          },
        },
      }));

      if (savedTimers.current[id]) clearTimeout(savedTimers.current[id]);
      savedTimers.current[id] = setTimeout(() => {
        setStates((prev) =>
          prev[id]?.status === "saved" ? { ...prev, [id]: { ...prev[id], status: "idle" } } : prev,
        );
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      setRow(id, { status: "error", error: msg });
      await dialog.alert({
        title: "Nije moguće spremiti ovlaštenje",
        message: msg,
        variant: "error",
      });
    }
  }

  async function unlockCode(id: string, field: LabelField) {
    const ok = await dialog.confirm({
      title: "Otključati šifru?",
      message:
        "Jeste li sigurni da želite promijeniti postojeću šifru? Promjena se odmah sprema nakon unosa nove vrijednosti.",
      confirmLabel: "Otključaj",
      cancelLabel: "Odustani",
    });
    if (!ok) return;
    setStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        locks: { ...prev[id].locks, [field]: false },
        status: "idle",
      },
    }));
    const key = `${id}|${field}`;
    setTimeout(() => {
      inputRefs.current[key]?.focus();
      inputRefs.current[key]?.select();
    }, 0);
  }

  function StatusIndicator({ s }: { s: RowStatus }) {
    if (s === "saving") return <span className="text-xs text-slate-500">spremam…</span>;
    if (s === "saved") return <span className="text-xs font-medium text-emerald-700">spremljeno</span>;
    if (s === "error") return <span className="text-xs font-medium text-rose-700">greška</span>;
    return <span className="text-xs text-slate-400">&nbsp;</span>;
  }

  const visible = filter.trim().length === 0
    ? Object.values(states)
    : Object.values(states).filter((r) =>
        r.manufacturerName.toLowerCase().includes(filter.trim().toLowerCase()),
      );

  const activeCount = Object.values(states).filter((s) => s.active).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="input max-w-sm"
          placeholder="Pretraga proizvođača..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="subtle">
          Proizvođači: {rows.length} · Aktivnih ovlaštenja: {activeCount}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900">Cijene naljepnica</div>
          <div className="text-xs text-slate-500">
            Jedinstvene cijene po vrsti naljepnice — primjenjuju se neovisno o proizvođaču.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Cijena PP naljepnice</span>
            <input
              type="text"
              className="input h-9 cursor-not-allowed bg-slate-50 text-sm text-slate-400"
              placeholder="Uskoro"
              disabled
              title="Polje cijene bit će aktivirano u budućnosti."
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Cijena naljepnice mase aparata</span>
            <input
              type="text"
              className="input h-9 cursor-not-allowed bg-slate-50 text-sm text-slate-400"
              placeholder="Uskoro"
              disabled
              title="Polje cijene bit će aktivirano u budućnosti."
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Cijena naljepnice mase bočice</span>
            <input
              type="text"
              className="input h-9 cursor-not-allowed bg-slate-50 text-sm text-slate-400"
              placeholder="Uskoro"
              disabled
              title="Polje cijene bit će aktivirano u budućnosti."
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="table">
          <thead className="table-head">
            <tr>
              <th className="table-cell w-[200px]">Proizvođač</th>
              <th className="table-cell w-[110px]">Aktivno</th>
              <th className="table-cell w-[170px]">Vrijedi do</th>
              <th className="table-cell w-[180px]">Šifra PP naljepnice</th>
              <th className="table-cell w-[200px]">Šifra mase aparata</th>
              <th className="table-cell w-[200px]">Šifra mase bočice</th>
              <th className="table-cell w-[100px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((r) => {
              const expired = r.active && isExpired(r.expiresAt);
              return (
                <tr key={r.manufacturerId} className="hover:bg-slate-50">
                  <td className="table-cell font-medium text-slate-900">{r.manufacturerName}</td>
                  <td className="table-cell">
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
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        className={"input h-9 text-sm " + (expired ? "border-rose-400 text-rose-700" : "")}
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
                  {LABEL_FIELDS.map((field) => {
                    const locked = r.locks[field];
                    const key = `${r.manufacturerId}|${field}`;
                    return (
                      <td className="table-cell" key={key}>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              ref={(el) => {
                                inputRefs.current[key] = el;
                              }}
                              className={
                                "input h-9 font-mono text-sm " +
                                (locked || !r.active
                                  ? "cursor-not-allowed bg-slate-100 text-slate-500"
                                  : "")
                              }
                              placeholder="—"
                              value={r[field]}
                              disabled={locked || !r.active}
                              onChange={(e) =>
                                setRow(r.manufacturerId, { [field]: e.target.value } as Partial<RowState>)
                              }
                              onBlur={() => {
                                if (!locked && r.active) save(r.manufacturerId);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  (e.currentTarget as HTMLInputElement).blur();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  const orig = originalCodes[r.manufacturerId]?.[field] ?? "";
                                  setStates((prev) => ({
                                    ...prev,
                                    [r.manufacturerId]: {
                                      ...prev[r.manufacturerId],
                                      [field]: orig,
                                      status: "idle",
                                      error: undefined,
                                      locks: {
                                        ...prev[r.manufacturerId].locks,
                                        [field]: orig.length > 0,
                                      },
                                    },
                                  }));
                                  (e.currentTarget as HTMLInputElement).blur();
                                }
                              }}
                              maxLength={50}
                            />
                            {locked && r.active ? (
                              <button
                                type="button"
                                aria-label="Otključaj šifru"
                                title="Otključaj šifru"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                onClick={() => unlockCode(r.manufacturerId, field)}
                              >
                                <LockIcon />
                              </button>
                            ) : (
                              <span
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-slate-300"
                                title={r.active ? "Otključano" : "Neaktivno"}
                                aria-hidden
                              >
                                <UnlockIcon />
                              </span>
                            )}
                          </div>
                      </td>
                    );
                  })}
                  <td className="table-cell">
                    <StatusIndicator s={r.status} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td className="table-cell text-center text-slate-500" colSpan={7}>
                  Nema proizvođača za prikaz.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Savjet: jednom spremljena šifra naljepnice se zaključa. Za promjenu kliknite ikonu lokota i
        potvrdite u skočnom prozoru.
      </p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}
