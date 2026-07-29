"use client";

import { useState } from "react";

type Props = {
  agentCode: string | null;
  manufacturerName: string;
  productionYear: number;
  serviceYear: number;
  existingNextInternalYear: number | null;
  defaultInternalDone: boolean;
  intervalYears: number;
  ruleLabel: string;
  computedFirstUpYear: number;
  computedNextIfDone: number;
  /** U draweru: info box i unos jedan kraj drugog (manje skrola). */
  compact?: boolean;
};

export default function InternalInspectionSection(props: Props) {
  if (props.existingNextInternalYear === null) {
    return <FirstEntryPanel {...props} />;
  }
  return <KnownUpPanel {...props} />;
}

/* ----------------------------- Shared pieces ------------------------------ */

function Header({ ruleLabel }: { ruleLabel: string }) {
  const info =
    `Pravilo: ${ruleLabel}\nRok UP-a: do kraja istog mjeseca kao periodični (PP).`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="text-sm font-semibold text-slate-900">Unutarnji pregled (UP)</div>
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-white text-[10px] font-bold leading-none text-indigo-700 hover:bg-indigo-50"
        title={info}
        aria-label={info}
      >
        i
      </button>
    </div>
  );
}

type LockedSummaryProps = {
  internalDone: boolean;
  year: number;
  onEdit: () => void;
};

function LockedSummary({ internalDone, year, onEdit }: LockedSummaryProps) {
  return (
    <div className="flex h-full items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            UP u ovom servisu:
          </span>
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold " +
              (internalDone ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700")
            }
          >
            {internalDone ? "DA" : "NE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Idući UP:</span>
          <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
            {year}.
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        title="Uredi unos UP-a"
      >
        Uredi
      </button>
    </div>
  );
}

type EditRowProps = {
  internalDone: boolean | null;
  yearValue: string;
  minYear: number;
  onPickDone: (v: boolean) => void;
  onYearChange: (v: string) => void;
  onYearBlur: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
  confirmLabel: string;
  compact?: boolean;
};

function EditRow(p: EditRowProps) {
  const yearInputDisabled = p.internalDone === true;
  return (
    <div
      className={
        p.compact
          ? "flex flex-col gap-2.5"
          : "flex flex-wrap items-center gap-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-600">UP u ovom servisu:</span>
        <div className="inline-flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => p.onPickDone(true)}
            className={
              "px-3 py-1 text-xs font-semibold rounded-md transition " +
              (p.internalDone === true
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50")
            }
          >
            DA
          </button>
          <button
            type="button"
            onClick={() => p.onPickDone(false)}
            className={
              "px-3 py-1 text-xs font-semibold rounded-md transition " +
              (p.internalDone === false
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50")
            }
          >
            NE
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-wide text-slate-600">Idući UP (god.):</label>
        <input
          inputMode="numeric"
          pattern="[0-9]{4}"
          min={p.minYear}
          max={2100}
          disabled={yearInputDisabled}
          className={
            "input h-9 w-24 font-mono tabular-nums " +
            (yearInputDisabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "")
          }
          title={yearInputDisabled ? "Automatski izračun jer je UP odrađen ovim servisom" : ""}
          value={p.yearValue}
          onChange={(e) => p.onYearChange(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={p.onYearBlur}
        />
      </div>

      <button
        type="button"
        onClick={p.onConfirm}
        disabled={!p.canConfirm}
        className={
          (p.compact ? "w-full " : "ml-auto ") +
          "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition " +
          (p.canConfirm
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-slate-200 text-slate-500 cursor-not-allowed")
        }
      >
        {p.confirmLabel}
      </button>
    </div>
  );
}

/* ------------------------------ KnownUpPanel ------------------------------ */

function KnownUpPanel(props: Props) {
  const minYear = props.serviceYear + 1;

  const dueBaseYear = props.existingNextInternalYear ?? props.computedFirstUpYear;
  const autoInternalDone = props.defaultInternalDone || props.serviceYear >= dueBaseYear;

  function initialYear(done: boolean): number {
    if (done) return props.computedNextIfDone;
    return props.existingNextInternalYear ?? props.computedFirstUpYear;
  }

  const fallbackManual = String(
    props.existingNextInternalYear ?? props.computedFirstUpYear,
  );

  const [editing, setEditing] = useState<boolean>(false);
  const [internalDone, setInternalDone] = useState<boolean>(autoInternalDone);
  const [yearValue, setYearValue] = useState<string>(String(initialYear(autoInternalDone)));
  const [manualYearBackup, setManualYearBackup] = useState<string>(
    autoInternalDone ? fallbackManual : String(initialYear(false)),
  );

  const yearNum = Number(yearValue);
  const yearValid =
    yearValue.trim().length > 0 &&
    Number.isFinite(yearNum) &&
    yearNum >= minYear &&
    yearNum <= 2100;
  const canConfirm = yearValid;

  function pickDone(value: boolean) {
    if (value) {
      if (!internalDone) setManualYearBackup(yearValue);
      setInternalDone(true);
      setYearValue(String(props.computedNextIfDone));
    } else {
      setInternalDone(false);
      setYearValue(manualYearBackup);
    }
  }

  function onYearBlur() {
    const n = Number(yearValue);
    if (yearValue.trim().length > 0 && (!Number.isFinite(n) || n < minYear || n > 2100)) {
      setYearValue(String(initialYear(internalDone)));
    }
  }

  const submittedYear = yearValid
    ? yearNum
    : internalDone
      ? props.computedNextIfDone
      : (props.existingNextInternalYear ?? props.computedFirstUpYear);

  const statusBox = internalDone ? (
    <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5 h-full">
      <div className="flex items-start gap-2 text-sm text-indigo-950">
        <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">
          ✓
        </span>
        <div>
          <div className="font-semibold">UP unos potvrđen</div>
        </div>
      </div>
    </div>
  ) : props.serviceYear >= submittedYear ? (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 h-full">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
          !
        </span>
        Treba raditi UP ove godine
      </div>
      <div className="mt-1 text-xs text-amber-900">
        Rok: <span className="font-semibold tabular-nums">{submittedYear}.</span> Ovim servisom UP će biti evidentiran; idući UP:{" "}
        <span className="font-semibold tabular-nums">{props.computedNextIfDone}.</span>
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 h-full">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
          ✓
        </span>
        UP ne treba ove godine
      </div>
      <div className="mt-1 text-xs text-emerald-900">
        Idući UP: <span className="font-semibold tabular-nums">{submittedYear}.</span>
      </div>
    </div>
  );

  const actionBox = editing ? (
    <div className="rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-2.5 h-full">
      <EditRow
        internalDone={internalDone}
        yearValue={yearValue}
        minYear={minYear}
        onPickDone={pickDone}
        onYearChange={setYearValue}
        onYearBlur={onYearBlur}
        onConfirm={() => {
          if (canConfirm) setEditing(false);
        }}
        canConfirm={canConfirm}
        confirmLabel="Potvrdi"
        compact={props.compact}
      />
      {!yearValid && yearValue.trim().length > 0 ? (
        <p className="mt-2 text-[11px] font-medium text-amber-900">
          Godina mora biti &gt; {props.serviceYear}.
        </p>
      ) : null}
    </div>
  ) : (
    <LockedSummary
      internalDone={internalDone}
      year={submittedYear}
      onEdit={() => setEditing(true)}
    />
  );

  return (
    <section className="surface p-4">
      <Header ruleLabel={props.ruleLabel} />

      {/* Skriveni inputi koje backend čita */}
      {internalDone ? <input type="hidden" name="internalDone" value="on" /> : null}
      <input type="hidden" name="nextInternalYear" value={String(submittedYear)} />

      <div
        className={
          props.compact
            ? "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch"
            : "mt-3 space-y-3"
        }
      >
        {statusBox}
        {actionBox}
      </div>
    </section>
  );
}

/* ------------------------------ FirstEntryPanel --------------------------- */

/**
 * Panel kad aparat nema zabilježen UP u sustavu (prvi servis u sustavu).
 * Korisnik mora eksplicitno potvrditi DA/NE i unijeti godinu idućeg UP-a.
 * Native HTML validation (required) blokira submit dok izbor nije napravljen.
 */
function FirstEntryPanel(props: Props) {
  const minYear = props.serviceYear + 1;

  const [internalDone, setInternalDone] = useState<boolean | null>(null);
  const [yearValue, setYearValue] = useState<string>("");
  const [manualYearBackup, setManualYearBackup] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  function pickDone(value: boolean) {
    setTouched(true);
    if (value) {
      if (internalDone !== true) setManualYearBackup(yearValue);
      setInternalDone(true);
      setYearValue(String(props.computedNextIfDone));
    } else {
      setInternalDone(false);
      setYearValue(manualYearBackup);
    }
  }

  function onYearBlur() {
    setTouched(true);
    const n = Number(yearValue);
    if (yearValue.trim().length > 0 && (!Number.isFinite(n) || n < minYear || n > 2100)) {
      setYearValue("");
    }
  }

  const yearNum = Number(yearValue);
  const yearValid =
    yearValue.trim().length > 0 &&
    Number.isFinite(yearNum) &&
    yearNum >= minYear &&
    yearNum <= 2100;

  const canConfirm = internalDone !== null && yearValid;
  const showError = touched && !canConfirm;

  const hiddenSentinelValue = confirmed
    ? internalDone === true
      ? "yes"
      : "no"
    : "";
  const hiddenYearValue = confirmed ? String(yearNum) : "";

  const statusBox = confirmed ? (
    <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2 text-sm text-indigo-950">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs text-white"
        >
          ✓
        </span>
        <div>
          <div className="font-semibold">UP unos potvrđen</div>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 h-full">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs text-white"
        >
          !
        </span>
        UP još nije zabilježen u sustavu
      </div>
      <div className="mt-1 text-xs leading-snug text-amber-900">
        Unesi godinu idućeg UP-a i označi radi li se ovim servisom, zatim klikni „Potvrdi unos UP-a”.
      </div>
    </div>
  );

  const actionBox = confirmed ? (
    <LockedSummary
      internalDone={internalDone === true}
      year={yearNum}
      onEdit={() => setConfirmed(false)}
    />
  ) : (
    <div className="rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-2.5 h-full">
      <EditRow
        internalDone={internalDone}
        yearValue={yearValue}
        minYear={minYear}
        onPickDone={pickDone}
        onYearChange={(v) => {
          setYearValue(v);
          setTouched(true);
        }}
        onYearBlur={onYearBlur}
        onConfirm={() => {
          setTouched(true);
          if (canConfirm) setConfirmed(true);
        }}
        canConfirm={canConfirm}
        confirmLabel="Potvrdi unos UP-a"
        compact={props.compact}
      />

      {/*
        Required sentinel: dok korisnik ne klikne „Potvrdi unos UP-a",
        vrijednost je prazna pa native form validation blokira submit.
      */}
      <input
        aria-hidden
        tabIndex={-1}
        required
        name="internalDoneChoiceMade"
        value={hiddenSentinelValue}
        onChange={() => {}}
        onInvalid={() => setTouched(true)}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
          opacity: 0,
        }}
      />

      {showError ? (
        <p className="mt-2 text-[11px] font-medium text-amber-900">
          Označi DA ili NE i upiši godinu &gt; {props.serviceYear}.
        </p>
      ) : null}
    </div>
  );

  return (
    <section className="surface p-4">
      <Header ruleLabel={props.ruleLabel} />

      {/* Hidden inputi koje backend čita — aktivni tek nakon potvrde */}
      {confirmed && internalDone === true ? (
        <input type="hidden" name="internalDone" value="on" />
      ) : null}
      <input type="hidden" name="nextInternalYear" value={hiddenYearValue} />

      <div
        className={
          props.compact
            ? "mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch"
            : "mt-3 space-y-3"
        }
      >
        {props.compact ? (
          <>
            {statusBox}
            {actionBox}
          </>
        ) : (
          <>
            <div className="mt-0">{statusBox}</div>
            {actionBox}
          </>
        )}
      </div>
    </section>
  );
}
