"use client";

import { useMemo, useState } from "react";
import {
  LABEL_SHEET_PRESETS,
  formatLabelCode,
  getLabelSheetPreset,
  pageCount,
  validateLabelRange,
} from "@/lib/labelSheets";

const COMMON_WEIGHTS = [1, 2, 3, 6, 9];

export default function QrLabelGeneratorForm({
  serviceCode,
  servicerName,
}: {
  serviceCode: string;
  servicerName: string;
}) {
  const [weight, setWeight] = useState<number>(6);
  const [customWeight, setCustomWeight] = useState<string>("");
  const [from, setFrom] = useState<number>(1);
  const [to, setTo] = useState<number>(15);
  const [presetId, setPresetId] = useState<string>(LABEL_SHEET_PRESETS[0].id);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const preset = getLabelSheetPreset(presetId);
  const validation = validateLabelRange({ weight, from, to });
  const count = validation.ok ? validation.count : 0;
  const pages = validation.ok ? pageCount(count, preset) : 0;

  const perPage = preset.columns * preset.rows;
  const remainder = count > 0 ? count % perPage : 0;
  const missing = remainder === 0 ? 0 : perPage - remainder;
  const lastSheetUsed = remainder === 0 ? perPage : remainder;
  const canTopUp = missing > 0 && to + missing <= 99999;

  const firstCode = useMemo(() => formatLabelCode(serviceCode, weight, from), [serviceCode, weight, from]);
  const lastCode = useMemo(() => formatLabelCode(serviceCode, weight, to), [serviceCode, weight, to]);

  const customActive = !COMMON_WEIGHTS.includes(weight);

  function selectChip(v: number) {
    setWeight(v);
    setCustomWeight("");
  }

  function changeCustom(value: string) {
    setCustomWeight(value);
    const n = Math.trunc(Number(value));
    if (Number.isFinite(n) && n > 0) setWeight(n);
  }

  function buildUrl(mode: "labels" | "calibration"): string {
    const p = new URLSearchParams();
    p.set("mode", mode);
    p.set("preset", presetId);
    p.set("offsetX", String(offsetX));
    p.set("offsetY", String(offsetY));
    if (mode === "labels") {
      p.set("weight", String(weight));
      p.set("from", String(from));
      p.set("to", String(to));
    }
    return `/qr-naljepnice/pdf?${p.toString()}`;
  }

  function open(mode: "labels" | "calibration") {
    window.open(buildUrl(mode), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 space-y-6">
        {/* 1. Težina */}
        <div>
          <div className="label">1. Težina / zapremina punjenja</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {COMMON_WEIGHTS.map((v) => {
              const active = customWeight === "" && weight === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => selectChip(v)}
                  className={`min-w-[64px] rounded-xl border px-4 py-2.5 text-center text-base font-bold transition ${
                    active
                      ? "border-red-600 bg-red-50 text-red-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {v}
                  <span className="ml-1 text-xs font-normal text-slate-400">kg/L</span>
                </button>
              );
            })}
            <span className="px-1 text-sm text-slate-400">ili</span>
            <input
              type="number"
              min={1}
              max={999}
              inputMode="numeric"
              placeholder="Ostalo"
              aria-label="Druga težina punjenja"
              className={`input w-28 ${customActive ? "border-red-500 ring-1 ring-red-200" : ""}`}
              value={customWeight}
              onChange={(e) => changeCustom(e.target.value)}
            />
          </div>
        </div>

        {/* 2. Raspon rednih brojeva */}
        <div>
          <div className="label">2. Raspon rednih brojeva</div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500" htmlFor="from">Od</label>
              <input
                id="from"
                type="number"
                min={1}
                max={99999}
                className="input"
                value={from}
                onChange={(e) => setFrom(Math.trunc(Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500" htmlFor="to">Do</label>
              <input
                id="to"
                type="number"
                min={1}
                max={99999}
                className="input"
                value={to}
                onChange={(e) => setTo(Math.trunc(Number(e.target.value)))}
              />
            </div>
          </div>
        </div>

        {/* 3. Raster */}
        <div>
          <label className="label" htmlFor="preset">3. Raster naljepnica</label>
          <select id="preset" className="input mt-2" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {LABEL_SHEET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Pregled */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Naljepnica" value={`${preset.labelWidth} × ${preset.labelHeight} mm`} />
            <Stat label="Po arku" value={`${perPage} (${preset.columns}×${preset.rows})`} />
            <Stat label="Servis" value={servicerName} />
          </div>
          <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3">
            <Stat label="Prvi kod" value={firstCode} mono />
            <Stat label="Zadnji kod" value={lastCode} mono />
            <Stat
              label="Ukupno"
              value={validation.ok ? `${count} kom · ${pages} ${pages === 1 ? "arak" : "araka"}` : "—"}
            />
          </div>
          {!validation.ok ? (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {validation.error}
            </div>
          ) : missing > 0 ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Zadnji arak: <strong>{lastSheetUsed}/{perPage}</strong> — {missing} {missing === 1 ? "prazno mjesto" : "praznih mjesta"}.
              </span>
              {canTopUp ? (
                <button
                  type="button"
                  className="btn btn-outline shrink-0 px-3 py-1.5 text-sm"
                  onClick={() => setTo((t) => t + missing)}
                >
                  Dopuni do punog arka (+{missing})
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              Puni arci — nema ostatka. ✓
            </div>
          )}
        </div>

        {/* Fini pomak */}
        <div>
          <button
            type="button"
            className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Sakrij fini pomak" : "Fini pomak (kalibracija pisača)"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="offsetX">Pomak X (mm)</label>
                <input
                  id="offsetX"
                  type="number"
                  step={0.1}
                  min={-20}
                  max={20}
                  className="input"
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label" htmlFor="offsetY">Pomak Y (mm)</label>
                <input
                  id="offsetY"
                  type="number"
                  step={0.1}
                  min={-20}
                  max={20}
                  className="input"
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Akcije */}
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            className="btn btn-primary px-5"
            disabled={!validation.ok}
            onClick={() => open("labels")}
          >
            Generiraj PDF
          </button>
          <button type="button" className="btn btn-outline px-4" onClick={() => open("calibration")}>
            Kalibracijski list
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">Važno za točan ispis</div>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>U dijalogu za ispis postavite <strong>Mjerilo: 100%</strong> / „Stvarna veličina” (ne „Prilagodi stranici”).</li>
          <li>Prvo ispišite <strong>kalibracijski list</strong> i ravnalom provjerite da referentne linije mjere točno 100 mm.</li>
          <li>Ako raster nije poravnat s arkom, korigirajte <strong>fini pomak X/Y</strong> i ponovite.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
