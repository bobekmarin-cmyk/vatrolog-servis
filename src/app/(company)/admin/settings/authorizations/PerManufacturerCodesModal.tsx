"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/ui/useDialog";

type Codes = {
  periodicLabelCode: string;
  apparatusMassLabelCode: string;
  cylinderMassLabelCode: string;
};

export default function PerManufacturerCodesModal(props: {
  manufacturerId: string;
  manufacturerName: string;
  initial: Codes;
  onClose: () => void;
  onSaved: (codes: Codes) => void;
}) {
  const dialog = useDialog();
  const [codes, setCodes] = useState<Codes>(props.initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) props.onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props, saving]);

  function setField(k: keyof Codes, v: string) {
    setCodes((c) => ({ ...c, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        active: true,
        periodicLabelCode: codes.periodicLabelCode.trim() || null,
        apparatusMassLabelCode: codes.apparatusMassLabelCode.trim() || null,
        cylinderMassLabelCode: codes.cylinderMassLabelCode.trim() || null,
      };
      const res = await fetch(`/api/admin/authorizations/${props.manufacturerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Greška pri spremanju.");
      }
      props.onSaved({
        periodicLabelCode: payload.periodicLabelCode ?? "",
        apparatusMassLabelCode: payload.apparatusMassLabelCode ?? "",
        cylinderMassLabelCode: payload.cylinderMassLabelCode ?? "",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška.";
      await dialog.alert({
        title: "Nije moguće spremiti šifre",
        message: msg,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function clearAll() {
    setCodes({
      periodicLabelCode: "",
      apparatusMassLabelCode: "",
      cylinderMassLabelCode: "",
    });
  }

  const dirty =
    codes.periodicLabelCode !== props.initial.periodicLabelCode ||
    codes.apparatusMassLabelCode !== props.initial.apparatusMassLabelCode ||
    codes.cylinderMassLabelCode !== props.initial.cylinderMassLabelCode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) props.onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900">Šifre naljepnica</div>
            <div className="text-xs text-slate-500">
              {props.manufacturerName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !saving && props.onClose()}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Zatvori"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field
            label="Šifra PP naljepnice"
            placeholder="npr. 1001"
            value={codes.periodicLabelCode}
            onChange={(v) => setField("periodicLabelCode", v)}
            disabled={saving}
          />
          <Field
            label="Šifra naljepnice mase aparata"
            placeholder="npr. 1002"
            value={codes.apparatusMassLabelCode}
            onChange={(v) => setField("apparatusMassLabelCode", v)}
            disabled={saving}
          />
          <Field
            label="Šifra naljepnice mase bočice"
            placeholder="npr. 1003"
            value={codes.cylinderMassLabelCode}
            onChange={(v) => setField("cylinderMassLabelCode", v)}
            disabled={saving}
          />
        </div>

        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="font-semibold">Pravila:</div>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
            <li>Tri šifre ovog proizvođača moraju biti međusobno različite.</li>
            <li>
              Za istu vrstu naljepnice ne smiješ koristiti šifru koja već postoji kod drugog
              proizvođača.
            </li>
            <li>Prazno polje znači da naljepnica nije evidentirana za ovog proizvođača.</li>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={clearAll}
            disabled={saving}
            className="text-xs text-slate-500 hover:text-rose-700 disabled:opacity-50"
          >
            Obriši sve šifre
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => props.onClose()}
              disabled={saving}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Odustani
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Spremam…" : "Spremi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-700">{props.label}</span>
      <input
        type="text"
        className={
          "input h-9 font-mono text-sm " +
          (props.disabled ? "cursor-not-allowed bg-slate-50 text-slate-500" : "")
        }
        value={props.value}
        placeholder={props.placeholder ?? "—"}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        maxLength={50}
        autoFocus={props.label.startsWith("Šifra PP")}
      />
    </label>
  );
}
