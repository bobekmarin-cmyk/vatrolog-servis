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
const DEFAULT_PRESET = LABEL_SHEET_PRESETS[0];
const DEFAULT_TO = DEFAULT_PRESET.columns * DEFAULT_PRESET.rows;

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
  const [to, setTo] = useState<number>(DEFAULT_TO);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET.id);
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
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* LIJEVO — kontrole */}
      <section className="surface space-y-4 p-4">
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
                  className={`min-w-[56px] rounded-lg border px-3 py-2 text-center text-base font-bold transition ${
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
              className={`input w-24 ${customActive ? "border-red-500 ring-1 ring-red-200" : ""}`}
              value={customWeight}
              onChange={(e) => changeCustom(e.target.value)}
            />
          </div>
        </div>

        {/* 2. Raspon rednih brojeva */}
        <div>
          <div className="label">2. Raspon rednih brojeva</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
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
          <div className="label">3. Raster naljepnica (Avery)</div>
          <div className="mt-2 grid gap-2">
            {LABEL_SHEET_PRESETS.map((p) => {
              const active = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                    active
                      ? "border-red-600 bg-red-50 ring-1 ring-red-200"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                >
                  <LabelPreview preset={p} servicerName={servicerName} code={firstCode} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800">
                      {p.labelWidth} × {p.labelHeight} mm
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.columns * p.rows}/A4 ({p.columns}×{p.rows})
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-400">{averyName(p.label)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fini pomak */}
        <div className="border-t border-slate-200 pt-3">
          <button
            type="button"
            className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "− Fini pomak (kalibracija pisača)" : "+ Fini pomak (kalibracija pisača)"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500" htmlFor="offsetX">Pomak X (mm)</label>
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
                <label className="text-xs text-slate-500" htmlFor="offsetY">Pomak Y (mm)</label>
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
      </section>

      {/* DESNO — pregled + akcije + napomena */}
      <div className="space-y-4 lg:sticky lg:top-4">
        <section className="surface space-y-3 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Naljepnica" value={`${preset.labelWidth} × ${preset.labelHeight} mm`} />
            <Stat label="Po arku" value={`${perPage} (${preset.columns}×${preset.rows})`} />
            <Stat label="Servis" value={servicerName} />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-3">
            <Stat label="Prvi kod" value={firstCode} mono />
            <Stat label="Zadnji kod" value={lastCode} mono />
            <Stat
              label="Ukupno"
              value={validation.ok ? `${count} kom · ${pages} ${pages === 1 ? "arak" : "araka"}` : "—"}
            />
          </div>

          {!validation.ok ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {validation.error}
            </div>
          ) : missing > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>
                Zadnji arak: <strong>{lastSheetUsed}/{perPage}</strong> — {missing} {missing === 1 ? "prazno mjesto" : "praznih mjesta"}.
              </span>
              {canTopUp ? (
                <button
                  type="button"
                  className="btn btn-outline self-start px-3 py-1.5 text-sm"
                  onClick={() => setTo((t) => t + missing)}
                >
                  Dopuni do punog arka (+{missing})
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              Puni arci — nema ostatka. ✓
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
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

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span className="font-semibold">Za točan ispis:</span> ispis na <strong>100% / „Stvarna veličina”</strong> (ne „Prilagodi stranici”). Prvo ispišite <strong>kalibracijski list</strong> i provjerite da linije mjere 100 mm; po potrebi korigirajte <strong>fini pomak X/Y</strong>.
        </section>
      </div>
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

function averyName(label: string): string {
  const parts = label.split("·");
  return parts.length > 1 ? parts[parts.length - 1].trim() : label;
}

/** Mali vizualni primjer naljepnice (točan omjer stranica + raspored). */
function LabelPreview({
  preset,
  servicerName,
  code,
}: {
  preset: { labelWidth: number; labelHeight: number };
  servicerName: string;
  code: string;
}) {
  return (
    <div
      className="shrink-0 rounded border border-slate-300 bg-white p-1 shadow-sm"
      style={{ width: 116, aspectRatio: `${preset.labelWidth} / ${preset.labelHeight}` }}
    >
      <div className="flex h-full items-center gap-1">
        <MiniQr />
        <div className="flex min-w-0 flex-col justify-center leading-none">
          <div className="text-[7px] font-extrabold text-slate-900">
            Vatro<span className="text-red-600">Log</span>
          </div>
          <div className="mt-[1px] truncate text-[6px] text-slate-500">{servicerName}</div>
          <div className="mt-[1px] text-[7px] font-bold text-slate-900">{code}</div>
        </div>
      </div>
    </div>
  );
}

function MiniQr() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-auto shrink-0" style={{ aspectRatio: "1" }} aria-hidden="true">
      <rect width="100" height="100" fill="#fff" />
      {/* finder patterns (3 kuta) */}
      {[
        [4, 4],
        [66, 4],
        [4, 66],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="30" height="30" fill="#0f172a" />
          <rect x={x + 5} y={y + 5} width="20" height="20" fill="#fff" />
          <rect x={x + 10} y={y + 10} width="10" height="10" fill="#0f172a" />
        </g>
      ))}
      {/* nekoliko modula da izgleda kao QR */}
      {[
        [44, 8],
        [52, 16],
        [44, 24],
        [60, 44],
        [44, 52],
        [52, 60],
        [70, 52],
        [44, 70],
        [60, 78],
        [78, 70],
        [52, 86],
        [86, 86],
      ].map(([x, y], i) => (
        <rect key={`m${i}`} x={x} y={y} width="8" height="8" fill="#0f172a" />
      ))}
    </svg>
  );
}
