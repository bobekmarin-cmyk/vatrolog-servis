"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";
import SharedCodesPanel from "./SharedCodesPanel";
import AuthorizationsTable from "./AuthorizationsTable";

export type LabelCodeStrategy = "SHARED" | "PER_MANUFACTURER";

export type AuthorizationRow = {
  manufacturerId: string;
  manufacturerName: string;
  active: boolean;
  expiresAt: string; // YYYY-MM-DD or ""
  periodicLabelCode: string;
  apparatusMassLabelCode: string;
  cylinderMassLabelCode: string;
};

export type SharedCodes = {
  periodicLabelCode: string;
  apparatusMassLabelCode: string;
  cylinderMassLabelCode: string;
};

export default function AuthorizationsClient(props: {
  initialStrategy: LabelCodeStrategy;
  initialSharedCodes: SharedCodes;
  rows: AuthorizationRow[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [strategy, setStrategy] = useState<LabelCodeStrategy>(props.initialStrategy);
  const [switching, setSwitching] = useState(false);

  const activeCount = useMemo(() => props.rows.filter((r) => r.active).length, [props.rows]);

  async function changeStrategy(next: LabelCodeStrategy) {
    if (next === strategy) return;

    const friendlyTo =
      next === "SHARED" ? "Zajedničke šifre za sve" : "Različite šifre po proizvođaču";

    // U slučaju prelaska iz PER_MANUFACTURER u SHARED najprije pošalji bez confirmClear-a;
    // ako server vrati 409, ponovi s confirmClear=true.
    setSwitching(true);
    try {
      const tryOnce = async (confirmClear: boolean) => {
        const res = await fetch("/api/admin/authorizations/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy: next, confirmClear }),
        });
        return res;
      };

      let res = await tryOnce(false);
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          existingCount?: number;
        };
        const ok = await dialog.confirm({
          title: "Brisanje postojećih šifri",
          message:
            data.error ??
            "Postoje šifre po proizvođaču. Prebacivanjem u zajednički način šifriranja sve će biti obrisane.",
          confirmLabel: "Obriši i nastavi",
          cancelLabel: "Odustani",
          danger: true,
        });
        if (!ok) {
          setSwitching(false);
          return;
        }
        res = await tryOnce(true);
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Promjena načina šifriranja nije uspjela.");
      }

      setStrategy(next);
      await dialog.alert({
        title: "Način šifriranja promijenjen",
        message: `Aktivan način: ${friendlyTo}.`,
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      await dialog.alert({
        title: "Greška",
        message: msg,
        variant: "error",
      });
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Način šifriranja naljepnica</div>
        <div className="mt-1 text-xs text-slate-500">
          Odaberi kako se vode interne šifre naljepnica u tvojem servisu. Promjena u bilo kojem
          trenutku.
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <StrategyOption
            value="SHARED"
            current={strategy}
            disabled={switching}
            title="Zajedničke šifre za sve"
            description="Jedan set od tri šifre koji vrijedi za sve proizvođače. Na otpremnici se naljepnice grupiraju (zbroj količina, bez naziva proizvođača)."
            onChange={(v) => changeStrategy(v)}
          />
          <StrategyOption
            value="PER_MANUFACTURER"
            current={strategy}
            disabled={switching}
            title="Različite šifre po proizvođaču"
            description="Svaki proizvođač ima vlastiti set od tri šifre (sve moraju biti različite). Na otpremnici se naljepnice prikazuju zasebno po proizvođaču."
            onChange={(v) => changeStrategy(v)}
          />
        </div>
      </div>

      {strategy === "SHARED" ? (
        <SharedCodesPanel initial={props.initialSharedCodes} totalManufacturers={props.rows.length} />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Cijene naljepnica</div>
        <div className="text-xs text-slate-500">
          Jedinstvene cijene po vrsti naljepnice — primjenjuju se neovisno o proizvođaču.
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <PriceField label="Cijena PP naljepnice" />
          <PriceField label="Cijena naljepnice mase aparata" />
          <PriceField label="Cijena naljepnice mase bočice" />
        </div>
      </div>

      <AuthorizationsTable
        strategy={strategy}
        rows={props.rows}
        activeCount={activeCount}
      />
    </div>
  );
}

function StrategyOption(props: {
  value: LabelCodeStrategy;
  current: LabelCodeStrategy;
  disabled: boolean;
  title: string;
  description: string;
  onChange: (v: LabelCodeStrategy) => void;
}) {
  const selected = props.value === props.current;
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onChange(props.value)}
      className={
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors " +
        (selected
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
          : "border-slate-200 bg-white hover:bg-slate-50") +
        (props.disabled ? " opacity-60" : "")
      }
      aria-pressed={selected}
    >
      <div className="flex items-center gap-2">
        <span
          className={
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 " +
            (selected ? "ring-emerald-600" : "ring-slate-300")
          }
        >
          {selected ? <span className="block h-2 w-2 rounded-full bg-emerald-600" /> : null}
        </span>
        <span className="text-sm font-semibold text-slate-900">{props.title}</span>
      </div>
      <div className="pl-6 text-xs text-slate-500">{props.description}</div>
    </button>
  );
}

function PriceField({ label }: { label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="text"
        className="input h-9 cursor-not-allowed bg-slate-50 text-sm text-slate-400"
        placeholder="Uskoro"
        disabled
        title="Polje cijene bit će aktivirano u budućnosti."
      />
    </label>
  );
}
