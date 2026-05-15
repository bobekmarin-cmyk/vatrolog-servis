"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";
import type { SharedCodes } from "./AuthorizationsClient";

export default function SharedCodesPanel(props: {
  initial: SharedCodes;
  totalManufacturers: number;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [codes, setCodes] = useState<SharedCodes>(props.initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isLocked =
    !dirty &&
    (props.initial.periodicLabelCode.length > 0 ||
      props.initial.apparatusMassLabelCode.length > 0 ||
      props.initial.cylinderMassLabelCode.length > 0);
  const [unlocked, setUnlocked] = useState(!isLocked);

  function setField(k: keyof SharedCodes, v: string) {
    setCodes((c) => ({ ...c, [k]: v }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/authorizations/shared-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodicLabelCode: codes.periodicLabelCode.trim() || null,
          apparatusMassLabelCode: codes.apparatusMassLabelCode.trim() || null,
          cylinderMassLabelCode: codes.cylinderMassLabelCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Greška pri spremanju.");
      }
      setDirty(false);
      setUnlocked(false);
      setSavedAt(Date.now());
      router.refresh();
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      setCodes(props.initial);
      setDirty(false);
      await dialog.alert({
        title: "Nije moguće spremiti šifre",
        message: msg,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldsDisabled = !unlocked || saving;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-emerald-900">
            Zajedničke šifre naljepnica
          </div>
          <div className="text-xs text-emerald-900/80">
            Unesi tri šifre — primjenjuju se na svih {props.totalManufacturers} proizvođača
            jednako. Na otpremnici se prikazuju kao tri stavke (bez naziva proizvođača) sa
            zbrojenim količinama.
          </div>
        </div>
        {!unlocked ? (
          <button
            type="button"
            onClick={() => setUnlocked(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Uredi šifre
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FieldInput
          label="Šifra PP naljepnice"
          placeholder="npr. 1001"
          value={codes.periodicLabelCode}
          onChange={(v) => setField("periodicLabelCode", v)}
          disabled={fieldsDisabled}
        />
        <FieldInput
          label="Šifra naljepnice mase aparata"
          placeholder="npr. 1002"
          value={codes.apparatusMassLabelCode}
          onChange={(v) => setField("apparatusMassLabelCode", v)}
          disabled={fieldsDisabled}
        />
        <FieldInput
          label="Šifra naljepnice mase bočice"
          placeholder="npr. 1003"
          value={codes.cylinderMassLabelCode}
          onChange={(v) => setField("cylinderMassLabelCode", v)}
          disabled={fieldsDisabled}
        />
      </div>

      {unlocked ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Spremam…" : "Spremi šifre"}
          </button>
          {dirty && !saving ? (
            <button
              type="button"
              onClick={() => {
                setCodes(props.initial);
                setDirty(false);
                setUnlocked(!isLocked);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Odustani
            </button>
          ) : null}
          {savedAt ? (
            <span className="text-xs font-medium text-emerald-700">Spremljeno ✓</span>
          ) : null}
          <span className="text-xs text-emerald-900/70">
            Sve tri šifre moraju biti međusobno različite.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function FieldInput(props: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-emerald-900">{props.label}</span>
      <input
        type="text"
        className={
          "input h-9 font-mono text-sm " +
          (props.disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : "")
        }
        value={props.value}
        placeholder={props.placeholder ?? "—"}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        maxLength={50}
      />
    </label>
  );
}
