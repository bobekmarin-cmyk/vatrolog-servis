"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "START" | "STANDARD" | "PREMIUM";

type Props = {
  companyId: string;
  activeUntil: string | null;
  blocked: boolean;
  plan: Plan;
};

const PLAN_OPTIONS: { value: Plan; label: string; hint: string }[] = [
  { value: "START", label: "Start", hint: "Bez maila, portala i integracija" },
  { value: "STANDARD", label: "Standard", hint: "Sve osim integracija za fakturiranje" },
  { value: "PREMIUM", label: "Premium", hint: "Sve mogućnosti (e-računi, ...)" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toInputDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function PlatformSubscriptionManager({ companyId, activeUntil, blocked, plan }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(toInputDate(activeUntil));
  const [isBlocked, setIsBlocked] = useState(blocked);
  const [currentPlan, setCurrentPlan] = useState<Plan>(plan);
  const [saving, setSaving] = useState(false);

  const isExpired = activeUntil ? new Date(activeUntil) < new Date() : false;

  async function save(data: { activeUntil?: string | null; blocked?: boolean; plan?: Plan }) {
    setSaving(true);
    await fetch(`/api/platform/companies/${companyId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Plan pretplate</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {PLAN_OPTIONS.map((p) => {
            const active = currentPlan === p.value;
            return (
              <button
                key={p.value}
                type="button"
                disabled={saving}
                title={p.hint}
                onClick={() => {
                  setCurrentPlan(p.value);
                  save({ plan: p.value });
                }}
                className={[
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                ].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {PLAN_OPTIONS.find((p) => p.value === currentPlan)?.hint}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Pretplata aktivna do</label>
          <input
            type="date"
            className="input w-48"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary px-3 h-10"
          disabled={saving}
          onClick={() => save({ activeUntil: date || null })}
        >
          {saving ? "..." : "Spremi datum"}
        </button>
        {date && (
          <button
            className="btn btn-outline px-3 h-10"
            disabled={saving}
            onClick={() => { setDate(""); save({ activeUntil: null }); }}
          >
            Ukloni ograničenje
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Status:</span>
        {isBlocked ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            Blokiran
          </span>
        ) : isExpired ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
            Istekla pretplata ({formatDate(activeUntil!)})
          </span>
        ) : activeUntil ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Aktivna do {formatDate(activeUntil)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Neograničena
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className={`btn px-4 ${isBlocked ? "btn-primary" : "btn-outline text-red-600 border-red-300 hover:bg-red-50"}`}
          disabled={saving}
          onClick={() => {
            const next = !isBlocked;
            setIsBlocked(next);
            save({ blocked: next });
          }}
        >
          {isBlocked ? "Deblokiraj" : "Blokiraj pristup"}
        </button>
        {isBlocked && (
          <span className="text-xs text-slate-500">Korisnici se ne mogu prijaviti dok je tvrtka blokirana.</span>
        )}
      </div>
    </div>
  );
}
