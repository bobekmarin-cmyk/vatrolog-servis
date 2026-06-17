"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  extinguisherId: string;
  companyId: string;
  internalCode: string;
  serialNumber: string;
  typeCode: string | null;
  manufacturerName: string;
  servicerName: string;
};

type CheckKey = "accessibilityOk" | "markingsOk" | "complete" | "noDamage" | "sealOk";

const CHECK_ITEMS: { key: CheckKey; label: string; hint: string }[] = [
  { key: "accessibilityOk", label: "Položaj i dostupnost", hint: "Aparat je na svom mjestu, uočljiv i lako dostupan." },
  { key: "markingsOk", label: "Oznake", hint: "Naljepnice i oznake su čitljive i ispravne." },
  { key: "complete", label: "Kompletnost", hint: "Aparat je u potpunosti kompletan (crijevo, mlaznica…)." },
  { key: "noDamage", label: "Bez oštećenja", hint: "Nema vidljivih oštećenja na aparatu." },
  { key: "sealOk", label: "Plomba zatvarača / ventila", hint: "Plomba je netaknuta i ispravna." },
];

function todayInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={[
          "h-9 rounded-md px-3 text-sm font-medium transition",
          value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        ].join(" ")}
      >
        U redu
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          "h-9 rounded-md px-3 text-sm font-medium transition",
          !value ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
        ].join(" ")}
      >
        Nije u redu
      </button>
    </div>
  );
}

export default function RegularInspectionForm(props: Props) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    accessibilityOk: true,
    markingsOk: true,
    complete: true,
    noDamage: true,
    sealOk: true,
  });
  const [gauge, setGauge] = useState<"ok" | "bad" | "na">("ok");
  const [inspectedAt, setInspectedAt] = useState(todayInput());
  const [performedByName, setPerformedByName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCheck = (key: CheckKey, v: boolean) => setChecks((c) => ({ ...c, [key]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extinguisherId: props.extinguisherId,
          companyId: props.companyId,
          inspectedAt,
          ...checks,
          pressureGaugeOk: gauge === "ok" ? true : gauge === "bad" ? false : null,
          performedByName,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Greška pri spremanju pregleda.");
        setBusy(false);
        return;
      }
      router.push("/korisnik/pregledi?spremljeno=1");
      router.refresh();
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aparat</div>
        <div className="mt-1 text-lg font-bold text-slate-900">{props.internalCode}</div>
        <div className="mt-1 text-sm text-slate-600">
          {props.typeCode ?? "—"} · {props.manufacturerName} · serijski {props.serialNumber}
        </div>
        <div className="mt-0.5 text-sm text-slate-500">Servis: {props.servicerName}</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="label" htmlFor="inspectedAt">Datum pregleda</label>
        <input
          id="inspectedAt"
          type="date"
          value={inspectedAt}
          max={todayInput()}
          onChange={(e) => setInspectedAt(e.target.value)}
          className="input h-9 w-full sm:w-48"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Kontrolna lista</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {CHECK_ITEMS.map((it) => (
            <div key={it.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-[200px] flex-1">
                <div className="text-sm font-medium text-slate-800">{it.label}</div>
                <div className="text-xs text-slate-500">{it.hint}</div>
              </div>
              <YesNo value={checks[it.key]} onChange={(v) => setCheck(it.key, v)} />
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-[200px] flex-1">
              <div className="text-sm font-medium text-slate-800">Manometar (kazaljka u zelenom)</div>
              <div className="text-xs text-slate-500">
                Samo za „P“ aparate sa stalnim tlakom. Ako nije primjenjivo, odaberite „Nije primjenjivo“.
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setGauge("ok")}
                className={[
                  "h-9 rounded-md px-3 text-sm font-medium transition",
                  gauge === "ok" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                U redu
              </button>
              <button
                type="button"
                onClick={() => setGauge("bad")}
                className={[
                  "h-9 rounded-md px-3 text-sm font-medium transition",
                  gauge === "bad" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                Nije u redu
              </button>
              <button
                type="button"
                onClick={() => setGauge("na")}
                className={[
                  "h-9 rounded-md px-3 text-sm font-medium transition",
                  gauge === "na" ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                Nije primjenjivo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="label" htmlFor="performedByName">Pregled obavio (ime i prezime)</label>
        <input
          id="performedByName"
          type="text"
          value={performedByName}
          onChange={(e) => setPerformedByName(e.target.value)}
          placeholder="Osoba zadužena za zaštitu od požara"
          className="input h-9 w-full"
        />

        <label className="label mt-4" htmlFor="note">Opaske</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Uočeni nedostaci ili napomene…"
          className="input w-full"
        />
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary h-10">
          {busy ? "Spremam…" : "Spremi pregled"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-outline h-10">
          Odustani
        </button>
      </div>
    </form>
  );
}
